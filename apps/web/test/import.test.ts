import { readFileSync } from "node:fs";
import type { ChangeSetRequest } from "@sustantix/grid";
import { buildMasters, loadVocabulary, readSheets, type Registry } from "@sustantix/schema";
import { describe, expect, it } from "vitest";
import { requirementFor } from "../lib/gate";
import { governedImport, type CurrentReader } from "../lib/grid/import";
import type { ChangeStore } from "../lib/grid/service";
import type { Membership } from "../lib/tenant";

const root = new URL("../../../", import.meta.url);
const reg = JSON.parse(readFileSync(new URL("schema/aip-data-model.json", root), "utf8")) as Registry;
const raw = readSheets(readFileSync(new URL("reference/AIP_Data_v915.xlsx", root)));
const built = buildMasters(reg, raw, loadVocabulary(new URL(".", root).pathname));
const tenant = "00000000-0000-0000-0000-00000000000a";
const member = (role: Membership["role"]): Membership => ({ tenantId: tenant, role, createdAt: "2026-01-01T00:00:00Z" });
const uuid = "22222222-2222-4222-8222-222222222222";
const WO = "Work Orders";

/** The database as the import sees it: the loaded work orders at version 3. */
const reader: CurrentReader = {
  async rows(entity, codes) {
    const rows = built.masters.find((m) => m.def.name === entity)?.rows ?? [];
    return rows.filter((r) => codes.includes(r.code)).map((r) => ({ code: r.code, ...r.values, row_version: 3 }));
  },
};
const recorder = () => {
  const sets: ChangeSetRequest[] = [];
  const store: ChangeStore = { apply: async (r) => (sets.push(r), { id: r.id, items: r.items.map((i) => ({ entity: i.entity, op: i.op, code: i.code, rowVersion: 4 })), replayed: false }) };
  return { sets, store };
};

describe("governed workbook import", () => {
  const original = raw[WO]![0]!;
  const id = String(original.Work_Order_ID);

  it("writes only the fields an import actually changed, at the current version", async () => {
    const { sets, store } = recorder();
    const after = [{ ...original, Status: "In Progress", Estimated_Cost_INR: 4321.5 }, raw[WO]![1]!];
    const r = await governedImport({ id: uuid, sheets: { [WO]: { after, before: [original, raw[WO]![1]!] } } }, member("planner"), reader, store);
    expect(r).toMatchObject({ inserted: 0, updated: 1, unchanged: 1 });
    expect(sets[0]).toEqual({ id: uuid, source: "import", items: [{ entity: "work_order", op: "update", code: id, baseVersion: 3, values: { status: "IN_PROGRESS", estimated_cost: "4321.5" } }] });
  });

  it("inserts records the database does not have", async () => {
    const { sets, store } = recorder();
    const fresh = { ...original, Work_Order_ID: "WO-NEW-1" };
    const r = await governedImport({ id: uuid, sheets: { [WO]: { after: [fresh] } } }, member("planner"), reader, store);
    expect(r.inserted).toBe(1);
    expect(sets[0]!.items[0]).toMatchObject({ op: "insert", code: "WO-NEW-1", values: expect.objectContaining({ site: expect.any(String) }) });
    expect(sets[0]!.items[0]!.values).not.toHaveProperty("source_ordinal");
  });

  it("refuses to overwrite a field someone else changed since the runtime loaded it", async () => {
    const { sets, store } = recorder();
    // What this user loaded differs from what the database now holds (someone saved in between).
    const staleBefore = { ...original, Status: original.Status === "Open" ? "Scheduled" : "Open" };
    const after = { ...original, Status: "In Progress" };
    await expect(governedImport({ id: uuid, sheets: { [WO]: { after: [after], before: [staleBefore] } } }, member("planner"), reader, store)).rejects.toMatchObject({
      status: 409,
      code: "import_conflict",
      extra: { conflicts: [expect.objectContaining({ code: id, field: "status" })] },
    });
    expect(sets).toHaveLength(0);
  });

  it("refuses values outside the vocabulary, and viewers", async () => {
    const { store } = recorder();
    await expect(governedImport({ id: uuid, sheets: { [WO]: { after: [{ ...original, Priority: "Whenever" }] } } }, member("planner"), reader, store)).rejects.toMatchObject({ status: 422, code: "unmapped_values" });
    await expect(governedImport({ id: uuid, sheets: {} }, member("viewer"), reader, store)).rejects.toMatchObject({ status: 403 });
  });

  it("leaves masters, time series and removed rows untouched, and says so", async () => {
    const { sets, store } = recorder();
    const r = await governedImport(
      { id: uuid, sheets: { Sites: { after: [raw.Sites![0]!] }, "Twin Telemetry": { after: [raw["Twin Telemetry"]![0]!] }, [WO]: { after: [original], before: [original, raw[WO]![1]!] } } },
      member("admin"),
      reader,
      store,
    );
    expect(sets).toHaveLength(0);
    expect(r.changeSet).toBeNull();
    expect(r.skipped.map((s) => [s.sheet, s.rows])).toEqual([["Sites", 1], ["Twin Telemetry", 1], [WO, 1]]);
  });

  it("is a write for the license gate", () => {
    expect(requirementFor("/api/aip/workbook/changes", "POST")).toBe("writable");
    expect(requirementFor("/api/aip/workbook", "GET")).toBe("readable");
  });
});
