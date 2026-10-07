/**
 * The Sustantix Enterprise Grid: one component for every governed data surface.
 *
 * - Data: grids of up to LIMITS.clientRowsMax rows load once and sort, filter, group and draw trees in the browser
 *   with the same semantics the database applies; larger grids page, sort and filter in the database and fetch the
 *   rows in view as the user scrolls. Either way only the visible rows are in the DOM.
 * - Layout: column chooser, pinning, resizing and reordering on a headless table model; saved views per user, shared
 *   views per tenant.
 * - Editing: cells of editable columns (by role) edit in place with vocabulary and reference dropdowns; edits, new rows
 *   and deletions are held until saved as one change set carrying each row's version. A conflict shows the current row
 *   beside the user's edit and lets them keep theirs or take the current one. Bulk edits and deletes ask first.
 * - Export: exactly the filtered rows, to CSV or Excel, audited by the host.
 * - Accessibility: a keyboard-navigable ARIA grid with an active cell, sortable column headers and a live status line.
 */
import {
  createTable,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  type Column,
  type ColumnDef,
  type Row as TRow,
  type Table,
  type TableState,
} from "@tanstack/table-core";
import { elementScroll, observeElementOffset, observeElementRect, Virtualizer } from "@tanstack/virtual-core";
import { FILTER_OPS, LIMITS, opsFor, parseCellInput, type GridColumn, type GridFilter, type GridQuery, type SortSpec } from "../contract.ts";
import { moneyTotals } from "../decimal.ts";
import { searchRows, sortRows, matches } from "../query.ts";
import { GridApiError, type CatalogueGrid, type GridApi, type SavedView } from "./api.ts";
import type { ChangeFeedItem, LiveFeed } from "./live.ts";

/** Up to this many changed records are fetched and merged; more reload the grid. */
const LIVE_MERGE_MAX = 200;
import { EditBuffer } from "./edits.ts";
import { alignRight, display, editText, moneyTotal } from "./format.ts";
import { injectStyles } from "./styles.ts";

type Row = Record<string, unknown>;

export interface GridOptions {
  api: GridApi;
  def: CatalogueGrid;
  /** Tenant default currency, for rows that carry none. */
  currency?: string;
  /** The caller's role: administrators may share saved views. */
  role?: string;
  /** Opens another grid on a referenced record (drill-through on reference columns). */
  onNavigate?: (entity: string, code: string) => void;
  /** Initial filters, for example from a drill-through. */
  filters?: GridFilter[];
  /** Overrides the client/server threshold (tests). */
  clientRowsMax?: number;
  /** Viewport size before layout is measured (tests and hidden containers). */
  initialRect?: { width: number; height: number };
  newId?: () => string;
  /**
   * Draws a cell itself (a screen grid shows the screen's own cell content, buttons included); return false to fall
   * back to the formatted value.
   */
  renderCell?: (row: Record<string, unknown>, field: string, cell: HTMLElement) => boolean;
  /** Saved views through the host (default); off for grids that are not in the catalogue. */
  savedViews?: boolean;
  /** Remembers this grid's layout, sort and filters in the browser under this key. */
  stateKey?: string;
  /** Further toolbar actions. */
  actions?: Array<{ label: string; onClick: () => void }>;
  /** Row height in pixels (screen grids use taller rows, so two-line cells are not cut). */
  rowHeight?: number;
  /** The page's change feed: the grid shows others' changes to its entity as they are applied. */
  live?: LiveFeed;
}

export interface GridViewState {
  sort: SortSpec[];
  filters: GridFilter[];
  search: string;
  groupBy: string[];
  columnOrder: string[];
  hidden: string[];
  pinned: string[];
  sizing: Record<string, number>;
}

type Display = { kind: "row"; row: Row | null; depth: number; trow?: TRow<Row> } | { kind: "group"; trow: TRow<Row>; depth: number };

const PAGE = 200;
const ROW_HEIGHT = 32;
const SELECT_WIDTH = 34;
let uid = 0;

export class SustantixGrid {
  readonly el: HTMLElement;
  private readonly doc: Document;
  private readonly def: CatalogueGrid;
  private readonly api: GridApi;
  private readonly id = `sxg${++uid}`;
  private readonly cols: Map<string, GridColumn>;
  private readonly edits: EditBuffer | null;
  private readonly currency: string;
  private readonly rowHeight: number;
  /** Rows can be selected: for editing, or for the grid's own actions. */
  private readonly selectable: boolean;

  private state: GridViewState;
  private mode: "client" | "server" = "client";
  private all: Row[] = [];
  private view: Row[] = [];
  private total = 0;
  private pages = new Map<number, Row[]>();
  private inflight = new Set<number>();
  private generation = 0;
  private added: Row[] = [];
  private selected = new Set<string>();
  private active = { r: 0, c: 0 };
  private editing: { r: number; c: number } | null = null;
  private cellError: { code: string; field: string; message: string } | null = null;
  private views: SavedView[] = [];
  private currentView: SavedView | null = null;
  private expanded: TableState["expanded"] = true;
  /** Vocabulary labels by column, for display; cells, edits and exports keep the governed codes. */
  private labels = new Map<string, Map<string, string>>();
  private busy = false;
  private liveOff: (() => void) | null = null;
  private liveQueue: { items: ChangeFeedItem[]; truncated: boolean } | null = null;

  private table!: Table<Row>;
  private virtualizer!: Virtualizer<HTMLElement, HTMLElement>;
  private cleanup: Array<() => void> = [];
  private display: Display[] = [];

  // Elements
  private scroll!: HTMLElement;
  private head!: HTMLElement;
  private body!: HTMLElement;
  private chips!: HTMLElement;
  private foot!: HTMLElement;
  private statusEl!: HTMLElement;
  private dialogEl!: HTMLElement;
  private toolbar!: HTMLElement;

