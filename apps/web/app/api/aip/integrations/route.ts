import { errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { jsonBody } from "@/lib/grid/body";
import { createIntegration, SupabaseIntegrationDirectory } from "@/lib/ingest/integrations";
import { adminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/http";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/integrations — the tenant's integrations (administrators). */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { membership, db } = await requestContext();
    if (membership.role !== "admin") throw new ApiError(403, "forbidden", "only administrators manage integrations");
    const { data, error } = await db.from("integration").select("id, name, entities, enabled, created_at, last_used_at").eq("tenant_id", membership.tenantId).order("name");
    if (error) throw new Error(error.message);
    return json({ integrations: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/aip/integrations — {name, role, entities}: creates an integration and returns its key once. */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { userId, membership } = await requestContext();
    const body = await jsonBody(req, 8 * 1024);
    return json(await createIntegration(body, membership, userId, new SupabaseIntegrationDirectory(adminClient())), 201);
  } catch (err) {
    return errorResponse(err);
  }
}
