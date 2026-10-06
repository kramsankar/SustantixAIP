import { requestContext } from "@/lib/analytics/context";
import { datasetsManifest, supabaseDatasetStore } from "@/lib/datasets";
import { acceptsGzip, errorResponse, NO_STORE } from "@/lib/http";
import { guard } from "@/lib/server";
import { gzipSync } from "node:zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/aip/datasets — the runtime's tenant datasets: each dataset's frame, every block of rows, and the chunk
 * plan the browser follows to fetch the rows (GET /api/aip/datasets/chunk). Read with the caller's client: row-level
 * security decides what is returned.
 */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { db, membership } = await requestContext();
    const manifest = await datasetsManifest(supabaseDatasetStore(db), membership.tenantId);
    const body = Buffer.from(JSON.stringify(manifest));
    const headers: Record<string, string> = { ...NO_STORE, "content-type": "application/json; charset=utf-8" };
    if (acceptsGzip(req)) return new Response(new Uint8Array(gzipSync(body)), { status: 200, headers: { ...headers, "content-encoding": "gzip" } });
    return new Response(new Uint8Array(body), { status: 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
