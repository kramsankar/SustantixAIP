
window.AIP_V364_AUDIT={
 release:'v364',
 baseline:'v363',
 scope:'AI Models & Governance stage-header visual edge alignment only',
 changes:[
  'Removed legacy white pseudo-element masks around sticky blue stage headers',
  'Removed header shadow that could visually distort the right/left edge',
  'Kept header and tile stack on the same shared horizontal geometry',
  'Added final browser-level edge enforcement against the actual rendered tile border box',
  'Header text remains left aligned'
 ],
 excelChanged:false
};
