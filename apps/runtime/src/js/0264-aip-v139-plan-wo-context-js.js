
(function(){
'use strict';
if(window.__AIP_V139_PLAN_WO_CONTEXT)return;
window.__AIP_V139_PLAN_WO_CONTEXT=true;

function woRoot(){return document.getElementById('view-workorderintelligence')}
function clearWOHighlight(){
 const root=woRoot(); if(!root)return;
 root.querySelectorAll('.aip-v139-plan-wo-target,.aip-v121-plan-target').forEach(x=>x.classList.remove('aip-v139-plan-wo-target','aip-v121-plan-target'));
 root.querySelectorAll('.aip-v139-wo-banner,.aip-v121-context-banner').forEach(x=>x.remove());
}
window.planV139ClearWOHighlight=clearWOHighlight;

function addBanner(id,intervention){
 const root=woRoot();if(!root)return;
 root.querySelectorAll('.aip-v139-wo-banner,.aip-v121-context-banner').forEach(x=>x.remove());
 const b=document.createElement('div');
 b.className='aip-v121-context-banner aip-v139-wo-banner';
 b.innerHTML='<b>Planning &amp; Optimization context · '+String(id||'')+(intervention?' · '+String(intervention):'')+'</b><button type="button" onclick="planV139ClearWOHighlight()">× Clear highlight</button>';
 const head=root.querySelector('.view-head'); if(head)head.insertAdjacentElement('afterend',b); else root.prepend(b);
}

function forceCurrentRenderer(){
 window.AIP_WO_DESIRED_TAB='ledger';
 try{if(typeof window.renderWorkOrderIntelligence==='function')window.renderWorkOrderIntelligence()}catch(_){ }
}

function focusExactWO(ctx,attempt){
 attempt=attempt||0;
 const root=woRoot(); const id=String(ctx?.workOrderId||ctx?.Work_Order_ID||'').trim();
 if(!root||!id){if(attempt<18)setTimeout(()=>focusExactWO(ctx,attempt+1),100);return false}
 window.AIP_WO_DESIRED_TAB='ledger';
 forceCurrentRenderer();
 const ledger=[...root.querySelectorAll('.ops-tab')].find(b=>/Work Order Ledger/i.test(b.textContent||''));
 if(ledger&&!ledger.classList.contains('active')){
   try{ledger.click()}catch(_){ }
   if(attempt<18)setTimeout(()=>focusExactWO(ctx,attempt+1),90);
   return false;
 }
 const inp=root.querySelector('#wo12-search,#aipWoLedgerSearch')||[...root.querySelectorAll('input')].find(x=>/Search WO, asset or site/i.test(x.placeholder||''));
 if(inp){inp.value=id;inp.dispatchEvent(new Event('input',{bubbles:true}))}
 try{window.aipSelectWoSource?.(id)}catch(_){ }
 let hit=root.querySelector('#wo12-table tbody tr[data-wo12-id="'+(window.CSS&&CSS.escape?CSS.escape(id):id.replace(/"/g,'\\"'))+'"]');
 if(!hit)hit=[...root.querySelectorAll('.ops-table tbody tr')].find(tr=>[...tr.querySelectorAll('td')].some(td=>(td.textContent||'').trim()===id));
 if(!hit){if(attempt<18)setTimeout(()=>focusExactWO(ctx,attempt+1),110);return false}
 clearWOHighlight();
 hit.hidden=false;
 hit.classList.add('aip-v139-plan-wo-target','aip-v121-plan-target','aip-wo-selected-row','aip-authoritative-match');
 addBanner(id,ctx?.interventionId||'');
 try{hit.scrollIntoView({block:'center',behavior:'auto'})}catch(_){ }
 return true;
}

/* The v121 wrapper intentionally avoided the original Planning source function for WO drills.
   Restore the original closure-backed function so the exact Work_Order_ID, Plant_ID and Asset_ID
   are resolved from the selected Planning record, then immediately replace the router's stale
   Work Order UI with the current authoritative renderer. */
function install(){
 const current=window.planOpenSource;
 if(typeof current!=='function'||current.__v139exact)return;
 const original=(current.__v121original&&typeof current.__v121original==='function')?current.__v121original:current;
 const exact=function(id,type){
   if(type!=='wo')return current.call(this,id,type);
   const scrollY=Number((document.scrollingElement||document.documentElement)?.scrollTop||window.scrollY||0);
   let ret;
   try{ret=original.call(this,id,'wo')}catch(e){console.error('Planning exact WO navigation failed',e);return}
   const ctx={...(window.AIP_CONTEXT_NAV||{})};
   ctx.source='Planning & Optimization'; ctx.interventionId=ctx.interventionId||id; ctx.target='workorderintelligence';
   window.AIP_CONTEXT_NAV=ctx;
   window.AIP_PLAN_EXTERNAL_RETURN={tab:'resources',selected:id,scrollY,interventionId:id,workOrderId:ctx.workOrderId||'',assetId:ctx.assetId||'',plantId:ctx.plantId||''};
   try{sessionStorage.setItem('aip.context.nav',JSON.stringify(ctx))}catch(_){ }
   window.AIP_WO_DESIRED_TAB='ledger';
   [0,25,70,140].forEach(ms=>setTimeout(forceCurrentRenderer,ms));
   [90,180,320,520,800].forEach((ms,i)=>setTimeout(()=>focusExactWO(ctx,i),ms));
   return ret;
 };
 exact.__v139exact=true; exact.__v139original=original;
 window.planOpenSource=exact;
}

/* Also normalize the current renderer after any programmatic entry carrying Planning context. */
const obs=new MutationObserver(()=>{
 const root=woRoot();
 if(!root?.classList.contains('active'))return;
 const ctx=window.AIP_CONTEXT_NAV||{};
 if(ctx.source==='Planning & Optimization'&&ctx.target==='workorderintelligence'&&ctx.workOrderId){
   if(!root.querySelector('#wo12-table'))setTimeout(forceCurrentRenderer,0);
 }
});
try{obs.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']})}catch(_){ }

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{install();setTimeout(install,300)});else{install();setTimeout(install,300)}
setTimeout(install,1200);
window.AIP_V139_AUDIT={release:'v139',baseline:'v138',area:'Planning & Optimization → Work Order Intelligence',uiOnly:true,excelBusinessDataChanged:false,changes:[
 'Plan & Resources Open Exact Work Order now resolves Work_Order_ID from the selected planning record through the original governed Planning data closure',
 'Programmatic Planning drill now forces the current authoritative Work Order Intelligence renderer instead of the stale router-held renderer',
 'Exact Work Order is filtered, selected and visibly highlighted in Work Order Ledger with Clear highlight',
 'Current Work Order KPI titles are left aligned on normal and contextual entry paths'
]};
})();
