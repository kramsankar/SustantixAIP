import { describe, expect, it } from "vitest";
import { exportEntity, exportPage, type ExportReader } from "../lib/bundle";
import { requirementFor } from "../lib/gate";
import { CHANGE_MODEL } from "../lib/grid/catalogue";

describe("bundle export (Vercel edition)", () => {
  const sites = Array.from({ length: 2300 }, (_, i) => ({ code: `SP-${String(i).padStart(4, "0")}`, name: `Site ${i}`, region: i % 2 ? "IN" : null, capacity_mw: 10, is_active: true }));
  /** A database that caps every answer at 1,000 rows, as PostgREST does. */
  const reader = (calls: Array<{ view: string; select: string; offset: number; limit: number }>): ExportReader => ({
    async page(view, select, offset, limit) {
      calls.push({ view, select, offset, limit });
      return { rows: sites.slice(offset, offset + Math.min(limit, 1000)), total: sites.length };
    },
  });

  it("reads an entity's code view, decimals as text, and says whether more remain even when the database caps a page", async () => {
    const calls: Array<{ view: string; select: string; offset: number; limit: number }> = [];
    const p = await exportPage(CHANGE_MODEL, "site", 0, 5000, reader(calls));
    expect(p).toMatchObject({ more: true, total: 2300 });
    expect(p.records).toHaveLength(1000);
    expect(p.records[0]).toEqual({ code: "SP-0000", values: { name: "Site 0", capacity_mw: 10, is_active: true } });
    expect(calls[0]!.view).toBe("v_site");
    const last = await exportPage(CHANGE_MODEL, "site", 2000, 5000, reader(calls));
    expect(last).toMatchObject({ more: false });
    expect(last.records).toHaveLength(300);
    expect(exportEntity(CHANGE_MODEL, "asset").select).toContain("rated_capacity_mw:rated_capacity_mw::text");
    expect(exportEntity(CHANGE_MODEL, "work_order").select).not.toContain("source_ordinal");
  });

  it("refuses entities a bundle does not carry and pages out of range", async () => {
    await expect(exportPage(CHANGE_MODEL, "tenants", 0, 10, reader([]))).rejects.toMatchObject({ status: 404 });
    await expect(exportPage(CHANGE_MODEL, "site", -1, 10, reader([]))).rejects.toMatchObject({ status: 400 });
    await expect(exportPage(CHANGE_MODEL, "site", 0, 5001, reader([]))).rejects.toMatchObject({ status: 400 });
  });

  it("is a read under the license gate (administrators only, checked by the route)", () => {
    expect(requirementFor("/api/aip/bundle/site", "GET")).toBe("readable");
  });
});
