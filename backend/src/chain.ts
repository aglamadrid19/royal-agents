import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { config as appConfig } from "./config";

export type AgentOnChain = {
  agent_id: number;
  metadata_uri: string;
  usage_fee: number;
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
    return {
      agent_id: Number(agent.agent_id),
      metadata_uri: String(agent.metadata_uri),
      usage_fee: Number(agent.usage_fee),
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

  async recordUsage(params: {
    agentId: number;
    payer: string;
    amount: number;
    requestHash: bigint;
  }) {
    const transaction = await this.aptos.transaction.build.simple({
      sender: this.feeManagerAccount.accountAddress,
      data: {
        function: `${this.packageAddress}::fee_manager::record_usage`,
        functionArguments: [
          params.agentId,
          params.payer,
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
