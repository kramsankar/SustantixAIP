
(function(){
 const U=window.PLAN_UI=window.PLAN_UI||{};
 if(typeof U.recommendationLocked!=='boolean') U.recommendationLocked=false;
 U.governanceLog=U.governanceLog||[];

 function rerenderAndFocusGovernance(){
   if(typeof render==='function') render();
   else if(window.AIP_V21?.renderers?.resourceplanning) window.AIP_V21.renderers.resourceplanning();
   setTimeout(()=>{
     const panel=document.querySelector('#view-resourceplanning .po263-governance');
     if(panel){
       panel.scrollIntoView({behavior:'smooth',block:'center'});
       const sel=panel.querySelector('#po218Decision');
       if(sel && !sel.disabled) sel.focus({preventScroll:true});
     }
   },60);
 }

 window.planSubmitRecommendationForGovernance=function(){
   if(!U.optResult || !U.optResult.runId){
     alert('Run optimization before submitting a recommended plan for governance.');
     return;
   }
   U.recommendationLocked=true;
   U.planGovernance=U.planGovernance||{};
   U.planGovernance.status='Pending Governance';
   U.governanceLog.push({
     at:new Date().toISOString(),
     decision:'Submitted for Governance',
     plan:U.selectedAlternative||'baseline',
     runId:U.optResult.runId
   });
   rerenderAndFocusGovernance();
 };

 window.planGovernSelected=function(decision){
   if(!U.recommendationLocked){
     alert('Submit the recommended plan for governance before applying a governance decision.');
     return;
   }
   const now=new Date().toISOString();
   const plan=U.selectedAlternative||'baseline';
   U.planGovernance=U.planGovernance||{};
   if(decision==='Return for Re-optimization'){
     U.planGovernance.status='Returned for Re-optimization';
     U.governanceLog.push({at:now,decision,plan,runId:U.optResult?.runId||null});
     U.recommendationLocked=false;
   }else if(decision==='Approve with Conditions'){
     U.planGovernance.status='Approved with Conditions';
     U.governanceLog.push({at:now,decision,plan,runId:U.optResult?.runId||null});
     U.recommendationLocked=true;
   }else{
     U.planGovernance.status='Approved';
     U.governanceLog.push({at:now,decision:'Approve Recommended Plan',plan,runId:U.optResult?.runId||null});
     U.recommendationLocked=true;
   }
   rerenderAndFocusGovernance();
 };
})();
