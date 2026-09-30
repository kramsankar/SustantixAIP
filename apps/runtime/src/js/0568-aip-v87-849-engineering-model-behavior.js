
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';

function esc849(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function getCBMAssessment(id){
 const pools=[],add=x=>{if(Array.isArray(x))pools.push(x)};
 try{add(window.AIP_CBM_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.APM_IMPORTED_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.EMBEDDED_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.conditionBasedMaintenance?.['CBM Assessments'])}catch(_){}
 for(const p of pools){const a=p.find(x=>String(x.CBM_Assessment_ID)===String(id));if(a)return a}
 return null;
}
function clearEngineeringContext(){
 window.AIP_ENG_RETURN=null;
 window.AIP_ENG_FROM_CBM=null;
 document.querySelector('#view-assetrelationships .aip838-eng-return')?.remove();
}
window.aip849CloseEngineeringContext=clearEngineeringContext;

window.aip849BackToCBM=function(){
 const id=window.AIP_ENG_RETURN?.cbmId;
 if(!id)return;
 try{window.aip831OpenCBM?.(id)}catch(_){}
 setTimeout(()=>{try{window.cbm818Select?.(id)}catch(_){}},80);
};

window.aip849OpenRelationshipExplorer=function(){
 const ret=window.AIP_ENG_RETURN;
 const a=ret?.cbmId?getCBMAssessment(ret.cbmId):null;
 const ctx=a?{
   source:'Condition-Based Maintenance',
   cbmAssessmentId:a.CBM_Assessment_ID,
   assetId:a.Asset_ID,
   tag:a.Asset_Tag||a.Asset_ID,
   siteId:a.Plant_ID,
   site:a.Plant_Name||a.Plant_ID,
   assetClass:a.Asset_Class,
   modelId:ret?.modelId||window.AIP_ENG_SELECTED_MODEL
 }:null;
 window.AR_ACTIVE_TAB='explorer';
 if(ctx){
   window.AIP_CONTEXT_NAV=ctx;
   window.AIP_PENDING_RELATIONSHIP_CONTEXT=ctx;
   window.AIP_ASSET_RELATIONSHIP_SOURCE_CONTEXT=ctx;
   window.AIP_RELATIONSHIP_FOCUS_ASSET=ctx.assetId;
 }
 try{window.renderAssetRelationships?.(ctx||window.AIP_CONTEXT_NAV||null)}catch(e){console.error('Relationship Explorer contextual open failed',e)}
 requestAnimationFrame(()=>{
   const root=document.getElementById('view-assetrelationships');if(!root)return;
   root.querySelectorAll('[data-ar-tab]').forEach(x=>x.classList.toggle('active',x.dataset.arTab==='explorer'));
   root.querySelectorAll('[data-ar-pane]').forEach(x=>x.classList.toggle('active',x.dataset.arPane==='explorer'));
   const f=root.querySelector('#arFocus');
   if(f&&ctx?.assetId&&[...f.options].some(o=>String(o.value)===String(ctx.assetId))){
     f.value=ctx.assetId;
     f.dispatchEvent(new Event('change',{bubbles:true}));
   }
 });
};

function decorateEngineering849(){
 const pane=document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]');
 if(!pane)return;

 /* Remove redundant bottom return action: top Back to CBM is the canonical return path. */
 const actions=pane.querySelector('.aip831-eng-actions');
 if(actions){
   [...actions.querySelectorAll('button')].forEach(b=>{
     if(/Open linked CBM/i.test(b.textContent||''))b.remove();
   });
   let rel=[...actions.querySelectorAll('button')].find(b=>/Open relationship explorer/i.test(b.textContent||''));
   if(rel){
     rel.textContent='Open Relationship Explorer';
     rel.classList.add('aip849-rel-explorer');
     rel.onclick=window.aip849OpenRelationshipExplorer;
   }
 }

 const ret=window.AIP_ENG_RETURN;
 let bar=pane.querySelector('.aip838-eng-return');
 if(ret?.cbmId){
   if(!bar){bar=document.createElement('div');bar.className='aip838-eng-return';pane.prepend(bar)}
   bar.innerHTML=`<span>Opened from Condition-Based Maintenance · <b>${esc849(ret.cbmId)}</b> · Model <b>${esc849(ret.modelId||window.AIP_ENG_SELECTED_MODEL||'')}</b></span><button type="button" class="aip849-back-cbm">Back to CBM</button><button type="button" class="aip849-close-context" title="Close context" aria-label="Close context">×</button>`;
   bar.querySelector('.aip849-back-cbm').onclick=window.aip849BackToCBM;
   bar.querySelector('.aip849-close-context').onclick=clearEngineeringContext;
 }else if(bar){
   bar.remove();
 }
}

/* Wrap the existing engineering renderer so every model/search refresh gets the same cleanup. */
const priorRender=window.renderAIP831Engineering;
if(typeof priorRender==='function'){
 window.renderAIP831Engineering=function(){
   const r=priorRender.apply(this,arguments);
   decorateEngineering849();
   requestAnimationFrame(decorateEngineering849);
   return r;
 };
}

/* Existing v838 showEng may render then add its old return bar. Re-decorate after relevant clicks. */
document.addEventListener('click',e=>{
 const t=e.target;
 if(t.closest?.('#view-assetrelationships [data-ar-tab="engineering"],#view-assetrelationships .aip831-model-row')){
   setTimeout(decorateEngineering849,25);
 }
 /* A user navigating to a different top-level screen dismisses the transient CBM-origin banner. */
 const nav=t.closest?.('[data-view]');
 if(nav && nav.getAttribute('data-view')!=='assetrelationships'){
   clearEngineeringContext();
 }
},true);

/* Also clear stale origin context once another top-level view becomes active. */
const main=document.getElementById('main');
if(main){
 const mo=new MutationObserver(()=>{
   const active=document.querySelector('.view.active[id^="view-"]')?.id?.replace('view-','')||'';
   if(active && active!=='assetrelationships' && window.AIP_ENG_RETURN) clearEngineeringContext();
 });
 mo.observe(main,{subtree:true,attributes:true,attributeFilter:['class']});
}

setTimeout(decorateEngineering849,80);
window.AIP_V849_AUDIT={
 release:'v87_856',baseline:'v87_855',area:'Asset Relationships → Engineering Models',
 uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,
 audited:[
  'CBM Engineering Physics Fit → Open Engineering Model exact model',
  'Context banner Back to CBM',
  'Context banner close ×',
  'Navigate away and confirm origin context clears',
  'Remove redundant Open linked CBM bottom action',
  'Open Relationship Explorer with originating CBM asset/site context',
  'Exact model list highlight',
  'Engineering graph nodes',
  'Engineering check cards',
  'Engineering lineage/source cards'
 ],
 changes:[
  'Back to CBM now uses one white thick diagonal arrow in a deep-plum circular badge',
  'CBM-origin context banner is closable and clears when navigating to another top-level screen',
  'Removed redundant Open linked CBM action from the bottom of Engineering Models',
  'Repaired Open Relationship Explorer and carries the originating CBM asset/site context into Relationship Explorer',
  'Strengthened graph, check-card and lineage borders with one consistent bright plum boundary',
  'Changed exact engineering-model row highlight from pale blue/green to dark plum with white text'
 ]
};
})();
