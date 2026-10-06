import type { ChangeSetRequest } from "@sustantix/grid";
import type { DataverseGridClient } from "@sustantix/host-bridge/src/adapters/dataverse-grid.ts";
import { describe, expect, it } from "vitest";
import { exportBundle, importBundle, readBundle } from "../src/bundle.ts";
import { dataverseSide } from "../src/dataverse.ts";
import { webApiGridClient } from "../src/dataverse-webapi.ts";
import { collect, json, MODEL, RULES, seeded, type Row } from "./helpers.ts";

const F = "@OData.Community.Display.V1.FormattedValue";
interface DvColumn { name: string; kind: string; attribute: string; target?: string; scope?: string }
interface DvEntity { name: string; table: string; scoped?: boolean; columns: DvColumn[] }
const DV = json("../../../powerplatform/schema/change-model.json") as { key: string; entities: DvEntity[]; platformCodes: Record<string, string[]> };

/**
 * A Dataverse environment in memory: rows in Dataverse's own shape (attributes, lookups with formatted names, decimals
 * as numbers, statecode, versionnumber), and a change-set API that applies items the way the plug-in does.
 */
class Environment {
  tables = new Map<string, Row[]>();
  calls: ChangeSetRequest[] = [];
  constructor() {
    // Platform vocabulary ships with every environment.
    for (const [ref, codes] of Object.entries(DV.platformCodes)) this.tables.set(`sus_${ref}`, codes.map((c, i) => ({ sus_name: c, sus_label: c, statecode: 0, versionnumber: i + 1 })));
  }
  rows(table: string) {
    let r = this.tables.get(table);
    if (!r) this.tables.set(table, (r = []));
    return r;
  }
  apply(req: ChangeSetRequest) {
    this.calls.push(req);
    for (const item of req.items) {
      const e = DV.entities.find((x) => x.name === item.entity)!;
      const key = e.scoped ? item.code.replace(":", "/") : item.code;
      const rows = this.rows(e.table);
      let row = rows.find((r) => r[DV.key] === key);
      if (item.op === "insert") {
        if (row) throw new Error(`AIPCHANGESET ${JSON.stringify({ error: "duplicate", message: `${key} exists` })}`);
        rows.push((row = { [DV.key]: key, versionnumber: 0, statecode: 0 }));
      } else if (!row || row.versionnumber !== item.baseVersion) throw new Error(`AIPCHANGESET ${JSON.stringify({ error: "conflict", message: `${key} changed` })}`);
      for (const [k, v] of Object.entries(item.values ?? {})) {
        const c = e.columns.find((x) => x.name === k)!;
        if (c.attribute === "statecode") row.statecode = v ? 0 : 1;
        else if (c.attribute === "transactioncurrencyid") row[`_transactioncurrencyid_value${F}`] = v;
        else if (c.target) {
          // A lookup binds by the target's business code; a scoped vocabulary row is named scope/CODE.
          const target = this.rows(c.target).find((r) => r[DV.key] === (c.scope ? `${c.scope}/${v}` : v));
          if (!target) throw new Error(`AIPCHANGESET ${JSON.stringify({ error: "unknown_reference", message: `${c.name} ${String(v)} not found` })}`);
          row[`_${c.attribute}_value`] = "guid";
          row[`_${c.attribute}_value${F}`] = target[DV.key];
        } else row[c.attribute] = (c.kind === "decimal" || c.kind === "money") && typeof v === "string" ? Number(v) : v;
      }
      row.versionnumber = Number(row.versionnumber) + 1;
    }
    return { id: req.id, items: req.items.map((i) => ({ entity: i.entity, op: i.op, code: i.code, rowVersion: null })), replayed: false };
  }
  client(): DataverseGridClient {
    return {
      entitySet: (l) => `${l}s`,
      list: async (set, _select, token) => {
        const all = this.rows(set.slice(0, -1));
        const from = Number(token ?? 0);
        // Pages of two, to prove the reader follows the server's next link.
        return { rows: all.slice(from, from + 2).map((r) => ({ ...r })), ...(from + 2 < all.length ? { skipToken: String(from + 2) } : {}) };
      },
      customApi: async (_name, body) => {
        const req = JSON.parse(String(body.ChangeSetJson)) as ChangeSetRequest & { probe?: string };
        return { ResultJson: JSON.stringify(this.apply(req)) };
      },
    };
  }
}

let seq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const side = (env: Environment) => dataverseSide(env.client(), MODEL, RULES, { tenant: "org.crm.example", newId });

