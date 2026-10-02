
(function(){
'use strict';

function finalizePreventiveGovernance(){
  const root=document.getElementById('view-preventive');
  if(!root)return;
  try{
    if(typeof window.applyMaintenanceGroupingSubtabs==='function' &&
       !root.querySelector(':scope > .aip-maint-subtabs')){
      window.applyMaintenanceGroupingSubtabs('preventive');
    }
  }catch(_){}
  try{ window.AIP831EnsureStrategyGovernance?.('preventive'); }catch(_){}
}

function install(){
  const fn=window.renderPreventive;
  if(typeof fn!=='function')return false;
  if(fn.__aipV387GovFinal)return true;

  function wrappedRenderPreventive(){
    const out=fn.apply(this,arguments);

    /* Run after the exact render that just replaced #view-preventive.innerHTML.
       This is renderer-coupled, not a guessed module-entry timer. */
    finalizePreventiveGovernance();
    requestAnimationFrame(finalizePreventiveGovernance);

    return out;
  }
  wrappedRenderPreventive.__aipV387GovFinal=true;
  wrappedRenderPreventive.__aipV387Original=fn;
  window.renderPreventive=wrappedRenderPreventive;
  return true;
}

/* EOF installation occurs after all legacy renderPreventive wrappers. */
if(!install()){
  document.addEventListener('DOMContentLoaded',install,{once:true});
}

/* Cover the already-rendered initial state without waiting for a user tab click. */
function initial(){
  const root=document.getElementById('view-preventive');
  if(root?.classList.contains('active'))finalizePreventiveGovernance();
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(initial),{once:true});
}else{
  requestAnimationFrame(initial);
}

window.AIP_V387_AUDIT={
 release:'v387',baseline:'v386',
 scope:'Preventive Maintenance first-render Strategy Governance authority',
 uiOnly:true,excelChanged:false,syntheticBusinessDataChanged:false,
 rootCause:'Maintenance Strategy first entry explicitly calls renderPreventive more than once. The previous lifecycle fix could inject Governance between those renders, after which a later renderPreventive replaced the entire Preventive view and removed it.',
 changes:[
  'Wrapped the final authoritative renderPreventive at true EOF',
  'Strategy Governance is restored immediately after every Preventive render, including the forced first-entry render',
  'Grouped Maintenance Strategy tabs are restored first if the Preventive renderer replaced them',
  'No changes to governance content, other strategy tabs, business logic or data'
 ]
};
})();
