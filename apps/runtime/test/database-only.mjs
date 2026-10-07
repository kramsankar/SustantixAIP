// Database-only parity: the Vercel build ships no tenant data; after sign-in it loads the runtime catalogue (dataset
// layouts and sheets, exactly as the database serves them) and the governed workbook its layouts read, and only then
// runs the runtime. Screens read governed sheets where a dataset holds a copy of one, so they show the governed values;
// every screen is held to its own reviewed baseline:
//   node test/database-only.mjs            exact check against reference/v915-database-crawl.json
//   node test/database-only.mjs --rebase   writes that baseline and docs/parity/database-baseline.md (what differs from
//                                          the v915 reference, screen by screen, for review)
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyLicense } from "@sustantix/license";
import { generateSigningKey, issueLicense } from "@sustantix/license/issuer";

const here = dirname(fileURLToPath(import.meta.url));
const rebase = process.argv.includes("--rebase");
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
const served = { manifest: 0, chunks: 0, workbook: 0 };
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
    if (api === "/state") return send(204);
    if (api === "/workbook") {
      if (!signedIn) return send(401, { error: "unauthenticated", message: "sign in required" });
      // A governed deployment (as in production): the loader reads its sheets and the runtime overlays it at boot.
      served.workbook++;
      return send(200, readFileSync(join(fixture, "governed.json"), "utf8"), { "x-aip-governed": "1", "cache-control": "private, no-cache" });
    }
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
  const got = JSON.parse(readFileSync(out, "utf8"));
  check(served.manifest >= 1 && served.chunks >= 1 && served.workbook === 1, `data loaded from the host after sign-in (${served.manifest} manifest, ${served.chunks} chunk requests, ${served.workbook} governed workbook)`);
  check(got.views.length === reference.views.length, `all ${reference.views.length} screens reachable`);
  const same = (a, b) => a && b && a.text === b.text && JSON.stringify(a.tabs) === JSON.stringify(b.tabs) && JSON.stringify(a.heads) === JSON.stringify(b.heads);
  const excerpt = (a, b) => {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    const cut = (x) => x.slice(Math.max(0, i - 60), i + 140).replace(/\s+/g, " ").replace(/\|/g, "\\|");
    return { at: i, reference: cut(a), got: cut(b) };
  };
  if (rebase) {
    const ref = Object.fromEntries(reference.views.map((v) => [v.v, v]));
    const rows = got.views.map((v) => {
      if (same(ref[v.v], v)) return `| ${v.t} | unchanged | | |`;
      const e = excerpt(ref[v.v]?.text ?? "", v.text ?? "");
      return `| ${v.t} | **changed** | ${e.reference} | ${e.got} |`;
    });
    const changed = rows.filter((r) => r.includes("**changed**")).length;
    writeFileSync(join(root, "reference/v915-database-crawl.json"), JSON.stringify(got, null, 1));
    mkdirSync(join(root, "docs/parity"), { recursive: true });
    writeFileSync(
      join(root, "docs/parity/database-baseline.md"),
      [
        "# Database-only baseline (for review)",
        "",
        "Every screen of the Vercel build with all data read from the database: the runtime catalogue, and the governed sheets its datasets read (copies of governed sheets are not held twice). Screens show the governed values where those differ from the v915 workbook copies (corrected records, canonical labels, masters replacing stale copies, rows the governed data adds), the data source reads as the database, and Data Management offers no workbook upload. Each change below is reviewed before this baseline is accepted; from then on CI requires the database-only crawl to match it exactly.",
        "",
        `${changed} of ${got.views.length} screens differ from the v915 reference.`,
        "",
        "| Screen | Status | v915 reference (at first difference) | Database-only |",
        "|---|---|---|---|",
        ...rows,
        "",
      ].join("\n"),
    );
    console.log(`database-only baseline written: ${changed} of ${got.views.length} screens differ from the v915 reference`);
  } else {
    const base = JSON.parse(readFileSync(join(root, "reference/v915-database-crawl.json"), "utf8"));
    const want = Object.fromEntries(base.views.map((v) => [v.v, v]));
    for (const v of got.views) {
      const ok = same(want[v.v], v);
      check(ok, `database-only parity · ${v.t}`);
      if (!ok && want[v.v]) {
        const e = excerpt(want[v.v].text ?? "", v.text ?? "");
        console.log(`    at ${e.at}\n      baseline: ${e.reference}\n      got:      ${e.got}`);
      }
    }
  }
  writeFileSync(join(tmp, "served.json"), JSON.stringify(served));
} finally {
  server.close();
}
console.log(failures ? `\n${failures} database-only check(s) FAILED` : "\ndatabase-only parity: all checks passed");
process.exit(failures ? 1 : 0);