describe("Power Platform edition", () => {
  it("takes a tenant exported from the Vercel edition and exports it back identically", async () => {
    const vercel = seeded();
    const first = await collect(exportBundle(vercel.source("A"), MODEL, () => new Date(0)));
    const env = new Environment();
    const report = await importBundle(await readBundle(first, MODEL), MODEL, side(env).sink);
    expect(report.issues, JSON.stringify(report.issues)).toEqual([]);
    expect(report.entities.map((e) => [e.entity, e.applied])).toEqual([["ref_asset_class", 1], ["site", 2], ["asset", 3], ["work_order", 1]]);
    // Stored the Dataverse way: the code in sus_name, the name in its own attribute, lookups by code, amounts as numbers.
    const site = env.rows("sus_site").find((r) => r.sus_name === "SP-01")!;
    expect(site).toMatchObject({ sus_displayname: "Solar Park 1", [`_sus_regionid_value${F}`]: "IN", sus_capacitymw: 50 });
    expect(env.rows("sus_asset").find((r) => r.sus_name === "AST-A-INV1")).toMatchObject({ [`_sus_parentid_value${F}`]: "AST-Z-BLOCK", sus_ratedcapacitymw: 2.5 });
    // Exported from Dataverse, the bundle is byte for byte the one the Vercel edition wrote (platform vocabulary stays home).
    const back = await collect(exportBundle({ ...side(env).source, edition: "vercel", tenant: "A" }, MODEL, () => new Date(0)));
    expect(back).toEqual(first);
  });

  it("re-imports without a single write, and refuses a bad reference without losing the rest", async () => {
    const env = new Environment();
    const bundle = await readBundle(await collect(exportBundle(seeded().source("A"), MODEL)), MODEL);
    await importBundle(bundle, MODEL, side(env).sink);
    const writes = env.calls.length;
    const again = await importBundle(bundle, MODEL, side(env).sink);
    expect(env.calls.length).toBe(writes);
    expect(again.entities.every((e) => e.unchanged === e.records)).toBe(true);

    const bad = seeded();
    bad.table("asset").set("AST-ORPHAN", { code: "AST-ORPHAN", site: "SP-01", tag: "O", name: "Orphan", asset_class: "INVERTER", operating_status: "RETIRED", is_active: true, row_version: 1 });
    const r = await importBundle(await readBundle(await collect(exportBundle(bad.source("A"), MODEL)), MODEL), MODEL, side(new Environment()).sink);
    expect(r.entities.find((e) => e.entity === "asset")).toMatchObject({ applied: 3, quarantined: 1 });
    expect(r.issues).toEqual([expect.objectContaining({ record: "AST-ORPHAN", rule: "REF", message: expect.stringContaining("RETIRED") })]);
  });
});

describe("Dataverse Web API client", () => {
  it("resolves entity sets from metadata, asks for formatted values, and follows next links", async () => {
    const seen: Array<{ method: string; path: string; headers?: Record<string, string> }> = [];
    const api = {
      base: "https://org.crm.example/api/data/v9.2/",
      async request<T>(method: string, path: string, _body?: unknown, headers?: Record<string, string>) {
        seen.push({ method, path, ...(headers ? { headers } : {}) });
        if (path.startsWith("EntityDefinitions")) return { value: [{ LogicalName: "sus_site", EntitySetName: "sus_sites" }, { LogicalName: "sus_ref_status", EntitySetName: "sus_ref_statuses" }] } as T;
        if (path === "sus_sites?$select=sus_name,versionnumber") return { value: [{ sus_name: "SP-01" }], "@odata.nextLink": "https://org.crm.example/api/data/v9.2/sus_sites?$skiptoken=abc" } as T;
        if (path === "sus_ApplyChangeSet") return { ResultJson: "{}" } as T;
        return { value: [{ sus_name: "SP-02" }] } as T;
      },
    };
    const c = await webApiGridClient(api);
    expect(c.entitySet("sus_ref_status")).toBe("sus_ref_statuses");
    const p1 = await c.list("sus_sites", ["sus_name", "versionnumber"]);
    expect(p1).toEqual({ rows: [{ sus_name: "SP-01" }], skipToken: "sus_sites?$skiptoken=abc" });
    expect(seen[1]!.headers!.Prefer).toContain("FormattedValue");
    expect((await c.list("sus_sites", [], p1.skipToken)).rows).toEqual([{ sus_name: "SP-02" }]);
    expect(seen[2]!.path).toBe("sus_sites?$skiptoken=abc");
    expect(await c.customApi("sus_ApplyChangeSet", { ChangeSetJson: "{}" })).toEqual({ ResultJson: "{}" });
    expect(seen[3]).toMatchObject({ method: "POST", path: "sus_ApplyChangeSet" });
  });
});
