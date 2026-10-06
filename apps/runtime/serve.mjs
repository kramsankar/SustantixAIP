// Minimal static server for local QA and parity tests (not used in production hosting).
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] ?? "dist/standalone";
const port = Number(process.argv[3] ?? 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".css": "text/css" };
createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  if (rel.startsWith("..")) { res.writeHead(400).end(); return; }
  let file = join(root, rel || "index.html");
  try { if (statSync(file).isDirectory()) file = join(file, "index.html"); } catch { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
