/**
 * The Enterprise Grid workspace: every grid in the catalogue, grouped by the screen it serves, one open at a time.
 * The open grid and drill-through filters live in the URL hash, so a link opens the same rows.
 */
import type { GridFilter } from "../contract.ts";
import { GridApiError, type CatalogueGrid, type GridApi } from "./api.ts";
import { SustantixGrid } from "./grid.ts";
import { LiveFeed } from "./live.ts";
import { injectStyles } from "./styles.ts";

export interface WorkspaceOptions {
  api: GridApi;
  currency?: string;
  /** Keep the open grid in the URL hash (the standalone workspace page); off when embedded in another page. */
  useHash?: boolean;
  /** The grid to open first when the hash does not name one. */
  initial?: string;
}

export async function mountWorkspace(root: HTMLElement, opts: WorkspaceOptions): Promise<{ open(id: string, filters?: GridFilter[]): void }> {
  const doc = root.ownerDocument;
  injectStyles(doc);
  root.classList.add("sxg-ws");
  const nav = doc.createElement("nav");
  nav.className = "sxg-ws-nav";
  nav.setAttribute("aria-label", "Grids");
  const main = doc.createElement("main");
  main.className = "sxg-ws-main";
  root.replaceChildren(nav, main);

  let catalogue: { role: string; grids: CatalogueGrid[] };
  try {
    catalogue = await opts.api.catalogue();
  } catch (e) {
    main.textContent =
      e instanceof GridApiError && e.status === 401
        ? "Sign in to Sustantix AIP first, then reopen the grids."
        : e instanceof GridApiError && e.status === 402
          ? "This licence does not include the Enterprise Grid."
          : "The grid service is not available on this deployment.";
    return { open: () => undefined };
  }

  let current: SustantixGrid | null = null;
  // One feed for the page: the open grid follows others' changes while the page is shown.
  const live = opts.api.changes ? new LiveFeed(opts.api) : null;
  if (live) doc.addEventListener("visibilitychange", () => doc.visibilityState === "visible" && void live.poll());
  const buttons = new Map<string, HTMLButtonElement>();

  const open = (id: string, filters: GridFilter[] = []) => {
    const def = catalogue.grids.find((g) => g.id === id) ?? catalogue.grids[0];
    if (!def) return;
    if (current?.pendingCount() && !confirmLeave(doc)) return;
    current?.destroy();
    for (const [gid, b] of buttons) b.setAttribute("aria-current", String(gid === def.id));
    const title = doc.createElement("h1");
    title.className = "sxg-ws-title";
    title.textContent = def.title;
    const sub = doc.createElement("p");
    sub.className = "sxg-ws-sub";
    sub.textContent = `${def.screen}${def.canEdit ? " · editable" : " · read-only"}`;
    const host = doc.createElement("div");
    host.className = "sxg-ws-grid";
    main.replaceChildren(title, sub, host);
    current = new SustantixGrid(host, {
      api: opts.api,
      def,
      role: catalogue.role,
      filters,
      ...(live ? { live } : {}),
      ...(opts.currency ? { currency: opts.currency } : {}),
      onNavigate: (entity, code) => {
        const target = catalogue.grids.find((g) => g.entity === entity);
        if (target) navigate(target.id, [{ field: "code", op: "eq", value: code }]);
      },
    });
    void current.load();
  };

  const useHash = opts.useHash !== false;
  const navigate = (id: string, filters: GridFilter[] = []) => {
    if (!useHash) return open(id, filters);
    const hash = `#grid=${encodeURIComponent(id)}${filters.length ? `&filters=${encodeURIComponent(JSON.stringify(filters))}` : ""}`;
    if (location.hash === hash) open(id, filters);
    else location.hash = hash;
  };

  const screens = new Map<string, CatalogueGrid[]>();
  for (const g of catalogue.grids) screens.set(g.screen, [...(screens.get(g.screen) ?? []), g]);
  for (const [screen, list] of screens) {
    const h = doc.createElement("h2");
    h.textContent = screen;
    nav.append(h);
    for (const g of list) {
      const b = doc.createElement("button");
      b.type = "button";
      b.textContent = g.title;
      b.addEventListener("click", () => navigate(g.id));
      buttons.set(g.id, b);
      nav.append(b);
    }
  }

  const fromHash = () => {
    const p = new URLSearchParams(location.hash.slice(1));
    let filters: GridFilter[] = [];
    try {
      const raw = JSON.parse(p.get("filters") ?? "[]") as unknown;
      if (Array.isArray(raw)) filters = raw.filter((f): f is GridFilter => !!f && typeof f === "object" && typeof (f as GridFilter).field === "string" && typeof (f as GridFilter).op === "string").slice(0, 20);
    } catch {
      /* ignore a malformed link */
    }
    open(p.get("grid") ?? catalogue.grids[0]?.id ?? "", filters);
  };
  if (useHash) {
    addEventListener("hashchange", fromHash);
    addEventListener("beforeunload", (e) => {
      if (current?.pendingCount()) e.preventDefault();
    });
    fromHash();
  } else open(opts.initial ?? catalogue.grids[0]?.id ?? "");
  return { open: navigate };
}

function confirmLeave(doc: Document): boolean {
  return (doc.defaultView?.confirm ?? (() => true))("You have unsaved changes in this grid. Leave without saving?");
}
