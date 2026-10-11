# Changelog

## 0.2.5 — 2026-10-11

Packaging for the directories; the eight tools and their inputs are unchanged.

- The repository is now a Claude plugin: `.claude-plugin/plugin.json`,
  `.mcp.json` (the published package, pinned to this version, with the API
  key asked for through the plugin's own settings) and the `ai-readiness`
  skill, which tells Claude when to use which tool and how to read a result
  (training-only blocks cost no points, extras are optional, "Restricted by
  Design" is a choice).
- An MCP Bundle for Claude Desktop's one-click install and for Smithery:
  `manifest.json`, an icon, `.mcpbignore`, and a GitHub Action that builds
  `crawl-readiness-mcp-<version>.mcpb` on every release and attaches it.
- `CRAWL_READINESS_API_KEY` and `CRAWL_READINESS_API_BASE` ignore a value
  that is still a template placeholder (`${user_config.…}`), so a client
  that copies the plugin's config verbatim keeps the audit tools working.
- `scripts/release.mjs` bumps the plugin manifest, the bundle manifest and
  the pinned launcher together with `package.json` and `server.json`.
- Contact address in the README and the package author is now
  support@crawlreadiness.com (0.2.4 was published a minute before that
  change).

## 0.2.4 — 2026-09-29

Catches up with scoring v2 on crawlreadiness.com. No tool was added or
removed and no input changed; the descriptions an AI client reads are now
right about what the answers mean.

- `check_ai_readiness`: says that the score counts only the crawlers that feed
  AI search and answers, that each crawler carries its `purpose` and whether
  it is `scored`, and that fixes marked `extra: true` are optional "Going
  further" items that do not affect the score.
- `generate_robots_txt`: describes the presets as they now work. `recommended`
  blocks only the training-only crawlers; `search-only` allows only the
  crawlers the score counts. A file from either loses no points for crawler
  access.
- `RELEASING.md`: the release checklist, from the version bump to the store
  listing.
- `scripts/smoke.mjs`: starts the server, lists the tools and checks the two
  descriptions above.

## 0.2.3 and earlier

See the commit history.
