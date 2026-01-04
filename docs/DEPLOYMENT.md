# Movement Testnet Deployment

Move commands below use `movement` (recommended). Replace `movement` with `aptos` if you prefer Aptos CLI.

## 1) Create and fund a deployer account
Use Movement faucet to fund an account that will publish the Move package.

## 2) Publish Move package
```bash
cd move
movement move compile --save-metadata --named-addresses royal_agents=0xDEPLOYER
movement move publish --named-addresses royal_agents=0xDEPLOYER
```

## 3) Initialize on-chain state
Run these entry functions once, using the deployer signer:
- `royal_agents::agent_nft::init`
- `royal_agents::marketplace::init`
- `royal_agents::fee_manager::init`

Example:
```bash
movement move run \
  --function-id 0xDEPLOYER::agent_nft::init
movement move run \
  --function-id 0xDEPLOYER::marketplace::init
movement move run \
  --function-id 0xDEPLOYER::fee_manager::init
```

## 4) Configure backend
Set the following in `.env`:
- `MOVE_PACKAGE_ADDRESS=0xDEPLOYER`
- `MOVEMENT_RPC_URL=<movement testnet fullnode>`
- `MOVEMENT_FEE_MANAGER_PRIVATE_KEY=<private key for deployer>`

Start backend:
```bash
cd backend
npm install
npm run start
```

## 5) Movement Expo backend (for Privy signing)
```bash
cd expo-backend
cp .env.example .env
# edit MOVEMENT_FULLNODE_URL/MOVEMENT_FAUCET_URL if needed
npm install
npm run start
```
