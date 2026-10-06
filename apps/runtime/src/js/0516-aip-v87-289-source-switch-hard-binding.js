
(function(){
 'use strict';
 function refreshOperationalImpactAfterSource(){
   window.AIP_CONTEXT_GRAPH_ISSUE='';
   window.AIP_CG_TRACE='all';
   try{window.refreshOperationalImpactGraph?.()}catch(_){}
   try{
     if(document.querySelector('.view.active')?.id==='view-contextgraph'&&typeof renderGraph==='function')renderGraph();
   }catch(_){}
 }
 if(typeof window.loadSyntheticDemoData==='function'&&!window.loadSyntheticDemoData.__cg289){
   const original=window.loadSyntheticDemoData;
   const wrapped=async function(){
     const result=await original.apply(this,arguments);
     window.AIP_SYNTHETIC_ACTIVE=true;
     refreshOperationalImpactAfterSource();
     requestAnimationFrame(refreshOperationalImpactAfterSource);
     setTimeout(refreshOperationalImpactAfterSource,120);
     return result;
   };
   wrapped.__cg289=true;
   window.loadSyntheticDemoData=wrapped;
   try{loadSyntheticDemoData=wrapped}catch(_){}
 }
 if(typeof window.loadExcelDemoData==='function'&&!window.loadExcelDemoData.__cg289){
   const original=window.loadExcelDemoData;
   const wrapped=async function(){
     const result=await original.apply(this,arguments);
     window.AIP_SYNTHETIC_ACTIVE=false;
     refreshOperationalImpactAfterSource();
     requestAnimationFrame(refreshOperationalImpactAfterSource);
     setTimeout(refreshOperationalImpactAfterSource,120);
     return result;
   };
   wrapped.__cg289=true;
   window.loadExcelDemoData=wrapped;
   try{loadExcelDemoData=wrapped}catch(_){}
 }
 ['aip:data-source-changed','apm:datasource-refreshed'].forEach(evt=>{
   document.addEventListener(evt,()=>{
     refreshOperationalImpactAfterSource();
     setTimeout(refreshOperationalImpactAfterSource,80);
   });
 });
 window.AIP_VERIFY_CONTEXT_GRAPH_SOURCE=function(){
   return {
     mode:String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:''),
     synthetic:window.AIP_SYNTHETIC_ACTIVE===true,
     signature:window.AIPContextGraphSourceSignature?.()||'',
     issueCount:(typeof contextIssueRegistry==='function'?contextIssueRegistry().length:null)
   };
 };
})();
