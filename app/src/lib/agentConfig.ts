import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

export const HOSTED_CONFIG_VERSION = 1;
export const RUNNER_CONFIG_VERSION = 2;

export type HostedAgentConfigInput = {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

export type RunnerAgentConfigInput = {
  systemPrompt: string;
  toolName: string;
};

type HostedHashInput = HostedAgentConfigInput & {
  provider: string;
  model: string;
};

const normalizeNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid numeric value");
  }
  return String(value);
};

export function canonicalHostedConfigString(input: HostedHashInput) {
  return [
    `version=${HOSTED_CONFIG_VERSION}`,
    `provider=${input.provider}`,
    `model=${input.model}`,
    `system_prompt=${input.systemPrompt}`,
    `temperature=${normalizeNumber(input.temperature)}`,
    `max_tokens=${Math.trunc(input.maxTokens)}`,
  ].join("\n");
}

export function canonicalRunnerConfigString(input: RunnerAgentConfigInput) {
  return [
    `version=${RUNNER_CONFIG_VERSION}`,
    "agent_type=runner",
    `tool_name=${input.toolName}`,
    `system_prompt=${input.systemPrompt}`,
  ].join("\n");
}

export function hashHostedConfig(input: HostedHashInput) {
  const canonical = canonicalHostedConfigString(input);
  const hash = sha256(new TextEncoder().encode(canonical));
  return {
    hashHex: bytesToHex(hash),
    hashBytes: Array.from(hash),
  };
}

export function hashRunnerConfig(input: RunnerAgentConfigInput) {
  const canonical = canonicalRunnerConfigString(input);
  const hash = sha256(new TextEncoder().encode(canonical));
  return {
    hashHex: bytesToHex(hash),
    hashBytes: Array.from(hash),
  };
}
