import type { GridHost } from "./types.js";

/** Where a host without server configuration keeps its screen-grid switch (standalone demos, QA, Power Apps today). */
export const GRID_SCREENS_KEY = "sx_aip_grid_screens";

export function parseScreens(v: string | null | undefined): string[] | "all" {
  const s = (v ?? "").trim();
  if (s === "all") return "all";
  return s.split(",").map((x) => x.trim()).filter((x) => /^[a-z][a-z0-9]*$/.test(x));
}

export function localGridHost(): GridHost {
  return {
    async screens() {
      try {
        return parseScreens(localStorage.getItem(GRID_SCREENS_KEY));
      } catch {
        return [];
      }
    },
  };
}

declare global {
  interface Window {
    AIPGrid?: {
      mountScreenGrids(doc: Document, opts: { screens: string[] | "all"; workspace?: { url?: string; api: unknown }; recordExport?: GridHost["recordExport"] }): unknown;
      httpGridApi(base?: string): unknown;
    };
  }
}

/** Loads the grid bundle shipped beside the runtime and mounts the switched-on screen grids. */
export async function installScreenGrids(host: GridHost, bundleUrl = "grid/aip-grid.js"): Promise<void> {
  const screens = await host.screens().catch(() => [] as string[]);
  if (screens !== "all" && !screens.length) return;
  if (!window.AIPGrid) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = bundleUrl;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`grid bundle ${bundleUrl} not available`));
      document.head.appendChild(s);
    });
  }
  const grid = window.AIPGrid!;
  const api = host.api === "http" ? grid.httpGridApi() : host.api;
  grid.mountScreenGrids(document, {
    screens,
    ...(api ? { workspace: { ...(host.workspaceUrl ? { url: host.workspaceUrl } : {}), api } } : {}),
    ...(host.recordExport ? { recordExport: host.recordExport } : {}),
  });
}
