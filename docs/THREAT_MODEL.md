# RoyalAgents Threat Model (MVP)

## Assets
- Owner API keys (encrypted at rest)
- User prompts and results
- Usage revenue and protocol fees
- NFT ownership and agent configuration

## Actors
- Agent owners (honest and malicious)
- Users (honest and malicious)
- External attackers (network, storage, or client compromise)
- AI providers (trusted for inference only)

## Trust boundaries
- User device <-> Backend (HTTP)
- User device <-> Movement expo-backend (HTTP)
- Backend <-> Movement chain (RPC)
- Backend <-> AI providers
- App <-> Wallet (signing, key storage)

## Threats and mitigations

### T1: Stolen owner API keys from server storage
- AES-256-GCM encryption at rest
- Derived key uses server secret + owner + agent_id
- No plaintext logging of keys
- DB access requires server compromise

### T2: User data exposure by backend
- Backend encrypts results to user's ephemeral X25519 public key
- Backend never decrypts user results
- Only encrypted responses are stored/transmitted

### T3: Unauthorized key updates
- Wallet-based auth using signed nonce
- Address must match on-chain owner
- Rate limit key update endpoint

### T4: Usage without payment
- x402 verification before inference
- On-chain agent availability enforced (paused/key_status)
- Usage recorded on-chain with request hash to detect duplicates

### T5: Config mismatch or tampering
- `config_hash` stored on-chain and immutable after mint
- Backend recomputes hash from stored config before every use
- Config is encrypted at rest in SQLite

### T6: Listing or buying without key set
- Marketplace checks key_status == KEY_SET on-chain
- Backend re-checks key_status before use

### T7: Replay or double-spend of usage
- Record usage with request_hash
- Backend stores usage_receipts with unique request_hash
- FeeManager rejects duplicates by request_hash

### T8: Malicious prompts or injection
- Strict prompt templating and separation of system/user
- Provider key never included in prompt

### T9: Compromised client device
- User is responsible for device security
- No recovery of decrypted results if device is compromised

### T10: Movement expo-backend misbehavior
- Treat expo-backend as untrusted; responses are validated by the chain
- Signatures are produced by the wallet; backend cannot forge user signatures

## Residual risks (MVP)
- Users must trust backend to call provider and return valid response
- Chain RPC availability and correctness
- Expo-backend availability for transaction building
- Client-side wallet integrations are still evolving (Privy + Expo)
