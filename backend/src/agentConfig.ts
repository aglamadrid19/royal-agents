import crypto from "crypto";

export const HOSTED_CONFIG_VERSION = 1;
export const RUNNER_CONFIG_VERSION = 2;

export type HostedAgentConfigInput = {
  system_prompt: string;
  temperature: number;
  max_tokens: number;
};

export type RunnerAgentConfigInput = {
  system_prompt: string;
  tool_name: string;
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

export function canonicalHostedConfigString(input: HostedHashInput): string {
  return [
    `version=${HOSTED_CONFIG_VERSION}`,
    `provider=${input.provider}`,
    `model=${input.model}`,
    `system_prompt=${input.system_prompt}`,
    `temperature=${normalizeNumber(input.temperature)}`,
    `max_tokens=${Math.trunc(input.max_tokens)}`,
  ].join("\n");
}

export function canonicalRunnerConfigString(input: RunnerAgentConfigInput): string {
  return [
    `version=${RUNNER_CONFIG_VERSION}`,
    "agent_type=runner",
    `tool_name=${input.tool_name}`,
    `system_prompt=${input.system_prompt}`,
  ].join("\n");
}

export function hashHostedConfig(input: HostedHashInput): { hashHex: string; hashBytes: Buffer } {
  const canonical = canonicalHostedConfigString(input);
  const digest = crypto.createHash("sha256").update(canonical, "utf8").digest();
  return { hashHex: digest.toString("hex"), hashBytes: digest };
}

export function hashRunnerConfig(
  input: RunnerAgentConfigInput
): { hashHex: string; hashBytes: Buffer } {
  const canonical = canonicalRunnerConfigString(input);
  const digest = crypto.createHash("sha256").update(canonical, "utf8").digest();
  return { hashHex: digest.toString("hex"), hashBytes: digest };
}
