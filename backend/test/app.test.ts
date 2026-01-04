import request from "supertest";
import nacl from "tweetnacl";

import { createApp } from "../src/app";
import { initDb } from "../src/db";
import { deriveAddressFromPublicKey } from "../src/auth";

const stubChain = {
  async getAgent(agentId: number) {
    return {
      agent_id: agentId,
      metadata_uri: "ipfs://agent",
      usage_fee: 100,
      owner: "0x" + "a".repeat(64),
      paused: false,
      key_status: 1,
      token_address: "0x" + "b".repeat(64),
    };
  },
  async getAgentCount() {
    return 1;
  },
  async recordUsage() {
    return;
  },
};

const paymentMiddleware = (req: any, res: any, next: any) => {
  if (req.method === "POST" && req.path.endsWith("/use")) {
    if (!req.header("x-payment")) {
      res.status(402).json({ error: "payment_required" });
      return;
    }
  }
  next();
};

describe("RoyalAgents backend", () => {
  test("rejects unpaid use requests", async () => {
    const db = initDb(":memory:");
    const app = createApp({ db, chain: stubChain as any, paymentMiddleware });

    const res = await request(app)
      .post("/agents/1/use")
      .send({
        prompt: "Hello",
        client_public_key: Buffer.from(nacl.box.keyPair().publicKey).toString("base64"),
        payer_address: "0x" + "c".repeat(64),
      });

    expect(res.status).toBe(402);
  });

  test("rejects key update with invalid signature", async () => {
    const db = initDb(":memory:");
    const app = createApp({ db, chain: stubChain as any, paymentMiddleware });

    const keyPair = nacl.sign.keyPair();
    const publicKeyHex = Buffer.from(keyPair.publicKey).toString("hex");
    const address = deriveAddressFromPublicKey(publicKeyHex);

    const nonceRes = await request(app)
      .post("/auth/nonce")
      .send({ address });
    const nonce = nonceRes.body.nonce;

    const res = await request(app)
      .post("/agents/1/key")
      .send({
        address,
        public_key: publicKeyHex,
        signature: "00".repeat(64),
        nonce,
        provider: "openai",
        api_key: "sk-test",
        payout_address: "0x" + "1".repeat(40),
      });

    expect(res.status).toBe(401);
  });
});
