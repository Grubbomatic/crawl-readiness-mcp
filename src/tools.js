/**
 * Tool definitions and implementations for the Crawl Readiness MCP server.
 *
 * Each tool corresponds to a live endpoint at api.crawlreadiness.com.
 * This module is a thin adapter: schema in, HTTP out, JSON back.
 */

import { z } from "zod";

const API_BASE = process.env.CRAWL_READINESS_API_BASE || "https://www.crawlreadiness.com";
const API_KEY = process.env.CRAWL_READINESS_API_KEY || null;
const REQUEST_TIMEOUT_MS = 60_000;

// --- HTTP helpers ------------------------------------------------------------

function needApiKey() {
  if (API_KEY) return null;
  return (
    "This tool needs an API key. Get one free at https://www.crawlreadiness.com/dashboard " +
    "and set CRAWL_READINESS_API_KEY in your MCP server env config."
  );
}

async function apiGet(path, { requireApiKey = false } = {}) {
  if (requireApiKey) {
    const err = needApiKey();
    if (err) throw new Error(err);
  }
  const headers = {};
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + path, { headers, signal: controller.signal });
    return await parseResponse(res);
  } finally {
    clearTimeout(timer);
  }
}

async function apiPost(path, body, { requireApiKey = false } = {}) {
  if (requireApiKey) {
    const err = needApiKey();
    if (err) throw new Error(err);
  }
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    return await parseResponse(res);
  } finally {
    clearTimeout(timer);
  }
}

async function parseResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    let detail = "";
    if (contentType.includes("application/json")) {
      try {
        const j = await res.json();
        detail = j.error || j.message || "";
      } catch { /* ignore */ }
    } else {
      try {
        detail = (await res.text()).slice(0, 200);
      } catch { /* ignore */ }
    }
    throw new Error(`HTTP ${res.status}${detail ? ": " + detail : ""}`);
  }
  if (contentType.includes("application/json")) return await res.json();
  return await res.text();
}

