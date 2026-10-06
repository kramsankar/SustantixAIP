/**
 * Screen grids: the Enterprise Grid inside the runtime's own screens, behind a per-screen switch.
 *
 * A screen keeps computing its table exactly as the reference build does; the grid reads that table (headers, values
 * and the cells' own content, buttons included) and presents it with sorting, filtering, grouping, search, column
 * control and audited export. The original table stays in the page, hidden, so the screen's actions keep working:
 * a click on a button in the grid is forwarded to the same button in the original row. When the screen redraws its
 * table, the grid follows. Records are edited in the governed grids of the workspace, which each screen grid links to.
 */
import type { ColumnKind, GridColumn, GridPage, GridQuery } from "../contract.ts";
import { queryRows } from "../query.ts";
import type { CatalogueGrid, GridApi } from "./api.ts";
import { SCREEN_GRIDS, type ScreenSpec, type ScreenTable } from "./screen-specs.ts";
import { SustantixGrid } from "./grid.ts";
import { mountWorkspace } from "./workspace.ts";

export { SCREEN_GRIDS, type ScreenSpec, type ScreenTable } from "./screen-specs.ts";

export interface ScreenGridOptions {
  /** Screens switched on: data-view names, or "all". */
  screens: string[] | "all";
  /** The governed grids (on hosts that serve them): screen grids open them in place, Asset Explorer embeds the asset grid. */
  workspace?: { url?: string; api: GridApi };
  /** Audits an export of a screen grid (the rows left the application). */
  recordExport?: (grid: string, format: "csv" | "xlsx", rows: number) => Promise<void>;
}

type Row = Record<string, unknown>;

interface Mounted {
  grid: SustantixGrid;
  host: HTMLElement;
  hidden: HTMLElement;
  table: HTMLTableElement;
  signature: string;
  rows: Row[];
}

/** Screen tables often stack two lines in a cell (site over asset); their rows are tall enough to show both. */
const SCREEN_ROW = 46;
const NUMBER = /^\s*[-+]?[₹$€£]?\s*([-+]?\d[\d,]*(?:\.\d+)?)\s*(?:%|[A-Za-z]{1,6}(?:\/[A-Za-z]{1,6})?)?\s*$/;
const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
// Plain element traversal (not the table DOM API), so any table markup the screens produce is read the same way.
const cellsOf = (tr: Element) => [...tr.children].filter((c): c is HTMLTableCellElement => c.tagName === "TD" || c.tagName === "TH");
const allRows = (t: HTMLTableElement) =>
  [...t.children].flatMap((c) => (c.tagName === "TR" ? [c] : ["THEAD", "TBODY", "TFOOT"].includes(c.tagName) ? [...c.children].filter((r) => r.tagName === "TR") : []));
const firstRow = (section: Element) => [...section.children].find((r) => r.tagName === "TR") ?? null;
/** The first row of the first head, else the table's first row; found without listing every row (scans run often). */
const headerRow = (t: HTMLTableElement): Element | null => {
  for (const c of t.children) if (c.tagName === "THEAD" && firstRow(c)) return firstRow(c);
  for (const c of t.children) {
    if (c.tagName === "TR") return c;
    if (["THEAD", "TBODY", "TFOOT"].includes(c.tagName) && firstRow(c)) return firstRow(c);
  }
  return null;
};
const headerCells = (t: HTMLTableElement) => {
  const h = headerRow(t);
  return h ? cellsOf(h) : [];
};
const bodyRows = (t: HTMLTableElement) => {
  const h = headerRow(t);
  return allRows(t).filter((tr) => tr !== h && tr.parentElement?.tagName !== "THEAD" && tr.parentElement?.tagName !== "TFOOT") as HTMLTableRowElement[];
};

export function matchesHeaders(t: HTMLTableElement, want: string[]): boolean {
  const got = headerCells(t).map((c) => text(c).toUpperCase());
  return got.length >= want.length && want.every((h, i) => got[i] === h.toUpperCase());
}

/** The number a formatted figure stands for ("₹ 1,204.5", "98.2%", "12 MW"), or null when it is not one. */
export function figure(s: string): string | null {
  const m = NUMBER.exec(s);
  return m ? m[1]!.replace(/,/g, "") : null;
}

/** Characters in the longest line of a cell, where block children start new lines. */
function longestLine(td: Element | undefined): number {
  if (!td) return 0;
  const parts = [...td.childNodes].map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim().length);
  return parts.length ? Math.max(...parts) : 0;
}

