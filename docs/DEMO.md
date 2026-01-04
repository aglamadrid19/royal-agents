# Demo Script (End-to-End)

## Prereqs
- Move package deployed and initialized (see docs/DEPLOYMENT.md)
- Backend running with `.env` configured
- Movement wallet for x402 payments
- Movement CLI installed (commands use `movement`; replace with `aptos` if needed)

## 1) Mint agent NFT (owner)
```bash
movement move run \
  --function-id 0xDEPLOYER::agent_nft::mint_agent \
  --args string:ipfs://agent-metadata u64:100
```
Output: `agent_id` from events.

## 2) Owner sets key (off-chain) + key status (on-chain)
Request nonce:
```bash
curl -s -X POST http://localhost:4020/auth/nonce \
  -H 'Content-Type: application/json' \
  -d '{"address":"0xOWNER"}'
```
Sign the message `RoyalAgents nonce: <nonce>` with the owner wallet.

Submit key:
```bash
curl -s -X POST http://localhost:4020/agents/0/key \
  -H 'Content-Type: application/json' \
  -d '{
    "address":"0xOWNER",
    "public_key":"<hex>",
    "signature":"<hex>",
    "nonce":"<nonce>",
    "provider":"openai",
    "api_key":"sk-..."
  }'
```
`payout_address` is optional for Movement x402; if omitted, payments go to the agent owner address.
Set key status on-chain:
```bash
movement move run \
  --function-id 0xDEPLOYER::agent_nft::set_key_status \
  --args u64:0 u8:1
```

## 3) List agent
```bash
movement move run \
  --function-id 0xDEPLOYER::marketplace::list \
  --args u64:0 u64:100000000
```

## 4) Buy agent (buyer)
```bash
movement move run \
  --function-id 0xDEPLOYER::marketplace::buy \
  --args u64:0
```
After purchase, key_status is KEY_MISSING.

## 5) New owner sets key
Repeat step 2 with the new owner address, then call `set_key_status`.

## 6) User pays per request (x402) and uses agent
Use the x402plus Movement signer to pay and call the API:
```bash
# from a separate node project
npm install x402plus @aptos-labs/ts-sdk dotenv

cat > x402-call.js <<'JS'
import { config } from 'dotenv';
import { wrapFetchWithPayment, aptosLikeSigner } from 'x402plus';
import { Aptos, AptosConfig, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';
config();

const rpc = process.env.MOVEMENT_RPC_URL || 'https://testnet.movementnetwork.xyz/v1';
const aptos = new Aptos(new AptosConfig({ fullnode: rpc }));
const account = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(process.env.MOVEMENT_PRIVATE_KEY)
});

const signer = aptosLikeSigner(async (accepts) => {
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: '0x1::aptos_account::transfer',
      functionArguments: [accepts.payTo, accepts.maxAmountRequired]
    }
  });
  const authenticator = aptos.transaction.sign({ signer: account, transaction: tx });
  return {
    signatureBcsBase64: Buffer.from(authenticator.bcsToBytes()).toString('base64'),
    transactionBcsBase64: Buffer.from(tx.bcsToBytes()).toString('base64')
  };
});

const fetchWithPayment = wrapFetchWithPayment(fetch, { signer, prefer: 'exact' });
const res = await fetchWithPayment('http://localhost:4020/agents/0/use', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Summarize the agent capabilities.',
    client_public_key: '<base64 X25519 public key>',
    payer_address: account.accountAddress.toString()
  })
});
console.log(await res.json());
JS

MOVEMENT_PRIVATE_KEY=ed25519-priv-... node x402-call.js
```

## 7) Verify owner revenue
- x402 payment is sent to the Movement payout address
- Backend records usage on-chain via FeeManager
