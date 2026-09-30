
(function(){
'use strict';
if(window.__AIP_V87242_LOSS_READY__)return;
window.__AIP_V87242_LOSS_READY__=true;

function activeLossNeedsData(){
 const host=document.getElementById('view-portfoliobenchmarking');
 if(!host||!host.classList.contains('active'))return false;
 if(String(window.PORTFOLIO_PERFORMANCE_TAB||'')!=='loss')return false;
 const p=host.querySelector('.v51-pp-panel[data-pp-panel="loss"]');
 return !!p && !p.querySelector('[data-loss-ready="1"]');
}
function retry(){
 if(!activeLossNeedsData())return;
 try{
   const host=document.getElementById('view-portfoliobenchmarking');
   const p=host?.querySelector('.v51-pp-panel[data-pp-panel="loss"]');
   if(p)p.dataset.rendered='';
   if(typeof window.setPortfolioPerformanceTab==='function')window.setPortfolioPerformanceTab('loss');
 }catch(e){console.error('Loss & Recovery readiness retry failed',e);}
}
['aip:runtime-ready','aip:data-rendered','aip:data-source-changed','apm:datasource-refreshed'].forEach(evt=>{
 document.addEventListener(evt,()=>{requestAnimationFrame(retry);setTimeout(retry,50);setTimeout(retry,180);});
});
document.addEventListener('aip:login-complete',()=>{requestAnimationFrame(retry);setTimeout(retry,80);setTimeout(retry,220);});
})();
