import { LIMITS, type ChangeSetRequest, type GridDef, type GridPage, type GridQuery } from "@sustantix/grid";
import { describe, expect, it } from "vitest";
import { requirementFor } from "../lib/gate";
import { ApiError } from "../lib/http";
import { CHANGE_MODEL, dictionaryRows, gridById, grids } from "../lib/grid/catalogue";
import { applyChanges, catalogueFor, changeError, exportGrid, parseChangeSet, parseQuery, parseView, readGrid, type ChangeStore, type ExportLog, type GridStore } from "../lib/grid/service";
import { applyGridQuery, likeLiteral, selectList, type FilterBuilder } from "../lib/supabase/grid-store";
import type { Membership } from "../lib/tenant";

const tenant = "00000000-0000-0000-0000-00000000000a";
const member = (role: Membership["role"]): Membership => ({ tenantId: tenant, role, createdAt: "2026-01-01T00:00:00Z" });
const uuid = "11111111-2222-4333-8444-555555555555";

class Recorder implements FilterBuilder {
  readonly calls: Array<[string, ...unknown[]]> = [];
  private rec(name: string, ...args: unknown[]) {
    this.calls.push([name, ...args]);
    return this;
  }
  eq(c: string, v: unknown) { return this.rec("eq", c, v); }
  neq(c: string, v: unknown) { return this.rec("neq", c, v); }
  lt(c: string, v: unknown) { return this.rec("lt", c, v); }
  lte(c: string, v: unknown) { return this.rec("lte", c, v); }
  gt(c: string, v: unknown) { return this.rec("gt", c, v); }
  gte(c: string, v: unknown) { return this.rec("gte", c, v); }
  ilike(c: string, p: string) { return this.rec("ilike", c, p); }
  in(c: string, v: readonly unknown[]) { return this.rec("in", c, v); }
  is(c: string, v: null) { return this.rec("is", c, v); }
  not(c: string, o: string, v: unknown) { return this.rec("not", c, o, v); }
  or(f: string) { return this.rec("or", f); }
  order(c: string, o: { ascending: boolean; nullsFirst: boolean }) { return this.rec("order", c, o); }
  range(a: number, b: number) { return this.rec("range", a, b); }
}

class PagedStore implements GridStore {
  readonly queries: GridQuery[] = [];
  constructor(private readonly total: number) {}
  async read(_def: GridDef, q: GridQuery): Promise<GridPage> {
    this.queries.push(q);
    const n = Math.max(0, Math.min(q.limit, this.total - q.offset));
    return { rows: Array.from({ length: n }, (_, i) => ({ code: `R${q.offset + i}` })), total: this.total, offset: q.offset };
  }
}

describe("grid catalogue", () => {
  it("resolves every grid of the census against the governed model", () => {
    const all = grids();
    // 20 grids from the screen census, plus one administrator grid per vocabulary table.
    expect(all.filter((g) => !g.id.startsWith("ref-"))).toHaveLength(20);
    expect(all.filter((g) => g.id.startsWith("ref-") && g.screen === "New: Reference Data")).toHaveLength(16);
    for (const g of all) expect(g.columns.length, g.id).toBeGreaterThan(0);
    const wo = gridById("work-orders");
    expect(wo.relation).toBe("aip.v_work_order");
    expect(wo.columns.find((c) => c.field === "status")).toMatchObject({ kind: "ref", ref: "status", scope: "work_order", editable: true });
    expect(wo.columns.find((c) => c.field === "estimated_cost")).toMatchObject({ kind: "money" });
    expect(gridById("assets").tree).toEqual({ parent: "parent" });
    expect(gridById("ai-guardrails")).toMatchObject({ relation: "aip.ai_guardrail_policies", key: "row_key", entity: null });
    expect(() => gridById("nope")).toThrow(ApiError);
    expect(() => gridById("../etc")).toThrow(ApiError);
  });

  it("narrows editability to the caller's role", () => {
    const viewer = catalogueFor(grids(), member("viewer"));
    expect(viewer.every((g) => !g.canEdit && g.columns.every((c) => !c.editable))).toBe(true);
    const planner = catalogueFor(grids(), member("planner"));
    expect(planner.find((g) => g.id === "work-orders")!.canEdit).toBe(true);
    expect(planner.find((g) => g.id === "sites")!.canEdit).toBe(false);
    const admin = catalogueFor(grids(), member("admin"));
    expect(admin.find((g) => g.id === "sites")!.columns.find((c) => c.field === "name")!.editable).toBe(true);
    expect(admin.find((g) => g.id === "data-quality-rules")!.canEdit).toBe(false);
  });

  it("serves the Data Management field dictionary from the registry", async () => {
    const page = await readGrid(gridById("data-dictionary"), { filters: [{ field: "sheet", op: "eq", value: "Work Orders" }], limit: 5 }, member("viewer"), new PagedStore(0), dictionaryRows);
    expect(page.total).toBeGreaterThan(5);
    expect(page.rows).toHaveLength(5);
    expect(dictionaryRows().find((r) => r.id === "work_orders.priority")).toMatchObject({ governed_by: "priority" });
  });
});

