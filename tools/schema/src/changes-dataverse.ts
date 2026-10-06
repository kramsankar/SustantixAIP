/**
 * Phase 4 on Dataverse: the change model expressed in Dataverse names, shared by the change-set plug-in
 * (sus_ApplyChangeSet, embedded in the signed assembly) and the Power Apps grid adapter. Every entity is a table keyed
 * on sus_name (its business code); references are lookups bound by that alternate key; a scoped vocabulary row is
 * named "scope/CODE" in Dataverse and addressed "scope:CODE" by change sets, as on Supabase.
 */
import { changeColumns, editableEntity, MAX_CHANGE_ITEMS, refEntities } from "./changes-sql.ts";
import { attributeMetadata, lbl, logical, type EntityPlan } from "./dataverse.ts";
import { columnKey, lookupName, lookupTarget } from "./master-dataverse.ts";
import { writers } from "./master-sql.ts";
import type { MasterDef } from "./masters.ts";
import { isScoped, REF_PREFIX, type Vocabulary } from "./reference.ts";

export const CHANGE_SET_API = "sus_ApplyChangeSet";
export const CHANGE_SET_TABLE = logical("changeset");

export interface DataverseChangeColumn {
  name: string;
  kind: string;
  attribute: string;
  /** Lookup target table (fk and ref columns). */
  target?: string;
  /** The target is a scoped vocabulary: its rows are named "scope/CODE". */
  scope?: string;
  editable: boolean;
}

export interface DataverseChangeEntity {
  name: string;
  label: string;
  layer: string;
  table: string;
  writers: string[];
  editable: boolean;
  scoped?: boolean;
  columns: DataverseChangeColumn[];
}

export function dataverseChangeModel(defs: MasterDef[], vocab: Vocabulary) {
  const entities: DataverseChangeEntity[] = defs.map((d) => {
    const byName = new Map(d.columns.map((c) => [c.name, c]));
    return {
      name: d.name,
      label: d.label,
      layer: d.layer,
      table: logical(d.name),
      writers: writers(d),
      editable: editableEntity(d),
      columns: changeColumns(d).map((c): DataverseChangeColumn => {
        const m = byName.get(c.name);
        if (c.name === "is_active") return { name: c.name, kind: "boolean", attribute: "statecode", editable: c.editable };
        // Money carries the environment's transaction currency in Dataverse; it is not set per change.
        if (c.name === "currency") return { name: c.name, kind: "text", attribute: "transactioncurrencyid", editable: false };
        if (m && (m.kind === "fk" || m.kind === "ref")) {
          return { name: c.name, kind: m.kind, attribute: lookupName(m), target: lookupTarget(m), ...(m.kind === "ref" && m.scope ? { scope: m.scope } : {}), editable: c.editable };
        }
        return { name: c.name, kind: c.kind, attribute: logical(columnKey(c.name)), editable: c.editable };
      }),
    };
  });
  const scopedRefs = new Set(vocab.tables.filter(isScoped).map((t) => t.name));
  for (const r of refEntities(vocab)) {
    entities.push({
      name: r.name,
      label: r.label,
      layer: "reference",
      table: logical(`${REF_PREFIX}${r.table}`),
      writers: ["admin"],
      editable: true,
      ...(r.scoped ? { scoped: true } : {}),
      columns: [
        { name: "label", kind: "text", attribute: logical("label"), editable: true },
        { name: "description", kind: "text", attribute: logical("description"), editable: true },
        { name: "sort_order", kind: "integer", attribute: logical("sortorder"), editable: true },
        { name: "is_active", kind: "boolean", attribute: logical("isactive"), editable: true },
      ],
    });
  }
  return {
    version: 1 as const,
    maxItems: MAX_CHANGE_ITEMS,
    api: CHANGE_SET_API,
    changeSetTable: CHANGE_SET_TABLE,
    key: logical("name"),
    entities,
    // Platform vocabulary changes only with a Sustantix release; tenant administrators add their own codes.
    platformCodes: Object.fromEntries(vocab.tables.map((t) => [`ref_${t.name}`, t.values.map((v) => (scopedRefs.has(t.name) ? `${v.scope}/${v.code}` : v.code))])),
  };
}

/** sus_changeset: every applied change set (id, source, item count and result), for idempotent replay. */
export function changeSetPlan(): EntityPlan {
  return {
    logicalName: CHANGE_SET_TABLE,
    entity: {
      "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
      SchemaName: CHANGE_SET_TABLE,
      DisplayName: lbl("Change set"),
      DisplayCollectionName: lbl("Change sets"),
      Description: lbl("A governed change applied through sus_ApplyChangeSet; a repeated id replays this result."),
      OwnershipType: "UserOwned",
      IsActivity: false,
      HasActivities: false,
      HasNotes: false,
      ChangeTrackingEnabled: true,
      Attributes: [{ "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata", SchemaName: logical("name"), IsPrimaryName: true, AttributeType: "String", AttributeTypeName: { Value: "StringType" }, MaxLength: 200, FormatName: { Value: "Text" }, RequiredLevel: { Value: "ApplicationRequired", CanBeChanged: true, ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings" }, DisplayName: lbl("Change set id"), Description: lbl("Change set id") }],
    },
    attributes: [
      attributeMetadata({ name: "source", label: "Source", kind: "text", maxLength: 20 }),
      attributeMetadata({ name: "itemcount", label: "Items", kind: "integer" }),
      attributeMetadata({ name: "result", label: "Result (JSON)", kind: "memo", maxLength: 1000000 }),
    ],
    keys: [{ SchemaName: logical("changeset_bk"), DisplayName: lbl("Change set id"), KeyAttributes: [logical("name")] }],
  };
}
