import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inferRegistry } from "@sustantix/schema";
import { provision } from "../src/provision.ts";
import { GUARD_MESSAGES, guardStepName, rolePrivileges } from "../src/steps.ts";
import { WebApi, type Fetcher } from "../src/webapi.ts";

const ORG = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const BU = "9a9a9a9a-0000-0000-0000-000000000001";
const wb = readFileSync(new URL("../../../reference/AIP_Data_v732.xlsx", import.meta.url));
const registry = inferRegistry(wb, "AIP_Data_v732.xlsx");

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
      const parts = String(body).split(/--batch_\w+/).filter((p) => p.includes("PATCH"));
      for (const p of parts) {
        const set = /PATCH \S+\/v9\.2\/(\w+)\(/.exec(p)?.[1] ?? "?";
        upserts[set] = (upserts[set] ?? 0) + 1;
      }
      return new Response(parts.map(() => "--r\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 204 No Content\r\n\r\n\r\n").join("") + "--r--", { status: 200 });
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
  return { fetcher, calls, upserts, entities, sets };
}

const dll = Buffer.from("MZ-plugin-bytes");

describe("provision", () => {
  it("creates the complete solution inside SustantixAIP and is idempotent", async () => {
    const dv = mockDataverse();
    const api = new WebApi({ envUrl: "https://contoso.crm.dynamics.com", token: async () => "t", solution: "SustantixAIP", fetcher: dv.fetcher, sleep: async () => {} });
    const logs: string[] = [];
    const first = await provision(api, { version: "7.32.0.0", registry, pluginDll: dll, dataModel: true, guardDataModel: false, seedWorkbook: wb, fx: {} }, (m) => logs.push(m));

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
    const second = await provision(api, { version: "7.32.0.0", registry, pluginDll: dll, dataModel: true, guardDataModel: false, fx: {} }, () => {});
    const secondCreates = dv.calls.slice(before).filter((c) => c.method === "POST" && !["PublishAllXml"].includes(c.path) && !c.path.endsWith("AddPrivilegesRole"));
    expect(second.guardStepsCreated).toBe(0);
    expect(secondCreates).toEqual([]);
  });

  it("guards every data-model table when requested", async () => {
    const dv = mockDataverse();
    const api = new WebApi({ envUrl: "https://contoso.crm.dynamics.com", token: async () => "t", solution: "SustantixAIP", fetcher: dv.fetcher, sleep: async () => {} });
    const r = await provision(api, { version: "7.32.0.0", registry, pluginDll: dll, dataModel: true, guardDataModel: true, fx: {} }, () => {});
    expect(r.guardStepsCreated).toBe((registry.tables.length + 1) * GUARD_MESSAGES.length);
  });

  it("refuses to invent a currency without an FX rate", async () => {
    const dv = mockDataverse();
    dv.sets.transactioncurrencies = [];
    const api = new WebApi({ envUrl: "https://contoso.crm.dynamics.com", token: async () => "t", solution: "SustantixAIP", fetcher: dv.fetcher, sleep: async () => {} });
    await expect(provision(api, { version: "7.32.0.0", registry, pluginDll: dll, dataModel: true, guardDataModel: false, fx: {} }, () => {})).rejects.toThrow(/--fx INR=/);
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
});
