import { ApiError, errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { jsonBody } from "@/lib/grid/body";
import { guard } from "@/lib/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patch = z.object({ enabled: z.boolean().optional(), entities: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,62}$/)).max(100).optional() }).strict();

/** PATCH /api/aip/integrations/{id} — {enabled, entities}: an administrator disables or scopes an integration. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "no such integration");
    const v = patch.safeParse(await jsonBody(req, 4 * 1024));
    if (!v.success) throw new ApiError(400, "invalid_integration", "enabled (boolean) and entities (names) only");
    const { membership, db } = await requestContext();
    if (membership.role !== "admin") throw new ApiError(403, "forbidden", "only administrators manage integrations");
    const { data, error } = await db.from("integration").update(v.data).eq("tenant_id", membership.tenantId).eq("id", id).select("id, name, entities, enabled").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ApiError(404, "not_found", "no such integration");
    return json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
