
(function(){
'use strict';
const STRATEGIES=new Set(['preventive','conditionbased','predictive','corrective','riskbased','adaptive']);

function activeStrategy(){
  const el=document.querySelector('.view.active[id^="view-"]');
  if(!el)return '';
  const v=el.id.slice(5);
  return STRATEGIES.has(v)?v:'';
}
function ensureAfterRender(view){
  if(!STRATEGIES.has(view))return;
  const run=()=>{
    try{
      if(typeof window.applyMaintenanceGroupingSubtabs==='function'){
        const root=document.getElementById('view-'+view);
        if(root && !root.querySelector(':scope > .aip-maint-subtabs')){
          window.applyMaintenanceGroupingSubtabs(view);
        }
      }
    }catch(_){}
    try{ window.AIP831EnsureStrategyGovernance?.(view); }catch(_){}
  };
  /* Two bounded paint points cover the grouped-tab insertion and the strategy renderer.
     No continuous observer and no polling loop. */
  requestAnimationFrame(()=>requestAnimationFrame(run));
  setTimeout(run,60);
}

/* Left-pane entry/re-entry: the default strategy is Preventive, so explicitly
   initialize whichever strategy view is active after the shell activates it. */
document.addEventListener('click',function(e){
  const nav=e.target.closest?.('[data-view]');
  if(!nav)return;
  const requested=String(nav.dataset.view||'');
  if(requested==='predictive' || STRATEGIES.has(requested)){
    setTimeout(()=>{
      const v=activeStrategy() || (requested==='predictive'?'preventive':requested);
      ensureAfterRender(v);
    },0);
  }
},true);

/* Grouped maintenance tab changes. */
document.addEventListener('click',function(e){
  const tab=e.target.closest?.('.aip-maint-subtabs [data-aip-maint-nav],.aip-maint-subtabs button');
  if(!tab)return;
  const v=String(tab.dataset.aipMaintNav||'');
  if(STRATEGIES.has(v))ensureAfterRender(v);
},true);

/* Application-level view changes, where emitted by the shell. */
document.addEventListener('aip:view-changed',function(){
  const v=activeStrategy();
  if(v)ensureAfterRender(v);
});

/* Initial page/session state after login render. */
function initial(){
  const v=activeStrategy();
  if(v)ensureAfterRender(v);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initial,100),{once:true});
else setTimeout(initial,100);

window.AIP_V386_AUDIT={
 release:'v386',baseline:'v385',
 scope:'Maintenance Strategy Strategy Governance first-entry/re-entry lifecycle only',
 uiOnly:true,excelChanged:false,syntheticBusinessDataChanged:false,
 rootCause:'The existing governance initializer could run before the grouped first-entry Preventive render completed; that later render replaced the injected governance node. A subsequent strategy-tab click reran initialization, making Governance appear.',
 changes:[
  'Exposed the existing authoritative Strategy Governance initializer without duplicating governance logic',
  'Re-initialize Governance after first-entry Preventive rendering settles',
  'Re-initialize Governance after leaving and re-entering Maintenance Strategy',
  'Preserve Governance on all five grouped strategy tabs and existing spacing/style from v385'
 ]
};
})();
