
(function(){
 const strategyViews=['preventive','predictive','corrective','riskbased','adaptive'];
 function enforce(view){
   if(!strategyViews.includes(view))return;
   const root=document.getElementById('view-'+view);if(!root)return;
   const tabs=root.querySelector(':scope>.aip-maint-subtabs');
   const chain=root.querySelector(':scope>.aip675-strategy-chain');
   if(tabs&&chain&&tabs.nextElementSibling!==chain) tabs.insertAdjacentElement('afterend',chain);
 }
 function enforceActive(){
   const a=document.querySelector('#main>.view.active[id^="view-"]');
   if(a)enforce(a.id.replace('view-',''));
 }
 document.addEventListener('click',()=>requestAnimationFrame(()=>requestAnimationFrame(enforceActive)),true);
 document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(()=>requestAnimationFrame(enforceActive)));
 window.addEventListener('load',()=>setTimeout(enforceActive,100));
 const mo=new MutationObserver(()=>enforceActive());
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mo.observe(document.body,{subtree:true,childList:true}),{once:true});
 else mo.observe(document.body,{subtree:true,childList:true});
})();
