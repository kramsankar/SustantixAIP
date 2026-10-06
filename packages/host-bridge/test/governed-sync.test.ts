// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { governedSync } from "../src/governed-sync.js";

const wb = { label: "Governed data", sheets: { "Work Orders": [{ Work_Order_ID: "WO-1", Status: "Open" }, { Work_Order_ID: "WO-2", Status: "Open" }], Sites: [{ Plant_ID: "SP-01" }] } };

describe("governed sync", () => {
  it("sends only the rows an import changed, with the loaded rows they replace", async () => {
    const posts: unknown[] = [];
    const notes: string[] = [];
    const g = governedSync({ load: async () => structuredClone(wb), post: async (b) => (posts.push(b), { inserted: 1, updated: 1, unchanged: 0, skipped: [] }), notify: (m) => notes.push(m), newId: () => "id-1" });
    const loaded = (await g.load())!;
    const data = loaded.sheets as Record<string, Array<Record<string, unknown>>>;
    data["Work Orders"] = [{ Work_Order_ID: "WO-1", Status: "In Progress" }, data["Work Orders"]![1]!, { Work_Order_ID: "WO-3", Status: "Open" }];
    await g.save!({ data, lastImport: "now", mode: "Uploaded data" });
    expect(posts).toEqual([
      { id: "id-1", sheets: { "Work Orders": { after: [{ Work_Order_ID: "WO-1", Status: "In Progress" }, { Work_Order_ID: "WO-3", Status: "Open" }], before: [{ Work_Order_ID: "WO-1", Status: "Open" }] } } },
    ]);
    expect(notes[0]).toBe("Saved to governed data: 1 added, 1 updated");
    // What was saved becomes the new baseline: saving again sends nothing.
    await g.save!({ data, lastImport: "now", mode: "Uploaded data" });
    expect(posts).toHaveLength(1);
  });

  it("restores the changed sheets and rethrows when the server refuses", async () => {
    const notes: Array<[string, string]> = [];
    const g = governedSync({ load: async () => structuredClone(wb), post: async () => { throw new Error("1 field(s) were changed by someone else"); }, notify: (m, k) => notes.push([m, k]) });
    const data = (await g.load())!.sheets as Record<string, Array<Record<string, unknown>>>;
    data["Work Orders"] = [{ Work_Order_ID: "WO-1", Status: "Closed" }];
    await expect(g.save!({ data, lastImport: "now", mode: "Uploaded data" })).rejects.toThrow(/someone else/);
    expect(data["Work Orders"]).toEqual(wb.sheets["Work Orders"]);
    expect(notes[0]).toEqual(["Import not saved: 1 field(s) were changed by someone else", "error"]);
  });
});
