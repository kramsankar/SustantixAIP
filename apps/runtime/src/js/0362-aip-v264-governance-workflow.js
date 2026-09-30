
(function(){
 const U=window.PLAN_UI=window.PLAN_UI||{};
 if(typeof U.recommendationLocked!=='boolean') U.recommendationLocked=false;
 U.governanceLog=U.governanceLog||[];
 window.planGovernSelected=function(decision){
   const now=new Date().toISOString();
   const plan=U.selectedAlternative||'baseline';
   if(decision==='Return for Re-optimization'){
     U.planGovernance=U.planGovernance||{};
     U.planGovernance.status='Returned for Re-optimization';
     U.governanceLog.push({at:now,decision,plan});
     U.recommendationLocked=false;
   }else if(decision==='Approve with Conditions'){
     U.planGovernance=U.planGovernance||{};
     U.planGovernance.status='Approved with Conditions';
     U.governanceLog.push({at:now,decision,plan});
     U.recommendationLocked=true;
   }else{
     U.planGovernance=U.planGovernance||{};
     U.planGovernance.status='Approved';
     U.governanceLog.push({at:now,decision:'Approve Recommended Plan',plan});
     U.recommendationLocked=true;
   }
   if(typeof render==='function') render();
   else if(window.AIP_V21?.renderers?.resourceplanning) window.AIP_V21.renderers.resourceplanning();
 };
})();
