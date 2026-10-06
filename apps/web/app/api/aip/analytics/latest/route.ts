import { ApiError, errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { LatestQuerySchema } from "@/lib/analytics/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/analytics/latest?model=&measure=&subject=&limit= — outputs of each model's latest successful run. */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { db } = await requestContext();
    const parsed = LatestQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) throw new ApiError(400, "invalid_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const q = parsed.data;
    let query = db.from("v_model_output_latest").select("model, run, as_of, subject_type, subject_code, measure, at, horizon_hours, value, q10, q50, q90, unit, detail").limit(q.limit);
    if (q.model) query = query.eq("model", q.model);
    if (q.measure) query = query.eq("measure", q.measure);
    if (q.subject) query = query.eq("subject_code", q.subject);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return json({ outputs: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}
