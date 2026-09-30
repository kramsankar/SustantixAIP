
(function(){
 'use strict';
 const FACTS={
   'DEC-006':{
     status:'Review required',
     approval:'Not Started',
     scheduling:'Not Started',
     execution:'Not Started',
     verification:'Not Started',
     workOrder:'',
     blocker:'Cleaning window not confirmed; cleaning intervention approval pending.'
   },
   'DEC-014':{
     status:'Resource review',
     approval:'Not Started',
     scheduling:'Not Started',
     execution:'Not Started',
     verification:'Not Started',
     workOrder:'',
     blocker:'Next low-resource cleaning window not selected; resource-use approval pending.'
   }
 };
 function baseId(id){return String(id||'').replace(/^SYN-/,'')}
 function decorate(){
   const S=window.AIP_DI_V401_STATE;
   const id=baseId(S?.selected||window.AIP_DI_SELECTED_CONTEXT?.decisionId||'');
   const f=FACTS[id];
   const root=document.getElementById('view-decisionintelligence');
   if(!f||!root?.classList.contains('active')||S?.tab!=='workspace'||S?.stage!=='execution')return;
   if(root.querySelector('.aip-v587-esg-exec-note'))return;
   const host=root.querySelector('.di401-workspace,.di401-card,.di401-workspace-body')||root.querySelector('.di401-thread')?.parentElement;
   if(!host)return;
   const n=document.createElement('div');
   n.className='aip-v587-esg-exec-note';
   n.innerHTML=`<b>${id} · Execution / Handoff status</b><br>
   Current decision status: <b>${f.status}</b> · Approval: <b>${f.approval}</b> · Scheduling: <b>${f.scheduling}</b> · Execution: <b>${f.execution}</b> · Verification: <b>${f.verification}</b><br>
   Governed work order: <b>None yet</b> · ${f.blocker}`;
   const thread=root.querySelector('.di401-thread');
   if(thread)thread.insertAdjacentElement('afterend',n);else host.prepend(n);
 }
 const root=document.getElementById('view-decisionintelligence');
 if(root)new MutationObserver(()=>requestAnimationFrame(decorate)).observe(root,{childList:true,subtree:true});
 document.addEventListener('click',()=>setTimeout(decorate,0),true);
 window.AIP_V587_ESG_EXECUTION_AUDIT={
   release:'v587',
   baseline:'v586',
   decisions:['DEC-006','DEC-014'],
   finding:'No governed Work Order or Planning record is linked to either decision. Approval, scheduling, execution and verification are all Not Started.',
   correction:'Execution / Handoff now opens Decision Intelligence > Execution & Handoff for the selected decision instead of returning to the CLN evidence row.',
   workOrders:{'DEC-006':null,'DEC-014':null},
   excelBusinessDataChanged:false
 };
 window.AIP_CURRENT_BUILD='v587';
})();