describe("grid queries", () => {
  const wo = gridById("work-orders");

  it("checks every field, operator and value against the grid's columns", () => {
    expect(() => parseQuery(wo, { sort: [{ field: "secret", dir: "asc" }] })).toThrow(/cannot sort on secret/);
    expect(() => parseQuery(wo, { filters: [{ field: "tenant_id", op: "eq", value: "x" }] })).toThrow(/cannot filter on tenant_id/);
    expect(() => parseQuery(wo, { filters: [{ field: "sla_hours", op: "contains", value: "4" }] })).toThrow(/cannot filter with contains/);
    expect(() => parseQuery(wo, { filters: [{ field: "sla_hours", op: "gt", value: "lots" }] })).toThrow(/not a valid integer/);
    expect(() => parseQuery(wo, { filters: [{ field: "pm_due_date", op: "lt", value: "next week" }] })).toThrow(/not a valid date/);
    expect(() => parseQuery(wo, { limit: LIMITS.pageMax + 1 })).toThrow(ApiError);
    expect(() => parseQuery(wo, { offset: 0, extra: 1 })).toThrow(ApiError);
    const q = parseQuery(wo, { filters: [{ field: "status", op: "in", value: ["OPEN", "IN_PROGRESS"] }] });
    expect(q.sort).toEqual([{ field: "created_date", dir: "desc" }]);
    expect(q).toMatchObject({ offset: 0, limit: 100 });
  });

  it("always applies a grid's fixed filters first", () => {
    const q = parseQuery(gridById("action-priority"), { filters: [{ field: "subject_type", op: "eq", value: "asset" }] });
    expect(q.filters[0]).toEqual({ field: "model", op: "eq", value: "AIP-RISK-1" });
    expect(q.filters).toHaveLength(2);
  });

  it("translates a query to PostgREST: tenant scope, literal matching, quoted search, a stable order, one page", () => {
    const q = parseQuery(wo, {
      offset: 200,
      limit: 100,
      sort: [{ field: "priority", dir: "desc" }],
      filters: [
        { field: "description", op: "contains", value: "50%_off" },
        { field: "technician", op: "empty" },
        { field: "sla_hours", op: "gte", value: 24 },
      ],
      search: 'fan,"belt"',
    });
    const b = applyGridQuery(new Recorder(), wo, q, tenant);
    expect(b.calls[0]).toEqual(["eq", "tenant_id", tenant]);
    expect(b.calls).toContainEqual(["ilike", "description", "%50\\%\\_off%"]);
    expect(b.calls).toContainEqual(["is", "technician", null]);
    expect(b.calls).toContainEqual(["gte", "sla_hours", 24]);
    const or = b.calls.find((c) => c[0] === "or")![1] as string;
    expect(or).toContain('code.ilike."*fan,\\"belt\\"*"');
    expect(or).not.toContain("sla_hours");
    expect(b.calls.filter((c) => c[0] === "order").map((c) => c[1])).toEqual(["priority", "code"]);
    expect(b.calls.at(-1)).toEqual(["range", 200, 299]);
    expect(likeLiteral("a*b\\c")).toBe("ab\\\\c");
  });

  it("serves platform vocabulary beside the tenant's own on the reference grid", () => {
    const b = applyGridQuery(new Recorder(), gridById("reference-data"), parseQuery(gridById("reference-data"), {}), tenant);
    expect(b.calls[0]).toEqual(["or", `tenant_id.is.null,tenant_id.eq.${tenant}`]);
  });

  it("selects amounts as text and what editing needs", () => {
    const s = selectList(wo).split(",");
    expect(s).toContain("estimated_cost:estimated_cost::text");
    expect(s).toContain("row_version");
    expect(s).toContain("currency");
    expect(s).toContain("sla_hours");
    expect(selectList(gridById("assets")).split(",")).toContain("parent");
  });

  it("exports exactly the filtered rows, page by page, and records who exported them", async () => {
    const store = new PagedStore(2500);
    const logged: unknown[] = [];
    const log: ExportLog = { record: async (...args) => void logged.push(args) };
    const out = await exportGrid(wo, { format: "xlsx", query: { filters: [{ field: "status", op: "eq", value: "OPEN" }] } }, member("viewer"), store, log, dictionaryRows);
    expect(out.rows).toHaveLength(2500);
    expect(out.truncated).toBe(false);
    expect(store.queries.map((q) => q.offset)).toEqual([0, 1000, 2000]);
    expect(logged[0]).toEqual([tenant, "work-orders", "xlsx", 2500, { filters: [{ field: "status", op: "eq", value: "OPEN" }], sort: wo.defaultSort, search: null }]);
    await expect(exportGrid(wo, { format: "pdf" }, member("viewer"), store, log, dictionaryRows)).rejects.toMatchObject({ status: 400 });
  });
});

