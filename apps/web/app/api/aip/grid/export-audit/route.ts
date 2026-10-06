import { ApiError, errorResponse, noContent } from "@/lib/http";
import { jsonBody } from "@/lib/grid/body";
import { gridContext } from "@/lib/grid/context";
import { guard } from "@/lib/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ grid: z.string().regex(/^screen-[a-z0-9-]{1,60}$/), format: z.enum(["csv", "xlsx"]), rows: z.number().int().min(0).max(1_000_000) }).strict();

/** POST /api/aip/grid/export-audit — records an export a screen grid made in the browser from its screen's table. */
export async function POST(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const parsed = body.safeParse(await jsonBody(req, 4 * 1024));
    if (!parsed.success) throw new ApiError(400, "invalid_export", "grid (screen-…), format (csv or xlsx) and rows are required");
    const ctx = await gridContext();
    await ctx.exports.record(ctx.membership.tenantId, parsed.data.grid, parsed.data.format, parsed.data.rows, { screen: true });
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
