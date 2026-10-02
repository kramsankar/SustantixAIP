/**
 * Dataverse Web API metadata payloads for the AIP data model and platform tables.
 * Consumed by powerplatform/provision; every payload is created inside the SustantixAIP solution.
 */
import type { ColumnDef, Registry, TableDef } from "./registry.ts";

export const PREFIX = "sus";
export const LANG = 1033;

type Json = Record<string, unknown>;

export const lbl = (text: string): Json => ({
  "@odata.type": "Microsoft.Dynamics.CRM.Label",
  LocalizedLabels: [{ "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel", Label: text.slice(0, 250), LanguageCode: LANG }],
});

const required = (level: "None" | "ApplicationRequired") => ({
  Value: level,
  CanBeChanged: true,
  ManagedPropertyLogicalName: "canmodifyrequirementlevelsettings",
});

export const logical = (name: string) => `${PREFIX}_${name}`.toLowerCase();

export function attributeMetadata(c: Pick<ColumnDef, "name" | "label" | "kind" | "maxLength" | "precision">, description = ""): Json {
  const base = {
    SchemaName: logical(c.name),
    DisplayName: lbl(c.label),
    Description: lbl(description || c.label),
    RequiredLevel: required("None"),
  };
  switch (c.kind) {
    case "text":
      return { "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata", ...base, AttributeType: "String", AttributeTypeName: { Value: "StringType" }, MaxLength: Math.min(4000, c.maxLength ?? 200), FormatName: { Value: "Text" } };
    case "url":
      return { "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata", ...base, AttributeType: "String", AttributeTypeName: { Value: "StringType" }, MaxLength: 1000, FormatName: { Value: "Url" } };
    case "memo":
      return { "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata", ...base, AttributeType: "Memo", AttributeTypeName: { Value: "MemoType" }, Format: "TextArea", MaxLength: Math.min(1048576, c.maxLength ?? 100000) };
    case "integer":
      return { "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata", ...base, AttributeType: "Integer", AttributeTypeName: { Value: "IntegerType" }, Format: "None", MinValue: -2147483648, MaxValue: 2147483647 };
    case "bigint":
      return { "@odata.type": "Microsoft.Dynamics.CRM.BigIntAttributeMetadata", ...base, AttributeType: "BigInt", AttributeTypeName: { Value: "BigIntType" } };
    case "decimal":
      return { "@odata.type": "Microsoft.Dynamics.CRM.DecimalAttributeMetadata", ...base, AttributeType: "Decimal", AttributeTypeName: { Value: "DecimalType" }, Precision: Math.min(10, c.precision ?? 4), MinValue: -100000000000, MaxValue: 100000000000 };
    case "money":
      // PrecisionSource 0 = use Precision; native Money brings transaction currency + base conversion.
      return { "@odata.type": "Microsoft.Dynamics.CRM.MoneyAttributeMetadata", ...base, AttributeType: "Money", AttributeTypeName: { Value: "MoneyType" }, Precision: Math.min(4, c.precision ?? 2), PrecisionSource: 0, MinValue: -922337203685477, MaxValue: 922337203685477 };
    case "date":
      return { "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata", ...base, AttributeType: "DateTime", AttributeTypeName: { Value: "DateTimeType" }, Format: "DateOnly", DateTimeBehavior: { Value: "DateOnly" } };
    case "datetime":
      return { "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata", ...base, AttributeType: "DateTime", AttributeTypeName: { Value: "DateTimeType" }, Format: "DateAndTime", DateTimeBehavior: { Value: "TimeZoneIndependent" } };
    case "boolean":
      return {
        "@odata.type": "Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
        ...base,
        AttributeType: "Boolean",
        AttributeTypeName: { Value: "BooleanType" },
        DefaultValue: false,
        OptionSet: {
          "@odata.type": "Microsoft.Dynamics.CRM.BooleanOptionSetMetadata",
          TrueOption: { Value: 1, Label: lbl("Yes") },
          FalseOption: { Value: 0, Label: lbl("No") },
          OptionSetType: "Boolean",
        },
      };
  }
}

export interface EntityPlan {
  logicalName: string;
  entitySetName?: string;
  entity: Json;
  attributes: Json[];
  keys: Json[];
  source?: TableDef;
}

function primaryName(maxLength: number, label: string): Json {
  return {
    "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
    SchemaName: logical("name"),
    IsPrimaryName: true,
    AttributeType: "String",
    AttributeTypeName: { Value: "StringType" },
    MaxLength: maxLength,
    FormatName: { Value: "Text" },
    RequiredLevel: required("ApplicationRequired"),
    DisplayName: lbl(label),
    Description: lbl(label),
  };
}

function entityShell(name: string, label: string, plural: string, description: string, primaryLabel: string, primaryLength: number): Json {
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
    Attributes: [primaryName(primaryLength, primaryLabel)],
  };
}

const businessKey = (name: string): Json => ({
  SchemaName: logical(`${name}_bk`),
  DisplayName: lbl("Business key"),
  KeyAttributes: [logical("name")],
});

export function dataModelPlan(reg: Registry): EntityPlan[] {
  return reg.tables.map((t) => ({
    logicalName: logical(t.name),
    entity: entityShell(t.name, t.label, t.pluralLabel, `${t.domain} · workbook sheet "${t.sheet}"`, t.key.length ? t.key.join(" + ") : "Row key", 400),
    attributes: t.columns.map((c) => attributeMetadata(c, `Source column ${c.source}`)),
    keys: [businessKey(t.name)],
    source: t,
  }));
}

/** Platform tables required by the runtime and the license guard. */
export function platformPlan(): EntityPlan[] {
  const runtimeState = entityShell("runtimestate", "AIP Runtime State", "AIP Runtime States", "Workbook-import snapshot used by the AIP runtime (gzip JSON file).", "State name", 100);
  const licenseState = entityShell("licensestate", "AIP License State", "AIP License States", "License anti-rollback memory. Written only by the Sustantix license plug-in.", "License id", 100);
  return [
    {
      logicalName: logical("runtimestate"),
      entity: runtimeState,
      attributes: [
        {
          "@odata.type": "Microsoft.Dynamics.CRM.FileAttributeMetadata",
          SchemaName: logical("payload"),
          AttributeType: "Virtual",
          AttributeTypeName: { Value: "FileType" },
          MaxSizeInKB: 131072,
          DisplayName: lbl("Payload"),
          Description: lbl("gzip-compressed JSON snapshot"),
          RequiredLevel: required("None"),
        },
      ],
      keys: [businessKey("runtimestate")],
    },
    {
      logicalName: logical("licensestate"),
      entity: licenseState,
      attributes: [
        attributeMetadata({ name: "firstseen", label: "First seen (epoch s)", kind: "bigint" }),
        attributeMetadata({ name: "lastseen", label: "Last seen (epoch s)", kind: "bigint" }),
        attributeMetadata({ name: "verdict", label: "Last verdict", kind: "text", maxLength: 50 }),
      ],
      keys: [],
    },
  ];
}
