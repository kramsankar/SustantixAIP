
(function(){
 'use strict';
 function enforce(){
   const view=document.getElementById('view-workorderintelligence');
   if(!view)return;
   const authoritative=view.querySelector('#aipAuthoritativeWoBanner');
   if(authoritative){
     view.querySelectorAll('#aipWoExactFocusBanner,.ax-context-banner').forEach(el=>el.remove());
     const duplicates=view.querySelectorAll('#aipAuthoritativeWoBanner');
     duplicates.forEach((el,i)=>{if(i>0)el.remove()});
   }
 }
 document.addEventListener('click',e=>{
   if(e.target.closest('#view-assetexplorer .ax-capability[data-ax-cap="workorderintelligence"]')){
     setTimeout(enforce,350);setTimeout(enforce,900);setTimeout(enforce,1600);
   }
 },true);
 new MutationObserver(enforce).observe(document.documentElement,{childList:true,subtree:true});
})();
