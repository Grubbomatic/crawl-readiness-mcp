#!/usr/bin/env node

/**
 * Crawl Readiness MCP Server
 *
 * Exposes the Crawl Readiness tools to any MCP-compatible client (Claude Desktop,
 * Cursor, Cline, Windsurf, etc.) so an AI can check a website's AI
 * readiness, validate its structured data / robots.txt, generate fix
 * files, read the Answer Analysis and check whether a page's published
 * signals permit a use — all without leaving the editor.
 *
 * The tools call the live Crawl Readiness REST API at
 * https://www.crawlreadiness.com (the permission check at
 * https://machinereadiness.com, the same service on the standard's host).
 * Read-only tools work anonymously; generator tools need an API key.
 */

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

// Single source of truth. This was a hard-coded string that had to be bumped
// in lockstep with package.json and server.json, and drifted at least once.
const { version: VERSION } = createRequire(import.meta.url)("../package.json");

const server = new McpServer(
  {
    name: "crawl-readiness",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
    instructions:
      "Crawl Readiness provides nine tools to check whether a site is set up for AI the way its owner intends, " +
      "fix it and prove it: check whether AI crawlers can read a site and what access policy it states, validate " +
      "JSON-LD structured data and robots.txt, compare human vs AI-crawler views of a page, generate the three " +
      "files most sites need (llms.txt, an AI-crawler robots.txt with its Content-Signal and TDM lines, and " +
      "JSON-LD schema), read the user's Answer Analysis (whether live AI search named their brand for the " +
      "questions their customers ask, and the change over time), and check whether a page's published signals " +
      "(robots.txt, Content-Signal, Content-Usage, RSL, TDM, ai.txt, noai) permit a use: search, answer, train " +
      "or agent, with what the server did when asked and a signed receipt. Prefer chaining check_ai_readiness " +
      "with the generators when a user asks to make a site readable by AI — the check identifies exactly which " +
      "fixes are needed. Use get_monitor_trend when the user asks what AI answers named or how they compare " +
      "to competitors; it measures, it does not promise mentions. Use check_permission before fetching pages " +
      "for RAG, a dataset or an agent action, and when the user asks whether they may use a page; report its " +
      "verdict as a reading of published signals, not legal advice.",
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
