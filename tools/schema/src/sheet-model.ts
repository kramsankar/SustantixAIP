/**
 * Phase 3: transactions and time series, each declared once as a mapping from the workbook sheet it replaces.
 *
 * Every sheet column is accounted for: kept (same type), turned into a reference to a master (by business code),
 * turned into a controlled value, re-typed (dd-mm-yyyy text → timestamp, Yes/No → boolean), or recognised as a copy
 * of a master attribute that the compatibility view rebuilds through the reference. From the one declaration the
 * generators derive the table (as a MasterDef, so keys, RLS, audit, code views and Dataverse come for free), the
 * loader, and the compatibility view that rebuilds the sheet exactly where the data allows.
 */
import type { MasterColumn, MasterContext, MasterDef, MasterLayer, MasterRow, Rec } from "./masters.ts";
import { isoDateTime } from "./masters.ts";
import type { Registry, TableDef } from "./registry.ts";

/** How one normalized column is filled from the sheet. */
export type Source =
  | string // the sheet column of the same type
  | { fk: string; col: string }
  | { ref: string; scope?: string; col: string; nullTokens?: string[]; /** Set only when the value is in this table (a column split across two vocabularies). */ whenResolves?: boolean }
  | { datetime: string; format?: "dmy" | "iso" }
  | { bool: string };

/** A sheet column the normalized model does not store: rebuilt from the row a reference points to. */
export interface Copy {
  /** The normalized column holding the reference (an fk column of this spec). */
  via: string;
  /** Column of the target master, or a path through its references ("manufacturer.name"); `label` resolves a
   *  final reference column to its vocabulary label. */
  attr: string;
  label?: string;
}

export interface SheetSpec {
  name: string;
  label: string;
  plural: string;
  layer: Extract<MasterLayer, "transaction" | "series">;
  description: string;
  sheet: string;
  columns: Record<string, Source>;
  copies?: Record<string, Copy>;
  /** Sheet columns intentionally not carried (each with the reason). Must be empty unless justified. */
  omitted?: Record<string, string>;
}

const srcCol = (s: Source): string => (typeof s === "string" ? s : "col" in s ? s.col : "datetime" in s ? s.datetime : s.bool);

/** Expands a spec into a MasterDef whose columns take their types from the registry. */
export function specDef(reg: Registry, s: SheetSpec): MasterDef {
  const t = reg.tables.find((x) => x.name === s.sheet);
  if (!t) throw new Error(`${s.name}: unknown sheet table ${s.sheet}`);
  const col = (n: string) => {
    const c = t.columns.find((x) => x.name === n);
    if (!c) throw new Error(`${s.name}: ${s.sheet} has no column ${n}`);
    return c;
  };
  const columns: MasterColumn[] = Object.entries(s.columns).map(([name, src]): MasterColumn => {
    const c = col(srcCol(src));
    if (typeof src === "string") return { name, label: c.label, kind: c.kind === "bigint" ? "integer" : c.kind, precision: c.precision, maxLength: c.kind === "text" ? Math.max(c.maxLength ?? 200, 300) : undefined };
    if ("fk" in src) return { name, label: c.label, kind: "fk", fk: src.fk };
    if ("ref" in src) return { name, label: c.label, kind: "ref", ref: src.ref, scope: src.scope, nullTokens: src.nullTokens, optionalRef: src.whenResolves };
    if ("datetime" in src) return { name, label: c.label, kind: "datetime" };
    return { name, label: c.label, kind: "boolean" };
  });
  columns.push({ name: "source_ordinal", label: "Source row", kind: "integer" });
  return {
    name: s.name,
    label: s.label,
    plural: s.plural,
    layer: s.layer,
    description: s.description,
    replaces: [s.sheet],
    owns: t.key.length === 1 ? [`${s.sheet}.${t.columns.find((c) => c.source === t.key[0])?.name}`] : [],
    columns,
    noLineage: s.layer === "series",
    build: (ctx: MasterContext): MasterRow[] =>
      ctx.rows(s.sheet).map((r: Rec, i: number) => {
        const values: Record<string, unknown> = { source_ordinal: i + 1 };
        for (const [name, src] of Object.entries(s.columns)) {
          const raw = r[srcCol(src)];
          if (typeof src === "string") values[name] = raw ?? null;
          else if ("datetime" in src) values[name] = isoDateTime(raw);
          else if ("bool" in src) values[name] = raw === null || raw === undefined ? null : /^(yes|y|true|1)$/i.test(String(raw).trim());
          else values[name] = raw === null || raw === undefined || String(raw).trim() === "" ? null : String(raw).trim();
        }
        return { code: r.__key, values, lineage: s.layer === "series" ? [] : [{ table: s.sheet, key: r.__key, role: "primary" }] };
      }),
  };
}

