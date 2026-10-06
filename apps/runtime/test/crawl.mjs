// Screen-by-screen crawler used for reference parity. Logs in, visits every navigation view and
// records visible headings, controls and text. Usage:
//   node test/crawl.mjs <url> <out.json> [--user u --pass p] [--license <token>] [--clock <iso-instant>] [--governed <workbook.json>]
// --clock starts the browser clock at that instant (time then flows normally). Screens print dates
// relative to "today", so a reference crawl is only reproducible at the instant it was captured.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const [url, out] = process.argv.slice(2);
const flag = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const executablePath = process.env.AIP_CHROMIUM ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? undefined : undefined);

const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: executablePath || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch({ args: ["--no-sandbox"] }));
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const clock = flag("clock");
if (clock) {
  await page.clock.install({ time: new Date(clock) });
  await page.clock.resume();
}
// Governed mode: the runtime boots on a tenant's governed workbook (the host seam window.__AIP_GOVERNED__).
const governed = flag("governed");
if (governed) {
  const body = readFileSync(governed);
  await page.route("**/__aip_governed.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
  await page.addInitScript(() => {
    window.__AIP_GOVERNED__ = {
      load: () => fetch("/__aip_governed.json").then((r) => r.json()),
      // Phase 4: a save while governed data is active must reach the host (which writes it as a governed change).
      save: async (state) => { (window.__AIP_GOVERNED_SAVES__ ??= []).push(state); },
    };
  });
}
// Screen grids (phase 4): the host switch a standalone build reads, set before the runtime boots.
const gridScreens = flag("grid-screens");
if (gridScreens) await page.addInitScript((v) => localStorage.setItem("sx_aip_grid_screens", v), gridScreens);
const license = flag("license");
if (license) await page.addInitScript((t) => localStorage.setItem("sx_aip_license", t), license);
await page.goto(url, { timeout: 240000, waitUntil: "load" });
await page.fill("#loginUser", flag("user", "admin"));
await page.fill("#loginPass", flag("pass", "sustantix2026"));
await page.click("#loginBtn");
await page.waitForFunction(() => document.getElementById("loginScreen")?.style.display === "none", null, { timeout: 120000 });
await page.waitForTimeout(4000);
// v9xx opens on the Operations Hub landing layer; record it, then enter the workspace.
const result = [];
// Screens keep decorating for several seconds after activation (v915 decorators run on a
// debounce after later mutations), so snapshot only once the page has been quiet for QUIET_MS (capped at 30 s).
const QUIET_MS = Number(process.env.AIP_CRAWL_QUIET_MS ?? 4000);
async function settle() {
  await page.evaluate((quiet) => new Promise((resolve) => {
    let timer;
    const done = () => { obs.disconnect(); clearTimeout(cap); resolve(); };
    const obs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, quiet); });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    timer = setTimeout(done, quiet);
    const cap = setTimeout(done, 30000);
  }), QUIET_MS);
}
if (await page.isVisible("#aipHomeOverlay").catch(() => false)) {
  await settle();
  const hub = await page.evaluate(() => {
    const el = document.getElementById("aipHomeOverlay");
    const tabs = [...el.querySelectorAll("button")].filter((b) => b.offsetParent && b.innerText.trim().length < 50).map((b) => b.innerText.trim()).filter(Boolean);
    const heads = [...el.querySelectorAll("h1,h2,h3,h4")].filter((h) => h.offsetParent).map((h) => h.innerText.trim()).filter(Boolean);
    return { id: el.id, tabs: [...new Set(tabs)].slice(0, 60), heads: heads.slice(0, 60), text: el.innerText.slice(0, 4000) };
  });
  result.push({ v: "operationshub", t: "Operations Hub", ...hub });
  await page.click("#aipHomeSkip");
  await settle();
}
const views = await page.$$eval("#sidebar .nav-item[data-view]", (n) => n.map((x) => ({ v: x.dataset.view, t: x.innerText.trim() })));
for (const v of views) {
  await page.evaluate((v) => {
    document.querySelectorAll("#sidebar .x-nav-body").forEach((b) => (b.style.display = "block"));
    document.querySelector(`#sidebar .nav-item[data-view="${v}"]`).click();
  }, v.v);
  await settle();
  if (gridScreens) {
    // Screens can redraw a table late; scan now and let the grids settle, so the snapshot never races a redraw.
    await page.evaluate(() => window.__AIP_SCREEN_GRIDS__?.scan());
    await settle();
  }
  const info = await page.evaluate(() => {
    const act = [...document.querySelectorAll("#main .view")].filter((x) => x.offsetParent !== null || getComputedStyle(x).display !== "none");
    const el = act[0] || document.getElementById("main");
    const tabs = [...el.querySelectorAll("button")].filter((b) => b.offsetParent && b.innerText.trim().length < 50).map((b) => b.innerText.trim()).filter(Boolean);
    const heads = [...el.querySelectorAll("h1,h2,h3,h4,.aip520-parent-heading")].filter((h) => h.offsetParent).map((h) => h.innerText.trim()).filter(Boolean);
    return { id: el.id, tabs: [...new Set(tabs)].slice(0, 60), heads: heads.slice(0, 60), text: el.innerText.slice(0, 4000), grids: el.querySelectorAll(".sxg-screen").length };
  });
  if (!gridScreens) delete info.grids;
  result.push({ ...v, ...info });
}
const topbar = await page.evaluate(() => document.querySelector("#topbar")?.innerText ?? "");
// Governed mode: an edit to the governed data, saved by the runtime, arrives at the host with the edit in it.
const governedSave = governed
  ? await page.evaluate(async () => {
      const wo = APM_IMPORTED_DATA["Work Orders"]?.[0];
      if (!wo) return { reached: false };
      const before = wo.Status;
      wo.Status = "__crawl_probe__";
      await saveEamState();
      const saves = window.__AIP_GOVERNED_SAVES__ ?? [];
      const reached = saves.length === 1 && saves[0].data["Work Orders"][0].Status === "__crawl_probe__";
      wo.Status = before;
      return { reached };
    })
  : undefined;
writeFileSync(out, JSON.stringify({ capturedAt: clock ? new Date(clock).toISOString() : new Date().toISOString(), views: result, topbar, errors, ...(governedSave ? { governedSave } : {}) }, null, 1));
console.log(`${result.length} views crawled · ${errors.length} page errors → ${out}`);
await browser.close();
