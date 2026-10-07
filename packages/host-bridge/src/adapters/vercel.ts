import type { LicenseStatus, RuntimeEnvironment } from "@sustantix/license";
import { DatasetsChanged, loadDatasets, type DatasetManifest } from "../dataset-loader.js";
import type { Json } from "../dataset-parts.js";
import { governedSync, type ImportResult } from "../governed-sync.js";
import { showNotice } from "../notice.js";
import { parseScreens } from "../screen-switch.js";
import type { GovernedWorkbook, HostAdapter, Identity, RuntimeState } from "../types.js";

export async function gzipJson(value: unknown): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Vercel / Next.js host. Identity (Supabase Auth), license verdict and tenant state
 * are all server-side; the browser only holds an HttpOnly session cookie.
 */
export function vercelAdapter(apiBase = "/api/aip"): HostAdapter {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(apiBase + path, {
      credentials: "same-origin",
      ...init,
      headers: { "content-type": "application/json", "x-aip-client": "runtime", ...(init?.headers as Record<string, string> | undefined) },
    });
    if (res.status === 204) return undefined as T;
    if (!res.ok) {
      // The API's own message (a conflict, a value outside the vocabulary) is what the user needs to read.
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `${path} → ${res.status}`);
    }
    return (await res.json()) as T;
  };

  // The governed workbook, fetched once per page: the dataset loader reads its sheets (layouts refer to them) and, on a
  // governed deployment (x-aip-governed: 1), the runtime's boot overlays it.
  let workbook: Promise<{ governed: boolean; wb: GovernedWorkbook }> | null = null;
  const governedWorkbook = () =>
    (workbook ??= (async () => {
      const res = await fetch(apiBase + "/workbook?for=datasets", { credentials: "same-origin", headers: { "x-aip-client": "runtime" } });
      if (res.status === 204) return { governed: false, wb: { label: "Governed data", sheets: {} } };
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `/workbook → ${res.status}`);
      }
      return { governed: res.headers.get("x-aip-governed") === "1", wb: (await res.json()) as GovernedWorkbook };
    })().catch((e: unknown) => {
      workbook = null;
      throw e;
    }));

  return {
    name: "vercel",
    async init() {},
    async environment(): Promise<RuntimeEnvironment> {
      return { platform: "vercel", hostname: location.hostname };
    },
    async serverVerdict(refresh) {
      return call<LicenseStatus>("/license" + (refresh ? "?refresh=1" : ""));
    },
    async trustedNow() {
      const { now } = await call<{ now: number }>("/time");
      return now;
    },
    async ssoIdentity() {
      try {
        return await call<Identity | null>("/session");
      } catch {
        return null;
      }
    },
    async signIn(login, secret) {
      try {
        const r = await call<{ ok: boolean }>("/sign-in", { method: "POST", body: JSON.stringify({ email: login, password: secret }) });
        return !!r?.ok;
      } catch {
        return false;
      }
    },
    async signOut() {
      await call("/sign-out", { method: "POST" });
    },
    persistence: {
      load: () => call<RuntimeState | undefined>("/state"),
      // Gzip keeps large workbook snapshots under the platform request-body limit (4.5 MB on Vercel).
      save: async (state) => {
        const body = await gzipJson(state);
        await call<void>("/state", { method: "PUT", body, headers: { "content-type": "application/json", "content-encoding": "gzip", "x-aip-client": "runtime" } });
      },
      clear: () => call<void>("/state", { method: "DELETE" }),
    },
    // Phase 4: screen grids switched on by the deployment (AIP_GRID_SCREENS), the governed workspace, audited exports.
    grid: {
      screens: async () => parseScreens((await call<{ gridScreens: string }>("/ui")).gridScreens),
      workspaceUrl: "grid/index.html",
      api: "http",
      recordExport: async (grid, format, rows) => {
        await call("/grid/export-audit", { method: "POST", body: JSON.stringify({ grid, format, rows }) });
      },
    },
    // Database-only data: the tenant's runtime datasets, loaded after sign-in (the deployment ships none).
    datasets: {
      load: (progress) =>
        loadDatasets(
          {
            manifest: () => call<DatasetManifest>("/datasets"),
            chunk: async (version, index) => {
              // Same address for the same data: the browser keeps each answer, so an unchanged tenant loads from cache.
              const res = await fetch(`${apiBase}/datasets/chunk?v=${encodeURIComponent(version)}&c=${index}`, { credentials: "same-origin", headers: { "x-aip-client": "runtime" } });
              if (res.status === 409) throw new DatasetsChanged();
              if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { message?: string } | null;
                throw new Error(body?.message ?? `/datasets/chunk → ${res.status}`);
              }
              return (await res.json()) as { version: string; blocks: Json[][] };
            },
            governed: async () => (await governedWorkbook()).wb.sheets as Record<string, Json[]>,
          },
          progress,
        ),
    },
    // Phase 4: a workbook import made on governed data is written back as one governed change.
    governed: governedSync({
      load: async () => {
        const r = await governedWorkbook();
        return r.governed ? r.wb : null;
      },
      // Gzip keeps large imports under the platform request-body limit, as for the runtime state.
      post: async (body) => call<ImportResult>("/workbook/changes", { method: "POST", body: await gzipJson(body), headers: { "content-type": "application/json", "content-encoding": "gzip", "x-aip-client": "runtime" } }),
      notify: showNotice,
    }),
  };
}
