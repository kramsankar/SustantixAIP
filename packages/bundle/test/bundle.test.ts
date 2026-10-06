import { describe, expect, it } from "vitest";
import { bundleOrder, BundleError, decimalText, exportBundle, importBundle, readBundle, type BundleRecord, type BundleSource } from "../src/bundle.ts";
import { vercelSink, vercelSource } from "../src/vercel.ts";
import { collect, MODEL, seeded, Tenant } from "./helpers.ts";

describe("bundle order", () => {
  it("carries vocabulary first, then each entity after everything it refers to", () => {
    const order = bundleOrder(MODEL);
    const at = new Map(order.map((e, i) => [e.name, i]));
    expect(order.length).toBe(MODEL.entities.filter((e) => e.editable || e.layer === "series").length);
    const lastRef = Math.max(...order.filter((e) => e.name.startsWith("ref_")).map((e) => at.get(e.name)!));
    expect(lastRef).toBe(order.filter((e) => e.name.startsWith("ref_")).length - 1);
    for (const e of MODEL.entities) for (const c of e.columns) if (c.kind === "fk" && c.fk && c.fk !== e.name && at.has(e.name) && at.has(c.fk)) expect(at.get(c.fk)!, `${e.name}.${c.name}`).toBeLessThan(at.get(e.name)!);
    expect(order.find((e) => e.name === "asset")!.selfRefs).toEqual(["parent"]);
  });
});

