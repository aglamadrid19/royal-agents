import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { toHex } from "viem";
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAddress,
  Ed25519PublicKey,
  Ed25519Signature,
  AccountAuthenticatorEd25519,
  generateSigningMessageForTransaction,
  SimpleTransaction,
  Hex,
  Deserializer,
} from "@aptos-labs/ts-sdk";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const MOVEMENT_TESTNET_FULLNODE =
  process.env.MOVEMENT_FULLNODE_URL || "https://testnet.movementnetwork.xyz/v1";
const FAUCET_URL =
  process.env.MOVEMENT_FAUCET_URL || "https://faucet.testnet.movementnetwork.xyz/mint";

const aptosConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: MOVEMENT_TESTNET_FULLNODE,
});
const aptos = new Aptos(aptosConfig);

app.post("/generate-hash", async (req, res) => {
  const { sender, function: func, typeArguments, functionArguments } = req.body;

  if (!sender || !func || !Array.isArray(functionArguments)) {
    return res.status(400).json({
      error: "Missing required fields: sender, function, or functionArguments",
    });
  }

  try {
    const senderAddress = AccountAddress.from(sender);
    const rawTxn = await aptos.transaction.build.simple({
      sender: senderAddress,
      data: {
        function: func,
        typeArguments: typeArguments || [],
        functionArguments,
      },
    });

    const message = generateSigningMessageForTransaction(rawTxn);
    const hash = toHex(message);
    const rawTxnHex = rawTxn.bcsToHex().toString();

    res.json({
      success: true,
      hash,
      rawTxnHex,
    });
  } catch (error) {
    console.error("Error generating signing hash:", error);
    res.status(500).json({ error: "Failed to generate signing hash" });
  }
});

app.post("/submit-transaction", async (req, res) => {
  const { rawTxnHex, publicKey, signature } = req.body;

  if (!rawTxnHex || !publicKey || !signature) {
    return res.status(400).json({ error: "Missing rawTxnHex, publicKey, or signature" });
  }

  let processedPublicKey = publicKey;
  if (processedPublicKey.toLowerCase().startsWith("0x")) {
    processedPublicKey = processedPublicKey.slice(2);
  }
  if (processedPublicKey.length === 66 && processedPublicKey.startsWith("00")) {
    processedPublicKey = processedPublicKey.substring(2);
  }
  if (processedPublicKey.length !== 64) {
    return res.status(400).json({
      error: `Invalid public key length: expected 64 characters, got ${processedPublicKey.length}`,
    });
  }

  try {
    const senderAuthenticator = new AccountAuthenticatorEd25519(
      new Ed25519PublicKey(processedPublicKey),
      new Ed25519Signature(signature)
    );

    const backendRawTxn = SimpleTransaction.deserialize(
      new Deserializer(Hex.fromHexInput(rawTxnHex).toUint8Array())
    );

    const pendingTxn = await aptos.transaction.submit.simple({
      transaction: backendRawTxn,
      senderAuthenticator,
    });

    const executedTxn = await aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });
    let events = executedTxn.events || [];
    if (!events.length) {
      const txn = await aptos.getTransactionByHash({ transactionHash: pendingTxn.hash });
      events = txn.events || [];
    }
    const mintedEvent = events.find(event =>
      String(event.type || "").endsWith("::agent_nft::AgentMinted")
    );
    const mintedAgentId = mintedEvent?.data?.agent_id;

    res.json({
      success: executedTxn.success,
      transactionHash: executedTxn.hash,
      vmStatus: executedTxn.vm_status,
      agentId: mintedAgentId ? Number(mintedAgentId) : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit signed transaction";
    console.error("Error submitting signed transaction:", error);
    res.status(500).json({ error: message });
  }
});

app.post("/x402/payment-header", async (req, res) => {
  const { accepts, publicKey, signature, rawTxnHex } = req.body;
  if (!accepts || !publicKey || !signature || !rawTxnHex) {
    return res.status(400).json({ error: "Missing accepts, publicKey, signature, or rawTxnHex" });
  }

  let processedPublicKey = publicKey;
  if (processedPublicKey.toLowerCase().startsWith("0x")) {
    processedPublicKey = processedPublicKey.slice(2);
  }
  if (processedPublicKey.length === 66 && processedPublicKey.startsWith("00")) {
    processedPublicKey = processedPublicKey.substring(2);
  }
  if (processedPublicKey.length !== 64) {
    return res.status(400).json({
      error: `Invalid public key length: expected 64 characters, got ${processedPublicKey.length}`,
    });
  }

  try {
    const authenticator = new AccountAuthenticatorEd25519(
      new Ed25519PublicKey(processedPublicKey),
      new Ed25519Signature(signature)
    );
    const signatureBcsBase64 = Buffer.from(authenticator.bcsToBytes()).toString("base64");

    const txnHex = rawTxnHex.startsWith("0x") ? rawTxnHex.slice(2) : rawTxnHex;
    const transactionBcsBase64 = Buffer.from(txnHex, "hex").toString("base64");

    const header = {
      x402Version: 1,
      scheme: accepts.scheme,
      network: accepts.network,
      payload: {
        signature: signatureBcsBase64,
        transaction: transactionBcsBase64,
      },
    };
    const xPayment = Buffer.from(JSON.stringify(header)).toString("base64");
    return res.json({ x_payment: xPayment });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build x402 payment header";
    console.error("Error building x402 payment header:", error);
    return res.status(500).json({ error: message });
  }
});

app.post("/faucet", async (req, res) => {
  const { address, amount } = req.body;
  if (!address || !amount) {
    return res.status(400).json({ error: "Missing address or amount" });
  }

  try {
    const response = await fetch(`${FAUCET_URL}?amount=${amount}&address=${address}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Faucet request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error requesting faucet tokens:", error);
    res.status(500).json({ error: "Failed to request faucet tokens" });
  }
});

app.get("/balance/:address", async (req, res) => {
  const { address } = req.params;
  try {
    const accountAddress = AccountAddress.from(address);
    const balance = await aptos.getAccountAPTAmount({ accountAddress });
    res.json({ balance });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

app.get("/account-info/:address", async (req, res) => {
  const { address } = req.params;
  try {
    const accountAddress = AccountAddress.from(address);
    const info = await aptos.getAccountInfo({ accountAddress });
    res.json(info);
  } catch (error) {
    console.error("Error fetching account info:", error);
    res.status(500).json({ error: "Failed to fetch account info" });
  }
});

app.post("/view", async (req, res) => {
  const { function: func, typeArguments, functionArguments } = req.body;

  if (!func) {
    return res.status(400).json({ error: "Missing required field: function" });
  }

  try {
    const result = await aptos.view({
      payload: {
        function: func,
        typeArguments: typeArguments || [],
        functionArguments: functionArguments || [],
      },
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error("Error calling view function:", error);
    res.status(500).json({ error: "Failed to call view function" });
  }
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Movement Expo backend running at http://localhost:${port}`);
});
