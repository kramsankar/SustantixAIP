
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';
let directChooser=false;

function isCBMContext(){
 return !!(window.AIP_ENG_RETURN?.cbmId || window.AIP_ENG_FROM_CBM);
}
function removeRelationshipExplorer(){
 const pane=document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]');
 if(!pane)return;
 pane.querySelectorAll('.aip831-eng-actions button').forEach(b=>{
   if(/Open Relationship Explorer/i.test(b.textContent||''))b.remove();
 });
}
function showChooserIfNeeded(){
 const pane=document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]');
 if(!pane)return;
 removeRelationshipExplorer();
 if(!directChooser || isCBMContext() || window.AIP_ENG_SELECTED_MODEL)return;
 const main=pane.querySelector('.aip831-eng-main');
 if(main){
   main.innerHTML=`<div class="aip851-model-placeholder"><div class="aip851-inner"><h3>Choose an Engineering Model</h3><p>Select a model from the list on the left to open its governed engineering context, model checks, applicability and source lineage.</p></div></div>`;
 }
}

/* Wrap renderer: preserve exact CBM contextual opening, but direct entry stays unselected
   until the user explicitly chooses a model. */
const prior=window.renderAIP831Engineering;
if(typeof prior==='function'){
 window.renderAIP831Engineering=function(){
   const r=prior.apply(this,arguments);
   removeRelationshipExplorer();
   showChooserIfNeeded();
   return r;
 };
}

/* Direct user click on Engineering Models = fresh chooser.
   Contextual CBM navigation calls the public renderer programmatically and is not reset. */
document.addEventListener('click',function(e){
 const eng=e.target.closest?.('#view-assetrelationships [data-ar-tab="engineering"]');
 if(eng && e.isTrusted){
   directChooser=true;
   window.AIP_ENG_SELECTED_MODEL=null;
   window.AIP_ENG_RETURN=null;
   window.AIP_ENG_FROM_CBM=null;
   setTimeout(()=>{
     try{window.renderAIP831Engineering?.()}catch(_){}
     showChooserIfNeeded();
   },0);
   return;
 }
 const row=e.target.closest?.('#view-assetrelationships .aip831-model-row');
 if(row){
   directChooser=false; /* the row's existing handler sets the exact Model_ID */
   setTimeout(removeRelationshipExplorer,0);
 }
},true);

/* When Asset Relationships is entered directly after login, do not inherit a stale model.
   The chooser is applied when Engineering Models itself is selected. */
document.addEventListener('click',function(e){
 const nav=e.target.closest?.('[data-view="assetrelationships"]');
 if(nav && e.isTrusted && !isCBMContext()){
   directChooser=true;
   window.AIP_ENG_SELECTED_MODEL=null;
 }
},true);

window.AIP_V851_AUDIT={
 release:'v87_856',baseline:'v87_855',area:'Asset Relationships → Engineering Models',
 uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,
 designDecision:'Relationship Explorer action removed from Engineering Models because a generic graph jump without a governed model-to-specific-relationship mapping can open an unrelated asset and does not add reliable context.',
 audited:[
  'Fresh login → Asset Relationships → Engineering Models shows chooser with no arbitrary model selected',
  'Choose Model list remains visible and scrollable',
  'Selecting a model opens that model context on the right',
  'CBM → Engineering Physics Fit → Open Engineering Model still opens the exact contextual model directly',
  'Lineage/source pathway uses amber boundaries',
  'Open Relationship Explorer removed from Engineering Models'
 ],
 changes:[
  'Direct Engineering Models entry no longer defaults to the first or previously selected model',
  'Added explicit Choose Model heading and neutral right-side selection state',
  'Model details render only after an explicit direct selection, while CBM contextual navigation still opens the exact model',
  'Changed Design/Source Authority through CBM Use lineage cards from plum to amber boundaries',
  'Removed Open Relationship Explorer because no governed exact relationship target exists for this model-level action'
 ]
};
})();