describe("bundle files", () => {
  it("writes decimals without their storage scale, exactly", () => {
    expect(["2.5000", 2.5, "1250.50", "-0.0100", "007.000", "0.000", "-0.0", "123456789012345.123456", "1e5"].map(decimalText)).toEqual(["2.5", "2.5", "1250.5", "-0.01", "7", "0", "0", "123456789012345.123456", "1e5"]);
  });

  it("exports business-coded records in the shape every edition loads, and reads them back verified", async () => {
    const lines = await collect(exportBundle(seeded().source("Tenant A"), MODEL, () => new Date("2026-10-06T00:00:00Z")));
    expect(JSON.parse(lines[0]!)).toEqual({ format: "sustantix-aip-bundle", version: 1, exportedAt: "2026-10-06T00:00:00.000Z", source: { edition: "vercel", tenant: "Tenant A" }, modelVersion: 1 });
    const recs = lines.slice(1, -1).map((l) => JSON.parse(l));
    expect(recs.map((r) => r.e)).toEqual(["ref_asset_class", "site", "site", "asset", "asset", "asset", "work_order"]);
    const inv1 = recs.find((r) => r.code === "AST-A-INV1");
    // Decimals as strings, dates as dates, no versions, no empties.
    expect(inv1.values).toEqual({ site: "SP-01", parent: "AST-Z-BLOCK", tag: "INV1", name: "Inverter 1", asset_class: "INVERTER", rated_capacity_mw: "2.5", last_maintenance_date: "2026-09-30", is_active: true });
    // Instants in UTC, whatever zone the edition answered in; amounts exact.
    expect(recs.find((r) => r.code === "WO-1").values).toMatchObject({ created_date: "2026-10-01T03:00:00", estimated_cost: "1250.5", currency: "INR" });
    const b = await readBundle(lines, MODEL);
    expect([...b.entities.keys()]).toEqual(["ref_asset_class", "site", "asset", "work_order"]);
  });

  it("refuses an altered, cut-off, foreign or malformed bundle", async () => {
    const lines = await collect(exportBundle(seeded().source("A"), MODEL));
    const altered = lines.map((l) => l.replace('"capacity_mw":50', '"capacity_mw":500'));
    await expect(readBundle(altered, MODEL)).rejects.toThrow(/site: records do not match the bundle's checksum/);
    await expect(readBundle(lines.slice(0, -1), MODEL)).rejects.toThrow(/incomplete/);
    await expect(readBundle(lines.filter((l) => !l.includes('"WO-1"')), MODEL)).rejects.toThrow(/work_order: listed but missing/);
    await expect(readBundle([lines[0]!.replace('"version":1', '"version":2'), ...lines.slice(1)], MODEL)).rejects.toThrow(/version 2/);
    await expect(readBundle(['{"format":"something-else"}'], MODEL)).rejects.toThrow(/not a Sustantix AIP bundle/);
    await expect(readBundle([lines[0]!, '{"e":"tenants","code":"x","values":{}}', lines.at(-1)!], MODEL)).rejects.toThrow(BundleError);
    await expect(readBundle([...lines, lines[1]!], MODEL)).rejects.toThrow(/after the end/);
  });

  it("refuses to export a business code twice", async () => {
    const src: BundleSource = { edition: "powerplatform", tenant: "x", read: async function* (e) { if (e === "site") yield [{ code: "S", values: {} }, { code: "S", values: {} }]; } };
    await expect(collect(exportBundle(src, MODEL))).rejects.toThrow(/appears twice/);
  });
});

describe("moving a tenant", () => {
  it("imports into an empty tenant (children before parents included) and re-imports as unchanged", async () => {
    const a = seeded();
    const bundle = await readBundle(await collect(exportBundle(a.source("A"), MODEL)), MODEL);
    const b = new Tenant();
    const r1 = await importBundle(bundle, MODEL, b.sink());
    expect(r1.issues, JSON.stringify(r1.issues)).toEqual([]);
    expect(r1.entities).toEqual([
      { entity: "ref_asset_class", records: 1, applied: 1, unchanged: 0, quarantined: 0 },
      { entity: "site", records: 2, applied: 2, unchanged: 0, quarantined: 0 },
      { entity: "asset", records: 3, applied: 3, unchanged: 0, quarantined: 0 },
      { entity: "work_order", records: 1, applied: 1, unchanged: 0, quarantined: 0 },
    ]);
    expect(b.table("asset").get("AST-A-INV1")).toMatchObject({ parent: "AST-Z-BLOCK", rated_capacity_mw: "2.5" });
    // The target exports exactly what the source did.
    const again = await collect(exportBundle(b.source("A"), MODEL, () => new Date(0)));
    const first = await collect(exportBundle(a.source("A"), MODEL, () => new Date(0)));
    expect(again).toEqual(first);
    // Importing again changes nothing.
    const sets = b.sets;
    const r2 = await importBundle(bundle, MODEL, b.sink());
    expect(r2.entities.every((e) => e.unchanged === e.records && e.applied === 0)).toBe(true);
    expect(b.sets).toBe(sets);
  });

  it("quarantines what the target cannot take and reports why, loading the rest", async () => {
    const a = seeded();
    a.table("asset").set("AST-BAD", { code: "AST-BAD", site: "SP-09", tag: "X", name: "Nowhere", asset_class: "INVERTER", is_active: true, row_version: 1 });
    const bundle = await readBundle(await collect(exportBundle(a.source("A"), MODEL)), MODEL);
    const r = await importBundle(bundle, MODEL, new Tenant().sink());
    expect(r.entities.find((e) => e.entity === "asset")).toMatchObject({ records: 4, applied: 3, quarantined: 1 });
    expect(r.issues, JSON.stringify(r.issues)).toEqual([expect.objectContaining({ entity: "asset", record: "AST-BAD", rule: "REF" })]);
  });
});

describe("Vercel edition over its API", () => {
  it("pages an export from where the server's records end, and delivers through ingest with the key", async () => {
    const calls: Array<{ url: string; auth: string | null; body?: unknown }> = [];
    const all = Array.from({ length: 2500 }, (_, i) => ({ code: `S-${String(i).padStart(4, "0")}`, values: {} }));
    const fetchImpl = (async (u: URL | string, init?: RequestInit) => {
      const url = new URL(String(u));
      const auth = new Headers(init?.headers).get("authorization");
      calls.push({ url: url.pathname + url.search, auth, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      if (url.pathname === "/api/aip/ingest") return Response.json({ applied: 2, unchanged: 0, quarantined: 0, issues: [] });
      const offset = Number(url.searchParams.get("offset"));
      // A server that caps its pages at 1,000 whatever the client asks for.
      const records = all.slice(offset, offset + 1000);
      return Response.json({ records, more: offset + records.length < all.length });
    }) as typeof fetch;
    const t = { url: "https://aip.customer.example", key: "sxi_k", fetch: fetchImpl };
    const got: BundleRecord[] = [];
    for await (const page of vercelSource(t).read("site")) got.push(...page);
    expect(got).toHaveLength(2500);
    expect(calls.map((c) => c.url)).toEqual(["/api/aip/bundle/site?offset=0&limit=5000", "/api/aip/bundle/site?offset=1000&limit=5000", "/api/aip/bundle/site?offset=2000&limit=5000"]);
    expect(await vercelSink(t).deliver("site", got.slice(0, 2))).toMatchObject({ applied: 2 });
    expect(calls.at(-1)).toMatchObject({ url: "/api/aip/ingest", auth: "Bearer sxi_k", body: { entity: "site", records: got.slice(0, 2) } });
  });
});
