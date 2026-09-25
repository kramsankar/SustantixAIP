// End-to-end parity + license-gate verification for the AIP runtime.
//  1. builds the standalone target with an ephemeral trusted key (test-only)
//  2. crawls all 27 screens and requires exact equality with reference/v732-screen-crawl.json
//  3. proves the license gate: no key, expired trial, module-restricted license
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { generateSigningKey, issueLicense } from "@sustantix/license/issuer";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const tmp = mkdtempSync(join(tmpdir(), "aip-parity-"));
const { signing, publicJwk } = generateSigningKey("sx-parity");
writeFileSync(join(tmp, "keys.json"), JSON.stringify([publicJwk]));
const env = { ...process.env, AIP_EXTRA_TRUSTED_KEYS: join(tmp, "keys.json") };
execFileSync("node", ["build.mjs"], { cwd: join(root, "packages/host-bridge"), env, stdio: "inherit" });
execFileSync("node", ["build.mjs", "--target", "standalone", "--out", "dist/parity"], { cwd: join(here, ".."), env, stdio: "inherit" });

const port = 4300 + Math.floor(Math.random() * 500);
const server = spawn("node", ["serve.mjs", "dist/parity", String(port)], { cwd: join(here, ".."), stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const url = `http://localhost:${port}/`;
const now = Math.floor(Date.now() / 1000);
const cust = { id: "QA", name: "Parity QA" };
const lic = (extra) => issueLicense(signing, { customer: cust, platform: "vercel", bind: { domains: ["localhost"] }, ...extra }).token;
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "✓" : "✗"} ${what}`); if (!ok) failures++; };

try {
  // 2 · screen parity
  const full = lic({ edition: "enterprise", validDays: 30 });
  execFileSync("node", [join(here, "crawl.mjs"), url, join(tmp, "crawl.json"), "--license", full], { stdio: "inherit" });
  const ref = Object.fromEntries(JSON.parse(readFileSync(join(root, "reference/v732-screen-crawl.json"), "utf8")).views.map((v) => [v.v, v]));
  const got = JSON.parse(readFileSync(join(tmp, "crawl.json"), "utf8")).views;
  check(got.length === Object.keys(ref).length, `all ${Object.keys(ref).length} screens reachable`);
  for (const v of got) {
    const r = ref[v.v];
    check(!!r && r.text === v.text && JSON.stringify(r.tabs) === JSON.stringify(v.tabs) && JSON.stringify(r.heads) === JSON.stringify(v.heads), `screen parity · ${v.t}`);
  }

  // 3 · license gate
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] }).catch(() => chromium.launch());
  const open = async (token) => {
    const page = await browser.newPage();
    if (token) await page.addInitScript((t) => localStorage.setItem("sx_aip_license", t), token);
    await page.goto(url, { timeout: 240000 });
    await page.waitForTimeout(1500);
    return page;
  };
  let page = await open(null);
  check(await page.isVisible("#sxLicensePanel"), "no license → sign-in replaced by license panel");
  check(!(await page.isVisible("#loginBtn")), "no license → sign-in button hidden");
  check((await page.evaluate(() => window.AIPHost.signIn("admin", "x"))) === false, "no license → programmatic sign-in refused");
  await page.close();

  const expired = issueLicense(signing, { customer: cust, edition: "trial", platform: "vercel", bind: { domains: ["localhost"] }, trialDays: 7, startsAt: now - 10 * 86400 }, now - 10 * 86400).token;
  page = await open(expired);
  check((await page.textContent("#sxLicensePanel"))?.includes("Subscription ended") === true, "expired trial → locked with 'Subscription ended'");
  await page.close();

  const trial = lic({ edition: "trial", trialDays: 14, modules: ["portfolio"] });
  page = await open(trial);
  await page.fill("#loginUser", "qa"); await page.fill("#loginPass", "x"); await page.click("#loginBtn");
  await page.waitForFunction(() => document.getElementById("loginScreen")?.style.display === "none", null, { timeout: 120000 });
  const badge = await page.textContent("#sxLicenseBadge");
  check(/Trial · 1[34] days left/.test(badge ?? ""), `trial badge shows remaining days (${badge})`);
  check(await page.isHidden('#sidebar .nav-item[data-view="workorderintelligence"]'), "module gate hides unlicensed Maintenance views");
  check(await page.isHidden('#sidebar .nav-item[data-view="sustainabilityintelligence"]'), "module gate hides unlicensed Sustainability views");
  await page.close();

  const foreign = issueLicense(signing, { customer: cust, edition: "enterprise", platform: "vercel", bind: { domains: ["aip.customer.example"] }, validDays: 30 }).token;
  page = await open(foreign);
  check(await page.isVisible("#sxLicensePanel"), "license bound to another domain → locked");
  await page.close();
  await browser.close();
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} check(s) FAILED` : "\nparity + license gate: all checks passed");
process.exit(failures ? 1 : 0);
