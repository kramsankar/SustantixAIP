/**
 * Phase 2 of the normalized model: master data and consolidated registers.
 *
 * Each master is one governed entity built from the (corrected) workbook sheets it replaces. Masters hold their
 * own attributes only: references to another master are foreign keys (by business code here, by id in the
 * database), controlled values are references into the phase-1 vocabulary, and attributes copied from a parent
 * (asset tag, class, plant name…) are dropped because views supply them. Duplicate registers (two part masters,
 * two intervention registers, two scenario tables) merge into one, and every master row records which sheet rows
 * it came from (lineage), so phase 3 can rebuild each sheet as a compatibility view.
 */
import { readFileSync } from "node:fs";
import type { IntegrityRule, IntegrityRules } from "./conformance.ts";
import { applyCorrections, dmyToIso, type CorrectionEntry, type CorrectionSet } from "./corrections.ts";
import { Resolver, type Binding, type Vocabulary } from "./reference.ts";
import type { ColumnDef, Registry, TableDef } from "./registry.ts";
import { coerce, rowKey, type SourceRow } from "./rows.ts";

export type MasterKind = "text" | "memo" | "url" | "integer" | "decimal" | "money" | "date" | "datetime" | "boolean";

export interface MasterColumn {
  name: string;
  label: string;
  kind: MasterKind | "ref" | "fk";
  /** ref: reference table (vocabulary name) and scope for scoped tables. */
  ref?: string;
  scope?: string;
  /** Values that mean "no value" for this column, in addition to the vocabulary's null tokens. */
  nullTokens?: string[];
  /** fk: the master this column points to (by business code). */
  fk?: string;
  /** fk: at most one row may point to the same parent (1:1 extensions). */
  unique?: boolean;
  maxLength?: number;
  precision?: number;
}

export type MasterLayer = "organisation" | "asset" | "supply" | "workforce" | "integration" | "sustainability" | "analytics" | "contract" | "register";

export interface Lineage {
  table: string;
  key: string;
  role: "primary" | "merged" | "extension" | "derived";
}

export interface MasterRow {
  code: string;
  values: Record<string, unknown>;
  lineage: Lineage[];
}

export interface MasterDef {
  name: string;
  label: string;
  plural: string;
  layer: MasterLayer;
  description: string;
  /** Workbook tables this master replaces (wholly or in part). */
  replaces: string[];
  /** Sheet key columns whose values are this master's business codes (used to retarget references). */
  owns: string[];
  columns: MasterColumn[];
  /** Columns dropped from the replaced sheets and why (shown in the phase 2 report). */
  dropped?: string;
  build(ctx: MasterContext): MasterRow[];
}

/** A built master: rows with references resolved to vocabulary codes, plus any problems found. */
export interface BuiltMaster {
  def: MasterDef;
  rows: MasterRow[];
}

export interface MasterIssue {
  master: string;
  code: string;
  column: string;
  value: string;
  problem: "duplicate code" | "unmapped reference" | "unresolved foreign key" | "duplicate 1:1 parent" | "invalid code";
}

export type Rec = Record<string, unknown> & { __key: string };

// ── Build context ───────────────────────────────────────────────────────────

export class MasterContext {
  private readonly cache = new Map<string, Rec[]>();
  constructor(
    readonly reg: Registry,
    readonly sheets: Record<string, SourceRow[]>,
  ) {}

  table(name: string): TableDef {
    const t = this.reg.tables.find((x) => x.name === name);
    if (!t) throw new Error(`unknown table ${name}`);
    return t;
  }

  /** Rows of a workbook table keyed by registry column name, typed by the registry, with their row key. */
  rows(name: string): Rec[] {
    const hit = this.cache.get(name);
    if (hit) return hit;
    const t = this.table(name);
    const out = (this.sheets[t.sheet] ?? []).map((r, i) => {
      const rec: Rec = { __key: rowKey(t, r, i) };
      for (const c of t.columns) rec[c.name] = coerce(c, r[c.source]);
      return rec;
    });
    this.cache.set(name, out);
    return out;
  }

  column(table: string, name: string): ColumnDef {
    const c = this.table(table).columns.find((x) => x.name === name);
    if (!c) throw new Error(`${table} has no column ${name}`);
    return c;
  }
}

// ── Value helpers ───────────────────────────────────────────────────────────

const str = (v: unknown): string | null => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

/** Business code for a free-text name: upper case, words joined by hyphens ("Hitachi Energy" → HITACHI-ENERGY). */
export function slug(v: string): string {
  return v
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Workbook date-times arrive as "2026-09-08 16:00" or "08-09-2026 16:00"; both become ISO "2026-09-08T16:00:00". */
export function isoDateTime(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const iso = /^\d{2}-\d{2}-\d{4}/.test(s) ? dmyToIso(s)! : s;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::(\d{2}))?)?/.exec(iso);
  if (!m) throw new Error(`not a date-time: ${s}`);
  return `${m[1]}T${m[2] ?? "00:00"}:${m[3] ?? "00"}`;
}

export function isoDate(v: unknown): string | null {
  const t = isoDateTime(v);
  return t ? t.slice(0, 10) : null;
}

const yes = (v: unknown): boolean | null => {
  const s = str(v);
  if (!s) return null;
  if (/^(yes|y|true|1|required)$/i.test(s)) return true;
  if (/^(no|n|false|0|not required)$/i.test(s)) return false;
  return null;
};

/** Copies the named columns (registry names) from a sheet record, renaming where `rename` says so. */
function take(r: Rec, cols: string[], rename: Record<string, string> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of cols) out[rename[c] ?? c] = r[c] ?? null;
  return out;
}

const one = (table: string, key: string, role: Lineage["role"] = "primary"): Lineage => ({ table, key, role });

// Column shorthands.
const col = (name: string, label: string, kind: MasterKind = "text", extra: Partial<MasterColumn> = {}): MasterColumn => ({ name, label, kind, ...extra });
const ref = (name: string, label: string, table: string, scope?: string, extra: Partial<MasterColumn> = {}): MasterColumn => ({ name, label, kind: "ref", ref: table, scope, ...extra });
const fk = (name: string, label: string, master: string, extra: Partial<MasterColumn> = {}): MasterColumn => ({ name, label, kind: "fk", fk: master, ...extra });

/** Master columns that mirror registry columns one to one (same name, kind and precision). */
function mirror(ctx: { table(n: string): TableDef }, table: string, names: string[]): MasterColumn[] {
  const t = ctx.table(table);
  return names.map((n) => {
    const c = t.columns.find((x) => x.name === n);
    if (!c) throw new Error(`${table} has no column ${n}`);
    return { name: c.name, label: c.label, kind: c.kind === "bigint" ? "integer" : c.kind, precision: c.precision, maxLength: c.kind === "text" ? Math.max(c.maxLength ?? 200, 300) : undefined };
  });
}

// ── Parties: every organisation named anywhere in the workbook ──────────────

export const PARTY_ROLES = ["OEM", "SUPPLIER", "SERVICE_PROVIDER", "OFFTAKER", "SOFTWARE_VENDOR"] as const;
type PartyRole = (typeof PARTY_ROLES)[number];

const PARTY_SOURCES: Array<{ table: string; column: string; role: PartyRole }> = [
  { table: "asset_master", column: "oem", role: "OEM" },
  { table: "pv_module_models", column: "manufacturer", role: "OEM" },
  { table: "warranty_register", column: "oem", role: "OEM" },
  { table: "bess_specifications", column: "cell_oem", role: "OEM" },
  { table: "bess_specifications", column: "pcs_oem", role: "OEM" },
  { table: "bess_controls_and_comms", column: "ems_vendor", role: "SOFTWARE_VENDOR" },
  { table: "bess_controls_and_comms", column: "bms_vendor", role: "SOFTWARE_VENDOR" },
  { table: "bess_warranty_and_maintenance", column: "warranty_provider", role: "SERVICE_PROVIDER" },
  { table: "bess_warranty_and_maintenance", column: "ltsa_provider", role: "SERVICE_PROVIDER" },
  { table: "msi_part_master", column: "preferred_supplier", role: "SUPPLIER" },
  { table: "spare_parts_master", column: "preferred_supplier", role: "SUPPLIER" },
  { table: "pno_material_cost_logistics", column: "preferred_supplier", role: "SUPPLIER" },
  { table: "pno_materials", column: "preferred_supplier", role: "SUPPLIER" },
  { table: "commercial_and_ppa", column: "offtaker", role: "OFFTAKER" },
  { table: "bess_commercial_and_dispatch", column: "offtaker", role: "OFFTAKER" },
];

/** Party code for a name, or null when the cell is empty. */
const partyCode = (v: unknown): string | null => {
  const s = str(v);
  return s ? slug(s) : null;
};

/** Equipment-model code: product models keep their ID; OEM catalogue models are qualified by manufacturer. */
const oemModelCode = (oem: unknown, model: unknown): string | null => {
  const o = str(oem);
  const m = str(model);
  return o && m ? slug(`${o} ${m}`) : null;
};

// ── Rate card: one row per priced component of every rate sheet ─────────────

interface RateSpec {
  table: string;
  prefix: string;
  subject: string;
  subjectType: string;
  /** Money columns → component code and pricing unit ("per"). */
  amounts: Record<string, { component: string; per: string }>;
  validFrom?: string;
  basis?: string;
  sourceUrl?: string;
}

