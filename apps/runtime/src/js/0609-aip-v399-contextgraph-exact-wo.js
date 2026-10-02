
(function(){
 'use strict';
 function escCss(v){try{return CSS.escape(String(v))}catch(_){return String(v).replace(/["\\]/g,'\\$&')}}
 function clearContext(){
   const root=document.getElementById('view-workorderintelligence');if(!root)return;
   root.querySelectorAll('.aip399-cg-wo-target').forEach(r=>r.classList.remove('aip399-cg-wo-target'));
   root.querySelectorAll('.aip399-cg-wo-banner').forEach(n=>n.remove());
   const search=root.querySelector('#wo12-search');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}))}
   const status=root.querySelector('#wo12-status-filter');if(status&&status.value!=='All'){status.value='All';status.dispatchEvent(new Event('change',{bubbles:true}))}
 }
 window.AIP_CG_CLEAR_WO_CONTEXT=clearContext;

 function focusExact(id,attempt=0){
   const root=document.getElementById('view-workorderintelligence');
   if(!root){if(attempt<12)setTimeout(()=>focusExact(id,attempt+1),80);return false}
   window.AIP_WO_DESIRED_TAB='ledger';
   try{window.__AIP_WO_STABLE_RENDER?.()}catch(_){}
   const ledger=root.querySelector('.ops-tab[data-wo12-tab="ledger"]');
   if(ledger&&!ledger.classList.contains('active')){
     try{ledger.click()}catch(_){}
     if(attempt<12)setTimeout(()=>focusExact(id,attempt+1),80);
     return false
   }
   const status=root.querySelector('#wo12-status-filter');if(status&&status.value!=='All'){status.value='All';status.dispatchEvent(new Event('change',{bubbles:true}))}
   const search=root.querySelector('#wo12-search');if(search){search.value=String(id);search.dispatchEvent(new Event('input',{bubbles:true}))}
   const row=root.querySelector(`#wo12-table tbody tr[data-wo12-id="${escCss(id)}"]`);
   if(!row){if(attempt<12)setTimeout(()=>focusExact(id,attempt+1),100);return false}
   root.querySelectorAll('.aip399-cg-wo-target').forEach(r=>r.classList.remove('aip399-cg-wo-target'));
   root.querySelectorAll('.aip399-cg-wo-banner').forEach(n=>n.remove());
   row.hidden=false;row.classList.add('aip399-cg-wo-target');
   const banner=document.createElement('div');banner.className='aip399-cg-wo-banner';
   banner.innerHTML=`<span>Operational Impact Graph context · Work Order <b>${String(id)}</b></span><button type="button" title="Clear Work Order context" aria-label="Clear Work Order context">×</button>`;
   banner.querySelector('button').onclick=clearContext;
   const tabs=root.querySelector('.ops-tabs'),head=root.querySelector('.view-head,.xi-head');
   if(tabs)tabs.insertAdjacentElement('afterend',banner);else if(head)head.insertAdjacentElement('afterend',banner);else root.prepend(banner);
   try{row.scrollIntoView({behavior:'auto',block:'center'})}catch(_){}
   return true
 }
 window.AIP_CG_FOCUS_EXACT_WO=id=>focusExact(String(id),0);

 function restore(){
   const ret=window.AIP_CG_WO_RETURN;if(!ret)return false;
   clearContext();
   window.AIP_CG_SITE=ret.site||'ALL';window.AIP_CG_LENS=ret.lens||'All';window.AIP_CG_TRACE=ret.trace||'all';window.AIP_CONTEXT_GRAPH_ISSUE=ret.issueId||'';
   window.AIP_CG_WO_RETURN=null;
   try{window.activate?.('contextgraph')}catch(_){document.querySelector('#sidebar [data-view="contextgraph"]')?.click()}
   requestAnimationFrame(()=>{try{window.refreshOperationalImpactGraph?.()}catch(_){}});
   return true
 }
 document.addEventListener('click',e=>{
   const b=e.target?.closest?.('#aipBackBtn');if(!b||!window.AIP_CG_WO_RETURN)return;
   const active=document.querySelector('.view.active[id^="view-"]')?.id?.replace('view-','')||'';
   if(active!=='workorderintelligence')return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restore()
 },true);
 document.addEventListener('keydown',e=>{
   if(!(e.altKey&&e.key==='ArrowLeft')||!window.AIP_CG_WO_RETURN)return;
   const active=document.querySelector('.view.active[id^="view-"]')?.id?.replace('view-','')||'';
   if(active!=='workorderintelligence')return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restore()
 },true);

 window.AIP_V399_AUDIT={
  release:'v399',baseline:'v398',scope:'Operational Impact Graph exact Work Order contextual navigation',
  uiOnly:true,excelChanged:false,syntheticBusinessDataChanged:false,
  changes:[
   'Uses the existing governed Work Order ID already linked to Operational Impact Graph maintenance/predictive issues',
   'Open Work Order opens Work Order Ledger and filters to the exact linked Work Order',
   'Exact row is highlighted light pink and scrolled into view',
   'Context banner includes × to clear highlight and restore the full ledger',
   'Back and Alt+Left return to the same Operational Impact Graph Site/lens/trace/selected issue',
   'No Work Order ID is invented when a governed link is absent'
  ]
 };
})();
