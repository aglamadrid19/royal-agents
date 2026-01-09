# Local + Testnet Setup

## Prerequisites
- Movement CLI (recommended) or Aptos CLI (Movement compatible)
- Node.js 18+
- SQLite (optional, backend uses embedded SQLite)
- Expo CLI for the app

All Move commands below use `movement`. If you use Aptos CLI, replace `movement` with `aptos`.

## 0) Clean up steps (in case you need to reploy / rebuild project)

Clean the build output
```bash
movement move clean
```

Clean account + new package address (save private key in case you need to go back to a previous deployment)
```bash
rm -rf move/build move/.aptos
```

Remove local DB to start fresh (backup previous DB just in case)
```bash
rm -rf backend/royal_agents.db*
```

## 1) Move package

Create a new deployer with Movement CLI (Testnet)
```bash
cd move
movement init --network testnet \
  --rest-url https://testnet.movementnetwork.xyz/v1 \
  --faucet-url https://faucet.testnet.movementnetwork.xyz
```

Verify your default signer is now the new address
```bash
cd move
movement config show-profiles
```

Compiles the package and runs the Move unit tests
```bash
cd move
movement move test
```

To build/package for Movement testnet:
```bash
movement move compile --save-metadata --named-addresses royal_agents=0xDEPLOYER
```

To deploy package for Movement testnet:
```bash
movement move publish --named-addresses royal_agents=0xDEPLOYER
```

Initialize on-chain state, these entry functions once, using the deployer signer:
```bash
movement move run \
  --function-id 0xDEPLOYER::agent_nft::init
movement move run \
  --function-id 0xDEPLOYER::marketplace::init
movement move run \
  --function-id 0xDEPLOYER::fee_manager::init
```

## 2) Backend
```bash
cd backend
cp ../.env.example .env
# edit .env with real values
npm install
npm run dev
```

Notes:
- `API_KEY_ENC_SECRET` is used to encrypt both owner API keys and agent configs at rest.
- Type 1 agents require a config hash; the app computes this automatically. For CLI usage, see `docs/DEMO.md`.

x402 (Movement) settings to fill in `.env`:
- `X402_NETWORK=movement-testnet` (use `movement` for mainnet)
- `X402_FACILITATOR_URL=https://facilitator.stableyard.fi`
- `X402_ASSET=0x1::aptos_coin::AptosCoin`
- `X402_PAY_TO_ADDRESS=0x<movement address>` (fallback only for non-Movement networks)
- `X402_USD_PER_MOVE=1` (conversion rate used to map USD cents to MOVE amount)
- `X402_MOVE_DECIMALS=8` (decimals for the asset; Aptos/MOVE defaults to 8)
- `X402_MAX_TIMEOUT_SECONDS=600` (max time the facilitator will accept the payment)

## 3) Movement Expo backend
```bash
cd expo-backend
cp .env.example .env
# edit MOVEMENT_FULLNODE_URL/MOVEMENT_FAUCET_URL if needed
npm install
npm run start
```
The network (testnet vs mainnet) is controlled by `MOVEMENT_FULLNODE_URL` in `expo-backend/.env`.

## 4) App (Expo)
```bash
cd app
npm install
# set privyAppId, privyClientId, backendUrl, movementBackendUrl, movePackageAddress in app.json
npm run start
```
If you run on a device/emulator, `movementBackendUrl` must be reachable:
- Android emulator: `http://10.0.2.2:3000`
- Physical device: `http://<your LAN IP>:3000`
Auto-pay for x402 uses the Movement expo-backend to build payment headers, so it must be running.
Note: @privy-io/expo pulls `expo-apple-authentication` and `react-native-passkeys` as peer dependencies, which add iOS entitlements that require code signing even on the simulator. This repo includes a local config plugin (`app/plugins/strip-ios-entitlements.js`) to strip those entitlements for simulator builds. Remove that plugin when you want Apple Sign-In or passkeys in production.

Privy dashboard checklist:
- Add App Identifiers: `host.exp.Exponent` and your bundle id
- Add URL Schemes: `exp` and your custom scheme (e.g., `royalagents`)
- If using passkeys, set `passkeyAssociatedDomain` and iOS `associatedDomains`

## Agent config (Type 1)
After minting a Type 1 agent, store the private config via:
- `POST /agents/:id/config` (owner-signed nonce)
- The backend verifies the on-chain `config_hash` before accepting the config

## Deterministic configuration
- Use fixed package address in `move/Move.toml` when testing locally
- Keep the same `.env` values across runs
- Use sqlite file path (e.g., `./royal_agents.db`) for repeatable state