const RATE_SPECS: RateSpec[] = [
  {
    table: "pno_crew_rates", prefix: "CREW", subject: "crew_id", subjectType: "crew", validFrom: "rate_effective_from", basis: "basis", sourceUrl: "source_url",
    amounts: {
      avg_tech_rate_hr: { component: "AVG_TECH_HOUR", per: "hour" },
      crew_labour_rate_hr: { component: "CREW_LABOUR_HOUR", per: "hour" },
      mobilization_fixed: { component: "MOBILIZATION", per: "event" },
      daily_allowance: { component: "DAILY_ALLOWANCE", per: "day" },
    },
  },
  {
    table: "pno_technician_skills", prefix: "TECH", subject: "technician_id", subjectType: "technician", basis: "basis", sourceUrl: "source_url",
    amounts: {
      regular_rate_hr: { component: "REGULAR_HOUR", per: "hour" },
      overtime_rate_hr: { component: "OVERTIME_HOUR", per: "hour" },
      holiday_rate_hr: { component: "HOLIDAY_HOUR", per: "hour" },
    },
  },
  {
    table: "pno_equipment_rates", prefix: "EQUIP", subject: "equipment_id", subjectType: "equipment", basis: "basis", sourceUrl: "source_url",
    amounts: { daily_rate: { component: "DAY", per: "day" }, hourly_rate: { component: "HOUR", per: "hour" }, mobilization: { component: "MOBILIZATION", per: "event" } },
  },
  {
    table: "pno_external_service_rates", prefix: "SERVICE", subject: "service_id", subjectType: "external_service",
    amounts: { day_rate: { component: "DAY", per: "day" }, weekly_rate: { component: "WEEK", per: "week" }, callout: { component: "CALLOUT", per: "event" }, travel_allowance_day: { component: "TRAVEL_ALLOWANCE", per: "day" } },
  },
  {
    table: "pno_vehicle_mobilization", prefix: "VEHICLE", subject: "vehicle_class_id", subjectType: "vehicle_class", basis: "source_basis",
    amounts: {
      variable_km: { component: "KM", per: "km" },
      daily_rate: { component: "DAY", per: "day" },
      driver_hr: { component: "DRIVER_HOUR", per: "hour" },
      mobilization_fixed: { component: "MOBILIZATION", per: "event" },
      overnight_driver_allowance: { component: "DRIVER_OVERNIGHT", per: "night" },
    },
  },
  {
    table: "pno_site_mobilization", prefix: "SITE", subject: "plant_id", subjectType: "site", basis: "governance_note",
    amounts: {
      vehicle_travel_cost: { component: "ROUND_TRIP", per: "trip" },
      lodging_person_night: { component: "LODGING", per: "person_night" },
      per_diem_person_day: { component: "PER_DIEM", per: "person_day" },
      local_transport_person_day: { component: "LOCAL_TRANSPORT", per: "person_day" },
    },
  },
  {
    table: "pno_material_cost_logistics", prefix: "PART", subject: "material_id", subjectType: "part", basis: "basis", sourceUrl: "source_url",
    amounts: {
      standard_freight: { component: "FREIGHT", per: "unit" },
      inter_site_transfer: { component: "TRANSFER", per: "unit" },
      emergency_expedite_premium: { component: "EXPEDITE", per: "unit" },
      receiving_handling: { component: "HANDLING", per: "unit" },
    },
  },
];

// ── The masters ─────────────────────────────────────────────────────────────

const TABLE_CTX = (reg: Registry) => ({ table: (n: string) => reg.tables.find((t) => t.name === n) ?? (() => { throw new Error(`unknown table ${n}`); })() });

