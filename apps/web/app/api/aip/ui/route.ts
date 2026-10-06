import { errorResponse, json } from "@/lib/http";
import { serverEnv } from "@/lib/env";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aip/ui — deployment switches the runtime host reads: which screens show their tables as Enterprise Grids. */
export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    return json({ gridScreens: serverEnv().AIP_GRID_SCREENS });
  } catch (err) {
    return errorResponse(err);
  }
}
