import { lbl, type EntityPlan } from "@sustantix/schema";
import { odataString, type WebApi } from "./webapi.ts";

export const PUBLISHER = { uniquename: "sustantix", friendlyname: "Sustantix", prefix: "sus", optionPrefix: 60451 };
export const SOLUTION = { uniquename: "SustantixAIP", friendlyname: "Sustantix Asset Intelligence Platform" };
export const ASSEMBLY = "Sustantix.Aip.Licensing";
export const GUARD_TYPE = "Sustantix.Aip.Licensing.Plugins.LicenseGuard";
export const STATUS_TYPE = "Sustantix.Aip.Licensing.Plugins.GetLicenseStatus";
export const LICENSE_API = "sus_GetLicenseStatus";
export const GUARD_MESSAGES = ["Create", "Update", "Delete", "Retrieve", "RetrieveMultiple"] as const;
export const ENV_VARS = [
  { schemaname: "sus_LicenseKey", displayname: "Sustantix AIP license key", description: "Signed SXL1 license issued by Sustantix for this environment." },
  { schemaname: "sus_LicenseRevocationList", displayname: "Sustantix AIP revocation list", description: "Optional signed SXR1 revocation list distributed by Sustantix." },
];
export const ROLES = {
  user: "Sustantix AIP User",
  admin: "Sustantix AIP Administrator",
};

export type Log = (msg: string) => void;

export interface WhoAmI {
  OrganizationId: string;
  BusinessUnitId: string;
  UserId: string;
}

export async function whoAmI(api: WebApi): Promise<WhoAmI> {
  const r = await api.get<WhoAmI>("WhoAmI");
  if (!r?.OrganizationId) throw new Error("WhoAmI returned no organisation id");
  return r;
}

export async function ensurePublisher(api: WebApi, log: Log): Promise<string> {
  const found = await api.first<{ publisherid: string; customizationprefix: string }>("publishers", `uniquename eq '${PUBLISHER.uniquename}'`, ["publisherid", "customizationprefix"]);
  if (found) {
    if (found.customizationprefix !== PUBLISHER.prefix) throw new Error(`publisher ${PUBLISHER.uniquename} exists with prefix ${found.customizationprefix}`);
    log(`✓ publisher ${PUBLISHER.uniquename}`);
    return found.publisherid;
  }
  const id = await api.create("publishers", {
    uniquename: PUBLISHER.uniquename,
    friendlyname: PUBLISHER.friendlyname,
    customizationprefix: PUBLISHER.prefix,
    customizationoptionvalueprefix: PUBLISHER.optionPrefix,
    description: "Sustantix — Asset Intelligence Platform publisher",
  });
  log(`+ publisher ${PUBLISHER.uniquename}`);
  return id ?? (await ensurePublisher(api, () => {}));
}

export async function ensureSolution(api: WebApi, publisherId: string, version: string, log: Log): Promise<string> {
  const found = await api.first<{ solutionid: string; version: string }>("solutions", `uniquename eq '${SOLUTION.uniquename}'`, ["solutionid", "version"]);
  if (found) {
    if (found.version !== version) {
      await api.update(`solutions(${found.solutionid})`, { version });
      log(`↑ solution ${SOLUTION.uniquename} ${found.version} → ${version}`);
    } else log(`✓ solution ${SOLUTION.uniquename} ${version}`);
    return found.solutionid;
  }
  const id = await api.create("solutions", {
    uniquename: SOLUTION.uniquename,
    friendlyname: SOLUTION.friendlyname,
    version,
    description: "Sustantix Asset Intelligence Platform — confidential. © Sustantix.",
    "publisherid@odata.bind": `/publishers(${publisherId})`,
  });
  log(`+ solution ${SOLUTION.uniquename} ${version}`);
  return id ?? (await ensureSolution(api, publisherId, version, () => {}));
}

/** Returns ISO code → transactioncurrencyid, creating missing currencies when an FX rate to base is supplied. */
export async function ensureCurrencies(api: WebApi, codes: string[], fx: Record<string, number>, log: Log): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const code of [...new Set(codes)]) {
    const found = await api.first<{ transactioncurrencyid: string }>("transactioncurrencies", `isocurrencycode eq '${code}'`, ["transactioncurrencyid"]);
    if (found) {
      out[code] = found.transactioncurrencyid;
      log(`✓ currency ${code}`);
      continue;
    }
    const rate = fx[code];
    if (!rate) throw new Error(`currency ${code} is not enabled in this environment — rerun with --fx ${code}=<units per base currency>`);
    const id = await api.request<{ id?: string }>("POST", "transactioncurrencies", {
      isocurrencycode: code,
      currencyname: code,
      currencysymbol: code,
      currencyprecision: 2,
      exchangerate: rate,
    });
    if (!id?.id) throw new Error(`could not create currency ${code}`);
    out[code] = id.id;
    log(`+ currency ${code} @ ${rate}`);
  }
  return out;
}

