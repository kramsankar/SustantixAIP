import {
  applyCorrections,
  correctionLogPlan,
  correctionLogRecords,
  dataModelPlan,
  dataverseRecord,
  platformPlan,
  readSheets,
  referencePlan,
  referenceRecords,
  type CorrectionSet,
  type Registry,
  type Vocabulary,
} from "@sustantix/schema";
import {
  GUARD_TYPE,
  ROLES,
  STATUS_TYPE,
  ensureCurrencies,
  ensureEnvironmentVariables,
  ensureGuardSteps,
  ensureLicenseApi,
  ensurePluginAssembly,
  ensurePluginType,
  ensurePublisher,
  ensureRole,
  ensureSolution,
  ensureTable,
  entitySetName,
  grantPrivileges,
  publishAll,
  rolePrivileges,
  whoAmI,
  type Log,
} from "./steps.ts";
import type { WebApi } from "./webapi.ts";

export interface ProvisionOptions {
  version: string;
  registry: Registry;
  pluginDll: Buffer;
  /** Create the 107 governed data-model tables (in addition to the platform tables). */
  dataModel: boolean;
  /** Guard every data-model table with the license plug-in (platform tables are always guarded). */
  guardDataModel: boolean;
  /** Load the governed workbook rows into the data-model tables. */
  seedWorkbook?: Buffer;
  /** Controlled vocabulary: creates the reference tables and upserts the platform codes and aliases. */
  vocabulary?: Vocabulary;
  /** Governed data corrections applied to the seed, with a per-record log (sus_datacorrection). */
  corrections?: CorrectionSet;
  fx: Record<string, number>;
}

export interface ProvisionReport {
  organizationId: string;
  solution: string;
  version: string;
  tables: number;
  guardStepsCreated: number;
  seeded: Record<string, number>;
  referenceRecords: number;
  correctedRecords: number;
  seedFailures: Array<{ table: string; key: string; status: number; message: string }>;
}

export async function provision(api: WebApi, o: ProvisionOptions, log: Log): Promise<ProvisionReport> {
  const me = await whoAmI(api);
  log(`organisation ${me.OrganizationId} · business unit ${me.BusinessUnitId}`);

  const publisherId = await ensurePublisher(api, log);
  await ensureSolution(api, publisherId, o.version, log);

  const moneyCodes = o.dataModel ? o.registry.tables.flatMap((t) => t.columns).filter((c) => c.kind === "money").map((c) => c.currency ?? o.registry.defaultCurrency) : [];
  const currencies = moneyCodes.length ? await ensureCurrencies(api, moneyCodes, o.fx, log) : {};

  const platform = platformPlan();
  const model = o.dataModel ? dataModelPlan(o.registry) : [];
  const reference = [...(o.vocabulary ? referencePlan(o.vocabulary) : []), ...(o.corrections ? [correctionLogPlan()] : [])];
  for (const p of [...platform, ...reference, ...model]) await ensureTable(api, p, log);

  await ensureEnvironmentVariables(api, log);

  const assemblyId = await ensurePluginAssembly(api, o.pluginDll, o.version, log);
  const guardId = await ensurePluginType(api, assemblyId, GUARD_TYPE, log);
  const statusId = await ensurePluginType(api, assemblyId, STATUS_TYPE, log);
  await ensureLicenseApi(api, statusId, log);

  const guarded = ["sus_runtimestate", ...(o.guardDataModel ? [...reference, ...model].map((m) => m.logicalName) : [])];
  const guardStepsCreated = await ensureGuardSteps(api, guardId, guarded, log);

  const privileges = rolePrivileges([...reference, ...model].map((m) => m.logicalName));
  const userRole = await ensureRole(api, ROLES.user, me.BusinessUnitId, log);
  await grantPrivileges(api, userRole, me.BusinessUnitId, privileges.user, log);
  const adminRole = await ensureRole(api, ROLES.admin, me.BusinessUnitId, log);
  await grantPrivileges(api, adminRole, me.BusinessUnitId, privileges.admin, log);

  await publishAll(api, log);

  let referenceCount = 0;
  if (o.vocabulary) {
    for (const { logicalName, records } of referenceRecords(o.vocabulary)) {
      if (!records.length) continue;
      const set = await entitySetName(api, logicalName);
      for (let i = 0; i < records.length; i += 200) {
        const failures = await api.batchUpsert(set, "sus_name", records.slice(i, i + 200));
        if (failures.length) throw new Error(`reference upsert into ${logicalName} failed: ${failures[0]!.message}`);
      }
      referenceCount += records.length;
    }
    log(`  ⇪ ${referenceCount} reference code(s) and alias(es)`);
  }

  const seeded: Record<string, number> = {};
  const seedFailures: ProvisionReport["seedFailures"] = [];
  let correctedRecords = 0;
  if (o.seedWorkbook && o.dataModel) {
    const raw = readSheets(o.seedWorkbook);
    const { sheets, entries: derived } = o.corrections ? applyCorrections(o.registry, raw, o.corrections) : { sheets: raw, entries: [] };
    if (o.corrections && derived.length) {
      const set = await entitySetName(api, "sus_datacorrection");
      const records = correctionLogRecords(o.corrections, derived);
      for (let i = 0; i < records.length; i += 200) {
        const failures = await api.batchUpsert(set, "sus_name", records.slice(i, i + 200));
        seedFailures.push(...failures.map((f) => ({ table: "sus_datacorrection", ...f })));
      }
      correctedRecords = derived.length;
      log(`  ⇪ ${derived.length} corrected record(s) logged`);
    }
    for (const p of model) {
      const t = p.source!;
      const rows = sheets[t.sheet] ?? [];
      if (!rows.length) continue;
      const set = await entitySetName(api, p.logicalName);
      const records = rows.map((r, i) => dataverseRecord(t, r, i, currencies));
      for (let i = 0; i < records.length; i += 200) {
        const failures = await api.batchUpsert(set, "sus_name", records.slice(i, i + 200));
        seedFailures.push(...failures.map((f) => ({ table: p.logicalName, ...f })));
      }
      seeded[p.logicalName] = records.length;
      log(`  ⇪ ${records.length} row(s) → ${p.logicalName}`);
    }
  }

  return {
    organizationId: me.OrganizationId,
    solution: "SustantixAIP",
    version: o.version,
    tables: platform.length + reference.length + model.length,
    guardStepsCreated,
    seeded,
    referenceRecords: referenceCount,
    correctedRecords,
    seedFailures,
  };
}
