
(function(){
 if(window.__AIP_V796_PREVENTIVE_FIRST_ENTRY_REASONING_FIX__)return;
 window.__AIP_V796_PREVENTIVE_FIRST_ENTRY_REASONING_FIX__=true;
 let timer=0;
 function card(){
   const root=document.getElementById('view-preventive');
   if(!root)return null;
   return [...root.querySelectorAll('.ms686-card')].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''))||null;
 }
 function force(){
   const c=card(); if(!c)return false;
   try{window.ms791RenderGraph?.('preventive')}catch(_){return false}
   const fresh=card();
   if(fresh?.querySelector(':scope>.ms791-host')){
     fresh.querySelector(':scope>.ms686-kg')?.remove();
     fresh.querySelector(':scope>.ms686-active-note')?.remove();
     fresh.removeAttribute('data-v795-reasoning-pending');
     return true;
   }
   return false;
 }
 function schedule(delay=20){clearTimeout(timer);timer=setTimeout(force,delay);}
 const original=window.renderPreventive;
 if(typeof original==='function'&&!original.__v796){
   const w=function(){
     const result=original.apply(this,arguments);
     const c=card();if(c)c.dataset.v795ReasoningPending='1';
     schedule(20);
     return result;
   };w.__v796=true;window.renderPreventive=w;
 }
 document.addEventListener('click',e=>{
   if(e.target?.closest?.('[data-view="preventive"]'))schedule(24);
 },true);
 window.addEventListener('aip:runtime-ready',()=>schedule(50),{once:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(70),{once:true});else schedule(70);
})();