export function masterDefs(reg: Registry): MasterDef[] {
  const tc = TABLE_CTX(reg);
  const bessExt = {
    bess_systems: ["bess_name", "configuration", "rated_power_mw", "contracted_energy_mwh", "nameplate_energy_mwh_bol", "duration_h", "usable_so_c_min_pct", "usable_so_c_max_pct", "commissioning_date", "design_life_years", "container_count", "pcs_count", "mv_transformer_count", "point_of_interconnection", "charging_source", "commercial_model"],
    bess_specifications: ["chemistry", "cell_format", "cell_nominal_voltage_v", "cell_capacity_ah", "cells_per_module", "modules_per_rack", "racks_per_container", "container_energy_mwh", "container_type", "rack_nominal_voltage_v", "dc_voltage_min_v", "dc_voltage_max_v", "pcs_unit_rating_mw", "pcs_nominal_efficiency_pct", "mv_transformer_mva", "mv_transformer_efficiency_pct", "battery_dc_rte_pct", "self_discharge_pct_per_day", "aux_base_k_w_per_container", "aux_hvac_k_w_per_container_per_10_c", "aux_throughput_coeff_pct", "thermal_management", "rated_c_rate"],
    bess_operating_limits: ["so_c_operating_min_pct", "so_c_operating_max_pct", "so_c_bms_hard_min_pct", "so_c_bms_hard_max_pct", "cell_temp_operating_min_c", "cell_temp_operating_max_c", "cell_temp_alarm_c", "cell_temp_trip_c", "cell_voltage_min_v", "cell_voltage_max_v", "max_charge_mw", "max_discharge_mw", "max_c_rate", "ramp_rate_pct_per_min", "max_cycles_per_day", "residual_tolerance_pct", "so_c_drift_tolerance_pct", "source_document"],
    bess_warranty_and_maintenance: ["visual_inspection_interval_days", "thermography_interval_days", "coolant_hvac_service_interval_days", "capacity_test_interval_days", "fire_system_inspection_interval_days", "last_visual_inspection", "last_thermography", "last_hvac_service", "ltsa_availability_guarantee_pct"],
    bess_safety_and_compliance: ["applicable_regulation", "system_voltage_class", "containers_with_auto_suppression", "suppression_agent", "gas_smoke_heat_flame_detection", "explosion_venting_deflagration_panels", "forced_ventilation_auto_louvers", "two_fault_tolerance_design_review", "last_third_party_fire_audit", "fire_audit_due_by", "perimeter_fence_m", "cctv_motion_detection", "emergency_stop_auto_and_manual", "fire_brigade_noc", "evidence_document_id"],
    bess_controls_and_comms: ["ems_id", "ppc_id", "scada_protocol", "bms_to_ems_protocol", "telemetry_resolution_s", "historian_aggregation", "tag_prefix", "tag_map", "integration_status"],
  } as Record<string, string[]>;

  return [
    // Organisation
    {
      name: "site", label: "Site", plural: "Sites", layer: "organisation",
      description: "A generating plant: its location, grid connection and design capacity.",
      replaces: ["sites"], owns: ["sites.plant_id"],
      dropped: "pr_pct, availability_pct and health_score are measurements (phase 3 projections); has_bess and bess_id derive from the BESS extension.",
      columns: [
        col("name", "Name"), ref("region", "Region (state)", "region"), col("timezone", "Time zone"),
        ...mirror(tc, "sites", ["capacity_mw", "inverter_count", "tracker_rows", "string_count", "commission_year", "grid_connection_k_v", "grid_connection_type", "export_limit_mw", "import_limit_mw"]),
      ],
      build: (ctx) => ctx.rows("sites").map((r) => ({
        code: String(r.plant_id),
        values: { name: r.plant_name, region: r.state, timezone: r.timezone, ...take(r, ["capacity_mw", "inverter_count", "tracker_rows", "string_count", "commission_year", "grid_connection_k_v", "grid_connection_type", "export_limit_mw", "import_limit_mw"]) },
        lineage: [one("sites", r.__key)],
      })),
    },
    {
      name: "party", label: "Party", plural: "Parties", layer: "organisation",
      description: "An organisation the business deals with: manufacturer, supplier, service provider, offtaker or software vendor. Names in the workbook are free text; one party per distinct name.",
      replaces: [], owns: [],
      columns: [col("name", "Name")],
      build: (ctx) => {
        const byCode = new Map<string, MasterRow>();
        for (const s of PARTY_SOURCES) for (const r of ctx.rows(s.table)) {
          const code = partyCode(r[s.column]);
          if (!code) continue;
          const row = byCode.get(code) ?? byCode.set(code, { code, values: { name: str(r[s.column]) }, lineage: [] }).get(code)!;
          if (!row.lineage.some((l) => l.table === s.table && l.key === s.column)) row.lineage.push({ table: s.table, key: s.column, role: "derived" });
        }
        return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
      },
    },
    {
      name: "party_role", label: "Party role", plural: "Party roles", layer: "organisation",
      description: "The roles a party plays (OEM, supplier, service provider, offtaker, software vendor).",
      replaces: [], owns: [],
      columns: [fk("party", "Party", "party"), col("role", "Role")],
      build: (ctx) => {
        const out = new Map<string, MasterRow>();
        for (const s of PARTY_SOURCES) for (const r of ctx.rows(s.table)) {
          const p = partyCode(r[s.column]);
          if (!p) continue;
          const code = `${p}:${s.role}`;
          if (!out.has(code)) out.set(code, { code, values: { party: p, role: s.role }, lineage: [{ table: s.table, key: s.column, role: "derived" }] });
        }
        return [...out.values()].sort((a, b) => a.code.localeCompare(b.code));
      },
    },

    // Assets
    {
      name: "equipment_model", label: "Equipment model", plural: "Equipment models", layer: "asset",
      description: "A manufacturer's product model. Ends the model_id collision: product models live here, forecasting models in ml_model.",
      replaces: ["pv_module_models"], owns: ["pv_module_models.model_id"],
      columns: [
        col("name", "Name"), fk("manufacturer", "Manufacturer", "party"), ref("asset_class", "Asset class", "asset_class"), col("technology", "Technology"),
        col("rated_power_w", "Rated power (W)", "decimal", { precision: 2 }),
        ...mirror(tc, "pv_module_models", ["efficiency_pct", "temperature_coefficient_pmax_pct_c", "product_warranty_years", "performance_warranty_years", "planning_service_life_years", "document_reference"]),
      ],
      build: (ctx) => {
        const out: MasterRow[] = ctx.rows("pv_module_models").map((r) => ({
          code: String(r.model_id),
          values: { name: r.model_name, manufacturer: partyCode(r.manufacturer), asset_class: "PV_MODULE", technology: r.technology, rated_power_w: r.rated_wp, ...take(r, ["efficiency_pct", "temperature_coefficient_pmax_pct_c", "product_warranty_years", "performance_warranty_years", "planning_service_life_years", "document_reference"]) },
          lineage: [one("pv_module_models", r.__key)],
        }));
        const seen = new Map<string, MasterRow>();
        for (const r of ctx.rows("asset_master")) {
          const code = oemModelCode(r.oem, r.model);
          if (!code || out.some((x) => x.code === code)) continue;
          const hit = seen.get(code);
          if (hit) {
            if (hit.values.asset_class !== r.asset_class) hit.values.asset_class = null; // a model used across classes keeps no class
            continue;
          }
          seen.set(code, { code, values: { name: `${str(r.oem)} ${str(r.model)}`, manufacturer: partyCode(r.oem), asset_class: r.asset_class }, lineage: [{ table: "asset_master", key: "oem + model", role: "derived" }] });
        }
        return [...out, ...[...seen.values()].sort((a, b) => a.code.localeCompare(b.code))];
      },
    },
    {
      name: "asset", label: "Asset", plural: "Assets", layer: "asset",
      description: "Every physical thing in one hierarchy (site → asset → component). Class-specific attributes live in 1:1 extensions.",
      replaces: ["asset_master"], owns: ["asset_master.asset_id"],
      dropped: "plant name and other site attributes come from the site; bess_id becomes the BESS extension; group_id becomes the PV module group's asset link.",
      columns: [
        fk("site", "Site", "site"), fk("parent", "Parent asset", "asset"), col("tag", "Tag"), col("name", "Description", "text", { maxLength: 1000 }),
        ref("asset_class", "Asset class", "asset_class"), fk("equipment_model", "Equipment model", "equipment_model"), fk("manufacturer", "Manufacturer", "party"),
        ref("operating_status", "Operating status", "status", "asset_operating"),
        col("install_year", "Install year", "integer"), col("rated_capacity_mw", "Rated capacity (MW)", "decimal", { precision: 4 }),
        col("module_quantity", "Module quantity", "integer"), col("granularity", "Granularity"), col("cost_centre", "Cost centre"),
        col("health_score", "Health score", "decimal", { precision: 2 }), ref("risk_band", "Risk band", "risk_band"), col("last_maintenance_date", "Last maintenance", "date"),
        col("capacity_basis", "Capacity basis", "text", { maxLength: 1000 }), col("data_basis", "Data basis", "text", { maxLength: 1000 }), col("evidence_reference", "Evidence reference", "text", { maxLength: 1000 }),
        col("source_record", "Source record", "text", { maxLength: 1000 }),
      ],
      build: (ctx) => ctx.rows("asset_master").map((r) => ({
        code: String(r.asset_id),
        values: {
          site: r.plant_id, parent: str(r.parent_asset_id), tag: r.asset_tag, name: r.description, asset_class: r.asset_class,
          equipment_model: str(r.model_id) ?? oemModelCode(r.oem, r.model), manufacturer: partyCode(r.oem),
          operating_status: r.operating_status ?? r.status, install_year: r.install_year, rated_capacity_mw: r.rated_capacity_mw,
          module_quantity: r.module_quantity, granularity: r.asset_granularity, cost_centre: r.cost_centre, health_score: r.health_score, risk_band: r.risk_band,
          last_maintenance_date: r.last_maintenance_date, capacity_basis: r.capacity_basis, data_basis: r.data_basis, evidence_reference: r.evidence_reference, source_record: r.source,
        },
        lineage: [one("asset_master", r.__key)],
      })),
    },
    {
      name: "asset_inverter", label: "Inverter configuration", plural: "Inverter configurations", layer: "asset",
      description: "Inverter design data, one row per inverter asset.",
      replaces: ["inverter_configuration"], owns: [],
      dropped: "plant_id and inverter_tag are the asset's own site and tag.",
      columns: [
        fk("asset", "Asset", "asset", { unique: true }), fk("tracker", "Tracker asset", "asset"),
        ...mirror(tc, "inverter_configuration", ["block_id", "ac_rating_mw", "dc_capacity_mwp", "dc_ac_ratio", "strings", "modules_per_string", "module_wp", "mppt_count", "scb_count", "nominal_efficiency_pct", "dc_voltage_nominal_v", "data_provenance"]),
      ],
      build: (ctx) => ctx.rows("inverter_configuration").map((r) => ({
        code: String(r.asset_id),
        values: { asset: r.asset_id, tracker: str(r.tracker_asset_id), ...take(r, ["block_id", "ac_rating_mw", "dc_capacity_mwp", "dc_ac_ratio", "strings", "modules_per_string", "module_wp", "mppt_count", "scb_count", "nominal_efficiency_pct", "dc_voltage_nominal_v", "data_provenance"]) },
        lineage: [one("inverter_configuration", r.__key, "extension")],
      })),
    },
    {
      name: "asset_bess", label: "BESS configuration", plural: "BESS configurations", layer: "asset",
      description: "One battery storage system: design, specification, operating limits, maintenance intervals, safety and controls, formerly six 1:1 sheets.",
      replaces: ["bess_systems", "bess_specifications", "bess_operating_limits", "bess_safety_and_compliance", "bess_controls_and_comms", "bess_warranty_and_maintenance"],
      owns: ["bess_systems.bess_id"],
      dropped: "Warranty terms move to warranty_contract and the dispatch contract to offtake_contract; plant_id and operating status are the asset's.",
      columns: [
        fk("asset", "Asset", "asset", { unique: true }), fk("cell_manufacturer", "Cell OEM", "party"), fk("pcs_manufacturer", "PCS OEM", "party"),
        fk("ems_vendor", "EMS vendor", "party"), fk("bms_vendor", "BMS vendor", "party"), fk("ltsa_provider", "LTSA provider", "party"),
        ...Object.entries(bessExt).flatMap(([t, cols]) => mirror(tc, t, cols)),
        col("data_provenance", "Data provenance", "text", { maxLength: 1000 }),
      ],
      build: (ctx) => ctx.rows("bess_systems").map((s) => {
        const id = String(s.bess_id);
        const pick = (t: string) => ctx.rows(t).find((x) => x.bess_id === id);
        const values: Record<string, unknown> = { asset: s.asset_id };
        const lineage: Lineage[] = [one("bess_systems", s.__key)];
        for (const [t, cols] of Object.entries(bessExt)) {
          const r = t === "bess_systems" ? s : pick(t);
          if (!r) continue;
          Object.assign(values, take(r, cols));
          if (t !== "bess_systems") lineage.push(one(t, r.__key, "merged"));
        }
        const spec = pick("bess_specifications");
        const ctl = pick("bess_controls_and_comms");
        const wm = pick("bess_warranty_and_maintenance");
        Object.assign(values, {
          cell_manufacturer: partyCode(spec?.cell_oem), pcs_manufacturer: partyCode(spec?.pcs_oem), ems_vendor: partyCode(ctl?.ems_vendor), bms_vendor: partyCode(ctl?.bms_vendor),
          ltsa_provider: partyCode(wm?.ltsa_provider), data_provenance: s.data_provenance,
        });
        return { code: id, values, lineage };
      }),
    },
    {
      name: "pv_array", label: "PV array", plural: "PV arrays", layer: "asset",
      description: "A PV array tracked for sustainability (module counts for end-of-life planning), linked to its asset.",
      replaces: ["sus_pv_array_master"], owns: ["sus_pv_array_master.pv_array_id"],
      columns: [fk("asset", "Asset", "asset"), col("name", "Name"), ...mirror(tc, "sus_pv_array_master", ["module_quantity", "commission_year", "data_status"])],
      build: (ctx) => ctx.rows("sus_pv_array_master").map((r) => ({
        code: String(r.pv_array_id), values: { asset: r.asset_id, name: r.array_name, ...take(r, ["module_quantity", "commission_year", "data_status"]) }, lineage: [one("sus_pv_array_master", r.__key)],
      })),
    },
    {
      name: "pv_module_group", label: "PV module group", plural: "PV module groups", layer: "asset",
      description: "A block of PV modules installed together, linked to the PV array asset that holds it.",
      replaces: ["pv_module_groups"], owns: ["pv_module_groups.group_id"],
      dropped: "asset_tag and plant_id are the asset's.",
      columns: [fk("asset", "Asset", "asset"), col("name", "Name"), ...mirror(tc, "pv_module_groups", ["block", "status", "data_basis", "reported_quantity", "commission_year", "notes"])],
      build: (ctx) => ctx.rows("pv_module_groups").map((r) => ({
        code: String(r.group_id), values: { asset: r.asset_id, name: r.group_name, ...take(r, ["block", "status", "data_basis", "reported_quantity", "commission_year", "notes"]) }, lineage: [one("pv_module_groups", r.__key)],
      })),
    },
    {
      name: "pv_population_segment", label: "PV population segment", plural: "PV population segments", layer: "asset",
      description: "Modules of one model and batch within a group, with their opening balance.",
      replaces: ["pv_population_segments"], owns: ["pv_population_segments.segment_id"],
      columns: [fk("module_group", "Module group", "pv_module_group"), fk("equipment_model", "Module model", "equipment_model"), ...mirror(tc, "pv_population_segments", ["batch_id", "installation_date", "balance_as_of", "opening_quantity", "evidence_reference"])],
      build: (ctx) => ctx.rows("pv_population_segments").map((r) => ({
        code: String(r.segment_id), values: { module_group: r.group_id, equipment_model: r.model_id, ...take(r, ["batch_id", "installation_date", "balance_as_of", "opening_quantity", "evidence_reference"]) }, lineage: [one("pv_population_segments", r.__key)],
      })),
    },
    {
      name: "pv_module", label: "PV module", plural: "PV modules", layer: "asset",
      description: "A serialised PV module in its population segment.",
      replaces: ["pv_module_register"], owns: ["pv_module_register.module_id"],
      columns: [fk("segment", "Population segment", "pv_population_segment"), ...mirror(tc, "pv_module_register", ["serial_number", "position", "installed_date", "removed_date", "removal_status", "evidence_reference"])],
      build: (ctx) => ctx.rows("pv_module_register").map((r) => ({
        code: String(r.module_id), values: { segment: r.segment_id, ...take(r, ["serial_number", "position", "installed_date", "removed_date", "removal_status", "evidence_reference"]) }, lineage: [one("pv_module_register", r.__key)],
      })),
    },

    // Supply
    {
      name: "part", label: "Part", plural: "Parts", layer: "supply",
      description: "One part master: the maintenance-spares master, the second spare-parts list and the planning materials (after C11/C12) merge on part code.",
      replaces: ["msi_part_master", "spare_parts_master"], owns: ["msi_part_master.part_id", "spare_parts_master.part_id", "pno_material_cost_logistics.material_id"],
      dropped: "on_hand_qty without a site is a portfolio total; stock is held per site in part_stock. Logistics costs move to the rate card.",
      columns: [
        col("name", "Name"), col("category", "Category"), ref("criticality", "Criticality", "severity"), fk("preferred_supplier", "Preferred supplier", "party"),
        col("unit_cost", "Unit cost", "money", { precision: 4 }), col("lead_time_days", "Lead time (days)", "integer"), col("reorder_point", "Reorder point", "integer"), col("max_level", "Max level", "integer"),
        col("storage_location", "Storage location"), col("replenishment_mode", "Replenishment mode"), col("shelf_life_control", "Shelf-life control"),
        fk("compatible_model", "Compatible model", "equipment_model"), col("compatibility_notes", "Compatibility notes", "text", { maxLength: 1000 }), col("source_record", "Source record", "text", { maxLength: 1000 }),
      ],
      build: (ctx) => {
        const out = new Map<string, MasterRow>();
        const fields = (r: Rec) => ({
          name: r.part_name, category: r.category, criticality: r.criticality, preferred_supplier: partyCode(r.preferred_supplier), unit_cost: r.unit_cost, lead_time_days: r.lead_time_days,
          reorder_point: r.reorder_point, max_level: r.max_level, storage_location: r.storage_location, replenishment_mode: r.replenishment_mode, shelf_life_control: r.shelf_life_control,
          compatible_model: str(r.compatible_model_id), compatibility_notes: str(r.compatibility_notes), source_record: r.source,
        });
        for (const t of ["msi_part_master", "spare_parts_master"]) for (const r of ctx.rows(t)) {
          const code = String(r.part_id);
          const hit = out.get(code);
          if (!hit) { out.set(code, { code, values: fields(r), lineage: [one(t, r.__key)] }); continue; }
          // The first master wins; the second fills only what the first leaves empty.
          for (const [k, v] of Object.entries(fields(r))) if ((hit.values[k] === null || hit.values[k] === undefined) && v !== null && v !== undefined) hit.values[k] = v;
          hit.lineage.push(one(t, r.__key, "merged"));
        }
        for (const r of ctx.rows("pno_material_cost_logistics")) {
          const hit = out.get(String(r.material_id));
          if (!hit) throw new Error(`planning material ${String(r.material_id)} has no part (corrections C11/C12)`);
          hit.lineage.push(one("pno_material_cost_logistics", r.__key, "merged"));
        }
        return [...out.values()];
      },
    },
    {
      name: "part_stock", label: "Part stock", plural: "Part stock", layer: "supply",
      description: "Stock of one part at one site: the ERP/WMS snapshot with its reorder policy, plus the 30-day movement balance where the inventory ledger has one.",
      replaces: ["inventory_balance"], owns: [],
      dropped: "part_description and unit_cost are the part's; demand and need-by dates are requirements (phase 3).",
      columns: [
        fk("part", "Part", "part"), fk("site", "Site", "site"),
        ...mirror(tc, "msi_erp_spares", ["on_hand_qty", "reserved_qty", "quality_hold_qty", "in_transit_qty", "available_qty", "reorder_point_qty", "safety_stock_qty", "lead_time_days", "supplier_status", "erp_source", "source_record_id"]),
        col("snapshot_at", "Snapshot at", "datetime"),
        ...mirror(tc, "inventory_balance", ["opening_qty", "receipts_30_d", "issues_30_d", "closing_qty", "avg_daily_consumption", "days_of_inventory", "as_of_date"]),
        ref("stock_status", "Stock status", "status", "stock"),
      ],
      build: (ctx) => {
        const out = new Map<string, MasterRow>();
        for (const r of ctx.rows("msi_erp_spares")) {
          const code = `${String(r.part_id)}@${String(r.plant_id)}`;
          if (out.has(code)) throw new Error(`part_stock ${code} appears twice in the ERP extract`);
          out.set(code, {
            code,
            values: { part: r.part_id, site: r.plant_id, ...take(r, ["on_hand_qty", "reserved_qty", "quality_hold_qty", "in_transit_qty", "available_qty", "reorder_point_qty", "safety_stock_qty", "lead_time_days", "supplier_status", "erp_source", "source_record_id"]), snapshot_at: isoDateTime(r.last_updated) },
            lineage: [one("msi_erp_spares", r.__key)],
          });
        }
        for (const r of ctx.rows("inventory_balance")) {
          const code = `${String(r.part_id)}@${String(r.plant_id)}`;
          const hit = out.get(code) ?? out.set(code, { code, values: { part: r.part_id, site: r.plant_id }, lineage: [] }).get(code)!;
          Object.assign(hit.values, take(r, ["opening_qty", "receipts_30_d", "issues_30_d", "closing_qty", "avg_daily_consumption", "days_of_inventory", "as_of_date"]), { stock_status: r.stock_status });
          if (hit.values.reserved_qty === undefined || hit.values.reserved_qty === null) hit.values.reserved_qty = r.reserved_qty;
          hit.lineage.push(one("inventory_balance", r.__key, hit.lineage.length ? "merged" : "primary"));
        }
        return [...out.values()].sort((a, b) => a.code.localeCompare(b.code));
      },
    },
    {
      name: "rate_card", label: "Rate", plural: "Rate card", layer: "supply",
      description: "Every priced component (labour, equipment, vehicles, services, site mobilisation, part logistics) and every modelled rate or factor, one row each, with unit, currency and validity.",
      replaces: ["cost_and_rate_master", "pno_crew_rates", "pno_equipment_rates", "pno_external_service_rates", "pno_vehicle_mobilization", "pno_site_mobilization", "ve_rate_config"],
      owns: ["ve_rate_config.rate_id", "cost_and_rate_master.rate_key"],
      columns: [
        col("rate_type", "Rate type"), col("subject_type", "Applies to (type)"), col("subject", "Applies to"), col("component", "Component"),
        col("amount", "Amount", "money", { precision: 4 }), col("per", "Per"), col("value", "Value", "decimal", { precision: 6 }), ref("unit", "Unit", "unit"),
        col("valid_from", "Valid from", "date"), col("valid_to", "Valid to", "date"), col("previous_value", "Previous value", "decimal", { precision: 6 }),
        col("basis", "Basis", "text", { maxLength: 1000 }), ref("source_system", "Source system", "source_system"), col("source_object", "Source object", "text", { maxLength: 1000 }), col("source_url", "Source", "url"),
      ],
      build: (ctx) => {
        const out: MasterRow[] = [];
        for (const s of RATE_SPECS) for (const r of ctx.rows(s.table)) {
          for (const [column, a] of Object.entries(s.amounts)) {
            if (r[column] === null || r[column] === undefined) continue;
            out.push({
              code: `${s.prefix}-${String(r[s.subject])}-${a.component}`,
              values: {
                rate_type: s.prefix.toLowerCase(), subject_type: s.subjectType, subject: r[s.subject], component: a.component, amount: r[column], per: a.per,
                valid_from: s.validFrom ? r[s.validFrom] : null, basis: s.basis ? r[s.basis] : null, source_url: s.sourceUrl ? r[s.sourceUrl] : null,
              },
              lineage: [one(s.table, `${r.__key} · ${column}`)],
            });
          }
        }
        for (const r of ctx.rows("cost_and_rate_master")) out.push({
          code: `MODEL-${slug(String(r.rate_key))}`,
          values: { rate_type: "decision_cost", subject_type: "decision_category", subject: r.decision_category, component: r.cost_component, value: r.rate_or_fixed_value, unit: r.unit, basis: [r.basis, r.applies_to, r.governance_note].filter(Boolean).join(" · ") },
          lineage: [one("cost_and_rate_master", r.__key)],
        });
        for (const r of ctx.rows("ve_rate_config")) out.push({
          code: String(r.rate_id),
          values: {
            rate_type: slug(String(r.rate_type)).toLowerCase().replace(/-/g, "_"), subject_type: "value_exposure", subject: r.applies_to, component: r.usage, value: r.rate_or_value, unit: r.unit,
            valid_from: isoDate(r.effective_from), valid_to: isoDate(r.effective_to), previous_value: r.previous_value, basis: [r.authority_type, r.freshness_status].filter(Boolean).join(" · "),
            source_system: r.source_system, source_object: r.source_object,
          },
          lineage: [one("ve_rate_config", r.__key)],
        });
        return out;
      },
    },

    // Workforce
    {
      name: "crew", label: "Crew", plural: "Crews", layer: "workforce",
      description: "A maintenance crew and its working-time rules; its rates are on the rate card.",
      replaces: ["pno_crew_rates"], owns: ["pno_crew_rates.crew_id"],
      columns: mirror(tc, "pno_crew_rates", ["crew_size", "standard_hours_day", "ot_multiplier", "holiday_multiplier", "night_shift_multiplier", "weekly_hours_cap", "ot_approval_required", "holiday_work_approval", "rate_effective_from"]),
      build: (ctx) => ctx.rows("pno_crew_rates").map((r) => ({
        code: String(r.crew_id), values: take(r, ["crew_size", "standard_hours_day", "ot_multiplier", "holiday_multiplier", "night_shift_multiplier", "weekly_hours_cap", "ot_approval_required", "holiday_work_approval", "rate_effective_from"]), lineage: [one("pno_crew_rates", r.__key)],
      })),
    },
    {
      name: "technician", label: "Technician", plural: "Technicians", layer: "workforce",
      description: "A technician: crew, home site, skill and working-time rules; pay rates are on the rate card.",
      replaces: ["pno_technician_skills"], owns: ["pno_technician_skills.technician_id"],
      columns: [
        col("name", "Name"), fk("crew", "Crew", "crew"), fk("home_site", "Home site", "site"), col("role", "Role"), ref("primary_skill", "Primary skill", "skill"),
        ...mirror(tc, "pno_technician_skills", ["skill_level", "certification_or_control", "valid_to", "standard_hours_day", "productivity_factor", "default_shift", "work_days", "ot_eligible", "max_ot_hours_day", "max_ot_hours_week", "holiday_work_eligible", "travel_eligible", "availability_status"]),
      ],
      build: (ctx) => ctx.rows("pno_technician_skills").map((r) => ({
        code: String(r.technician_id),
        values: { name: r.technician_name, crew: r.crew_id, home_site: r.home_site, role: r.role, primary_skill: r.primary_skill, ...take(r, ["skill_level", "certification_or_control", "valid_to", "standard_hours_day", "productivity_factor", "default_shift", "work_days", "ot_eligible", "max_ot_hours_day", "max_ot_hours_week", "holiday_work_eligible", "travel_eligible", "availability_status"]) },
        lineage: [one("pno_technician_skills", r.__key)],
      })),
    },
    {
      name: "resource", label: "Planning resource", plural: "Planning resources", layer: "workforce",
      description: "A schedulable resource (technician, tool or vehicle) as the planner sees it.",
      replaces: ["pno_resources"], owns: ["pno_resources.resource_id"],
      columns: [col("resource_type", "Resource type"), col("name", "Name"), fk("crew", "Crew", "crew"), col("home", "Home site or region"), ...mirror(tc, "pno_resources", ["primary_skill_or_type", "skill_level", "certification_or_control", "valid_to", "availability", "capacity_or_payload", "fuel_type", "ghg_boundary"])],
      build: (ctx) => ctx.rows("pno_resources").map((r) => ({
        code: String(r.resource_id),
        values: { resource_type: r.resource_type, name: r.resource_name, crew: str(r.crew_id) === "N/A" ? null : str(r.crew_id), home: r.region_or_home_site, ...take(r, ["primary_skill_or_type", "skill_level", "certification_or_control", "valid_to", "availability", "capacity_or_payload", "fuel_type", "ghg_boundary"]) },
        lineage: [one("pno_resources", r.__key)],
      })),
    },
    {
      name: "vehicle", label: "Vehicle", plural: "Vehicles", layer: "workforce",
      description: "A fleet vehicle and its home site (or the regional pool).",
      replaces: ["plan_vehicle_master"], owns: ["plan_vehicle_master.vehicle_id"],
      columns: [fk("home_site", "Home site", "site"), col("home_pool", "Home pool"), ...mirror(tc, "plan_vehicle_master", ["vehicle_type", "fuel_type", "payload_kg", "availability", "maintenance_status", "odometer_km", "ghg_boundary_status", "vehicle_use", "fuel_efficiency_km_per_l", "last_service_date", "next_service_due_km"])],
      build: (ctx) => ctx.rows("plan_vehicle_master").map((r) => {
        const home = String(r.home_plant_id ?? "");
        const isSite = /^SP-\d+$/.test(home);
        return { code: String(r.vehicle_id), values: { home_site: isSite ? home : null, home_pool: isSite ? null : str(home), ...take(r, ["vehicle_type", "fuel_type", "payload_kg", "availability", "maintenance_status", "odometer_km", "ghg_boundary_status", "vehicle_use", "fuel_efficiency_km_per_l", "last_service_date", "next_service_due_km"]) }, lineage: [one("plan_vehicle_master", r.__key)] };
      }),
    },
    {
      name: "tool", label: "Tool", plural: "Tools", layer: "workforce",
      description: "A specialist tool with its calibration state.",
      replaces: ["plan_tool_master"], owns: ["plan_tool_master.tool_id"],
      columns: [col("name", "Name"), ...mirror(tc, "plan_tool_master", ["tool_type", "home_region", "calibration_status", "calibration_expiry", "availability", "applicable_asset_class", "control_requirement", "safety_category", "storage_location"])],
      build: (ctx) => ctx.rows("plan_tool_master").map((r) => ({
        code: String(r.tool_id), values: { name: r.tool_name, ...take(r, ["tool_type", "home_region", "calibration_status", "calibration_expiry", "availability", "applicable_asset_class", "control_requirement", "safety_category", "storage_location"]) }, lineage: [one("plan_tool_master", r.__key)],
      })),
    },

    // Integration
    {
      name: "system", label: "System", plural: "Systems", layer: "integration",
      description: "An enterprise system in the landscape (EAM, WFM, fleet, SCADA…).",
      replaces: ["plan_system_landscape"], owns: ["plan_system_landscape.system_id"],
      columns: [col("name", "Name"), ...mirror(tc, "plan_system_landscape", ["system_type", "connection_method", "environment"]), ref("status", "Configuration status", "status", "connector")],
      build: (ctx) => ctx.rows("plan_system_landscape").map((r) => ({
        code: String(r.system_id), values: { name: r.system_name, ...take(r, ["system_type", "connection_method", "environment"]), status: r.configuration_status }, lineage: [one("plan_system_landscape", r.__key)],
      })),
    },
    {
      name: "connector", label: "Connector", plural: "Connectors", layer: "integration",
      description: "A data feed into AIP, registered once (formerly the technology registry and the sustainability connector registry).",
      replaces: ["technology_integration_registry", "sus_connector_registry"], owns: ["technology_integration_registry.connector_id", "sus_connector_registry.connector_id"],
      columns: [col("domain", "Domain"), ref("source_system", "Source system", "source_system"), col("source_name", "Source"), col("connector_type", "Type"), col("content", "Objects or content", "text", { maxLength: 1000 }), col("target", "AIP target"), col("pattern", "Integration pattern"), col("status", "Status"), col("cadence", "Freshness or cadence"), col("authority", "Source authority"), col("control", "Credential or control"), col("lineage_key", "Lineage key")],
      build: (ctx) => [
        ...ctx.rows("technology_integration_registry").map((r) => ({
          code: String(r.connector_id),
          values: { domain: r.domain, source_system: r.source_system, connector_type: r.source_type, content: r.objects_or_content, target: r.aip_target, pattern: r.integration_pattern, status: r.status, cadence: r.freshness_or_cadence, authority: r.source_authority, control: r.credential_or_control, lineage_key: r.lineage_key },
          lineage: [one("technology_integration_registry", r.__key)],
        })),
        ...ctx.rows("sus_connector_registry").map((r) => ({
          code: String(r.connector_id),
          values: { domain: r.data_domain, source_name: r.source, connector_type: r.connector_type, content: r.data_content, status: r.status, cadence: r.refresh_frequency },
          lineage: [one("sus_connector_registry", r.__key)],
        })),
      ],
    },
    {
      name: "interface", label: "Interface", plural: "Interfaces", layer: "integration",
      description: "A governed data exchange between two systems.",
      replaces: ["plan_interface_catalogue"], owns: ["plan_interface_catalogue.interface_id"],
      columns: [col("name", "Name"), ref("source_system", "Source system", "source_system"), col("target_system", "Target system"), ...mirror(tc, "plan_interface_catalogue", ["direction", "data_object", "frequency", "last_validated", "validation_rule"]), ref("status", "Status", "status", "connector")],
      build: (ctx) => ctx.rows("plan_interface_catalogue").map((r) => ({
        code: String(r.interface_id), values: { name: r.interface_name, source_system: r.source_system, target_system: r.target_system, ...take(r, ["direction", "data_object", "frequency", "last_validated", "validation_rule"]), status: r.status }, lineage: [one("plan_interface_catalogue", r.__key)],
      })),
    },
    {
      name: "source_document", label: "Source document", plural: "Source documents", layer: "integration",
      description: "An external standard, regulation or evidence source cited by models and disclosures.",
      replaces: ["sus_source_registry", "pno_optimization_source_reg"], owns: ["sus_source_registry.source_id", "pno_optimization_source_reg.source_id"],
      columns: [col("title", "Title", "text", { maxLength: 1000 }), col("source_type", "Type"), col("authority", "Authority"), col("country", "Country"), col("region", "Region"), col("version", "Version"), col("published", "Published"), col("effective_from", "Effective from"), col("effective_to", "Effective to"), col("status", "Status"), col("use_in_model", "Use in model", "text", { maxLength: 1000 }), col("notes", "Evidence notes", "text", { maxLength: 4000 }), col("url", "URL", "url")],
      build: (ctx) => [
        ...ctx.rows("sus_source_registry").map((r) => ({
          code: String(r.source_id),
          values: { title: r.document_title, source_type: r.source_type, authority: r.authority, country: r.country, region: r.region, version: r.document_version, published: r.publication_date, effective_from: r.effective_from, effective_to: r.effective_to, status: r.status, notes: r.evidence_notes, url: r.source_url },
          lineage: [one("sus_source_registry", r.__key)],
        })),
        ...ctx.rows("pno_optimization_source_reg").map((r) => ({
          code: String(r.source_id), values: { title: r.source, source_type: "Planning evidence", use_in_model: r.use_in_model, notes: r.evidence, url: r.source_url }, lineage: [one("pno_optimization_source_reg", r.__key)],
        })),
      ],
    },

    // Sustainability
    {
      name: "metric", label: "ESG metric", plural: "ESG metrics", layer: "sustainability",
      description: "A sustainability metric with its definition, formula and unit.",
      replaces: ["sus_metric_catalogue"], owns: ["sus_metric_catalogue.metric_id"],
      columns: [col("name", "Name"), ref("unit", "Unit", "unit"), ...mirror(tc, "sus_metric_catalogue", ["definition", "formula", "asset_relevance", "applicable_asset_scope", "frequency", "aip_applicability"])],
      build: (ctx) => ctx.rows("sus_metric_catalogue").map((r) => ({
        code: String(r.metric_id), values: { name: r.metric_name, unit: r.unit, ...take(r, ["definition", "formula", "asset_relevance", "applicable_asset_scope", "frequency", "aip_applicability"]) }, lineage: [one("sus_metric_catalogue", r.__key)],
      })),
    },
    {
      name: "metric_framework_map", label: "Metric disclosure mapping", plural: "Metric disclosure mappings", layer: "sustainability",
      description: "Which disclosure in which reporting framework (BRSR, GRI, ISSB, CSRD) a metric serves.",
      replaces: ["sus_framework_mapping"], owns: [],
      columns: [fk("metric", "Metric", "metric"), ref("framework", "Framework", "framework"), ...mirror(tc, "sus_framework_mapping", ["disclosure_id", "applicable", "requirement_or_link", "version", "effective_from", "mapping_status"])],
      build: (ctx) => ctx.rows("sus_framework_mapping").map((r) => ({
        code: `${String(r.metric_id)}:${slug(String(r.framework))}`, values: { metric: r.metric_id, framework: r.framework, ...take(r, ["disclosure_id", "applicable", "requirement_or_link", "version", "effective_from", "mapping_status"]) }, lineage: [one("sus_framework_mapping", r.__key)],
      })),
    },

    // Analytics
    {
      name: "ml_model", label: "Analytical model", plural: "Analytical models", layer: "analytics",
      description: "A governed forecasting or predictive model: algorithm, training window, validation and approval. AIP's own engines register here too.",
      replaces: ["fcst_model_governance"], owns: ["fcst_model_governance.model_id"],
      columns: [col("name", "Name"), ...mirror(tc, "fcst_model_governance", ["model_type", "version", "owner_foundation", "training_start", "training_end", "training_record_count", "feature_set", "algorithm", "validation_method", "primary_metric", "validation_result", "champion_challenger", "approval_status", "last_trained", "next_review", "production_note"]), col("engine", "AIP engine")],
      build: (ctx) => [
        ...ctx.rows("fcst_model_governance").map((r) => ({
          code: String(r.model_id), values: { name: r.model_name, ...take(r, ["model_type", "version", "owner_foundation", "training_start", "training_end", "training_record_count", "feature_set", "algorithm", "validation_method", "primary_metric", "validation_result", "champion_challenger", "approval_status", "last_trained", "next_review", "production_note"]) }, lineage: [one("fcst_model_governance", r.__key)],
        })),
        // AIP's own engines (schema/analytics/models.json): registered so every run links to a governed model.
        ...analyticsModels().map((m) => ({
          code: m.code,
          values: { name: m.name, model_type: m.model_type, version: m.version, owner_foundation: m.owner_foundation, feature_set: m.feature_set, algorithm: m.algorithm, validation_method: m.validation_method, primary_metric: m.primary_metric, champion_challenger: "Champion", approval_status: "Approved", engine: m.engine },
          lineage: [{ table: "analytics_models", key: m.code, role: "derived" as const }],
        })),
      ],
    },

    // Contracts
    {
      name: "warranty_contract", label: "Warranty", plural: "Warranties", layer: "contract",
      description: "A warranty on an asset or a model batch, from the warranty register and the BESS product and performance warranties.",
      replaces: ["warranty_register", "bess_warranty_and_maintenance"], owns: ["warranty_register.warranty_id"],
      dropped: "asset_tag, asset_class and plant_id are the asset's.",
      columns: [
        fk("asset", "Asset", "asset"), fk("provider", "Provider", "party"), fk("equipment_model", "Model", "equipment_model"), col("batch_id", "Batch"),
        col("warranty_type", "Warranty type"), col("coverage_type", "Coverage"), col("start_date", "Start", "date"), col("end_date", "End", "date"), col("claim_notice_days", "Claim notice (days)", "integer"),
        col("remaining_coverage_value", "Remaining coverage value", "money", { precision: 4 }), col("rca_required", "RCA required", "boolean"), col("work_order_required", "Work order required", "boolean"), col("invoice_required", "Invoice required", "boolean"),
        ref("status", "Status", "status", "warranty"), col("performance_guarantee", "Performance guarantee", "text", { maxLength: 1000 }),
        col("retention_pct_year10", "Guaranteed retention at year 10 (%)", "decimal", { precision: 2 }), col("retention_pct_eol", "Guaranteed retention at end of life (%)", "decimal", { precision: 2 }),
        col("cycle_limit", "Cycle limit", "integer"), col("throughput_limit_mwh", "Throughput limit (MWh)", "decimal", { precision: 2 }), col("guaranteed_rte_pct", "Guaranteed RTE (%)", "decimal", { precision: 2 }), col("conditions", "Conditions", "text", { maxLength: 1000 }),
        col("data_basis", "Data basis", "text", { maxLength: 1000 }),
      ],
      build: (ctx) => [
        ...ctx.rows("warranty_register").map((r) => ({
          code: String(r.warranty_id),
          values: {
            asset: str(r.asset_id), provider: partyCode(r.oem), equipment_model: str(r.model_id), batch_id: r.batch_id, warranty_type: r.warranty_type, coverage_type: r.coverage_type,
            start_date: r.warranty_start_date, end_date: r.warranty_end_date, claim_notice_days: r.claim_notice_days, remaining_coverage_value: r.remaining_coverage_value,
            rca_required: yes(r.rca_required), work_order_required: yes(r.work_order_required), invoice_required: yes(r.invoice_required), status: r.current_status,
            performance_guarantee: r.performance_guarantee, data_basis: [r.data_basis, r.data_provenance].filter(Boolean).join(" · ") || null,
          },
          lineage: [one("warranty_register", r.__key)],
        })),
        ...ctx.rows("bess_warranty_and_maintenance").map((r) => {
          const sys = ctx.rows("bess_systems").find((s) => s.bess_id === r.bess_id);
          return {
            code: `WTY-${String(r.bess_id)}`,
            values: {
              asset: sys?.asset_id ?? null, provider: partyCode(r.warranty_provider), warranty_type: "BESS product and performance", coverage_type: "Product and capacity retention",
              start_date: r.product_warranty_start, end_date: r.product_warranty_end, retention_pct_year10: r.guaranteed_retention_pct_year10, retention_pct_eol: r.guaranteed_retention_pct_eol,
              cycle_limit: r.warranty_cycle_limit, throughput_limit_mwh: r.warranty_throughput_limit_mwh, guaranteed_rte_pct: r.guaranteed_ac_rte_pct,
              conditions: [r.warranty_temp_condition_c && `Temperature ${String(r.warranty_temp_condition_c)}`, r.warranty_so_c_condition && `SoC ${String(r.warranty_so_c_condition)}`, r.performance_warranty_years && `${String(r.performance_warranty_years)}-year performance warranty`].filter(Boolean).join("; ") || null,
              data_basis: r.data_provenance,
            },
            lineage: [one("bess_warranty_and_maintenance", r.__key, "derived")],
          };
        }),
      ],
    },
    {
      name: "offtake_contract", label: "Offtake contract", plural: "Offtake contracts", layer: "contract",
      description: "A power-purchase or storage-capacity contract: counterparty, tariff, capacity, term and obligations. Settlement figures are transactions (phase 3).",
      replaces: ["commercial_and_ppa", "bess_commercial_and_dispatch"], owns: ["commercial_and_ppa.ppa_id", "bess_commercial_and_dispatch.contract_id"],
      dropped: "Energy, invoice, receivable and penalty figures are monthly settlement values; they move to settlement transactions in phase 3.",
      columns: [
        fk("site", "Site", "site"), fk("asset", "Storage asset", "asset"), fk("offtaker", "Offtaker", "party"), col("contract_type", "Contract type"), col("commercial_model", "Commercial model"),
        col("tariff_per_kwh", "Tariff per kWh", "money", { precision: 4 }), col("charging_tariff_per_kwh", "Charging tariff per kWh", "money", { precision: 4 }), col("capacity_charge_per_mw_month", "Capacity charge per MW-month", "money", { precision: 4 }), col("vgf_per_mwh", "VGF per MWh", "money", { precision: 4 }),
        col("contracted_capacity_mw", "Contracted capacity (MW)", "decimal", { precision: 2 }), col("contracted_energy_mwh", "Contracted energy (MWh)", "decimal", { precision: 2 }),
        col("start_date", "Start", "date"), col("end_date", "End", "date"), col("tenure_years", "Tenure (years)", "integer"),
        col("availability_obligation_pct", "Availability obligation (%)", "decimal", { precision: 2 }), col("min_rte_pct", "Minimum RTE (%)", "decimal", { precision: 2 }), col("cycles_per_day", "Cycles per day", "decimal", { precision: 2 }),
        col("obligations", "Obligations and windows", "text", { maxLength: 1000 }), col("status", "Status"),
      ],
      build: (ctx) => [
        ...ctx.rows("commercial_and_ppa").map((r) => ({
          code: String(r.ppa_id),
          values: { site: r.plant_id, offtaker: partyCode(r.offtaker), contract_type: "PPA", tariff_per_kwh: r.ppa_tariff_k_wh, contracted_capacity_mw: r.contracted_capacity_mw, start_date: r.contract_start_date, end_date: r.contract_expiry_date, availability_obligation_pct: r.availability_obligation_pct, status: r.contract_status },
          lineage: [one("commercial_and_ppa", r.__key)],
        })),
        ...ctx.rows("bess_commercial_and_dispatch").map((r) => {
          const sys = ctx.rows("bess_systems").find((s) => s.bess_id === r.bess_id);
          return {
            code: String(r.contract_id),
            values: {
              site: r.plant_id, asset: sys?.asset_id ?? null, offtaker: partyCode(r.offtaker), contract_type: "BESS capacity", commercial_model: r.commercial_model,
              tariff_per_kwh: r.peak_tariff_k_wh, charging_tariff_per_kwh: r.charging_energy_tariff_k_wh, capacity_charge_per_mw_month: r.capacity_charge_per_mw_month, vgf_per_mwh: r.vgf_per_mwh,
              contracted_capacity_mw: r.contracted_power_mw, contracted_energy_mwh: r.contracted_energy_mwh, start_date: r.contract_start, tenure_years: r.tenure_years,
              availability_obligation_pct: r.min_availability_pct, min_rte_pct: r.min_rte_pct, cycles_per_day: r.cycles_per_day,
              obligations: [r.availability_measurement, r.rte_measurement, r.rte_penalty_basis, r.charge_window && `charge ${String(r.charge_window)}`, r.discharge_window && `discharge ${String(r.discharge_window)}`, r.min_dispatch_fulfilment_pct && `dispatch fulfilment ≥ ${String(r.min_dispatch_fulfilment_pct)}%`, r.vgf_support && `VGF ${String(r.vgf_support)}`].filter(Boolean).join("; ") || null,
            },
            lineage: [one("bess_commercial_and_dispatch", r.__key)],
          };
        }),
      ],
    },

    // Consolidated registers
    {
      name: "intervention", label: "Intervention", plural: "Interventions", layer: "register",
      description: "One maintenance intervention register: the optimiser's register (with the C9 candidates) and the planning register merge on intervention ID; the PV module interventions exist only in the planning register.",
      replaces: ["pno_interventions", "plan_interventions"], owns: ["pno_interventions.intervention_id", "plan_interventions.intervention_id"],
      dropped: "asset_tag and asset_class are the asset's; dates are stored as ISO date-times whichever register supplied them.",
      columns: [
        col("work_order_code", "Work order"), fk("site", "Site", "site"), fk("asset", "Asset", "asset"), ref("maintenance_type", "Maintenance type", "maintenance_type"),
        col("description", "Description", "text", { maxLength: 1000 }), ref("priority", "Priority", "priority"), col("risk_score_pct", "Risk score (%)", "decimal", { precision: 2 }), col("value_exposure", "Value exposure", "money", { precision: 4 }),
        col("planning_as_of", "Planning as of", "datetime"), col("required_by", "Required by", "datetime"), col("planned_start", "Planned start", "datetime"), col("planned_finish", "Planned finish", "datetime"), col("duration_hours", "Duration (h)", "decimal", { precision: 2 }),
        ref("required_skill", "Required skill", "skill"), col("required_crew_qty", "Crew size", "integer"), fk("required_part", "Required part", "part"), col("required_part_qty", "Part quantity", "integer"), fk("required_tool", "Required tool", "tool"), col("vehicle_class", "Vehicle class"),
        col("permit_required", "Permit required", "boolean"), col("outage_required", "Outage required", "boolean"), ref("planning_status", "Planning status", "status", "intervention"),
        col("actual_start", "Actual start", "datetime"), col("actual_completion", "Actual completion", "datetime"), col("actual_duration_hours", "Actual duration (h)", "decimal", { precision: 2 }),
        col("erp_execution_status", "ERP execution status"), col("calculation_basis", "Calculation basis", "text", { maxLength: 1000 }), col("source_record", "Source record", "text", { maxLength: 1000 }),
      ],
      build: (ctx) => {
        const fields = (r: Rec) => ({
          work_order_code: str(r.work_order_id), site: r.plant_id, asset: str(r.asset_id), maintenance_type: r.maintenance_type, description: r.intervention_description ?? r.intervention,
          priority: r.priority, risk_score_pct: r.risk_score_pct, value_exposure: r.value_exposure ?? null, planning_as_of: isoDateTime(r.planning_as_of), required_by: isoDateTime(r.required_by),
          planned_start: isoDateTime(r.planned_start), planned_finish: isoDateTime(r.planned_finish), duration_hours: r.duration_hours, required_skill: r.required_skill, required_crew_qty: r.required_crew_qty,
          required_part: str(r.required_part_id), required_part_qty: r.required_part_qty, required_tool: str(r.required_tool_id), vehicle_class: r.vehicle_class,
          permit_required: yes(r.permit_required), outage_required: yes(r.outage_required), planning_status: r.planning_status, actual_start: isoDateTime(r.actual_start),
          actual_completion: isoDateTime(r.actual_completion), actual_duration_hours: r.actual_duration_hours, erp_execution_status: r.erp_execution_status, calculation_basis: r.calculation_basis,
          source_record: [r.source_sheet, r.source_record ?? r.source_record_id].filter(Boolean).join(" · ") || null,
        });
        const out = new Map<string, MasterRow>();
        for (const t of ["pno_interventions", "plan_interventions"]) for (const r of ctx.rows(t)) {
          const code = String(r.intervention_id);
          const hit = out.get(code);
          if (!hit) { out.set(code, { code, values: fields(r), lineage: [one(t, r.__key)] }); continue; }
          for (const [k, v] of Object.entries(fields(r))) if ((hit.values[k] === null || hit.values[k] === undefined) && v !== null && v !== undefined) hit.values[k] = v;
          hit.lineage.push(one(t, r.__key, "merged"));
        }
        return [...out.values()];
      },
    },
    {
      name: "scenario", label: "Planning scenario", plural: "Planning scenarios", layer: "register",
      description: "One scenario register: the optimiser's portfolio scenarios and the planners' intervention-level simulations.",
      replaces: ["pno_scenarios", "plan_scenarios"], owns: ["pno_scenarios.scenario_id", "plan_scenarios.scenario_id"],
      columns: [
        col("name", "Name"), col("scenario_type", "Scenario type"), col("description", "Description", "text", { maxLength: 1000 }), col("crew_capacity_multiplier", "Crew capacity ×", "decimal", { precision: 4 }),
        col("cost_weight_multiplier", "Cost weight ×", "decimal", { precision: 4 }), col("weather_threshold_pct", "Weather threshold (%)", "decimal", { precision: 2 }), col("cost_cap", "Cost cap", "money", { precision: 4 }),
        ref("status", "Status", "status", "scenario"), col("created_by", "Created by"), col("source_record", "Source", "text", { maxLength: 1000 }),
      ],
      build: (ctx) => [
        ...ctx.rows("pno_scenarios").map((r) => ({
          code: String(r.scenario_id),
          values: { name: r.scenario_name, scenario_type: r.scenario_state === "What-if" ? "Portfolio what-if" : "Portfolio baseline", description: r.description, crew_capacity_multiplier: r.crew_capacity_multiplier, cost_weight_multiplier: r.cost_weight_multiplier, weather_threshold_pct: r.weather_threshold_pct, cost_cap: r.cost_cap, status: r.scenario_state === "What-if" ? "Draft" : "Active" },
          lineage: [one("pno_scenarios", r.__key)],
        })),
        ...ctx.rows("plan_scenarios").map((r) => ({
          code: String(r.scenario_id),
          values: { name: `${String(r.scenario_type)} for ${String(r.intervention_id)}`, scenario_type: r.scenario_type, status: r.scenario_status, created_by: r.created_by, source_record: r.source },
          lineage: [one("plan_scenarios", r.__key)],
        })),
      ],
    },
    {
      name: "scenario_intervention", label: "Scenario line", plural: "Scenario lines", layer: "register",
      description: "An intervention as evaluated or proposed in a scenario: the optimiser's scores and ranks, and planners' proposed windows.",
      replaces: ["pno_optimization", "plan_scenarios"], owns: [],
      dropped: "plant, asset and priority are the intervention's.",
      columns: [
        fk("scenario", "Scenario", "scenario"), fk("intervention", "Intervention", "intervention"), col("criticality_score", "Criticality score", "decimal", { precision: 2 }), col("value_score", "Value score", "decimal", { precision: 4 }),
        col("readiness_pct", "Readiness (%)", "decimal", { precision: 2 }), col("estimated_cost", "Estimated cost", "money", { precision: 4 }), col("optimization_score", "Optimisation score", "decimal", { precision: 4 }), col("rank", "Rank", "integer"),
        col("proposed_start", "Proposed start", "datetime"), col("proposed_end", "Proposed end", "datetime"), col("calculation_basis", "Calculation basis", "text", { maxLength: 1000 }),
      ],
      build: (ctx) => [
        ...ctx.rows("pno_optimization").map((r) => ({
          code: `${String(r.scenario_id)}/${String(r.intervention_id)}`,
          values: { scenario: r.scenario_id, intervention: r.intervention_id, ...take(r, ["criticality_score", "value_score", "readiness_pct", "estimated_cost", "optimization_score", "rank", "calculation_basis"]) },
          lineage: [one("pno_optimization", r.__key)],
        })),
        ...ctx.rows("plan_scenarios").map((r) => ({
          code: `${String(r.scenario_id)}/${String(r.intervention_id)}`,
          values: { scenario: r.scenario_id, intervention: r.intervention_id, proposed_start: isoDateTime(r.proposed_start), proposed_end: isoDateTime(r.proposed_end) },
          lineage: [one("plan_scenarios", r.__key, "derived")],
        })),
      ],
    },
    {
      name: "hse_incident", label: "HSE incident", plural: "HSE incidents", layer: "register",
      description: "A health, safety and environment incident in its own ID space, separated from the operational event log.",
      replaces: ["sus_hse_events"], owns: ["sus_hse_events.event_id"],
      dropped: "asset_class is the asset's.",
      columns: [
        col("occurred_on", "Date", "date"), fk("site", "Site", "site"), fk("asset", "Asset", "asset"), col("work_order_code", "Work order"), col("activity", "Maintenance activity"), col("worker_type", "Worker type"),
        ref("incident_type", "Incident type", "event_type", "hse"), ref("severity", "Severity", "severity"), ref("status", "Status", "status", "hse_incident"), ref("source_system", "Source system", "source_system"),
        col("data_status", "Data status"), col("asset_reference_basis", "Asset reference basis", "text", { maxLength: 1000 }),
      ],
      build: (ctx) => ctx.rows("sus_hse_events").map((r) => ({
        code: String(r.event_id),
        values: { occurred_on: r.date, site: r.plant_id, asset: str(r.asset_id), work_order_code: str(r.work_order_id), activity: r.maintenance_activity, worker_type: r.worker_type, incident_type: r.event_type, severity: r.severity, status: r.status, source_system: r.source_system, data_status: r.data_status, asset_reference_basis: r.asset_reference_basis },
        lineage: [one("sus_hse_events", r.__key)],
      })),
    },
  ];
}

