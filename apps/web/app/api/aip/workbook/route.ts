import { acceptsGzip, errorResponse, noContent } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { serverEnv } from "@/lib/env";
import { guard } from "@/lib/server";
import { adminClient } from "@/lib/supabase/admin";
import { COMPAT_SHEETS, governedWorkbook, type Row, type SheetReader } from "@/lib/workbook";
import { notModified, workbookVersion } from "@/lib/workbook-version";
import { gzipSync } from "node:zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PAGE = 1000;

/**
 * GET /api/aip/workbook — the caller's tenant data as the runtime's governed workbook. Read with the caller's client:
 * row-level security decides what is returned. Runtime datasets refer to governed sheets, so the host's dataset loader
 * reads it on every deployment (?for=datasets); the x-aip-governed header says whether the runtime also overlays it at
 * boot (AIP_DATA_SOURCE=governed). Without ?for=datasets a deployment that is not governed answers 204, as before.
 */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const governed = serverEnv().AIP_DATA_SOURCE === "governed";
    if (!governed && new URL(req.url).searchParams.get("for") !== "datasets") return noContent();
    const { db, membership } = await requestContext();
    // The version is read with the service client (members do not read the audit log); it reveals nothing but a tag.
    const admin = adminClient();
    const etag = await workbookVersion(membership.tenantId, {
      async latestAudit(t) {
        const { data, error } = await admin.from("audit_log").select("id").eq("tenant_id", t).order("at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
        if (error) throw new Error(`audit_log: ${error.message}`);
        return data ? String(data.id) : null;
      },
      async latestChangeSet(t) {
        const { data, error } = await admin.from("change_set").select("applied_at").eq("tenant_id", t).order("applied_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw new Error(`change_set: ${error.message}`);
        return data ? String(data.applied_at) : null;
      },
    });
    // Private to this signed-in user, revalidated on every load: an unchanged tenant answers 304 at once.
    const cache = { "cache-control": "private, no-cache", etag, vary: "accept-encoding, cookie", "x-aip-governed": governed ? "1" : "0" };
    if (notModified(req.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers: cache });
    const reader: SheetReader = {
      async read(schema, table) {
        const out: Row[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await db.schema(schema).from(table).select("*").eq("tenant_id", membership.tenantId).order("source_ordinal", { ascending: true, nullsFirst: false }).range(from, from + PAGE - 1);
          if (error) throw new Error(`${schema}.${table}: ${error.message}`);
          out.push(...((data ?? []) as Row[]));
          if (!data || data.length < PAGE) return out;
        }
      },
    };
    const body = Buffer.from(JSON.stringify(await governedWorkbook(reader, COMPAT_SHEETS, "Governed data")));
    const headers: Record<string, string> = { ...cache, "content-type": "application/json; charset=utf-8" };
    if (acceptsGzip(req)) return new Response(new Uint8Array(gzipSync(body)), { status: 200, headers: { ...headers, "content-encoding": "gzip" } });
    return new Response(new Uint8Array(body), { status: 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
