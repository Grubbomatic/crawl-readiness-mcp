# Crawl Readiness MCP Server

**AI SEO tools inside Claude, Cursor, and other MCP-compatible clients.**

Ask Claude "is my site AI-readable?" and it'll actually check — running a live audit against 50+ AI crawlers (ChatGPT, Claude, Perplexity, Google AI, and more). Then ask it to fix what's broken, and it can generate a proper `llms.txt`, `robots.txt`, or JSON-LD schema and write it straight into your project.

No more copy-paste between your editor and yet another SEO tool.

---

## What it does

Eight tools your AI assistant can call:

**Audit (no signup):**
- `check_ai_readiness` — Score a site 0–100 against 50+ AI crawlers, with a prioritized fix list
- `validate_schema` — Audit JSON-LD structured data on any URL (20+ types, per-type rules)
- `validate_robots` — Line-by-line robots.txt audit
- `check_content_parity` — Compare what humans see vs what AI crawlers see

**Generate (requires free API key):**
- `generate_llms_txt` — Auto-crawl a site and produce a properly formatted llms.txt
- `generate_robots_txt` — AI-crawler-aware robots.txt with preset policies
- `generate_schema` — Organization / WebSite / Article JSON-LD ready to paste

**Monitor (read-only, requires free API key):**
- `get_monitor_trend` — See whether ChatGPT, Claude, Perplexity & Google AI mention your brand vs competitors, and how that's trending week over week (reads your LLM Monitor projects; doesn't trigger runs)

---

## Install

### For Claude Desktop

Open your config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add this to the `mcpServers` block:

```json
{
  "mcpServers": {
    "crawl-readiness": {
      "command": "npx",
      "args": ["-y", "crawl-readiness-mcp"]
    }
  }
}
```

Restart Claude Desktop. You'll see "crawl-readiness" listed in the tools panel.

### For Cursor

Open Cursor Settings → **Features** → **Model Context Protocol** → **Add new global MCP server**.

```json
{
  "crawl-readiness": {
    "command": "npx",
    "args": ["-y", "crawl-readiness-mcp"]
  }
}
```

### For Cline / Windsurf / Continue

Same shape — add `crawl-readiness` to your MCP servers list with `npx -y crawl-readiness-mcp` as the command.

---

## Unlock the generator tools

The four audit tools work out of the box, no signup. The three generator tools need an API key — free at [crawlreadiness.com/dashboard](https://www.crawlreadiness.com/dashboard) (50 checks/month on the free tier, no credit card).

Once you have a key, add it via env in the same config:

```json
{
  "mcpServers": {
    "crawl-readiness": {
      "command": "npx",
      "args": ["-y", "crawl-readiness-mcp"],
      "env": {
        "CRAWL_READINESS_API_KEY": "cr_live_xxxxxxxxxxxx"
      }
    }
  }
}
```

Restart the client. All seven tools are now callable.

---

## Example prompts

Once installed, try any of these in your AI client:

- *"Is my portfolio site AI-readable? URL: yourdomain.com"*
- *"Check if ChatGPT can see acme-inc.com"*
- *"Validate the JSON-LD on stripe.com — is anything missing?"*
- *"Compare what humans see vs what AI crawlers see on producthunt.com"*
- *"Generate an llms.txt for my site and save it to `/public/llms.txt`"*
- *"My site scored 68/100 — walk me through the fixes"*

Your AI can chain tools automatically — audit, identify issues, fix them, and write files to your project without you copy-pasting anything.

---

## Configuration

| Env var | Purpose | Default |
|---|---|---|
| `CRAWL_READINESS_API_KEY` | Free API key for generator tools | none |
| `CRAWL_READINESS_API_BASE` | Override the API base URL (for testing) | `https://www.crawlreadiness.com` |

---

## What tools receive from the server

Each tool returns the full JSON response from the Crawl Readiness API — the same data the web dashboard renders. Your AI has access to:

- **check_ai_readiness:** score, robots.txt status per crawler, structured-data flags, homepage signals, prioritized fix list
- **validate_schema:** per-block issues (errors, warnings, info), suggested missing types
- **validate_robots:** line-by-line issues, AI-bot coverage summary
- **check_content_parity:** verdict + per-crawler HTTP status, word overlap %, warnings
- **generate_llms_txt:** the file content + companion robots.txt snippet
- **generate_robots_txt:** merged robots.txt with the AI policy applied
- **generate_schema:** JSON-LD scripts for each detected schema type
- **get_monitor_trend:** per-brand mention rate, share of voice, per-provider breakdown, competitor comparison, trend over time, and short example answers

---

## Support

- **Docs:** [crawlreadiness.com/mcp](https://www.crawlreadiness.com/mcp)
- **Issues:** [github.com/Grubbomatic/crawl-readiness-mcp/issues](https://github.com/Grubbomatic/crawl-readiness-mcp/issues)
- **Email:** crawlreadiness@gmail.com

---

## About

Crawl Readiness is a suite of AI-SEO tools that check whether AI systems can access your website and help you fix what's blocked. Every generator tool in this MCP server is also available on the web at [crawlreadiness.com/tools](https://www.crawlreadiness.com/tools). The MCP server just makes the same tools callable from inside your AI assistant, so the "audit → fix → apply" loop happens in one conversation without leaving your editor.

## License

MIT © 2026 Crawl Readiness / Tundrastone