/** Reads a screen table into grid columns and rows (text values; numbers also as sort keys). */
export function readTable(t: HTMLTableElement): { columns: GridColumn[]; rows: Row[] } {
  const heads = headerCells(t);
  // Each row's cells and their text are read once: large screen tables (thousands of rows) are read on every redraw.
  const body = bodyRows(t).map((tr) => {
    const tds = cellsOf(tr);
    return { tr, tds, texts: heads.map((_, i) => (tds[i] ? text(tds[i]!) : "")) };
  });
  const trs = body.filter((b) => b.tds.length > 1 || text(b.tr) !== "");
  const columns: GridColumn[] = heads.map((h, i) => {
    const values = trs.map((b) => b.texts[i]!).filter((v) => v !== "");
    const numeric = values.length > 0 && values.filter((v) => figure(v) !== null).length / values.length >= 0.8;
    const label = text(h) || (i === 0 ? "Select" : `Column ${i + 1}`);
    // Size to the content: the longest line of a cell (a cell may stack lines), within sensible bounds.
    const longest = Math.max(label.length, ...trs.slice(0, 200).map((b) => longestLine(b.tds[i])));
    const width = Math.max(80, Math.min(340, Math.round(longest * 7.2) + 28));
    return { field: `c${i}`, label, kind: "text" as ColumnKind, editable: false, width, ...(numeric ? { sortKey: `n${i}` } : {}) };
  });
  const rows = trs.map((b, r) => {
    const row: Row = { __key: `r${String(r).padStart(5, "0")}`, __tr: b.tr };
    heads.forEach((_, i) => {
      const v = b.texts[i]!;
      row[`c${i}`] = v;
      if (columns[i]!.sortKey) row[`n${i}`] = figure(v);
    });
    return row;
  });
  return { columns, rows };
}

const signatureOf = (t: HTMLTableElement) => {
  const body = bodyRows(t);
  const all = body.map((tr) => tr.textContent ?? "").join("\u0001");
  let h = 0;
  for (let i = 0; i < all.length; i++) h = (h * 31 + all.charCodeAt(i)) | 0;
  return `${body.length}:${all.length}:${h}`;
};

/** Grid API over rows held in memory (a screen table). */
function localApi(rows: () => Row[], columns: GridColumn[], onExport?: (format: "csv" | "xlsx", n: number) => Promise<void>): GridApi {
  const page = (q: Partial<GridQuery>): GridPage => {
    const all = rows();
    const r = queryRows(all, { offset: q.offset ?? 0, limit: q.limit ?? all.length, sort: q.sort ?? [], filters: q.filters ?? [], ...(q.search ? { search: q.search } : {}) }, columns, "__key");
    return { rows: r.rows, total: r.total, offset: q.offset ?? 0 };
  };
  return {
    catalogue: async () => ({ role: "viewer", grids: [] }),
    rows: async (_g, q) => page(q),
    exportRows: async (_g, format, q) => {
      const r = page({ ...q, offset: 0, limit: Number.MAX_SAFE_INTEGER });
      await onExport?.(format, r.rows.length);
      return { ...r, truncated: false };
    },
    options: async () => [],
    views: async () => [],
    saveView: async () => {
      throw new Error("screen grids keep their layout in this browser");
    },
    deleteView: async () => undefined,
    applyChanges: async () => {
      throw new Error("screen grids are read-only; edit records in the governed grid");
    },
  };
}

export class ScreenGrids {
  private readonly mounted = new Map<HTMLTableElement, Mounted>();
  private assetGrid: { grid: SustantixGrid; host: HTMLElement } | null = null;
  private readonly cells = new WeakMap<HTMLElement, HTMLTableCellElement>();
  /** Mounted tables changed since the last scan: only these are re-read, not every table on every tick. */
  private readonly dirty = new Set<HTMLTableElement>();
  private readonly observer: MutationObserver;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly enabled: Set<string> | "all";

  constructor(private readonly doc: Document, private readonly opts: ScreenGridOptions) {
    this.enabled = opts.screens === "all" ? "all" : new Set(opts.screens);
    this.observer = new MutationObserver((list) => {
      this.note(list);
      // The grids' own redraws never trigger a rescan.
      if (list.every((m) => (m.target as Element).closest?.(".sxg, .sxg-screen"))) return;
      this.schedule();
    });
    this.observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    this.schedule();
  }

