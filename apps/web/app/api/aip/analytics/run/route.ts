import { ApiError, errorResponse, json, readBody } from "@/lib/http";
import { requestContext, tenantCurrency } from "@/lib/analytics/context";
import { runAnalytics } from "@/lib/analytics/service";
import { loadTenantSource } from "@/lib/analytics/source";
import { guard } from "@/lib/server";
import { SupabaseResultStore, SupabaseTableReader } from "@/lib/supabase/analytics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Loading a tenant's history and running every engine takes tens of seconds on the demo portfolio.
export const maxDuration = 300;

/** POST /api/aip/analytics/run — run the AIP engines for the caller's tenant (planner or admin). */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { userId, membership, db } = await requestContext();
    const raw = await readBody(req, 16 * 1024);
    let body: unknown = {};
    if (raw.length) {
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        throw new ApiError(400, "invalid_json", "request body is not JSON");
      }
    }
    const currency = await tenantCurrency(db, membership.tenantId);
    const result = await runAnalytics({ userId, membership, store: new SupabaseResultStore(db), loadSource: () => loadTenantSource(new SupabaseTableReader(db), currency) }, body);
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
