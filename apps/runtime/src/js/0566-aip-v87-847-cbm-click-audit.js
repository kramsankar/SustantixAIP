
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';

/* Make the disclosure state explicit on the fit box as well as the basis.
   This avoids relying only on descendant rendering behavior and makes repeated
   open/close clicks deterministic. */
document.addEventListener('click',function(e){
  const b=e.target.closest?.('#view-conditionbased .cbm831-fit-toggle');
  if(!b)return;
  requestAnimationFrame(()=>{
    const box=b.closest('.cbm831-fit-box');
    const basis=b.nextElementSibling;
    if(!box||!basis)return;
    box.classList.toggle('aip847-expanded',basis.classList.contains('open'));
  });
},true);

window.AIP_V847_AUDIT={
 release:'v87_855',
 baseline:'v87_855',
 area:'Condition-Based Maintenance',
 uiOnly:true,
 excelBusinessDataChanged:false,
 syntheticBusinessEvidenceChanged:false,
 auditedClickPath:[
  'Select Portfolio Condition Health site',
  'Verify site filter reduces Condition-Based Maintenance Register to matching site records',
  'Select current CBM assessment',
  'Open Engineering / Physics Fit',
  'Close Engineering / Physics Fit',
  'Confirm expanded fit remains above and does not overlap Condition-Based Maintenance Register'
 ],
 changes:[
  'Distributed the three Portfolio Condition Health rows vertically so top and bottom whitespace are balanced without changing box width',
  'Kept Evidence Gate and Engineering Physics Fit aligned on the same horizontal baseline',
  'Allowed expanded Engineering Physics Fit to increase normal document height so its drill-down cannot sit behind the register',
  'Added deterministic expanded-state tracking for repeated Physics Fit open/close clicks'
 ]
};
})();
