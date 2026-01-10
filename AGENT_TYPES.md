# RoyalAgents POC Agent Types

This document defines the two agent types implemented in the POC and how metadata, config, and pricing work.

## Shared constraints (MVP)
- On-chain metadata is authoritative and stored in the Agent NFT.
- Secret config is stored **server-side only** and encrypted at rest.
- Config is immutable after mint; `config_hash` proves backend config matches chain state.
- Agent use is gated by `paused` + `key_status` on-chain and in the backend.
- Pricing uses MOVE octas (1 MOVE = 1e8). Base fee is always charged; tool fees apply only to runner agents.

## Common on-chain fields
- `name`, `description`, `model`
- `provider` (u8 enum)
- `agent_type` (u8 enum)
- `config_hash` (32-byte SHA-256)
- `metadata_uri` (optional image/branding)
- `usage_fee` (base fee per request, MOVE octas)
- `tool_fee` + `tool_cap` (runner only)

---

## Type 1: Hosted LLM (xAI/OpenAI/Anthropic)

### Goal
A hosted agent that uses the owner-provided provider API key and a private system prompt.

### On-chain metadata
- `provider` = xai/openai/anthropic
- `agent_type` = hosted
- `tool_fee = 0`, `tool_cap = 0`

### Private config (backend-only, encrypted)
- `system_prompt`
- `temperature`, `max_tokens`

### Notes
- `config_hash` does **not** include API keys, so ownership transfers do not require a new config.
- Owner sets API key via backend, then sets `key_status = KEY_SET` on-chain.

---

## Type 2: Runner (MCP tool)

### Goal
A self-hosted agent that calls an MCP tool (POC: SVG logo generator) and returns a design output.

### On-chain metadata
- `provider` = none
- `agent_type` = runner
- `tool_fee > 0`, `tool_cap > 0`

### Private config (backend-only, encrypted)
- `system_prompt`
- `tool_name` (defaults to `generate_logo_svg`)

### Runner credentials (backend-only, encrypted)
- `runner_url` (owner host)
- `runner_secret` (shared secret)

### Notes
- The backend calls the runner `/run` endpoint, which then calls the MCP tool.
- The runner returns `{ svg, tool_calls }` so metered billing can be enforced.

---

## Metered pricing + refunds
- User provides `tool_budget` (<= `tool_cap`).
- `max_amount = usage_fee + tool_fee * tool_budget` (paid via x402).
- `actual_amount = usage_fee + tool_fee * tool_calls` (reported by runner).
- FeeManager settles: **95% owner / 5% protocol**, and refunds `max_amount - actual_amount`.

## Ownership transfers
- Marketplace transfers reset `key_status` to `KEY_MISSING`.
- New owner must set API key (Type 1) or runner credentials (Type 2).
- Config remains immutable and validated via `config_hash`.
