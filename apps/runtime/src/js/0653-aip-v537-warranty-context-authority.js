
(function(){
'use strict';

function warrantyClaimId(ctx){
  return String(ctx?.claimId||ctx?.record||ctx?.sourceRecord||
                window.AIP_WARRANTY_CONTEXT?.claimId||
                window.AIP_DI_EVIDENCE_CONTEXT?.record||'');
}

function forceMaintenanceLearningVisible(){
  const target=document.getElementById('view-maintenancelearning');
  if(!target)return null;

  document.querySelectorAll('#main .view.active').forEach(v=>{
    if(v!==target)v.classList.remove('active');
  });
  target.classList.add('active');

  document.querySelectorAll('#sidebar .nav-item.active').forEach(n=>n.classList.remove('active'));
  const nav=document.querySelector('#sidebar .nav-item[data-view="maintenancelearning"]');
  if(nav)nav.classList.add('active');

  return target;
}

function focusWarrantyClaim(claimId,attempt=0){
  const root=document.getElementById('view-maintenancelearning');
  if(!root)return false;
  const row=claimId?root.querySelector(`[data-ml534-claim="${CSS.escape(claimId)}"]`):null;
  if(row){
    root.querySelectorAll('[data-ml534-claim]').forEach(r=>{
      r.classList.toggle('ml534-context-row',r===row);
      r.classList.toggle('ml534-selected',r===row);
    });
    row.setAttribute('tabindex','-1');
    row.scrollIntoView?.({block:'center',behavior:'auto'});
    row.focus?.({preventScroll:true});
    return true;
  }
  if(attempt<20)setTimeout(()=>focusWarrantyClaim(claimId,attempt+1),100);
  return false;
}

function openWarrantyClaimsV537(ctx){
  const claimId=warrantyClaimId(ctx);
  const merged={...(window.AIP_WARRANTY_CONTEXT||{}),...(ctx||{}),claimId,record:claimId,target:'maintenancelearning',navMode:'warranty-claim'};
  window.AIP_WARRANTY_CONTEXT=merged;
  window.AIP_DI_EVIDENCE_CONTEXT={...(window.AIP_DI_EVIDENCE_CONTEXT||{}),...merged};
  window.AIP_WARRANTY_NAV_PENDING=true;
  window.__ml534WarrantySearch='';
  window.__ml534WarrantyStatus='All';
  window.__ml534SelectedClaim=claimId;

  if(window.AIP856_MLR_STATE)window.AIP856_MLR_STATE.tab='warranty';

  /* Let normal navigation update application history/state where possible. */
  try{window.activate?.('maintenancelearning',false)}catch(_){}

  /* Do not trust historical wrapper order for visibility. The desired view wins. */
  const target=forceMaintenanceLearningVisible();
  if(!target)return false;

  if(window.AIP856_MLR_STATE)window.AIP856_MLR_STATE.tab='warranty';
  try{window.renderMaintenanceLearningV856?.()}catch(_){
    try{window.renderMaintenanceLearning?.()}catch(__){}
  }

  /* Render once more after the current navigation stack unwinds. */
  requestAnimationFrame(()=>{
    forceMaintenanceLearningVisible();
    if(window.AIP856_MLR_STATE)window.AIP856_MLR_STATE.tab='warranty';
    try{window.renderMaintenanceLearningV856?.()}catch(_){}
    if(claimId)focusWarrantyClaim(claimId,0);
  });
  setTimeout(()=>{
    forceMaintenanceLearningVisible();
    if(window.AIP856_MLR_STATE)window.AIP856_MLR_STATE.tab='warranty';
    try{window.renderMaintenanceLearningV856?.()}catch(_){}
    if(claimId)focusWarrantyClaim(claimId,0);
  },80);

  return true;
}

window.AIPOpenWarrantyClaims=openWarrantyClaimsV537;
window.renderWarrantyRecovery=function(){
  return openWarrantyClaimsV537(window.AIP_WARRANTY_CONTEXT||window.AIP_DI_EVIDENCE_CONTEXT||window.AIP_CONTEXT_NAV||{});
};

/* Any surviving direct click/route to the historical view is redirected, never hidden. */
document.addEventListener('click',function(e){
  const x=e.target.closest?.('[data-view="warrantyrecovery"]');
  if(!x)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  openWarrantyClaimsV537(window.AIP_WARRANTY_CONTEXT||window.AIP_DI_EVIDENCE_CONTEXT||window.AIP_CONTEXT_NAV||{});
},true);

/* Catch code paths that directly manipulate .active without calling window.activate. */
let redirecting=false;
const legacy=document.getElementById('view-warrantyrecovery');
if(legacy){
  const mo=new MutationObserver(()=>{
    if(redirecting||!legacy.classList.contains('active'))return;
    redirecting=true;
    legacy.classList.remove('active');
    openWarrantyClaimsV537(window.AIP_WARRANTY_CONTEXT||window.AIP_DI_EVIDENCE_CONTEXT||window.AIP_CONTEXT_NAV||{});
    queueMicrotask(()=>{redirecting=false});
  });
  mo.observe(legacy,{attributes:true,attributeFilter:['class']});
}

/* Defensive check after any application click: legacy cannot remain the active right pane. */
document.addEventListener('click',()=>{
  setTimeout(()=>{
    if(document.getElementById('view-warrantyrecovery')?.classList.contains('active')){
      openWarrantyClaimsV537(window.AIP_WARRANTY_CONTEXT||window.AIP_DI_EVIDENCE_CONTEXT||window.AIP_CONTEXT_NAV||{});
    }
  },0);
},false);

window.AIP_CURRENT_BUILD='v537';
window.AIP_V537_WARRANTY_AUDIT={
 release:'v537',
 baseline:'v536',
 defect:'v536 hid the legacy warranty view but a residual direct-active path could still activate it, producing a blank right pane',
 authoritativeDestination:'Maintenance Learning & Recovery → Warranty & Claims',
 exactContext:true,
 changes:[
   'Removed blank-screen CSS strategy',
   'Authoritative opener now forces view-maintenancelearning to be the visible active right pane',
   'Warranty tab is asserted before and after render',
   'Exact CLM-AE claim is selected, scrolled into view and highlighted with retry',
   'Mutation guard redirects any direct legacy-view activation',
   'No warranty business data changed'
 ]
};
})();
