import { cookies } from "next/headers";
import { ApiError } from "../http";
import { userClient } from "../supabase/server";
import { SupabaseMembershipSource } from "../supabase/stores";
import { resolveTenant, TENANT_COOKIE, type Membership } from "../tenant";

/** The signed-in user, their tenant membership and a client scoped to them (RLS applies to every query). */
export async function requestContext(): Promise<{ userId: string; membership: Membership; db: Awaited<ReturnType<typeof userClient>> }> {
  const db = await userClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "unauthenticated", "sign in required");
  const membership = await resolveTenant(new SupabaseMembershipSource(db), data.user.id, (await cookies()).get(TENANT_COOKIE)?.value);
  if (!membership) throw new ApiError(403, "no_tenant", "account is not a member of any tenant");
  return { userId: data.user.id, membership, db };
}

export async function tenantCurrency(db: Awaited<ReturnType<typeof userClient>>, tenantId: string): Promise<string> {
  const { data, error } = await db.from("tenants").select("default_currency").eq("id", tenantId).maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.default_currency ?? "INR");
}
