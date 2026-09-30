
window.AIP_V375_AUDIT={
 release:'v375',
 baseline:'v369',
 scope:'Guardrails contained vertical table scrolling',
 changes:[
   'Restored each Guardrails table wrapper as the actual vertical scroll container',
   'Confined sticky blue headers to the opaque table wrapper so body rows cannot bleed into the area above',
   'Applied to Policy & Autonomy, Evidence & Model Use, Approvals & Overrides, Decision Log, and other Guardrails tables using the same wrapper',
   'Preserved existing blue headers, borders, search controls, content and Guardrails logic',
   'Removed dependency on overlay, mask, shadow or margin/padding workarounds'
 ],
 excelChanged:false
};
