import { describe, expect, it } from "vitest";
import { notModified, workbookVersion, type VersionSource } from "../lib/workbook-version";

const src = (audit: string | null, cs: string | null): VersionSource => ({ latestAudit: async () => audit, latestChangeSet: async () => cs });

describe("governed workbook version", () => {
  it("changes with any audited write, any change set, the tenant and the build", async () => {
    const base = await workbookVersion("t1", src("812", "2026-10-06T06:00:00Z"), "abc");
    expect(base).toBe('W/"wb-abc-t1-812-1791266400000"');
    expect(await workbookVersion("t1", src("813", "2026-10-06T06:00:00Z"), "abc")).not.toBe(base);
    expect(await workbookVersion("t1", src("812", "2026-10-06T06:00:01Z"), "abc")).not.toBe(base);
    expect(await workbookVersion("t2", src("812", "2026-10-06T06:00:00Z"), "abc")).not.toBe(base);
    expect(await workbookVersion("t1", src("812", "2026-10-06T06:00:00Z"), "def")).not.toBe(base);
    expect(await workbookVersion("t1", src(null, null), "abc")).toBe('W/"wb-abc-t1-0-0"');
  });

  it("answers not modified only for the same version", () => {
    const tag = 'W/"wb-abc-t1-812-0"';
    expect(notModified(tag, tag)).toBe(true);
    expect(notModified('"wb-abc-t1-812-0"', tag)).toBe(true);
    expect(notModified('W/"x", W/"wb-abc-t1-812-0"', tag)).toBe(true);
    expect(notModified("*", tag)).toBe(true);
    expect(notModified('W/"wb-abc-t1-813-0"', tag)).toBe(false);
    expect(notModified(null, tag)).toBe(false);
  });
});
