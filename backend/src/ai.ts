export type Provider = "openai" | "anthropic" | "xai";

export type ProviderConfig = {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

async function callOpenAI(apiKey: string, prompt: string, config: ProviderConfig) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${error}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(apiKey: string, prompt: string, config: ProviderConfig) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      system: config.systemPrompt,
      max_tokens: config.maxTokens,
      messages: [{ role: "user", content: prompt }],
      temperature: config.temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic error: ${error}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

async function callXai(apiKey: string, prompt: string, config: ProviderConfig) {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI error: ${error}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function callProvider(
  provider: Provider,
  apiKey: string,
  prompt: string,
  config: ProviderConfig
) {
  if (provider === "openai") {
    return callOpenAI(apiKey, prompt, config);
  }
  if (provider === "anthropic") {
    return callAnthropic(apiKey, prompt, config);
  }
  if (provider === "xai") {
    return callXai(apiKey, prompt, config);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}
