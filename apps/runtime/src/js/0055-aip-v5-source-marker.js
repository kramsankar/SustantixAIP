
(function(){
 const ids=['decisionintelligence','financialimpact','scenariosimulator','decisiontraceability','closedloopexecution','benefitsrealization','reliabilityengineering','portfoliobenchmarking','aigovernance'];
 function mark(){
   const mode=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'');
   const label=mode==='Demo data'?'SYNTHETIC DATA SET':(mode==='Excel demo data'?'BUNDLED EXCEL DATA':'UPLOADED DATA');
   ids.forEach(id=>{
     const v=document.getElementById('view-'+id); if(!v||!v.innerHTML)return;
     let b=v.querySelector('.aip-v5-source-badge');
     if(!b){
       b=document.createElement('div'); b.className='aip-v5-source-badge';
       b.style.cssText='display:inline-flex;margin:0 0 12px;padding:5px 10px;border-radius:999px;background:#E7EEF5;color:#2A5C8A;font-size:10.75px;font-weight:700;letter-spacing:.04em';
       v.insertBefore(b,v.firstChild);
     }
     b.textContent=label;
   });
 }
 const original=window.refreshAllAPM;
 if(typeof original==='function') window.refreshAllAPM=function(){const r=original.apply(this,arguments);setTimeout(mark,0);return r;};
 document.addEventListener('click',e=>{if(e.target.closest('#loadExcelOption,#loadSyntheticOption'))setTimeout(mark,250)},true);
 setTimeout(mark,500);
})();
