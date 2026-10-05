// Real-browser check of the Enterprise Grid workspace: the built bundle in Chromium against a mocked grid API.
//   node test/browser.mjs [--shots <dir>]
// Proves the workspace lists the catalogue, renders a virtualised grid, sorts, edits a cell and saves exactly one
// change set, opens a 6,000-row register in server mode, and logs no page errors.
import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "../dist");
const require = createRequire(join(here, "../../../apps/runtime/package.json"));
const xlsx = join(dirname(require.resolve("xlsx/package.json")), "dist", "xlsx.full.min.js");
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;

const files = { "/aip/grid/index.html": [join(dist, "index.html"), "text/html"], "/aip/grid/aip-grid.js": [join(dist, "aip-grid.js"), "text/javascript"], "/aip/vendor/xlsx.full.min.js": [xlsx, "text/javascript"] };
const server = createServer((req, res) => {
  const f = files[req.url.split("?")[0]];
  if (!f) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": f[1] }).end(readFileSync(f[0]));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const col = (field, label, kind, extra = {}) => ({ field, label, kind, editable: false, ...extra });
const woCols = [
  col("code", "Code", "text"),
  col("status", "Status", "ref", { ref: "status", scope: "work_order", editable: true }),
  col("priority", "Priority", "ref", { ref: "priority", editable: true }),
  col("site", "Site", "fk", { fk: "site", editable: true }),
  col("sla_hours", "SLA hours", "integer", { editable: true }),
  col("estimated_cost", "Estimated cost", "money", { editable: true }),
];
const grid = (id, title, screen, entity, columns, extra = {}) => ({ id, title, screen, source: { kind: "entity", name: entity }, relation: `aip.v_${entity}`, columns, key: "code", entity, writers: ["planner", "admin"], defaultSort: [{ field: "code", dir: "asc" }], groupBy: [], bulkEdit: ["status"], tree: null, canEdit: true, ...extra });
const catalogue = {
  role: "planner",
  grids: [
    grid("work-orders", "Work orders", "Work Order Intelligence", "work_order", woCols),
    grid("pv-modules", "PV module register", "New: PV Module Register", "pv_module", [col("code", "Code", "text"), col("segment", "Segment", "fk", { fk: "pv_population_segment" }), col("serial_number", "Serial number", "text")], { canEdit: false, bulkEdit: [] }),
  ],
};
const workOrders = Array.from({ length: 420 }, (_, i) => ({ code: `WO-${String(i + 1).padStart(4, "0")}`, status: ["OPEN", "IN_PROGRESS", "COMPLETED"][i % 3], priority: ["HIGH", "MEDIUM", "LOW"][i % 3], site: `SP-0${(i % 4) + 1}`, sla_hours: (i * 7) % 72, estimated_cost: `${(1000 + i * 13.5).toFixed(2)}`, currency: i % 9 ? "INR" : "USD", row_version: 1 }));
const modules = Array.from({ length: 6000 }, (_, i) => ({ code: `PVM-${String(i + 1).padStart(5, "0")}`, segment: `SEG-${(i % 12) + 1}`, serial_number: `SN${100000 + i}`, row_version: 1 }));
const changeSets = [];
const rowCalls = [];

// Same launch policy as the runtime's parity crawl: a pinned local Chromium when present, else Playwright's own.
const browser = await chromium
  .launch({ executablePath: process.env.AIP_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] })
  .catch(() => chromium.launch({ args: ["--no-sandbox"] }));
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.route("**/api/aip/**", async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname.replace("/api/aip", "");
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (path === "/grid") return json(catalogue);
  if (path === "/grid/options") return json({ options: [{ code: "OPEN", label: "Open" }, { code: "IN_PROGRESS", label: "In Progress" }] });
  if (/\/views$/.test(path)) return json({ views: [] });
  const m = /^\/grid\/([^/]+)\/rows$/.exec(path);
  if (m) {
    const q = route.request().postDataJSON();
    rowCalls.push({ grid: m[1], ...q });
    let rows = m[1] === "work-orders" ? workOrders : modules;
    const sort = q.sort?.[0];
    if (sort) rows = [...rows].sort((a, b) => (a[sort.field] < b[sort.field] ? -1 : a[sort.field] > b[sort.field] ? 1 : 0) * (sort.dir === "desc" ? -1 : 1));
    return json({ rows: rows.slice(q.offset, q.offset + q.limit), total: rows.length, offset: q.offset });
  }
  if (path === "/changes") {
    const req = route.request().postDataJSON();
    changeSets.push(req);
    for (const it of req.items) Object.assign(workOrders.find((w) => w.code === it.code), it.values, { row_version: 2 });
    return json({ id: req.id, items: req.items.map((i) => ({ entity: i.entity, op: i.op, code: i.code, rowVersion: 2 })), replayed: false });
  }
  return json({ error: "not_found" }, 404);
});

