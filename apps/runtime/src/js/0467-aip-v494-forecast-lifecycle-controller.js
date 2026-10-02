
(function(){
'use strict';

function v(){ return document.querySelector('#view-operationaltwin'); }
function shell(){ return v()?.querySelector('.gf377-shell') || null; }
function generationActive(){
  const root=v();
  if(!root)return false;
  const active=[...root.querySelectorAll('#tLayers .xi-tab')].find(x=>x.classList.contains('active'));
  return !!active && /Generation Forecast/i.test(active.textContent||'');
}
function siteScope(){
  const s=shell();
  if(!s)return false;
  const siteBtn=s.querySelector('.gf480-scopebtn[data-scope="site"]');
  const portBtn=s.querySelector('.gf480-scopebtn[data-scope="portfolio"]');
  /* Before the scope bar is rebuilt, Site-specific is the safe default. */
  return siteBtn ? siteBtn.classList.contains('active') : !(portBtn&&portBtn.classList.contains('active'));
}
function normalizeDrills(){
  const root=v();
  if(!root)return;
  root.querySelectorAll('.gf476-nav,.gf480-nav').forEach(b=>{
    b.style.height='28px';
    b.style.minHeight='28px';
  });
  try{ window.AIPNormalizeForecastDrillTables?.(document); }catch(_){}
}
function repairSiteDetails(){
  if(!generationActive())return;
  const s=shell();
  if(!s)return;
  try{ window.AIPRefreshGenerationForecastScope?.(); }catch(_){}
  if(!siteScope()) { normalizeDrills(); return; }

  /* The core Generation Forecast renderer may have replaced the shell.
     Re-inject the governed site performance section into the CURRENT shell. */
  if(!s.querySelector('.gf475-performance')){
    try{ window.AIPEnsureSiteForecastPerformance?.(); }catch(err){
      console.error('AIP Site-specific forecast performance re-injection failed',err);
    }
  }
  /* Re-run scope enhancement after injection so visibility + buttons bind to current DOM. */
  try{ window.AIPRefreshGenerationForecastScope?.(); }catch(_){}
  normalizeDrills();
}
function repairSequence(){
  /* Multiple small passes cover the synchronous core render plus its zero/short-delay callbacks,
     without a global DOM observer or continuous polling. */
  [0,35,90,180].forEach(ms=>setTimeout(repairSiteDetails,ms));
}

/* Site / forecast-run changes rebuild Generation Forecast content. */
document.addEventListener('change',e=>{
  if(e.target?.matches?.('#view-operationaltwin #tSite,#view-operationaltwin #gf377Run')){
    repairSequence();
  }
},true);

/* Horizon, scope and Generation Forecast tab changes can also replace/toggle the shell. */
document.addEventListener('click',e=>{
  const t=e.target?.closest?.(
    '#view-operationaltwin [data-gfh],'+
    '#view-operationaltwin .gf480-scopebtn,'+
    '#view-operationaltwin #tLayers .xi-tab'
  );
  if(t)repairSequence();
},true);

/* Data-source refresh: same deterministic repair for Synthetic and Excel. */
document.addEventListener('aip:data-source-changed',repairSequence);
document.addEventListener('apm:datasource-refreshed',repairSequence);

window.AIPRepairGenerationForecastLifecycle=repairSequence;
setTimeout(repairSequence,350);
})();
