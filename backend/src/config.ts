import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().optional(),
  DATABASE_PATH: z.string().optional(),
  MOVEMENT_RPC_URL: z.string().min(1),
  MOVE_PACKAGE_ADDRESS: z.string().min(1),
  MOVEMENT_FEE_MANAGER_PRIVATE_KEY: z.string().min(1),
  API_KEY_ENC_SECRET: z.string().min(1),
  X402_NETWORK: z.string().min(1),
  X402_FACILITATOR_URL: z.string().min(1),
  X402_PAY_TO_ADDRESS: z.string().optional(),
  X402_ENABLED: z.string().optional(),
  OPENAI_DEFAULT_MODEL: z.string().optional(),
  ANTHROPIC_DEFAULT_MODEL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional()
});

const isTest = process.env.NODE_ENV === \"test\";
const env = (isTest ? envSchema.partial() : envSchema).parse(process.env);

export const config = {
  port: Number(env.PORT || 4020),
  databasePath: env.DATABASE_PATH || "./royal_agents.db",
  movementRpcUrl: env.MOVEMENT_RPC_URL || "http://localhost:8080",
  movePackageAddress: env.MOVE_PACKAGE_ADDRESS || "0x0",
  feeManagerPrivateKey: env.MOVEMENT_FEE_MANAGER_PRIVATE_KEY || "0x0",
  apiKeyEncSecret: env.API_KEY_ENC_SECRET || "test-secret",
  x402: {
    enabled: env.X402_ENABLED !== "false",
    network: env.X402_NETWORK || "eip155:84532",
    facilitatorUrl: env.X402_FACILITATOR_URL || "http://localhost:4020",
    payToAddress: env.X402_PAY_TO_ADDRESS || ""
  },
  ai: {
    openaiModel: env.OPENAI_DEFAULT_MODEL || "gpt-4o-mini",
    anthropicModel: env.ANTHROPIC_DEFAULT_MODEL || "claude-3-haiku-20240307"
  },
  corsOrigins: env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map(v => v.trim()) : ["*"]
};

export type AppConfig = typeof config;
