/** The governed catalogue of AIP's own models (schema/analytics/models.json), one card per engine. */
import catalogue from "../../../schema/analytics/models.json";

export interface ModelCard {
  code: string;
  name: string;
  model_type: string;
  engine: string;
  version: string;
  algorithm: string;
  feature_set: string;
  validation_method: string;
  primary_metric: string;
  owner_foundation: string;
}

export const MODEL_CARDS: ModelCard[] = (catalogue as { models: ModelCard[] }).models;

export function modelCard(code: string): ModelCard {
  const m = MODEL_CARDS.find((x) => x.code === code);
  if (!m) throw new Error(`unknown model ${code}`);
  return m;
}
