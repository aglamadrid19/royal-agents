# Local + Testnet Setup

## Prerequisites
- Movement CLI (recommended) or Aptos CLI (Movement compatible)
- Node.js 18+
- SQLite (optional, backend uses embedded SQLite)
- Expo CLI for the app

All Move commands below use `movement`. If you use Aptos CLI, replace `movement` with `aptos`.

## 1) Move package
```bash
cd move
movement move test
```

To build/package for Movement testnet:
```bash
movement move compile --save-metadata --named-addresses royal_agents=0xYOUR_ACCOUNT
```

## 2) Backend
```bash
cd backend
cp ../.env.example .env
# edit .env with real values
npm install
npm run dev
```

## 3) Movement Expo backend
```bash
cd expo-backend
cp .env.example .env
# edit MOVEMENT_FULLNODE_URL/MOVEMENT_FAUCET_URL if needed
npm install
npm run start
```

## 4) App (Expo)
```bash
cd app
npm install
# set privyAppId, privyClientId, backendUrl, movementBackendUrl, movePackageAddress in app.json
npm run start
```

Privy dashboard checklist:
- Add App Identifiers: `host.exp.Exponent` and your bundle id
- Add URL Schemes: `exp` and your custom scheme (e.g., `royalagents`)
- If using passkeys, set `passkeyAssociatedDomain` and iOS `associatedDomains`

## Deterministic configuration
- Use fixed package address in `move/Move.toml` when testing locally
- Keep the same `.env` values across runs
- Use sqlite file path (e.g., `./royal_agents.db`) for repeatable state
