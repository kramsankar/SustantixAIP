/**
 * The governed workbook as a TenantSource: masters built by phase 2, sheet rows after the governed corrections,
 * values resolved with the controlled vocabulary. Used by the back-test CLI and the tests.
 */
import { MasterContext, Resolver, applyCorrections, buildMasters, type CorrectionSet, type MasterBuild, type Registry, type SourceRow, type Vocabulary } from "@sustantix/schema";
import type { AnalyticsDataset } from "../portfolio.ts";
import { buildDataset, type TenantSource } from "./dataset.ts";

export function workbookSource(reg: Registry, raw: Record<string, SourceRow[]>, vocab: Vocabulary, corrections: CorrectionSet): { source: TenantSource; masters: MasterBuild } {
  const masters = buildMasters(reg, raw, vocab, corrections);
  if (masters.issues.length) throw new Error(`masters have ${masters.issues.length} problem(s)`);
  const { sheets } = applyCorrections(reg, raw, corrections);
  const ctx = new MasterContext(reg, sheets);
  const resolver = new Resolver(vocab);
  return {
    masters,
    source: {
      currency: reg.defaultCurrency,
      master: (name) => {
        const m = masters.masters.find((x) => x.def.name === name);
        if (!m) throw new Error(`unknown master ${name}`);
        return m.rows;
      },
      rows: (t) => ctx.rows(t),
      resolve: (column, ref, value) => {
        const r = resolver.resolve({ column, ref }, value);
        return r.status === "code" ? r.code : null;
      },
    },
  };
}

export function workbookDataset(reg: Registry, raw: Record<string, SourceRow[]>, vocab: Vocabulary, corrections: CorrectionSet, asOf = "2026-09-30T00:00:00"): { dataset: AnalyticsDataset; masters: MasterBuild } {
  const { source, masters } = workbookSource(reg, raw, vocab, corrections);
  return { dataset: buildDataset(source, asOf), masters };
}