export async function ensureTable(api: WebApi, plan: EntityPlan, log: Log): Promise<void> {
  const ln = plan.logicalName;
  const existing = await api.find<{ LogicalName: string }>(`EntityDefinitions(LogicalName='${ln}')?$select=LogicalName`);
  if (!existing) {
    await api.create("EntityDefinitions", plan.entity);
    log(`+ table ${ln}`);
  } else log(`✓ table ${ln}`);
  const attrs = await api.get<{ value: Array<{ LogicalName: string }> }>(`EntityDefinitions(LogicalName='${ln}')/Attributes?$select=LogicalName`);
  const have = new Set(attrs?.value.map((a) => a.LogicalName));
  let added = 0;
  for (const a of plan.attributes) {
    const name = String(a.SchemaName).toLowerCase();
    if (have.has(name)) continue;
    await api.create(`EntityDefinitions(LogicalName='${ln}')/Attributes`, a);
    added++;
  }
  if (added) log(`  + ${added} column(s) on ${ln}`);
  if (plan.keys.length) {
    const keys = await api.get<{ value: Array<{ LogicalName: string }> }>(`EntityDefinitions(LogicalName='${ln}')/Keys?$select=LogicalName`);
    const haveKeys = new Set(keys?.value.map((k) => k.LogicalName));
    for (const k of plan.keys) {
      const kn = String(k.SchemaName).toLowerCase();
      if (!haveKeys.has(kn)) {
        await api.create(`EntityDefinitions(LogicalName='${ln}')/Keys`, k);
        log(`  + alternate key ${kn}`);
      }
    }
  }
}

export async function entitySetName(api: WebApi, logicalName: string): Promise<string> {
  const r = await api.get<{ EntitySetName: string }>(`EntityDefinitions(LogicalName='${logicalName}')?$select=EntitySetName`);
  if (!r?.EntitySetName) throw new Error(`no entity set for ${logicalName}`);
  return r.EntitySetName;
}

export async function ensureEnvironmentVariables(api: WebApi, log: Log): Promise<void> {
  for (const v of ENV_VARS) {
    const found = await api.first("environmentvariabledefinitions", `schemaname eq '${v.schemaname}'`, ["environmentvariabledefinitionid"]);
    if (found) {
      log(`✓ environment variable ${v.schemaname}`);
      continue;
    }
    await api.create("environmentvariabledefinitions", { ...v, type: 100000000, isrequired: false });
    log(`+ environment variable ${v.schemaname}`);
  }
}

export async function ensurePluginAssembly(api: WebApi, dll: Buffer, version: string, log: Log): Promise<string> {
  const content = dll.toString("base64");
  const found = await api.first<{ pluginassemblyid: string; version: string }>("pluginassemblies", `name eq '${ASSEMBLY}'`, ["pluginassemblyid", "version"]);
  if (found) {
    await api.update(`pluginassemblies(${found.pluginassemblyid})`, { content, version });
    log(`↑ plug-in assembly ${ASSEMBLY} ${found.version} → ${version}`);
    return found.pluginassemblyid;
  }
  const id = await api.create("pluginassemblies", { name: ASSEMBLY, content, version, culture: "neutral", isolationmode: 2, sourcetype: 0 });
  log(`+ plug-in assembly ${ASSEMBLY} ${version}`);
  return id ?? (await ensurePluginAssembly(api, dll, version, () => {}));
}

export async function ensurePluginType(api: WebApi, assemblyId: string, typename: string, log: Log): Promise<string> {
  const found = await api.first<{ plugintypeid: string }>("plugintypes", `typename eq '${typename}'`, ["plugintypeid"]);
  if (found) {
    log(`✓ plug-in type ${typename}`);
    return found.plugintypeid;
  }
  const short = typename.split(".").pop()!;
  const id = await api.create("plugintypes", {
    typename,
    name: typename,
    friendlyname: short,
    description: `Sustantix AIP licensing — ${short}`,
    "pluginassemblyid@odata.bind": `/pluginassemblies(${assemblyId})`,
  });
  log(`+ plug-in type ${typename}`);
  return id ?? (await ensurePluginType(api, assemblyId, typename, () => {}));
}

export async function ensureLicenseApi(api: WebApi, statusTypeId: string, log: Log): Promise<void> {
  const found = await api.first("customapis", `uniquename eq '${LICENSE_API}'`, ["customapiid"]);
  if (found) {
    log(`✓ custom API ${LICENSE_API}`);
    return;
  }
  await api.create("customapis", {
    uniquename: LICENSE_API,
    name: LICENSE_API,
    displayname: "Sustantix AIP license status",
    description: "Returns the server-side license verdict for this environment as JSON.",
    bindingtype: 0,
    isfunction: false,
    isprivate: false,
    allowedcustomprocessingsteptype: 0,
    "PluginTypeId@odata.bind": `/plugintypes(${statusTypeId})`,
    CustomAPIRequestParameters: [
      { uniquename: "Refresh", name: "Refresh", displayname: "Refresh", description: "Bypass the five-minute verdict cache.", type: 0, isoptional: true },
    ],
    CustomAPIResponseProperties: [{ uniquename: "StatusJson", name: "StatusJson", displayname: "Status JSON", description: "LicenseStatus serialised as JSON.", type: 10 }],
  });
  log(`+ custom API ${LICENSE_API}`);
}

