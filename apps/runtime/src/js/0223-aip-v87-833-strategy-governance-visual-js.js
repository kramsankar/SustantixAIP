
(function(){
 'use strict';
 function decorate(){
   document.querySelectorAll('.aip831-gov-btn').forEach(btn=>{
     if(btn.dataset.aip833==='1')return;
     btn.dataset.aip833='1';
     btn.setAttribute('aria-expanded','false');
     btn.innerHTML='<span class="aip833-gov-label">Strategy Governance</span><span class="aip833-gov-symbol" aria-hidden="true"></span>';
     const old=btn.onclick;
     btn.onclick=function(ev){
       if(typeof old==='function')old.call(this,ev);
       const panel=this.closest('.aip831-strategy-gov')?.nextElementSibling;
       const open=!!panel?.classList.contains('open');
       this.setAttribute('aria-expanded',open?'true':'false');
     };
   });
 }
 const mo=new MutationObserver(decorate);mo.observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('DOMContentLoaded',decorate);setTimeout(decorate,0);setTimeout(decorate,300);
 window.AIP_V833_AUDIT={release:'v87_834',baseline:'v87_832',area:'Maintenance Strategy',uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,changes:['Color Strategy Governance control in deep plum with white separator/chevron icon','Restore numbered 1–5 governance pathway','Restore differentiated pastel node colors and colored number badges','Preserve compact collapsed governance design and existing contextual values']};
})();
