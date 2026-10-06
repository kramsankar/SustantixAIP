import { ApiError, errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { isTimeZone } from "@/lib/agents/schedules";
import { jsonBody } from "@/lib/grid/body";
import { guard } from "@/lib/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patch = z
  .object({
    enabled: z.boolean().optional(),
    prompt: z.string().trim().min(1).max(4000).optional(),
    cadence: z.enum(["hourly", "daily", "weekly"]).optional(),
    atHour: z.number().int().min(0).max(23).optional(),
    atWeekday: z.number().int().min(0).max(6).optional(),
    timeZone: z.string().max(64).refine(isTimeZone).optional(),
  })
  .strict();

/** PATCH /api/aip/agents/schedules/{id} — switch a schedule on or off, change its question or timing. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "no such schedule");
    const v = patch.safeParse(await jsonBody(req, 16 * 1024));
    if (!v.success) throw new ApiError(400, "invalid_schedule", v.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
    const { membership, db } = await requestContext();
    if (membership.role !== "admin") throw new ApiError(403, "forbidden", "only administrators schedule agents");
    const d = v.data;
    const row = { enabled: d.enabled, prompt: d.prompt, cadence: d.cadence, at_hour: d.atHour, at_weekday: d.atWeekday, time_zone: d.timeZone };
    const update = Object.fromEntries(Object.entries(row).filter(([, x]) => x !== undefined));
    if (!Object.keys(update).length) throw new ApiError(400, "invalid_schedule", "nothing to change");
    const { data, error } = await db.from("agent_schedule").update(update).eq("tenant_id", membership.tenantId).eq("id", id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ApiError(404, "not_found", "no such schedule");
    const { data: view } = await db.from("v_agent_schedule").select("*").eq("code", id).maybeSingle();
    return json(view ?? data);
  } catch (err) {
    return errorResponse(err);
  }
}
