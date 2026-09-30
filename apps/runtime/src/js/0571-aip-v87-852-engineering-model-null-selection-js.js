
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';
window.AIP_ENG_SELECTION_MODE=window.AIP_ENG_SELECTION_MODE||'none';

function cbmContext852(){
 return !!(window.AIP_ENG_RETURN?.cbmId || window.AIP_ENG_FROM_CBM);
}
function modelButtons852(pane){
 return [...(pane?.querySelectorAll('.aip831-model-row')||[])];
}
function modelIdFromButton852(btn){
 const b=btn?.querySelector('b')?.textContent||'';
 return b.split('·')[0].trim();
}
function installSelector852(){
 const pane=document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]');
 if(!pane)return;
 const tools=pane.querySelector('.aip831-model-tools');
 if(!tools)return;

 let sel=tools.querySelector('#aip852ModelSelect');
 if(!sel){
   sel=document.createElement('select');
   sel.id='aip852ModelSelect';
   sel.className='aip852-model-select';
   sel.setAttribute('aria-label','Engineering model selection');
   tools.prepend(sel);
 }
 const rows=modelButtons852(pane);
 const opts=rows.map(b=>{
   const id=modelIdFromButton852(b);
   const label=(b.querySelector('b')?.textContent||id).trim();
   return {id,label};
 }).filter(x=>x.id);

 const selected=(window.AIP_ENG_SELECTION_MODE==='selected'||cbmContext852()) ? String(window.AIP_ENG_SELECTED_MODEL||'') : '';
 sel.innerHTML='<option value="">Choose / None</option>'+opts.map(x=>`<option value="${x.id.replace(/"/g,'&quot;')}">${x.label}</option>`).join('');
 sel.value=opts.some(x=>x.id===selected)?selected:'';

 sel.onchange=function(){
   const id=String(this.value||'');
   if(!id){
     window.AIP_ENG_SELECTION_MODE='none';
     window.AIP_ENG_SELECTED_MODEL=null;
     window.AIP_ENG_RETURN=null;
     window.AIP_ENG_FROM_CBM=null;
     try{window.renderAIP831Engineering?.()}catch(_){}
     return;
   }
   window.AIP_ENG_SELECTION_MODE='selected';
   window.AIP_ENG_SELECTED_MODEL=id;
   try{window.renderAIP831Engineering?.()}catch(_){}
 };
}
function applyNullSelection852(){
 const pane=document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]');
 if(!pane)return;
 installSelector852();

 if(cbmContext852()){
   window.AIP_ENG_SELECTION_MODE='selected';
   return;
 }
 if(window.AIP_ENG_SELECTION_MODE!=='none')return;

 /* The inherited renderer must instantiate the list, but no model is authoritative
    until the user chooses one. Remove its fallback selection and leave the detail
    workspace genuinely empty. */
 window.AIP_ENG_SELECTED_MODEL=null;
 modelButtons852(pane).forEach(b=>{
   b.classList.remove('active');
   b.removeAttribute('aria-current');
 });
 const main=pane.querySelector('.aip831-eng-main');
 if(main){
   main.innerHTML='<div class="aip852-blank-main" aria-label="No engineering model selected"></div>';
 }
 const select=pane.querySelector('#aip852ModelSelect');
 if(select)select.value='';
}

const prior852=window.renderAIP831Engineering;
if(typeof prior852==='function'){
 window.renderAIP831Engineering=function(){
   const r=prior852.apply(this,arguments);
   installSelector852();
   applyNullSelection852();
   requestAnimationFrame(()=>{installSelector852();applyNullSelection852()});
   return r;
 };
}

/* Direct Engineering Models entry starts with no selection. */
document.addEventListener('click',function(e){
 const eng=e.target.closest?.('#view-assetrelationships [data-ar-tab="engineering"]');
 if(eng && e.isTrusted){
   window.AIP_ENG_SELECTION_MODE='none';
   window.AIP_ENG_SELECTED_MODEL=null;
   window.AIP_ENG_RETURN=null;
   window.AIP_ENG_FROM_CBM=null;
   setTimeout(()=>{try{window.renderAIP831Engineering?.()}catch(_){}},0);
   return;
 }
 const row=e.target.closest?.('#view-assetrelationships .aip831-model-row');
 if(row){
   window.AIP_ENG_SELECTION_MODE='selected';
 }
},true);

/* Contextual CBM opening always remains an exact selected-model launch. */
const open852=window.aip831OpenEngineeringModel;
if(typeof open852==='function'){
 window.aip831OpenEngineeringModel=function(id,cbmId){
   window.AIP_ENG_SELECTION_MODE='selected';
   return open852.apply(this,arguments);
 };
}

setTimeout(()=>{installSelector852();applyNullSelection852()},120);

window.AIP_V852_AUDIT={
 release:'v87_856',baseline:'v87_855',area:'Asset Relationships → Engineering Models',
 uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,
 audited:[
  'Direct Engineering Models entry starts with no selected model',
  'Choose / None dropdown is visible above Search Models and class filter',
  'Choose / None clears every list-row highlight and empties the right workspace',
  'Selecting a model from the dropdown opens and highlights that exact model',
  'Selecting a model from the scroll list still opens and highlights that exact model',
  'Search Models remains available',
  'CBM contextual Open Engineering Model still opens the exact linked model'
 ],
 changes:[
  'Removed the standalone Choose Model heading',
  'Added a model-selection dropdown with Choose / None reset state',
  'None state removes all model highlighting and leaves the right detail area blank',
  'Model dropdown and scroll-list selection both drive the same selected-model state',
  'Search and asset-class filtering remain intact'
 ]
};
})();
