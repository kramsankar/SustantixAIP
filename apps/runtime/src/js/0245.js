
(function(){
 if(window.__AIP_V114_PLAN_BACK_INSTALLED)return;window.__AIP_V114_PLAN_BACK_INSTALLED=true;
 document.addEventListener('click',function(e){
   const b=e.target?.closest?.('#aipBackBtn');
   if(!b||!window.AIP_PLAN_STATUS_RETURN)return;
   const view=document.getElementById('view-resourceplanning');
   if(!view?.classList.contains('active'))return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   const ret=window.AIP_PLAN_STATUS_RETURN;window.AIP_PLAN_STATUS_RETURN=null;
   try{planCloseDrawer?.()}catch(_){ }
   try{
     const state=window.AIP_PLAN_STATE||null;
     if(typeof planSetTab==='function'){
       if(ret.selected&&typeof planSelect==='function'){ planSelect(ret.selected,ret.tab||'overview'); }
       else planSetTab(ret.tab||'overview');
     }
   }catch(_){ }
 },true);
 window.AIP_V114_AUDIT={release:'v1.14',baseline:'v1.13',area:'Planning & Optimization',uiOnly:true,excelBusinessDataChanged:false,changes:['Increased Planning Gaps, Scheduling Constraints, Awaiting Approval and Execution Blockers count/label typography','Removed repeated Required Completion/date/All Sites context from Intervention Plan Status detail drawers','Added contextual Back return from status-detail Open actions to the originating Planning & Optimization Overview state','Renamed Constraint distribution to Constraints by Type and made each constraint type actionable','Removed static Selected Context/click dependency caption from Selected intervention dependency status']};
})();
