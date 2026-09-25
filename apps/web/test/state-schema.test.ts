import { describe, expect, it } from "vitest";
import { validateRuntimeState } from "../lib/state/schema";

const good = { data: { Assets: [{ id: "A1", cost: 10 }], Empty: [] }, lastImport: "25/09/2026, 10:00:00", mode: "Uploaded data" };

describe("runtime state validation", () => {
  it("accepts the runtime's snapshot shape", () => {
    const r = validateRuntimeState(good);
    expect(r.ok).toBe(true);
  });

  it("accepts null or missing lastImport (normalised to null)", () => {
    const a = validateRuntimeState({ ...good, lastImport: null });
    const { lastImport: _omit, ...rest } = good;
    const b = validateRuntimeState(rest);
    expect(a.ok && a.value.lastImport).toBeNull();
    expect(b.ok && b.value.lastImport).toBeNull();
  });

  it("accepts structured lastImport JSON", () => {
    expect(validateRuntimeState({ ...good, lastImport: { at: 1, files: ["a.xlsx"] } }).ok).toBe(true);
  });

  const bad: Array<[string, unknown]> = [
    ["null body", null],
    ["array body", [good]],
    ["string body", "state"],
    ["missing data", { mode: "x", lastImport: null }],
    ["missing mode", { data: {}, lastImport: null }],
    ["data as array", { ...good, data: [] }],
    ["sheet not an array", { ...good, data: { Assets: { id: 1 } } }],
    ["row is a number", { ...good, data: { Assets: [1] } }],
    ["row is null", { ...good, data: { Assets: [null] } }],
    ["row is an array", { ...good, data: { Assets: [["a", "b"]] } }],
    ["row is a string", { ...good, data: { Assets: ["row"] } }],
    ["mode too long", { ...good, mode: "m".repeat(65) }],
    ["mode not a string", { ...good, mode: 3 }],
    ["empty sheet name", { ...good, data: { "": [] } }],
    ["unknown top-level key", { ...good, extra: true }],
  ];

  for (const [label, body] of bad) {
    it(`rejects ${label}`, () => {
      const r = validateRuntimeState(body);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.length).toBeGreaterThan(0);
    });
  }

  it("accepts a mode of exactly 64 characters", () => {
    expect(validateRuntimeState({ ...good, mode: "m".repeat(64) }).ok).toBe(true);
  });
});
