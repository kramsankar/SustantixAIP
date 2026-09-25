
window.AIP_V388_AUDIT={
 release:'v388',baseline:'v387',
 scope:'Preventive Maintenance first-entry Strategy Governance render path only',
 uiOnly:true,excelChanged:false,syntheticBusinessDataChanged:false,
 rootCause:'First-entry Maintenance Strategy contains legacy routines that can invoke the Preventive renderer multiple times. Post-render governance injection therefore remained vulnerable to replacement. v388 removes that dependency by rendering Strategy Governance as native Preventive markup in the same innerHTML transaction.',
 changes:[
  'Embedded the Preventive Strategy Governance control and five governance nodes directly in renderPreventive()',
  'The grouped five Maintenance Strategy tabs can still be inserted after the view heading and therefore remain above Strategy Governance',
  'Existing governance decorators and all other strategy-tab behavior remain compatible',
  'No business values, calculations, navigation, Synthetic data or Excel data changed'
 ]
};
