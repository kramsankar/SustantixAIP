import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readGeneratedDataSources } from "./datasources.mjs";

test("reads the pac-generated dataSourcesInfo literal", () => {
  const dir = mkdtempSync(join(tmpdir(), "aip-"));
  const f = join(dir, "dataSourcesInfo.ts");
  writeFileSync(f, `/* generated */\nexport const dataSourcesInfo = {\n  "sus_runtimestates": { "tableId": "", "version": "", "primaryKey": "sus_runtimestateid", "dataSourceType": "Dataverse", "apis": {} }\n};\n`);
  assert.equal(readGeneratedDataSources(f).sus_runtimestates.primaryKey, "sus_runtimestateid");
});

test("requires the runtime state table", () => {
  const dir = mkdtempSync(join(tmpdir(), "aip-"));
  const f = join(dir, "dataSourcesInfo.ts");
  writeFileSync(f, `export const dataSourcesInfo = { "accounts": {} };`);
  assert.throws(() => readGeneratedDataSources(f), /sus_runtimestates/);
});

test("absent file means not yet initialised", () => {
  assert.equal(readGeneratedDataSources("/nonexistent/x.ts"), null);
});
