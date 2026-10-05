import { acceptsGzip, errorResponse, NO_STORE, noContent } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { serverEnv } from "@/lib/env";
import { guard } from "@/lib/server";
import { COMPAT_SHEETS, governedWorkbook, type Row, type SheetReader } from "@/lib/workbook";
import { gzipSync } from "node:zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PAGE = 1000;

/**
 * GET /api/aip/workbook — the caller's tenant data as the runtime's governed workbook (204 when this deployment
 * serves the bundled data). Read with the caller's client: row-level security decides what is returned.
 */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    if (serverEnv().AIP_DATA_SOURCE !== "governed") return noContent();
    const { db, membership } = await requestContext();
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
    const headers: Record<string, string> = { ...NO_STORE, "content-type": "application/json; charset=utf-8", vary: "accept-encoding" };
    if (acceptsGzip(req)) return new Response(new Uint8Array(gzipSync(body)), { status: 200, headers: { ...headers, "content-encoding": "gzip" } });
    return new Response(new Uint8Array(body), { status: 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
