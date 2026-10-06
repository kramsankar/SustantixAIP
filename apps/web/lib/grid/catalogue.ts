import { registryRows, resolveCatalogue, type Catalogue, type ChangeModel, type GridDef, type RegistryLike } from "@sustantix/grid";
import catalogue from "../../../../schema/grids/grids.json";
import changeModel from "../../../../schema/aip-change-model.json";
import registry from "../../../../schema/aip-data-model.json";
import vocabulary from "../../../../schema/reference/vocabulary.json";
import { ApiError } from "../http";

/** The resolved grid catalogue (schema/grids/grids.json against the governed model), checked once per process. */

export const CHANGE_MODEL = changeModel as ChangeModel;

let resolved: GridDef[] | null = null;

export function grids(): GridDef[] {
  if (!resolved) {
    const r = resolveCatalogue(catalogue as Catalogue, CHANGE_MODEL, registry as RegistryLike);
    if (r.problems.length) throw new Error(`grid catalogue is invalid:\n  ${r.problems.join("\n  ")}`);
    resolved = r.grids;
  }
  return resolved;
}

export function gridById(id: string): GridDef {
  const g = /^[a-z][a-z0-9-]{0,60}$/.test(id) ? grids().find((x) => x.id === id) : undefined;
  if (!g) throw new ApiError(404, "not_found", "no such grid");
  return g;
}

let dictionary: Array<Record<string, unknown>> | null = null;

/** Rows of the Data Management field dictionary (registry source). */
export function dictionaryRows(): Array<Record<string, unknown>> {
  dictionary ??= registryRows(registry as RegistryLike, (vocabulary as { bindings: Array<{ column: string; ref: string; scope?: string }> }).bindings);
  return dictionary;
}
