
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';
const V842_WO_BY_SOURCE={
 'VIS-FND-00001':'WO-00145','VIS-FND-00004':'WO-00146','VIS-FND-00005':'WO-00147',
 'VIS-FND-00008':'WO-00148','VIS-FND-00009':'WO-00149','VIS-FND-00012':'WO-00150'
};
/* Repair any stale CBM payload that may have been instantiated before the v87_836 data patch. */
function repairRuntime(){
 const pools=[];
 const add=x=>{if(Array.isArray(x))pools.push(x)};
 try{add(window.AIP_CBM_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.APM_IMPORTED_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.EMBEDDED_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.conditionBasedMaintenance?.['CBM Assessments'])}catch(_){}
 pools.forEach(arr=>arr.forEach(a=>{const w=V842_WO_BY_SOURCE[String(a?.Source_Record_ID||'')];if(w)a.Work_Order_ID=w}));
}
repairRuntime();
document.addEventListener('aip:data-source-changed',()=>{repairRuntime();setTimeout(repairRuntime,0)});
window.AIP_V842_AUDIT={release:'v87_856',baseline:'v87_855',area:'Condition-Based Maintenance',changes:[
 'Corrected stale HTML-runtime CBM Vision work-order IDs to audited WO-00145 through WO-00150',
 'No-linked-WO status moved to compact top-right white/red badge and appears only when no governed WO exists',
 'Review exact WO action compressed and given standard dark circular white-arrow navigation badge',
 'Added runtime repair for any stale CBM payload instantiated before authoritative data patches'
]};
})();