describe("change sets", () => {
  const set = (items: unknown[]) => ({ id: uuid, source: "grid", items });

  it("accepts a well-formed set and passes it to the database unchanged", async () => {
    const seen: ChangeSetRequest[] = [];
    const store: ChangeStore = { apply: async (r) => (seen.push(r), { id: r.id, items: [], replayed: false }) };
    const body = set([
      { entity: "work_order", op: "update", code: "WO-1", baseVersion: 3, values: { status: "IN_PROGRESS", estimated_cost: "1250.50", pm_due_date: "2026-10-20", technician: null } },
      { entity: "work_order", op: "insert", code: "WO-2", values: { site: "SP-01", currency: "USD" } },
      { entity: "work_order", op: "delete", code: "WO-3", baseVersion: 1 },
    ]);
    await applyChanges(body, CHANGE_MODEL, member("planner"), store);
    expect(seen[0]!.items).toHaveLength(3);
  });

  it("refuses what the role, the model or the value types do not allow, naming the item", () => {
    const planner = member("planner");
    const bad = (items: unknown[], m = planner) => {
      try {
        parseChangeSet(set(items), CHANGE_MODEL, m);
      } catch (e) {
        return e as ApiError;
      }
      throw new Error("accepted");
    };
    expect(bad([{ entity: "work_order", op: "update", code: "WO-1", baseVersion: 1, values: { estimated_cost: 1250.5 } }])).toMatchObject({ status: 422, message: expect.stringMatching(/decimal strings/) });
    expect(bad([{ entity: "work_order", op: "update", code: "WO-1", baseVersion: 1, values: { source_ordinal: 4 } }])).toMatchObject({ status: 422 });
    expect(bad([{ entity: "work_order", op: "update", code: "WO-1", values: { sla_hours: 4 } }])).toMatchObject({ status: 400, message: expect.stringMatching(/row version/) });
    expect(bad([{ entity: "work_order", op: "update", code: "WO-1", baseVersion: 1, values: { pm_due_date: "20/10/2026" } }])).toMatchObject({ status: 422 });
    expect(bad([{ entity: "work_order", op: "update", code: "WO-1", baseVersion: 1, values: { currency: "rupees" } }])).toMatchObject({ status: 422 });
    expect(bad([{ entity: "site", op: "update", code: "SP-01", baseVersion: 1, values: { name: "x" } }])).toMatchObject({ status: 403 });
    expect(bad([{ entity: "plant_telemetry", op: "delete", code: "x", baseVersion: 1 }], member("admin"))).toMatchObject({ status: 403 });
    expect(bad([{ entity: "tenants", op: "delete", code: "x", baseVersion: 1 }])).toMatchObject({ status: 422 });
    expect(bad([{ entity: "work_order", op: "update", code: "WO-1", baseVersion: 1, values: { sla_hours: 1 } }, { entity: "work_order", op: "upsert", code: "x" }])).toMatchObject({ status: 400 });
    expect(() => parseChangeSet({ ...set([]), id: "not-a-uuid" }, CHANGE_MODEL, planner)).toThrow(ApiError);
    expect(() => parseChangeSet(set(Array.from({ length: LIMITS.changeItemsMax + 1 }, (_, i) => ({ entity: "work_order", op: "insert", code: `W${i}` }))), CHANGE_MODEL, planner)).toThrow(ApiError);
  });

  it("never lets a viewer write", async () => {
    const store: ChangeStore = { apply: async () => { throw new Error("reached the database"); } };
    await expect(applyChanges(set([{ entity: "work_order", op: "insert", code: "W" }]), CHANGE_MODEL, member("viewer"), store)).rejects.toMatchObject({ status: 403 });
  });

  it("answers a stale version with 409 and the current row", () => {
    const e = changeError({ code: "AX409", message: "item 1: Work order WO-1 changed since version 1 (now 2)", details: JSON.stringify({ entity: "work_order", code: "WO-1", current: { code: "WO-1", row_version: 2 } }) });
    expect(e).toMatchObject({ status: 409, code: "conflict", extra: { entity: "work_order", code: "WO-1", current: { row_version: 2 } } });
    expect(changeError({ code: "23505" }).status).toBe(409);
    expect(changeError({ code: "23503" }).status).toBe(422);
    expect(changeError({ code: "AX404" }).status).toBe(404);
    expect(changeError({ code: "42501" }).status).toBe(403);
    expect(changeError({ code: "XX000", message: "internal detail" })).toMatchObject({ status: 500, message: "the change set could not be applied" });
  });
});

