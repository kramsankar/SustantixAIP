/** Tenant resolution for a signed-in user. */

export const ROLES = ["viewer", "planner", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const TENANT_COOKIE = "aip_tenant";

export interface Membership {
  tenantId: string;
  role: Role;
  createdAt: string;
}

export interface MembershipSource {
  membershipsOf(userId: string): Promise<Membership[]>;
}

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);

/**
 * The cookie is only a preference: it selects among the user's own memberships and is
 * ignored when it names a tenant the user does not belong to.
 */
export function pickTenant(memberships: readonly Membership[], preferred: string | undefined): Membership | null {
  if (!memberships.length) return null;
  if (preferred) {
    const want = preferred.trim().toLowerCase();
    const hit = memberships.find((m) => m.tenantId.toLowerCase() === want);
    if (hit) return hit;
  }
  return [...memberships].sort((a, b) => {
    const ta = Date.parse(a.createdAt) || Number.MAX_SAFE_INTEGER;
    const tb = Date.parse(b.createdAt) || Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return a.tenantId < b.tenantId ? -1 : a.tenantId > b.tenantId ? 1 : 0;
  })[0]!;
}

export async function resolveTenant(source: MembershipSource, userId: string, preferred: string | undefined): Promise<Membership | null> {
  return pickTenant(await source.membershipsOf(userId), preferred);
}

export const canRead = (m: Membership): boolean => isRole(m.role);
export const canWrite = (m: Membership): boolean => m.role === "admin";
