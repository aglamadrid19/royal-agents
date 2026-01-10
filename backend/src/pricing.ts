import type { AgentOnChain } from "./chain";

export const AGENT_TYPE_HOSTED = 1;
export const AGENT_TYPE_RUNNER = 2;

export function resolveToolBudget(agent: AgentOnChain, rawBudget: unknown): number {
  if (agent.agent_type !== AGENT_TYPE_RUNNER) {
    return 0;
  }
  if (rawBudget === undefined || rawBudget === null || rawBudget === "") {
    return agent.tool_cap;
  }
  const parsed = Number(rawBudget);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("invalid_tool_budget");
  }
  const budget = Math.trunc(parsed);
  if (budget > agent.tool_cap) {
    throw new Error("tool_budget_exceeds_cap");
  }
  return budget;
}

export function computeMaxAmount(agent: AgentOnChain, toolBudget: number): bigint {
  return BigInt(agent.usage_fee) + BigInt(agent.tool_fee) * BigInt(toolBudget);
}

export function computeActualAmount(agent: AgentOnChain, toolCalls: number): bigint {
  return BigInt(agent.usage_fee) + BigInt(agent.tool_fee) * BigInt(toolCalls);
}
