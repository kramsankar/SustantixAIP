
(function(){
 const rootId='view-assethealthmodel';
 function refresh(){
   const root=document.getElementById(rootId);
   if(!root)return;
   const extra=root.querySelector('.ahsf-extra');
   if(extra)extra.remove();
   try{
     if(typeof window.renderAssetHealthModel==='function')window.renderAssetHealthModel();
   }catch(_){}
 }
 document.addEventListener('aip:data-source-changed',()=>setTimeout(refresh,0),true);
 window.AIP_V408_AUDIT={
  release:'v408',baseline:'v407',
  scope:'Operational Foundations · Asset Health Scoring Framework · Test & Explain',
  uiOnly:false,excelChanged:false,syntheticBusinessDataChanged:false,
  changes:[
   'Test & Explain asset selector now reads governed assets from the active imported/workbook/embedded Asset Master and asset registry sources',
   'Selector no longer depends only on EMBEDDED_EXCEL_DATA or window.ASSETS',
   'Duplicate instruction below the dropdown removed',
   'Clearing the selector leaves the result area blank',
   'Data-source changes refresh the Test & Explain selector so Excel and Synthetic modes remain aligned',
   'No Asset Health scoring weights, formulas, thresholds or asset evidence changed'
  ]
 };
})();
