
(function(){
'use strict';

/* v85: Asset Relationships → Engineering Models should not open as an empty shell.
   Preserve exact CBM contextual launches and the explicit Choose / None reset,
   but on a normal direct entry select the first governed model and render its detail. */

function modelIdFromFirstRow(){
  const pane=document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]');
  const row=pane?.querySelector('.aip831-model-row');
  if(!row)return '';
  const txt=(row.querySelector('b')?.textContent||'').trim();
  return txt.split('·')[0].trim();
}

function engineeringPaneActive(){
  const pane=document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]');
  return !!pane?.classList.contains('active');
}

function hasCBMContext(){
  return !!(window.AIP_ENG_RETURN?.cbmId || window.AIP_ENG_FROM_CBM);
}

function openDefaultEngineeringModel(){
  if(!engineeringPaneActive() || hasCBMContext())return;
  if(window.AIP_ENG_SELECTION_MODE==='selected' && window.AIP_ENG_SELECTED_MODEL)return;

  const id=modelIdFromFirstRow();
  if(!id){
    /* The inherited renderer creates the list. Run it once, then resolve the first model. */
    try{window.renderAIP831Engineering?.()}catch(_){}
    requestAnimationFrame(()=>{
      const first=modelIdFromFirstRow();
      if(!first)return;
      window.AIP_ENG_SELECTION_MODE='selected';
      window.AIP_ENG_SELECTED_MODEL=first;
      try{window.renderAIP831Engineering?.()}catch(_){}
    });
    return;
  }

  window.AIP_ENG_SELECTION_MODE='selected';
  window.AIP_ENG_SELECTED_MODEL=id;
  try{window.renderAIP831Engineering?.()}catch(_){}
}

/* Normal direct click: allow inherited handlers to establish the pane/list,
   then replace their blank/null state with a governed default model. */
document.addEventListener('click',function(e){
  const tab=e.target.closest?.('#view-assetrelationships [data-ar-tab="engineering"]');
  if(tab && e.isTrusted){
    setTimeout(openDefaultEngineeringModel,20);
  }
},true);

/* If Asset Relationships is opened while Engineering Models is already the active
   sub-tab, ensure the right workspace is populated after render. */
document.addEventListener('click',function(e){
  const nav=e.target.closest?.('[data-view="assetrelationships"]');
  if(nav && e.isTrusted){
    setTimeout(openDefaultEngineeringModel,80);
  }
},true);

/* Defensive render hook: if application state lands directly on Engineering Models
   with no selection, populate it instead of leaving a blank right pane. */
const priorV85=window.renderAIP831Engineering;
if(typeof priorV85==='function'){
  window.renderAIP831Engineering=function(){
    const r=priorV85.apply(this,arguments);
    if(engineeringPaneActive() && !hasCBMContext() &&
       window.AIP_ENG_SELECTION_MODE!=='selected'){
      requestAnimationFrame(openDefaultEngineeringModel);
    }
    return r;
  };
}

setTimeout(openDefaultEngineeringModel,180);

window.AIP_V85_ENGINEERING_FIX={
  area:'Asset Relationships → Engineering Models',
  change:'Direct entry now opens the first governed Engineering Model instead of an intentionally blank detail workspace.',
  preserved:[
    'Exact CBM contextual Engineering Model launch',
    'Search models',
    'Asset-class filter',
    'Choose / None explicit reset',
    'Model list selection',
    'Engineering checks, applicability and lineage'
  ]
};
})();
