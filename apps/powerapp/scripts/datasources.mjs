// Converts the pac-generated dataSourcesInfo (TypeScript) into JSON for the host bridge.
import { existsSync, readFileSync } from "node:fs";

export function readGeneratedDataSources(file) {
  if (!existsSync(file)) return null;
  const src = readFileSync(file, "utf8");
  const m = /export\s+const\s+dataSourcesInfo\s*(?::[^=]+)?=\s*([\s\S]*?)\s*;?\s*$/.exec(src);
  if (!m) throw new Error(`no dataSourcesInfo export in ${file}`);
  // The file is produced locally by `pac code add-data-source`; it is a plain object literal.
  const value = new Function(`"use strict"; return (${m[1]});`)();
  if (!value || typeof value !== "object" || !value.sus_runtimestates) {
    throw new Error("dataSourcesInfo must include the sus_runtimestates Dataverse table (pac code add-data-source -a dataverse -t sus_runtimestate)");
  }
  return value;
}
