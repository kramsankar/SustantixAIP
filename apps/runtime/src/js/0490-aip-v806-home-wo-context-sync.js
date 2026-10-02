
(function(){'use strict';
 const previous=window.AIPHomeOpenAttentionExact;
 function woRoot(){return document.getElementById('view-workorderintelligence')}
 function clearWOContext(){
   const root=woRoot();
   if(root){
     root.querySelectorAll('.aip806-home-wo-context-hit').forEach(x=>x.classList.remove('aip806-home-wo-context-hit'));
     root.querySelectorAll('.aip776-home-action-hit').forEach(x=>x.classList.remove('aip776-home-action-hit'));
     root.querySelectorAll('.aip776-home-action-banner').forEach(x=>x.remove());
   }
   window.AIP_HOME_WO_CONTEXT_ID='';
 }
 function markExact(id,attempt){
   const root=woRoot(); if(!root)return;
   root.querySelectorAll('.aip806-home-wo-context-hit').forEach(x=>x.classList.remove('aip806-home-wo-context-hit'));
   const rows=[...root.querySelectorAll('#wo12-table tbody tr[data-wo12-id],tbody tr[data-wo12-id]')];
   const hit=rows.find(r=>String(r.getAttribute('data-wo12-id')||'')===String(id));
   if(hit){
     hit.classList.add('aip806-home-wo-context-hit');
     hit.scrollIntoView?.({block:'center',behavior:'auto'});
     return;
   }
   if((attempt||0)<40)setTimeout(()=>markExact(id,(attempt||0)+1),40);
 }
 function addBanner(meta){
   const root=woRoot(); if(!root)return;
   root.querySelectorAll('.aip776-home-action-banner').forEach(x=>x.remove());
   const b=document.createElement('div'); b.className='aip776-home-action-banner';
   const label=String(meta.title||meta.id||'Selected work order');
   b.innerHTML='<span>Operations Hub action context · '+label+' · exact work order '+String(meta.id||'')+' selected</span><button type="button" aria-label="Clear Operations Hub action context">×</button>';
   const anchor=root.querySelector('.view-head')||root.firstElementChild;
   if(anchor)anchor.insertAdjacentElement('afterend',b);else root.prepend(b);
   b.querySelector('button').onclick=function(e){e.stopPropagation();clearWOContext()};
 }
 window.AIPHomeOpenAttentionExact=function(meta){
   meta=meta||{};
   const isWO=(meta.type==='Work Order'||meta.view==='workorderintelligence')&&meta.id;
   if(!isWO)return typeof previous==='function'?previous(meta):undefined;
   window.__aipLastUserNavTime=Date.now();
   window.AIP_HOME_WO_CONTEXT_ID=String(meta.id);
   try{window.AIPHideHome?.()}catch(_){}
   try{if(typeof window.activate==='function')window.activate('workorderintelligence')}catch(_){}
   let tries=0;
   const ready=function(){
     const root=woRoot();
     if(!root||!root.classList.contains('active')){if(tries++<40)return setTimeout(ready,40);return}
     // Home attention always resolves against the authoritative ledger so the exact source row is visible.
     try{window.AIP_WO_DESIRED_TAB='ledger'; if(typeof window.renderWorkOrderIntelligence==='function')window.renderWorkOrderIntelligence()}catch(_){}
     setTimeout(function(){
       addBanner(meta);
       markExact(meta.id,0);
       // Open the exact governed WO detail. Closing the detail drawer intentionally leaves
       // the Home context + row highlight in place until the context × is closed.
       try{if(typeof window.opsOpenWO==='function')window.opsOpenWO(meta.id)}catch(_){}
       setTimeout(()=>markExact(meta.id,0),80);
     },40);
   };
   ready();
 };
 // Preserve the exact Home row highlight if the WO ledger is re-rendered while context remains active.
 const obs=new MutationObserver(function(){
   const id=window.AIP_HOME_WO_CONTEXT_ID;
   if(id)setTimeout(()=>markExact(id,0),0);
 });
 const boot=function(){const root=woRoot();if(root)obs.observe(root,{childList:true,subtree:true})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.AIPClearHomeWOContext=clearWOContext;
 window.AIP_V806_AUDIT={release:'v806',baseline:'v805',change:'Operations Hub work-order context synchronized with exact Work Order Ledger row; context close clears both banner and row highlight',excelBusinessDataChanged:false};
 window.AIP_V813_AUDIT={release:'v813',baseline:'v812',change:'Save Update clears Operations Hub work-order context and exact ledger row highlight through the same governed clear-context function',excelBusinessDataChanged:false};
 window.AIP_CURRENT_BUILD='v813';
})();