/** Every sheet column must be carried, rebuilt or explicitly omitted: otherwise the sheet cannot be rebuilt. */
export function specProblems(reg: Registry, s: SheetSpec): string[] {
  const t = reg.tables.find((x) => x.name === s.sheet);
  if (!t) return [`${s.name}: unknown sheet ${s.sheet}`];
  const carried = new Set(Object.values(s.columns).map(srcCol));
  // A single-column key is the business code itself.
  const code = t.key.length === 1 ? t.columns.find((c) => c.source === t.key[0])?.name : undefined;
  const problems: string[] = [];
  for (const c of t.columns) {
    const n = [carried.has(c.name) || c.name === code, !!s.copies?.[c.name], !!s.omitted?.[c.name]].filter(Boolean).length;
    if (n === 0) problems.push(`${s.name}: ${s.sheet}.${c.name} is neither carried, rebuilt nor omitted`);
    if (n > 1) problems.push(`${s.name}: ${s.sheet}.${c.name} is accounted for twice`);
  }
  for (const [k, c] of Object.entries(s.copies ?? {})) {
    const via = s.columns[c.via];
    if (!via || typeof via === "string" || !("fk" in via)) problems.push(`${s.name}: copy ${k} goes via ${c.via}, which is not a reference`);
  }
  return problems;
}

// ── The specs ───────────────────────────────────────────────────────────────

const site = (col = "plant_id") => ({ fk: "site", col });
const asset = (col = "asset_id") => ({ fk: "asset", col });
const ASSET_TAG: Copy = { via: "asset", attr: "tag" };
const PLANT_NAME: Copy = { via: "site", attr: "name" };
const ASSET_CLASS: Copy = { via: "asset", attr: "asset_class", label: "asset_class" };

