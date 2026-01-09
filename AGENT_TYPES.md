# RoyalAgents POC Agent Types

This document defines the two agent types required for the POC and how they fit the current MVP architecture. We will implement **Type 1** first and keep **Type 2** as a planned follow-up.

## Shared constraints (MVP)
- On-chain metadata is authoritative and stored directly in the Agent NFT.
- Secret behavior (system prompts, tool configs, provider details) is **server-side only** and encrypted in the backend.
- Config is immutable after mint; `config_hash` is used to prove backend config matches chain state.
- The backend enforces agent availability (paused / key missing) before use.

## Metadata usage
On-chain fields required at mint:
- `name`
- `description`
- `model`
- `provider` (u8 enum)
- `config_hash` (32-byte SHA-256)
- `metadata_uri` (optional pointer for images/branding, can be empty string)

`metadata_uri` is UI-only; it must never include secrets.

---

## Type 1 (Now): Specialized Scientific Researcher (xAI)

### Goal
An agent that uses the owner-provided xAI API key and a private system prompt to perform verified scientific research responses.

### On-chain metadata (Type 1)
- `name` / `description`
- `model` (e.g., `grok-4-1-fast-reasoning`)
- `provider` = `xai` (enum value `1`)
- `config_hash` = SHA-256 of canonical config
- `metadata_uri` (optional image/branding)

### Private config (backend-only, encrypted)
- `system_prompt` (full workflow + policies)
- `temperature`, `max_tokens`, provider-specific flags
- Optional tool policies (if/when tools are added)

### Why this is safe
The differentiation is in the private prompt + tool policy. Exposing metadata does not leak the agent’s internal behavior.
Config hash does not include the API key, so ownership transfers do not require a new config.

### Implementation scope for Type 1
- Add xAI provider support (request/response format)
- Store private config per agent (encrypted at rest)
- Wire config into provider call path
- Keep public metadata minimal and non-sensitive
- Validate config hash against chain before every request

---

## Type 2 (Later): Logo Designer (Self-Hosted + Design Output)

### Goal
An agent that produces brandable logo assets, ideally in `.svg` and `.ai`, using a self-hosted model or an Adobe MCP-backed workflow.

### Why it is more complex
This requires a pipeline beyond simple chat completion:
- Long-running generation jobs
- Tool integration (MCP or local design tooling)
- Asset storage for binary outputs
- Optional conversion to `.ai` (often requires licensed Adobe tooling)

### On-chain metadata (Type 2)
- `name` / `description`
- `model` (self-hosted model ID or workflow ID)
- `provider` = `self_hosted` (enum value TBD)
- `config_hash` for the workflow config
- `metadata_uri` (sample images or brand)

### Private config (backend-only, encrypted)
- Model endpoint or MCP tooling endpoints
- Workflow steps (prompt templates, refinement strategy)
- Output formats and constraints

### Planned approach (not in MVP scope yet)
- Add async job queue for generation
- Store assets in object storage
- Return signed URLs to users
- Evaluate feasibility of `.ai` output (likely requires separate conversion tooling)

---

## Decision
We will implement **Type 1 first**. Type 2 is documented for planning and will be revisited after the Type 1 flow is production-quality.
