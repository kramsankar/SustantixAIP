
(function(){
 function clean(){
   document.querySelectorAll('#view-models .aip335-status-badge b').forEach(b=>{
     b.style.setProperty('background','none','important');
     b.style.setProperty('background-color','transparent','important');
     b.style.setProperty('background-image','none','important');
     b.style.setProperty('border','none','important');
     b.style.setProperty('box-shadow','none','important');
     b.style.setProperty('padding','0','important');
     b.style.setProperty('border-radius','0','important');
   });
 }
 document.addEventListener('DOMContentLoaded',()=>setTimeout(clean,750));
 const old=window.renderModels;
 if(typeof old==='function')window.renderModels=function(){const r=old.apply(this,arguments);setTimeout(clean,0);return r};
})();
