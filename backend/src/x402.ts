import type { Request, RequestHandler } from "express";
import {
  createHttpFacilitatorClient,
  fromBase64Json,
  toBase64Json,
  type PaymentRequirements,
} from "x402plus";
import { Db, getAgentKey } from "./db";
import { ChainClient } from "./chain";
import { config } from "./config";
import { computeMaxAmount, resolveToolBudget } from "./pricing";

function parseAgentId(path: string): number | null {
  const match = path.match(/\/agents\/(\d+)\/use/i);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function absoluteResourceUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}${req.originalUrl.split("?")[0]}`;
}

function isMovementNetwork(network: string): boolean {
  return network === "movement" || network.startsWith("movement-");
}

function resolvePayTo(db: Db, agentId: number, agentOwner: string): string {
  if (isMovementNetwork(config.x402.network)) {
    return config.movePackageAddress;
  }
  const record = getAgentKey(db, agentId);
  if (record?.payout_address) {
    return record.payout_address;
  }
  if (agentOwner) {
    return agentOwner;
  }
  if (config.x402.payToAddress) {
    return config.x402.payToAddress;
  }
  throw new Error("Missing payTo address");
}

export function buildPaymentMiddleware(db: Db, chain: ChainClient): RequestHandler {
  const facilitatorClient = createHttpFacilitatorClient({
    url: config.x402.facilitatorUrl,
  });

  return async (req, res, next) => {
    if (req.method.toUpperCase() !== "POST") {
      return next();
    }

    const agentId = parseAgentId(req.path);
    if (agentId === null || Number.isNaN(agentId)) {
      return next();
    }

    const agent = await chain.getAgent(agentId);
    const payTo = resolvePayTo(db, agentId, agent.owner);
    let toolBudget = 0;
    try {
      toolBudget = resolveToolBudget(agent, req.body?.tool_budget);
    } catch (error) {
      return res.status(400).json({ error: "invalid_tool_budget" });
    }
    const maxAmount = computeMaxAmount(agent, toolBudget);
    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: config.x402.network,
      maxAmountRequired: maxAmount.toString(),
      resource: absoluteResourceUrl(req),
      description: "RoyalAgents pay-per-request",
      mimeType: "application/json",
      payTo,
      maxTimeoutSeconds: config.x402.maxTimeoutSeconds,
      asset: config.x402.asset,
    };

    const xPaymentHeader = req.header("x-payment");
    if (!xPaymentHeader) {
      return res.status(402).json({ x402Version: 1, accepts: [requirements] });
    }

    let paymentPayload: any;
    try {
      paymentPayload = fromBase64Json(xPaymentHeader);
    } catch (error) {
      return res.status(400).json({ error: "invalid_payment_header" });
    }

    try {
      const verifyResp = await facilitatorClient.verify({
        x402Version: 1,
        paymentPayload,
        paymentRequirements: requirements,
      });

      if (!verifyResp.isValid) {
        return res
          .status(402)
          .json({
            x402Version: 1,
            accepts: [requirements],
            error: verifyResp.invalidReason ?? "Invalid payment",
          });
      }

      const settleRequest = {
        x402Version: 1,
        paymentPayload,
        paymentRequirements: requirements,
      };
      let settleResp = await facilitatorClient.settle(settleRequest);
      let isSuccess =
        settleResp.success === true ||
        (!!settleResp.transaction && settleResp.transaction !== "");
      if (!isSuccess) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        settleResp = await facilitatorClient.settle(settleRequest);
        isSuccess =
          settleResp.success === true ||
          (!!settleResp.transaction && settleResp.transaction !== "");
      }
      if (!isSuccess) {
        return res
          .status(402)
          .json({
            x402Version: 1,
            accepts: [requirements],
            error: settleResp.errorReason ?? settleResp.error ?? "Settlement failed",
          });
      }

      res.setHeader("X-PAYMENT-RESPONSE", toBase64Json(settleResp));
      return next();
    } catch (error) {
      return res.status(500).json({ error: "payment_verification_failed" });
    }
  };
}