/** AIP's own analytical models (schema/analytics/models.json). */
export interface AnalyticsModelCard {
  code: string;
  name: string;
  model_type: string;
  engine: string;
  version: string;
  algorithm: string;
  feature_set: string;
  validation_method: string;
  primary_metric: string;
  owner_foundation: string;
}

export function analyticsModels(): AnalyticsModelCard[] {
  return (JSON.parse(readFileSync(new URL("../../../schema/analytics/models.json", import.meta.url), "utf8")) as { models: AnalyticsModelCard[] }).models;
}

// ── Build + gate ────────────────────────────────────────────────────────────

/** Masters in dependency order (a master after every master it references, self-references aside). */
export function topoOrder(defs: MasterDef[]): MasterDef[] {
  const byName = new Map(defs.map((d) => [d.name, d]));
  const out: MasterDef[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (d: MasterDef) => {
    if (state.get(d.name) === "done") return;
    if (state.get(d.name) === "visiting") throw new Error(`master reference cycle at ${d.name}`);
    state.set(d.name, "visiting");
    for (const c of d.columns) if (c.kind === "fk" && c.fk !== d.name) {
      const t = byName.get(c.fk!);
      if (!t) throw new Error(`${d.name}.${c.name} references unknown master ${c.fk}`);
      visit(t);
    }
    state.set(d.name, "done");
    out.push(d);
  };
  defs.forEach(visit);
  return out;
}

export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._:@\/|+-]{0,199}$/;

