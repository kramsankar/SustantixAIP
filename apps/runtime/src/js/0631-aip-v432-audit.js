
window.AIP_V432_AUDIT={
 release:'v432',
 baseline:'v431',
 scope:'Assistant · governed semantic/schema-aware query engine',
 architecture:{
   chatGPTDependency:false,
   externalAIRequired:false,
   execution:'Local governed semantic resolver + schema validator + deterministic query rules'
 },
 coreChanges:[
   'Added an internal dataset/concept registry for Crew, Assets, Work Orders, Spares and Plants',
   'Natural-language concepts are mapped to governed fields before execution',
   'Field existence is verified from the active dataset schema before a result is calculated',
   'Field completeness / populated-value coverage is calculated for resolved concepts',
   'General missing-value questions can now be executed without one-off coding for every field',
   'If a requested governed field does not exist, the Assistant explicitly says the data is not available',
   'If a domain is recognized but the requested operator cannot be interpreted safely, the Assistant refuses to substitute a generic domain summary',
   'Legacy fallback is blocked for questions that already map to a governed semantic domain but remain unresolved'
 ],
 governanceRules:[
   'Never substitute Skill for Certification, or any other field for an unavailable requested concept',
   'Never return a generic crew/asset/work-order summary when the question asks for a different unresolved attribute',
   'State missing fields, incomplete coverage, or unsupported query operations explicitly',
   'Expose the exact mapped dataset, field, condition, coverage and execution status in lineage'
 ]
};
