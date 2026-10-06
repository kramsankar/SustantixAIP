// Sign-in timing of the runtime, embedded and governed: where a user's wait goes.
//   node test/timing.mjs [--workbook-ms 5000]
// Measures, per mode, page load → sign-in ready, sign-in → workspace shown, and → the page settling (no DOM changes
// for 1.5 s). --workbook-ms delays the governed workbook response, as a server building it would.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { generateSigningKey, issueLicense } from "@sustantix/license/issuer";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const flag = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const delay = Number(flag("workbook-ms", "0"));
const tmp = mkdtempSync(join(tmpdir(), "aip-timing-"));
const { signing, publicJwk } = generateSigningKey("sx-timing");
writeFileSync(join(tmp, "keys.json"), JSON.stringify([publicJwk]));
const env = { ...process.env, AIP_EXTRA_TRUSTED_KEYS: join(tmp, "keys.json") };
execFileSync("node", ["build.mjs"], { cwd: join(root, "packages/host-bridge"), env, stdio: "ignore" });
execFileSync("node", ["build.mjs"], { cwd: join(root, "packages/grid"), stdio: "ignore" });
execFileSync("node", ["build.mjs", "--target", "standalone", "--out", "dist/timing"], { cwd: join(here, ".."), env, stdio: "ignore" });
const workbook = join(tmp, "governed.json");
execFileSync("pnpm", ["--silent", "--filter", "@sustantix/schema", "governed:json", workbook], { cwd: root, stdio: "ignore" });
const body = readFileSync(workbook);

const port = 5600 + Math.floor(Math.random() * 300);
const server = spawn("node", ["serve.mjs", "dist/timing", String(port)], { cwd: join(here, ".."), stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const now = Math.floor(Date.now() / 1000);
const license = issueLicense(signing, { customer: { id: "QA", name: "Timing" }, platform: "vercel", bind: { domains: ["localhost"] }, edition: "enterprise", validDays: 30 }, now).token;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] }).catch(() => chromium.launch({ args: ["--no-sandbox"] }));

async function run(mode, grids) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript((t) => localStorage.setItem("sx_aip_license", t), license);
  if (grids) await page.addInitScript(() => localStorage.setItem("sx_aip_grid_screens", "all"));
  if (mode === "governed") {
    await page.route("**/__aip_governed.json", async (route) => {
      await new Promise((r) => setTimeout(r, delay));
      await route.fulfill({ status: 200, contentType: "application/json", body });
    });
    await page.addInitScript(() => {
      window.__AIP_GOVERNED__ = { load: () => fetch("/__aip_governed.json").then((r) => r.json()), save: async () => undefined };
    });
  }
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/`, { timeout: 300000, waitUntil: "load" });
  await page.waitForSelector("#loginBtn:not([disabled])", { timeout: 300000 });
  const ready = Date.now() - t0;
  await page.fill("#loginUser", "admin");
  await page.fill("#loginPass", "sustantix2026");
  const t1 = Date.now();
  await page.click("#loginBtn");
  await page.waitForFunction(() => document.getElementById("loginScreen")?.style.display === "none", null, { timeout: 300000 });
  const shown = Date.now() - t1;
  if (mode === "governed") await page.waitForFunction(() => window.__AIP_GOVERNED_ACTIVE__ === true, null, { timeout: 300000 });
  const data = Date.now() - t1;
  await page.evaluate(() => new Promise((resolve) => {
    let timer;
    const obs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, 1500); });
    const done = () => { obs.disconnect(); resolve(); };
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    timer = setTimeout(done, 1500);
    setTimeout(done, 120000);
  }));
  const settled = Date.now() - t1 - 1500;
  await page.close();
  return { mode: mode + (grids ? " + screen grids" : ""), loadToSignInReadyMs: ready, signInToWorkspaceMs: shown, signInToDataMs: data, signInToSettledMs: settled };
}

try {
  const results = [];
  for (const [mode, grids] of [["embedded", false], ["governed", false], ["governed", true]]) results.push(await run(mode, grids));
  console.table(results);
  console.log(`workbook: ${(body.length / 1e6).toFixed(1)} MB JSON, served after ${delay} ms`);
} finally {
  await browser.close();
  server.kill();
}
