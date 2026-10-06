// Finds what blocks the page on one screen: per data mode (embedded, governed, synthetic) and with screen grids on or
// off, signs in, opens the screen and records the longest main-thread task and the total blocked time.
//   node test/freeze-probe.mjs [view=sustainabilityintelligence]
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { generateSigningKey, issueLicense } from "@sustantix/license/issuer";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const view = process.argv[2] ?? "sustainabilityintelligence";
const tmp = mkdtempSync(join(tmpdir(), "aip-freeze-"));
const { signing, publicJwk } = generateSigningKey("sx-freeze");
writeFileSync(join(tmp, "keys.json"), JSON.stringify([publicJwk]));
const env = { ...process.env, AIP_EXTRA_TRUSTED_KEYS: join(tmp, "keys.json") };
execFileSync("node", ["build.mjs"], { cwd: join(root, "packages/host-bridge"), env, stdio: "ignore" });
execFileSync("node", ["build.mjs"], { cwd: join(root, "packages/grid"), stdio: "ignore" });
execFileSync("node", ["build.mjs", "--target", "standalone", "--out", "dist/freeze"], { cwd: join(here, ".."), env, stdio: "ignore" });
const workbook = join(tmp, "governed.json");
execFileSync("pnpm", ["--silent", "--filter", "@sustantix/schema", "governed:json", workbook], { cwd: root, stdio: "ignore" });
const body = readFileSync(workbook);
const port = 5950 + Math.floor(Math.random() * 40);
const server = spawn("node", ["serve.mjs", "dist/freeze", String(port)], { cwd: join(here, ".."), stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const license = issueLicense(signing, { customer: { id: "QA", name: "Freeze" }, platform: "vercel", bind: { domains: ["localhost"] }, edition: "enterprise", validDays: 30 }, Math.floor(Date.now() / 1000)).token;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] }).catch(() => chromium.launch({ args: ["--no-sandbox"] }));

async function probe(mode, grids) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript((t) => localStorage.setItem("sx_aip_license", t), license);
  if (grids) await page.addInitScript(() => localStorage.setItem("sx_aip_grid_screens", "all"));
  if (mode === "synthetic") await page.addInitScript(() => { if (!sessionStorage.getItem("probed")) { sessionStorage.setItem("probed", "1"); localStorage.setItem("eam_boot_mode", "synthetic"); } });
  if (mode === "governed") {
    await page.route("**/__aip_governed.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
    await page.addInitScript(() => { window.__AIP_GOVERNED__ = { load: () => fetch("/__aip_governed.json").then((r) => r.json()), save: async () => undefined }; });
  }
  await page.goto(`http://localhost:${port}/`, { timeout: 300000, waitUntil: "load" });
  await page.fill("#loginUser", "admin");
  await page.fill("#loginPass", "sustantix2026");
  await page.click("#loginBtn");
  await page.waitForFunction(() => document.getElementById("loginScreen")?.style.display === "none", null, { timeout: 300000 });
  if (mode === "governed") await page.waitForFunction(() => window.__AIP_GOVERNED_ACTIVE__ === true, null, { timeout: 300000 });
  await page.waitForTimeout(8000);
  const badge = await page.evaluate(() => document.querySelector("#topbar")?.innerText.match(/Synthetic data|Excel data|Uploaded data|Governed data/)?.[0] ?? "?");
  await page.evaluate(() => {
    window.__longTasks = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longTasks.push(e.duration))).observe({ type: "longtask", buffered: false });
  });
  const t0 = Date.now();
  await page.evaluate((v) => {
    document.querySelectorAll("#sidebar .x-nav-body").forEach((b) => (b.style.display = "block"));
    document.querySelector(`#sidebar .nav-item[data-view="${v}"]`).click();
  }, view);
  await page.waitForTimeout(15000);
  const tasks = await page.evaluate(() => window.__longTasks);
  await page.close();
  return { mode: mode + (grids ? " + grids" : ""), badge, longestTaskMs: Math.round(Math.max(0, ...tasks)), blockedMs: Math.round(tasks.reduce((a, b) => a + b, 0)), tasks: tasks.length, wallMs: Date.now() - t0 };
}

try {
  const out = [];
  for (const [m, g] of [["governed", true], ["synthetic", true], ["synthetic", false], ["embedded", true]]) out.push(await probe(m, g));
  console.table(out);
} finally {
  await browser.close();
  server.kill();
}