describe("reference data", () => {
  it("gives administrators a grid per vocabulary table, with platform rows read-only", () => {
    const status = gridById("ref-status");
    expect(status).toMatchObject({ entity: "ref_status", relation: "aip.v_ref_status", readOnlyWhen: "is_platform", source: { platformRows: true } });
    expect(selectList(status).split(",")).toContain("is_platform");
    expect(catalogueFor([status], member("admin"))[0]!.columns.find((c) => c.field === "label")!.editable).toBe(true);
    expect(catalogueFor([status], member("planner"))[0]!.canEdit).toBe(false);
    const b = applyGridQuery(new Recorder(), status, parseQuery(status, {}), tenant);
    expect(b.calls[0]).toEqual(["or", `tenant_id.is.null,tenant_id.eq.${tenant}`]);
  });

  it("addresses a scoped vocabulary row as scope:CODE", () => {
    const admin = member("admin");
    expect(() => parseChangeSet({ id: uuid, items: [{ entity: "ref_status", op: "insert", code: "ON_HOLD", values: { label: "On hold" } }] }, CHANGE_MODEL, admin)).toThrow(/scope:CODE/);
    expect(parseChangeSet({ id: uuid, items: [{ entity: "ref_status", op: "insert", code: "work_order:ON_HOLD", values: { label: "On hold" } }] }, CHANGE_MODEL, admin).items).toHaveLength(1);
    expect(() => parseChangeSet({ id: uuid, items: [{ entity: "ref_priority", op: "insert", code: "P9", values: { label: "x" } }] }, CHANGE_MODEL, member("planner"))).toThrow(ApiError);
  });
});

describe("saved views", () => {
  it("lets only administrators share a view, and needs a version to update one", () => {
    expect(() => parseView({ name: "Team", shared: true, state: {} }, member("planner"))).toThrow(/only administrators/);
    expect(parseView({ name: "Team", shared: true, state: {} }, member("admin")).shared).toBe(true);
    expect(() => parseView({ name: "Mine", state: {} }, member("planner"), true)).toThrow(/row version/);
    expect(() => parseView({ name: "x".repeat(81), state: {} }, member("planner"))).toThrow(ApiError);
  });
});

describe("gate", () => {
  it("treats change sets and saved views as writes, grid reads and exports as reads", () => {
    expect(requirementFor("/api/aip/changes", "POST")).toBe("writable");
    expect(requirementFor("/api/aip/grid/work-orders/views", "POST")).toBe("writable");
    expect(requirementFor("/api/aip/grid/work-orders/views/abc", "DELETE")).toBe("writable");
    expect(requirementFor("/api/aip/grid/work-orders/views", "GET")).toBe("readable");
    expect(requirementFor("/api/aip/grid/work-orders/rows", "POST")).toBe("readable");
    expect(requirementFor("/api/aip/grid/work-orders/export", "POST")).toBe("readable");
  });
});

describe("screen grid switch", () => {
  it("accepts all, none or a list of screens, and nothing else", async () => {
    const { parseServerEnv } = await import("../lib/env");
    const base = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40), SUPABASE_SERVICE_ROLE_KEY: "b".repeat(40), AIP_LICENSE_KEY: "SXL1.x.y" };
    const parse = (v?: string) => {
      try {
        return parseServerEnv({ ...base, AIP_GRID_SCREENS: v }).AIP_GRID_SCREENS;
      } catch (e) {
        return (e as Error).name;
      }
    };
    expect(parse(undefined)).toBe("");
    expect(parse("all")).toBe("all");
    expect(parse("workorderintelligence, guardrails")).toBe("workorderintelligence, guardrails");
    expect(parse("<script>")).toBe("EnvError");
    expect(requirementFor("/api/aip/ui", "GET")).toBe("readable");
    expect(requirementFor("/api/aip/grid/export-audit", "POST")).toBe("readable");
  });
});
