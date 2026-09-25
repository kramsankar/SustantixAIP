import { dataModelPlan, dataverseRecord, platformPlan, readSheets, type Registry } from "@sustantix/schema";
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
  fx: Record<string, number>;
}

export interface ProvisionReport {
  organizationId: string;
  solution: string;
  version: string;
  tables: number;
  guardStepsCreated: number;
  seeded: Record<string, number>;
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
  for (const p of [...platform, ...model]) await ensureTable(api, p, log);

  await ensureEnvironmentVariables(api, log);

  const assemblyId = await ensurePluginAssembly(api, o.pluginDll, o.version, log);
  const guardId = await ensurePluginType(api, assemblyId, GUARD_TYPE, log);
  const statusId = await ensurePluginType(api, assemblyId, STATUS_TYPE, log);
  await ensureLicenseApi(api, statusId, log);

  const guarded = ["sus_runtimestate", ...(o.dataModel && o.guardDataModel ? model.map((m) => m.logicalName) : [])];
  const guardStepsCreated = await ensureGuardSteps(api, guardId, guarded, log);

  const privileges = rolePrivileges(model.map((m) => m.logicalName));
  const userRole = await ensureRole(api, ROLES.user, me.BusinessUnitId, log);
  await grantPrivileges(api, userRole, me.BusinessUnitId, privileges.user, log);
  const adminRole = await ensureRole(api, ROLES.admin, me.BusinessUnitId, log);
  await grantPrivileges(api, adminRole, me.BusinessUnitId, privileges.admin, log);

  await publishAll(api, log);

  const seeded: Record<string, number> = {};
  const seedFailures: ProvisionReport["seedFailures"] = [];
  if (o.seedWorkbook && o.dataModel) {
    const sheets = readSheets(o.seedWorkbook);
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
    tables: platform.length + model.length,
    guardStepsCreated,
    seeded,
    seedFailures,
  };
}
