#!/usr/bin/env node
/**
 * Smoke test: start the server over stdio, shake hands, list the tools.
 * Calls no endpoint and needs no API key.
 *
 *   node scripts/smoke.mjs
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const child = spawn(process.execPath, [path.join(ROOT, "src", "index.js")], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const waiting = new Map();
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && waiting.has(msg.id)) {
      waiting.get(msg.id)(msg);
      waiting.delete(msg.id);
    }
  }
});

let nextId = 1;
function request(method, params) {
  const id = nextId++;
  const p = new Promise((resolve, reject) => {
    waiting.set(id, resolve);
    setTimeout(() => reject(new Error(`no answer to ${method} within 10 seconds`)), 10_000);
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return p;
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const problems = [];
try {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  const info = init.result?.serverInfo || {};
  console.log(`server ${info.name} ${info.version}`);
  if (info.version !== pkg.version) problems.push(`server reports ${info.version}, package.json says ${pkg.version}`);
  notify("notifications/initialized", {});

  const listed = await request("tools/list", {});
  const tools = listed.result?.tools || [];
  console.log(`${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);
  if (tools.length === 0) problems.push("no tools listed");
  for (const t of tools) {
    if (!t.description || t.description.length < 40) problems.push(`${t.name}: description missing or too short`);
  }

  // Descriptions that must track what the site does.
  const byName = Object.fromEntries(tools.map((t) => [t.name, t.description || ""]));
  if (byName.check_ai_readiness && !/extra/.test(byName.check_ai_readiness)) {
    problems.push("check_ai_readiness: description does not say that `extra: true` fixes are not scored");
  }
  if (byName.generate_robots_txt && /cite sources/.test(byName.generate_robots_txt)) {
    problems.push("generate_robots_txt: description still describes the pre-scoring-v2 'recommended' preset");
  }
} catch (e) {
  problems.push(e.message);
} finally {
  child.kill();
}

if (problems.length) {
  console.error("\nSMOKE TEST FAILED");
  for (const p of problems) console.error(" - " + p);
  process.exit(1);
}
console.log("ok");
