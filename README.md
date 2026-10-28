# Crawl Readiness MCP Server

**An MCP server that checks whether a website is set up for AI the way its owner intends: can GPTBot, ClaudeBot, PerplexityBot and 50+ other AI crawlers read it, and what does its access policy allow?** Then it generates the files (llms.txt, an AI-crawler robots.txt, JSON-LD structured data), reads your Answer Analysis, and tells you whether a page's published signals permit a use (search, answers, training, agent action), inside Claude Desktop, Cursor, Cline, Windsurf and other MCP clients.

Ask Claude "can AI read my site?" and it will actually check, running a live audit against 50+ AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google's and more) and reading the access policy the site states. Then ask it to fix what is blocked, and it can generate a proper `llms.txt`, `robots.txt` or JSON-LD schema and write it straight into your project.

No more copy-paste between your editor and a browser.

---

## What it does

Nine tools your AI assistant can call:

**Audit (no signup):**
- `check_ai_readiness` — Score a site 0–100 against 50+ AI crawlers, with a prioritized fix list; extras that don't affect the score are marked as such
- `validate_schema` — Audit JSON-LD structured data on any URL (20+ types, per-type rules)
- `validate_robots` — Line-by-line robots.txt audit
- `check_content_parity` — Compare what humans see vs what AI crawlers see

**Permission (no signup):**
- `check_permission` — Ask whether a page may be used for search, answers, training or agent action. Reads robots.txt, Content-Signal, Content-Usage, an RSL licence, the TDM reservation, ai.txt and the page's own noai tags, reports what the server did when a crawler asked, and returns a dated receipt signed with Ed25519. Documented at [machinereadiness.com/permission](https://machinereadiness.com/permission)

**Generate (requires free API key):**
- `generate_llms_txt` — Auto-crawl a site and produce a properly formatted llms.txt
- `generate_robots_txt` — AI-crawler-aware robots.txt with preset policies
- `generate_schema` — Organization / WebSite / Article JSON-LD ready to paste

**Answer Analysis (read-only, requires free API key):**
- `get_monitor_trend` — Read your Answer Analysis: for the questions your customers ask, whether live AI search (Perplexity, Google AI Overviews) named your brand or a competitor, and the change run over run (reads existing analyses; doesn't trigger runs)

---

## Install

### Claude Desktop, one click

Download `crawl-readiness-mcp-<version>.mcpb` from the [latest release](https://github.com/Grubbomatic/crawl-readiness-mcp/releases/latest) and double-click it (or drag it into the Claude Desktop window). Claude Desktop shows what the extension does and asks for the optional API key. The bundle carries the server and its dependencies, so nothing else is installed.

### Claude Code, as a plugin

This repository is also a Claude plugin: the `.mcp.json` at its root starts the server (pinned to this version), and the `ai-readiness` skill tells Claude when to use which tool and how to read the results. Add it from the Claude directory once it is listed there. To try it before then, clone the repository and start Claude Code with it loaded:

```bash
claude --plugin-dir ./crawl-readiness-mcp
```

Claude Code asks for the optional API key when the plugin is enabled and keeps it in secure storage; the plugin's own files never contain it.

### For Claude Desktop, by hand

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

Restart the client. All nine tools are now callable.

---

## Example prompts

Once installed, try any of these in your AI client:

- *"Is my portfolio site AI-readable? URL: yourdomain.com"*
- *"Check if ChatGPT can see acme-inc.com"*
- *"Validate the JSON-LD on stripe.com — is anything missing?"*
- *"Compare what humans see vs what AI crawlers see on producthunt.com"*
- *"Generate an llms.txt for my site and save it to `/public/llms.txt`"*
- *"My site scored 68/100 — walk me through the fixes"*
- *"May I train on https://example.com/research? Check what the site publishes."*
- *"Before we build the RAG index, which of these pages reserve AI answers?"*

Your AI can chain tools automatically — audit, identify issues, fix them, and write files to your project without you copy-pasting anything.

---

## Configuration

| Env var | Purpose | Default |
|---|---|---|
| `CRAWL_READINESS_API_KEY` | Free API key for the generators and the Answer Analysis read; lifts the daily limit on `check_permission` | none |
| `CRAWL_READINESS_API_BASE` | Override the API base URL for every tool, the permission check included (for testing) | `https://www.crawlreadiness.com` |

---

## What tools receive from the server

Each tool returns the full JSON response from the Crawl Readiness API — the same data the web dashboard renders. Your AI has access to:

- **check_ai_readiness:** score, robots.txt status per crawler, structured-data flags, homepage signals, prioritized fix list (fixes marked `extra: true` are optional and not scored)
- **validate_schema:** per-block issues (errors, warnings, info), suggested missing types
- **validate_robots:** line-by-line issues, AI-bot coverage summary
- **check_content_parity:** verdict + per-crawler HTTP status, word overlap %, warnings
- **check_permission:** verdict (`denied`, `allowed-under-terms`, `allowed`, `unknown`) with the reason, every signal as it was read, what the server did when asked as a crawler, and the signed receipt
- **generate_llms_txt:** the file content + companion robots.txt snippet
- **generate_robots_txt:** merged robots.txt with the AI policy applied
- **generate_schema:** JSON-LD scripts for each detected schema type
- **get_monitor_trend:** per analysis, the share of answers naming the brand, the per-provider split, the competitors named, the trend run over run, and short example answers

---

## What this sends, and where

Every tool makes HTTPS requests to `https://www.crawlreadiness.com`, and `check_permission` to `https://machinereadiness.com` (the same service on the standard's own host), and nowhere else. What leaves your machine is the website address (and for the generators, the inputs) you asked about, the API key if you configured one, and a `crawl-readiness-mcp/<version>` user agent. The server stores nothing locally, runs no other programs, and reads no files; writing a generated file into your project is something your AI client does, with your say-so. The service's own data handling is described at [crawlreadiness.com/privacy](https://www.crawlreadiness.com/privacy).

The plugin's `.mcp.json` starts the published npm package pinned to the same version as the repository (`npx -y crawl-readiness-mcp@<version>`), so what runs is the code in this repository at that tag.

---

## Support

- **Docs:** [crawlreadiness.com/mcp](https://www.crawlreadiness.com/mcp)
- **Issues:** [github.com/Grubbomatic/crawl-readiness-mcp/issues](https://github.com/Grubbomatic/crawl-readiness-mcp/issues)
- **Email:** support@crawlreadiness.com

---

## About

Crawl Readiness checks whether a website is set up for AI the way its owner intends: what AI crawlers can read, what its access policy allows, and what is missing, with the files that fix it. Every generator tool in this MCP server is also available on the web at [crawlreadiness.com/tools](https://www.crawlreadiness.com/tools). The MCP server just makes the same tools callable from inside your AI assistant, so the "audit → fix → apply" loop happens in one conversation without leaving your editor.

## Releasing (maintainers)

`npm run release` validates `server.json` and prints the publish steps. The last step uses the `mcp-publisher` CLI, which is not part of this repository: download it from the [MCP Registry releases](https://github.com/modelcontextprotocol/registry/releases) and keep it on your PATH or in the repo root (it is git-ignored there).

## License

MIT © 2026 Crawl Readiness / Tundrastone
