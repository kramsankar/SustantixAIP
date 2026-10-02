
(function(){
'use strict';
if(window.__AIP_V87250_SCOPED_LOSS_READY__)return;
window.__AIP_V87250_SCOPED_LOSS_READY__=true;
function retryScoped(){
 const host=document.getElementById('view-portfoliobenchmarking');
 if(!host||!host.classList.contains('active')||String(window.PORTFOLIO_PERFORMANCE_TAB||'')!=='loss')return;
 const p=host.querySelector('.v51-pp-panel[data-pp-panel="loss"]');
 if(!p||p.querySelector('[data-loss-ready="1"]'))return;
 try{
   p.dataset.rendered='';
   if(typeof window.setPortfolioPerformanceTab==='function')window.setPortfolioPerformanceTab('loss');
 }catch(e){console.error('Scoped Loss & Recovery retry failed',e);}
}
document.addEventListener('click',e=>{
 if(e.target.closest?.('#view-portfoliobenchmarking .v50-link')){
   requestAnimationFrame(retryScoped);
   setTimeout(retryScoped,60);
   setTimeout(retryScoped,180);
   setTimeout(retryScoped,420);
 }
},true);
['aip:runtime-ready','aip:data-rendered','aip:data-source-changed','apm:datasource-refreshed','aip:login-complete'].forEach(evt=>{
 document.addEventListener(evt,()=>{requestAnimationFrame(retryScoped);setTimeout(retryScoped,80);setTimeout(retryScoped,240);});
});
})();
