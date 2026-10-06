import { requestContext } from "@/lib/analytics/context";
import { datasetsChunk, supabaseDatasetStore } from "@/lib/datasets";
import { acceptsGzip, ApiError, errorResponse } from "@/lib/http";
import { guard } from "@/lib/server";
import { gzipSync } from "node:zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/aip/datasets/chunk?v=<version>&c=<index> — the rows of one chunk of the datasets manifest. The answer for
 * a version never changes, so the browser keeps it (private to the signed-in user) and a later sign-in with the same
 * data does not fetch it again; changed data has a new version and new addresses.
 */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const version = url.searchParams.get("v") ?? "";
    const index = Number(url.searchParams.get("c"));
    if (!/^[0-9a-f]{24}$/.test(version) || !Number.isInteger(index) || index < 0 || index > 100_000) throw new ApiError(400, "bad_request", "v (version) and c (chunk index) are required");
    const { db, membership } = await requestContext();
    const chunk = await datasetsChunk(supabaseDatasetStore(db), membership.tenantId, version, index);
    const body = Buffer.from(JSON.stringify(chunk));
    const headers: Record<string, string> = { "cache-control": "private, max-age=31536000, immutable", vary: "accept-encoding, cookie", "content-type": "application/json; charset=utf-8" };
    if (acceptsGzip(req)) return new Response(new Uint8Array(gzipSync(body)), { status: 200, headers: { ...headers, "content-encoding": "gzip" } });
    return new Response(new Uint8Array(body), { status: 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
