// Serves ./dist for the Power Apps "local play" experience: the Power Apps player hosts the app
// from this origin and reads power.config.json, so both are served with player CORS.
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? 5173);
const dist = new URL("../dist/", import.meta.url).pathname;
const configPath = new URL("../power.config.json", import.meta.url).pathname;
if (!existsSync(configPath)) throw new Error("power.config.json missing — run `pac code init --displayName \"Sustantix AIP\"` first");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const allowed = (o) => /^https:\/\/([a-z0-9-]+\.)*(powerapps\.com|powerplatform\.com|powerapps\.us|appsplatform\.us|powerapps\.cn)$/i.test(o ?? "");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };

createServer((req, res) => {
  const origin = req.headers.origin;
  if (allowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
  }
  if (req.method === "OPTIONS") return void res.writeHead(204).end();
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/power.config.json") return void res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(config));
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  if (rel.startsWith("..")) return void res.writeHead(400).end();
  const file = join(dist, rel || "index.html");
  try {
    if (!statSync(file).isFile()) throw new Error();
  } catch {
    return void res.writeHead(404).end();
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  const local = `http://localhost:${port}/`;
  console.log(`Sustantix AIP local play:\n  https://apps.powerapps.com/play/e/${config.environmentId}/a/local?_localAppUrl=${encodeURIComponent(local)}&_localConnectionUrl=${encodeURIComponent(local + "power.config.json")}`);
});
