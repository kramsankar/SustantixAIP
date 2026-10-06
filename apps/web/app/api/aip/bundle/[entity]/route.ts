import { ApiError, errorResponse, json } from "@/lib/http";
import { requestContext } from "@/lib/analytics/context";
import { exportPage, type ExportReader } from "@/lib/bundle";
import { CHANGE_MODEL } from "@/lib/grid/catalogue";
import { authenticate, SupabaseIntegrationDirectory } from "@/lib/ingest/integrations";
import { adminClient } from "@/lib/supabase/admin";
import { guard } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/aip/bundle/{entity}?offset=&limit= — one page of a data bundle export (sx-bundle). Administrators only:
 * a signed-in administrator, or an administrator integration key (Bearer sxi_…) for the command-line tool.
 */
export async function GET(req: Request, { params }: { params: Promise<{ entity: string }> }): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const { entity } = await params;
    const url = new URL(req.url);
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number(url.searchParams.get("limit") ?? "5000");
    const integration = await authenticate(req.headers, new SupabaseIntegrationDirectory(adminClient()));
    let tenantId: string;
    let db;
    if (integration) {
      if (integration.role !== "admin" || integration.entities.length) throw new ApiError(403, "forbidden", "exports need an administrator integration without an entity restriction");
      tenantId = integration.tenantId;
      db = adminClient();
    } else {
      const ctx = await requestContext();
      if (ctx.membership.role !== "admin") throw new ApiError(403, "forbidden", "only administrators export data bundles");
      tenantId = ctx.membership.tenantId;
      db = ctx.db;
    }
    const reader: ExportReader = {
      async page(view, select, from, n) {
        // Every read names the tenant: platform vocabulary (no tenant) and other tenants never leave.
        const { data, error, count } = await db.from(view).select(select, { count: "exact" }).eq("tenant_id", tenantId).order("code").range(from, from + n - 1);
        if (error) throw new Error(`${view}: ${error.message}`);
        return { rows: (data ?? []) as unknown as Array<Record<string, unknown>>, total: count ?? 0 };
      },
    };
    return json(await exportPage(CHANGE_MODEL, entity, offset, limit, reader));
  } catch (err) {
    return errorResponse(err);
  }
}
