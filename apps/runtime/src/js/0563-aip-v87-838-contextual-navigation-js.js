
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_855';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function engRoot(){return document.getElementById('view-assetrelationships')}
 function ensureEngPane(){
   const root=engRoot();if(!root)return null;
   let tabs=root.querySelector('.ar-tabs');if(!tabs)return null;
   let btn=tabs.querySelector('[data-ar-tab="engineering"]');
   if(!btn){btn=document.createElement('button');btn.className='ar-tab';btn.dataset.arTab='engineering';btn.textContent='Engineering Models';tabs.appendChild(btn)}
   let pane=root.querySelector('[data-ar-pane="engineering"]');
   if(!pane){pane=document.createElement('section');pane.className='ar-pane aip831-eng-pane';pane.dataset.arPane='engineering';tabs.insertAdjacentElement('afterend',pane)}
   btn.onclick=function(){window.AR_ACTIVE_TAB='engineering';showEng();};
   return pane;
 }
 function showEng(){
   const root=engRoot(),pane=ensureEngPane();if(!root||!pane)return false;
   window.AR_ACTIVE_TAB='engineering';
   root.querySelectorAll('[data-ar-tab]').forEach(x=>x.classList.toggle('active',x.dataset.arTab==='engineering'));
   root.querySelectorAll('[data-ar-pane]').forEach(x=>x.classList.toggle('active',x.dataset.arPane==='engineering'));
   try{window.renderAIP831Engineering?.()}catch(e){console.error('Engineering Model render failed',e)}
   decorateReturn();
   return !!pane.innerHTML.trim();
 }
 function decorateReturn(){
   const pane=engRoot()?.querySelector('[data-ar-pane="engineering"]');if(!pane)return;
   pane.querySelector('.aip838-eng-return')?.remove();
   const ret=window.AIP_ENG_RETURN;if(!ret?.cbmId)return;
   const bar=document.createElement('div');bar.className='aip838-eng-return';
   bar.innerHTML=`<span>Opened from Condition-Based Maintenance · <b>${esc(ret.cbmId)}</b> · Model <b>${esc(window.AIP_ENG_SELECTED_MODEL||'')}</b></span><button type="button">← Back to CBM</button>`;
   bar.querySelector('button').onclick=backToCBM;pane.prepend(bar);
 }
 function backToCBM(){
   const ret=window.AIP_ENG_RETURN;if(!ret?.cbmId)return;
   try{window.aip831OpenCBM?.(ret.cbmId)}catch(_){}
   setTimeout(()=>{try{window.cbm818Select?.(ret.cbmId)}catch(_){}},100);
 }
 const oldOpen=window.aip831OpenEngineeringModel;
 window.aip831OpenEngineeringModel=function(id,cbmId){
   window.AIP_ENG_SELECTED_MODEL=id||window.AIP_ENG_SELECTED_MODEL;
   if(cbmId){window.AIP_ENG_FROM_CBM=cbmId;window.AIP_ENG_RETURN={cbmId,modelId:id,at:Date.now()}}
   window.AR_ACTIVE_TAB='engineering';
   try{
     if(typeof activateTarget==='function')activateTarget('assetrelationships');
     else if(typeof activate==='function')activate('assetrelationships');
     else document.querySelector('.nav-item[data-view="assetrelationships"],[data-view="assetrelationships"]')?.click();
   }catch(_){document.querySelector('.nav-item[data-view="assetrelationships"],[data-view="assetrelationships"]')?.click()}
   if(!engRoot()?.querySelector('.ar-tabs')){try{if(typeof renderAssetRelationships==='function')renderAssetRelationships(window.AIP_CONTEXT_NAV||null)}catch(_){}}
   if(!showEng()){requestAnimationFrame(()=>{if(!showEng())setTimeout(showEng,45)});}
 };
 // Re-establish Engineering Models after any base Asset Relationships rerender.
 const mo=new MutationObserver(()=>{if(window.AR_ACTIVE_TAB==='engineering')requestAnimationFrame(showEng);decorateNoWO()});
 const cbmRoot839=document.getElementById('view-conditionbased');if(cbmRoot839)mo.observe(cbmRoot839,{childList:true,subtree:true});
 function decorateNoWO(){
   const root=document.getElementById('view-conditionbased');if(!root)return;
   const sel=root.querySelector('.cbm818-selected');if(!sel||sel.querySelector('.cbm829-selected-wo')||sel.querySelector('.aip838-no-wo'))return;
   const pill=document.createElement('span');pill.className='aip838-no-wo';pill.textContent='No linked work order · assessment only';sel.appendChild(pill);
 }
 document.addEventListener('click',e=>{
   const b=e.target.closest?.('#aipBackBtn');
   if(b&&window.AR_ACTIVE_TAB==='engineering'&&window.AIP_ENG_RETURN?.cbmId&&engRoot()?.classList.contains('active')){
     e.preventDefault();e.stopImmediatePropagation();backToCBM();
   }
 },true);
 document.addEventListener('aip:data-source-changed',()=>setTimeout(()=>{if(window.AR_ACTIVE_TAB==='engineering')showEng();decorateNoWO()},100));
 setTimeout(decorateNoWO,120);
 window.AIP_V838_AUDIT={release:'v87_855',baseline:'v87_837',changes:[
  'Exact-source root-cause tables use larger Arial text and a colored contextual border',
  'Engineering Models exact-model navigation recreates the tab/pane after base rerenders and renders the requested model',
  'Engineering Model view includes contextual Back to the originating CBM assessment and global Back interception',
  'Review exact WO integrity lookup checks all governed/runtime work-order pools using exact Plant, Asset, Asset Tag and Source lineage',
  'CBM assessments without a governed linked work order explicitly show No linked work order rather than a missing unexplained action'
 ]};
})();
