
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';

function ensureDirectEngineering(){
 const root=document.getElementById('view-assetrelationships');
 if(!root)return false;
 const tabs=root.querySelector('.ar-tabs');
 if(!tabs)return false;

 let btn=tabs.querySelector('[data-ar-tab="engineering"]');
 if(!btn){
   btn=document.createElement('button');
   btn.className='ar-tab';
   btn.dataset.arTab='engineering';
   btn.textContent='Engineering Models';
   tabs.appendChild(btn);
 }
 let pane=root.querySelector('[data-ar-pane="engineering"]');
 if(!pane){
   pane=document.createElement('section');
   pane.className='ar-pane aip831-eng-pane';
   pane.dataset.arPane='engineering';
   tabs.insertAdjacentElement('afterend',pane);
 }

 btn.onclick=function(e){
   e?.preventDefault?.();
   window.AR_ACTIVE_TAB='engineering';
   root.querySelectorAll('[data-ar-tab]').forEach(x=>x.classList.toggle('active',x.dataset.arTab==='engineering'));
   root.querySelectorAll('[data-ar-pane]').forEach(x=>x.classList.toggle('active',x.dataset.arPane==='engineering'));
   try{window.renderAIP831Engineering?.()}catch(err){console.error('Direct Engineering Models render failed',err)}
   requestAnimationFrame(()=>{try{window.renderAIP831Engineering?.()}catch(_){}});
 };
 if(window.AR_ACTIVE_TAB==='engineering'){
   root.querySelectorAll('[data-ar-tab]').forEach(x=>x.classList.toggle('active',x.dataset.arTab==='engineering'));
   root.querySelectorAll('[data-ar-pane]').forEach(x=>x.classList.toggle('active',x.dataset.arPane==='engineering'));
   try{window.renderAIP831Engineering?.()}catch(err){console.error('Engineering Models restore render failed',err)}
 }
 return true;
}
window.aip850EnsureEngineeringDirect=ensureDirectEngineering;

document.addEventListener('click',function(e){
 const nav=e.target.closest?.('[data-view="assetrelationships"]');
 if(nav){
   [0,30,80,160].forEach(ms=>setTimeout(ensureDirectEngineering,ms));
   return;
 }
 const eng=e.target.closest?.('#view-assetrelationships [data-ar-tab="engineering"]');
 if(eng)requestAnimationFrame(ensureDirectEngineering);
},true);

document.addEventListener('aip:data-source-changed',()=>setTimeout(ensureDirectEngineering,60));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensureDirectEngineering,100));
else setTimeout(ensureDirectEngineering,100);

window.AIP_V850_AUDIT={
 release:'v87_856',baseline:'v87_855',area:'Asset Relationships → Engineering Models',
 uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,
 rootCause:'Direct tab code invoked an internal renderer name outside the function-expression scope. The CBM contextual route already called the public window renderer, which is why that route worked.',
 audited:[
  'Fresh login → Asset Relationships → Engineering Models',
  'Engineering Models tab/pane recreation after Asset Relationships renderer rebuild',
  'Direct tab click invokes public Engineering Models renderer',
  'CBM → Engineering Physics Fit → Open Engineering Model remains supported',
  'Repeated Asset Relationships entry rebinds Engineering Models handler'
 ],
 changes:[
  'Repaired direct Engineering Models rendering to use window.renderAIP831Engineering',
  'Added first-login direct-entry creation/rebinding of Engineering Models tab and pane',
  'Added repeated render/rebind safeguards after Asset Relationships rebuilds'
 ]
};
})();
