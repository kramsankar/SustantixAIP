// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { GridApiError } from "../src/ui/api.ts";
import { SustantixGrid } from "../src/ui/grid.ts";
import { button, cells, columns, def, FakeApi, flush, mount, sample, type Row } from "./helpers.ts";

beforeEach(() => {
  document.body.replaceChildren();
});

describe("Sustantix Enterprise Grid", () => {
  it("loads a small grid once, renders only the rows in view, and totals money per currency", async () => {
    const api = new FakeApi(sample(300));
    const g = await mount(api);
    expect(api.rowsCalls).toHaveLength(1);
    const shown = cells(g, 0);
    expect(shown[0]).toBe("WO-0001");
    expect(shown.length).toBeGreaterThan(10);
    expect(shown.length).toBeLessThan(80);
    expect(g.el.querySelector("[role=grid]")!.getAttribute("aria-rowcount")).toBe("301");
    const foot = g.el.querySelector(".sxg-foot")!.textContent!;
    expect(foot).toContain("300");
    expect(foot).toMatch(/INR\s?[\d,]+\.\d{2} \+ USD\s?[\d,]+\.\d{2}/);
  });

  it("sorts on a header click in the browser, with no new request", async () => {
    const api = new FakeApi(sample(30));
    const g = await mount(api);
    const header = [...g.el.querySelectorAll<HTMLElement>("[role=columnheader]")].find((h) => h.textContent?.startsWith("SLA hours"))!;
    header.querySelector("button")!.click();
    header.querySelector("button")?.click();
    await flush();
    const h = [...g.el.querySelectorAll<HTMLElement>("[role=columnheader]")].find((x) => x.textContent?.startsWith("SLA hours"))!;
    expect(h.getAttribute("aria-sort")).toBe("descending");
    expect(Number(cells(g, 2)[0])).toBe(49);
    expect(api.rowsCalls).toHaveLength(1);
  });

  it("pages, sorts and filters large grids in the database", async () => {
    const api = new FakeApi(sample(1200));
    const g = await mount(api, {}, { clientRowsMax: 500 });
    expect(g.el.querySelector(".sxg-foot")!.textContent).toContain("Sorted and filtered in the database");
    const before = api.rowsCalls.length;
    const header = [...g.el.querySelectorAll<HTMLElement>("[role=columnheader]")].find((h) => h.textContent?.startsWith("Code"))!;
    header.querySelector("button")!.click(); // asc → desc
    await flush();
    await flush();
    const last = api.rowsCalls.at(-1)!;
    expect(api.rowsCalls.length).toBeGreaterThan(before);
    expect(last).toMatchObject({ offset: 0, limit: 200, sort: [{ field: "code", dir: "desc" }] });
    expect(cells(g, 0)[0]).toBe("WO-1200");
  });

  it("edits cells in place, refuses bad input, and saves one change set with row versions", async () => {
    const api = new FakeApi(sample(5));
    const g = await mount(api);
    const scroll = g.el.querySelector<HTMLElement>("[role=grid]")!;
    // SLA hours of the first row: double-click opens the editor.
    g.el.querySelector<HTMLElement>('.sxg-body [data-r="0"][data-c="2"]')!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    let editor = g.el.querySelector<HTMLInputElement>(".sxg-editor")!;
    editor.value = "4.5";
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(g.el.querySelector(".sxg-status")!.textContent).toContain("whole number");
    editor = g.el.querySelector<HTMLInputElement>(".sxg-editor")!;
    editor.value = "12";
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    // Money: typed with grouping, carried as an exact decimal string.
    g.el.querySelector<HTMLElement>('.sxg-body [data-r="1"][data-c="3"]')!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    editor = g.el.querySelector<HTMLInputElement>(".sxg-editor")!;
    editor.value = "1,250.50";
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(g.pendingCount()).toBe(2);
    expect(g.el.querySelectorAll(".sxg-dirty").length).toBe(2);
    scroll.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    await flush();
    await flush();
    expect(api.changeSets).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        source: "grid",
        items: [
          { entity: "work_order", op: "update", code: "WO-0001", baseVersion: 1, values: { sla_hours: 12 } },
          { entity: "work_order", op: "update", code: "WO-0002", baseVersion: 1, values: { estimated_cost: "1250.50" } },
        ],
      },
    ]);
    expect(g.pendingCount()).toBe(0);
    expect(g.el.querySelector(".sxg-status")!.textContent).toContain("2 changes saved");
  });

  it("resolves a conflict by keeping the user's edit on the current version", async () => {
    const api = new FakeApi(sample(3));
    const g = await mount(api);
    g.el.querySelector<HTMLElement>('.sxg-body [data-r="0"][data-c="2"]')!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const editor = g.el.querySelector<HTMLInputElement>(".sxg-editor")!;
    editor.value = "30";
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    api.failNext = new GridApiError(409, "conflict", "item 1: Work order WO-0001 changed since version 1 (now 2)", {
      error: "conflict",
      entity: "work_order",
      code: "WO-0001",
      current: { code: "WO-0001", status: "IN_PROGRESS", sla_hours: 6, row_version: 2 },
    });
    const saving = g.save();
    await flush();
    const dialog = g.el.querySelector<HTMLElement>(".sxg-dialog")!;
    expect(dialog.hidden).toBe(false);
    expect(dialog.textContent).toContain("WO-0001 changed");
    expect(dialog.textContent).toContain("SLA hours");
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Keep my edit")!.click();
    expect(await saving).toBe(true);
    expect(api.changeSets).toHaveLength(2);
    expect(api.changeSets[1]!.items[0]).toMatchObject({ code: "WO-0001", baseVersion: 2, values: { sla_hours: 30 } });
    // A rebased set is a new set: a fresh id, so the database cannot mistake it for a replay.
    expect(api.changeSets[1]!.id).not.toBe(api.changeSets[0]!.id);
  });

  it("asks before a bulk edit and applies it to the selected rows only", async () => {
    const api = new FakeApi(sample(6));
    const g = await mount(api);
    for (const r of [0, 2]) g.el.querySelector<HTMLInputElement>(`.sxg-body [data-r="${r}"][data-c="-1"] input`)!.click();
    await flush();
    button(g, "Bulk edit").click();
    await flush();
    let dialog = g.el.querySelector<HTMLElement>(".sxg-dialog")!;
    dialog.querySelector<HTMLInputElement>("input")!.value = "IN_PROGRESS";
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Review")!.click();
    await flush();
    dialog = g.el.querySelector<HTMLElement>(".sxg-dialog")!;
    expect(dialog.textContent).toContain('Set Status to "IN_PROGRESS" on 2 rows');
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Apply to 2")!.click();
    await flush();
    expect(g.pendingCount()).toBe(2);
    await g.save();
    expect(api.changeSets[0]!.items.map((i) => [i.code, i.values])).toEqual([
      ["WO-0001", { status: "IN_PROGRESS" }],
      ["WO-0003", { status: "IN_PROGRESS" }],
    ]);
  });

  it("offers no editing to a role that cannot write", async () => {
    const api = new FakeApi(sample(4));
    const g = await mount(api, { canEdit: false, columns: columns.map((c) => ({ ...c, editable: false })) });
    expect(g.el.querySelector('[data-c="-1"]')).toBeNull();
    expect([...g.el.querySelectorAll("button")].some((b) => b.textContent?.startsWith("Save") && b.textContent !== "Save view")).toBe(false);
    g.el.querySelector<HTMLElement>('.sxg-body [data-r="0"][data-c="2"]')!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(g.el.querySelector(".sxg-editor")).toBeNull();
    expect(g.el.querySelector('.sxg-body [data-r="0"][data-c="2"]')!.getAttribute("aria-readonly")).toBe("true");
  });

  it("keeps platform rows of a vocabulary grid read-only", async () => {
    const api = new FakeApi([{ code: "WO-0001", status: "OPEN", sla_hours: 1, row_version: 1, is_platform: true }, { code: "WO-0002", status: "OPEN", sla_hours: 2, row_version: 1, is_platform: false }]);
    const g = await mount(api, { readOnlyWhen: "is_platform" });
    expect(g.el.querySelector('.sxg-body [data-r="0"][data-c="2"]')!.getAttribute("aria-readonly")).toBe("true");
    expect(g.el.querySelector('.sxg-body [data-r="1"][data-c="2"]')!.getAttribute("aria-readonly")).toBe("false");
  });

  it("moves the active cell with the keyboard and exposes it to assistive technology", async () => {
    const api = new FakeApi(sample(10));
    const g = await mount(api);
    const scroll = g.el.querySelector<HTMLElement>("[role=grid]")!;
    scroll.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    scroll.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const active = g.el.querySelector(".sxg-active") as HTMLElement;
    expect(active.dataset.r).toBe("1");
    expect(active.dataset.c).toBe("1");
    expect(scroll.getAttribute("aria-activedescendant")).toBe(active.id);
  });

  it("draws a tree (rows under their parent) and settles: a state change does not redraw it forever", async () => {
    // A tree grid used to hand the table new row data on every state change; the table answered with a page-index
    // reset, itself a state change, and the page froze. Redraws are counted here so a regression fails rather than hangs.
    const proto = SustantixGrid.prototype as unknown as { render(): void };
    const render = proto.render;
    let renders = 0;
    proto.render = function (this: unknown) {
      if (++renders > 200) throw new Error("the grid keeps redrawing");
      render.call(this);
    };
    try {
      const rows = sample(40).map((r, i) => ({ ...r, parent: i >= 10 ? `WO-${String((i % 10) + 1).padStart(4, "0")}` : null }));
      const api = new FakeApi(rows);
      const g = await mount(api, { columns: [...columns, { field: "parent", label: "Parent", kind: "fk", fk: "work_order", editable: false }], tree: { parent: "parent" } });
      await flush();
      // Expanded: each parent, then its children.
      expect(cells(g, 0).slice(0, 5)).toEqual(["▾WO-0001", "WO-0011", "WO-0021", "WO-0031", "▾WO-0002"]);
      // Collapsing the first parent (a state change) hides its children.
      g.el.querySelector<HTMLElement>(".sxg-toggle")!.click();
      await flush();
      await flush();
      expect(cells(g, 0)[1]).toBe("▾WO-0002");
      const settled = renders;
      await flush();
      await flush();
      expect(renders).toBe(settled);
    } finally {
      proto.render = render;
    }
  });

  it("groups rows with counts and per-currency money totals", async () => {
    const api = new FakeApi(sample(10));
    const g = await mount(api);
    const group = g.el.querySelector<HTMLSelectElement>('select[aria-label="Group by"]')!;
    group.value = "status";
    group.dispatchEvent(new Event("change"));
    await flush();
    const groups = [...g.el.querySelectorAll(".sxg-group")].map((r) => r.textContent);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toContain("Status: COMPLETED · 5");
    // Vocabulary columns show the governed label (the fake vocabulary labels OPEN only), keeping the code beside it.
    const open = [...g.el.querySelectorAll<HTMLElement>('.sxg-body [data-c="1"][role=gridcell]')].find((c) => c.textContent === "Open");
    expect(open?.title).toBe("Open (OPEN)");
  });

  it("exports exactly the current query", async () => {
    const api = new FakeApi(sample(3));
    const g = await mount(api, {}, {});
    (globalThis as { URL: typeof URL }).URL.createObjectURL ??= () => "blob:x";
    (globalThis as { URL: typeof URL }).URL.revokeObjectURL ??= () => undefined;
    await g.exportAs("csv");
    expect(api.exports[0]).toEqual({ format: "csv", q: { sort: [{ field: "code", dir: "asc" }], filters: [] } });
  });
});
