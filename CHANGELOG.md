# Changelog

## Unreleased

`check_permission` follows the permission check's version 2
(machinereadiness.com, 28 Oct 2026). Same inputs; two defaults changed.

- `observe` now defaults to false, as the API does: the request with a
  representative crawler's user-agent string is sent only when asked for,
  and its result is labelled for what it is (the string, sent from our
  servers, beside our own request as the control).
- `agent` is described as the caller's own crawler token: another
  company's token cannot loosen the reading for the crawlers that do the job.
- The description states the API's rules: any reservation wins (a block on
  any one crawler that does the job included), a robots.txt server error is
  a full disallow, `unknown` outranks `allowed`, and the receipt carries the
  SHA-256 of every file read, verifiable later against current or retired
  keys.

## 0.2.6 — 2026-10-24

One tool added: `check_permission`, the Machine Readiness permission check.
No other tool's inputs changed.

- `check_permission` asks whether a page may be used for a purpose
  (`search`, `answer`, `train` or `agent`). It reads every
  machine-readable signal the site publishes (robots.txt per crawler,
  Cloudflare Content-Signal, the IETF Content-Usage directive and header, an
  RSL licence, a TDM reservation, ai.txt, noai/noindex/nosnippet on the
  page), requests the page once as a representative crawler and reports
  whether the server served or refused it, and returns a dated receipt
  signed with Ed25519 (public key at `/api/permission-key`). Verdicts:
  `denied`, `allowed-under-terms`, `allowed`, `unknown`. An optional
  `agent` asks about one crawler token; `observe: false` skips the request
  to the site. No API key needed; 25 calls a day per network without one.
  Documented at https://machinereadiness.com/permission.
- The permission call goes to machinereadiness.com, the standard's own host,
  so the receipt names it as issuer. `CRAWL_READINESS_API_BASE` overrides
  it together with everything else.
- The server's instructions, the README, the plugin skill, the bundle
  manifest and the registry entry describe nine tools; the smoke test checks
  the new tool is listed with its four purposes.

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
