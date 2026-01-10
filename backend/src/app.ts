import express, { Request, Response, NextFunction, RequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { z } from "zod";

import { config } from "./config";
import {
  Db,
  getAgentConfig,
  getAgentKey,
  getAgentRunner,
  insertAgentConfig,
  insertUsageReceipt,
  upsertAgentKey,
  upsertAgentRunner,
} from "./db";
import { issueNonce, verifySignedNonce } from "./auth";
import {
  deriveConfigKey,
  deriveOwnerKey,
  decryptAgentConfig,
  decryptOwnerKey,
  encryptAgentConfig,
  encryptForClient,
  encryptOwnerKey,
  hashRequest,
} from "./crypto";
import { callProvider } from "./ai";
import { ChainClient } from "./chain";
import { buildPaymentMiddleware } from "./x402";
import {
  HOSTED_CONFIG_VERSION,
  RUNNER_CONFIG_VERSION,
  HostedAgentConfigInput,
  RunnerAgentConfigInput,
  hashHostedConfig,
  hashRunnerConfig,
} from "./agentConfig";
import {
  AGENT_TYPE_HOSTED,
  AGENT_TYPE_RUNNER,
  computeActualAmount,
  computeMaxAmount,
  resolveToolBudget,
} from "./pricing";
import { callRunner } from "./runner";

const addressRegex = /^0x[a-fA-F0-9]{1,64}$/;
const providerMap: Record<number, "xai" | "openai" | "anthropic"> = {
  1: "xai",
  2: "openai",
  3: "anthropic",
};
const DEFAULT_TOOL_NAME = "generate_logo_svg";
const PROTOCOL_FEE_BPS = 500;

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function providerToString(provider: number) {
  const mapped = providerMap[provider];
  if (!mapped) {
    throw new Error("unsupported_provider");
  }
  return mapped;
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
    keyGenerator: req => (req.body?.address ? String(req.body.address) : req.ip ?? ""),
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
        provider: z.enum(["openai", "anthropic", "xai"]),
        api_key: z.string().min(1),
        payout_address: z.string().regex(addressRegex).optional(),
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
      if (agent.agent_type !== AGENT_TYPE_HOSTED) {
        res.status(409).json({ error: "agent_type_mismatch" });
        return;
      }
      const expectedProvider = providerToString(agent.provider);
      if (parsed.provider !== expectedProvider) {
        res.status(409).json({ error: "provider_mismatch" });
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
        payout_address: parsed.payout_address ?? "",
      });

      res.json({ status: "ok" });
    })
  );

  app.post(
    "/agents/:id/runner",
    walletLimiter,
    asyncHandler(async (req, res) => {
      const schema = z.object({
        address: z.string().regex(addressRegex),
        public_key: z.string().min(64),
        signature: z.string().min(64),
        nonce: z.string().min(10),
        signature_format: z.enum(["message", "hash"]).optional(),
        runner_url: z.string().url().max(2048),
        runner_secret: z.string().min(8).max(256),
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
      if (agent.agent_type !== AGENT_TYPE_RUNNER) {
        res.status(409).json({ error: "agent_type_mismatch" });
        return;
      }

      const derivedKey = deriveOwnerKey(config.apiKeyEncSecret, address, agentId);
      const encrypted = encryptOwnerKey(parsed.runner_secret, derivedKey);
      upsertAgentRunner(db, {
        agent_id: agentId,
        owner_address: address,
        runner_url: parsed.runner_url,
        encrypted_secret: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
      });

      res.json({ status: "ok" });
    })
  );

  app.post(
    "/agents/:id/config",
    walletLimiter,
    asyncHandler(async (req, res) => {
      const schema = z.object({
        address: z.string().regex(addressRegex),
        public_key: z.string().min(64),
        signature: z.string().min(64),
        nonce: z.string().min(10),
        signature_format: z.enum(["message", "hash"]).optional(),
        system_prompt: z.string().min(1).max(8000),
        temperature: z.number().min(0).max(2).optional(),
        max_tokens: z.number().int().min(1).max(4096).optional(),
        tool_name: z.string().min(1).max(64).optional(),
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
      if (getAgentConfig(db, agentId)) {
        res.status(409).json({ error: "config_already_set" });
        return;
      }

      let payload = "";
      let hashHex = "";
      if (agent.agent_type === AGENT_TYPE_HOSTED) {
        const expectedProvider = providerToString(agent.provider);
        const configInput: HostedAgentConfigInput = {
          system_prompt: parsed.system_prompt,
          temperature: parsed.temperature ?? 0.2,
          max_tokens: parsed.max_tokens ?? 512,
        };
        hashHex = hashHostedConfig({
          provider: expectedProvider,
          model: agent.model,
          system_prompt: configInput.system_prompt,
          temperature: configInput.temperature,
          max_tokens: configInput.max_tokens,
        }).hashHex;
        if (hashHex !== agent.config_hash) {
          res.status(409).json({ error: "config_hash_mismatch" });
          return;
        }
        payload = JSON.stringify({
          version: HOSTED_CONFIG_VERSION,
          agent_type: "hosted",
          provider: expectedProvider,
          model: agent.model,
          ...configInput,
        });
      } else if (agent.agent_type === AGENT_TYPE_RUNNER) {
        const configInput: RunnerAgentConfigInput = {
          system_prompt: parsed.system_prompt,
          tool_name: parsed.tool_name ?? DEFAULT_TOOL_NAME,
        };
        hashHex = hashRunnerConfig(configInput).hashHex;
        if (hashHex !== agent.config_hash) {
          res.status(409).json({ error: "config_hash_mismatch" });
          return;
        }
        payload = JSON.stringify({
          version: RUNNER_CONFIG_VERSION,
          agent_type: "runner",
          ...configInput,
        });
      } else {
        res.status(409).json({ error: "agent_type_mismatch" });
        return;
      }
      const configKey = deriveConfigKey(config.apiKeyEncSecret, agentId);
      const encrypted = encryptAgentConfig(payload, configKey);
      insertAgentConfig(db, {
        agent_id: agentId,
        config_hash: hashHex,
        encrypted_config: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
      });

      res.json({ status: "ok", config_hash: hashHex });
    })
  );

  app.post(
    "/agents/:id/use",
    asyncHandler(async (req, res) => {
      const schema = z.object({
        prompt: z.string().min(1).max(4000),
        client_public_key: z.string().min(20),
        payer_address: z.string().regex(addressRegex),
        tool_budget: z.union([z.number(), z.string()]).optional(),
      });
      const { prompt, client_public_key, payer_address, tool_budget } = schema.parse(req.body);

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

      const storedConfig = getAgentConfig(db, agentId);
      if (!storedConfig) {
        res.status(409).json({ error: "config_missing" });
        return;
      }
      if (storedConfig.config_hash !== agent.config_hash) {
        res.status(409).json({ error: "config_hash_mismatch" });
        return;
      }
      let toolBudget = 0;
      try {
        toolBudget = resolveToolBudget(agent, tool_budget);
      } catch (error) {
        res.status(400).json({ error: "invalid_tool_budget" });
        return;
      }

      const configKey = deriveConfigKey(config.apiKeyEncSecret, agentId);
      const decryptedConfig = decryptAgentConfig(
        storedConfig.encrypted_config,
        storedConfig.iv,
        storedConfig.tag,
        configKey
      );
      const parsedConfig = JSON.parse(decryptedConfig) as {
        system_prompt: string;
        temperature?: number;
        max_tokens?: number;
        model?: string;
        provider?: string;
        tool_name?: string;
      };

      const requestSeed = `${agentId}:${payer_address}:${Date.now()}:${prompt}`;
      const { hashHex, hashU128 } = hashRequest(requestSeed);
      const maxAmount = computeMaxAmount(agent, toolBudget);

      let responseText = "";
      let toolCalls = 0;
      let actualAmount = 0n;

      try {
        if (agent.agent_type === AGENT_TYPE_HOSTED) {
          const record = getAgentKey(db, agentId);
          if (!record || normalizeAddress(record.owner_address) !== normalizeAddress(agent.owner)) {
            res.status(409).json({ error: "owner_key_missing" });
            return;
          }
          const provider = providerToString(agent.provider);
          if (parsedConfig.provider !== provider || parsedConfig.model !== agent.model) {
            res.status(409).json({ error: "config_metadata_mismatch" });
            return;
          }
          const derivedKey = deriveOwnerKey(config.apiKeyEncSecret, record.owner_address, agentId);
          const ownerApiKey = decryptOwnerKey(record.encrypted_key, record.iv, record.tag, derivedKey);
          responseText = await callProvider(provider, ownerApiKey, prompt, {
            model: agent.model,
            systemPrompt: parsedConfig.system_prompt,
            temperature: parsedConfig.temperature ?? 0.2,
            maxTokens: parsedConfig.max_tokens ?? 512,
          });
          toolCalls = 0;
          actualAmount = computeActualAmount(agent, toolCalls);
        } else if (agent.agent_type === AGENT_TYPE_RUNNER) {
          const runnerRecord = getAgentRunner(db, agentId);
          if (!runnerRecord || normalizeAddress(runnerRecord.owner_address) !== normalizeAddress(agent.owner)) {
            res.status(409).json({ error: "owner_runner_missing" });
            return;
          }
          const derivedKey = deriveOwnerKey(config.apiKeyEncSecret, runnerRecord.owner_address, agentId);
          const runnerSecret = decryptOwnerKey(
            runnerRecord.encrypted_secret,
            runnerRecord.iv,
            runnerRecord.tag,
            derivedKey
          );
          const toolName = parsedConfig.tool_name ?? DEFAULT_TOOL_NAME;
          const runnerResult = await callRunner({
            runnerUrl: runnerRecord.runner_url,
            runnerSecret,
            prompt,
            systemPrompt: parsedConfig.system_prompt,
            toolBudget,
            toolName,
            agentId,
            requestId: hashHex,
          });
          toolCalls = runnerResult.tool_calls;
          if (toolCalls > toolBudget) {
            throw new Error("tool_budget_exceeded");
          }
          responseText = runnerResult.svg;
          actualAmount = computeActualAmount(agent, toolCalls);
        } else {
          res.status(409).json({ error: "agent_type_mismatch" });
          return;
        }
      } catch (error) {
        try {
          await chain.settleUsage({
            agentId,
            payer: normalizeAddress(payer_address),
            owner: normalizeAddress(agent.owner),
            maxAmount: Number(maxAmount),
            amount: 0,
            requestHash: hashU128,
          });
          insertUsageReceipt(db, {
            agent_id: agentId,
            payer_address: normalizeAddress(payer_address),
            amount: 0,
            max_amount: Number(maxAmount),
            tool_calls: 0,
            status: "refunded",
            request_hash: hashHex,
          });
        } catch (settleError) {
          res.status(500).json({ error: "settlement_failed" });
          return;
        }
        res.status(502).json({ error: "agent_failed", refunded: true });
        return;
      }

      const encrypted = encryptForClient(client_public_key, responseText);

      const maxAmountNumber = Number(maxAmount);
      const actualAmountNumber = Number(actualAmount);
      const refundAmount = maxAmountNumber - actualAmountNumber;
      const protocolFee = Math.floor((actualAmountNumber * PROTOCOL_FEE_BPS) / 10_000);
      const ownerAmount = actualAmountNumber - protocolFee;

      await chain.settleUsage({
        agentId,
        payer: normalizeAddress(payer_address),
        owner: normalizeAddress(agent.owner),
        maxAmount: maxAmountNumber,
        amount: actualAmountNumber,
        requestHash: hashU128,
      });

      const status =
        actualAmountNumber === 0 ? "refunded" : refundAmount > 0 ? "settled_refund" : "settled";
      insertUsageReceipt(db, {
        agent_id: agentId,
        payer_address: normalizeAddress(payer_address),
        amount: actualAmountNumber,
        max_amount: maxAmountNumber,
        tool_calls: toolCalls,
        status,
        request_hash: hashHex,
      });

      res.json({
        request_hash: hashHex,
        max_amount: maxAmountNumber,
        actual_amount: actualAmountNumber,
        refund_amount: refundAmount,
        tool_calls: toolCalls,
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
