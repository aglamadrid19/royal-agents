# RoyalAgents Architecture

- See docs folder for setup / deployment details

## Goals
- MVP that is secure-by-default and production-quality
- NFT ownership controls usage revenue
- No platform-held API keys and no admin controls
- Pay-per-request via x402 (Movement/x402plus) with on-chain usage records

## High-level components
1) Move contracts (Movement testnet)
   - AgentNFT: NFT + agent metadata and owner controls
   - Marketplace: listing and purchase of Agent NFTs
   - FeeManager: protocol fee and usage recording
2) Backend service (Node.js + Express)
   - Verifies x402 payments (Movement facilitator via x402plus)
   - Reads agent state + owner from chain
   - Stores encrypted owner API keys in SQLite
   - Calls AI provider using owner key
   - Encrypts result for user (X25519 + AES-256-GCM)
   - Records usage on-chain
3) Movement wallet helper (expo-backend)
   - Builds Movement transactions for Privy signing
   - Submits signed transactions and exposes read-only helpers
4) Universal app (Expo, Web + iOS + Android)
   - Privy Expo wallet auth + signing (Movement/Aptos)
   - Browsing agents, listing/buying
   - Use agent (pay + encrypt request, decrypt response)

## Data model summary
- Agent NFT fields (on-chain):
  - agent_id (u64)
  - metadata_uri (string, optional pointer for images/branding)
  - name (string)
  - description (string)
  - model (string)
  - provider (u8 enum: 1=xai, 2=openai, 3=anthropic)
  - config_hash (vector<u8>, 32-byte SHA-256)
  - usage_fee (u64, USD cents for x402 pricing; converted to MOVE via `X402_USD_PER_MOVE`)
  - owner (address)
  - paused (bool)
  - key_status (KEY_SET | KEY_MISSING)
- Marketplace listing:
  - agent_id, seller, price, active
- FeeManager usage record:
  - agent_id, payer, amount, request_hash

## Key flows

### Mint + configure agent
1) Owner defines the agent config (system prompt, temperature, max tokens)
2) Client computes `config_hash` and mints Agent NFT with on-chain metadata + `config_hash`
3) Owner stores config via `/agents/:id/config` (encrypted at rest)
4) Owner sets API key via backend
5) Backend encrypts key using AES-256-GCM with derived key
6) Owner sets key_status on-chain to KEY_SET

### List and buy agent
1) Owner lists agent via Marketplace
2) Marketplace checks key_status == KEY_SET
3) Buyer purchases listing; ownership transfers
4) New owner must set a new API key; key_status is set to KEY_MISSING after sale

### Use agent (pay-per-request)
1) User creates x402 payment for the agent fee (MOVE amount derived from USD cents)
2) User creates X25519 ephemeral keypair and sends public key
3) Backend verifies x402 payment
4) Backend reads agent state and owner from chain
5) Backend checks: not paused and key_status == KEY_SET
6) Backend verifies `config_hash` matches stored config
7) Backend decrypts owner API key and calls AI provider
8) Backend encrypts response to user's public key
9) Backend records usage on-chain via FeeManager
10) Backend returns encrypted response payload

## Cryptography
- Owner API key storage:
  - AES-256-GCM
  - Key derived from server secret + owner address + agent_id (HKDF-SHA256)
  - Stored in SQLite (ciphertext + iv + auth tag)
- Agent config storage:
  - AES-256-GCM
  - Key derived from server secret + agent_id (HKDF-SHA256)
  - Stored in SQLite (ciphertext + iv + auth tag)
- User responses:
  - X25519 ECDH between server ephemeral key and user public key
  - Derived shared secret -> HKDF-SHA256 -> AES-256-GCM
  - Backend never decrypts user results

## Security guardrails
- Owner-only controls enforced on-chain
- Backend verifies owner address for key updates via signed nonce
- Backend re-validates agent paused/key_status before usage
- x402 payment gating before AI request
- Never log secrets; sensitive data redaction in logs

## Repos and directories
- move/        On-chain Move modules and tests
- backend/     Express service, SQLite storage, x402 verification, encryption
- expo-backend/ Movement helper service for Privy wallet signing
- app/         Expo universal app (web + native)
- docs/        Architecture, threat model, setup, demo script

## References
- aptos-token-objects: movementlabsxyz/movement-aptos-core
- movementlabsxyz/movement-aptos-core/move-examples
- movementlabsxyz/nft-launchpad
- aptos-labs/move-by-examples/nft-launchpad
- Move security guidelines: https://aptos.dev/build/smart-contracts/move-security-guidelines
- x402: https://github.com/coinbase/x402
- movement-x402: https://github.com/Rahat-ch/movement-x402
- privy + rn / expo: https://github.com/dumbdevss/Movement-react-native-privy-template
