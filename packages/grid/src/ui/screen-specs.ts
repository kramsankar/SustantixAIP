/** Which runtime screens show which of their tables as Enterprise Grids (DOM-free, so builds and tests can read it). */

export interface ScreenTable {
  /** Grid id suffix (screen-<id>), also the key of its remembered layout and of its export audit. */
  id: string;
  title: string;
  /** The table's leading column headers, compared case-insensitively. */
  headers: string[];
  /** The governed workspace grid holding these records, when there is one. */
  governedGrid?: string;
}

export interface ScreenSpec {
  /** data-view of the navigation item (the switch is per screen). */
  view: string;
  /** Element id of the screen's view. */
  viewId: string;
  screen: string;
  tables: ScreenTable[];
}

/** The 14 screens whose tables become Enterprise Grids (the census in the data-architecture deep dive). */
export const SCREEN_GRIDS: ScreenSpec[] = [
  { view: "portfoliointelligence", viewId: "view-portfoliointelligence", screen: "Portfolio Intelligence", tables: [
    { id: "portfolio-sites", title: "Sites", headers: ["SITE", "NAME", "STATE"], governedGrid: "sites" },
    { id: "portfolio-economics", title: "Site economics", headers: ["SITE", "GENERATION (12 MONTHS)"] },
  ] },
  { view: "assetexplorer", viewId: "view-assetexplorer", screen: "Asset Explorer", tables: [] },
  { view: "revenuecommercial", viewId: "view-revenuecommercial", screen: "Revenue & Commercial Intelligence", tables: [
    { id: "revenue-loss-drivers", title: "Loss drivers", headers: ["LOSS DRIVER", "LOSS", "SHARE"] },
    { id: "revenue-site-loss", title: "Site loss ranking", headers: ["PLANT", "TOTAL LOSS"], governedGrid: "ppa-settlements" },
  ] },
  { view: "decisionintelligence", viewId: "view-decisionintelligence", screen: "Decision Intelligence", tables: [
    { id: "decisions", title: "Decisions", headers: ["PRIORITY", "DECISION"], governedGrid: "recommendations" },
  ] },
  { view: "predictive", viewId: "view-preventive", screen: "Maintenance Strategy", tables: [
    { id: "pm-work-orders", title: "Preventive work orders", headers: ["WO #", "SITE", "ASSET", "TASK"], governedGrid: "pm-plans" },
  ] },
  { view: "workorderintelligence", viewId: "view-workorderintelligence", screen: "Work Order Intelligence", tables: [
    { id: "work-orders", title: "Work orders", headers: ["", "WO ID", "SITE / ASSET"], governedGrid: "work-orders" },
  ] },
  { view: "resourceplanning", viewId: "view-resourceplanning", screen: "Planning & Optimization", tables: [
    { id: "interventions", title: "Interventions", headers: ["INTERVENTION", "SITE / ASSET"], governedGrid: "interventions" },
  ] },
  { view: "sustainabilityintelligence", viewId: "view-sustainabilityintelligence", screen: "Sustainability Performance", tables: [
    { id: "sustainability-attention", title: "Sustainability attention", headers: ["SITE", "ASSET", "SUSTAINABILITY TOPIC"], governedGrid: "esg-activity" },
  ] },
  { view: "actionprioritization", viewId: "view-actionprioritization", screen: "Portfolio Action Prioritization", tables: [
    { id: "action-ranking", title: "Action ranking", headers: ["#", "RECORD", "DOMAIN"], governedGrid: "action-priority" },
  ] },
  { view: "datamanagement", viewId: "view-datamanagement", screen: "Data Management", tables: [
    { id: "field-dictionary", title: "Field dictionary", headers: ["SHEET", "FIELD", "TYPE", "DEFINITION"], governedGrid: "data-dictionary" },
  ] },
  { view: "dataquality", viewId: "view-dataquality", screen: "Data Quality & Observability", tables: [
    { id: "quality-rules", title: "Quality rules", headers: ["RULE", "DOMAIN", "SCORE"], governedGrid: "data-quality-rules" },
  ] },
  { view: "integrations", viewId: "view-integrations", screen: "Enterprise Integration", tables: [
    { id: "systems", title: "Systems", headers: ["SYSTEM NAME", "SYSTEM TYPE"] },
    { id: "interfaces", title: "Interfaces", headers: ["INTERFACE ID", "INTERFACE NAME"], governedGrid: "integration-interfaces" },
  ] },
  { view: "twinfoundation", viewId: "view-twinfoundation", screen: "Twin Model & Physics", tables: [
    { id: "twin-parameters", title: "Twin parameters", headers: ["PARAMETER", "PURPOSE", "UNIT"], governedGrid: "twin-parameters" },
  ] },
  { view: "guardrails", viewId: "view-guardrails", screen: "AI Guardrails", tables: [
    { id: "guardrails", title: "Guardrail controls", headers: ["CONTROL", "DOMAIN", "STATE"], governedGrid: "ai-guardrails" },
  ] },
];
