/** What each proposal type must contain. Agents fill these; people decide them. */
import { z } from "zod";

const code = z.string().min(1).max(200);
const day = z.iso.date();
const priority = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export const PAYLOADS = {
  intervention: z.object({ asset: code, maintenance_type: z.enum(["CORRECTIVE", "PREVENTIVE", "PREDICTIVE", "CONDITION_BASED", "RISK_BASED"]), description: z.string().min(5).max(1000), priority, required_by: day.optional(), duration_hours: z.number().positive().max(720).optional(), required_skill: z.string().max(60).optional() }).strict(),
  inspection: z.object({ asset: code, description: z.string().min(5).max(1000), priority, required_by: day.optional(), duration_hours: z.number().positive().max(720).optional() }).strict(),
  intervention_update: z.object({ intervention: code, changes: z.object({ planned_start: z.iso.datetime({ local: true }).optional(), planned_finish: z.iso.datetime({ local: true }).optional(), priority: priority.optional() }).strict().refine((c) => Object.keys(c).length > 0, "at least one change"), expected_benefit: z.string().min(5).max(1000) }).strict(),
  purchase_requisition: z.object({ part: code, site: code, quantity: z.number().int().positive().max(100000), need_by: day }).strict(),
  stock_transfer: z.object({ part: code, from_site: code, to_site: code, quantity: z.number().int().positive().max(100000) }).strict().refine((t) => t.from_site !== t.to_site, "source and destination differ"),
  warranty_claim: z.object({ warranty: code, asset: code.optional(), claim_basis: z.string().min(5).max(2000), evidence_missing: z.array(z.string().max(200)).max(20) }).strict(),
  data_correction_request: z.object({ master: z.string().regex(/^[a-z_]+$/), code, field: z.string().regex(/^[a-z_0-9]+$/), current_value: z.unknown(), proposed_value: z.unknown() }).strict(),
  disclosure_draft: z.object({ framework: z.string().min(2).max(40), disclosures: z.array(z.object({ disclosure_id: z.string().max(60), metric: code, value: z.number().optional(), unit: z.string().max(40).optional(), source: z.string().max(200).optional() }).strict()).min(1).max(100), gaps: z.array(z.string().max(300)).max(50) }).strict(),
  notification: z.object({ audience: z.string().min(2).max(100), message: z.string().min(5).max(2000) }).strict(),
} as const;

export type ProposalType = keyof typeof PAYLOADS;
export const PROPOSAL_TYPES = Object.keys(PAYLOADS) as ProposalType[];

/** The master a proposal's subject must exist in, by type. */
export const SUBJECT_MASTER: Record<ProposalType, string | null> = {
  intervention: "asset",
  inspection: "asset",
  intervention_update: "intervention",
  purchase_requisition: "part",
  stock_transfer: "part",
  warranty_claim: "warranty_contract",
  data_correction_request: null,
  disclosure_draft: null,
  notification: null,
};

export const EvidenceSchema = z.array(z.object({ source: z.string().min(1).max(200), detail: z.string().min(1).max(500) }).strict()).min(1).max(20);
