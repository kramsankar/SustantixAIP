
(function(){
 if(window.__AIP_V661_OBS)return;window.__AIP_V661_OBS=true;
 const boot=()=>{const r=document.getElementById('view-aivision');if(!r)return;
 const o=new MutationObserver(()=>{clearTimeout(window.__v661t);window.__v661t=setTimeout(aipVision661Augment,35)});
 o.observe(r,{childList:true,subtree:true});setTimeout(aipVision661Augment,90);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
