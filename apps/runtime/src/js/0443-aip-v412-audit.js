
window.AIP_V412_AUDIT={
 release:'v412',baseline:'v409',
 scope:'Operational Foundations · Asset Health Scoring Framework · Test & Explain clean rebuild',
 uiOnly:true,excelChanged:false,syntheticBusinessDataChanged:false,
 rootCause:'v411 dropdown failed because its menu renderer referenced an escaping helper outside the component scope; v410/v411 also accumulated layout overrides.',
 verified:[
  'Rebuilt from v409 rather than extending v410/v411',
  'Asset-class models and Version & governance cards remain present',
  'Test & Explain is appended below them and does not replace an existing framework card',
  'Restore Defaults, Validate Configuration, Save Configuration and Recalculate All Assets remain in the base framework action row',
  'Search menu uses a locally defined escaping helper and no browser-native datalist',
  'Search covers the full governed Asset Master without the prior 250-row cap',
  'Asset Health Score is explicitly labelled and explanation table is constrained to one visible width',
  'Generic Change values / validate / save / recalculate instruction removed'
 ],
 noChange:['health scoring formulas','weights','thresholds','evidence','business data']
};
