
window.AIP_V367_AUDIT={
 release:'v367',
 baseline:'v366',
 scope:'Remove active legacy Guardrails disclosures at source',
 changes:[
   'Disabled the active enhanceGuardrails injector that re-created Enterprise-wide coverage map and Cross-module decision ledger on every render',
   'Removed any already-rendered legacy disclosure containers from the Guardrails DOM',
   'Preserved the underlying legacy evaluator and helper functions for regression safety without exposing those legacy sections',
   'Current five-tab Guardrails UI and current Guardrail Decision Log remain unchanged'
 ],
 excelChanged:false
};