export const SHEET_SPECS: SheetSpec[] = [
  // ── Transactions ──
  {
    name: "alert", label: "Predictive alert", plural: "Predictive alerts", layer: "transaction", sheet: "ai_alerts_and_rul",
    description: "A predictive-maintenance alert on an asset: risk score, remaining life and the evidence behind it.",
    columns: { asset: asset(), site: site(), component: "component", alert_timestamp: "alert_timestamp", model: "model", risk_score: "risk_score", rul_days: "rul_days", confidence_pct: "confidence_pct", risk_tier: "risk_tier", status: { ref: "status", scope: "alert", col: "alert_status" }, evidence_summary: "evidence_summary", data_basis: "data_basis" },
    copies: { asset_tag: ASSET_TAG },
  },
  {
    name: "recommendation", label: "Recommendation", plural: "Recommendations", layer: "transaction", sheet: "prescriptive_actions",
    description: "A prescriptive action raised from an alert, with the cost of acting now against deferring.",
    columns: { alert: { fk: "alert", col: "alert_id" }, asset: asset(), site: site(), risk_score: "risk_score", rul_days: "rul_days", recommended_action: "recommended_action", cost_now: "cost_now", cost_if_deferred: "cost_if_deferred", cost_avoided: "cost_avoided", confidence_pct: "confidence_pct", status: { ref: "status", scope: "recommendation", col: "decision_status" }, rationale: "rationale" },
    copies: { asset_tag: ASSET_TAG },
  },
  {
    name: "work_order", label: "Work order", plural: "Work orders", layer: "transaction", sheet: "work_orders",
    description: "A unit of maintenance work on an asset, with its SLA, cost, assignment and preventive-maintenance compliance.",
    columns: {
      maintenance_type: { ref: "maintenance_type", col: "maintenance_type" }, asset: asset(), site: site(), description: "description", priority: { ref: "priority", col: "priority" },
      status: { ref: "status", scope: "work_order", col: "status" }, created_date: "created_date", sla_due: "sla_due", sla_hours: "sla_hours", actual_resolution_hours: "actual_resolution_hours", sla_result: "sla_result",
      source_record: "source", estimated_cost: "estimated_cost", technician: { fk: "technician", col: "assigned_technician_id" }, assigned_crew: "assigned_crew", pm_frequency_days: "pm_frequency_days",
      pm_due_date: "pm_due_date", actual_pm_completion_date: "actual_pm_completion_date", pm_compliance_tolerance_days: "pm_compliance_tolerance_days", pm_compliance_result: "pm_compliance_result",
      pm_overdue_days: "pm_overdue_days", alert: { fk: "alert", col: "linked_alert_id" }, required_part: { fk: "part", col: "required_part_id" }, required_part_qty: "required_part_qty",
      pv_module: { fk: "pv_module", col: "module_id" }, data_basis: "data_basis",
    },
    copies: { asset_tag: ASSET_TAG },
  },
  {
    name: "event", label: "Operational event", plural: "Operational events", layer: "transaction", sheet: "event_log",
    description: "An operational incident: what happened, where, how severe, and its generation and revenue impact.",
    columns: {
      incident_id: "incident_id", site: site(), asset: asset(), event_date_time: "event_date_time", event_type: { ref: "event_type", scope: "operational", col: "event_type" }, severity: { ref: "severity", col: "severity" },
      alarm_code: "alarm_code", weather_context: "weather_context", generation_loss_mwh: "generation_loss_mwh", revenue_impact: "revenue_impact", status: { ref: "status", scope: "event", col: "event_status" },
      source_system: { ref: "source_system", col: "source_system" }, event_timestamp: "event_timestamp", pv_module: { fk: "pv_module", col: "module_id" }, classified_failure: "classified_failure",
    },
    copies: { asset_tag: ASSET_TAG },
  },
  {
    name: "rca_case", label: "Root-cause case", plural: "Root-cause cases", layer: "transaction", sheet: "event_root_cause_cases",
    description: "A root-cause analysis of an event: the cause found, how it was verified, and its validation.",
    columns: {
      event: { fk: "event", col: "event_id" }, site: site(), asset: asset(), event_type: { ref: "event_type", scope: "operational", col: "event_type" }, severity: { ref: "severity", col: "severity" },
      event_time: "event_time", cause_name: "cause_name", reference_id: "reference_id", verification_method: "verification_method", confidence_pct: "confidence_pct",
      status: { ref: "status", scope: "rca", col: "validation_status" }, engineer_approval: "engineer_approval",
      // OEM and model as recorded by the analysis: for case assets this is the only record of them.
      oem_recorded: "oem", model_recorded: "model",
    },
    copies: { plant_name: PLANT_NAME, asset_tag: ASSET_TAG, asset_class: ASSET_CLASS },
  },
  {
    name: "rca_evidence", label: "Root-cause evidence", plural: "Root-cause evidence", layer: "transaction", sheet: "event_root_cause_evidence",
    description: "A signal observed during a root-cause analysis, compared with its peer baseline.",
    columns: {
      event: { fk: "event", col: "event_id" }, rca_case: { fk: "rca_case", col: "rca_id" }, site: site(), asset: asset(), signal: "signal", actual_value: "actual_value", peer_baseline: "peer_baseline",
      unit: { ref: "unit", col: "unit" }, deviation_pct: "deviation_pct", source_system: { ref: "source_system", col: "source_system" }, evidence_role: "evidence_role", engineering_interpretation: "engineering_interpretation",
    },
    copies: { asset_tag: ASSET_TAG },
  },
  {
    name: "vision_inspection", label: "Vision inspection", plural: "Vision inspections", layer: "transaction", sheet: "vision_inspections",
    description: "A drone or camera inspection run: coverage, conditions and status.",
    columns: { site: site(), inspection_date_time: "inspection_date_time", inspection_type: "inspection_type", device_id: "device_id", panels_inspected: "panels_inspected", images_captured: "images_captured", coverage_pct: "coverage_pct", weather: "weather", flight_altitude_m: "flight_altitude_m", inspection_status: "inspection_status", inspector: "inspector", asset: asset(), data_basis: "data_basis" },
    copies: { plant_name: PLANT_NAME },
  },
  {
    name: "vision_finding", label: "Vision finding", plural: "Vision findings", layer: "transaction", sheet: "vision_findings",
    description: "A defect detected by an inspection, with its confidence, severity and estimated loss.",
    columns: {
      inspection: { fk: "vision_inspection", col: "inspection_id" }, site: site(), asset: asset(), defect_type: { ref: "defect_code", col: "defect_type" }, detection_mode: "detection_mode", confidence_pct: "confidence_pct",
      severity: { ref: "severity", col: "severity" }, status: { ref: "status", scope: "finding", col: "finding_status" }, estimated_loss_k_wh_day: "estimated_loss_k_wh_day", annual_revenue_risk: "annual_revenue_risk",
      recommended_action: "recommended_action", work_order: { fk: "work_order", col: "work_order_id" }, affected_area_sqm: "affected_area_sqm", physical_location: "physical_location",
      inspection_date: "inspection_date", inspector: "inspector", pv_module: { fk: "pv_module", col: "module_id" }, classified_failure: "classified_failure", data_basis: "data_basis",
    },
    copies: { asset_tag: ASSET_TAG },
  },
  {
    name: "warranty_claim", label: "Warranty claim", plural: "Warranty claims", layer: "transaction", sheet: "warranty_claims",
    description: "A claim against a warranty: amounts claimed and approved, evidence, deadlines and the OEM's response.",
    columns: {
      warranty: { fk: "warranty_contract", col: "warranty_id" }, incident_id: "incident_id", asset: asset(), site: site(), claim_date: "claim_date", failure_event_id: "failure_event_id",
      status: { ref: "status", scope: "warranty_claim", col: "claim_status" }, claimed_amount: "claimed_amount", approved_amount: "approved_amount", days_open: "days_open",
      evidence_completeness_pct: "evidence_completeness_pct", notice_deadline: "notice_deadline", oem_response_date: "oem_response_date", rejection_reason: "rejection_reason", next_action: "next_action",
      work_order: { fk: "work_order", col: "work_order_id" }, pv_module: { fk: "pv_module", col: "module_id" }, data_basis: "data_basis",
    },
    copies: { asset_tag: ASSET_TAG },
  },
  {
    name: "pm_plan", label: "Preventive maintenance plan", plural: "Preventive maintenance plans", layer: "transaction", sheet: "pm_plans",
    description: "A recurring maintenance task on an asset with its frequency, last and next dates.",
    columns: { asset: asset(), task: "task", frequency_days: "frequency_days", last_done: "last_done", next_due: "next_due", overdue_days: "overdue_days", standard_labour_hours: "standard_labour_hours", primary_part: { fk: "part", col: "primary_part_id" }, required_skill: { ref: "skill", col: "required_skill" }, site: site(), data_basis: "data_basis" },
    copies: { asset_tag: ASSET_TAG },
  },
  {
    name: "cbm_assessment", label: "Condition assessment", plural: "Condition assessments", layer: "transaction", sheet: "cbm_assessments",
    description: "A condition-based maintenance assessment fusing evidence into a condition, priority and recommended action.",
    columns: {
      site: site(), asset: asset(),
      // The sheet's failure_mode column holds a failure mode or, for visual conditions, a defect: split by vocabulary.
      failure_mode: { ref: "failure_mode", col: "failure_mode", nullTokens: ["No confirmed functional failure"], whenResolves: true },
      observed_defect: { ref: "defect_code", col: "failure_mode", whenResolves: true },
      primary_condition: "primary_condition", source_mode: "source_mode",
      latest_evidence_time: "latest_evidence_time", freshness_class: "freshness_class", max_deviation_pct: "max_deviation_pct", evidence_count: "evidence_count", corroboration_count: "corroboration_count",
      condition_severity: "condition_severity", risk_context: "risk_context", evidence_sufficiency_pct: "evidence_sufficiency_pct", engineering_physics_fit_pct: "engineering_physics_fit_pct", confidence_pct: "confidence_pct",
      priority: { ref: "priority", col: "priority" }, condition_state: "condition_state", recommended_action: "recommended_action", governance_class: "governance_class", approval_role: "approval_role",
      source_module: "source_module", source_record_id: "source_record_id", target_view: "target_view", work_order_code: "work_order_id", reference_id: "reference_id", verification_method: "verification_method", decision_basis: "decision_basis",
    },
    copies: { plant_name: PLANT_NAME, asset_tag: ASSET_TAG, asset_class: ASSET_CLASS },
  },
  {
    name: "condition_evidence", label: "Condition evidence", plural: "Condition evidence", layer: "transaction", sheet: "cbm_evidence",
    description: "One piece of condition evidence (signal, deviation, quality) behind an assessment.",
    columns: {
      assessment: { fk: "cbm_assessment", col: "cbm_assessment_id" }, site: site(), asset: asset(), evidence_source: "evidence_source", arrival_mode: "arrival_mode", source_module: "source_module", target_view: "target_view",
      source_record_id: "source_record_id", observed_time: "observed_time", signal_name: "signal_name", observed_value: "observed_value", baseline_or_peer: "baseline_or_peer", unit: { ref: "unit", col: "unit" },
      deviation_pct: "deviation_pct", evidence_role: "evidence_role", quality_pct: "quality_pct", engineering_interpretation: "engineering_interpretation", freshness_label: "freshness_label",
    },
  },
  {
    name: "part_requirement", label: "Part requirement", plural: "Part requirements", layer: "transaction", sheet: "msi_spare_requirements",
    description: "Parts a planned intervention or work order needs, by when.",
    columns: {
      intervention: { fk: "intervention", col: "intervention_id" }, work_order: { fk: "work_order", col: "work_order_id" }, decision_id: "decision_id", site: site(), asset: asset(),
      maintenance_type: { ref: "maintenance_type", col: "maintenance_type" }, part: { fk: "part", col: "part_id" }, required_qty: "required_qty", required_by: { datetime: "required_by" },
      status: "requirement_status", requirement_source: "requirement_source", source_record_id: "source_record_id", as_of: { datetime: "as_of", format: "dmy" },
    },
    copies: { asset_tag: ASSET_TAG },
  },
  {
    name: "intervention_requirement", label: "Intervention requirement", plural: "Intervention requirements", layer: "transaction", sheet: "plan_requirements",
    description: "A crew, part, tool, vehicle or permit an intervention needs before it can be scheduled.",
    columns: { intervention: { fk: "intervention", col: "intervention_id" }, requirement_type: "requirement_type", requirement_ref: "requirement_ref", quantity: "quantity", mandatory: { bool: "mandatory" }, source_record: "source" },
  },
  {
    name: "planned_outage", label: "Planned outage", plural: "Planned outages", layer: "transaction", sheet: "planned_outages",
    description: "A scheduled reduction of plant capacity.",
    columns: { site: site(), asset_scope: "asset_scope", capacity_out_mw: "capacity_out_mw", start_at: "start", end_at: "end", reason: "reason", status: { ref: "status", scope: "outage", col: "status" }, data_provenance: "data_provenance" },
  },
  {
    name: "capacity_test", label: "Capacity test", plural: "Capacity tests", layer: "transaction", sheet: "bess_capacity_tests",
    description: "A battery capacity and round-trip efficiency test.",
    columns: { bess: { fk: "asset_bess", col: "bess_id" }, test_date: "test_date", test_type: "test_type", test_standard: "test_standard", rated_power_during_test_mw: "rated_power_during_test_mw", discharged_energy_poi_mwh: "discharged_energy_poi_mwh", charged_energy_poi_mwh: "charged_energy_poi_mwh", ac_rte_pct: "ac_rte_pct", soh_energy_pct: "soh_energy_pct", ambient_temp_c: "ambient_temp_c", witness: "witness", result: "result", data_provenance: "data_provenance" },
  },
  {
    name: "hse_hours", label: "Hours worked", plural: "Hours worked", layer: "transaction", sheet: "sus_hse_hours",
    description: "Hours worked per site, period and worker type: the denominator of safety rates.",
    columns: { period: "period", site: site(), worker_type: "worker_type", hours_worked: "hours_worked", source_system: { ref: "source_system", col: "source_system" }, data_status: "data_status" },
  },
  {
    name: "ghg_activity", label: "GHG activity", plural: "GHG activity", layer: "transaction", sheet: "sus_ghg_activity",
    description: "An emissions activity record (scope, source, quantity) with the factor applied.",
    columns: {
      period: "period", site: site(), asset: asset(), ghg_scope: "ghg_scope", emission_source: "emission_source", activity_value: "activity_value", activity_unit: "activity_unit",
      source_system: { ref: "source_system", col: "source_system" }, data_status: "data_status", asset_reference_basis: "asset_reference_basis", factor_id: "factor_id", factor_value: "factor_value", factor_unit: "factor_unit", factor_resolution: "factor_resolution",
    },
    copies: { asset_class: ASSET_CLASS },
  },
  {
    name: "water_cleaning", label: "Module cleaning", plural: "Module cleaning", layer: "transaction", sheet: "sus_water_cleaning",
    description: "A module-cleaning event: water used, soiling before and after, energy recovered.",
    columns: {
      // Array designations are the cleaning crew's own (two per site, sometimes on one array asset): kept as attributes.
      event_date: "date", site: site(), array_designation: "pv_array_id", array_name: "pv_array_name", asset: asset(), cleaning_type: "cleaning_type", water_m3: "water_m3", soiling_before_pct: "soiling_before_pct",
      soiling_after_pct: "soiling_after_pct", mwh_recovered: "mwh_recovered", water_per_recovered_mwh_l: "water_per_recovered_mwh_l", source_system: { ref: "source_system", col: "source_system" }, data_status: "data_status", asset_reference_basis: "asset_reference_basis",
    },
    copies: { plant_name: PLANT_NAME, asset_class: ASSET_CLASS },
  },
  {
    name: "execution_feedback", label: "Execution feedback", plural: "Execution feedback", layer: "transaction", sheet: "plan_execution_feedback",
    description: "How executed work compared with its plan: timing and duration variance, conformance and outcome.",
    columns: { work_order: { fk: "work_order", col: "work_order_id" }, site: site(), asset: asset(), planned_start: "planned_start", actual_start: "actual_start", planned_duration_hours: "planned_duration_hours", actual_duration_hours: "actual_duration_hours", date_variance_hours: "date_variance_hours", duration_variance_pct: "duration_variance_pct", conformance_status: "conformance_status", outcome_status: "outcome_status", source_record: "source" },
  },
  {
    name: "forecast_run", label: "Forecast run", plural: "Forecast runs", layer: "transaction", sheet: "fcst_run",
    description: "One generation-forecast run per plant and horizon, with its energy totals and quality measures.",
    columns: {
      site: site(), forecast_run_timestamp: "forecast_run_timestamp", horizon_hours: "horizon_hours", forecast_start: "forecast_start", forecast_end: "forecast_end", resolution_minutes: "resolution_minutes",
      physics_forecast_mwh: "physics_forecast_mwh", hybrid_forecast_mwh: "hybrid_forecast_mwh", operational_energy_at_risk_mwh: "operational_energy_at_risk_mwh", calibrated_band_pct: "calibrated_band_pct",
      data_trust_pct: "data_trust_pct", model_reliability_n_mae_pct: "model_reliability_n_mae_pct", physics_model: { fk: "ml_model", col: "physics_model_id" }, residual_model: { fk: "ml_model", col: "residual_model_id" },
      uncertainty_model: { fk: "ml_model", col: "uncertainty_model_id" }, run_status: "run_status", source_mode: "source_mode",
    },
  },
  {
    name: "outcome_validation", label: "Outcome validation", plural: "Outcome validations", layer: "transaction", sheet: "plan_outcome_validation",
    description: "The value a completed intervention actually realised, against what was predicted.",
    columns: {
      execution_feedback: { fk: "execution_feedback", col: "execution_feedback_id" }, work_order: { fk: "work_order", col: "work_order_id" }, site: site(), asset: asset(), forecast_run_id: "forecast_run_id",
      predicted_avoided_loss_mwh: "predicted_avoided_loss_mwh", predicted_value_protected: "predicted_value_protected", actual_validated_recovery_mwh: "actual_validated_recovery_mwh", actual_value_realized: "actual_value_realized",
      execution_cost: "execution_cost", net_realized_value: "net_realized_value", realization_pct: "realization_pct", outcome_confidence_pct: "outcome_confidence_pct", variance_driver: "variance_driver",
      validation_status: "validation_status", learning_feedback_status: "learning_feedback_status", source_mode: "source_mode",
    },
  },
  {
    name: "ppa_settlement", label: "PPA settlement", plural: "PPA settlements", layer: "transaction", sheet: "commercial_and_ppa",
    description: "The current settlement position of an offtake contract: energy scheduled and delivered, penalties, invoices and receivables.",
    columns: {
      contract: { fk: "offtake_contract", col: "ppa_id" }, site: site(), scheduled_energy_mwh: "scheduled_energy_mwh", delivered_energy_mwh: "delivered_energy_mwh", deemed_generation_mwh: "deemed_generation_mwh",
      shortfall_energy_mwh: "shortfall_energy_mwh", availability_penalty: "availability_penalty", curtailment_compensation: "curtailment_compensation", invoice_amount: "invoice_amount", amount_received: "amount_received",
      receivable_balance: "receivable_balance", days_outstanding: "days_outstanding",
    },
    copies: { offtaker: { via: "contract", attr: "offtaker.name" }, ppa_tariff_k_wh: { via: "contract", attr: "tariff_per_kwh" }, contracted_capacity_mw: { via: "contract", attr: "contracted_capacity_mw" }, contract_start_date: { via: "contract", attr: "start_date" }, contract_expiry_date: { via: "contract", attr: "end_date" }, availability_obligation_pct: { via: "contract", attr: "availability_obligation_pct" }, contract_status: { via: "contract", attr: "status" } },
  },

  // ── Time series ──
  {
    name: "plant_telemetry", label: "Plant telemetry", plural: "Plant telemetry", layer: "series", sheet: "twin_telemetry",
    description: "15-minute plant measurements: irradiance, temperatures, expected and actual output, losses.",
    columns: {
      at: "timestamp", site: site(), poa_wm2: "poa_wm2", ghi_wm2: "ghi_wm2", ambient_temp_c: "ambient_temp_c", module_temp_c: "module_temp_c", wind_speed_ms: "wind_speed_ms", soiling_ratio: "soiling_ratio",
      expected_dc_mw: "expected_dc_mw", expected_ac_mw: "expected_ac_mw", actual_ac_mw: "actual_ac_mw", pr_pct: "pr_pct", availability_pct: "availability_pct", inverter_efficiency_pct: "inverter_efficiency_pct",
      grid_frequency_hz: "grid_frequency_hz", power_factor: "power_factor", data_quality_pct: "data_quality_pct", source_record: "source", clear_sky_poa_wm2: "clear_sky_poa_wm2", cloud_cover_pct: "cloud_cover_pct",
      cloud_transmittance_pct: "cloud_transmittance_pct", clear_sky_ac_potential_mw: "clear_sky_ac_potential_mw", weather_adjusted_expected_ac_mw: "weather_adjusted_expected_ac_mw", weather_loss_mw: "weather_loss_mw",
      plant_operational_loss_mw: "plant_operational_loss_mw", curtailment_pct: "curtailment_pct", asset_health_score: "asset_health_score", weather_source: "weather_source", weather_mode: "weather_mode", data_provenance: "data_provenance",
    },
  },
  {
    name: "inverter_reading", label: "Inverter telemetry", plural: "Inverter telemetry", layer: "series", sheet: "inverter_telemetry",
    description: "Per-inverter measurements: DC and AC power, voltage, current, temperature, status and alarms.",
    columns: { at: "timestamp", site: site(), asset: asset(), dc_power_mw: "dc_power_mw", ac_power_mw: "ac_power_mw", dc_voltage_v: "dc_voltage_v", dc_current_a: "dc_current_a", inverter_temp_c: "inverter_temp_c", status: { ref: "status", scope: "telemetry_state", col: "status" }, alarm_code: "alarm_code", data_provenance: "data_provenance" },
    copies: { inverter_tag: ASSET_TAG },
  },
  {
    name: "bess_reading", label: "BESS telemetry", plural: "BESS telemetry", layer: "series", sheet: "bess_telemetry",
    description: "Battery measurements at the point of interconnection: power, state of charge, temperatures, mode.",
    columns: {
      at: "timestamp", bess: { fk: "asset_bess", col: "bess_id" }, site: site(), charge_mw_poi: "charge_mw_poi", discharge_mw_poi: "discharge_mw_poi", charge_source: "charge_source", dispatch_schedule_mw: "dispatch_schedule_mw",
      available_mw: "available_mw", so_c_pct: "so_c_pct", aux_load_mw: "aux_load_mw", cell_temp_max_c: "cell_temp_max_c", cell_temp_avg_c: "cell_temp_avg_c", ambient_temp_c: "ambient_temp_c",
      co_located_pv_mw: "co_located_pv_mw", operating_mode: "operating_mode", data_quality_pct: "data_quality_pct", data_provenance: "data_provenance",
    },
  },
  {
    name: "bess_day", label: "BESS daily operations", plural: "BESS daily operations", layer: "series", sheet: "bess_daily_operations",
    description: "Daily battery energy balance, cycles, availability and temperatures.",
    columns: {
      day: "date", bess: { fk: "asset_bess", col: "bess_id" }, site: site(), charge_mwh_poi: "charge_mwh_poi", discharge_mwh_poi: "discharge_mwh_poi", aux_mwh: "aux_mwh", start_so_c_pct: "start_so_c_pct", end_so_c_pct: "end_so_c_pct",
      equivalent_full_cycles: "equivalent_full_cycles", availability_pct: "availability_pct", scheduled_discharge_mwh: "scheduled_discharge_mwh", max_cell_temp_c: "max_cell_temp_c", cumulative_discharge_mwh_since_cod: "cumulative_discharge_mwh_since_cod", data_provenance: "data_provenance",
    },
  },
  {
    name: "weather_forecast", label: "Weather forecast", plural: "Weather forecasts", layer: "series", sheet: "forecast_weather",
    description: "Numerical weather prediction per plant and interval feeding the generation forecast.",
    columns: { site: site(), forecast_run_timestamp: "forecast_run_timestamp", interval_start: "interval_start", lead_hours: "lead_hours", clear_sky_index: "clear_sky_index", cloud_cover_pct: "cloud_cover_pct", ambient_temp_c: "ambient_temp_c", wind_speed_ms: "wind_speed_ms", forecast_curtailment_pct: "forecast_curtailment_pct", nwp_source: "nwp_source", data_provenance: "data_provenance" },
  },
  {
    name: "forecast_interval", label: "Forecast interval", plural: "Forecast intervals", layer: "series", sheet: "fcst_interval",
    description: "The generation forecast per plant and 15-minute interval, step by step through the physics chain.",
    columns: {
      forecast_run_timestamp: "forecast_run_timestamp", site: site(), interval_start: "interval_start", interval_minutes: "interval_minutes", lead_hours: "lead_hours", clear_sky_poa_wm2: "clear_sky_poa_wm2", forecast_poa_wm2: "forecast_poa_wm2",
      cloud_cover_pct: "cloud_cover_pct", ambient_temp_c: "ambient_temp_c", wind_speed_ms: "wind_speed_ms", soiling_pct: "soiling_pct", availability_pct: "availability_pct", curtailment_pct: "curtailment_pct",
      asset_health_score: "asset_health_score", clear_sky_ac_potential_mw: "clear_sky_ac_potential_mw", weather_adjusted_physics_mw: "weather_adjusted_physics_mw", after_availability_mw: "after_availability_mw",
      after_curtailment_mw: "after_curtailment_mw", after_asset_state_mw: "after_asset_state_mw", ml_residual_pct: "ml_residual_pct", ml_residual_correction_mw: "ml_residual_correction_mw", forecast_delivered_mw: "forecast_delivered_mw",
      uncertainty_pct: "uncertainty_pct", forecast_lower_mw: "forecast_lower_mw", forecast_upper_mw: "forecast_upper_mw", model: { fk: "ml_model", col: "model_id" }, physics_model_version: "physics_model_version",
      residual_model_version: "residual_model_version", data_source: "data_source", uncertainty_method: "uncertainty_method",
    },
  },
  {
    name: "plant_actual", label: "Metered output", plural: "Metered output", layer: "series", sheet: "fcst_actual",
    description: "Metered plant output per interval, with observed irradiance, availability and curtailment.",
    columns: { site: site(), interval_start: "interval_start", actual_ac_mw: "actual_ac_mw", actual_energy_mwh: "actual_energy_mwh", observed_poa_wm2: "observed_poa_wm2", actual_availability_pct: "actual_availability_pct", actual_curtailment_pct: "actual_curtailment_pct", data_quality_status: "data_quality_status", source_system: { ref: "source_system", col: "source_system" }, source_mode: "source_mode" },
  },
  {
    name: "forecast_validation", label: "Forecast validation", plural: "Forecast validations", layer: "series", sheet: "fcst_validation",
    description: "Physics and hybrid forecasts against the metered outcome, per run and interval.",
    columns: {
      forecast_run_code: "forecast_run_id", site: site(), interval_start: "interval_start", lead_hours: "lead_hours", physics_forecast_mw: "physics_forecast_mw", hybrid_forecast_mw: "hybrid_forecast_mw", actual_mw: "actual_mw",
      physics_error_mw: "physics_error_mw", hybrid_error_mw: "hybrid_error_mw", physics_abs_error_pct: "physics_abs_error_pct", hybrid_abs_error_pct: "hybrid_abs_error_pct", inside_80_pct_band: "inside_80_pct_band",
      horizon_bucket_hours: "horizon_bucket_hours", validation_mode: "validation_mode",
    },
  },
  {
    name: "life_observation", label: "Life observation", plural: "Life observations", layer: "series", sheet: "reliability_life_history",
    description: "One life record (failure or survival to date) of an asset or a serialised PV module, for reliability models.",
    columns: {
      asset_code: "asset_id", site: site(), failure_mode: { ref: "failure_mode", col: "failure_mode", nullTokens: ["No confirmed functional failure"] }, commissioned_date: "commissioned_date",
      observation_date: "observation_date", operating_hours: "operating_hours", event_type: { ref: "event_type", scope: "reliability", col: "event_type" }, failed_surviving: "failed_surviving", right_censored: "right_censored",
      replacement_reset: "replacement_reset", evidence_source: "evidence_source", source_mode: "source_mode", data_quality_status: "data_quality_status", module_group: { fk: "pv_module_group", col: "group_id" },
      pv_module: { fk: "pv_module", col: "module_id" }, observation_basis: "observation_basis", calendar_exposure_hours: "calendar_exposure_hours", equipment_model: { fk: "equipment_model", col: "model_id" },
      batch_id: "batch_id", evidence_reference: "evidence_reference", failure_criterion: "failure_criterion", data_basis: "data_basis", asset_tag: "asset_tag", asset_class: { ref: "asset_class", col: "asset_class" },
    },
  },
  {
    name: "resource_event", label: "Resource calendar event", plural: "Resource calendar", layer: "series", sheet: "plan_resource_calendar",
    description: "Availability and commitments of technicians, vehicles and tools by day.",
    columns: { resource_type: "resource_type", resource_code: "resource_id", site: site(), start_at: "start", end_at: "end", event_type: { ref: "event_type", scope: "resource_calendar", col: "event_type" }, availability: "availability", available_hours: "available_hours", committed_hours: "committed_hours", capacity_pct: "capacity_pct", skill_or_certification: "skill_or_certification", location: "location", reason: "reason", source_record: "source" },
  },
  {
    name: "site_weather", label: "Site work-weather forecast", plural: "Site work-weather forecasts", layer: "series", sheet: "plan_weather_forecast",
    description: "Hourly site weather for planning: rain, wind, lightning and the work permissions they allow.",
    columns: {
      site: site(), forecast_time: "forecast_time", valid_from: "valid_from", valid_to: "valid_to", rain_probability_pct: "rain_probability_pct", rainfall_mm: "rainfall_mm", wind_kmh: "wind_kmh", gust_kmh: "gust_kmh",
      lightning_risk: "lightning_risk", temperature_c: "temperature_c", visibility_km: "visibility_km", work_at_height_status: "work_at_height_status", outdoor_electrical_status: "outdoor_electrical_status",
      access_status: "access_status", freshness_status: "freshness_status", source_system: { ref: "source_system", col: "source_system" }, source_mode: "source_mode", evidence_id: "evidence_id",
    },
  },
];

