import { describe, expect, it } from "vitest";
import { fromByteaHex } from "../lib/state/codec";
import { clearState, loadState, saveState, type StateContext } from "../lib/state/service";
import { SupabaseAuditSink, SupabaseClockStore, SupabaseMembershipSource, SupabaseStateRepo } from "../lib/supabase/stores";
import { resolveTenant } from "../lib/tenant";
import { FakeDb } from "./fake-db";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";

// supabase-js client typing is irrelevant to these adapters' behaviour.
const asClient = (db: FakeDb) => db as never;

describe("Supabase adapters", () => {
  it("clock store upserts by lid and reads numbers back", async () => {
    const db = new FakeDb();
    const store = new SupabaseClockStore(asClient(db));
    expect(await store.read("x")).toBeNull();
    await store.write({ lid: "x", firstSeen: 1, lastSeen: 2, verdict: "valid" });
    await store.write({ lid: "x", firstSeen: 1, lastSeen: 3700, verdict: "valid" });
    expect(db.table("license_clock")).toHaveLength(1);
    expect(await store.read("x")).toEqual({ lid: "x", firstSeen: 1, lastSeen: 3700, verdict: "valid" });
  });

  it("membership source filters to the user and drops unknown roles", async () => {
    const db = new FakeDb();
    db.table("tenant_members").push(
      { tenant_id: T2, user_id: "u1", role: "viewer", created_at: "2026-02-01T00:00:00Z" },
      { tenant_id: T1, user_id: "u1", role: "admin", created_at: "2026-01-01T00:00:00Z" },
      { tenant_id: T1, user_id: "u2", role: "admin", created_at: "2025-01-01T00:00:00Z" },
      { tenant_id: "bogus", user_id: "u1", role: "owner", created_at: "2020-01-01T00:00:00Z" },
    );
    const src = new SupabaseMembershipSource(asClient(db));
    const list = await src.membershipsOf("u1");
    expect(list.map((m) => m.tenantId).sort()).toEqual([T1, T2]);
    expect((await resolveTenant(src, "u1", undefined))?.tenantId).toBe(T1);
    expect((await resolveTenant(src, "u1", T2))?.role).toBe("viewer");
  });

  it("state repo stores bytea hex and supports the full save / load / clear cycle", async () => {
    const user = new FakeDb();
    const admin = new FakeDb();
    const ctx: StateContext = {
      userId: "u1",
      membership: { tenantId: T1, role: "admin", createdAt: "" },
      repo: new SupabaseStateRepo(asClient(user)),
      audit: new SupabaseAuditSink(asClient(admin)),
    };
    const doc = { data: { Assets: [{ id: 1 }] }, lastImport: "today", mode: "Uploaded data" };
    await saveState(ctx, Buffer.from(JSON.stringify(doc)));
    const row = user.table("runtime_state")[0]!;
    expect(String(row.payload)).toMatch(/^\\x1f8b/);
    expect(fromByteaHex(String(row.payload))[0]).toBe(0x1f);
    expect(row).toMatchObject({ tenant_id: T1, updated_by: "u1" });

    const loaded = await loadState(ctx);
    expect(JSON.parse(loaded!.json.toString())).toEqual(doc);

    await clearState(ctx);
    expect(user.table("runtime_state")).toHaveLength(0);
    expect(admin.table("audit_log").map((r) => r.action)).toEqual(["runtime_state.save", "runtime_state.clear"]);
    expect(admin.table("audit_log")[0]).toMatchObject({ tenant_id: T1, actor: "u1", entity: "runtime_state", entity_key: T1, before: null });
  });

  it("surfaces an RLS refusal from the user-scoped client as an error", async () => {
    const user = new FakeDb();
    user.denyWrites.add("runtime_state");
    const ctx: StateContext = {
      userId: "u1",
      membership: { tenantId: T1, role: "admin", createdAt: "" },
      repo: new SupabaseStateRepo(asClient(user)),
      audit: new SupabaseAuditSink(asClient(new FakeDb())),
    };
    await expect(saveState(ctx, Buffer.from(JSON.stringify({ data: {}, lastImport: null, mode: "x" })))).rejects.toThrow(/row-level security/);
  });
});
