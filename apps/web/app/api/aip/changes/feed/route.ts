import { errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { parseSince, readFeed } from "@/lib/grid/feed";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/changes/feed?since=<cursor> — which records of the tenant changed, for live refresh of open grids. */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const since = parseSince(new URL(req.url).searchParams.get("since"));
    const { membership, db } = await requestContext();
    return json(await readFeed(db as never, membership.tenantId, since));
  } catch (err) {
    return errorResponse(err);
  }
}
