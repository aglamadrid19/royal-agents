import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { config as appConfig } from "./config";

export type AgentOnChain = {
  agent_id: number;
  metadata_uri: string;
  name: string;
  description: string;
  model: string;
  provider: number;
  agent_type: number;
  config_hash: string;
  usage_fee: number;
  tool_fee: number;
  tool_cap: number;
  owner: string;
  paused: boolean;
  key_status: number;
  token_address: string;
};

export class ChainClient {
  private readonly aptos: Aptos;
  private readonly packageAddress: string;
  private readonly feeManagerAccount: Account;

  constructor() {
    const aptosConfig = new AptosConfig({
      network: Network.CUSTOM,
      fullnode: appConfig.movementRpcUrl,
    });
    this.aptos = new Aptos(aptosConfig);
    this.packageAddress = appConfig.movePackageAddress;
    const privateKey = new Ed25519PrivateKey(appConfig.feeManagerPrivateKey);
    this.feeManagerAccount = Account.fromPrivateKey({ privateKey });
  }

  async getAgent(agentId: number): Promise<AgentOnChain> {
    const result = await this.aptos.view<[any]>({
      payload: {
        function: `${this.packageAddress}::agent_nft::get_agent`,
        functionArguments: [agentId],
        typeArguments: [],
      },
    });
    const agent = result[0] as any;
    const configHash = normalizeConfigHash(agent.config_hash);
    return {
      agent_id: Number(agent.agent_id),
      metadata_uri: String(agent.metadata_uri),
      name: String(agent.name),
      description: String(agent.description),
      model: String(agent.model),
      provider: Number(agent.provider),
      agent_type: Number(agent.agent_type),
      config_hash: configHash,
      usage_fee: Number(agent.usage_fee),
      tool_fee: Number(agent.tool_fee),
      tool_cap: Number(agent.tool_cap),
      owner: String(agent.owner),
      paused: Boolean(agent.paused),
      key_status: Number(agent.key_status),
      token_address: String(agent.token_address),
    };
  }

  async getAgentCount(): Promise<number> {
    const result = await this.aptos.view<[string | number]>({
      payload: {
        function: `${this.packageAddress}::agent_nft::agent_count`,
        functionArguments: [],
        typeArguments: [],
      },
    });
    return Number(result[0]);
  }

  async settleUsage(params: {
    agentId: number;
    payer: string;
    owner: string;
    maxAmount: number;
    amount: number;
    requestHash: bigint;
  }) {
    const transaction = await this.aptos.transaction.build.simple({
      sender: this.feeManagerAccount.accountAddress,
      data: {
        function: `${this.packageAddress}::fee_manager::settle_usage`,
        functionArguments: [
          params.agentId,
          params.payer,
          params.owner,
          params.maxAmount,
          params.amount,
          params.requestHash,
        ],
      },
    });
    const pending = await this.aptos.signAndSubmitTransaction({
      signer: this.feeManagerAccount,
      transaction,
    });
    await this.aptos.waitForTransaction({ transactionHash: pending.hash });
  }
}

function normalizeConfigHash(raw: unknown): string {
  if (Array.isArray(raw)) {
    return Buffer.from(raw).toString("hex");
  }
  if (typeof raw === "string") {
    return raw.startsWith("0x") ? raw.slice(2).toLowerCase() : raw.toLowerCase();
  }
  if (raw && typeof raw === "object") {
    const value = raw as { vec?: number[]; bytes?: string };
    if (Array.isArray(value.vec)) {
      return Buffer.from(value.vec).toString("hex");
    }
    if (typeof value.bytes === "string") {
      return value.bytes.startsWith("0x")
        ? value.bytes.slice(2).toLowerCase()
        : value.bytes.toLowerCase();
    }
  }
  return "";
}
