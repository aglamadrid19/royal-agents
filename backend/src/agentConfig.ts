import crypto from "crypto";

export const CONFIG_VERSION = 1;

export type AgentConfigInput = {
  system_prompt: string;
  temperature: number;
  max_tokens: number;
};

type ConfigHashInput = AgentConfigInput & {
  provider: string;
  model: string;
};

const normalizeNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid numeric value");
  }
  return String(value);
};

export function canonicalConfigString(input: ConfigHashInput): string {
  return [
    `version=${CONFIG_VERSION}`,
    `provider=${input.provider}`,
    `model=${input.model}`,
    `system_prompt=${input.system_prompt}`,
    `temperature=${normalizeNumber(input.temperature)}`,
    `max_tokens=${Math.trunc(input.max_tokens)}`,
  ].join("\n");
}

export function hashConfig(input: ConfigHashInput): { hashHex: string; hashBytes: Buffer } {
  const canonical = canonicalConfigString(input);
  const digest = crypto.createHash("sha256").update(canonical, "utf8").digest();
  return { hashHex: digest.toString("hex"), hashBytes: digest };
}
