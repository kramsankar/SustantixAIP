
(function(){
 if(window.__AIP_V659_OBS)return; window.__AIP_V659_OBS=true;
 const boot=()=>{const r=document.getElementById('view-aivision');if(!r)return;
   const o=new MutationObserver(()=>{clearTimeout(window.__v659t);window.__v659t=setTimeout(aipVision659Augment,30)});
   o.observe(r,{childList:true,subtree:true}); setTimeout(aipVision659Augment,60);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