export interface MasterBuild {
  masters: BuiltMaster[];
  issues: MasterIssue[];
  corrections: CorrectionEntry[];
}

/**
 * Builds every master from the corrected workbook, resolves controlled values to vocabulary codes and checks
 * codes, references and 1:1 extensions. Problems are returned, not thrown, so the gate can report all of them.
 */
export function buildMasters(reg: Registry, raw: Record<string, SourceRow[]>, vocab: Vocabulary, corrections?: CorrectionSet): MasterBuild {
  const { sheets, entries } = corrections ? applyCorrections(reg, raw, corrections) : { sheets: raw, entries: [] as CorrectionEntry[] };
  const ctx = new MasterContext(reg, sheets);
  const resolver = new Resolver(vocab);
  const defs = topoOrder(masterDefs(reg));
  const issues: MasterIssue[] = [];
  const masters: BuiltMaster[] = [];
  const codes = new Map<string, Set<string>>();
  for (const def of defs) {
    const rows = def.build(ctx);
    const seen = new Set<string>();
    for (const row of rows) {
      if (!CODE_PATTERN.test(row.code)) issues.push({ master: def.name, code: row.code, column: "code", value: row.code, problem: "invalid code" });
      if (seen.has(row.code)) issues.push({ master: def.name, code: row.code, column: "code", value: row.code, problem: "duplicate code" });
      seen.add(row.code);
      for (const c of def.columns) {
        const v = row.values[c.name];
        if (v === undefined) { row.values[c.name] = null; continue; }
        if (c.kind !== "ref" || v === null) continue;
        const binding: Binding = { column: `${def.name}.${c.name}`, ref: c.ref!, scope: c.scope, nullTokens: c.nullTokens };
        const res = resolver.resolve(binding, v);
        if (res.status === "null") row.values[c.name] = null;
        else if (res.status === "code") row.values[c.name] = res.code;
        else { issues.push({ master: def.name, code: row.code, column: c.name, value: String(v), problem: "unmapped reference" }); row.values[c.name] = null; }
      }
      for (const k of Object.keys(row.values)) if (!def.columns.some((c) => c.name === k)) throw new Error(`${def.name} row ${row.code} sets unknown column ${k}`);
    }
    codes.set(def.name, seen);
    masters.push({ def, rows });
  }
  for (const { def, rows } of masters) {
    for (const c of def.columns.filter((x) => x.kind === "fk")) {
      const targets = codes.get(c.fk!)!;
      const parents = new Set<string>();
      for (const row of rows) {
        const v = row.values[c.name];
        if (v === null || v === undefined) continue;
        if (!targets.has(String(v))) issues.push({ master: def.name, code: row.code, column: c.name, value: String(v), problem: "unresolved foreign key" });
        if (c.unique) {
          if (parents.has(String(v))) issues.push({ master: def.name, code: row.code, column: c.name, value: String(v), problem: "duplicate 1:1 parent" });
          parents.add(String(v));
        }
      }
    }
  }
  return { masters, issues, corrections: entries };
}

