
window.AIP_V427_AUDIT={
 release:'v427',
 baseline:'v426',
 scope:'Portfolio · Asset Intelligence Studio · governed multi-table local query engine',
 architecture:{
  externalAIRequired:false,
  chatGPTSubscriptionRequired:false,
  execution:'Deterministic JavaScript against active AIP datasets in the browser',
  optionalFutureAI:'May improve language interpretation, but is not required for calculations, joins, grouping, filters or lineage.'
 },
 capabilitiesAdded:[
  'Time-window parsing for last N days/weeks/months',
  'Failure-event grouping by asset with minimum recurrence thresholds',
  'Cross-dataset join between Plant Registry and Asset Register',
  'Numeric threshold parsing for MW capacity and asset-count conditions',
  'Query Plan & Lineage disclosure on complex results',
  'Explicit insufficiency response when a requested historical condition cannot be proven from available governed data',
  'Current-snapshot fallback is shown separately when historical asset-count lineage is unavailable'
 ],
 examples:[
  'Show assets that failed at least twice in the last 3 months',
  'Show sites with capacity greater than 2 MW and more than 820 assets',
  'Show sites with capacity greater than 2 MW and more than 820 assets at any point in time'
 ],
 noFabricationRule:'If a requested temporal field or history does not exist, the engine must state the data gap rather than infer or invent historical facts.'
};