function jsonContent(payload) {
  return {
    content: [
      {
        type: "text",
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

// --- Tool registration -------------------------------------------------------

export function registerTools(server) {
  // 1. check_ai_readiness
  server.registerTool(
    "check_ai_readiness",
    {
      title: "Check AI Readiness",
      description:
        "Check whether AI crawlers (ChatGPT, Claude, Perplexity, Google AI, and 50+ others) can access a website. " +
        "Returns a 0-100 AI readiness score, per-crawler access status, detected AI-specific files (llms.txt, agents.json), " +
        "structured data presence, meta signals, and a prioritized fix list. Use this as the first step in any AI SEO audit.",
      inputSchema: {
        url: z.string().describe("The website URL to check (e.g. 'example.com' or 'https://example.com/page')."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ url }) => {
      const data = await apiGet(`/api/check?url=${encodeURIComponent(url)}`);
      return jsonContent(data);
    }
  );

  // 2. validate_schema
  server.registerTool(
    "validate_schema",
    {
      title: "Validate JSON-LD Schema",
      description:
        "Validate all JSON-LD structured data on a URL. Extracts every <script type=\"application/ld+json\"> block, " +
        "runs each through a rules engine covering 20+ common types (Article, Organization, Product, LocalBusiness, " +
        "FAQPage, Recipe, Event, etc.), and reports required-field errors, recommended-field warnings, and type-specific " +
        "gotchas.",
      inputSchema: {
        url: z.string().describe("The URL to validate structured data on."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ url }) => {
      const data = await apiGet(`/api/validate-schema?url=${encodeURIComponent(url)}`);
      return jsonContent(data);
    }
  );

  // 3. validate_robots
  server.registerTool(
    "validate_robots",
    {
      title: "Validate robots.txt",
      description:
        "Audit a robots.txt file line-by-line. Detects syntax errors, empty user-agent groups, orphan Allow/Disallow " +
        "lines, non-slash paths, non-numeric Crawl-delay values, unofficial Noindex usage, and wildcard traps. Also " +
        "summarizes AI-bot coverage across 50+ known AI crawlers. Provide EITHER url (to fetch and audit) OR text.",
      inputSchema: {
        url: z.string().optional().describe("URL of the site whose /robots.txt should be fetched and audited."),
        text: z.string().optional().describe("Raw robots.txt text to audit directly (alternative to url)."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ url, text }) => {
      if (!url && !text) throw new Error("Provide either a url or robots.txt text.");
      const data = text
        ? await apiPost("/api/validate-robots", { text })
        : await apiGet(`/api/validate-robots?url=${encodeURIComponent(url)}`);
      return jsonContent(data);
    }
  );

  // 4. check_content_parity
  server.registerTool(
    "check_content_parity",
    {
      title: "Content Parity Check",
      description:
        "Compare what human browsers see vs what AI crawlers see. Fetches a page four times in parallel — as Chrome, " +
        "GPTBot, ClaudeBot, and PerplexityBot — and reports word-overlap %, title/description differences, and warnings " +
        "about JS-only shells, cloaking, or edge-based bot blocking.",
      inputSchema: {
        url: z.string().describe("The URL to check parity on."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ url }) => {
      const data = await apiGet(`/api/check-parity?url=${encodeURIComponent(url)}`);
      return jsonContent(data);
    }
  );

  // 5. generate_llms_txt (requires API key)
  server.registerTool(
    "generate_llms_txt",
    {
      title: "Generate llms.txt",
      description:
        "Generate a properly formatted llms.txt file for a website. Crawls the site's sitemap, groups pages by section, " +
        "pulls page titles and descriptions, and produces both the llms.txt content and a companion robots.txt snippet. " +
        "The AI client can then write the returned content to disk in the user's project. Requires an API key.",
      inputSchema: {
        url: z.string().describe("The website to generate llms.txt for."),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: true,
      },
    },
    async ({ url }) => {
      const data = await apiGet(`/api/generate-llms?url=${encodeURIComponent(url)}`, { requireApiKey: true });
      return jsonContent(data);
    }
  );

  // 6. generate_robots_txt (requires API key)
  server.registerTool(
    "generate_robots_txt",
    {
      title: "Generate robots.txt",
      description:
        "Generate a complete, ready-to-save AI-crawler-aware robots.txt for a website. Fetches the existing robots.txt " +
        "(if any) and returns the finished file in `generated.robotsTxt` — the existing rules with an AI-crawler policy " +
        "section merged in — plus the per-bot allow/block breakdown. Presets: 'allow-all' (public businesses), " +
        "'search-only' (allow AI search, block training), 'recommended' (allow major AI assistants that cite sources, " +
        "block training-only bots), 'block-all'. Write `generated.robotsTxt` to the site's /robots.txt. Requires an API key.",
      inputSchema: {
        url: z.string().describe("The website to generate a robots.txt for."),
        preset: z
          .enum(["allow-all", "search-only", "recommended", "block-all"])
          .default("recommended")
          .describe("The AI-crawler policy preset to apply."),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: true,
      },
    },
    async ({ url, preset }) => {
      const chosen = preset || "recommended";
      const data = await apiGet(
        `/api/generate-robots?url=${encodeURIComponent(url)}&preset=${encodeURIComponent(chosen)}`,
        { requireApiKey: true }
      );
      return jsonContent(data);
    }
  );

  // 7. generate_schema (requires API key)
  server.registerTool(
    "generate_schema",
    {
      title: "Generate JSON-LD Schema",
      description:
        "Generate JSON-LD structured data for a website. Detects the site's name, logo, social profiles, contact info, " +
        "and article metadata, then produces Organization, WebSite, and (when applicable) Article schemas plus starter " +
        "templates for BreadcrumbList and FAQPage. Returns each schema as a <script type=\"application/ld+json\"> block " +
        "ready to paste into the site's <head>. Requires an API key.",
      inputSchema: {
        url: z.string().describe("The website to generate schema for."),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: true,
      },
    },
    async ({ url }) => {
      const data = await apiGet(`/api/generate-schema?url=${encodeURIComponent(url)}`, { requireApiKey: true });
      return jsonContent(data);
    }
  );
}
