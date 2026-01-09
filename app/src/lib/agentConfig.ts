import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

export const CONFIG_VERSION = 1;

export type AgentConfigInput = {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
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

export function canonicalConfigString(input: ConfigHashInput) {
  return [
    `version=${CONFIG_VERSION}`,
    `provider=${input.provider}`,
    `model=${input.model}`,
    `system_prompt=${input.systemPrompt}`,
    `temperature=${normalizeNumber(input.temperature)}`,
    `max_tokens=${Math.trunc(input.maxTokens)}`,
  ].join("\n");
}

export function hashConfig(input: ConfigHashInput) {
  const canonical = canonicalConfigString(input);
  const hash = sha256(new TextEncoder().encode(canonical));
  return {
    hashHex: bytesToHex(hash),
    hashBytes: Array.from(hash),
  };
}
