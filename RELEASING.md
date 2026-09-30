# Releasing

One release reaches six places: npm, the MCP Registry, Glama, a GitHub
Release, the Chrome extension and its store listing. They drift when one is
forgotten, so do them in this order, in one sitting.

Anything marked **founder** needs a login or a second factor and is done by
hand.

## Before you start

- Does the change belong here? This server is a thin adapter: each tool calls
  a public endpoint on https://www.crawlreadiness.com. Logic changes belong in
  the site; this repo changes when a tool's inputs, outputs or description
  change.
- When the site changes what a response means (as scoring v2 did), re-read
  every tool description in `src/tools.js`. The descriptions are what an AI
  client reads to decide how to use a tool, so a stale one is a bug.

## 1. Bump and validate

```bash
node scripts/release.mjs 0.2.4
```

This writes the version to `package.json` and `server.json` and checks
`server.json` against what the registry enforces. It fails loudly on the three
things that cost 0.2.2 three rejected attempts:

- `description` in `server.json` is over 100 characters
- the name's case is wrong (`io.github.Grubbomatic`, capital G)
- `server.json` `name` and `package.json` `mcpName` differ

`src/index.js` and `src/tools.js` read the version from `package.json`, so
nothing else carries it.

## 2. Check it starts

```bash
npm install
node scripts/smoke.mjs
```

The smoke test starts the server over stdio, lists the tools and prints the
version and tool names. It calls no endpoint.

## 3. Commit, tag, push

```bash
git add -A
git commit -m "release: 0.2.4"
git tag v0.2.4
git push origin main --tags
```

## 4. npm (**founder**)

```bash
npm whoami
npm publish
```

If `npm whoami` prints an error instead of the account name, the login has
expired: run `npm login` first and sign in through the browser.

npm asks for browser approval. The registry in step 5 checks `mcpName` against
the **published** package, so npm always goes first.

- An expired npm token reports as `E404` on the upload, not `401`. `npm whoami`
  answering `E401` confirms it; `npm login` fixes it.
- Wait a minute or two after publishing. The registry reads npm live, and a
  package that has not propagated yet is rejected.

## 5. MCP Registry (**founder**)

```bash
./mcp-publisher.exe login github && ./mcp-publisher.exe publish
```

Run the two as one line. The login's token expires within minutes, and a
publish has already been lost to a pause between them.

In Windows PowerShell `&&` does not exist. Use this instead, or run the two
commands one straight after the other:

```powershell
./mcp-publisher.exe login github; if ($?) { ./mcp-publisher.exe publish }
```

`mcp-publisher.exe` is in the repo folder but not tracked by git. If it is
missing, download it from
https://github.com/modelcontextprotocol/registry/releases. The login opens
GitHub in the browser.

## 6. Glama

Either:

- open the server's page on glama.ai and press **Rebuild**, or
- turn on **Auto-Release** there once, then create a GitHub Release for each
  version (step 7). Glama builds from the release, and having releases also
  clears its "no stable releases" note.

`glama.json` and the `Dockerfile` in this repo are what Glama builds from.

## 7. GitHub Release (**founder**, or in the browser)

On github.com: Releases → Draft a new release → choose tag `v0.2.4` → paste
the changelog entry → Publish.

## 8. Chrome extension, when the popup changed

The extension lives in the site repo under `chrome-extension/`.

1. Bump `version` in `chrome-extension/manifest.json`.
2. Build the zip from the committed files, so nothing stray gets in:

   ```bash
   git archive --format=zip -o chrome-store-assets/crawl-readiness-extension-v1.0.9.zip HEAD:chrome-extension
   ```

3. **Founder:** Chrome Web Store developer dashboard → the extension →
   Package → Upload new package → Submit for review. Review takes from a few
   hours to a few days.

## 9. Store listing text, when what the product does changed

The listing text is kept in `chrome-store-assets/` in the site repo. Update it
there first, then paste it into the store's listing page (**founder**). The
npm README and the `/mcp` page on the site describe the same tools; check they
still agree.

## After

- `npx -y crawl-readiness-mcp@latest` in a terminal should print the new
  version on start.
- The registry entry and the Glama page should show the new version within a
  few minutes.
- Note the release in the Build Queue.
