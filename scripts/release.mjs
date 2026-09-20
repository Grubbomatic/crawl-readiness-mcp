#!/usr/bin/env node
/**
 * Prepare a release: bump the version everywhere it lives, then validate
 * server.json against the published schema BEFORE anything is published.
 *
 *   node scripts/release.mjs 0.2.3
 *
 * This exists because publishing 0.2.2 cost three rejected attempts, all
 * avoidable:
 *   - server.json "description" exceeded the registry's 100-character cap
 *   - the GitHub namespace is case-sensitive (io.github.Grubbomatic, capital G)
 *   - the registry checks mcpName against the LIVE npm package, so a name
 *     correction needs a full republish rather than an edit
 *
 * src/index.js and src/tools.js now read the version from package.json, so
 * only package.json and server.json carry it. This keeps those two in step and
 * fails loudly on anything the registry would reject.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_URL =
  "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("usage: node scripts/release.mjs <version>   e.g. 0.2.3");
  process.exit(1);
}

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const write = (f, o) =>
  fs.writeFileSync(path.join(ROOT, f), JSON.stringify(o, null, 2) + "\n");

const pkg = read("package.json");
const srv = read("server.json");
const previous = pkg.version;

pkg.version = version;
srv.version = version;
for (const p of srv.packages || []) p.version = version;
write("package.json", pkg);
write("server.json", srv);

console.log(`version ${previous} -> ${version}`);

// --- validate ---------------------------------------------------------------

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

check(
  typeof srv.description === "string" &&
    srv.description.length >= 1 &&
    srv.description.length <= 100,
  `description must be 1-100 chars (is ${srv.description?.length})`
);
check(
  /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(srv.name) &&
    srv.name.length >= 3 &&
    srv.name.length <= 200,
  `name "${srv.name}" fails the registry's pattern or length rules`
);
check(
  srv.name === pkg.mcpName,
  `server.json name (${srv.name}) must equal package.json mcpName (${pkg.mcpName}) EXACTLY — the registry compares case-sensitively against the published npm package`
);
check(
  /^https?:\/\/[^\s]+$/.test(srv.repository?.url || ""),
  "repository.url must be an http(s) URL"
);
check(
  !srv.websiteUrl || /^https?:\/\/[^\s]+$/.test(srv.websiteUrl),
  "websiteUrl must be an http(s) URL"
);
for (const p of srv.packages || []) {
  check(
    p.identifier === pkg.name,
    `package identifier "${p.identifier}" must equal the npm package name "${pkg.name}"`
  );
  check(p.version === version, "package entry version out of step");
}
// Nothing else should still carry a hard-coded version.
for (const f of ["src/index.js", "src/tools.js"]) {
  const body = fs.readFileSync(path.join(ROOT, f), "utf8");
  check(
    !/version:\s*"\d+\.\d+\.\d+"/.test(body),
    `${f} has a hard-coded version — it should read from package.json`
  );
}

if (problems.length) {
  console.error("\nthe registry would reject this:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

console.log("server.json passes every constraint the registry enforces");
console.log(`  name        ${srv.name}`);
console.log(`  description ${srv.description.length}/100 chars`);
console.log(`  npm package ${srv.packages[0].identifier}@${srv.packages[0].version}`);
console.log(`  schema      ${SCHEMA_URL}`);

console.log(`
next, in this order:

  1. npm publish
     (an expired token reports as E404 on the PUT, not 401 —
      "npm whoami" returns E401 and confirms it; fix with "npm login")

  2. wait for npm to propagate — the registry reads it live, ~60-90s

  3. mcp-publisher login github; mcp-publisher publish
     CHAIN THESE. The registry JWT expires in minutes and an attempt
     has already been lost to it.
`);
