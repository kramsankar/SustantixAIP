
(function(){
 'use strict';
 const legacyLabels=/Pre-Planning|Crew\s*&\s*Skill Readiness|Plan Approval|Opportunity\s*&\s*Outage|Opportunistic\s*(?:and|&)\s*Outage|Spares\s*&\s*Materials/i;
 let busy=false;
 function clean(){
   const root=document.getElementById('view-spares');if(!root)return;
   root.querySelectorAll(':scope > .aip675-plan-tabs,:scope > .aip675-plan-role').forEach(n=>n.remove());
   const hasNew=!!root.querySelector(':scope > .msi-head');
   const polluted=legacyLabels.test(root.textContent||'');
   if(root.classList.contains('active')&&(!hasNew||polluted)&&!busy&&typeof window.renderMaintenanceSparesIntelligence==='function'){
     busy=true;try{window.renderMaintenanceSparesIntelligence()}finally{requestAnimationFrame(()=>{busy=false})}
   }
 }
 function navIcon(){const b=document.querySelector('#sidebar .nav-item[data-view="spares"]');if(!b)return;b.classList.add('msi-nav-item');b.innerHTML='<span class="msi-nav-icon" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>Maintenance Spares Intelligence</span>'}
 const root=document.getElementById('view-spares');
 if(root)new MutationObserver(()=>{if(!busy)setTimeout(clean,0)}).observe(root,{childList:true,subtree:false});
 document.addEventListener('click',()=>setTimeout(()=>{navIcon();clean()},10),true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(clean,20));
 window.addEventListener('load',()=>setTimeout(()=>{navIcon();clean()},80));
 setTimeout(()=>{navIcon();clean()},0);
 window.AIP_V565_AUDIT={release:'v565',baseline:'v564',correction:'Removed Maintenance Spares Intelligence from the legacy Planning & Execution decorator and made the five-tab MSI renderer authoritative.',rightPaneTabs:['Overview','Demand Intelligence','Availability & Risk','Optimize & Recommend','Governance & Handoff'],forbiddenLegacyUI:['Pre-Planning','Crew & Skill Readiness','Plan Approval','Opportunity & Outage'],dedicatedLeftPaneIcon:true,excelBusinessDataChanged:false};
})();
window.AIP_CURRENT_BUILD='v565';
