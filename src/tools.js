/**
 * Tool definitions and implementations for the Crawl Readiness MCP server.
 *
 * Each tool corresponds to a live endpoint at www.crawlreadiness.com (the
 * permission check, at machinereadiness.com, is the same service on the
 * standard's own host). This module is a thin adapter: schema in, HTTP out,
 * JSON back.
 */

import { createRequire } from "node:module";
import { z } from "zod";

// A value that is still a template placeholder counts as unset. The plugin's
// .mcp.json carries "${user_config.crawl_readiness_api_key}", which Claude
// Code resolves; a client that copies the file verbatim (Cursor's directory
// shows it as-is) would otherwise send the placeholder as the key.
function envValue(name) {
  const value = (process.env[name] || "").trim();
  return value && !/^\$\{.*\}$/.test(value) ? value : null;
}

const API_BASE = envValue("CRAWL_READINESS_API_BASE") || "https://www.crawlreadiness.com";
const API_KEY = envValue("CRAWL_READINESS_API_KEY");
// The permission check is the Machine Readiness standard's API: the same
// service on a second host, and a receipt names the host that issued it. The
// call goes there unless the base is overridden for testing, in which case
// every tool goes to the override.
const PERMISSION_API_BASE = envValue("CRAWL_READINESS_API_BASE") || "https://machinereadiness.com";
const REQUEST_TIMEOUT_MS = 60_000;

// Read from package.json rather than declared here, so this doesn't become yet
// another version string to keep in sync.
const { version: VERSION } = createRequire(import.meta.url)("../package.json");

// Sent on every request so MCP traffic is distinguishable from the website in
// server logs. Without it there is no way to answer "is anyone actually using
// this?" — npm download counts include CI, mirrors, bots and every cold npx
// invocation, so they measure curiosity, not use.
const CLIENT_UA = `crawl-readiness-mcp/${VERSION} (+https://www.crawlreadiness.com/mcp)`;

// --- HTTP helpers ------------------------------------------------------------

function needApiKey() {
  if (API_KEY) return null;
  return (
    "This tool needs an API key. Get one free at https://www.crawlreadiness.com/dashboard " +
    "and set CRAWL_READINESS_API_KEY in your MCP server env config."
  );
}

