// End-to-end parity + license-gate verification for the AIP runtime.
//  1. builds the standalone target with an ephemeral trusted key (test-only)
//  2. crawls every screen (incl. the Operations Hub) and requires exact equality with reference/v915-screen-crawl.json
//  3. proves the license gate: no key, expired trial, module-restricted license
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { generateSigningKey, issueLicense } from "@sustantix/license/issuer";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const tmp = process.env.AIP_PARITY_OUT ?? mkdtempSync(join(tmpdir(), "aip-parity-"));
mkdirSync(tmp, { recursive: true });
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
// Prints where a screen diverges so CI logs are enough to root-cause a mismatch.
function explainDiff(r, v) {
  for (const f of ["text", "tabs", "heads"]) {
    const a = typeof r[f] === "string" ? r[f] : JSON.stringify(r[f]);
    const b = typeof v[f] === "string" ? v[f] : JSON.stringify(v[f]);
    if (a === b) continue;
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    const ctx = (s) => JSON.stringify(s.slice(Math.max(0, i - 120), i + 200));
    console.log(`    ${f} differs at ${i} (reference ${a.length} chars, got ${b.length})\n      reference: ${ctx(a)}\n      got:       ${ctx(b)}`);
  }
}
const check = (ok, what) => { console.log(`${ok ? "✓" : "✗"} ${what}`); if (!ok) failures++; };

try {
  // 2 · screen parity
  const full = lic({ edition: "enterprise", validDays: 30 });
  execFileSync("node", [join(here, "crawl.mjs"), url, join(tmp, "crawl.json"), "--license", full], { stdio: "inherit" });
  const ref = Object.fromEntries(JSON.parse(readFileSync(join(root, "reference/v915-screen-crawl.json"), "utf8")).views.map((v) => [v.v, v]));
  const got = JSON.parse(readFileSync(join(tmp, "crawl.json"), "utf8")).views;
  check(got.length === Object.keys(ref).length, `all ${Object.keys(ref).length} screens reachable`);
  for (const v of got) {
    const r = ref[v.v];
    const ok = !!r && r.text === v.text && JSON.stringify(r.tabs) === JSON.stringify(v.tabs) && JSON.stringify(r.heads) === JSON.stringify(v.heads);
    check(ok, `screen parity · ${v.t}`);
    if (!ok && r) explainDiff(r, v);
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
  check(/Trial · 14 days left/.test(badge ?? ""), `trial badge shows remaining days (${badge})`);
  if (await page.isVisible("#aipHomeSkip").catch(() => false)) await page.click("#aipHomeSkip");
  await page.waitForTimeout(1500);
  // Nav groups may be collapsed by the runtime, so judge each item by its own computed display.
  const gated = (view) => page.evaluate((v) => getComputedStyle(document.querySelector(`#sidebar .nav-item[data-view="${v}"]`)).display === "none", view);
  check(!(await gated("assetexplorer")), "licensed Portfolio views remain available");
  check(!(await gated("datamanagement")), "core views remain available");
  check(!(await gated("actionworkflow")), "Action & Workflow Management is part of core");
  check(await gated("workorderintelligence"), "module gate hides unlicensed Maintenance views");
  check(await gated("sustainabilityintelligence"), "module gate hides unlicensed Sustainability views");
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
