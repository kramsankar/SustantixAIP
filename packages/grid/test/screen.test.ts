// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { figure, mountScreenGrids, readTable, type ScreenGrids } from "../src/ui/screen.ts";
import { SustantixGrid } from "../src/ui/grid.ts";

const flush = () => new Promise((r) => setTimeout(r, 0));
let grids: ScreenGrids | null = null;
afterEach(() => {
  grids?.disconnect();
  grids = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

function screen(rows: Array<[string, string, string]>, opts: { id?: string; headers?: string[] } = {}) {
  const view = document.createElement("div");
  view.id = opts.id ?? "view-workorderintelligence";
  const wrap = document.createElement("div");
  wrap.className = "table-scroll";
  const t = document.createElement("table");
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  for (const h of opts.headers ?? ["", "WO ID", "Site / Asset", "Cost"]) {
    const th = document.createElement("th");
    th.textContent = h;
    hr.append(th);
  }
  head.append(hr);
  const body = document.createElement("tbody");
  t.append(head, body);
  for (const r of rows) addRow(body, r);
  wrap.append(t);
  view.append(wrap);
  document.body.append(view);
  return { view, wrap, t };
}

function addRow(body: Element, [id, site, cost]: [string, string, string]) {
  const tr = document.createElement("tr");
  const b = document.createElement("button");
  b.className = "open";
  b.setAttribute("onclick", `window.__opened='${id}'`);
  b.textContent = "Open";
  const first = document.createElement("td");
  first.append(b);
  tr.append(first);
  for (const v of [id, site, cost]) {
    const td = document.createElement("td");
    td.textContent = v;
    tr.append(td);
  }
  body.append(tr);
}

async function settle() {
  await vi.advanceTimersByTimeAsync(300);
  vi.useRealTimers();
  await flush();
  await flush();
}

describe("screen grids", () => {
  it("reads formatted figures as numbers for sorting", () => {
    expect(figure("₹ 1,204.5")).toBe("1204.5");
    expect(figure("98.2%")).toBe("98.2");
    expect(figure("12 MW")).toBe("12");
    expect(figure("WO-1001")).toBeNull();
    const { t } = screen([["WO-2", "SP-01", "₹ 900"], ["WO-1", "SP-02", "₹ 1,200"]]);
    const r = readTable(t);
    expect(r.columns.map((c) => [c.label, c.sortKey ?? null])).toEqual([["Select", null], ["WO ID", null], ["Site / Asset", null], ["Cost", "n3"]]);
    expect(r.rows[1]).toMatchObject({ c1: "WO-1", n3: "1200" });
  });

  it("replaces a switched-on screen's table with a grid, keeping the table in the page", async () => {
    vi.useFakeTimers();
    const { wrap, view } = screen([["WO-2", "SP-01", "₹ 900"], ["WO-1", "SP-02", "₹ 1,200"]]);
    grids = mountScreenGrids(document, { screens: ["workorderintelligence"] });
    await settle();
    const host = view.querySelector<HTMLElement>(".sxg-screen")!;
    expect(host.dataset.screenGrid).toBe("work-orders");
    expect(wrap.style.display).toBe("none");
    expect(wrap.isConnected).toBe(true);
    const ids = [...host.querySelectorAll('.sxg-body [data-c="1"][role=gridcell]')].map((c) => c.textContent);
    expect(ids).toEqual(["WO-2", "WO-1"]);
  });

  it("forwards a click on a copied button to the screen's own button", async () => {
    vi.useFakeTimers();
    const { view, t } = screen([["WO-7", "SP-01", "₹ 900"]]);
    let listened = "";
    t.querySelector("button")!.addEventListener("click", () => (listened = "WO-7"));
    grids = mountScreenGrids(document, { screens: "all" });
    await settle();
    const copy = view.querySelector<HTMLButtonElement>(".sxg-screen button.open")!;
    expect(copy.getAttribute("onclick")).toBeNull();
    copy.click();
    expect(listened).toBe("WO-7");
  });

  it("follows the screen when it redraws its table", async () => {
    vi.useFakeTimers();
    const { view, t } = screen([["WO-1", "SP-01", "1"]]);
    grids = mountScreenGrids(document, { screens: "all" });
    await settle();
    addRow(t.querySelector("tbody")!, ["WO-9", "SP-03", "2"]);
    grids.scan();
    await flush();
    await flush();
    const ids = [...view.querySelectorAll('.sxg-screen .sxg-body [data-c="1"][role=gridcell]')].map((c) => c.textContent);
    expect(ids).toEqual(["WO-1", "WO-9"]);
  });

  it("keeps scanning while the page never stops changing", async () => {
    vi.useFakeTimers();
    const { view } = screen([["WO-1", "SP-01", "1"]]);
    const ticker = document.createElement("span");
    document.body.append(ticker);
    grids = mountScreenGrids(document, { screens: "all" });
    // A clock that changes the page every 100 ms must not starve the scan.
    for (let i = 0; i < 6; i++) {
      ticker.setAttribute("class", `t${i}`);
      await vi.advanceTimersByTimeAsync(100);
    }
    vi.useRealTimers();
    await flush();
    expect(view.querySelectorAll(".sxg-screen")).toHaveLength(1);
  });

  it("re-reads only tables that changed, not every table on every page change", async () => {
    vi.useFakeTimers();
    const { t } = screen([["WO-1", "SP-01", "1"]]);
    grids = mountScreenGrids(document, { screens: "all" });
    await vi.advanceTimersByTimeAsync(300);
    const load = vi.spyOn(SustantixGrid.prototype, "load");
    // Reading a row's text is what makes a large table expensive to check; an unchanged table must not be read.
    const tr = t.querySelector("tbody tr")!;
    let proto = Object.getPrototypeOf(tr);
    while (!Object.getOwnPropertyDescriptor(proto, "textContent")) proto = Object.getPrototypeOf(proto);
    const own = Object.getOwnPropertyDescriptor(proto, "textContent")!;
    let reads = 0;
    Object.defineProperty(tr, "textContent", { configurable: true, get() { reads++; return own.get!.call(this); } });
    const ticker = document.createElement("span");
    document.body.append(ticker);
    for (let i = 0; i < 4; i++) {
      ticker.setAttribute("class", `t${i}`);
      grids.scan();
    }
    expect(reads).toBe(0);
    expect(load).not.toHaveBeenCalled();
    addRow(t.querySelector("tbody")!, ["WO-9", "SP-03", "2"]);
    grids.scan();
    expect(load).toHaveBeenCalledTimes(1);
    load.mockRestore();
  });

  it("leaves screens that are switched off, and tables it does not know, untouched", async () => {
    vi.useFakeTimers();
    screen([["WO-1", "SP-01", "1"]]);
    screen([["X", "Y", "Z"]], { id: "view-guardrails", headers: ["Something", "Else"] });
    grids = mountScreenGrids(document, { screens: ["guardrails"] });
    await settle();
    expect(document.querySelectorAll(".sxg-screen")).toHaveLength(0);
  });
});