  disconnect(): void {
    this.observer.disconnect();
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const m of this.mounted.values()) this.unmount(m);
  }

  /**
   * Throttled, not debounced: the runtime mutates the page continuously (clocks, decorators), so a debounce would be
   * re-armed forever and never scan.
   */
  private schedule(): void {
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.scan();
    }, 250);
  }

  private on(view: string): boolean {
    return this.enabled === "all" || this.enabled.has(view);
  }

  private note(list: MutationRecord[]): void {
    for (const r of list) {
      const t = (r.target as Element).closest?.("table");
      if (t && this.mounted.has(t)) this.dirty.add(t);
    }
  }

  /** Mounts grids on newly drawn tables of switched-on screens, follows redraws and drops grids whose table is gone. */
  scan(): void {
    this.note(this.observer.takeRecords());
    for (const [t, m] of this.mounted) {
      if (!t.isConnected || !m.host.isConnected) this.unmount(m);
      else if (this.dirty.has(t) && signatureOf(t) !== m.signature) this.reload(m);
    }
    this.dirty.clear();
    for (const spec of SCREEN_GRIDS) {
      if (!this.on(spec.view)) continue;
      const view = this.doc.getElementById(spec.viewId);
      if (!view) continue;
      for (const t of view.querySelectorAll<HTMLTableElement>("table")) {
        if (this.mounted.has(t) || t.closest(".sxg")) continue;
        const table = spec.tables.find((x) => matchesHeaders(t, x.headers));
        if (table) this.mount(spec, table, t);
      }
      if (spec.view === "assetexplorer") this.mountAssetGrid(view);
    }
  }

  private mount(spec: ScreenSpec, st: ScreenTable, t: HTMLTableElement): void {
    const wrapper = t.parentElement;
    // Hide the table's own scroll wrapper when it holds nothing else, so the grid takes its place.
    const hidden = wrapper && wrapper.children.length === 1 && wrapper !== this.doc.getElementById(spec.viewId) ? wrapper : t;
    const { columns, rows } = readTable(t);
    const host = this.doc.createElement("div");
    host.className = "sxg-screen";
    host.dataset.screenGrid = st.id;
    host.style.cssText = `height:${Math.min(600, 132 + Math.max(rows.length, 3) * SCREEN_ROW)}px;margin:4px 0 8px`;
    hidden.insertAdjacentElement("afterend", host);
    hidden.style.display = "none";
    const m: Mounted = { grid: null as unknown as SustantixGrid, host, hidden, table: t, signature: signatureOf(t), rows };
    const def: CatalogueGrid = {
      id: `screen-${st.id}`,
      title: st.title,
      screen: spec.screen,
      source: { kind: "registry" },
      relation: "screen",
      columns,
      key: "__key",
      entity: null,
      writers: [],
      defaultSort: [],
      groupBy: [],
      bulkEdit: [],
      tree: null,
      canEdit: false,
    };
    const actions = st.governedGrid && this.opts.workspace ? [{ label: "Edit in governed grid", onClick: () => this.openWorkspace(st.governedGrid!) }] : [];
    m.grid = new SustantixGrid(host, {
      api: localApi(() => m.rows, columns, (format, n) => this.opts.recordExport?.(def.id, format, n) ?? Promise.resolve()),
      def,
      savedViews: false,
      stateKey: `sx_aip_screen_grid:${st.id}`,
      actions,
      initialRect: { width: 1000, height: Math.min(600, 132 + Math.max(rows.length, 3) * SCREEN_ROW) - 100 },
      renderCell: (row, field, cell) => this.renderCell(row, field, cell),
      rowHeight: SCREEN_ROW,
    });
    m.grid.el.classList.add("sxg-tall");
    host.addEventListener("click", (e) => this.forward(e, m), true);
    this.mounted.set(t, m);
    void m.grid.load();
  }

  private reload(m: Mounted): void {
    m.signature = signatureOf(m.table);
    m.rows = readTable(m.table).rows;
    void m.grid.load();
  }

  private unmount(m: Mounted): void {
    m.grid.destroy();
    m.host.remove();
    if (m.hidden.isConnected) m.hidden.style.display = "";
    this.mounted.delete(m.table);
  }

  /** Shows the screen's own cell content (badges, buttons, links), without its inline handlers: clicks are forwarded. */
  private renderCell(row: Row, field: string, cell: HTMLElement): boolean {
    const tr = row.__tr as HTMLTableRowElement | undefined;
    const td = tr ? cellsOf(tr)[Number(field.slice(1))] : undefined;
    if (!td || !td.children.length) return false;
    const copy = td.cloneNode(true) as HTMLElement;
    const originals = [...td.querySelectorAll("*")];
    [...copy.querySelectorAll("*")].forEach((el, i) => {
      for (const a of [...el.attributes]) if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      el.removeAttribute("id");
      (el as HTMLElement).dataset.sxgI = String(i);
      if (originals[i] instanceof HTMLInputElement && el instanceof HTMLInputElement) el.checked = originals[i].checked;
    });
    cell.append(...[...copy.childNodes]);
    this.cells.set(cell, td);
    return true;
  }

  /** A click on a copied control acts on the original one; a click on a plain cell acts on the original row. */
  private forward(e: MouseEvent, m: Mounted): void {
    const target = e.target as HTMLElement;
    const cell = target.closest<HTMLElement>(".sxg-cell");
    if (!cell || target.closest(".sxg-toggle, .sxg-headrow, .sxg-toolbar")) return;
    const td = this.cells.get(cell);
    const copied = target.closest<HTMLElement>("[data-sxg-i]");
    if (td && copied) {
      const original = td.querySelectorAll<HTMLElement>("*")[Number(copied.dataset.sxgI)];
      if (original) {
        e.preventDefault();
        e.stopPropagation();
        original.click();
        setTimeout(() => m.grid.redraw(), 0);
      }
      return;
    }
    const tr = td?.parentElement as HTMLTableRowElement | undefined;
    if (tr && (tr.hasAttribute("onclick") || td!.hasAttribute("onclick") || getComputedStyle(tr).cursor === "pointer")) (td!.hasAttribute("onclick") ? td! : tr).click();
  }

  /** The governed grids over the screen, in place: edits there are change sets; closing returns to the screen. */
  openWorkspace(gridId: string): void {
    if (!this.opts.workspace) return;
    this.doc.getElementById("sxg-overlay")?.remove();
    const overlay = this.doc.createElement("div");
    overlay.id = "sxg-overlay";
    overlay.className = "sxg-screen";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Governed grids");
    overlay.style.cssText = "position:fixed;inset:24px;z-index:2147481000;background:#f8fafc;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden";
    const bar = this.doc.createElement("div");
    bar.style.cssText = "display:flex;justify-content:flex-end;padding:8px 12px;border-bottom:1px solid #e2e8f0";
    const close = this.doc.createElement("button");
    close.type = "button";
    close.className = "sxg-btn";
    close.textContent = "Close";
    const done = () => {
      overlay.remove();
      this.doc.removeEventListener("keydown", onKey, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !this.doc.querySelector("#sxg-overlay .sxg-dialog:not([hidden])")) done();
    };
    close.addEventListener("click", done);
    this.doc.addEventListener("keydown", onKey, true);
    bar.append(close);
    const body = this.doc.createElement("div");
    body.className = "sxg-ws";
    body.style.cssText = "flex:1;min-height:0;display:grid;grid-template-columns:240px 1fr";
    overlay.append(bar, body);
    this.doc.body.append(overlay);
    void mountWorkspace(body, { api: this.opts.workspace.api, useHash: false, initial: gridId });
    close.focus();
  }

  /** Asset Explorer draws a tree and cards, not a table: on hosts with the governed workspace it gains the asset grid. */
  private mountAssetGrid(view: HTMLElement): void {
    if (!this.opts.workspace || (this.assetGrid && this.assetGrid.host.isConnected)) return;
    const api = this.opts.workspace.api;
    const host = this.doc.createElement("div");
    host.className = "sxg-screen";
    host.dataset.screenGrid = "asset-hierarchy";
    host.style.cssText = "height:560px;margin:12px 0";
    view.append(host);
    this.assetGrid = { grid: null as unknown as SustantixGrid, host };
    void api.catalogue().then((c) => {
      const def = c.grids.find((g) => g.id === "assets");
      if (!def) return host.remove();
      this.assetGrid!.grid = new SustantixGrid(host, { api, def, role: c.role, savedViews: true });
      void this.assetGrid!.grid.load();
    }).catch(() => host.remove());
  }
}

export function mountScreenGrids(doc: Document, opts: ScreenGridOptions): ScreenGrids {
  const grids = new ScreenGrids(doc, opts);
  // Reachable for tests that need a scan now rather than at the next throttle tick (the screen-grid crawl).
  (globalThis as { __AIP_SCREEN_GRIDS__?: ScreenGrids }).__AIP_SCREEN_GRIDS__ = grids;
  return grids;
}
