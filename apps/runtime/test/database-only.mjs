// Database-only parity: the Vercel build ships no tenant data; after sign-in it loads every tenant dataset from the
// host (manifest + chunks, exactly as the database serves them) and only then runs the runtime. Every screen must
// match the v915 reference crawl, except the data-source label, which reads as the database.
//   node test/database-only.mjs
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyLicense } from "@sustantix/license";
import { generateSigningKey, issueLicense } from "@sustantix/license/issuer";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const tmp = process.env.AIP_PARITY_OUT ?? mkdtempSync(join(tmpdir(), "aip-dbonly-"));
mkdirSync(tmp, { recursive: true });
execFileSync("node", ["build.mjs"], { cwd: join(root, "packages/host-bridge"), stdio: "inherit" });
execFileSync("node", ["build.mjs"], { cwd: join(root, "packages/grid"), stdio: "inherit" });
const dist = join(here, "..", "dist/database-only");
execFileSync("node", ["build.mjs", "--target", "vercel", "--out", "dist/database-only"], { cwd: join(here, ".."), stdio: "inherit" });
const fixture = join(tmp, "datasets");
execFileSync("pnpm", ["--silent", "--filter", "@sustantix/schema", "datasets:fixture", fixture], { cwd: root, stdio: "inherit" });

// The build carries product content only: no tenant dataset may be in it.
const classes = JSON.parse(readFileSync(join(here, "..", "dataset-classes.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(here, "..", "src/manifest.json"), "utf8"));
const html = readFileSync(join(dist, "index.html"), "utf8");
const leaked = Object.keys(manifest.datasets).filter((id) => !(id in classes.product) && (html.includes(`data/${id}.js`) || existsFile(join(dist, "data", `${id}.js`))));
function existsFile(f) {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
}

const reference = JSON.parse(readFileSync(join(root, "reference/v915-screen-crawl.json"), "utf8"));
const capturedAt = Math.floor(Date.parse(reference.capturedAt) / 1000);
const { signing, publicJwk } = generateSigningKey("sx-dbonly");
const token = issueLicense(signing, { customer: { id: "QA", name: "Database-only QA" }, platform: "vercel", bind: { domains: ["localhost"] }, edition: "enterprise", validDays: 30 }, capturedAt).token;

// A stand-in for the Vercel host: the static build, plus the API calls the bridge makes.
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".css": "text/css" };
const served = { manifest: 0, chunks: 0 };
let signedIn = false;
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...headers });
    res.end(body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body));
  };
  if (url.pathname.startsWith("/api/aip/")) {
    const api = url.pathname.slice("/api/aip".length);
    if (api === "/license") {
      const { status } = await verifyLicense(token, { trustedKeys: [publicJwk], environment: { platform: "vercel", hostname: "localhost" }, now: capturedAt + 3600, clock: null });
      return send(200, status);
    }
    if (api === "/time") return send(200, { now: capturedAt + 3600 });
    if (api === "/session") return send(204);
    if (api === "/sign-in") {
      signedIn = true;
      return send(200, { ok: true });
    }
    if (api === "/ui") return send(200, { gridScreens: "" });
    if (api === "/state" || api === "/workbook") return send(204);
    if (api === "/datasets" || api === "/datasets/chunk") {
      if (!signedIn) return send(401, { error: "unauthenticated", message: "sign in required" });
      if (api === "/datasets") {
        served.manifest++;
        return send(200, readFileSync(join(fixture, "manifest.json"), "utf8"));
      }
      served.chunks++;
      return send(200, readFileSync(join(fixture, `chunk-${Number(url.searchParams.get("c"))}.json`), "utf8"), { "cache-control": "private, max-age=31536000, immutable" });
    }
    return send(404, { error: "not_found", message: api });
  }
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  if (rel.startsWith("..")) return send(400);
  let file = join(dist, rel || "index.html");
  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html");
  } catch {
    return send(404, "not found");
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
});
const port = 5600 + Math.floor(Math.random() * 300);
await new Promise((r) => server.listen(port, r));

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures++;
};
check(leaked.length === 0, `the build ships no tenant dataset (${Object.keys(classes.product).length} product datasets only)${leaked.length ? `: ${leaked.join(", ")}` : ""}`);

// The data-source label is the one intended difference: the database instead of the bundled workbook.
const LABELS = [
  ["Excel data", "Database"],
  ["the bundled Excel workbook", "your organisation's database"],
];
const asReference = (s) => LABELS.reduce((t, [ref, db]) => t.split(db).join(ref), s);
if (process.env.AIP_SERVE_ONLY) {
  // Debugging: keep the stand-in host running for a browser.
  console.log(`serving http://localhost:${port}/`);
  await new Promise(() => undefined);
}
try {
  const out = join(tmp, "crawl.json");
  // Asynchronously: the stand-in host runs in this process and must keep answering while the crawler works.
  const code = await new Promise((resolve) => spawn("node", [join(here, "crawl.mjs"), `http://localhost:${port}/`, out, "--license", token, "--clock", reference.capturedAt], { stdio: "inherit" }).on("exit", resolve));
  if (code !== 0) throw new Error(`crawl exited with ${code}`);
  const ref = Object.fromEntries(reference.views.map((v) => [v.v, v]));
  const got = JSON.parse(readFileSync(out, "utf8")).views;
  check(served.manifest >= 1 && served.chunks >= 1, `data loaded from the host after sign-in (${served.manifest} manifest, ${served.chunks} chunk requests)`);
  check(got.length === Object.keys(ref).length, `all ${Object.keys(ref).length} screens reachable`);
  // Data Management keeps its loaded-data summary and data dictionary; the workbook upload, import, worksheet and
  // validation panels (and "Restore demo data") are withdrawn, so the reference is compared without them.
  const WITHDRAWN_HEADS = ["Upload Excel Workbook", "Import & Commit", "Detected worksheets", "Validation and preview"];
  const WITHDRAWN_TABS = ["Choose Excel file", "Select all worksheets", "Clear selection", "Validate & Commit", "Download JSON backup", "Restore demo data"];
  const dm = ref.datamanagement;
  if (dm) {
    const cut = dm.text.indexOf("Loaded Data Summary");
    ref.datamanagement = { ...dm, text: dm.text.slice(0, dm.text.indexOf("\n") + 1) + dm.text.slice(cut), heads: dm.heads.filter((h) => !WITHDRAWN_HEADS.includes(h)), tabs: dm.tabs.filter((t) => !WITHDRAWN_TABS.includes(t)) };
  }
  for (const v of got) {
    const r = ref[v.v];
    const text = asReference(v.text ?? "");
    const ok = !!r && r.text === text && JSON.stringify(r.tabs) === JSON.stringify(v.tabs) && JSON.stringify(r.heads) === JSON.stringify(v.heads);
    check(ok, `screen parity · ${v.t}`);
    if (!ok && r) {
      let i = 0;
      while (i < r.text.length && r.text[i] === text[i]) i++;
      console.log(`    text differs at ${i}\n      reference: ${JSON.stringify(r.text.slice(Math.max(0, i - 120), i + 200))}\n      got:       ${JSON.stringify(text.slice(Math.max(0, i - 120), i + 200))}`);
    }
  }
  writeFileSync(join(tmp, "served.json"), JSON.stringify(served));
} finally {
  server.close();
}
console.log(failures ? `\n${failures} database-only check(s) FAILED` : "\ndatabase-only parity: all checks passed");
process.exit(failures ? 1 : 0);
