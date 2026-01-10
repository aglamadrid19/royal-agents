import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";

dotenv.config();

const RUNNER_SECRET = process.env.RUNNER_SECRET;
if (!RUNNER_SECRET) {
  throw new Error("RUNNER_SECRET is required");
}

const port = Number(process.env.RUNNER_PORT || 7350);
if (!Number.isFinite(port)) {
  throw new Error("RUNNER_PORT must be a number");
}

const defaultServerPath = fileURLToPath(new URL("./mcp-logo-server.js", import.meta.url));
const command = process.env.MCP_SERVER_COMMAND || process.execPath;

function parseArgs(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch (error) {
    // fall through
  }
  return value.split(" ").filter(Boolean);
}

const args = parseArgs(process.env.MCP_SERVER_ARGS, [defaultServerPath]);

let clientPromise = null;
let clientInstance = null;

async function getClient() {
  if (clientInstance) {
    return clientInstance;
  }
  if (clientPromise) {
    return clientPromise;
  }
  clientPromise = (async () => {
    const transport = new StdioClientTransport({ command, args });
    const client = new Client(
      { name: "royal-agents-runner", version: "0.1.0" },
      { capabilities: {} }
    );
    await client.connect(transport);
    clientInstance = client;
    return client;
  })();
  return clientPromise;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const requestSchema = z.object({
  agent_id: z.number().int().nonnegative(),
  request_id: z.string().min(8).max(128),
  prompt: z.string().min(1).max(4000),
  system_prompt: z.string().min(1).max(8000),
  tool_budget: z.number().int().min(0).max(50),
  tool_name: z.string().min(1).max(64),
});

app.post("/run", async (req, res) => {
  const secret = req.header("x-runner-secret");
  if (!secret || secret !== RUNNER_SECRET) {
    res.status(401).json({ error: "invalid_runner_secret" });
    return;
  }

  let payload;
  try {
    payload = requestSchema.parse(req.body);
  } catch (error) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  if (payload.tool_budget < 1) {
    res.status(400).json({ error: "tool_budget_exceeded" });
    return;
  }

  try {
    const client = await getClient();
    const result = await client.callTool({
      name: payload.tool_name,
      arguments: {
        prompt: payload.prompt,
        system_prompt: payload.system_prompt,
        request_id: payload.request_id,
        agent_id: payload.agent_id,
      },
    });
    const textContent = Array.isArray(result.content)
      ? result.content.find(item => item.type === "text" && typeof item.text === "string")
      : null;
    if (!textContent || !textContent.text) {
      res.status(502).json({ error: "tool_response_invalid" });
      return;
    }
    res.json({ svg: textContent.text, tool_calls: 1 });
  } catch (error) {
    res.status(502).json({ error: "tool_call_failed" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Runner listening on :${port}`);
});
