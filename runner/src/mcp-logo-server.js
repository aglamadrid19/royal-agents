import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { generateLogoSvg } from "./logo.js";

const TOOL_NAME = "generate_logo_svg";

const ToolInputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  system_prompt: z.string().optional(),
  request_id: z.string().optional(),
  agent_id: z.number().optional(),
});

const server = new Server(
  {
    name: "royal-agents-logo",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: TOOL_NAME,
        description: "Generate a stylized SVG logo based on a prompt.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Logo brief" },
            system_prompt: { type: "string", description: "Style constraints" },
            request_id: { type: "string" },
            agent_id: { type: "number" },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  if (request.params.name !== TOOL_NAME) {
    throw new Error("tool_not_found");
  }
  const parsed = ToolInputSchema.parse(request.params.arguments ?? {});
  const svg = generateLogoSvg({
    prompt: parsed.prompt,
    systemPrompt: parsed.system_prompt ?? "",
  });
  return {
    content: [
      {
        type: "text",
        text: svg,
      },
    ],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
