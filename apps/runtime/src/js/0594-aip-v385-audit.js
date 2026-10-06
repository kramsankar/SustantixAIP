
window.AIP_V385_AUDIT={
 release:'v385',baseline:'v384',
 scope:'Maintenance Strategy grouped tabs and Strategy Governance vertical alignment only',
 uiOnly:true,excelChanged:false,syntheticBusinessDataChanged:false,
 rootCause:'Condition-Based retained a legacy -3px Strategy Governance offset and was omitted from the later common strategy-tab spacing rule; the grouped tab row also retained a blue-tinted static outer container.',
 changes:[
  'Applied identical Strategy Governance top/bottom spacing across Preventive, Condition-Based, Predictive, Corrective, Risk-Based and Adaptive render paths',
  'Removed the Condition-Based-only negative governance offset',
  'Removed the static blue-tinted outer fill/border/shadow around the five Maintenance Strategy tabs',
  'Preserved tab buttons, active-state behavior, Strategy Governance control, data and navigation'
 ]
};
