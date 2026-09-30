# Changelog

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