const check = (ok, what) => {
  if (!ok) throw new Error(`browser check failed: ${what}`);
  console.log(`  ✓ ${what}`);
};

try {
  await page.goto(`${base}/aip/grid/index.html`);
  await page.waitForSelector(".sxg-body [data-r='0'][data-c='0']");
  check((await page.locator(".sxg-ws-nav button").count()) === 2, "workspace lists the catalogue by screen");
  check((await page.locator(".sxg-body [data-r='0'][data-c='0']").textContent()) === "WO-0001", "first row renders");
  const rendered = await page.locator(".sxg-body .sxg-row").count();
  check(rendered > 15 && rendered < 80, `only rows in view are in the DOM (${rendered} of 420)`);
  check(rowCalls.length === 1, "a 420-row grid loads once and works in the browser");
  if (shots) {
    mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: join(shots, "grid-work-orders.png") });
  }

  await page.locator("[role=columnheader] button", { hasText: "SLA hours" }).click();
  await page.locator("[role=columnheader] button", { hasText: "SLA hours" }).click();
  check((await page.locator(".sxg-body [data-r='0'][data-c='4']").textContent()) === "71", "header clicks sort descending, in the browser");
  check(rowCalls.length === 1, "client-mode sorting makes no request");

  await page.locator(".sxg-body [data-r='0'][data-c='4']").dblclick();
  await page.locator(".sxg-editor").fill("24");
  await page.keyboard.press("Enter");
  await page.locator(".sxg-body [data-r='1'][data-c='5']").dblclick();
  await page.locator(".sxg-editor").fill("2,500.75");
  await page.keyboard.press("Enter");
  check((await page.locator(".sxg-dirty").count()) === 2, "edited cells are marked until saved");
  await page.getByRole("button", { name: "Save 2" }).click();
  await page.waitForFunction(() => document.querySelector(".sxg-status")?.textContent?.includes("saved"));
  check(changeSets.length === 1 && changeSets[0].items.length === 2, "one change set carries both edits");
  check(changeSets[0].items.every((i) => i.baseVersion === 1) && changeSets[0].items[1].values.estimated_cost === "2500.75", "each edit carries its row version; the amount stays an exact string");

  await page.locator(".sxg-ws-nav button", { hasText: "PV module register" }).click();
  await page.waitForSelector(".sxg-foot >> text=Sorted and filtered in the database");
  await page.waitForFunction(() => document.querySelector(".sxg-body [data-r='0'][data-c='0']")?.textContent === "PVM-00001");
  const scroll = page.locator("[role=grid]");
  await scroll.evaluate((el) => (el.scrollTop = 5000 * 32));
  await page.waitForFunction(() => [...document.querySelectorAll(".sxg-body [data-c='0']")].some((c) => c.textContent === "PVM-05001"));
  const pvCalls = rowCalls.filter((c) => c.grid === "pv-modules");
  check(pvCalls.every((c) => c.limit <= 1000) && pvCalls.some((c) => c.offset >= 4800), `6,000-row register pages from the database as it scrolls (${pvCalls.length} requests)`);
  check((await page.locator(".sxg-editor, [data-c='-1']").count()) === 0, "a read-only grid offers no editing");
  if (shots) await page.screenshot({ path: join(shots, "grid-pv-modules.png") });

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  console.log("grid browser check: PASS");
} finally {
  await browser.close();
  server.close();
}
