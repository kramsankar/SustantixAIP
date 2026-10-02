
(function(){
 'use strict';
 window.AIP_CLEAR_ATV_TARGET_CONTEXT=function(){
   document.querySelectorAll('.atv528-exact-target,.atv527-exact-target').forEach(x=>x.classList.remove('atv528-exact-target','atv527-exact-target'));
   document.querySelectorAll('.atv528-context-banner').forEach(x=>x.remove());
   window.AIP_ATV_TARGET_CONTEXT=null;
 };
 document.addEventListener('click',function(e){
   const nav=e.target?.closest?.('.nav-item[data-view]');
   if(!nav)return;
   const target=nav.dataset.view||'';
   const ctx=window.AIP_ATV_TARGET_CONTEXT;
   if(ctx&&target&&target!==ctx.target)window.AIP_CLEAR_ATV_TARGET_CONTEXT();
 },true);
})();
