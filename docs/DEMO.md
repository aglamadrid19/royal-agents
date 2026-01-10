# Demo Script (App-Based Happy Flows)

This demo uses the Expo app for all user/creator actions. The CLI is only used for deployment and optional verification.

## Prereqs
- Complete setup (see docs/SETUP.md)
- Movement wallet funded (owner + user)

## Shared notes
- Fees are MOVE octas (1 MOVE = 1e8).
- The app computes `config_hash` automatically when minting.
- After mint, config + credentials are stored off-chain, then `key_status` is set on-chain.

---

# Type 1 (Hosted) Happy Flow

## Creator route (app)
1) Open **Create Agent**.
2) Select **Type 1 (Hosted)**.
3) Fill:
   - Name, Description
   - Model (e.g., `grok-4-1-fast-reasoning`)
   - Base Fee (MOVE)
   - Optional Metadata URI
4) Tap **Next: Configure Agent**.
5) Enter **System Prompt**, **Temperature**, **Max Tokens**.
6) Tap **Mint Agent + Save Config**.
7) On the **Set / Update API Key** screen:
   - Tap **Request Nonce**
   - Tap **Submit Key** (provider + API key)
8) Tap **Set Key Status On-Chain**.

## User route (app)
1) Open **Agent List** and select the agent.
2) Tap **Use Agent**.
3) Enter a prompt.
4) Leave **x402 Payment Header** blank for auto‑pay.
5) Tap **Pay + Run** and view decrypted response.

---

# Type 2 (Runner) Happy Flow

## Creator route (app)
1) Start the runner service (`runner/`). Ensure `RUNNER_SECRET` is set.
2) Open **Create Agent**.
3) Select **Type 2 (Runner)**.
4) Fill:
   - Name, Description
   - Model (e.g., `logo-runner-v1`)
   - Base Fee (MOVE)
   - Tool Fee (MOVE per call)
   - Tool Cap (max calls per request)
5) Tap **Next: Configure Agent**.
6) Enter **System Prompt** and **Tool Name** (default `generate_logo_svg`).
7) Tap **Mint Agent + Save Config**.
8) On **Set Runner Credentials** screen:
   - Tap **Request Nonce**
   - Enter **Runner URL** (reachable from backend)
   - Enter **Runner Secret** (must match `RUNNER_SECRET`)
   - Tap **Submit Key**
9) Tap **Set Key Status On-Chain**.

## User route (app)
1) Open **Agent List** and select the agent.
2) Tap **Use Agent**.
3) Enter a prompt.
4) Set **Tool Budget** (<= Tool Cap).
5) Leave **x402 Payment Header** blank for auto‑pay.
6) Tap **Pay + Run** and view decrypted SVG output.

---

# Optional: Ownership transfer (app + CLI)

The app includes listing/buy UI. If you use CLI:
```bash
movement move run \
  --function-id 0xDEPLOYER::marketplace::list \
  --args u64:<agent_id> u64:<price_octas>

movement move run \
  --function-id 0xDEPLOYER::marketplace::buy \
  --args u64:<agent_id>
```
After purchase, `key_status` resets to `KEY_MISSING`. The new owner must set API key (Type 1) or runner credentials (Type 2), then set key status on‑chain.

---

## Verify settlement
- x402 payment is sent to the treasury (package address)
- Backend settles on-chain via FeeManager (95% owner / 5% protocol + refunds)
