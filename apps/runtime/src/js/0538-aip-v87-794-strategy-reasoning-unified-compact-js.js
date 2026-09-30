
(function(){
 if(window.__AIP_V796_STRATEGY_REASONING_EVENTS__)return;
 window.__AIP_V796_STRATEGY_REASONING_EVENTS__=true;
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 let timer=0;
 function visible(view){const x=document.getElementById('view-'+view);return !!(x&&x.classList.contains('active'));}
 function force(view){
   if(!VIEWS.includes(view))return;
   try{window.ms791RenderGraph?.(view)}catch(_){}
   const root=document.getElementById('view-'+view),ws=root?.querySelector('.ms686-workspace');
   if(!ws)return;
   [...ws.querySelectorAll('.ms686-card')].forEach(card=>{
     const title=card.querySelector(':scope>.ms686-head h3')?.textContent||'';
     if(!/Strategy Reasoning Graph/i.test(title))return;
     if(card.querySelector(':scope>.ms791-host')){
       card.querySelector(':scope>.ms686-kg')?.remove();
       card.querySelector(':scope>.ms686-active-note')?.remove();
     }
   });
 }
 function active(){return VIEWS.find(visible)||'';}
 function schedule(view,delay=24){clearTimeout(timer);timer=setTimeout(()=>force(view||active()),delay);}
 const originalRB=window.renderRiskBased;
 if(typeof originalRB==='function'&&!originalRB.__v796){
   const w=function(){const r=originalRB.apply(this,arguments);schedule('riskbased',24);return r};w.__v796=true;window.renderRiskBased=w;
 }
 const originalAdaptive=window.renderAdaptive;
 if(typeof originalAdaptive==='function'&&!originalAdaptive.__v796){
   const w=function(){const r=originalAdaptive.apply(this,arguments);schedule('adaptive',24);return r};w.__v796=true;window.renderAdaptive=w;
 }
 document.addEventListener('aip:data-source-changed',()=>schedule(active(),60));
 document.addEventListener('click',e=>{
   const tab=e.target?.closest?.('.aip-maint-subtabs [data-view],.aip-maint-subtabs button,.aip-maint-subtabs .ops-tab');
   if(tab)schedule('',24);
 },true);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule('',90),{once:true});else schedule('',90);
})();
