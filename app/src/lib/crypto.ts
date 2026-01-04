import nacl from "tweetnacl";
import { decodeBase64, encodeBase64 } from "tweetnacl-util";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { gcm } from "@noble/ciphers/aes";

export function generateClientKeypair() {
  const keypair = nacl.box.keyPair();
  return {
    publicKey: keypair.publicKey,
    secretKey: keypair.secretKey,
    publicKeyBase64: encodeBase64(keypair.publicKey),
  };
}

function deriveSharedKey(secretKey: Uint8Array, serverPublicKey: Uint8Array) {
  const shared = nacl.scalarMult(secretKey, serverPublicKey);
  const salt = new TextEncoder().encode("royalagents-x25519");
  const info = new TextEncoder().encode("royalagents-response");
  return hkdf(sha256, shared, salt, info, 32);
}

export function decryptResponse(params: {
  serverPublicKey: string;
  nonce: string;
  ciphertext: string;
  tag: string;
  clientSecretKey: Uint8Array;
}) {
  const serverPubKey = decodeBase64(params.serverPublicKey);
  const nonce = decodeBase64(params.nonce);
  const ciphertext = decodeBase64(params.ciphertext);
  const tag = decodeBase64(params.tag);
  const key = deriveSharedKey(params.clientSecretKey, serverPubKey);
  const cipherWithTag = new Uint8Array(ciphertext.length + tag.length);
  cipherWithTag.set(ciphertext, 0);
  cipherWithTag.set(tag, ciphertext.length);
  const aes = gcm(key, nonce);
  const plaintext = aes.decrypt(cipherWithTag);
  return new TextDecoder().decode(plaintext);
}
