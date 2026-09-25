
(function(){
 const planViews=[
  ['resourceplanning','Pre-Planning'],
  ['crewscheduling','Crew & Skill Readiness'],
  ['approval','Plan Approval'],
  ['closedloopexecution','Execution Flow'],
  ['prescriptive','Recommended Actions'],
  ['opportunistic','Opportunity & Outage']
 ];
 const roles={
  resourceplanning:['Intervention readiness','Assess scope, constraints, required resources and execution feasibility before ERP/EAM commitment.','AIP evaluates · ERP plans'],
  crewscheduling:['Crew & skill readiness','Show skill, certification, availability and SLA constraints; crew assignment remains an ERP/EAM transaction.','AIP assures · ERP assigns'],
  spares:['Spares & material readiness','Evaluate intervention-critical stock, reservation, shortage and lead-time risk; inventory transactions remain in ERP/EAM.','AIP assesses · ERP reserves'],
  approval:['Plan approval & governance','Approve or return the AIP-recommended intervention plan; operational release and transactional approvals remain in ERP/EAM.','AIP governs · ERP releases'],
  closedloopexecution:['Execution flow','Track the intervention from recommendation through ERP/EAM execution to AIP outcome verification without duplicating technician transactions.','AIP monitors · ERP executes'],
  prescriptive:['Recommended actions','Use cross-domain risk, condition, value and constraint intelligence to recommend the next best maintenance action.','AIP recommends'],
  opportunistic:['Opportunity & outage','Identify the best intervention window using outage, generation, risk and readiness context; ERP/EAM commits the schedule.','AIP optimizes · ERP schedules']
 };
 const strategyViews=['preventive','predictive','corrective','riskbased','adaptive'];

 function activeView(){return document.querySelector('#main>.view.active')?.id?.replace('view-','')||''}

 window.aip675OpenPlanning=function(view){
   if(typeof window.activate==='function')window.activate(view);
   else document.querySelector(`#sidebar .nav-item[data-view="${view}"]`)?.click();
   setTimeout(()=>decoratePlanning(view),0);
 };

 function decoratePlanning(view){
   if(!planViews.some(x=>x[0]===view))return;
   const root=document.getElementById('view-'+view);if(!root)return;
   root.querySelectorAll(':scope>.aip675-plan-tabs,:scope>.aip675-plan-role').forEach(n=>n.remove());
   const tabs=document.createElement('div');tabs.className='aip675-plan-tabs';
   tabs.innerHTML=planViews.map(([v,l])=>`<button type="button" class="${v===view?'active':''}" onclick="aip675OpenPlanning('${v}')">${l}</button>`).join('');
   const role=document.createElement('div');role.className='aip675-plan-role';
   const r=roles[view];role.innerHTML=`<b>${r[0]}</b><span>${r[1]}</span><em>${r[2]}</em>`;
   const head=root.querySelector(':scope>.view-head')||root.firstElementChild;
   if(head){head.insertAdjacentElement('afterend',role);head.insertAdjacentElement('afterend',tabs)}
   else{root.prepend(role);root.prepend(tabs)}
   document.querySelectorAll('#sidebar .nav-item').forEach(n=>n.classList.remove('aip675-parent-active'));
   document.querySelector('#sidebar .aip675-planning-parent')?.classList.add('aip675-parent-active');
 }

 function decorateStrategy(view){
   if(!strategyViews.includes(view))return;
   const root=document.getElementById('view-'+view);if(!root)return;
   let chain=root.querySelector(':scope>.aip675-strategy-chain');
   if(!chain){
     chain=document.createElement('div');chain.className='aip675-strategy-chain';
     chain.innerHTML=`<div><small>Engineering authority</small><b>RCM governed policy</b></div><div><small>Strategy</small><b>${view==='riskbased'?'Risk-Based':view[0].toUpperCase()+view.slice(1)}</b></div><div><small>Trigger / interval</small><b>Evidence-driven requirement</b></div><div><small>ERP/EAM implementation</small><b>Plan / work-order reference</b></div><div><small>AIP governance</small><b>Conformance / exception</b></div>`;
   }
   /* v87_686: deterministic order. The grouped Maintenance Strategy tabs always
      stay above the Engineering Authority chain, regardless of renderer timing. */
   const tabs=root.querySelector(':scope>.aip-maint-subtabs');
   const head=root.querySelector(':scope>.view-head')||root.firstElementChild;
   if(tabs)tabs.insertAdjacentElement('afterend',chain);
   else if(head)head.insertAdjacentElement('afterend',chain);
   else root.prepend(chain);
 }

 function decorate(){
   const v=activeView();
   if(planViews.some(x=>x[0]===v))decoratePlanning(v);
   if(strategyViews.includes(v))decorateStrategy(v);
 }
 window.aip675DecorateStrategy=decorateStrategy;
 window.aip675DecorateMaintenanceArchitecture=decorate;
 document.addEventListener('click',()=>setTimeout(decorate,20),true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(decorate,30));
 window.addEventListener('load',()=>setTimeout(decorate,80));
})();