  constructor(host: HTMLElement, private readonly opts: GridOptions) {
    this.doc = host.ownerDocument;
    injectStyles(this.doc);
    this.def = opts.def;
    this.api = opts.api;
    this.currency = opts.currency ?? "INR";
    this.rowHeight = opts.rowHeight ?? ROW_HEIGHT;
    this.selectable = !!(opts.def.canEdit && opts.def.entity) || !!opts.def.actions?.length;
    this.cols = new Map(this.def.columns.map((c) => [c.field, c]));
    this.edits = this.def.canEdit && this.def.entity ? new EditBuffer(this.def.entity, opts.newId) : null;
    this.state = {
      sort: [...this.def.defaultSort],
      filters: [...(opts.filters ?? [])],
      search: "",
      groupBy: [],
      columnOrder: this.def.columns.map((c) => c.field),
      hidden: [],
      pinned: this.def.columns[0] ? [this.def.columns[0].field] : [],
      sizing: {},
    };
    if (opts.stateKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(opts.stateKey) ?? "null") as Partial<GridViewState> | null;
        if (saved) this.state = this.cleanState(saved);
      } catch {
        /* storage unavailable or corrupt: start from the default view */
      }
    }
    this.el = this.doc.createElement("div");
    this.el.className = "sxg";
    this.el.style.position = "relative";
    this.el.setAttribute("role", "region");
    this.el.setAttribute("aria-label", this.def.title);
    host.appendChild(this.el);
    this.build();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    this.setStatus("Loading…");
    try {
      const max = this.opts.clientRowsMax ?? LIMITS.clientRowsMax;
      const first = await this.api.rows(this.def.id, { offset: 0, limit: Math.min(LIMITS.pageMax, max), sort: this.state.sort, filters: [] });
      if (first.total <= max) {
        this.mode = "client";
        const rows = [...first.rows];
        while (rows.length < first.total) {
          const next = await this.api.rows(this.def.id, { offset: rows.length, limit: LIMITS.pageMax, sort: this.state.sort, filters: [] });
          if (!next.rows.length) break;
          rows.push(...next.rows);
        }
        this.all = rows;
      } else {
        this.mode = "server";
        this.all = [];
      }
      this.views = this.opts.savedViews === false ? [] : await this.api.views(this.def.id).catch(() => []);
      await this.loadLabels();
      await this.refresh();
      this.setStatus("");
      if (this.opts.live && this.def.entity && !this.liveOff) this.liveOff = this.opts.live.subscribe(this.def.entity, (items, truncated) => void this.onLive(items, truncated));
    } catch (e) {
      this.setStatus(errorText(e), true);
    }
  }

  private async loadLabels(): Promise<void> {
    await Promise.all(
      this.def.columns
        .filter((c) => c.kind === "ref" && c.ref)
        .map(async (c) => {
          try {
            const opts = await this.api.options("ref", c.ref!, c.scope ?? null, "");
            this.labels.set(c.field, new Map(opts.filter((o) => o.label).map((o) => [o.code, o.label!])));
          } catch {
            /* codes are shown instead */
          }
        }),
    );
  }

  private text(meta: GridColumn, v: unknown, row?: Row): string {
    const label = meta.kind === "ref" && v !== null && v !== undefined ? this.labels.get(meta.field)?.get(String(v)) : undefined;
    return label ?? display(meta, v, row, this.currency);
  }

  destroy(): void {
    this.liveOff?.();
    this.liveOff = null;
    for (const f of this.cleanup) f();
    this.el.remove();
  }

  /** The current query: what the grid shows, as the host would evaluate it. */
  query(): Omit<GridQuery, "offset" | "limit"> {
    return { sort: this.state.sort, filters: this.state.filters, ...(this.state.search ? { search: this.state.search } : {}) };
  }

  /** Runs one of the grid's actions on the selected rows, after confirmation, then reloads. */
  private async runAction(a: { id: string; label: string; confirm?: string }): Promise<void> {
    const keys = [...this.selected];
    const n = keys.length;
    const ok = await this.dialog(a.label, [this.doc.createTextNode(`${a.confirm ?? a.label} — ${n} selected row${n === 1 ? "" : "s"}?`)], [{ id: "go", label: `${a.label} ${n}`, primary: true }]);
    if (ok !== "go") return;
    this.busy = true;
    this.renderToolbar();
    try {
      const r = await this.api.runAction!(this.def.id, a.id, keys);
      this.selected.clear();
      this.setStatus(Object.entries(r).filter(([, v]) => typeof v === "number" && v > 0).map(([k, v]) => `${v} ${k}`).join(" · ") || "Done");
      await this.reloadAfterSave();
    } catch (e) {
      this.setStatus(errorText(e), true);
    } finally {
      this.busy = false;
      this.render();
    }
  }

  /** Redraws the rows in view (a screen grid after its table changed state in place). */
  redraw(): void {
    this.renderBody();
  }

    viewState(): GridViewState {
    return JSON.parse(JSON.stringify(this.state)) as GridViewState;
  }

  pendingCount(): number {
    return this.edits?.size ?? 0;
  }

  /** Re-evaluates the rows after a change of sort, filter, search or grouping. */
  async refresh(): Promise<void> {
    this.generation++;
    if (this.mode === "client") {
      const kinds = new Map(this.def.columns.map((c) => [c.field, c.kind]));
      let rows = this.all.filter((r) => this.state.filters.every((f) => matches(r, f, kinds.get(f.field))));
      rows = searchRows(rows, this.state.search, this.def.columns);
      this.view = sortRows(rows, this.state.sort, this.def.columns, this.def.key);
      this.total = this.view.length;
    } else {
      this.pages.clear();
      this.inflight.clear();
      this.total = 0;
      await this.fetchPage(0, this.generation);
    }
    this.syncTable();
    this.render();
    if (this.opts.stateKey) {
      try {
        localStorage.setItem(this.opts.stateKey, JSON.stringify(this.state));
      } catch {
        /* storage unavailable: the layout lasts for this visit */
      }
    }
  }

  // ── Construction ─────────────────────────────────────────────────────────

  private build(): void {
    const d = this.doc;
    this.toolbar = div("sxg-toolbar");
    this.chips = div("sxg-chips");
    this.scroll = div("sxg-scroll");
    this.scroll.tabIndex = 0;
    this.scroll.setAttribute("role", "grid");
    this.scroll.setAttribute("aria-label", this.def.title);
    this.scroll.setAttribute("aria-multiselectable", String(this.selectable));
    this.head = div("sxg-headrow");
    this.head.setAttribute("role", "row");
    this.head.setAttribute("aria-rowindex", "1");
    this.body = div("sxg-body");
    this.body.setAttribute("role", "rowgroup");
    this.body.style.position = "relative";
    this.scroll.append(this.head, this.body);
    this.foot = div("sxg-foot");
    this.statusEl = d.createElement("span");
    this.statusEl.className = "sxg-status";
    this.statusEl.setAttribute("role", "status");
    this.statusEl.setAttribute("aria-live", "polite");
    this.dialogEl = div("sxg-dialog");
    this.dialogEl.hidden = true;
    this.el.append(this.toolbar, this.chips, this.scroll, this.foot, this.dialogEl);

    this.table = createTable<Row>({
      data: [],
      columns: this.def.columns.map((c): ColumnDef<Row> => ({ id: c.field, accessorFn: (r) => r[c.field], header: c.label, size: defaultWidth(c), minSize: 60, maxSize: 800 })),
      getCoreRowModel: getCoreRowModel(),
      getGroupedRowModel: getGroupedRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
      getRowId: (r, i) => (r[this.def.key] === undefined ? String(i) : String(r[this.def.key])),
      state: {},
      onStateChange: () => undefined,
      renderFallbackValue: null,
      manualSorting: true,
      manualFiltering: true,
      groupedColumnMode: false,
      autoResetExpanded: false,
      // The grid draws every row itself (virtualised), so the table's page index never applies. Left on, a state change
      // that hands the table new row data queues a page-index reset, whose state change hands it new data again.
      autoResetPageIndex: false,
    });
    this.syncTable();

    this.virtualizer = new Virtualizer<HTMLElement, HTMLElement>({
      count: 0,
      getScrollElement: () => this.scroll,
      estimateSize: () => this.rowHeight,
      overscan: 12,
      scrollMargin: 0,
      paddingStart: this.rowHeight,
      // A container not yet laid out measures 0×0; with an explicit initial size the grid renders to that until it is.
      observeElementRect: (inst, cb) => observeElementRect(inst, (rect) => cb(rect.width === 0 && rect.height === 0 && this.opts.initialRect ? this.opts.initialRect : rect)),
      observeElementOffset,
      scrollToFn: elementScroll,
      initialRect: this.opts.initialRect ?? { width: 1000, height: 600 },
      onChange: () => this.renderBody(),
    });
    this.cleanup.push(this.virtualizer._didMount());

    this.scroll.addEventListener("keydown", (e) => this.onKey(e));
    this.scroll.addEventListener("dblclick", (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-r]");
      if (cell) this.beginEdit(Number(cell.dataset.r), Number(cell.dataset.c));
    });
    this.scroll.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const cell = t.closest<HTMLElement>("[data-r]");
      if (!cell) return;
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      if (t.closest(".sxg-toggle")) return this.toggleRow(r);
      if (t.closest(".sxg-link")) return this.navigate(r, c);
      if (t.closest("input[type=checkbox]")) return this.toggleSelect(r);
      if (this.editing && (this.editing.r !== r || this.editing.c !== c)) this.commitEdit();
      // Move the highlight in place: re-rendering here would replace the cell between the two clicks of a double-click.
      this.setActive(r, Math.max(0, c));
    });
    this.renderToolbar();
  }

  private syncTable(): void {
    const tree = this.treeActive();
    const data = this.mode === "client" ? (tree ? this.treeRoots() : this.view) : [];
    const order = this.state.columnOrder;
    this.table.setOptions((prev) => ({
      ...prev,
      data,
      getSubRows: tree ? (r: Row) => this.children.get(String(r[this.def.key])) : undefined,
      state: {
        ...this.table.initialState,
        columnOrder: order,
        columnVisibility: Object.fromEntries(this.state.hidden.map((h) => [h, false])),
        columnPinning: { left: this.state.pinned.filter((p) => !this.state.hidden.includes(p)), right: [] },
        columnSizing: this.state.sizing,
        grouping: this.mode === "client" && !tree ? this.state.groupBy : [],
        expanded: this.expanded,
      },
      onStateChange: (updater) => {
        const next = typeof updater === "function" ? updater(this.table.getState()) : updater;
        this.expanded = next.expanded;
        this.state.sizing = next.columnSizing;
        this.syncTable();
        this.render();
      },
    }));
  }

  // ── Trees (a grid whose entity references itself) ────────────────────────

  private children = new Map<string, Row[]>();

  private treeActive(): boolean {
    return !!this.def.tree && this.mode === "client" && !this.state.groupBy.length && !this.state.filters.length && !this.state.search;
  }

  /** The roots of the current view, rebuilt only when the view is (state changes keep handing the table the same data). */
  private treeCache: { view: Row[]; roots: Row[] } | null = null;

  private treeRoots(): Row[] {
    if (this.treeCache?.view === this.view) return this.treeCache.roots;
    const parent = this.def.tree!.parent;
    const codes = new Set(this.view.map((r) => String(r[this.def.key])));
    this.children = new Map();
    const roots: Row[] = [];
    for (const r of this.view) {
      const p = r[parent];
      if (p !== null && p !== undefined && codes.has(String(p))) {
        const list = this.children.get(String(p)) ?? [];
        list.push(r);
        this.children.set(String(p), list);
      } else roots.push(r);
    }
    this.treeCache = { view: this.view, roots };
    return roots;
  }

  // ── Server paging ────────────────────────────────────────────────────────

  private async fetchPage(page: number, gen: number): Promise<void> {
    if (this.pages.has(page) || this.inflight.has(page)) return;
    this.inflight.add(page);
    try {
      const res = await this.api.rows(this.def.id, { offset: page * PAGE, limit: PAGE, ...this.query() });
      if (gen !== this.generation) return;
      this.pages.set(page, res.rows);
      this.total = res.total;
    } catch (e) {
      if (gen === this.generation) this.setStatus(errorText(e), true);
    } finally {
      this.inflight.delete(page);
    }
  }

  private ensureVisible(): void {
    if (this.mode !== "server") return;
    const items = this.virtualizer.getVirtualItems();
    if (!items.length) return;
    const offset = this.added.length;
    const first = Math.max(0, items[0]!.index - offset);
    const last = Math.max(0, items[items.length - 1]!.index - offset);
    const gen = this.generation;
    for (let p = Math.floor(first / PAGE); p <= Math.floor(last / PAGE); p++) {
      if (!this.pages.has(p) && !this.inflight.has(p) && p * PAGE < this.total) {
        void this.fetchPage(p, gen).then(() => {
          if (gen === this.generation) this.render();
        });
      }
    }
  }

  // ── Display model ────────────────────────────────────────────────────────

  private buildDisplay(): void {
    const out: Display[] = this.added.map((row) => ({ kind: "row" as const, row, depth: 0 }));
    if (this.mode === "client") {
      for (const tr of this.table.getRowModel().rows) {
        if (tr.getIsGrouped()) out.push({ kind: "group", trow: tr, depth: tr.depth });
        else out.push({ kind: "row", row: tr.original, depth: tr.depth, trow: tr });
      }
    }
    this.display = out;
  }

  private count(): number {
    return this.mode === "client" ? this.display.length : this.added.length + this.total;
  }

  private displayAt(i: number): Display {
    if (this.mode === "client" || i < this.added.length) return this.display[i] ?? { kind: "row", row: null, depth: 0 };
    const j = i - this.added.length;
    const page = this.pages.get(Math.floor(j / PAGE));
    return { kind: "row", row: page?.[j % PAGE] ?? null, depth: 0 };
  }

  private visibleColumns(): Array<Column<Row, unknown>> {
    return [...this.table.getLeftVisibleLeafColumns(), ...this.table.getCenterVisibleLeafColumns()];
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private render(): void {
    this.buildDisplay();
    this.virtualizer.setOptions({ ...this.virtualizer.options, count: this.count() });
    this.virtualizer._willUpdate();
    this.renderHeader();
    this.renderBody();
    this.renderChips();
    this.renderFoot();
    this.renderToolbar();
  }

  private template(cols: Array<Column<Row, unknown>>): string {
    return `${this.selectable ? `${SELECT_WIDTH}px ` : ""}${cols.map((c) => `${c.getSize()}px`).join(" ")}`;
  }

  private pinOffset(col: Column<Row, unknown>): number | null {
    return col.getIsPinned() === "left" ? col.getStart("left") + (this.selectable ? SELECT_WIDTH : 0) : null;
  }

  private renderHeader(): void {
    const cols = this.visibleColumns();
    this.head.replaceChildren();
    this.head.style.gridTemplateColumns = this.template(cols);
    this.scroll.setAttribute("aria-colcount", String(cols.length));
    this.scroll.setAttribute("aria-rowcount", String(this.count() + 1));
    if (this.selectable) {
      const c = div("sxg-cell sxg-pin");
      c.style.left = "0";
      c.setAttribute("role", "columnheader");
      const all = this.doc.createElement("input");
      all.type = "checkbox";
      all.setAttribute("aria-label", "Select all loaded rows");
      all.checked = this.selected.size > 0 && this.selected.size >= this.loadedRows().length;
      all.addEventListener("change", () => {
        if (all.checked) for (const r of this.loadedRows()) this.selected.add(String(r[this.def.key]));
        else this.selected.clear();
        this.render();
      });
      c.append(all);
      this.head.append(c);
    }
    cols.forEach((col, ci) => {
      const meta = this.cols.get(col.id)!;
      const cell = div(`sxg-cell${alignRight(meta) ? " sxg-num" : ""}`);
      const off = this.pinOffset(col);
      if (off !== null) {
        cell.classList.add("sxg-pin");
        cell.style.left = `${off}px`;
      }
      cell.setAttribute("role", "columnheader");
      cell.setAttribute("aria-colindex", String(ci + 1));
      const si = this.state.sort.findIndex((s) => s.field === col.id);
      cell.setAttribute("aria-sort", si < 0 ? "none" : this.state.sort[si]!.dir === "asc" ? "ascending" : "descending");
      const btn = this.doc.createElement("button");
      btn.type = "button";
      btn.className = "sxg-link";
      btn.style.cssText = "color:inherit;font:inherit;padding:0;text-align:left;flex:1;overflow:hidden;text-overflow:ellipsis";
      btn.textContent = meta.label;
      btn.title = `Sort by ${meta.label} (shift-click to add)`;
      btn.addEventListener("click", (e) => this.toggleSort(col.id, e.shiftKey));
      cell.append(btn);
      if (si >= 0) {
        const s = span("sxg-sort", `${this.state.sort[si]!.dir === "asc" ? "▲" : "▼"}${this.state.sort.length > 1 ? si + 1 : ""}`);
        s.setAttribute("aria-hidden", "true");
        cell.append(s);
      }
      const grip = div("sxg-resize");
      grip.setAttribute("aria-hidden", "true");
      grip.addEventListener("pointerdown", (e) => this.startResize(e, col));
      cell.append(grip);
      this.head.append(cell);
    });
  }

  private renderBody(): void {
    if (this.liveQueue) this.flushLive();
    this.ensureVisible();
    const cols = this.visibleColumns();
    const template = this.template(cols);
    const width = cols.reduce((n, c) => n + c.getSize(), this.selectable ? SELECT_WIDTH : 0);
    this.body.style.height = `${this.virtualizer.getTotalSize() - this.rowHeight}px`;
    this.body.style.minWidth = `${width}px`;
    this.body.replaceChildren();
    let activeId = "";
    for (const item of this.virtualizer.getVirtualItems()) {
      const r = item.index;
      const d = this.displayAt(r);
      const rowEl = div("sxg-row");
      rowEl.setAttribute("role", "row");
      rowEl.setAttribute("aria-rowindex", String(r + 2));
      rowEl.style.top = `${item.start - this.rowHeight}px`;
      rowEl.style.height = `${this.rowHeight}px`;
      rowEl.style.gridTemplateColumns = template;
      rowEl.style.width = `${width}px`;
      if (d.kind === "group") {
        this.renderGroup(rowEl, d, cols, r);
        this.body.append(rowEl);
        continue;
      }
      const row = d.row;
      const code = row ? String(row[this.def.key]) : "";
      if (row && this.edits?.isNew(code)) rowEl.classList.add("sxg-new");
      if (row && this.edits?.isDeleted(code)) rowEl.classList.add("sxg-deleted");
      if (row && this.selected.has(code)) {
        rowEl.classList.add("sxg-selected");
        rowEl.setAttribute("aria-selected", "true");
      }
      if (this.selectable) {
        const c = div("sxg-cell sxg-pin");
        c.style.left = "0";
        c.dataset.r = String(r);
        c.dataset.c = "-1";
        c.setAttribute("role", "gridcell");
        if (row) {
          const box = this.doc.createElement("input");
          box.type = "checkbox";
          box.checked = this.selected.has(code);
          box.setAttribute("aria-label", `Select ${code}`);
          c.append(box);
        }
        rowEl.append(c);
      }
      cols.forEach((col, ci) => {
        const meta = this.cols.get(col.id)!;
        const cell = div(`sxg-cell${alignRight(meta) ? " sxg-num" : ""}`);
        cell.id = `${this.id}-r${r}-c${ci}`;
        cell.dataset.r = String(r);
        cell.dataset.c = String(ci);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-colindex", String(ci + 1));
        const off = this.pinOffset(col);
        if (off !== null) {
          cell.classList.add("sxg-pin");
          cell.style.left = `${off}px`;
        }
        const editable = this.canEditCell(row, meta);
        if (editable) cell.classList.add("sxg-editable");
        cell.setAttribute("aria-readonly", String(!editable));
        if (this.active.r === r && this.active.c === ci) {
          cell.classList.add("sxg-active");
          activeId = cell.id;
        }
        if (!row) {
          if (ci === 0) cell.append(span("sxg-loading", "Loading…"));
        } else if (this.editing && this.editing.r === r && this.editing.c === ci) {
          cell.append(this.editor(row, meta));
        } else {
          if (ci === 0 && d.depth) cell.style.paddingLeft = `${8 + d.depth * 16}px`;
          if (ci === 0 && d.trow?.getCanExpand()) {
            const t = this.doc.createElement("button");
            t.type = "button";
            t.className = "sxg-toggle";
            t.textContent = d.trow.getIsExpanded() ? "▾" : "▸";
            t.setAttribute("aria-label", d.trow.getIsExpanded() ? "Collapse" : "Expand");
            cell.setAttribute("aria-expanded", String(d.trow.getIsExpanded()));
            cell.append(t);
          }
          const v = this.edits ? this.edits.value(row, meta.field) : row[meta.field];
          const text = this.text(meta, v, row);
          if (!this.opts.renderCell?.(row, meta.field, cell)) cell.append(this.doc.createTextNode(text));
          cell.title = meta.kind === "ref" && text !== String(v ?? "") ? `${text} (${String(v)})` : text;
          if (meta.kind === "fk" && v && this.opts.onNavigate) {
            const go = this.doc.createElement("button");
            go.type = "button";
            go.className = "sxg-link";
            go.textContent = "↗";
            go.setAttribute("aria-label", `Open ${meta.label} ${String(v)}`);
            cell.append(go);
          }
          if (this.edits?.isDirty(code, meta.field)) cell.classList.add("sxg-dirty");
          if (this.cellError && this.cellError.code === code && this.cellError.field === meta.field) {
            cell.classList.add("sxg-error");
            cell.title = this.cellError.message;
          }
        }
        rowEl.append(cell);
      });
      this.body.append(rowEl);
    }
    if (activeId) this.scroll.setAttribute("aria-activedescendant", activeId);
    else this.scroll.removeAttribute("aria-activedescendant");
    const editor = this.body.querySelector<HTMLInputElement | HTMLSelectElement>(".sxg-editor");
    if (editor && this.doc.activeElement !== editor) editor.focus();
  }

  private renderGroup(rowEl: HTMLElement, d: Extract<Display, { kind: "group" }>, cols: Array<Column<Row, unknown>>, r: number): void {
    rowEl.classList.add("sxg-group");
    const leaves = d.trow.getLeafRows().filter((x) => !x.getIsGrouped()).map((x) => x.original);
    if (this.selectable) rowEl.append(div("sxg-cell"));
    cols.forEach((col, ci) => {
      const meta = this.cols.get(col.id)!;
      const cell = div(`sxg-cell${alignRight(meta) ? " sxg-num" : ""}`);
      cell.dataset.r = String(r);
      cell.dataset.c = String(ci);
      cell.setAttribute("role", "gridcell");
      if (this.active.r === r && this.active.c === ci) cell.classList.add("sxg-active");
      if (ci === 0) {
        cell.style.paddingLeft = `${8 + d.depth * 16}px`;
        const t = this.doc.createElement("button");
        t.type = "button";
        t.className = "sxg-toggle";
        t.textContent = d.trow.getIsExpanded() ? "▾" : "▸";
        t.setAttribute("aria-label", d.trow.getIsExpanded() ? "Collapse group" : "Expand group");
        cell.setAttribute("aria-expanded", String(d.trow.getIsExpanded()));
        const gcol = this.cols.get(String(d.trow.groupingColumnId))!;
        const value = this.text(gcol, d.trow.groupingValue);
        cell.append(t, this.doc.createTextNode(`${gcol.label}: ${value || "(none)"} · ${leaves.length}`));
      } else if (meta.kind === "money") {
        cell.textContent = moneyTotals(leaves, meta.field, "currency", this.currency).map((t) => moneyTotal(t.sum, t.currency)).join(" + ");
      }
      rowEl.append(cell);
    });
  }

  private renderChips(): void {
    this.chips.replaceChildren();
    this.state.filters.forEach((f, i) => {
      const meta = this.cols.get(f.field);
      const chip = span("sxg-chip", `${meta?.label ?? f.field} ${OP_LABEL[f.op]}${f.op === "empty" || f.op === "notEmpty" ? "" : ` ${Array.isArray(f.value) ? f.value.join(", ") : String(f.value)}`}`);
      const x = this.doc.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.setAttribute("aria-label", `Remove filter on ${meta?.label ?? f.field}`);
      x.addEventListener("click", () => {
        this.state.filters.splice(i, 1);
        void this.refresh();
      });
      chip.append(x);
      this.chips.append(chip);
    });
  }

  private renderFoot(): void {
    this.foot.replaceChildren();
    const shown = this.mode === "client" ? this.view.length : this.total;
    const all = this.mode === "client" ? this.all.length : null;
    const n = this.doc.createElement("span");
    n.append(strong(shown.toLocaleString()), this.doc.createTextNode(all !== null && all !== shown ? ` of ${all.toLocaleString()} rows` : " rows"));
    this.foot.append(n);
    if (this.mode === "server") this.foot.append(span("", "Sorted and filtered in the database"));
    if (this.selected.size) this.foot.append(span("", `${this.selected.size} selected`));
    if (this.mode === "client") {
      for (const c of this.def.columns.filter((x) => x.kind === "money" && !this.state.hidden.includes(x.field))) {
        const totals = moneyTotals(this.view, c.field, "currency", this.currency);
        if (totals.length) this.foot.append(span("", `${c.label}: ${totals.map((t) => moneyTotal(t.sum, t.currency)).join(" + ")}`));
      }
    }
    if (this.edits?.size) this.foot.append(span("", `${this.edits.size} unsaved change${this.edits.size === 1 ? "" : "s"}`));
    this.foot.append(this.statusEl);
  }

  private renderToolbar(): void {
    const t = this.toolbar;
    const focused = this.doc.activeElement;
    const keepSearch = focused instanceof HTMLInputElement && focused.classList.contains("sxg-search") ? focused.selectionStart : null;
    t.replaceChildren();
    const search = this.doc.createElement("input");
    search.type = "search";
    search.className = "sxg-input sxg-search";
    search.placeholder = "Search";
    search.setAttribute("aria-label", `Search ${this.def.title}`);
    search.value = this.state.search;
    let timer: ReturnType<typeof setTimeout> | undefined;
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.state.search = search.value.slice(0, LIMITS.searchMax);
        void this.refresh();
      }, this.mode === "client" ? 120 : 350);
    });
    t.append(search, this.button("Filter", () => void this.addFilterDialog()));

    if (this.mode === "client" && !this.def.tree) {
      const group = this.doc.createElement("select");
      group.className = "sxg-select";
      group.setAttribute("aria-label", "Group by");
      group.append(option("", "No grouping"), ...this.def.columns.filter((c) => c.kind !== "memo").map((c) => option(c.field, `Group by ${c.label}`)));
      group.value = this.state.groupBy[0] ?? "";
      group.addEventListener("change", () => {
        this.state.groupBy = group.value ? [group.value] : [];
        this.expanded = true;
        void this.refresh();
      });
      t.append(group);
    }
    t.append(this.button("Columns", () => void this.columnsDialog()));

    if (this.opts.savedViews !== false) {
      const views = this.doc.createElement("select");
      views.className = "sxg-select";
      views.setAttribute("aria-label", "Saved views");
      views.append(option("", "Default view"), ...this.views.map((v) => option(v.id, `${v.name}${v.shared ? " (shared)" : ""}`)));
      views.value = this.currentView?.id ?? "";
      views.addEventListener("change", () => this.applyView(this.views.find((v) => v.id === views.value) ?? null));
      t.append(views, this.button("Save view", () => void this.saveViewDialog()));
    } else if (this.opts.stateKey) {
      t.append(this.button("Reset layout", () => this.applyView(null)));
    }
    t.append(this.button("Export CSV", () => void this.exportAs("csv")), this.button("Export Excel", () => void this.exportAs("xlsx")));
    for (const a of this.opts.actions ?? []) t.append(this.button(a.label, a.onClick));
    // The grid's own actions on the selected rows (for example replaying quarantined records).
    if (this.def.actions?.length && this.api.runAction) {
      t.append(div("sxg-spacer"));
      for (const a of this.def.actions) t.append(this.button(a.label, () => void this.runAction(a), !this.selected.size || this.busy));
    }

    if (this.edits) {
      t.append(div("sxg-spacer"));
      t.append(this.button("Add row", () => void this.addRowDialog()));
      if (this.def.bulkEdit.length) t.append(this.button("Bulk edit", () => void this.bulkEditDialog(), !this.selected.size));
      t.append(this.button("Delete", () => void this.deleteSelected(), !this.selected.size));
      t.append(this.button("Discard", () => this.discard(), !this.edits.size || this.busy));
      const save = this.button(this.edits.size ? `Save ${this.edits.size}` : "Save", () => void this.save(), !this.edits.size || this.busy);
      save.classList.add("sxg-primary");
      t.append(save);
    }
    if (keepSearch !== null) {
      search.focus();
      search.setSelectionRange(keepSearch, keepSearch);
    }
  }

  private button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const b = this.doc.createElement("button");
    b.type = "button";
    b.className = "sxg-btn";
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener("click", onClick);
    return b;
  }

  private setStatus(message: string, bad = false): void {
    this.statusEl.textContent = message;
    this.statusEl.classList.toggle("sxg-bad", bad);
  }

  // ── Sorting, resizing, expanding ─────────────────────────────────────────

  private setActive(r: number, c: number): void {
    this.active = { r, c };
    for (const el of this.body.querySelectorAll(".sxg-active")) el.classList.remove("sxg-active");
    const cell = this.body.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
    if (!cell) return this.renderBody();
    cell.classList.add("sxg-active");
    if (cell.id) this.scroll.setAttribute("aria-activedescendant", cell.id);
  }

  private toggleSort(field: string, add: boolean): void {
    const i = this.state.sort.findIndex((s) => s.field === field);
    const cur = this.state.sort[i];
    const next: SortSpec[] = add ? [...this.state.sort] : cur ? [cur] : [];
    const j = next.findIndex((s) => s.field === field);
    if (j < 0) next.push({ field, dir: "asc" });
    else if (next[j]!.dir === "asc") next[j] = { field, dir: "desc" };
    else next.splice(j, 1);
    this.state.sort = next;
    void this.refresh();
  }

  private startResize(e: PointerEvent, col: Column<Row, unknown>): void {
    e.preventDefault();
    e.stopPropagation();
    const start = e.clientX;
    const width = col.getSize();
    const move = (ev: PointerEvent) => {
      this.state.sizing = { ...this.state.sizing, [col.id]: Math.max(60, Math.min(800, width + ev.clientX - start)) };
      this.syncTable();
      this.renderHeader();
      this.renderBody();
    };
    const up = () => {
      this.doc.removeEventListener("pointermove", move);
      this.doc.removeEventListener("pointerup", up);
    };
    this.doc.addEventListener("pointermove", move);
    this.doc.addEventListener("pointerup", up);
  }

  private toggleRow(r: number): void {
    const d = this.displayAt(r);
    const tr = d.kind === "group" ? d.trow : d.trow;
    if (tr?.getCanExpand()) tr.toggleExpanded();
  }

  private toggleSelect(r: number): void {
    const d = this.displayAt(r);
    if (d.kind !== "row" || !d.row) return;
    const code = String(d.row[this.def.key]);
    if (this.selected.has(code)) this.selected.delete(code);
    else this.selected.add(code);
    this.render();
  }

  /** Selected rows the user may change (platform rows of a vocabulary grid are skipped). */
  private editableSelection(): Row[] {
    return this.loadedRows().filter((r) => this.selected.has(String(r[this.def.key])) && !(this.def.readOnlyWhen && r[this.def.readOnlyWhen] === true));
  }

  private loadedRows(): Row[] {
    return this.mode === "client" ? this.view : [...this.pages.values()].flat();
  }

  private navigate(r: number, c: number): void {
    const d = this.displayAt(r);
    const meta = this.cols.get(this.visibleColumns()[c]?.id ?? "");
    if (d.kind !== "row" || !d.row || !meta?.fk) return;
    const v = d.row[meta.field];
    if (v) this.opts.onNavigate?.(meta.fk, String(v));
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────

  private onKey(e: KeyboardEvent): void {
    if (this.editing) return; // the editor handles its own keys
    const cols = this.visibleColumns().length;
    const rows = this.count();
    const page = Math.max(1, Math.floor(this.scroll.clientHeight / this.rowHeight) - 1);
    let { r, c } = this.active;
    switch (e.key) {
      case "ArrowDown": r++; break;
      case "ArrowUp": r--; break;
      case "ArrowRight": c++; break;
      case "ArrowLeft": c--; break;
      case "PageDown": r += page; break;
      case "PageUp": r -= page; break;
      case "Home": if (e.ctrlKey) r = 0; c = 0; break;
      case "End": if (e.ctrlKey) r = rows - 1; c = cols - 1; break;
      case "Enter":
      case "F2":
        e.preventDefault();
        if (this.displayAt(r).kind === "group") this.toggleRow(r);
        else this.beginEdit(r, c);
        return;
      case " ":
        if (this.selectable) {
          e.preventDefault();
          this.toggleSelect(r);
        }
        return;
      case "Delete":
        if (this.edits && this.canEditCell(this.rowAt(r), this.cols.get(this.visibleColumns()[c]!.id)!)) {
          e.preventDefault();
          this.setCell(r, c, "");
        }
        return;
      case "s":
        if ((e.ctrlKey || e.metaKey) && this.edits?.size) {
          e.preventDefault();
          void this.save();
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    this.active = { r: clamp(r, 0, rows - 1), c: clamp(c, 0, cols - 1) };
    this.virtualizer.scrollToIndex(this.active.r, { align: "auto" });
    this.renderBody();
  }

  // ── Editing ──────────────────────────────────────────────────────────────

  private rowAt(r: number): Row | null {
    const d = this.displayAt(r);
    return d.kind === "row" ? d.row : null;
  }

  private canEditCell(row: Row | null, meta: GridColumn): boolean {
    if (!this.edits || !row || !meta.editable) return false;
    if (this.def.readOnlyWhen && row[this.def.readOnlyWhen] === true) return false;
    return !this.edits.isDeleted(String(row[this.def.key]));
  }

  private beginEdit(r: number, c: number): void {
    const col = this.visibleColumns()[c];
    const row = this.rowAt(r);
    if (!col || !row || !this.canEditCell(row, this.cols.get(col.id)!)) return;
    this.active = { r, c };
    this.editing = { r, c };
    this.renderBody();
  }

  private editor(row: Row, meta: GridColumn): HTMLElement {
    const current = this.edits!.value(row, meta.field);
    if (meta.kind === "boolean") {
      const sel = this.doc.createElement("select");
      sel.className = "sxg-editor";
      sel.append(option("", "—"), option("true", "Yes"), option("false", "No"));
      sel.value = current === true ? "true" : current === false ? "false" : "";
      this.wireEditor(sel, meta);
      return sel;
    }
    const input = this.doc.createElement("input");
    input.className = "sxg-editor";
    input.value = editText(meta, current);
    input.setAttribute("aria-label", meta.label);
    if (meta.kind === "date") input.placeholder = "YYYY-MM-DD";
    if (meta.kind === "datetime") input.placeholder = "YYYY-MM-DD HH:MM";
    if (meta.kind === "ref" || meta.kind === "fk") {
      const list = this.doc.createElement("datalist");
      list.id = `${this.id}-options`;
      input.setAttribute("list", list.id);
      const load = async (q: string) => {
        try {
          const opts = await this.api.options(meta.kind as "ref" | "fk", (meta.kind === "ref" ? meta.ref : meta.fk)!, meta.scope ?? null, q);
          list.replaceChildren(...opts.map((o) => option(o.code, o.label ? `${o.code} — ${o.label}` : o.code)));
        } catch {
          /* the server validates the value on save */
        }
      };
      void load("");
      let t: ReturnType<typeof setTimeout> | undefined;
      input.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => void load(input.value), 200);
      });
      const wrap = this.doc.createElement("span");
      wrap.style.display = "contents";
      wrap.append(input, list);
      this.wireEditor(input, meta);
      return wrap;
    }
    this.wireEditor(input, meta);
    return input;
  }

  private wireEditor(el: HTMLInputElement | HTMLSelectElement, _meta: GridColumn): void {
    el.addEventListener("keydown", (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "Escape") {
        ke.preventDefault();
        this.editing = null;
        this.scroll.focus();
        this.renderBody();
      } else if (ke.key === "Enter" || ke.key === "Tab") {
        ke.preventDefault();
        if (this.commitEdit()) {
          const cols = this.visibleColumns().length;
          this.active = ke.key === "Tab" ? { r: this.active.r, c: clamp(this.active.c + (ke.shiftKey ? -1 : 1), 0, cols - 1) } : { r: clamp(this.active.r + 1, 0, this.count() - 1), c: this.active.c };
          this.scroll.focus();
          this.renderBody();
        }
      }
      ke.stopPropagation();
    });
    el.addEventListener("blur", () => {
      if (this.editing) this.commitEdit();
    });
  }

  /** Commits the open editor; false (editor kept open, cell marked) when the value does not parse. */
  private commitEdit(): boolean {
    if (!this.editing) return true;
    const { r, c } = this.editing;
    const el = this.body.querySelector<HTMLInputElement | HTMLSelectElement>(".sxg-editor");
    this.editing = null;
    if (!el) return true;
    const ok = this.setCell(r, c, el.value);
    if (!ok) this.editing = { r, c };
    this.renderBody();
    return ok;
  }

  private setCell(r: number, c: number, text: string): boolean {
    const row = this.rowAt(r);
    const meta = this.cols.get(this.visibleColumns()[c]!.id)!;
    if (!row || !this.edits) return true;
    const parsed = meta.kind === "boolean" ? { value: text === "" ? null : text === "true" } : parseCellInput(meta.kind, text);
    const code = String(row[this.def.key]);
    if ("error" in parsed) {
      this.cellError = { code, field: meta.field, message: parsed.error };
      this.setStatus(`${meta.label}: ${parsed.error}`, true);
      return false;
    }
    this.cellError = null;
    this.edits.set(row, meta.field, parsed.value);
    if (this.edits.isNew(code)) row[meta.field] = parsed.value;
    this.setStatus("");
    this.renderFoot();
    this.renderToolbar();
    return true;
  }

  private discard(): void {
    this.edits?.discard();
    this.added = [];
    this.cellError = null;
    this.render();
    this.setStatus("Changes discarded");
  }

  /** Saves every pending edit as one change set; on a conflict, asks the user how to resolve it. */
  async save(): Promise<boolean> {
    if (!this.edits) return false;
    if (this.editing && !this.commitEdit()) return false;
    const req = this.edits.toChangeSet();
    if (!req) return true;
    this.busy = true;
    this.renderToolbar();
    this.setStatus("Saving…");
    this.opts.live?.ignore(req.id);
    try {
      const res = await this.api.applyChanges(req);
      this.edits.discard();
      this.added = [];
      this.selected.clear();
      this.setStatus(`${res.items.length} change${res.items.length === 1 ? "" : "s"} saved${res.replayed ? " (already applied)" : ""}`);
      await this.reloadAfterSave();
      return true;
    } catch (e) {
      const conflict = e instanceof GridApiError ? e.conflict : null;
      if (conflict) {
        const choice = await this.conflictDialog(conflict.code, conflict.current, conflict.message);
        if (choice === "mine") {
          this.edits.rebase(conflict.code, Number(conflict.current.row_version));
          this.busy = false;
          return this.save();
        }
        if (choice === "theirs") {
          this.edits.discard(conflict.code);
          this.replaceRow(conflict.code, conflict.current);
          this.setStatus(`${conflict.code}: kept the current version`);
        } else this.setStatus(conflict.message, true);
      } else this.setStatus(errorText(e), true);
      return false;
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async reloadAfterSave(): Promise<void> {
    if (this.mode === "client") {
      const rows: Row[] = [];
      for (;;) {
        const page = await this.api.rows(this.def.id, { offset: rows.length, limit: LIMITS.pageMax, sort: this.state.sort, filters: [] });
        rows.push(...page.rows);
        if (!page.rows.length || rows.length >= page.total) break;
      }
      this.all = rows;
    }
    await this.refresh();
  }

  /**
   * Others' changes to this grid's entity. Changed rows are fetched by key and merged (a full reload when many changed
   * or the feed overflowed); the user's unsaved edits stay, and a conflict surfaces when they save. While the user is
   * typing or saving, the update waits for them.
   */
  private async onLive(items: ChangeFeedItem[], truncated: boolean): Promise<void> {
    if (this.busy || this.editing) {
      this.liveQueue = { items: [...(this.liveQueue?.items ?? []), ...items], truncated: truncated || !!this.liveQueue?.truncated };
      return;
    }
    const codes = [...new Set(items.map((i) => i.code))];
    try {
      if (this.mode === "server") await this.refresh();
      else if (truncated || codes.length > LIVE_MERGE_MAX) await this.reloadAfterSave();
      else {
        const page = await this.api.rows(this.def.id, { offset: 0, limit: LIMITS.pageMax, sort: this.state.sort, filters: [{ field: this.def.key, op: "in", value: codes }] });
        const fresh = new Map(page.rows.map((r) => [String(r[this.def.key]), r]));
        const kept = this.all.filter((r) => !codes.includes(String(r[this.def.key])) || fresh.has(String(r[this.def.key])));
        const at = new Map(kept.map((r, i) => [String(r[this.def.key]), i]));
        for (const [code, row] of fresh) {
          const i = at.get(code);
          if (i === undefined) kept.push(row);
          else kept[i] = row;
        }
        this.all = kept;
        await this.refresh();
      }
      const n = truncated ? "Many records" : `${codes.length} record${codes.length === 1 ? "" : "s"}`;
      this.setStatus(`${n} updated by others just now${this.pendingCount() ? "; your unsaved edits are kept" : ""}`);
    } catch {
      /* the next change, or a reload, brings the grid up to date */
    }
  }

  /** Applies live updates that arrived while the user was editing or saving. */
  private flushLive(): void {
    const q = this.liveQueue;
    if (!q || this.busy || this.editing) return;
    this.liveQueue = null;
    // After the current draw, never inside it.
    queueMicrotask(() => void this.onLive(q.items, q.truncated));
  }

  private replaceRow(code: string, current: Row): void {
    const swap = (rows: Row[]) => {
      const i = rows.findIndex((r) => String(r[this.def.key]) === code);
      if (i >= 0) rows[i] = { ...rows[i], ...pick(current, [...this.cols.keys(), "row_version", "currency"]) };
    };
    swap(this.all);
    for (const p of this.pages.values()) swap(p);
    void this.refresh();
  }

  // ── Dialogs ──────────────────────────────────────────────────────────────

  private dialog(title: string, content: Node[], actions: Array<{ id: string; label: string; primary?: boolean }>): Promise<string | null> {
    return new Promise((resolve) => {
      const panel = div("sxg-panel");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      const h = this.doc.createElement("h3");
      h.textContent = title;
      h.id = `${this.id}-dlg`;
      panel.setAttribute("aria-labelledby", h.id);
      const bar = div("sxg-actions");
      const close = (v: string | null) => {
        this.dialogEl.hidden = true;
        this.dialogEl.replaceChildren();
        this.scroll.focus();
        resolve(v);
      };
      for (const a of actions) {
        const b = this.button(a.label, () => close(a.id));
        if (a.primary) b.classList.add("sxg-primary");
        bar.append(b);
      }
      bar.append(this.button("Cancel", () => close(null)));
      panel.append(h, ...content, bar);
      panel.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close(null);
        e.stopPropagation();
      });
      this.dialogEl.replaceChildren(panel);
      this.dialogEl.hidden = false;
      (panel.querySelector<HTMLElement>("input,select,button") ?? panel).focus();
    });
  }

  private field(label: string, control: HTMLElement): HTMLLabelElement {
    const l = this.doc.createElement("label");
    l.append(this.doc.createTextNode(label), control);
    return l;
  }

  private async addFilterDialog(): Promise<void> {
    const fieldSel = this.doc.createElement("select");
    fieldSel.className = "sxg-select";
    fieldSel.append(...this.def.columns.map((c) => option(c.field, c.label)));
    const opSel = this.doc.createElement("select");
    opSel.className = "sxg-select";
    const value = this.doc.createElement("input");
    value.className = "sxg-input";
    const sync = () => {
      const meta = this.cols.get(fieldSel.value)!;
      opSel.replaceChildren(...opsFor(meta.kind).map((o) => option(o, OP_LABEL[o])));
      value.placeholder = meta.kind === "date" ? "YYYY-MM-DD" : meta.kind === "boolean" ? "yes / no" : opSel.value === "in" ? "comma-separated" : "";
    };
    fieldSel.addEventListener("change", sync);
    opSel.addEventListener("change", () => (value.disabled = opSel.value === "empty" || opSel.value === "notEmpty"));
    sync();
    const choice = await this.dialog("Add filter", [this.field("Column", fieldSel), this.field("Condition", opSel), this.field("Value", value)], [{ id: "add", label: "Add filter", primary: true }]);
    if (choice !== "add") return;
    const meta = this.cols.get(fieldSel.value)!;
    const op = opSel.value as GridFilter["op"];
    if (!(FILTER_OPS as readonly string[]).includes(op)) return;
    const f: GridFilter = { field: meta.field, op };
    if (op !== "empty" && op !== "notEmpty") {
      const parts = op === "in" ? value.value.split(",").map((s) => s.trim()).filter(Boolean) : [value.value];
      const parsed = parts.map((p) => (meta.kind === "ref" || meta.kind === "fk" || meta.kind === "text" || meta.kind === "memo" || meta.kind === "url" ? { value: p } : parseCellInput(meta.kind, p)));
      const bad = parsed.find((p) => "error" in p);
      if (bad || !parts.length || parsed.some((p) => "value" in p && p.value === null)) {
        this.setStatus(`${meta.label}: ${bad && "error" in bad ? bad.error : "enter a value"}`, true);
        return;
      }
      const values = parsed.map((p) => (p as { value: string | number | boolean }).value);
      f.value = op === "in" ? (values as Array<string | number>) : values[0]!;
    }
    this.state.filters.push(f);
    await this.refresh();
  }

  private async columnsDialog(): Promise<void> {
    const list = this.doc.createElement("ul");
    list.className = "sxg-cols";
    const order = [...this.state.columnOrder];
    const hidden = new Set(this.state.hidden);
    const pinned = new Set(this.state.pinned);
    const draw = () => {
      list.replaceChildren();
      order.forEach((f, i) => {
        const meta = this.cols.get(f)!;
        const li = this.doc.createElement("li");
        const show = this.doc.createElement("input");
        show.type = "checkbox";
        show.checked = !hidden.has(f);
        show.setAttribute("aria-label", `Show ${meta.label}`);
        show.addEventListener("change", () => (show.checked ? hidden.delete(f) : hidden.add(f)));
        const pin = this.button(pinned.has(f) ? "Unpin" : "Pin", () => {
          if (pinned.has(f)) pinned.delete(f);
          else pinned.add(f);
          draw();
        });
        const up = this.button("↑", () => {
          if (i > 0) [order[i - 1], order[i]] = [order[i]!, order[i - 1]!];
          draw();
        }, i === 0);
        up.setAttribute("aria-label", `Move ${meta.label} left`);
        const down = this.button("↓", () => {
          if (i < order.length - 1) [order[i + 1], order[i]] = [order[i]!, order[i + 1]!];
          draw();
        }, i === order.length - 1);
        down.setAttribute("aria-label", `Move ${meta.label} right`);
        li.append(show, span("", meta.label), pin, up, down);
        list.append(li);
      });
    };
    draw();
    if ((await this.dialog("Columns", [list], [{ id: "apply", label: "Apply", primary: true }])) !== "apply") return;
    this.state.columnOrder = order;
    this.state.hidden = [...hidden];
    this.state.pinned = order.filter((f) => pinned.has(f));
    this.syncTable();
    this.render();
  }

  private applyView(v: SavedView | null): void {
    this.currentView = v;
    this.state = this.cleanState((v?.state ?? {}) as Partial<GridViewState>);
    void this.refresh();
  }

  /** A stored view state, kept to the columns this grid still has. */
  private cleanState(s: Partial<GridViewState>): GridViewState {
    const known = (f: string) => this.cols.has(f);
    return {
      sort: (s.sort ?? this.def.defaultSort).filter((x) => known(x.field)),
      filters: (s.filters ?? []).filter((x) => known(x.field)),
      search: typeof s.search === "string" ? s.search : "",
      groupBy: (s.groupBy ?? []).filter(known),
      columnOrder: [...(s.columnOrder ?? []).filter(known), ...this.def.columns.map((c) => c.field).filter((f) => !(s.columnOrder ?? []).includes(f))],
      hidden: (s.hidden ?? []).filter(known),
      pinned: (s.pinned ?? (this.def.columns[0] ? [this.def.columns[0].field] : [])).filter(known),
      sizing: Object.fromEntries(Object.entries(s.sizing ?? {}).filter(([k, n]) => known(k) && typeof n === "number")),
    };
  }

  private async saveViewDialog(): Promise<void> {
    const name = this.doc.createElement("input");
    name.className = "sxg-input";
    name.maxLength = 80;
    name.value = this.currentView?.mine ? this.currentView.name : "";
    const share = this.doc.createElement("input");
    share.type = "checkbox";
    share.checked = this.currentView?.shared ?? false;
    const content: Node[] = [this.field("Name", name)];
    if (this.opts.role === "admin") {
      const l = this.field("Share with everyone in this tenant", share);
      l.classList.add("sxg-inline");
      content.push(l);
    }
    const actions = [{ id: "new", label: "Save as new", primary: !this.currentView?.mine }];
    if (this.currentView?.mine) actions.unshift({ id: "update", label: `Update "${this.currentView.name}"`, primary: true }, { id: "delete", label: "Delete view", primary: false });
    const choice = await this.dialog("Save view", content, actions);
    if (!choice) return;
    try {
      if (choice === "delete" && this.currentView) {
        await this.api.deleteView(this.def.id, this.currentView.id);
        this.currentView = null;
      } else {
        if (!name.value.trim()) return this.setStatus("A view needs a name", true);
        const saved = await this.api.saveView(this.def.id, { name: name.value.trim(), shared: share.checked, state: this.viewState() as unknown as Record<string, unknown> }, choice === "update" ? this.currentView ?? undefined : undefined);
        this.currentView = saved;
      }
      this.views = await this.api.views(this.def.id);
      this.setStatus(choice === "delete" ? "View deleted" : "View saved");
      this.renderToolbar();
    } catch (e) {
      this.setStatus(errorText(e), true);
    }
  }

  private async addRowDialog(): Promise<void> {
    const code = this.doc.createElement("input");
    code.className = "sxg-input";
    code.maxLength = 200;
    if ((await this.dialog(`New ${this.def.title.toLowerCase().replace(/s$/, "")}`, [this.field(this.cols.get(this.def.key)?.label === "Scope:Code" ? "Scope:Code (for example work_order:ON_HOLD)" : "Business code", code)], [{ id: "add", label: "Add", primary: true }])) !== "add") return;
    const value = code.value.trim();
    if (!value) return this.setStatus("A new row needs its business code", true);
    if (this.all.some((r) => String(r[this.def.key]) === value) || this.edits!.has(value)) return this.setStatus(`${value} already exists`, true);
    this.edits!.insert(value);
    this.added.unshift({ [this.def.key]: value });
    this.active = { r: 0, c: 1 };
    this.render();
    this.virtualizer.scrollToIndex(0);
  }

  private async bulkEditDialog(): Promise<void> {
    const fieldSel = this.doc.createElement("select");
    fieldSel.className = "sxg-select";
    fieldSel.append(...this.def.bulkEdit.map((f) => option(f, this.cols.get(f)!.label)));
    const value = this.doc.createElement("input");
    value.className = "sxg-input";
    const n = this.selected.size;
    const choice = await this.dialog(`Bulk edit ${n} row${n === 1 ? "" : "s"}`, [this.field("Column", fieldSel), this.field("New value", value)], [{ id: "next", label: "Review", primary: true }]);
    if (choice !== "next") return;
    const meta = this.cols.get(fieldSel.value)!;
    const parsed = meta.kind === "ref" || meta.kind === "fk" ? { value: value.value.trim() || null } : parseCellInput(meta.kind, value.value);
    if ("error" in parsed) return this.setStatus(`${meta.label}: ${parsed.error}`, true);
    const confirm = await this.dialog("Confirm bulk edit", [this.doc.createTextNode(`Set ${meta.label} to "${parsed.value ?? "(empty)"}" on ${n} row${n === 1 ? "" : "s"}? The change is saved, audited and attributed to you when you press Save.`)], [{ id: "apply", label: `Apply to ${n}`, primary: true }]);
    if (confirm !== "apply") return;
    for (const r of this.editableSelection()) this.edits!.set(r, meta.field, parsed.value);
    this.render();
  }

  private async deleteSelected(): Promise<void> {
    const n = this.selected.size;
    const confirm = await this.dialog("Delete rows", [this.doc.createTextNode(`Mark ${n} row${n === 1 ? "" : "s"} for deletion? Nothing is deleted until you press Save; a row other records still reference cannot be deleted (deactivate it instead).`)], [{ id: "delete", label: `Delete ${n}`, primary: true }]);
    if (confirm !== "delete") return;
    for (const r of this.editableSelection()) this.edits!.remove(r);
    this.added = this.added.filter((r) => this.edits!.has(String(r[this.def.key])));
    this.selected.clear();
    this.render();
  }

  private async conflictDialog(code: string, current: Row, message: string): Promise<"mine" | "theirs" | null> {
    const table = this.doc.createElement("table");
    const head = this.doc.createElement("tr");
    for (const h of ["Column", "Your edit", "Current"]) head.append(th(this.doc, h));
    table.append(head);
    const mine = this.loadedRows().find((r) => String(r[this.def.key]) === code) ?? {};
    for (const col of this.def.columns) {
      if (!this.edits!.isDirty(code, col.field) && sameText(mine[col.field], current[col.field])) continue;
      const tr = this.doc.createElement("tr");
      tr.append(td(this.doc, col.label), td(this.doc, this.text(col, this.edits!.value(mine, col.field), mine)), td(this.doc, this.text(col, current[col.field], current)));
      table.append(tr);
    }
    const p = this.doc.createElement("p");
    p.textContent = `${message}. Someone saved ${code} after you opened it.`;
    const choice = await this.dialog(`${code} changed`, [p, table], [{ id: "mine", label: "Keep my edit", primary: true }, { id: "theirs", label: "Use current" }]);
    return choice === "mine" || choice === "theirs" ? choice : null;
  }

  // ── Export ───────────────────────────────────────────────────────────────

  async exportAs(format: "csv" | "xlsx"): Promise<void> {
    this.setStatus("Preparing export…");
    try {
      const res = await this.api.exportRows(this.def.id, format, this.query());
      const cols = this.visibleColumns().map((c) => this.cols.get(c.id)!);
      const header = cols.map((c) => c.label);
      const body = res.rows.map((r) => cols.map((c) => exportValue(c, r[c.field])));
      const name = `${this.def.id}-${new Date().toISOString().slice(0, 10)}`;
      const XLSX = (globalThis as { XLSX?: { utils: { aoa_to_sheet(a: unknown[][]): unknown; book_new(): unknown; book_append_sheet(b: unknown, s: unknown, n: string): void }; write(b: unknown, o: Record<string, unknown>): ArrayBuffer } }).XLSX;
      if (format === "xlsx" && XLSX) {
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, ...body]), this.def.title.slice(0, 31));
        this.download(new Blob([XLSX.write(book, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`);
      } else {
        this.download(new Blob([toCsv([header, ...body])], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
      }
      this.setStatus(`Exported ${res.rows.length.toLocaleString()} rows${res.truncated ? ` of ${res.total.toLocaleString()} (export limit)` : ""}`);
    } catch (e) {
      this.setStatus(errorText(e), true);
    }
  }

  private download(blob: Blob, name: string): void {
    const a = this.doc.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    this.doc.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const OP_LABEL: Record<GridFilter["op"], string> = {
  eq: "is",
  neq: "is not",
  lt: "<",
  lte: "≤",
  gt: ">",
  gte: "≥",
  contains: "contains",
  starts: "starts with",
  in: "is one of",
  empty: "is empty",
  notEmpty: "is not empty",
};

function defaultWidth(c: GridColumn): number {
  if (c.width) return c.width;
  if (c.kind === "memo") return 280;
  if (c.kind === "boolean") return 90;
  if (c.kind === "date") return 120;
  if (c.kind === "datetime") return 150;
  if (c.kind === "integer" || c.kind === "decimal") return 120;
  if (c.kind === "money") return 150;
  return Math.min(260, Math.max(120, c.label.length * 9));
}

function div(cls: string): HTMLDivElement {
  const d = document.createElement("div");
  if (cls) d.className = cls;
  return d;
}

function span(cls: string, text: string): HTMLSpanElement {
  const s = document.createElement("span");
  if (cls) s.className = cls;
  s.textContent = text;
  return s;
}

function strong(text: string): HTMLElement {
  const s = document.createElement("strong");
  s.textContent = text;
  return s;
}

function option(value: string, label: string): HTMLOptionElement {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}

const th = (d: Document, t: string) => Object.assign(d.createElement("th"), { textContent: t });
const td = (d: Document, t: string) => Object.assign(d.createElement("td"), { textContent: t });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const sameText = (a: unknown, b: unknown) => String(a ?? "") === String(b ?? "");
const pick = (r: Row, keys: string[]) => Object.fromEntries(keys.filter((k) => k in r).map((k) => [k, r[k]]));

function errorText(e: unknown): string {
  if (e instanceof GridApiError) return e.status === 401 ? "Your session has ended. Sign in to AIP again." : e.status === 402 ? "This licence does not allow that." : e.message;
  return e instanceof Error ? e.message : "Something went wrong";
}

/** Export values keep amounts exact (as text) and never start with a formula character. */
export function exportValue(c: GridColumn, v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (c.kind === "integer" && typeof v === "number") return v;
  if (c.kind === "boolean") return v === true ? "Yes" : v === false ? "No" : String(v);
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) && !(c.kind === "decimal" || c.kind === "money") ? `'${s}` : s;
}

export function toCsv(rows: Array<Array<string | number | boolean | null>>): string {
  const cell = (v: string | number | boolean | null) => {
    if (v === null) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
