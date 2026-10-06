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
  let hot;
  if (process.env.AIP_WATCH) {
    // Which nodes keep being added and removed once the screen has settled: names the parties to a redraw loop.
    await page.waitForTimeout(3000);
    hot = await page.evaluate(async () => {
      const tally = new Map();
      const name = (n, parent) => `${n.nodeName.toLowerCase()}${n.id ? "#" + n.id : ""}${n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".") : ""} in ${parent.closest?.(".view")?.id ?? parent.nodeName}`;
      const mo = new MutationObserver((list) => {
        for (const m of list) {
          for (const n of m.addedNodes) if (n.nodeType === 1) tally.set("+ " + name(n, m.target), (tally.get("+ " + name(n, m.target)) ?? 0) + 1);
          for (const n of m.removedNodes) if (n.nodeType === 1) tally.set("- " + name(n, m.target), (tally.get("- " + name(n, m.target)) ?? 0) + 1);
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      await new Promise((r) => setTimeout(r, 5000));
      mo.disconnect();
      return [...tally].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, c]) => `${c}x ${k}`);
    });
    await page.waitForTimeout(7000);
  } else if (process.env.AIP_PROFILE) {
    // Self time by function over a window after the screen opens: names the code that keeps the page busy.
    await page.waitForTimeout(3000);
    const cdp = await page.context().newCDPSession(page);
    const sources = new Map();
    cdp.on("Debugger.scriptParsed", (e) => sources.set(e.scriptId, e));
    await cdp.send("Debugger.enable");
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.start");
    await page.waitForTimeout(6000);
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map();
    const dt = profile.timeDeltas;
    profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (dt[i + 1] ?? 0) / 1000));
    // Inline scripts have no URL: name each frame by the source text around it.
    const text = new Map();
    const where = async (f) => {
      if (!f.scriptId || f.scriptId === "0") return "";
      if (!text.has(f.scriptId)) text.set(f.scriptId, (await cdp.send("Debugger.getScriptSource", { scriptId: f.scriptId }).catch(() => ({ scriptSource: "" }))).scriptSource.split("\n"));
      const line = text.get(f.scriptId)[f.lineNumber] ?? "";
      return ` «${line.slice(Math.max(0, f.columnNumber - 30), f.columnNumber + 90).replace(/\s+/g, " ")}»`;
    };
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n);
    const byFn = new Map();
    for (const n of profile.nodes) {
      let f = n.callFrame;
      // Native DOM calls are charged to the script function that made them.
      let via = "";
      if (!f.url && f.lineNumber < 0 && parent.get(n.id)) via = ` <- ${parent.get(n.id).callFrame.functionName || "(anon)"}@${parent.get(n.id).callFrame.scriptId}:${parent.get(n.id).callFrame.lineNumber + 1}:${parent.get(n.id).callFrame.columnNumber}`;
      const k = `${f.functionName || "(anon)"}@${f.scriptId}:${f.lineNumber + 1}:${f.columnNumber}${via}`;
      const prev = byFn.get(k) ?? { ms: 0, f: via ? parent.get(n.id).callFrame : f };
      prev.ms += self.get(n.id) ?? 0;
      byFn.set(k, prev);
    }
    hot = [];
    for (const [k, v] of [...byFn].sort((a, b) => b[1].ms - a[1].ms).slice(0, 20)) hot.push(`${Math.round(v.ms)}ms ${k}${await where(v.f)}`);
    await page.waitForTimeout(6000);
  } else await page.waitForTimeout(15000);
  const tasks = await page.evaluate(() => window.__longTasks);
  await page.close();
  if (hot) console.log(`hot (${mode}${grids ? " + grids" : ""}):\n  ${hot.join("\n  ")}`);
  return { mode: mode + (grids ? " + grids" : ""), badge, longestTaskMs: Math.round(Math.max(0, ...tasks)), blockedMs: Math.round(tasks.reduce((a, b) => a + b, 0)), tasks: tasks.length, wallMs: Date.now() - t0 };
}

try {
  const out = [];
  const modes = process.env.AIP_MODES ? process.env.AIP_MODES.split(",").map((x) => [x.replace("+grids", ""), x.endsWith("+grids")]) : [["governed", true], ["synthetic", true], ["synthetic", false], ["embedded", true]];
  for (const [m, g] of modes) out.push(await probe(m, g));
  console.table(out);
} finally {
  await browser.close();
  server.kill();
}