async function apiGet(path, { requireApiKey = false, base = API_BASE } = {}) {
  if (requireApiKey) {
    const err = needApiKey();
    if (err) throw new Error(err);
  }
  const headers = { "User-Agent": CLIENT_UA };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(base + path, { headers, signal: controller.signal });
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
  const headers = { "Content-Type": "application/json", "User-Agent": CLIENT_UA };
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
        "Check whether AI crawlers (ChatGPT, Claude, Perplexity, Google AI, and 50+ others) can access a website, and what access policy it states. " +
        "Returns a 0-100 AI readiness score, per-crawler access status, detected AI-specific files (llms.txt, agents.json), " +
        "structured data presence, meta signals, and a prioritized fix list. The score counts the crawlers that feed AI " +
        "search and answers: each entry in `robots.results` carries its `purpose` and whether it is `scored`, and " +
        "training-only crawlers are listed but never counted, so blocking them does not lower the score. Fixes marked " +
        "`extra: true` (llms.txt, agents.json, Content-Signal, a markdown copy, agent-ready forms) are informational " +
        "'Going further' items and do not affect the score; present them as optional. Use this as the first step whenever a user asks whether AI can read a site.",
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
        "section merged in — plus the per-bot allow/block breakdown. Presets: 'allow-all' (every AI crawler allowed), " +
        "'recommended' (blocks only the training-only crawlers; everything that feeds AI search and answers stays allowed), " +
        "'search-only' (allows only the crawlers that feed AI search and answers, the ones the readiness score counts, " +
        "and blocks the rest), 'block-all'. A file from 'recommended' or 'search-only' loses no points for crawler access. " +
        "Write `generated.robotsTxt` to the site's /robots.txt. Requires an API key.",
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

  // 8. get_monitor_trend (requires API key, read-only)
  server.registerTool(
    "get_monitor_trend",
    {
      title: "Read the Answer Analysis",
      description:
        "Read the user's Answer Analysis: for the questions a brand's customers ask, how often live AI search " +
        "(Perplexity, Google AI Overviews) named the brand, which competitors were named, and the change run over " +
        "run. Call with NO argument to list the user's analyses with each brand's latest share of answers naming " +
        "it and the direction; pass a brand name or project id to get that brand's full trend, per-provider " +
        "breakdown, competitor comparison, average position, and short example answers. Reads data existing " +
        "analyses have already collected — it does not trigger new runs, and it measures rather than promises. " +
        "Read-only. Requires an API key.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe("Brand name or project id to detail. Omit to list all monitored brands."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ project }) => {
      const qs = project ? `?project=${encodeURIComponent(project)}` : "";
      const data = await apiGet(`/api/monitor/summary${qs}`, { requireApiKey: true });
      return jsonContent(data);
    }
  );

  // 9. check_permission (no API key needed; one lifts the daily limit)
  server.registerTool(
    "check_permission",
    {
      title: "Check Permission to Use a Page",
      description:
        "Ask whether a page may be used for a purpose, from every machine-readable signal the site publishes: robots.txt " +
        "per crawler, Cloudflare Content-Signal, the IETF Content-Usage directive and header, an RSL licence, a TDM " +
        "reservation (header or /.well-known/tdmrep.json), ai.txt, and noai/noindex/nosnippet on the page itself. Purposes: " +
        "'search' (index the page and show links and excerpts, no AI summary), 'answer' (input to a generated answer, " +
        "including retrieval for RAG), 'train' (train or fine-tune a model), 'agent' (fetch or act on the page for a user, " +
        "live). Returns a `verdict`: 'denied' (at least one signal reserves this use; any reservation wins), " +
        "'allowed-under-terms' (an RSL licence permits it on the conditions listed in `terms`, such as payment or " +
        "attribution), 'allowed' (no signal reserves the use, which is not a licence) or 'unknown' (the site's robots.txt " +
        "could not be read, e.g. it answered 403 or 5xx). Also requests the page once as a representative crawler for the " +
        "purpose and reports in `observed` whether the server served or refused it; a reservation that the server does not " +
        "enforce is still a reservation. Every source read is listed in `signals` with what was found and what it decided. " +
        "The `receipt` is a dated record of all of this, signed with Ed25519; the public key is published at " +
        "/api/permission-key, so the receipt can be verified later. Use it before fetching pages for RAG, a dataset or an " +
        "agent action, and whenever the user asks whether they may use, quote, index, train on or act on a page. It is a " +
        "reading of the signals the site published on that date, not legal advice. 25 calls a day per network without an " +
        "API key. Documented at https://machinereadiness.com/permission.",
      inputSchema: {
        url: z.string().describe("The page to ask about (e.g. 'https://example.com/article')."),
        purpose: z
          .enum(["search", "answer", "train", "agent"])
          .describe("What you intend to do with the page: search, answer (including RAG), train, or agent."),
        agent: z
          .string()
          .regex(/^[A-Za-z0-9_.-]{1,64}$/, "a crawler token, like GPTBot")
          .optional()
          .describe("Optional crawler token to ask about by name (e.g. 'GPTBot', 'ClaudeBot'). By default the purpose's whole crawler class is read."),
        observe: z
          .boolean()
          .optional()
          .describe("Default true: request the page once as a representative crawler and report what the server did. false reads the published signals only."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ url, purpose, agent, observe }) => {
      let qs = `?url=${encodeURIComponent(url)}&purpose=${encodeURIComponent(purpose)}`;
      if (agent) qs += `&agent=${encodeURIComponent(agent)}`;
      if (observe === false) qs += "&observe=0";
      const data = await apiGet(`/api/permission${qs}`, { base: PERMISSION_API_BASE });
      return jsonContent(data);
    }
  );
}
