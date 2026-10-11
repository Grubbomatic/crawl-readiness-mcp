---
name: ai-readiness
description: Check whether AI crawlers and assistants (ChatGPT, Claude, Perplexity, Google AI) can read a website, fix what blocks them, and read the LLM Monitor trend. Use when the user asks if their site is AI-readable or AI-ready, mentions GPTBot, ClaudeBot, OAI-SearchBot, llms.txt, robots.txt for AI, agents.json, GEO or AI SEO, asks what ChatGPT can see on a site, or asks whether AI assistants mention their brand.
---

# AI readiness with the Crawl Readiness tools

The `crawl-readiness` MCP server gives you eight tools that call the live
service at www.crawlreadiness.com. Use them in this order.

## 1. Check first

Run `check_ai_readiness` with the site's address before advising anything.
Read the result like this:

- `score` (0–100) and `grade.status` are the headline. The score counts only
  the crawlers that fetch pages for AI search and answers (OAI-SearchBot,
  ChatGPT-User, Claude-SearchBot, PerplexityBot and the rest). Blocking
  training-only crawlers such as GPTBot, ClaudeBot, CCBot or
  Applebot-Extended costs no points; say so if the user asks about them.
- Fixes marked `extra: true` are "Going further" items (llms.txt, agents.json,
  Content-Signal, a markdown copy, forms tagged for agents). They never change
  the score. Present them as optional.
- `grade.status` "Restricted by Design" means the site blocks AI crawlers on
  purpose. That is a choice, not a failure; do not tell the user to "fix" it
  unless they want AI to read the site.
- "Partly Checked" means the homepage could not be read (often a firewall or
  CDN answering our crawler with a 403). Run `check_content_parity` to see
  what each AI crawler's user agent actually receives.

## 2. Explain, then fix

- For robots.txt questions, run `validate_robots` and quote the exact lines
  at fault.
- For structured data, run `validate_schema` and name the missing or invalid
  types.
- The three generators (`generate_llms_txt`, `generate_robots_txt`,
  `generate_schema`) need the Crawl Readiness API key configured in the
  plugin's settings (free from https://www.crawlreadiness.com/dashboard).
  If a generator answers that the key is missing, tell the user where to get
  one and to set it in the plugin configuration. Never ask them to paste a
  key into the conversation.
- When the user asks you to apply a fix to their project, show the generated
  file and where it will go before writing it. Merge into an existing
  robots.txt rather than replacing it; `generate_robots_txt` can take the
  existing file and merge the AI policy in.

## 3. Monitor, when they have projects

`get_monitor_trend` reads the user's LLM Monitor projects; it never starts a
run. Each result is labelled by how it was measured: live search (Perplexity,
Google AI Overviews) or model knowledge (ChatGPT, Claude, from their APIs).
Say which is which when you report a number, and treat a single run as a
sample, not a verdict.

## What to avoid

- Do not promise rankings or traffic. The check measures access and the
  signals AI systems use to understand a page; the methodology at
  https://www.crawlreadiness.com/methodology lists what it deliberately does
  not measure.
- Do not re-run the same check repeatedly in one conversation; anonymous use
  is rate limited, and the result does not change in minutes.
