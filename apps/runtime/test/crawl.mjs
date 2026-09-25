// Screen-by-screen crawler used for v732 parity. Logs in, visits every navigation view and
// records visible headings, controls and text. Usage:
//   node test/crawl.mjs <url> <out.json> [--user u --pass p] [--license <token>]
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const [url, out] = process.argv.slice(2);
const flag = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const executablePath = process.env.AIP_CHROMIUM ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? undefined : undefined);

const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: executablePath || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch({ args: ["--no-sandbox"] }));
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const license = flag("license");
if (license) await page.addInitScript((t) => localStorage.setItem("sx_aip_license", t), license);
await page.goto(url, { timeout: 240000, waitUntil: "load" });
await page.fill("#loginUser", flag("user", "admin"));
await page.fill("#loginPass", flag("pass", "sustantix2026"));
await page.click("#loginBtn");
await page.waitForFunction(() => document.getElementById("loginScreen")?.style.display === "none", null, { timeout: 120000 });
await page.waitForTimeout(4000);
const views = await page.$$eval("#sidebar .nav-item[data-view]", (n) => n.map((x) => ({ v: x.dataset.view, t: x.innerText.trim() })));
const result = [];
for (const v of views) {
  await page.evaluate((v) => {
    document.querySelectorAll("#sidebar .x-nav-body").forEach((b) => (b.style.display = "block"));
    document.querySelector(`#sidebar .nav-item[data-view="${v}"]`).click();
  }, v.v);
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => {
    const act = [...document.querySelectorAll("#main .view")].filter((x) => x.offsetParent !== null || getComputedStyle(x).display !== "none");
    const el = act[0] || document.getElementById("main");
    const tabs = [...el.querySelectorAll("button")].filter((b) => b.offsetParent && b.innerText.trim().length < 50).map((b) => b.innerText.trim()).filter(Boolean);
    const heads = [...el.querySelectorAll("h1,h2,h3,h4,.aip520-parent-heading")].filter((h) => h.offsetParent).map((h) => h.innerText.trim()).filter(Boolean);
    return { id: el.id, tabs: [...new Set(tabs)].slice(0, 60), heads: heads.slice(0, 60), text: el.innerText.slice(0, 4000) };
  });
  result.push({ ...v, ...info });
}
const topbar = await page.evaluate(() => document.querySelector("#topbar")?.innerText ?? "");
writeFileSync(out, JSON.stringify({ views: result, topbar, errors }, null, 1));
console.log(`${result.length} views crawled · ${errors.length} page errors → ${out}`);
await browser.close();
