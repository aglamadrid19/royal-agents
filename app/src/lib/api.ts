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
  provider: "openai" | "anthropic";
  apiKey: string;
  payoutAddress: string;
  signatureFormat?: "message" | "hash";
}) {
  const res = await fetch(`${baseUrl}/agents/${params.agentId}/key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: params.address,
      public_key: params.publicKey,
      signature: params.signature,
      nonce: params.nonce,
      provider: params.provider,
      api_key: params.apiKey,
      payout_address: params.payoutAddress,
      signature_format: params.signatureFormat,
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
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
  return res.json();
}
