import Constants from "expo-constants";

const baseUrl =
  (Constants.expoConfig?.extra?.backendUrl as string) ||
  "http://localhost:4020";

export async function fetchAgents() {
  const res = await fetch(`${baseUrl}/agents`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function fetchAgent(id: number) {
  const res = await fetch(`${baseUrl}/agents/${id}`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function requestNonce(address: string) {
  const res = await fetch(`${baseUrl}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function setAgentKey(params: {
  agentId: number;
  address: string;
  publicKey: string;
  signature: string;
  nonce: string;
  provider: "openai" | "anthropic" | "xai";
  apiKey: string;
  payoutAddress?: string;
  signatureFormat?: "message" | "hash";
}) {
  const body: Record<string, unknown> = {
    address: params.address,
    public_key: params.publicKey,
    signature: params.signature,
    nonce: params.nonce,
    provider: params.provider,
    api_key: params.apiKey,
    signature_format: params.signatureFormat,
  };
  if (params.payoutAddress) {
    body.payout_address = params.payoutAddress;
  }
  const res = await fetch(`${baseUrl}/agents/${params.agentId}/key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function setAgentRunner(params: {
  agentId: number;
  address: string;
  publicKey: string;
  signature: string;
  nonce: string;
  runnerUrl: string;
  runnerSecret: string;
  signatureFormat?: "message" | "hash";
}) {
  const res = await fetch(`${baseUrl}/agents/${params.agentId}/runner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: params.address,
      public_key: params.publicKey,
      signature: params.signature,
      nonce: params.nonce,
      signature_format: params.signatureFormat,
      runner_url: params.runnerUrl,
      runner_secret: params.runnerSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function setAgentConfig(params: {
  agentId: number;
  address: string;
  publicKey: string;
  signature: string;
  nonce: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  toolName?: string;
  signatureFormat?: "message" | "hash";
}) {
  const res = await fetch(`${baseUrl}/agents/${params.agentId}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: params.address,
      public_key: params.publicKey,
      signature: params.signature,
      nonce: params.nonce,
      signature_format: params.signatureFormat,
      system_prompt: params.systemPrompt,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      tool_name: params.toolName,
    }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function useAgent(params: {
  agentId: number;
  prompt: string;
  clientPublicKey: string;
  payerAddress: string;
  paymentHeader?: string;
  toolBudget?: number;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (params.paymentHeader) {
    headers["x-payment"] = params.paymentHeader;
  }
  const res = await fetch(`${baseUrl}/agents/${params.agentId}/use`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: params.prompt,
      client_public_key: params.clientPublicKey,
      payer_address: params.payerAddress,
      tool_budget: params.toolBudget,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
  return res.json();
}
