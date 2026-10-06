import { describe, expect, it } from "vitest";
import { changeSetError, dataverseGridApi, type DataverseGridClient } from "../src/adapters/dataverse-grid.js";

const F = "@OData.Community.Display.V1.FormattedValue";
const workOrders = Array.from({ length: 7 }, (_, i) => ({
  sus_name: `WO-${i + 1}`,
  versionnumber: 100 + i,
  sus_description: `Task ${i + 1}`,
  sus_slahours: i * 4,
  sus_estimatedcost: 1250.5 + i,
  statecode: i === 6 ? 1 : 0,
  _sus_siteid_value: "guid",
  [`_sus_siteid_value${F}`]: i % 2 ? "SP-02" : "SP-01",
  [`_sus_statusid_value${F}`]: "work_order/OPEN",
}));
const statuses = [
  { sus_name: "work_order/OPEN", sus_label: "Open", versionnumber: 1 },
  { sus_name: "work_order/ON_HOLD", sus_label: "On hold", versionnumber: 2 },
  { sus_name: "alert/OPEN", sus_label: "Open", versionnumber: 3 },
];

function client(role = "planner") {
  const calls: Array<{ op: string; table?: string; body?: Record<string, unknown>; token?: string }> = [];
  const c: DataverseGridClient = {
    entitySet: (l) => `${l}s`,
    async list(table, _select, token) {
      calls.push({ op: "list", table, ...(token ? { token } : {}) });
      const all = table === "sus_work_orders" ? workOrders : table === "sus_ref_statuss" ? statuses : [];
      // Two pages, to prove paging follows the skip token.
      return token ? { rows: all.slice(4) } : { rows: all.slice(0, 4), ...(all.length > 4 ? { skipToken: "next" } : {}) };
    },
    async customApi(name, body) {
      calls.push({ op: name, body });
      const req = JSON.parse(String(body.ChangeSetJson));
      if (req.probe === "role") return { ResultJson: JSON.stringify({ role, gridScreens: "workorderintelligence" }) };
      if (req.items[0].baseVersion === 1) throw new Error(`AIPCHANGESET ${JSON.stringify({ error: "conflict", message: "work_order WO-1 changed since version 1", entity: "work_order", code: "WO-1", current: { code: "WO-1", row_version: 100 } })}`);
      return { ResultJson: JSON.stringify({ id: req.id, items: [], replayed: false }) };
    },
  };
  return { c, calls };
}

describe("Dataverse grid adapter", () => {
  it("offers the governed grids with editability by the caller's AIP role", async () => {
    const planner = await dataverseGridApi(client("planner").c, null).catalogue();
    expect(planner.role).toBe("planner");
    expect(planner.grids.find((g) => g.id === "work-orders")!.canEdit).toBe(true);
    expect(planner.grids.find((g) => g.id === "sites")!.canEdit).toBe(false);
    // Supabase-only sources (analytics views, sheet tables, the registry) are not offered on Dataverse.
    expect(planner.grids.map((g) => g.id)).not.toContain("action-priority");
    expect(planner.grids.map((g) => g.id)).not.toContain("ai-guardrails");
    expect(await dataverseGridApi(client("planner").c, null).probe()).toEqual({ role: "planner", gridScreens: "workorderintelligence" });
    const admin = await dataverseGridApi(client("admin").c, null).catalogue();
    expect(admin.grids.find((g) => g.id === "ref-status")!.canEdit).toBe(true);
  });

  it("loads a table once across its pages and answers queries with the shared semantics", async () => {
    const { c, calls } = client();
    const api = dataverseGridApi(c, null);
    const p = await api.rows("work-orders", { offset: 0, limit: 3, sort: [{ field: "sla_hours", dir: "desc" }], filters: [{ field: "site", op: "eq", value: "SP-01" }] });
    expect(p.total).toBe(4);
    expect(p.rows.map((r) => r.code)).toEqual(["WO-7", "WO-5", "WO-3"]);
    expect(p.rows[0]).toMatchObject({ row_version: 106, site: "SP-01", status: "OPEN", estimated_cost: "1256.5", is_active: false });
    await api.rows("work-orders", { offset: 3, limit: 3 });
    expect(calls.filter((x) => x.op === "list").map((x) => x.token ?? "first")).toEqual(["first", "next"]);
  });

  it("lists vocabulary for a scope and marks platform codes read-only", async () => {
    const api = dataverseGridApi(client("admin").c, null);
    expect(await api.options("ref", "status", "work_order", "")).toEqual([{ code: "OPEN", label: "Open" }, { code: "ON_HOLD", label: "On hold" }]);
    const rows = await api.rows("ref-status", { offset: 0, limit: 10 });
    expect(rows.rows.find((r) => r.code === "work_order:OPEN")!.is_platform).toBe(true);
    expect(rows.rows.find((r) => r.code === "work_order:ON_HOLD")!.is_platform).toBe(false);
  });

  it("applies change sets through sus_ApplyChangeSet and maps a conflict to the grid's 409", async () => {
    const { c, calls } = client();
    const api = dataverseGridApi(c, null);
    await api.rows("work-orders", {});
    const ok = await api.applyChanges({ id: "11111111-2222-4333-8444-555555555555", source: "grid", items: [{ entity: "work_order", op: "update", code: "WO-1", baseVersion: 100, values: { sla_hours: 8 } }] });
    expect(ok.replayed).toBe(false);
    // The table is reloaded after a change.
    await api.rows("work-orders", {});
    expect(calls.filter((x) => x.op === "list" && x.table === "sus_work_orders")).toHaveLength(4);
    const refused = await api.applyChanges({ id: "11111111-2222-4333-8444-555555555556", source: "grid", items: [{ entity: "work_order", op: "update", code: "WO-1", baseVersion: 1, values: { sla_hours: 8 } }] }).catch((e) => e);
    expect(refused).toMatchObject({ status: 409, code: "conflict" });
    expect(refused.conflict).toMatchObject({ code: "WO-1", current: { row_version: 100 } });
    expect(changeSetError(new Error("network down"))).toMatchObject({ status: 500, code: "change_failed" });
  });

  it("keeps saved views in the browser on this host", async () => {
    const store = new Map<string, string>();
    const api = dataverseGridApi(client().c, { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
    const v = await api.saveView("work-orders", { name: "Mine", shared: false, state: { search: "fan" } });
    expect(await api.views("work-orders")).toEqual([v]);
    await api.deleteView("work-orders", v.id);
    expect(await api.views("work-orders")).toEqual([]);
  });
});
