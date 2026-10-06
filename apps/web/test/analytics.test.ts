import type { ModelOutput, ModelRun } from "@sustantix/analytics";
import { describe, expect, it } from "vitest";
import { requirementFor } from "../lib/gate";
import { ApiError } from "../lib/http";
import { runAnalytics, type ResultStore } from "../lib/analytics/service";
import { loadTenantSource, type Row, type TableReader } from "../lib/analytics/source";
import type { Membership } from "../lib/tenant";

const tenant = "00000000-0000-0000-0000-00000000000a";
const member = (role: Membership["role"]): Membership => ({ tenantId: tenant, role, createdAt: "2026-01-01T00:00:00Z" });

class MemoryReader implements TableReader {
  readonly reads: string[] = [];
  constructor(private readonly tables: Record<string, Row[]> = {}) {}
  async readAll(table: string): Promise<Row[]> {
    this.reads.push(table);
    return this.tables[table] ?? [];
  }
}

class MemoryStore implements ResultStore {
  readonly runs: Array<{ code: string; run: ModelRun }> = [];
  readonly outputs = new Map<string, ModelOutput[]>();
  async recordRun(_t: string, run: ModelRun, meta: { code: string }): Promise<string> {
    this.runs.push({ code: meta.code, run });
    return `run-${this.runs.length}`;
  }
  async recordOutputs(_t: string, runId: string, outputs: ModelOutput[]): Promise<void> {
    this.outputs.set(runId, outputs);
  }
}

const sources = (tables: Record<string, Row[]> = {}) => loadTenantSource(new MemoryReader(tables), "INR");
const fixed = () => new Date("2026-10-05T10:00:00.000Z");

describe("analytics service", () => {
  it("lets planners and administrators run the engines, and nobody else", async () => {
    for (const role of ["viewer"] as const) {
      await expect(runAnalytics({ userId: "u", membership: member(role), store: new MemoryStore(), loadSource: () => sources() }, {})).rejects.toMatchObject({ status: 403 });
    }
    const store = new MemoryStore();
    const r = await runAnalytics({ userId: "u", membership: member("planner"), store, loadSource: () => sources(), now: fixed }, { models: ["AIP-MAINT-1"] });
    expect(r.runs.map((x) => x.model)).toEqual(["AIP-MAINT-1"]);
    expect(r.runs[0]!.code).toBe("AIP-MAINT-1/2026-10-05T10:00:00Z");
    expect(store.runs).toHaveLength(1);
  });

  it("validates the request strictly", async () => {
    const ctx = { userId: "u", membership: member("admin"), store: new MemoryStore(), loadSource: () => sources() };
    await expect(runAnalytics(ctx, { models: ["NOT-A-MODEL"] })).rejects.toBeInstanceOf(ApiError);
    await expect(runAnalytics(ctx, { horizonDays: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(runAnalytics(ctx, { surprise: true })).rejects.toMatchObject({ status: 400 });
  });

  it("records every engine's run, including the ones that could not run on the data available", async () => {
    const store = new MemoryStore();
    const r = await runAnalytics({ userId: "u", membership: member("admin"), store, loadSource: () => sources(), now: fixed }, { asOf: "2026-09-30T00:00:00" });
    expect(r.asOf).toBe("2026-09-30T00:00:00");
    expect(r.runs).toHaveLength(10);
    // With no history the forecast cannot train: the failure is recorded, with its reason, and nothing is written for it.
    const gen = r.runs.find((x) => x.model === "AIP-GEN-HYBRID-1")!;
    expect(gen.status).toBe("failed");
    expect(gen.message).toMatch(/observations/);
    expect([...store.outputs.keys()].length).toBe(r.runs.filter((x) => x.status === "succeeded" && x.outputs > 0).length);
  });
});

describe("tenant source", () => {
  it("reads masters through their code views and resolves vocabulary from the reference tables", async () => {
    const reader = new MemoryReader({
      v_asset: [{ id: "x", tenant_id: tenant, code: "AST-1", site: "SP-01", asset_class: "INVERTER", is_active: true, row_version: 1, updated_at: "now" }],
      ref_asset_class: [{ code: "SCB", label: "String Combiner Box" }],
      ref_alias: [{ ref_table: "asset_class", scope: null, alias: "String/Combiner", code: "SCB" }],
    });
    const src = await loadTenantSource(reader, "INR");
    expect(src.master("asset")).toEqual([{ code: "AST-1", values: { site: "SP-01", asset_class: "INVERTER" } }]);
    expect(src.resolve("reliability_life_history.asset_class", "asset_class", "String/Combiner")).toBe("SCB");
    expect(reader.reads).toContain("v_asset");
    expect(reader.reads).toContain("fcst_validation");
    expect(() => src.master("pv_module")).toThrow(/not loaded/);
  });
});

describe("gate", () => {
  it("treats running analytics and deciding agent proposals as writes", () => {
    expect(requirementFor("/api/aip/analytics/run", "POST")).toBe("writable");
    expect(requirementFor("/api/aip/analytics/latest", "GET")).toBe("readable");
    expect(requirementFor("/api/aip/agents/proposals/abc", "POST")).toBe("writable");
  });
});

describe("gate aliases", () => {
  it("gates the runtime's /api/assistant alias like the canonical endpoint", () => {
    expect(requirementFor("/api/assistant", "POST")).toBe("readable");
    expect(requirementFor("/api/assistant/", "POST")).toBe("readable");
    expect(requirementFor("/api/aip/assistant", "POST")).toBe("readable");
  });
});
