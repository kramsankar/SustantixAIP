import { ApiError, errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { jsonBody } from "@/lib/grid/body";
import { createDestination } from "@/lib/outbox/destinations";
import { adminClient } from "@/lib/supabase/admin";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/outbox/destinations — where this tenant's events go (administrators). */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { membership, db } = await requestContext();
    if (membership.role !== "admin") throw new ApiError(403, "forbidden", "only administrators manage outbound destinations");
    const { data, error } = await db.from("outbox_destination").select("id, name, url, events, entities, enabled, created_at").eq("tenant_id", membership.tenantId).order("name");
    if (error) throw new Error(error.message);
    return json({ destinations: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/aip/outbox/destinations — {name, url, events, entities}; answers the signing secret once. */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { userId, membership } = await requestContext();
    const body = await jsonBody(req, 8 * 1024);
    // The secret column is service-only: the destination row is written by the server after the admin check.
    const created = await createDestination(body, membership, userId, {
      async create(tenantId, createdBy, v, secret) {
        const { data, error } = await adminClient().from("outbox_destination").insert({ tenant_id: tenantId, name: v.name, url: v.url, events: v.events, entities: v.entities, secret, created_by: createdBy }).select("id").single();
        if (error) {
          if (error.code === "23505") throw new ApiError(409, "duplicate", `a destination named ${v.name} exists`);
          throw new Error(error.message);
        }
        return { id: data.id as string };
      },
    });
    return json(created, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
