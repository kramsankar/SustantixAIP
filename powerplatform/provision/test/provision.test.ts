import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { buildMasters, loadCorrections, loadVocabulary, masterDefs, readSheets, transactionDefs, type Registry } from "@sustantix/schema";
import { provision } from "../src/provision.ts";
import { GUARD_MESSAGES, guardStepName, rolePrivileges } from "../src/steps.ts";
import { WebApi, type Fetcher } from "../src/webapi.ts";

const ORG = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const BU = "9a9a9a9a-0000-0000-0000-000000000001";
const wb = readFileSync(new URL("../../../reference/AIP_Data_v915.xlsx", import.meta.url));
const registry = JSON.parse(readFileSync(new URL("../../../schema/aip-data-model.json", import.meta.url), "utf8")) as Registry;

/** In-memory Dataverse double covering the Web API surface the provisioner uses. */
function mockDataverse() {
  let seq = 0;
  const guid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const sets: Record<string, Array<Record<string, unknown>>> = {
    sdkmessages: ["Create", "Update", "Delete", "Retrieve", "RetrieveMultiple"].map((name) => ({ sdkmessageid: guid(), name })),
    transactioncurrencies: [{ transactioncurrencyid: guid(), isocurrencycode: "INR" }],
  };
  const entities = new Map<string, { attrs: Set<string>; keys: Set<string>; set: string }>();
  const calls: Array<{ method: string; path: string; solution?: string }> = [];
  const upserts: Record<string, number> = {};
  const relationships = new Map<string, Record<string, unknown>>();
  const batchBodies: string[] = [];
  const idField: Record<string, string> = {
    publishers: "publisherid", solutions: "solutionid", pluginassemblies: "pluginassemblyid", plugintypes: "plugintypeid",
    customapis: "customapiid", sdkmessageprocessingsteps: "sdkmessageprocessingstepid", roles: "roleid",
    environmentvariabledefinitions: "environmentvariabledefinitionid", transactioncurrencies: "transactioncurrencyid",
  };
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const created = (set: string, id: string) => new Response(null, { status: 204, headers: { "OData-EntityId": `https://x/api/data/v9.2/${set}(${id})` } });

  const matches = (row: Record<string, unknown>, filter: string): boolean =>
    filter.split(" and ").every((clause): boolean => {
      const m = /^(\w+) eq (?:'((?:[^']|'')*)'|([0-9a-f-]{36}))$/.exec(clause.trim());
      if (!m) return clause.includes(" or ") ? clause.split(" or ").some((c) => matches(row, c)) : false;
      return String(row[m[1]!]) === (m[2] !== undefined ? m[2].replace(/''/g, "'") : m[3]);
    });

  const fetcher: Fetcher = async (url, init) => {
    const path = decodeURIComponent(url.replace(/^https:\/\/[^/]+\/api\/data\/v9\.2\//, ""));
    const method = init.method ?? "GET";
    const headers = init.headers as Record<string, string>;
    calls.push({ method, path, solution: headers["MSCRM.SolutionUniqueName"] });
    const body = init.body ? (typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : init.body) : undefined;

    if (path === "WhoAmI") return json({ OrganizationId: ORG, BusinessUnitId: BU, UserId: guid() });
    if (path === "PublishAllXml" || path.endsWith("AddPrivilegesRole")) return new Response(null, { status: 204 });
    if (path === "$batch") {
      batchBodies.push(String(body));
      const parts = String(body).split(/--batch_\w+/).filter((p) => p.includes("PATCH"));
      for (const p of parts) {
        const set = /PATCH \S+\/v9\.2\/(\w+)\(/.exec(p)?.[1] ?? "?";
        upserts[set] = (upserts[set] ?? 0) + 1;
      }
      return new Response(parts.map(() => "--r\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 204 No Content\r\n\r\n\r\n").join("") + "--r--", { status: 200 });
    }
    let r = /^RelationshipDefinitions\(SchemaName='(\w+)'\)/.exec(path);
    if (r) return relationships.has(r[1]!) ? json({ SchemaName: r[1] }) : json({ error: { code: "0x80040217", message: "not found" } }, 404);
    if (path === "RelationshipDefinitions" && method === "POST") {
      const referencing = entities.get(String(body.ReferencingEntity));
      const referenced = entities.get(String(body.ReferencedEntity));
      if (!referencing || !referenced) return json({ error: { code: "mock", message: `relationship ${String(body.SchemaName)} names a missing table` } }, 400);
      relationships.set(String(body.SchemaName), body);
      referencing.attrs.add(String((body.Lookup as { SchemaName: string }).SchemaName).toLowerCase());
      return created("RelationshipDefinitions", guid());
    }
    let m = /^EntityDefinitions\(LogicalName='(\w+)'\)(\/(Attributes|Keys))?(\?.*)?$/.exec(path);
    if (m) {
      const e = entities.get(m[1]!);
      if (!e) return json({ error: { code: "0x80060888", message: "not found" } }, 404);
      if (method === "POST" && m[3] === "Attributes") return e.attrs.add(String(body.SchemaName).toLowerCase()), created("Attributes", guid());
      if (method === "POST" && m[3] === "Keys") return e.keys.add(String(body.SchemaName).toLowerCase()), created("Keys", guid());
      if (m[3] === "Attributes") return json({ value: [...e.attrs].map((LogicalName) => ({ LogicalName })) });
      if (m[3] === "Keys") return json({ value: [...e.keys].map((LogicalName) => ({ LogicalName })) });
      return json({ LogicalName: m[1], EntitySetName: e.set });
    }
    if (path === "EntityDefinitions" && method === "POST") {
      const ln = String(body.SchemaName).toLowerCase();
      entities.set(ln, { attrs: new Set((body.Attributes as Array<{ SchemaName: string }>).map((a) => a.SchemaName.toLowerCase())), keys: new Set(), set: ln + "s" });
      return created("EntityDefinitions", guid());
    }
    m = /^(\w+)\?\$select=[\w,]+&\$filter=(.+?)(&\$top=1)?$/.exec(path);
    if (m && method === "GET") {
      const [_, set, filter] = m;
      if (set === "privileges") {
        const names = [...filter!.matchAll(/name eq '(\w+)'/g)].map((x) => x[1]!);
        return json({ value: names.map((name) => ({ privilegeid: guid(), name })) });
      }
      if (set === "sdkmessagefilters") return json({ value: [{ sdkmessagefilterid: guid() }] });
      return json({ value: (sets[set!] ?? []).filter((r) => matches(r, filter!)) });
    }
    m = /^(\w+)$/.exec(path);
    if (m && method === "POST") {
      const id = guid();
      (sets[m[1]!] ??= []).push({ ...body, [idField[m[1]!] ?? "id"]: id, _businessunitid_value: BU });
      return created(m[1]!, id);
    }
    m = /^(\w+)\(([0-9a-f-]{36})\)$/.exec(path);
    if (m && method === "PATCH") return new Response(null, { status: 204 });
    return json({ error: { code: "mock", message: `unhandled ${method} ${path}` } }, 400);
  };
  return { fetcher, calls, upserts, entities, sets, relationships, batchBodies };
}

const dll = Buffer.from("MZ-plugin-bytes");

describe("provision", () => {
  it("creates the complete solution inside SustantixAIP and is idempotent", async () => {
    const dv = mockDataverse();
    const api = new WebApi({ envUrl: "https://contoso.crm.dynamics.com", token: async () => "t", solution: "SustantixAIP", fetcher: dv.fetcher, sleep: async () => {} });
    const logs: string[] = [];
    const first = await provision(api, { version: "9.15.0.0", registry, pluginDll: dll, dataModel: true, guardDataModel: false, seedWorkbook: wb, fx: {} }, (m) => logs.push(m));

    expect(first.organizationId).toBe(ORG);
    expect(first.tables).toBe(registry.tables.length + 2);
    expect(dv.entities.has("sus_runtimestate")).toBe(true);
    expect(dv.entities.get("sus_work_orders")?.keys.has("sus_work_orders_bk")).toBe(true);
    expect(first.guardStepsCreated).toBe(GUARD_MESSAGES.length);
    expect(dv.sets.sdkmessageprocessingsteps?.map((s) => s.name)).toContain(guardStepName("RetrieveMultiple", "sus_runtimestate"));
    expect(dv.sets.customapis?.[0]).toMatchObject({ uniquename: "sus_GetLicenseStatus", isfunction: false });
    expect(dv.sets.roles?.map((r) => r.name)).toEqual(["Sustantix AIP User", "Sustantix AIP Administrator"]);
    expect(Object.values(first.seeded).reduce((a, b) => a + b, 0)).toBe(registry.tables.reduce((a, t) => a + t.rowCount, 0));
    expect(first.seedFailures).toEqual([]);

    const creates = dv.calls.filter((c) => c.method === "POST" && !["WhoAmI", "PublishAllXml", "$batch"].includes(c.path) && !c.path.endsWith("AddPrivilegesRole"));
    expect(creates.length).toBeGreaterThan(100);
    expect(creates.every((c) => c.solution === "SustantixAIP")).toBe(true);

    const before = dv.calls.length;
    const second = await provision(api, { version: "9.15.0.0", registry, pluginDll: dll, dataModel: true, guardDataModel: false, fx: {} }, () => {});
    const secondCreates = dv.calls.slice(before).filter((c) => c.method === "POST" && !["PublishAllXml"].includes(c.path) && !c.path.endsWith("AddPrivilegesRole"));
    expect(second.guardStepsCreated).toBe(0);
    expect(secondCreates).toEqual([]);
  });

  it("guards every data-model table when requested", async () => {
    const dv = mockDataverse();
    const api = new WebApi({ envUrl: "https://contoso.crm.dynamics.com", token: async () => "t", solution: "SustantixAIP", fetcher: dv.fetcher, sleep: async () => {} });
    const r = await provision(api, { version: "9.15.0.0", registry, pluginDll: dll, dataModel: true, guardDataModel: true, fx: {} }, () => {});
    expect(r.guardStepsCreated).toBe((registry.tables.length + 1) * GUARD_MESSAGES.length);
  });

  it("provisions the reference layer with every platform code and alias, idempotently", async () => {
    const vocabulary = loadVocabulary(fileURLToPath(new URL("../../../", import.meta.url)));
    const dv = mockDataverse();
    const api = new WebApi({ envUrl: "https://contoso.crm.dynamics.com", token: async () => "t", solution: "SustantixAIP", fetcher: dv.fetcher, sleep: async () => {} });
    const r = await provision(api, { version: "9.15.0.0", registry, vocabulary, pluginDll: dll, dataModel: false, guardDataModel: true, fx: {} }, () => {});
    const expected = vocabulary.tables.reduce((n, t) => n + t.values.length + t.aliases.length, 0);
    expect(r.tables).toBe(2 + vocabulary.tables.length + 1);
    expect(r.referenceRecords).toBe(expected);
    expect(dv.entities.get("sus_ref_status")?.attrs.has("sus_scope")).toBe(true);
    expect(dv.upserts.sus_ref_units).toBe(vocabulary.tables.find((t) => t.name === "unit")!.values.length);
    expect(r.guardStepsCreated).toBe((vocabulary.tables.length + 2) * GUARD_MESSAGES.length);

    const before = dv.calls.length;
    await provision(api, { version: "9.15.0.0", registry, vocabulary, pluginDll: dll, dataModel: false, guardDataModel: true, fx: {} }, () => {});
    const creates = dv.calls.slice(before).filter((c) => c.method === "POST" && !["PublishAllXml", "$batch"].includes(c.path) && !c.path.endsWith("AddPrivilegesRole"));
    expect(creates).toEqual([]);
  });

  it("seeds the governed corrections and logs each corrected record", async () => {
    const corrections = loadCorrections(fileURLToPath(new URL("../../../", import.meta.url)));
    const dv = mockDataverse();
    const api = new WebApi({ envUrl: "https://contoso.crm.dynamics.com", token: async () => "t", solution: "SustantixAIP", fetcher: dv.fetcher, sleep: async () => {} });
    const r = await provision(api, { version: "9.15.0.0", registry, corrections, pluginDll: dll, dataModel: true, guardDataModel: false, seedWorkbook: wb, fx: {} }, () => {});
    expect(r.correctedRecords).toBe(515);
    expect(dv.entities.has("sus_datacorrection")).toBe(true);
    expect(dv.upserts.sus_datacorrections).toBe(515);
    expect(r.seeded.sus_work_orders).toBe(383 + 46 + 24);
    expect(r.seeded.sus_asset_master).toBe(969 + 232 + 4);
    expect(r.seedFailures).toEqual([]);
  });

  it("refuses to invent a currency without an FX rate", async () => {
    const dv = mockDataverse();
    dv.sets.transactioncurrencies = [];
    const api = new WebApi({ envUrl: "https://contoso.crm.dynamics.com", token: async () => "t", solution: "SustantixAIP", fetcher: dv.fetcher, sleep: async () => {} });
    await expect(provision(api, { version: "9.15.0.0", registry, pluginDll: dll, dataModel: true, guardDataModel: false, fx: {} }, () => {})).rejects.toThrow(/--fx INR=/);
  });

  it("gives users read-only access and never exposes license memory", () => {
    const p = rolePrivileges(["sus_work_orders"]);
    expect(p.user).toEqual(["prvReadsus_runtimestate", "prvReadsus_work_orders"]);
    expect(p.admin).toContain("prvWritesus_work_orders");
    expect([...p.user, ...p.admin].some((n) => n.includes("licensestate"))).toBe(false);
  });

  it("retries throttled requests honouring Retry-After", async () => {
    let n = 0;
    const waits: number[] = [];
    const api = new WebApi({
      envUrl: "https://contoso.crm.dynamics.com",
      token: async () => "t",
      sleep: async (ms) => void waits.push(ms),
      fetcher: async () => (++n < 3 ? new Response("", { status: 429, headers: { "Retry-After": "2" } }) : new Response(JSON.stringify({ ok: 1 }), { status: 200 })),
    });
    expect(await api.get("WhoAmI")).toEqual({ ok: 1 });
    expect(waits).toEqual([2000, 2000]);
  });

  it("rejects non-https environments", () => {
    expect(() => new WebApi({ envUrl: "http://contoso.crm.dynamics.com", token: async () => "t" })).toThrow(/https/);
  });

  it("provisions the phase 2 masters with lookups by business code, self-references second, idempotently", async () => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const vocabulary = loadVocabulary(root);
    const corrections = loadCorrections(root);
    const defs = masterDefs(registry);
    const built = buildMasters(registry, readSheets(wb), vocabulary, corrections);
    const dv = mockDataverse();
    const api = new WebApi({ envUrl: "https://contoso.crm.dynamics.com", token: async () => "t", solution: "SustantixAIP", fetcher: dv.fetcher, sleep: async () => {} });
    const r = await provision(api, { version: "9.15.0.0", registry, vocabulary, corrections, masters: true, seedWorkbook: wb, pluginDll: dll, dataModel: false, guardDataModel: false, fx: {} }, () => {});
    const lookups = [...defs, ...transactionDefs(registry)].reduce((n, d) => n + d.columns.filter((c) => c.kind === "fk" || c.kind === "ref").length, 0);
    expect(r.relationshipsCreated).toBe(lookups);
    expect(dv.entities.get("sus_asset")?.keys.has("sus_asset_bk")).toBe(true);
    expect(dv.entities.get("sus_asset")?.attrs.has("sus_parentid")).toBe(true);
    expect(r.masterRecords).toBe(built.masters.reduce((n, m) => n + m.rows.length, 0));
    expect(r.seedFailures).toEqual([]);
    const assetRows = dv.upserts["sus_assets"] ?? 0;
    expect(assetRows).toBe(1205 + 260); // every asset, then the 260 parent links
    const body = dv.batchBodies.join("\n");
    expect(body).toContain(`"sus_siteid@odata.bind":"/sus_sites(sus_name='SP-01')"`);
    expect(body).toMatch(/"sus_operatingstatusid@odata.bind":"\/sus_ref_statuss\(sus_name='asset_operating\/[A-Z_]+'\)"/);
    expect(body).toMatch(/"sus_parentid@odata.bind":"\/sus_assets\(sus_name='[^']+'\)"/);
    expect(dv.upserts["sus_masterlineages"]).toBe(built.masters.reduce((n, m) => n + m.rows.reduce((k, x) => k + x.lineage.length, 0), 0));

    const before = dv.calls.length;
    const again = await provision(api, { version: "9.15.0.0", registry, vocabulary, corrections, masters: true, pluginDll: dll, dataModel: false, guardDataModel: false, fx: {} }, () => {});
    expect(again.relationshipsCreated).toBe(0);
    expect(dv.calls.slice(before).filter((c) => c.method === "POST" && c.path.startsWith("RelationshipDefinitions"))).toEqual([]);
  });
});
