
(function(){
 if(window.__AIP_V660_OBS)return;window.__AIP_V660_OBS=true;
 const boot=()=>{const r=document.getElementById('view-aivision');if(!r)return;
 const o=new MutationObserver(()=>{clearTimeout(window.__v660t);window.__v660t=setTimeout(aipVision660Augment,35)});
 o.observe(r,{childList:true,subtree:true});setTimeout(aipVision660Augment,80);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
