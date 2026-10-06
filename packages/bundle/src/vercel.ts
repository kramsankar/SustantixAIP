import type { BundleRecord, BundleSink, BundleSource, DeliveryOutcome } from "./bundle.ts";

/**
 * The Vercel edition over its API, with an administrator integration key (Authorization: Bearer sxi_…): records are
 * read page by page from /api/aip/bundle/{entity} and delivered through /api/aip/ingest, which merges them by business
 * code and keeps every delivery in the staging ledger.
 */
export interface VercelTarget {
  url: string;
  key: string;
  fetch?: typeof fetch;
}

const PAGE = 5000;

async function call<T>(t: VercelTarget, path: string, init: RequestInit = {}): Promise<T> {
  const res = await (t.fetch ?? fetch)(new URL(path, t.url), { ...init, headers: { authorization: `Bearer ${t.key}`, "content-type": "application/json", ...((init.headers as Record<string, string>) ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`${path}: ${res.status} ${String(body.message ?? body.error ?? "request failed")}`);
  return body as T;
}

export function vercelSource(t: VercelTarget, tenant = new URL(t.url).hostname): BundleSource {
  return {
    edition: "vercel",
    tenant,
    async *read(entity) {
      // The server may answer fewer records than asked (its page cap): continue from where the records end.
      for (let offset = 0; ; ) {
        const page = await call<{ records: BundleRecord[]; more: boolean }>(t, `/api/aip/bundle/${encodeURIComponent(entity)}?offset=${offset}&limit=${PAGE}`);
        if (page.records.length) yield page.records;
        offset += page.records.length;
        if (!page.more || !page.records.length) return;
      }
    },
  };
}

export function vercelSink(t: VercelTarget): BundleSink {
  return {
    async deliver(entity, records) {
      const r = await call<DeliveryOutcome>(t, "/api/aip/ingest", { method: "POST", body: JSON.stringify({ entity, records: records.map((x) => ({ code: x.code, values: x.values })) }) });
      return { applied: r.applied, unchanged: r.unchanged, quarantined: r.quarantined, issues: r.issues ?? [] };
    },
  };
}
