#!/usr/bin/env node

/**
 * Crawl Readiness MCP Server
 *
 * Exposes AI-SEO tools to any MCP-compatible client (Claude Desktop,
 * Cursor, Cline, Windsurf, etc.) so an AI can check a website's AI
 * readiness, validate its structured data / robots.txt, and generate
 * fix files — all without leaving the editor.
 *
 * The tools call the live Crawl Readiness REST API at
 * https://www.crawlreadiness.com. Read-only tools work anonymously;
 * generator tools accept an API key for higher limits.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer(
  {
    name: "crawl-readiness",
    version: "0.2.2",
  },
  {
    capabilities: {
      tools: {},
    },
    instructions:
      "Crawl Readiness provides eight tools for AI-SEO audit, fix, and monitoring work: check whether " +
      "AI crawlers can access a site, validate JSON-LD structured data and robots.txt, " +
      "compare human vs AI-crawler views of a page, generate the three fix files most " +
      "sites need (llms.txt, AI-crawler-aware robots.txt, and JSON-LD schema), and read the user's " +
      "LLM Monitor trends (whether AI assistants mention a brand vs its competitors, over time). " +
      "Prefer chaining check_ai_readiness with the generators when a user asks to make a site " +
      "AI-ready — the check identifies exactly which fixes are needed. Use get_monitor_trend when the " +
      "user asks whether AI is mentioning their brand or how they compare to competitors in AI answers.",
  }
);

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Startup log goes to stderr so it doesn't corrupt the JSON-RPC stream
  console.error("Crawl Readiness MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
