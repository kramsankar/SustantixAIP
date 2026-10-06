import {
  agentsPlan,
  changeSetPlan,
  analyticsPlan,
  applyCorrections,
  buildMasters,
  correctionLogPlan,
  correctionLogRecords,
  dataModelPlan,
  dataverseRecord,
  masterDefs,
  masterLineageRecords,
  masterPlan,
  masterRecords,
  masterRelationships,
  platformPlan,
  readSheets,
  transactionDefs,
  referencePlan,
  referenceRecords,
  type CorrectionSet,
  type Registry,
  type Vocabulary,
} from "@sustantix/schema";
import {
  GUARD_TYPE,
  CHANGESET_TYPE,
  ensureChangeSetApi,
  ROLES,
  STATUS_TYPE,
  ensureCurrencies,
  ensureEnvironmentVariables,
  ensureGuardSteps,
  ensureLicenseApi,
  ensurePluginAssembly,
  ensurePluginType,
  ensurePublisher,
  ensureRelationship,
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
  /** Guard every data-model table with the license plug-in (platform tables are always guarded); see guardDataModelFlag. */
  guardDataModel: boolean;
  /** Load the governed workbook rows into the data-model tables. */
  seedWorkbook?: Buffer;
  /** Controlled vocabulary: creates the reference tables and upserts the platform codes and aliases. */
  vocabulary?: Vocabulary;
  /** Governed data corrections applied to the seed, with a per-record log (sus_datacorrection). */
  corrections?: CorrectionSet;
  /** Phase 2 masters and consolidated registers (needs the vocabulary): tables, lookups and, with a seed, their rows. */
  masters?: boolean;
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
  relationshipsCreated: number;
  masterRecords: number;
  seedFailures: Array<{ table: string; key: string; status: number; message: string }>;
}

export async function provision(api: WebApi, o: ProvisionOptions, log: Log): Promise<ProvisionReport> {
  const me = await whoAmI(api);
  log(`organisation ${me.OrganizationId} · business unit ${me.BusinessUnitId}`);

  const publisherId = await ensurePublisher(api, log);
  await ensureSolution(api, publisherId, o.version, log);

  if (o.masters && (!o.vocabulary || !o.corrections)) throw new Error("masters need the vocabulary and the corrections");
  const moneyCodes = o.dataModel || o.masters ? o.registry.tables.flatMap((t) => t.columns).filter((c) => c.kind === "money").map((c) => c.currency ?? o.registry.defaultCurrency) : [];
  const currencies = moneyCodes.length ? await ensureCurrencies(api, moneyCodes, o.fx, log) : {};

  const platform = platformPlan();
  const model = o.dataModel ? dataModelPlan(o.registry) : [];
  const reference = [...(o.vocabulary ? referencePlan(o.vocabulary) : []), ...(o.corrections ? [correctionLogPlan()] : [])];
  const masterNames = masterDefs(o.registry).map((d) => d.name);
  const masters = o.masters
    ? [...masterPlan(masterDefs(o.registry)), ...masterPlan(transactionDefs(o.registry), { lineage: false, external: masterNames }), ...analyticsPlan(), ...agentsPlan(), changeSetPlan()]
    : [];
  for (const p of [...platform, ...reference, ...masters, ...model]) await ensureTable(api, p, log);
  let relationshipsCreated = 0;
  // Lookups after every table exists: masters reference each other and the reference tables.
  for (const rel of o.masters ? [...masterRelationships(masterDefs(o.registry)), ...masterRelationships(transactionDefs(o.registry), masterNames)] : []) if (await ensureRelationship(api, rel, log)) relationshipsCreated++;

  await ensureEnvironmentVariables(api, log);

  const assemblyId = await ensurePluginAssembly(api, o.pluginDll, o.version, log);
  const guardId = await ensurePluginType(api, assemblyId, GUARD_TYPE, log);
  const statusId = await ensurePluginType(api, assemblyId, STATUS_TYPE, log);
  await ensureLicenseApi(api, statusId, log);
  // Phase 4: the change-set API writes the governed tables, so it ships with them.
  if (o.masters) await ensureChangeSetApi(api, await ensurePluginType(api, assemblyId, CHANGESET_TYPE, log), log);

  const guarded = ["sus_runtimestate", ...(o.guardDataModel ? [...reference, ...masters, ...model].map((m) => m.logicalName) : [])];
  const guardStepsCreated = await ensureGuardSteps(api, guardId, guarded, log);

  const privileges = rolePrivileges([...reference, ...masters, ...model].map((m) => m.logicalName));
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

  let masterCount = 0;
  if (o.masters && o.seedWorkbook) {
    const built = buildMasters(o.registry, readSheets(o.seedWorkbook), o.vocabulary!, o.corrections);
    if (built.issues.length) throw new Error(`masters have ${built.issues.length} problem(s); run check:data`);
    const sets = new Map<string, string>();
    const setOf = async (ln: string) => sets.get(ln) ?? sets.set(ln, await entitySetName(api, ln)).get(ln)!;
    for (const p of [...(o.vocabulary ? referencePlan(o.vocabulary) : []), ...masters]) await setOf(p.logicalName);
    const currencyId = currencies[o.registry.defaultCurrency];
    const recordSets = masterRecords(built.masters, o.vocabulary!, (ln) => sets.get(ln) ?? (() => { throw new Error(`no entity set for ${ln}`); })(), currencyId);
    // Rows in dependency order, then self-references (an asset's parent) once every row exists.
    for (const pass of ["records", "links"] as const) {
      for (const rs of recordSets) {
        const rows = rs[pass];
        for (let i = 0; i < rows.length; i += 200) {
          const failures = await api.batchUpsert(sets.get(rs.logicalName)!, "sus_name", rows.slice(i, i + 200));
          seedFailures.push(...failures.map((f) => ({ table: rs.logicalName, ...f })));
        }
        if (pass === "records") masterCount += rows.length;
      }
    }
    const lineage = masterLineageRecords(built.masters);
    const lset = await setOf("sus_masterlineage");
    for (let i = 0; i < lineage.length; i += 200) {
      const failures = await api.batchUpsert(lset, "sus_name", lineage.slice(i, i + 200));
      seedFailures.push(...failures.map((f) => ({ table: "sus_masterlineage", ...f })));
    }
    log(`  ⇪ ${masterCount} master row(s), ${lineage.length} lineage row(s)`);
  }

  return {
    organizationId: me.OrganizationId,
    solution: "SustantixAIP",
    version: o.version,
    tables: platform.length + reference.length + masters.length + model.length,
    guardStepsCreated,
    seeded,
    referenceRecords: referenceCount,
    correctedRecords,
    relationshipsCreated,
    masterRecords: masterCount,
    seedFailures,
  };
}

/**
 * The --guard-data-model switch. The guard is what blocks AIP data once a license is missing, expired or revoked, so
 * every table the roles can reach is guarded unless an operator explicitly passes --guard-data-model false.
 */
export const guardDataModelFlag = (value: string | undefined): boolean => value !== "false";
