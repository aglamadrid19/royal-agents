import crypto from "crypto";
import nacl from "tweetnacl";
import { Db, consumeNonce, insertNonce } from "./db";

const NONCE_TTL_MS = 5 * 60 * 1000;

export function issueNonce(db: Db, address: string) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + NONCE_TTL_MS;
  insertNonce(db, address, nonce, expiresAt);
  return { nonce, expiresAt };
}

export function deriveAddressFromPublicKey(publicKeyHex: string): string {
  let keyHex = publicKeyHex.startsWith("0x") ? publicKeyHex.slice(2) : publicKeyHex;
  if (keyHex.length === 66 && keyHex.startsWith("00")) {
    keyHex = keyHex.slice(2);
  }
  const pubkey = Buffer.from(keyHex, "hex");
  const authKey = crypto
    .createHash("sha3-256")
    .update(Buffer.concat([pubkey, Buffer.from([0x00])]))
    .digest("hex");
  return `0x${authKey}`;
}

export function verifySignedNonce(
  db: Db,
  params: {
    address: string;
    publicKey: string;
    signature: string;
    nonce: string;
    signatureFormat?: "message" | "hash";
  }
): boolean {
  const { address, publicKey, signature, nonce, signatureFormat } = params;
  const derivedAddress = deriveAddressFromPublicKey(publicKey).toLowerCase();
  if (derivedAddress !== address.toLowerCase()) {
    return false;
  }

  const message = Buffer.from(`RoyalAgents nonce: ${nonce}`, "utf8");
  const payload =
    signatureFormat === "hash"
      ? crypto.createHash("sha256").update(message).digest()
      : message;
  const signatureBytes = Buffer.from(signature.startsWith("0x") ? signature.slice(2) : signature, "hex");
  let publicKeyHex = publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey;
  if (publicKeyHex.length === 66 && publicKeyHex.startsWith("00")) {
    publicKeyHex = publicKeyHex.slice(2);
  }
  const publicKeyBytes = Buffer.from(publicKeyHex, "hex");
  const valid = nacl.sign.detached.verify(payload, signatureBytes, publicKeyBytes);
  if (!valid) {
    return false;
  }

  const consumed = consumeNonce(db, address, nonce, Date.now());
  return consumed;
}