/** Master codes by master name (for the integrity retarget). */
export function masterCodes(b: MasterBuild): Map<string, Set<string>> {
  return new Map(b.masters.map((m) => [m.def.name, new Set(m.rows.map((r) => r.code))]));
}

// ── Phase 2 gate: merges resolve, and the report ────────────────────────────

export interface MergeResolution {
  rule: IntegrityRule;
  values: number;
  resolved: number;
  unresolved: Array<{ value: string; count: number }>;
}

/** Every value a merge rule matches must be a code of the master named by its resolvedBy. */
export function mergeResolution(b: MasterBuild, sheets: Record<string, SourceRow[]>, reg: Registry, rules: IntegrityRules): MergeResolution[] {
  const ctx = new MasterContext(reg, sheets);
  const codes = masterCodes(b);
  return rules.rules
    .filter((r) => r.class === "merge")
    .map((rule) => {
      if (!rule.resolvedBy || !codes.has(rule.resolvedBy)) throw new Error(`merge rule ${rule.from} names no master (resolvedBy)`);
      const [t, c] = rule.from.split(".");
      const target = codes.get(rule.resolvedBy)!;
      const re = rule.match ? new RegExp(rule.match) : null;
      const out: MergeResolution = { rule, values: 0, resolved: 0, unresolved: [] };
      const miss = new Map<string, number>();
      for (const r of ctx.rows(t!)) {
        const v = str(r[c!]);
        if (!v || (re && !re.test(v))) continue;
        out.values++;
        if (target.has(v)) out.resolved++;
        else miss.set(v, (miss.get(v) ?? 0) + 1);
      }
      out.unresolved = [...miss].map(([value, count]) => ({ value, count }));
      return out;
    });
}

