import { ApiError, errorResponse, json } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { CHANGE_MODEL, gridById } from "@/lib/grid/catalogue";
import { deliveryContext } from "@/lib/ingest/context";
import { discard, replay } from "@/lib/ingest/service";
import { requestContext } from "@/lib/analytics/context";
import { guard } from "@/lib/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const body = z.object({ keys: z.array(z.string().regex(/^(\d{1,18}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/)).min(1).max(5000) }).strict();

/** POST /api/aip/grid/{id}/actions/{action} — {keys}: a grid's own actions (quarantine: replay or discard rows). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { id, action } = await params;
    const def = gridById(id);
    if (!def.actions?.some((a) => a.id === action)) throw new ApiError(404, "not_found", "no such action");
    const v = body.safeParse(await jsonBody(req, 256 * 1024));
    if (!v.success) throw new ApiError(400, "invalid_action", "keys: the selected rows");
    if (id === "agent-schedules" && action === "run-now") {
      const { membership, db } = await requestContext();
      const { data, error } = await db.rpc("run_agent_schedules_now", { p_tenant: membership.tenantId, p_ids: v.data.keys });
      if (error) throw new ApiError(error.code === "42501" ? 403 : error.code === "22P02" ? 400 : 500, error.code === "42501" ? "forbidden" : "run_failed", error.message);
      return json({ queued: data as number });
    }
    if (v.data.keys.some((k) => !/^\d+$/.test(k))) throw new ApiError(400, "invalid_action", "keys: the selected rows");
    const ids = v.data.keys.map(Number);
    if (id === "outbox" && action === "retry") {
      const { membership, db } = await requestContext();
      const { data, error } = await db.rpc("retry_outbox", { p_tenant: membership.tenantId, p_ids: ids });
      if (error) throw new ApiError(error.code === "42501" ? 403 : 500, error.code === "42501" ? "forbidden" : "retry_failed", error.message);
      return json({ retried: data as number });
    }
    const ctx = await deliveryContext(req.headers);
    if (ctx.who.role === "viewer") throw new ApiError(403, "forbidden", "viewers cannot change quarantined data");
    if (id === "data-quarantine" && action === "replay") return json(await replay(ids, ctx.who, CHANGE_MODEL, ctx.store, ctx.ledger, ctx.newId));
    if (id === "data-quarantine" && action === "discard") return json(await discard(ids, ctx.ledger));
    throw new ApiError(404, "not_found", "no such action");
  } catch (err) {
    return errorResponse(err);
  }
}
