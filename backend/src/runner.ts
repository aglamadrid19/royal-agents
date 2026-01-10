export type RunnerResult = {
  svg: string;
  tool_calls: number;
};

export async function callRunner(params: {
  runnerUrl: string;
  runnerSecret: string;
  prompt: string;
  systemPrompt: string;
  toolBudget: number;
  toolName: string;
  agentId: number;
  requestId: string;
}): Promise<RunnerResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${params.runnerUrl.replace(/\/$/, "")}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-runner-secret": params.runnerSecret,
      },
      body: JSON.stringify({
        agent_id: params.agentId,
        request_id: params.requestId,
        prompt: params.prompt,
        system_prompt: params.systemPrompt,
        tool_budget: params.toolBudget,
        tool_name: params.toolName,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "runner_error");
    }
    const data = (await response.json()) as Partial<RunnerResult>;
    if (typeof data.svg !== "string" || data.svg.length === 0) {
      throw new Error("runner_invalid_svg");
    }
    const toolCalls = Number(data.tool_calls);
    if (!Number.isFinite(toolCalls) || toolCalls < 0) {
      throw new Error("runner_invalid_tool_calls");
    }
    return { svg: data.svg, tool_calls: Math.trunc(toolCalls) };
  } finally {
    clearTimeout(timeout);
  }
}
