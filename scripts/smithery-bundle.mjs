#!/usr/bin/env node
/**
 * The Smithery copy of the bundle.
 *
 * Smithery's CLI publishes a .mcpb by sending the manifest's `tools` as the
 * server card, and its API requires an `inputSchema` object on every tool
 * ("Invalid input: expected object, received undefined", one per tool). The
 * MCPB spec allows only name and description there, and `mcpb pack` refuses a
 * manifest with anything else. So the standard bundle stays as the spec wants
 * it, and this script writes a second copy for Smithery with the schemas
 * added, mirroring src/tools.js.
 *
 *   node scripts/smithery-bundle.mjs dist/crawl-readiness-mcp-0.2.5.mcpb
 *
 * Writes dist/crawl-readiness-mcp-0.2.5-smithery.mcpb: the same files, with
 * manifest.json replaced, as a stored (uncompressed) zip. 9 MB unpacked, well
 * inside Smithery's 25 MB limit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync, crc32 } from "node:zlib";
import { pathToFileURL } from "node:url";

const url = (description) => ({ type: "string", description });
export const INPUT_SCHEMAS = {
  check_ai_readiness: { type: "object", properties: { url: url("The website URL to check (e.g. 'example.com' or 'https://example.com/page').") }, required: ["url"] },
  validate_schema: { type: "object", properties: { url: url("The URL to validate structured data on.") }, required: ["url"] },
  validate_robots: { type: "object", properties: { url: url("URL of the site whose /robots.txt should be fetched and audited."), text: { type: "string", description: "Raw robots.txt text to audit directly (alternative to url)." } } },
  check_content_parity: { type: "object", properties: { url: url("The URL to check parity on.") }, required: ["url"] },
  generate_llms_txt: { type: "object", properties: { url: url("The website to generate llms.txt for.") }, required: ["url"] },
  generate_robots_txt: { type: "object", properties: { url: url("The website to generate a robots.txt for."), preset: { type: "string", enum: ["allow-all", "search-only", "recommended", "block-all"], default: "recommended", description: "The AI-crawler policy preset to apply." } }, required: ["url"] },
  generate_schema: { type: "object", properties: { url: url("The website to generate schema for.") }, required: ["url"] },
  get_monitor_trend: { type: "object", properties: { project: { type: "string", description: "Brand name or project id to detail. Omit to list all monitored brands." } } },
  check_permission: {
    type: "object",
    properties: {
      url: url("The page to ask about (e.g. 'https://example.com/article')."),
      purpose: { type: "string", enum: ["search", "answer", "train", "agent"], description: "What you intend to do with the page: search, answer (including RAG), train, or agent." },
      agent: { type: "string", pattern: "^[A-Za-z0-9_.-]{1,64}$", description: "Optional crawler token to ask about by name (e.g. 'GPTBot', 'ClaudeBot'). By default the purpose's whole crawler class is read." },
      observe: { type: "boolean", description: "Default true: request the page once as a representative crawler and report what the server did. false reads the published signals only." },
    },
    required: ["url", "purpose"],
  },
};

// --- read the zip (local headers are enough: mcpb pack writes no data descriptors)
function readZip(buf) {
  const entries = [];
  let i = 0;
  while (i + 30 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8);
    const compressed = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString("utf8");
    const start = i + 30 + nameLen + extraLen;
    const raw = buf.subarray(start, start + compressed);
    const data = method === 8 ? inflateRawSync(raw) : method === 0 ? Buffer.from(raw) : null;
    if (data === null) throw new Error(`${name}: unsupported compression method ${method}`);
    entries.push({ name, data });
    i = start + compressed;
  }
  if (!entries.length) throw new Error("not a zip, or no entries");
  return entries;
}

// --- write a stored zip ------------------------------------------------------
function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}
function writeZip(entries) {
  const { time, date } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12); central.writeUInt16LE(date, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralStart = offset;
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(centralStart, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

export function writeSmitheryCopy(input) {
  const output = input.replace(/\.mcpb$/, "-smithery.mcpb");
  const entries = readZip(readFileSync(input));
  const manifestEntry = entries.find((e) => e.name === "manifest.json");
  if (!manifestEntry) throw new Error("manifest.json not found at the archive root");
  const manifest = JSON.parse(manifestEntry.data.toString("utf8"));
  let added = 0;
  for (const tool of manifest.tools || []) {
    const schema = INPUT_SCHEMAS[tool.name];
    if (!schema) throw new Error(`no input schema for tool ${tool.name}; add it to INPUT_SCHEMAS`);
    tool.inputSchema = schema;
    added++;
  }
  manifestEntry.data = Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8");
  writeFileSync(output, writeZip(entries));
  console.log(`${output}: ${entries.length} files, ${added} tools with input schemas, ${Math.round(readFileSync(output).length / 1024)} KB stored`);
  return output;
}

// Run only when called directly; scripts/smoke.mjs imports INPUT_SCHEMAS to
// check that every tool the server lists has a schema here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2];
  if (!input || !input.endsWith(".mcpb")) {
    console.error("usage: node scripts/smithery-bundle.mjs dist/<bundle>.mcpb");
    process.exit(1);
  }
  writeSmitheryCopy(input);
}
