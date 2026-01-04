# Demo Script (End-to-End)

## Prereqs
- Move package deployed and initialized (see docs/DEPLOYMENT.md)
- Backend running with `.env` configured
- EVM wallet for x402 payments (Base Sepolia)
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
    "api_key":"sk-...",
    "payout_address":"0xEVM_PAYOUT"
  }'
```
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
Use the x402 fetch client to pay and call the API:
```bash
# from a separate node project
npm install @x402/fetch @x402/evm viem dotenv

cat > x402-call.js <<'JS'
import { config } from 'dotenv';
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';
config();

const client = new x402Client();
registerExactEvmScheme(client, { signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY) });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const res = await fetchWithPayment('http://localhost:4020/agents/0/use', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Summarize the agent capabilities.',
    client_public_key: '<base64 X25519 public key>',
    payer_address: '0xUSER'
  })
});
console.log(await res.json());
JS

EVM_PRIVATE_KEY=0x... node x402-call.js
```

## 7) Verify owner revenue
- x402 payment is sent to the payout address
- Backend records usage on-chain via FeeManager