const fmt = (x: number) => x.toLocaleString("en-US");

/** Markdown report committed to docs/data so reviewers see what phase 2 consolidates. */
export function phase2Report(reg: Registry, b: MasterBuild, merges: MergeResolution[]): string {
  const total = b.masters.reduce((n, m) => n + m.rows.length, 0);
  const lines = [
    "# Phase 2 — master data and consolidated registers",
    "",
    `Generated by \`pnpm --filter @sustantix/schema check:data\` from ${reg.source} (sha256 ${reg.sourceSha256.slice(0, 12)}…). Do not edit by hand.`,
    "",
    "## Summary",
    "",
    "| Measure | Value |",
    "| --- | --- |",
    `| Masters and registers | ${b.masters.length} tables, ${fmt(total)} rows |`,
    `| Workbook tables consolidated | ${new Set(b.masters.flatMap((m) => m.def.replaces)).size} |`,
    `| Foreign keys | ${b.masters.reduce((n, m) => n + m.def.columns.filter((c) => c.kind === "fk").length, 0)} (all composite with tenant) |`,
    `| Controlled-value references | ${b.masters.reduce((n, m) => n + m.def.columns.filter((c) => c.kind === "ref").length, 0)} |`,
    `| Values matched by the phase 1 merge rules, resolved in their master | ${fmt(merges.reduce((n, x) => n + x.resolved, 0))} of ${fmt(merges.reduce((n, x) => n + x.values, 0))} |`,
    `| Problems (codes, references, 1:1 extensions) | ${b.issues.length} |`,
    "",
    "## Masters",
    "",
    "| Master | Layer | Rows | Replaces | Merged rows | Keys to | Dropped (copies) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const { def, rows } of b.masters) {
    const merged = rows.filter((r) => r.lineage.some((l) => l.role === "merged")).length;
    const fks = def.columns.filter((c) => c.kind === "fk").map((c) => `${c.name} → ${c.fk}`);
    const refs = def.columns.filter((c) => c.kind === "ref").map((c) => `${c.name} → ref_${c.ref}${c.scope ? `/${c.scope}` : ""}`);
    lines.push(`| \`${def.name}\` | ${def.layer} | ${fmt(rows.length)} | ${def.replaces.map((t) => `\`${t}\``).join(", ") || "(derived)"} | ${merged || ""} | ${[...fks, ...refs].join("; ")} | ${def.dropped ?? ""} |`);
  }
  lines.push("", "## Phase 1 merge references", "", "| Reference | Master | Values | Resolved | Unresolved |", "| --- | --- | --- | --- | --- |");
  for (const m of merges) lines.push(`| \`${m.rule.from}\`${m.rule.match ? ` ~ \`${m.rule.match}\`` : ""} | \`${m.rule.resolvedBy}\` | ${fmt(m.values)} | ${fmt(m.resolved)} | ${m.unresolved.map((u) => `**${u.value} (${u.count})**`).join("; ")} |`);
  if (b.issues.length) {
    lines.push("", "## Problems", "", "| Master | Code | Column | Value | Problem |", "| --- | --- | --- | --- | --- |");
    for (const i of b.issues.slice(0, 200)) lines.push(`| ${i.master} | ${i.code} | ${i.column} | ${i.value} | ${i.problem} |`);
  }
  return lines.join("\n") + "\n";
}

/** Serializable description of every master (no build logic): read by hosts and agents. */
export interface MasterManifestEntry {
  name: string;
  label: string;
  layer: MasterLayer;
  description: string;
  view: string;
  columns: Array<{ name: string; label: string; kind: MasterColumn["kind"]; ref?: string; scope?: string; fk?: string }>;
}

export function masterManifest(defs: MasterDef[]): { version: 1; masters: MasterManifestEntry[] } {
  return {
    version: 1,
    masters: topoOrder(defs).map((d) => ({
      name: d.name,
      label: d.label,
      layer: d.layer,
      description: d.description,
      view: `v_${d.name}`,
      columns: [
        { name: "code", label: "Code", kind: "text" as const },
        ...d.columns.map((c) => ({ name: c.name, label: c.label, kind: c.kind, ...(c.ref ? { ref: c.ref } : {}), ...(c.scope ? { scope: c.scope } : {}), ...(c.fk ? { fk: c.fk } : {}) })),
      ],
    })),
  };
}
