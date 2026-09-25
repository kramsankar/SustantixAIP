/**
 * Commercial module catalogue. Each module unlocks a set of AIP views
 * (the data-view keys of the navigation). "core" is always granted.
 */
export const MODULES: Record<string, { label: string; views: string[] }> = {
  core: {
    label: "Platform Core",
    views: ["datamanagement", "dataquality", "controlassurance", "guardrails", "models", "integrations"],
  },
  portfolio: {
    label: "Portfolio Intelligence",
    views: ["portfoliointelligence", "overview", "assetexplorer", "assetrelationships", "revenuecommercial", "dataexplorer"],
  },
  enterprise: {
    label: "Enterprise Intelligence",
    views: ["contextgraph", "operationaltwin", "decisionintelligence", "twinfoundation"],
  },
  maintenance: {
    label: "Maintenance Intelligence",
    views: [
      "predictive", "preventive", "workorderintelligence", "resourceplanning", "spares",
      "rootcause", "maintenancelearning", "assethealthmodel", "actionprioritization",
      "workorderconstraintprioritization", "issueprioritization",
    ],
  },
  sustainability: {
    label: "Sustainability Intelligence",
    views: ["sustainabilityintelligence", "sustainabilitymodelgovernance"],
  },
};

export const ALL_MODULE_KEYS = Object.keys(MODULES);

export function grantedModules(modules: string[]): string[] {
  const set = new Set(modules.includes("*") ? ALL_MODULE_KEYS : modules.filter((m) => m in MODULES));
  set.add("core");
  return [...set];
}

export function isViewLicensed(view: string, modules: string[]): boolean {
  const granted = grantedModules(modules);
  const owner = Object.entries(MODULES).find(([, m]) => m.views.includes(view));
  // Views not in the catalogue are sub-views of licensed screens; allow.
  return !owner || granted.includes(owner[0]);
}
