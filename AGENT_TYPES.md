# RoyalAgents POC Agent Types

This document defines the two agent types required for the POC and how they fit the current MVP architecture. We will implement **Type 1** first and keep **Type 2** as a planned follow-up.

## Shared constraints (MVP)
- Public metadata is **non-secret** and suitable for IPFS.
- Secret behavior (system prompts, tool configs, provider details) is **server-side only** and encrypted in the backend.
- On-chain fields are fixed by the Agent NFT and **do not** depend on metadata contents.
- The backend enforces agent availability (paused / key missing) before use.

## Metadata usage
`metadata_uri` is used for UI/UX discovery only. It should include:
- `name`, `description`, `image`, `external_url`
- `attributes`: `agent_type`, `provider`, `capabilities`, `version`, `tags`
- Optional: `config_hash` (hash of the private config stored off-chain)

**Never** include secrets in metadata (system prompts, tool policies, API keys).

---

## Type 1 (Now): Specialized Scientific Researcher (xAI)

### Goal
An agent that uses the owner-provided xAI API key and a private system prompt to perform verified scientific research responses.

### Public metadata (example fields)
- `agent_type`: `scientific_research`
- `provider`: `xai`
- `capabilities`: `literature_search`, `citations`, `structured_summary`
- `tags`: `science`, `research`, `citations`

### Private config (backend-only, encrypted)
- `system_prompt` (full workflow + policies)
- `model` (e.g., `grok-4-1-fast-reasoning`)
- `temperature`, `max_tokens`, provider-specific flags
- Optional tool policies (if/when tools are added)

### Why this is safe
The differentiation is in the private prompt + tool policy. Exposing metadata does not leak the agent’s internal behavior.

### Implementation scope for Type 1
- Add xAI provider support (request/response format)
- Store private config per agent (encrypted at rest)
- Wire config into provider call path
- Keep public metadata minimal and non-sensitive

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

### Public metadata (example fields)
- `agent_type`: `logo_designer`
- `provider`: `self_hosted`
- `capabilities`: `logo_concepts`, `svg_export`, `brand_variations`
- `tags`: `design`, `branding`, `vector`

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
