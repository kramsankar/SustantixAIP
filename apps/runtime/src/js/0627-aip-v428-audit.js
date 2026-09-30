
window.AIP_V428_AUDIT={
 release:'v428',
 baseline:'v427',
 scope:'Portfolio · Asset Intelligence Studio · governed natural-language query planning and lineage',
 architecture:{
   engine:'Internal governed JavaScript query planner/executor',
   chatGPTDependency:false,
   openAIDependency:false,
   subscriptionRequired:false,
   externalAPIRequired:false
 },
 executionFlow:[
   'Natural-language prompt',
   'Intent and domain detection',
   'Dataset selection',
   'Governed join selection',
   'Filter and time-window extraction',
   'Grouping and calculation plan',
   'Local deterministic execution',
   'Validation / data-gap check',
   'Result plus expandable lineage'
 ],
 enhancements:[
   'Structured lineage is appended to normal governed offline answers, not only the two v427 complex-query examples',
   'Lineage exposes Intent, Datasets, Joins, Filters, Grouping, Calculations, Validation and Status',
   'Conjunction-heavy multi-domain questions without a safe governed join now return an explicit limitation instead of silently answering one clause',
   'Legacy local rules remain available but are labeled in lineage',
   'Assistant UI explicitly identifies the engine as independent of ChatGPT'
 ],
 governanceRule:'Never infer a missing join, historical field, or temporal relationship. Return the data gap and lineage instead of fabricating a result.'
};
