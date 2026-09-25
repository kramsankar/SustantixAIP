
(function(){
 const durations={"INT-001":8,"INT-002":6,"INT-003":10,"INT-004":8,"INT-005":4,"INT-006":16,"INT-007":8,"INT-008":24,"INT-009":6,"INT-010":12,"INT-011":8,"INT-012":16,"INT-013":4,"INT-014":8,"INT-015":24,"INT-016":32,"INT-017":6,"INT-018":8,"INT-019":16,"INT-020":4,"INT-021":12,"INT-022":24,"INT-023":8};
 const statuses={"INT-001":"Approved","INT-002":"Approved","INT-003":"Approved","INT-004":"Approved","INT-005":"Approved","INT-006":"Approved"};
 function sync(root){
   const a=root&&root.PLAN_Interventions;if(!Array.isArray(a))return;
   a.forEach(r=>{if(durations[r.Intervention_ID]!=null)r.Duration_Hours=durations[r.Intervention_ID];if(statuses[r.Intervention_ID])r.Planning_Status=statuses[r.Intervention_ID];});
 }
 function apply(){
   try{sync(window.EMBEDDED_EXCEL_DATA)}catch(_e){}
   try{sync(window.AIP_INDEPENDENT_SYNTHETIC_DATA&&window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData)}catch(_e){}
 }
 apply();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
})();
