/**
 * sx-pp — provisions the Sustantix AIP solution into a Dataverse environment.
 *
 *   whoami     --env https://<org>.crm.dynamics.com
 *              Prints the organisation id to bind a license to.
 *   provision  --env <url> --version 7.32.0.0 --plugin <Sustantix.Aip.Licensing.dll>
 *              [--data-model] [--guard-data-model] [--seed [workbook.xlsx]] [--fx INR=83.2 ...]
 *              [--report out/provision-report.json]
 *   set-license --env <url> --token <SXL1...>   (writes the environment variable value)
 *
 * Authentication: see src/auth.ts (PP_ACCESS_TOKEN, service principal or device code).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inferRegistry } from "@sustantix/schema";
import { tokenProvider } from "./auth.ts";
import { provision } from "./provision.ts";
import { ENV_VARS, whoAmI } from "./steps.ts";
import { WebApi } from "./webapi.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const argv = process.argv.slice(2);
const cmd = argv[0] ?? "help";
const flag = (k: string) => {
  const i = argv.indexOf("--" + k);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : "true";
};
const flags = (k: string) => argv.flatMap((a, i) => (a === "--" + k && argv[i + 1] ? [argv[i + 1]!] : []));
const log = (m: string) => console.log(m);

function api(): WebApi {
  const envUrl = flag("env");
  if (!envUrl) throw new Error("--env https://<org>.crm.dynamics.com is required");
  return new WebApi({ envUrl, token: tokenProvider(envUrl), solution: "SustantixAIP", log });
}

async function main() {
  switch (cmd) {
    case "whoami": {
      const me = await whoAmI(api());
      console.log(JSON.stringify({ organizationId: me.OrganizationId, businessUnitId: me.BusinessUnitId, userId: me.UserId }, null, 2));
      console.log(`\nIssue a license bound to this environment with:\n  sx-license issue --platform powerplatform --org ${me.OrganizationId} ...`);
      return;
    }
    case "provision": {
      const version = flag("version") ?? "7.32.0.0";
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error("--version must be major.minor.build.revision");
      const pluginPath = flag("plugin") ?? join(root, "powerplatform/plugins/Sustantix.Aip.Licensing/bin/Release/net462/Sustantix.Aip.Licensing.dll");
      const workbookPath = join(root, "reference/AIP_Data_v732.xlsx");
      const workbook = readFileSync(workbookPath);
      const seedArg = flag("seed");
      const fx = Object.fromEntries(
        flags("fx").map((s) => {
          const [code, rate] = s.split("=");
          if (!code || !/^[A-Z]{3}$/.test(code) || !(Number(rate) > 0)) throw new Error(`bad --fx ${s}`);
          return [code, Number(rate)];
        }),
      );
      const report = await provision(
        api(),
        {
          version,
          registry: inferRegistry(workbook, basename(workbookPath)),
          pluginDll: readFileSync(pluginPath),
          dataModel: flag("data-model") === "true" || !!seedArg,
          guardDataModel: flag("guard-data-model") === "true",
          seedWorkbook: seedArg ? (seedArg === "true" ? workbook : readFileSync(seedArg)) : undefined,
          fx,
        },
        log,
      );
      const out = flag("report") ?? join(root, "out/provision-report.json");
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(report, null, 2));
      log(`\nreport → ${out}`);
      if (report.seedFailures.length) {
        log(`⚠ ${report.seedFailures.length} seed row(s) failed — see report`);
        process.exitCode = 3;
      }
      return;
    }
    case "set-license": {
      const token = flag("token");
      if (!token || !token.startsWith("SXL1.")) throw new Error("--token SXL1... is required");
      const client = api();
      const def = await client.first<{ environmentvariabledefinitionid: string }>("environmentvariabledefinitions", `schemaname eq '${ENV_VARS[0]!.schemaname}'`, ["environmentvariabledefinitionid"]);
      if (!def) throw new Error("sus_LicenseKey is not provisioned — import the SustantixAIP solution first");
      const val = await client.first<{ environmentvariablevalueid: string }>(
        "environmentvariablevalues",
        `_environmentvariabledefinitionid_value eq ${def.environmentvariabledefinitionid}`,
        ["environmentvariablevalueid"],
      );
      if (val) await client.request("PATCH", `environmentvariablevalues(${val.environmentvariablevalueid})`, { value: token }, { "If-Match": "*" });
      else
        await client.request("POST", "environmentvariablevalues", {
          value: token,
          schemaname: `${ENV_VARS[0]!.schemaname}_value`,
          "EnvironmentVariableDefinitionId@odata.bind": `/environmentvariabledefinitions(${def.environmentvariabledefinitionid})`,
        });
      log("✓ license installed — the license guard picks it up within five minutes (or call sus_GetLicenseStatus with Refresh=true)");
      return;
    }
    default:
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  }
}

main().catch((e) => {
  console.error("sx-pp: " + (e instanceof Error ? e.message : String(e)));
  process.exitCode = 1;
});
