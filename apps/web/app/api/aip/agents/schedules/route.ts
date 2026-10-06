import { ApiError, errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { createSchedule, SupabaseScheduleDirectory } from "@/lib/agents/schedules";
import { jsonBody } from "@/lib/grid/body";
import { adminClient } from "@/lib/supabase/admin";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/agents/schedules — the tenant's agent schedules (administrators). */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { membership, db } = await requestContext();
    if (membership.role !== "admin") throw new ApiError(403, "forbidden", "only administrators schedule agents");
    const { data, error } = await db.from("v_agent_schedule").select("*").eq("tenant_id", membership.tenantId).order("name");
    if (error) throw new Error(error.message);
    return json({ schedules: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/aip/agents/schedules — {name, agent, prompt, cadence, atHour, atWeekday, timeZone}. */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { userId, membership } = await requestContext();
    const body = await jsonBody(req, 16 * 1024);
    return json(await createSchedule(body, membership, userId, new SupabaseScheduleDirectory(adminClient())), 201);
  } catch (err) {
    return errorResponse(err);
  }
}