const messageIds = new Map<string, string>();

async function sdkMessageId(api: WebApi, name: string): Promise<string> {
  const cached = messageIds.get(name);
  if (cached) return cached;
  const m = await api.first<{ sdkmessageid: string }>("sdkmessages", `name eq '${name}'`, ["sdkmessageid"]);
  if (!m) throw new Error(`sdk message ${name} not found`);
  messageIds.set(name, m.sdkmessageid);
  return m.sdkmessageid;
}

export function guardStepName(message: string, table: string) {
  return `Sustantix AIP License Guard: ${message} of ${table}`;
}

export async function ensureGuardSteps(api: WebApi, guardTypeId: string, tables: string[], log: Log): Promise<number> {
  let created = 0;
  for (const table of tables) {
    for (const message of GUARD_MESSAGES) {
      const name = guardStepName(message, table);
      const exists = await api.first("sdkmessageprocessingsteps", `name eq ${odataString(name)}`, ["sdkmessageprocessingstepid"]);
      if (exists) continue;
      const msgId = await sdkMessageId(api, message);
      const filter = await api.first<{ sdkmessagefilterid: string }>(
        "sdkmessagefilters",
        `primaryobjecttypecode eq '${table}' and _sdkmessageid_value eq ${msgId}`,
        ["sdkmessagefilterid"],
      );
      if (!filter) throw new Error(`no ${message} filter for ${table}`);
      await api.create("sdkmessageprocessingsteps", {
        name,
        description: "Blocks AIP data access when the Sustantix license is missing, expired, revoked or bound elsewhere.",
        mode: 0,
        rank: 1,
        stage: 10,
        supporteddeployment: 0,
        asyncautodelete: false,
        "eventhandler_plugintype@odata.bind": `/plugintypes(${guardTypeId})`,
        "sdkmessageid@odata.bind": `/sdkmessages(${msgId})`,
        "sdkmessagefilterid@odata.bind": `/sdkmessagefilters(${filter.sdkmessagefilterid})`,
      });
      created++;
    }
  }
  log(`${created ? "+" : "✓"} license guard steps (${created} new across ${tables.length} tables)`);
  return created;
}

export async function ensureRole(api: WebApi, name: string, businessUnitId: string, log: Log): Promise<string> {
  const found = await api.first<{ roleid: string }>("roles", `name eq ${odataString(name)} and _businessunitid_value eq ${businessUnitId}`, ["roleid"]);
  if (found) {
    log(`✓ role ${name}`);
    return found.roleid;
  }
  const id = await api.create("roles", { name, description: `${name} — Sustantix Asset Intelligence Platform`, "businessunitid@odata.bind": `/businessunits(${businessUnitId})` });
  log(`+ role ${name}`);
  return id ?? (await ensureRole(api, name, businessUnitId, () => {}));
}

export async function grantPrivileges(api: WebApi, roleId: string, businessUnitId: string, privilegeNames: string[], log: Log): Promise<void> {
  const privileges: Array<Record<string, string>> = [];
  for (let i = 0; i < privilegeNames.length; i += 40) {
    const chunk = privilegeNames.slice(i, i + 40);
    const filter = chunk.map((n) => `name eq '${n}'`).join(" or ");
    const r = await api.get<{ value: Array<{ privilegeid: string; name: string }> }>(`privileges?$select=privilegeid,name&$filter=${encodeURIComponent(filter)}`);
    for (const p of r?.value ?? []) privileges.push({ PrivilegeId: p.privilegeid, BusinessUnitId: businessUnitId, Depth: "Global", PrivilegeName: p.name });
  }
  if (privileges.length !== privilegeNames.length) {
    const got = new Set(privileges.map((p) => p.PrivilegeName));
    throw new Error(`missing privileges: ${privilegeNames.filter((n) => !got.has(n)).slice(0, 5).join(", ")}`);
  }
  await api.action(`roles(${roleId})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: privileges });
  log(`  ↳ ${privileges.length} privilege(s)`);
}

export function rolePrivileges(dataTables: string[]): { user: string[]; admin: string[] } {
  const read = (t: string) => `prvRead${t}`;
  const write = (t: string) => ["Create", "Write", "Delete", "Append", "AppendTo"].map((p) => `prv${p}${t}`);
  const all = ["sus_runtimestate", ...dataTables];
  return {
    user: all.map(read),
    admin: all.flatMap((t) => [read(t), ...write(t)]),
  };
}

export async function publishAll(api: WebApi, log: Log): Promise<void> {
  await api.action("PublishAllXml", {});
  log("✓ customizations published");
}

export const label = lbl;
