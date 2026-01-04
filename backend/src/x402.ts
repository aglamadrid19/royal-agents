import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPRequestContext } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { RequestHandler } from "express";
import { Db, getAgentKey } from "./db";
import { ChainClient } from "./chain";
import { config } from "./config";

function parseAgentId(path: string): number | null {
  const match = path.match(/\/agents\/(\d+)\/use/i);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

async function resolvePrice(chain: ChainClient, context: HTTPRequestContext): Promise<string> {
  const agentId = parseAgentId(context.path);
  if (agentId === null || Number.isNaN(agentId)) {
    throw new Error("Invalid agent id");
  }
  const agent = await chain.getAgent(agentId);
  const cents = agent.usage_fee;
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
}

async function resolvePayTo(db: Db, context: HTTPRequestContext): Promise<string> {
  const agentId = parseAgentId(context.path);
  if (agentId === null || Number.isNaN(agentId)) {
    throw new Error("Invalid agent id");
  }
  const record = getAgentKey(db, agentId);
  if (record?.payout_address) {
    return record.payout_address;
  }
  if (config.x402.payToAddress) {
    return config.x402.payToAddress;
  }
  throw new Error("Missing payTo address");
}

export function buildPaymentMiddleware(db: Db, chain: ChainClient): RequestHandler {
  const facilitatorClient = new HTTPFacilitatorClient({ url: config.x402.facilitatorUrl });
  const server = new x402ResourceServer(facilitatorClient);
  server.register(config.x402.network, new ExactEvmScheme());

  const routes = {
    "POST /agents/[id]/use": {
      accepts: {
        scheme: "exact",
        network: config.x402.network,
        payTo: (context: HTTPRequestContext) => resolvePayTo(db, context),
        price: (context: HTTPRequestContext) => resolvePrice(chain, context),
      },
      description: "RoyalAgents pay-per-request",
      mimeType: "application/json",
    },
  };

  return paymentMiddleware(routes, server);
}
