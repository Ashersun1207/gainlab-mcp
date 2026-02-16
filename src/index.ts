#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerKlineTool } from "./tools/kline.js";
import { registerIndicatorsTool } from "./tools/indicators.js";
import { registerOverlayTool } from "./tools/overlay.js";
import { registerFundamentalsTool } from "./tools/fundamentals.js";

const server = new McpServer({
  name: "gainlab",
  version: "0.1.0",
}, {
  capabilities: {
    tools: {},
  },
  instructions: "GainLab MCP Server - Agent's Eyes for Financial Charts. Provides professional financial chart visualization tools covering crypto, US stocks, A-shares, and commodities.",
});

// Register tools
registerKlineTool(server);
registerIndicatorsTool(server);
registerOverlayTool(server);
registerFundamentalsTool(server);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GainLab MCP Server v0.1.0 running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
