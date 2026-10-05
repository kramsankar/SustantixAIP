import { errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { grids } from "@/lib/grid/catalogue";
import { catalogueFor } from "@/lib/grid/service";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/grid — the Enterprise Grid catalogue, with editability narrowed to the caller's role. */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { membership } = await requestContext();
    return json({ role: membership.role, grids: catalogueFor(grids(), membership) });
  } catch (err) {
    return errorResponse(err);
  }
}