/** Entities a record link may join, and the model table holding each. */
export const LINK_ENTITIES: Record<string, string> = {
  intervention: "intervention",
  work_order: "work_order",
  vision_finding: "vision_finding",
  hse_incident: "hse_incident",
  cbm_assessment: "cbm_assessment",
  alert: "alert",
  recommendation: "recommendation",
  event: "event",
};

/**
 * The cross-module link ledger: process hops that a single foreign key cannot express (one finding raising several
 * work orders, an intervention executed by a work order planned elsewhere). Agents and applied proposals add to it.
 */
export function recordLinkDef(): MasterDef {
  const link = (from: string, fromCode: unknown, type: string, to: string, toCode: unknown, extra: Record<string, unknown>, table: string, key: string): MasterRow | null => {
    const f = fromCode === null || fromCode === undefined ? "" : String(fromCode).trim();
    const t = toCode === null || toCode === undefined ? "" : String(toCode).trim();
    if (!f || !t) return null;
    return { code: `${from}:${f}>${type}>${to}:${t}`, values: { from_entity: from, from_code: f, link_type: type, to_entity: to, to_code: t, ...extra }, lineage: [{ table, key, role: "derived" }] };
  };
  return {
    name: "record_link", label: "Record link", plural: "Record links", layer: "transaction",
    description: "One hop of the decision loop between records of different modules (finding → work order, intervention → work order, …).",
    replaces: [], owns: [],
    columns: [
      { name: "from_entity", label: "From", kind: "text" }, { name: "from_code", label: "From code", kind: "text" }, { name: "link_type", label: "Link", kind: "text" },
      { name: "to_entity", label: "To", kind: "text" }, { name: "to_code", label: "To code", kind: "text" }, { name: "linked_at", label: "Linked at", kind: "datetime" },
      { name: "status", label: "Status", kind: "text" }, { name: "source_record", label: "Source", kind: "text", maxLength: 1000 }, { name: "response_time_hours", label: "Response time (h)", kind: "decimal", precision: 2 },
    ],
    build: (ctx) => {
      const out = new Map<string, MasterRow>();
      const add = (r: MasterRow | null) => {
        if (r && !out.has(r.code)) out.set(r.code, r);
      };
      for (const t of ["pno_interventions", "plan_interventions"]) for (const r of ctx.rows(t)) add(link("intervention", r.intervention_id, "executed_by", "work_order", r.work_order_id, { source_record: t }, t, r.__key));
      for (const r of ctx.rows("vision_work_order_link")) add(link("vision_finding", r.finding_id, "raised", "work_order", r.work_order_id, { linked_at: isoDateTime(r.link_date_time), status: r.link_status, source_record: r.source_system, response_time_hours: r.response_time_hours }, "vision_work_order_link", r.__key));
      for (const r of ctx.rows("sus_hse_events")) add(link("hse_incident", r.event_id, "occurred_during", "work_order", r.work_order_id, { source_record: "sus_hse_events" }, "sus_hse_events", r.__key));
      for (const r of ctx.rows("cbm_assessments")) add(link("cbm_assessment", r.cbm_assessment_id, "raised", "work_order", r.work_order_id, { source_record: "cbm_assessments" }, "cbm_assessments", r.__key));
      return [...out.values()];
    },
  };
}

/** Phase 3 definitions in dependency-friendly order (topoOrder sorts them with the masters). */
export function transactionDefs(reg: Registry): MasterDef[] {
  return [...SHEET_SPECS.map((s) => specDef(reg, s)), recordLinkDef()];
}

/** Links whose ends do not exist in their tables (the gate requires none). */
export function linkProblems(rows: MasterRow[], codes: Map<string, Set<string>>): Array<{ link: string; end: string }> {
  const out: Array<{ link: string; end: string }> = [];
  for (const r of rows) {
    for (const [e, c] of [[r.values.from_entity, r.values.from_code], [r.values.to_entity, r.values.to_code]] as const) {
      const table = LINK_ENTITIES[String(e)];
      if (!table || !codes.get(table)?.has(String(c))) out.push({ link: r.code, end: `${String(e)}:${String(c)}` });
    }
  }
  return out;
}

export const specFor = (name: string) => SHEET_SPECS.find((s) => s.name === name);
export const sheetTable = (reg: Registry, s: SheetSpec): TableDef => reg.tables.find((t) => t.name === s.sheet)!;
