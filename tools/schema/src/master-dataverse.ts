/**
 * Dataverse metadata and records for the phase 2 masters. Each master is a table keyed on its business code
 * (sus_name, alternate key); foreign keys and controlled values are lookups (one-to-many relationships, delete
 * restricted) bound by alternate key, so records load in one pass per master and self-references in a second.
 */
import { createHash } from "node:crypto";
import { attributeMetadata, lbl, logical, type EntityPlan } from "./dataverse.ts";
import type { BuiltMaster, MasterColumn, MasterDef } from "./masters.ts";
import { topoOrder } from "./masters.ts";
import { REF_PREFIX, isScoped, type Vocabulary } from "./reference.ts";

type Json = Record<string, unknown>;

const PRIMARY = logical("name");

/** Lookup attribute (and navigation property) for a reference column. */
export const lookupName = (c: MasterColumn) => logical(`${c.name.replace(/_/g, "")}id`);
/** Entity a reference column points to. */
export const lookupTarget = (c: MasterColumn) => (c.kind === "fk" ? logical(c.fk!) : logical(`${REF_PREFIX}${c.ref}`));

function entity(name: string, label: string, plural: string, description: string): Json {
  return {
    "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
    SchemaName: logical(name),
    DisplayName: lbl(label),
    DisplayCollectionName: lbl(plural),
    Description: lbl(description),
    OwnershipType: "OrganizationOwned",
    IsActivity: false,
    HasActivities: false,
    HasNotes: false,
    ChangeTrackingEnabled: true,
    Attributes: [
      {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        SchemaName: PRIMARY,
        IsPrimaryName: true,
        AttributeType: "String",
        AttributeTypeName: { Value: "StringType" },
        MaxLength: 200,
        FormatName: { Value: "Text" },
        RequiredLevel: { Value: "ApplicationRequired", CanBeChanged: true, ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings" },
        DisplayName: lbl("Code"),
        Description: lbl("Business code, unique in the environment"),
      },
    ],
  };
}

export function masterPlan(defs: MasterDef[], opts: { lineage?: boolean; external?: string[] } = {}): EntityPlan[] {
  const plans: EntityPlan[] = topoOrder(defs, new Set(opts.external ?? [])).map((d) => ({
    logicalName: logical(d.name),
    entity: entity(d.name, d.label, d.plural, d.description),
    attributes: d.columns.filter((c) => c.kind !== "fk" && c.kind !== "ref").map((c) => attributeMetadata({ name: c.name.replace(/_/g, ""), label: c.label, kind: c.kind as Exclude<MasterColumn["kind"], "fk" | "ref">, maxLength: c.maxLength ?? 300, precision: c.precision }, c.label)),
    keys: [{ SchemaName: logical(`${d.name}_bk`), DisplayName: lbl("Business code"), KeyAttributes: [PRIMARY] }],
  }));
  if (opts.lineage !== false) plans.push(masterLineagePlan());
  return plans;
}

export function masterLineagePlan(): EntityPlan {
  return {
    logicalName: logical("masterlineage"),
    entity: entity("masterlineage", "Master lineage", "Master lineage", "Which workbook rows each master row replaced (written by the loader)."),
    attributes: [
      attributeMetadata({ name: "master", label: "Master", kind: "text", maxLength: 100 }),
      attributeMetadata({ name: "code", label: "Code", kind: "text", maxLength: 200 }),
      attributeMetadata({ name: "sourcetable", label: "Source table", kind: "text", maxLength: 100 }),
      attributeMetadata({ name: "sourcekey", label: "Source key", kind: "text", maxLength: 1000 }),
      attributeMetadata({ name: "role", label: "Role", kind: "text", maxLength: 20 }),
    ],
    keys: [{ SchemaName: logical("masterlineage_bk"), DisplayName: lbl("Business key"), KeyAttributes: [PRIMARY] }],
  };
}

/** One-to-many relationship payloads (lookup + delete restricted) for every reference column. */
export function masterRelationships(defs: MasterDef[], external: string[] = []): Array<{ schemaName: string; payload: Json }> {
  return topoOrder(defs, new Set(external)).flatMap((d) =>
    d.columns
      .filter((c) => c.kind === "fk" || c.kind === "ref")
      .map((c) => {
        const schemaName = logical(`${d.name}_${c.name}`);
        const target = lookupTarget(c);
        return {
          schemaName,
          payload: {
            "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
            SchemaName: schemaName,
            ReferencedEntity: target,
            ReferencedAttribute: `${target}id`,
            ReferencingEntity: logical(d.name),
            CascadeConfiguration: { Assign: "NoCascade", Delete: "Restrict", Merge: "NoCascade", Reparent: "NoCascade", Share: "NoCascade", Unshare: "NoCascade", RollupView: "NoCascade" },
            Lookup: {
              "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
              SchemaName: lookupName(c),
              DisplayName: lbl(c.label),
              Description: lbl(c.kind === "fk" ? `${c.label} (${c.fk})` : `${c.label} (reference ${c.ref}${c.scope ? ` / ${c.scope}` : ""})`),
              RequiredLevel: { Value: "None", CanBeChanged: true, ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings" },
            },
          },
        };
      }),
  );
}

const odataKey = (v: string) => `'${v.replace(/'/g, "''")}'`;

export interface MasterRecordSet {
  logicalName: string;
  /** Upserts keyed on sus_name, with every lookup except self-references. */
  records: Json[];
  /** Second pass: self-references (for example an asset's parent), once every row exists. */
  links: Json[];
}

/**
 * Upsert bodies for the built masters. `setName` maps a logical name to its entity set; `currencyId` is the
 * transaction currency bound to rows that carry money.
 */
export function masterRecords(masters: BuiltMaster[], vocab: Vocabulary, setName: (logicalName: string) => string, currencyId?: string): MasterRecordSet[] {
  const scoped = new Map(vocab.tables.map((t) => [t.name, isScoped(t)]));
  const bind = (c: MasterColumn, v: unknown) => {
    const key = c.kind === "ref" && scoped.get(c.ref!) ? `${c.scope}/${String(v)}` : String(v);
    return `/${setName(lookupTarget(c))}(${PRIMARY}=${odataKey(key)})`;
  };
  return masters.map(({ def, rows }) => {
    const money = def.columns.some((c) => c.kind === "money");
    if (money && !currencyId) throw new Error(`${def.name} holds money: a transaction currency is required`);
    const records: Json[] = [];
    const links: Json[] = [];
    for (const r of rows) {
      const rec: Json = { [PRIMARY]: r.code };
      const link: Json = { [PRIMARY]: r.code };
      for (const c of def.columns) {
        const v = r.values[c.name];
        if (c.kind === "fk" || c.kind === "ref") {
          if (v === null || v === undefined) continue;
          (c.kind === "fk" && c.fk === def.name ? link : rec)[`${lookupName(c)}@odata.bind`] = bind(c, v);
        } else if (c.kind === "datetime" && typeof v === "string") rec[logical(c.name.replace(/_/g, ""))] = v.endsWith("Z") ? v : `${v}Z`;
        else rec[logical(c.name.replace(/_/g, ""))] = v ?? null;
      }
      if (money) rec["transactioncurrencyid@odata.bind"] = `/transactioncurrencies(${currencyId})`;
      records.push(rec);
      if (Object.keys(link).length > 1) links.push(link);
    }
    return { logicalName: logical(def.name), records, links };
  });
}

export function masterLineageRecords(masters: BuiltMaster[]): Json[] {
  return masters.flatMap(({ def, rows }) =>
    rows.flatMap((r) =>
      r.lineage.map((l) => ({
        [PRIMARY]: `${def.name}:${r.code}:${createHash("sha1").update(`${l.table}\u0000${l.key}`).digest("hex").slice(0, 12)}`.slice(0, 200),
        [logical("master")]: def.name,
        [logical("code")]: r.code,
        [logical("sourcetable")]: l.table,
        [logical("sourcekey")]: l.key.slice(0, 1000),
        [logical("role")]: l.role,
      })),
    ),
  );
}
