
(function(){
 if(window.__AIP_V663_OBS)return;window.__AIP_V663_OBS=true;
 const boot=()=>{const r=document.getElementById('view-aivision');if(!r)return;
 const o=new MutationObserver(()=>{clearTimeout(window.__v663t);window.__v663t=setTimeout(aipVision663Augment,25)});
 o.observe(r,{childList:true,subtree:true});setTimeout(aipVision663Augment,70);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
