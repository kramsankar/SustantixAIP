import { cookies } from "next/headers";
import { acceptsGzip, ApiError, errorResponse, NO_STORE, noContent, readBody } from "@/lib/http";
import { guard } from "@/lib/server";
import { clearState, loadState, MAX_STATE_BYTES, saveState, type StateContext } from "@/lib/state/service";
import { adminClient } from "@/lib/supabase/admin";
import { userClient } from "@/lib/supabase/server";
import { SupabaseAuditSink, SupabaseMembershipSource, SupabaseStateRepo } from "@/lib/supabase/stores";
import { canWrite, resolveTenant, TENANT_COOKIE } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function context(): Promise<StateContext> {
  const db = await userClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "unauthenticated", "sign in required");
  const preferred = (await cookies()).get(TENANT_COOKIE)?.value;
  const membership = await resolveTenant(new SupabaseMembershipSource(db), data.user.id, preferred);
  if (!membership) throw new ApiError(403, "no_tenant", "account is not a member of any tenant");
  return {
    userId: data.user.id,
    membership,
    // Tenant data goes through the user-scoped client so RLS decides; only the audit
    // append uses the service role (authenticated has no INSERT grant on audit_log).
    repo: new SupabaseStateRepo(db),
    audit: new SupabaseAuditSink(adminClient()),
  };
}

export async function GET(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const state = await loadState(await context());
    if (!state) return noContent();
    const headers: Record<string, string> = {
      ...NO_STORE,
      "content-type": "application/json; charset=utf-8",
      etag: `"${state.meta.sha256}"`,
      vary: "accept-encoding",
    };
    // Serve the stored gzip stream as-is when the client accepts it: no recompression,
    // and the response stays well under serverless response-size limits.
    if (acceptsGzip(req)) {
      return new Response(new Uint8Array(state.gz), { status: 200, headers: { ...headers, "content-encoding": "gzip" } });
    }
    return new Response(new Uint8Array(state.json), { status: 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const ctx = await context();
    // Refuse non-admins before buffering a large body.
    if (!canWrite(ctx.membership)) throw new ApiError(403, "forbidden", "saving runtime state requires the admin role");
    const body = await readBody(req, MAX_STATE_BYTES);
    await saveState(ctx, body);
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    await clearState(await context());
    return noContent();
  } catch (err) {
    return errorResponse(err);
  }
}
