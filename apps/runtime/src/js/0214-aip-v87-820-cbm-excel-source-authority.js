
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_830';
 // v87_820: expose the governed CBM Excel payload across IIFE scope boundaries and re-render CBM after data-source transitions.
 function ensure(){
   const d=window.AIP_CBM_EXCEL_DATA||{};
   if(!window.AIP_SYNTHETIC_ACTIVE && Array.isArray(d['CBM Assessments']) && d['CBM Assessments'].length){
     try{
       if(typeof EMBEDDED_EXCEL_DATA!=='undefined'){
         EMBEDDED_EXCEL_DATA['CBM Assessments']=d['CBM Assessments'];
         EMBEDDED_EXCEL_DATA['CBM Evidence']=d['CBM Evidence']||[];
         EMBEDDED_EXCEL_DATA['CBM Governance']=d['CBM Governance']||[];
       }
     }catch(_){}
   }
   if(document.getElementById('view-conditionbased')?.classList.contains('active')){try{window.renderConditionBasedMaintenance?.()}catch(_){}}
 }
 document.addEventListener('aip:data-source-changed',()=>setTimeout(ensure,60));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensure,160),{once:true});else setTimeout(ensure,80);
 window.AIP_V820_AUDIT={release:'v87_820',baseline:'v87_819',change:'CBM Excel payload is now global across script scopes; Excel-mode fallback can no longer reference an inaccessible block-scoped const EXCEL.',excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false};
})();
