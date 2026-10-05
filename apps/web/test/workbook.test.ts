import { describe, expect, it } from "vitest";
import { COMPAT_SHEETS, governedWorkbook, type Row, type SheetReader } from "../lib/workbook";
import { requirementFor } from "../lib/gate";

class MemoryReader implements SheetReader {
  readonly reads: string[] = [];
  constructor(private readonly rows: Record<string, Row[]>) {}
  async read(schema: "aip" | "aip_compat", table: string): Promise<Row[]> {
    this.reads.push(`${schema}.${table}`);
    return this.rows[`${schema}.${table}`] ?? [];
  }
}

describe("governed workbook", () => {
  it("reads rebuilt sheets from their compatibility views and the rest from their sheet tables", async () => {
    const reader = new MemoryReader({
      "aip_compat.work_orders": [{ work_order_id: "WO-1", created_date: "2026-03-14T00:00:00", sla_due: "2026-03-16T08:30:00", estimated_cost: "125000.50", asset_id: "AST-00001" }],
      "aip.sites": [{ plant_id: "SP-01", plant_name: "Plant 1", capacity_mw: 120 }],
    });
    const g = await governedWorkbook(reader, COMPAT_SHEETS, "Governed data");
    expect(COMPAT_SHEETS.has("work_orders")).toBe(true);
    expect(reader.reads).toContain("aip_compat.work_orders");
    expect(reader.reads).toContain("aip.sites");
    expect(reader.reads).not.toContain("aip.work_orders");
    const wo = g.sheets["Work Orders"]![0] as Row;
    // Workbook headers and value forms: midnight as a bare date where the column writes it so, numbers as numbers.
    expect(wo).toMatchObject({ Work_Order_ID: "WO-1", Created_Date: "2026-03-14", SLA_Due: "2026-03-16 08:30", Asset_ID: "AST-00001" });
    expect(Object.values(wo)).toContain(125000.5);
    expect(g.sheets.Sites![0]).toMatchObject({ Plant_ID: "SP-01", Plant_Name: "Plant 1", Capacity_MW: 120 });
  });

  it("leaves the large time series to the runtime's bundle", async () => {
    const g = await governedWorkbook(new MemoryReader({}), COMPAT_SHEETS, "x");
    expect(g.omitted).toEqual(expect.arrayContaining(["Twin Telemetry", "Inverter Telemetry", "PV_Module_Register"]));
    expect(g.sheets["Twin Telemetry"]).toBeUndefined();
    expect(Object.keys(g.sheets).length + g.omitted.length).toBe(161);
  });

  it("is a licensed, readable endpoint", () => {
    expect(requirementFor("/api/aip/workbook", "GET")).toBe("readable");
  });
});
