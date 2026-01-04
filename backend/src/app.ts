import express, { Request, Response, NextFunction, RequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { z } from "zod";

import { config } from "./config";
import { Db, getAgentKey, insertUsageReceipt, upsertAgentKey } from "./db";
import { issueNonce, verifySignedNonce } from "./auth";
import { deriveOwnerKey, decryptOwnerKey, encryptForClient, encryptOwnerKey, hashRequest } from "./crypto";
import { callProvider } from "./ai";
import { ChainClient } from "./chain";
import { buildPaymentMiddleware } from "./x402";

const addressRegex = /^0x[a-fA-F0-9]{1,64}$/;
const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/;

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function createApp(options: {
  db: Db;
  chain: ChainClient;
  paymentMiddleware?: RequestHandler;
}) {
  const { db, chain } = options;
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.includes("*") ? "*" : config.corsOrigins,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      redact: {
        paths: ["req.headers.authorization", "req.body.api_key", "req.body.prompt"],
        remove: true,
      },
    })
  );

  const ipLimiter = rateLimit({ windowMs: 60_000, max: 60 });
  const walletLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    keyGenerator: req => (req.body?.address ? String(req.body.address) : req.ip),
  });

  app.use(ipLimiter);

  if (options.paymentMiddleware) {
    app.use(options.paymentMiddleware);
  } else if (config.x402.enabled) {
    app.use(buildPaymentMiddleware(db, chain));
  }

  app.post(
    "/auth/nonce",
    walletLimiter,
    asyncHandler(async (req, res) => {
      const schema = z.object({
        address: z.string().regex(addressRegex),
      });
      const { address } = schema.parse(req.body);
      const { nonce, expiresAt } = issueNonce(db, normalizeAddress(address));
      res.json({ nonce, expires_at: expiresAt });
    })
  );

  app.get(
    "/agents",
    asyncHandler(async (_req, res) => {
      const count = await chain.getAgentCount();
      const agents = [] as any[];
      for (let i = 0; i < count; i += 1) {
        agents.push(await chain.getAgent(i));
      }
      res.json({ agents });
    })
  );

  app.get(
    "/agents/:id",
    asyncHandler(async (req, res) => {
      const agentId = Number(req.params.id);
      if (Number.isNaN(agentId)) {
        res.status(400).json({ error: "invalid_agent_id" });
        return;
      }
      const agent = await chain.getAgent(agentId);
      res.json(agent);
    })
  );

  app.post(
    "/agents/:id/key",
    walletLimiter,
    asyncHandler(async (req, res) => {
      const schema = z.object({
        address: z.string().regex(addressRegex),
        public_key: z.string().min(64),
        signature: z.string().min(64),
        nonce: z.string().min(10),
        signature_format: z.enum(["message", "hash"]).optional(),
        provider: z.enum(["openai", "anthropic"]),
        api_key: z.string().min(1),
        payout_address: z.string().regex(evmAddressRegex),
      });
      const parsed = schema.parse(req.body);
      const agentId = Number(req.params.id);
      if (Number.isNaN(agentId)) {
        res.status(400).json({ error: "invalid_agent_id" });
        return;
      }

      const address = normalizeAddress(parsed.address);
      const valid = verifySignedNonce(db, {
        address,
        publicKey: parsed.public_key,
        signature: parsed.signature,
        nonce: parsed.nonce,
        signatureFormat: parsed.signature_format ?? "message",
      });
      if (!valid) {
        res.status(401).json({ error: "invalid_signature" });
        return;
      }

      const agent = await chain.getAgent(agentId);
      if (normalizeAddress(agent.owner) !== address) {
        res.status(403).json({ error: "not_owner" });
        return;
      }

      const derivedKey = deriveOwnerKey(config.apiKeyEncSecret, address, agentId);
      const encrypted = encryptOwnerKey(parsed.api_key, derivedKey);
      upsertAgentKey(db, {
        agent_id: agentId,
        owner_address: address,
        encrypted_key: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        provider: parsed.provider,
        payout_address: parsed.payout_address,
      });

      res.json({ status: "ok" });
    })
  );

  app.post(
    "/agents/:id/use",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        prompt: z.string().min(1).max(4000),
        client_public_key: z.string().min(20),
        payer_address: z.string().regex(addressRegex),
      });
      const { prompt, client_public_key, payer_address } = schema.parse(req.body);

      const agentId = Number(req.params.id);
      if (Number.isNaN(agentId)) {
        res.status(400).json({ error: "invalid_agent_id" });
        return;
      }

      const agent = await chain.getAgent(agentId);
      if (agent.paused || agent.key_status !== 1) {
        res.status(409).json({ error: "agent_unavailable" });
        return;
      }

      const record = getAgentKey(db, agentId);
      if (!record || normalizeAddress(record.owner_address) !== normalizeAddress(agent.owner)) {
        res.status(409).json({ error: "owner_key_missing" });
        return;
      }

      const derivedKey = deriveOwnerKey(config.apiKeyEncSecret, record.owner_address, agentId);
      const ownerApiKey = decryptOwnerKey(record.encrypted_key, record.iv, record.tag, derivedKey);

      const aiResponse = await callProvider(record.provider as any, ownerApiKey, prompt);
      const encrypted = encryptForClient(client_public_key, aiResponse);

      const requestSeed = `${agentId}:${payer_address}:${Date.now()}:${prompt}`;
      const { hashHex, hashU128 } = hashRequest(requestSeed);
      const amount = agent.usage_fee;
      const protocolFee = Math.floor((amount * 5) / 100);
      const ownerAmount = amount - protocolFee;

      insertUsageReceipt(db, {
        agent_id: agentId,
        payer_address: normalizeAddress(payer_address),
        amount,
        request_hash: hashHex,
      });

      await chain.recordUsage({
        agentId,
        payer: normalizeAddress(payer_address),
        amount,
        requestHash: hashU128,
      });

      res.json({
        request_hash: hashHex,
        amount,
        protocol_fee: protocolFee,
        owner_amount: ownerAmount,
        encrypted_response: encrypted,
      });
    })
  );

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "internal_error";
    res.status(500).json({ error: message });
  });

  return app;
}
