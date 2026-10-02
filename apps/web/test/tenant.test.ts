import { describe, expect, it } from "vitest";
import { canRead, canWrite, pickTenant, resolveTenant, type Membership } from "../lib/tenant";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const T3 = "33333333-3333-4333-8333-333333333333";

const members: Membership[] = [
  { tenantId: T2, role: "viewer", createdAt: "2026-03-01T00:00:00Z" },
  { tenantId: T1, role: "admin", createdAt: "2026-01-01T00:00:00Z" },
  { tenantId: T3, role: "planner", createdAt: "2026-02-01T00:00:00Z" },
];

describe("tenant resolution", () => {
  it("returns null without memberships", () => {
    expect(pickTenant([], T1)).toBeNull();
  });

  it("uses the only membership", () => {
    expect(pickTenant([members[0]!], undefined)?.tenantId).toBe(T2);
  });

  it("defaults to the earliest membership", () => {
    expect(pickTenant(members, undefined)?.tenantId).toBe(T1);
  });

  it("honours the aip_tenant cookie when it names a membership", () => {
    expect(pickTenant(members, T3)?.tenantId).toBe(T3);
    expect(pickTenant(members, T3.toUpperCase())?.tenantId).toBe(T3);
  });

  it("ignores a cookie naming a foreign tenant", () => {
    expect(pickTenant(members, "99999999-9999-4999-8999-999999999999")?.tenantId).toBe(T1);
  });

  it("breaks created_at ties deterministically", () => {
    const tie: Membership[] = [
      { tenantId: T3, role: "viewer", createdAt: "2026-01-01T00:00:00Z" },
      { tenantId: T2, role: "viewer", createdAt: "2026-01-01T00:00:00Z" },
    ];
    expect(pickTenant(tie, undefined)?.tenantId).toBe(T2);
  });

  it("does not mutate the input", () => {
    const copy = [...members];
    pickTenant(members, undefined);
    expect(members).toEqual(copy);
  });

  it("loads memberships for the given user", async () => {
    const asked: string[] = [];
    const m = await resolveTenant({ membershipsOf: async (u) => (asked.push(u), members) }, "user-1", T2);
    expect(asked).toEqual(["user-1"]);
    expect(m?.tenantId).toBe(T2);
  });

  it("mirrors RLS: any role reads, only admin writes", () => {
    for (const role of ["viewer", "planner", "admin"] as const) {
      const m = { tenantId: T1, role, createdAt: "" };
      expect(canRead(m)).toBe(true);
      expect(canWrite(m)).toBe(role === "admin");
    }
  });
});
