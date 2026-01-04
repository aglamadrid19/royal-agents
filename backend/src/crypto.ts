import crypto from "crypto";
import nacl from "tweetnacl";

const OWNER_INFO = Buffer.from("royalagents-owner-key", "utf8");
const RESPONSE_INFO = Buffer.from("royalagents-response", "utf8");

function parseSecret(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  try {
    return Buffer.from(raw, "base64");
  } catch {
    return Buffer.from(raw, "utf8");
  }
}

export function deriveOwnerKey(secret: string, ownerAddress: string, agentId: number): Buffer {
  const salt = Buffer.from(`${ownerAddress}:${agentId}`, "utf8");
  const key = crypto.hkdfSync("sha256", parseSecret(secret), salt, OWNER_INFO, 32);
  return Buffer.from(key);
}

export function encryptOwnerKey(plaintext: string, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptOwnerKey(ciphertext: string, iv: string, tag: string, key: Buffer) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function encryptForClient(clientPublicKeyBase64: string, plaintext: string) {
  const clientPublicKey = Buffer.from(clientPublicKeyBase64, "base64");
  if (clientPublicKey.length !== nacl.box.publicKeyLength) {
    throw new Error("Invalid client public key length");
  }

  const serverKeyPair = nacl.box.keyPair();
  const shared = nacl.scalarMult(serverKeyPair.secretKey, clientPublicKey);
  const derived = crypto.hkdfSync(
    "sha256",
    Buffer.from(shared),
    Buffer.from("royalagents-x25519", "utf8"),
    RESPONSE_INFO,
    32
  );

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(derived), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    server_public_key: Buffer.from(serverKeyPair.publicKey).toString("base64"),
    nonce: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function hashRequest(input: string): { hashHex: string; hashU128: bigint } {
  const digest = crypto.createHash("sha256").update(input).digest();
  const hashHex = digest.toString("hex");
  const prefix = hashHex.slice(0, 32); // 128-bit
  const hashU128 = BigInt(`0x${prefix}`);
  return { hashHex, hashU128 };
}
