
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';

function pane854(){return document.querySelector('#view-assetrelationships [data-ar-pane="engineering"]')}
function rows854(){
 const p=pane854(); if(!p)return [];
 return [...p.querySelectorAll('.aip831-model-row')].filter(r=>{
   const cs=getComputedStyle(r);
   return cs.display!=='none' && cs.visibility!=='hidden' && r.offsetParent!==null;
 });
}
function rowId854(r){
 return String(r?.querySelector('b')?.textContent||'').split('·')[0].trim();
}
function decorate854(){
 const p=pane854(); if(!p)return;
 const box=p.querySelector('.aip831-model-scroll');
 if(box){
   box.setAttribute('role','listbox');
   box.setAttribute('aria-label','Engineering models');
 }
 const selected=String(window.AIP_ENG_SELECTED_MODEL||'');
 rows854().forEach(r=>{
   const id=rowId854(r);
   r.setAttribute('role','option');
   r.setAttribute('aria-selected',selected && id===selected ? 'true':'false');
   r.tabIndex=(selected && id===selected)?0:-1;
 });
}
function focusSelected854(){
 requestAnimationFrame(()=>{
   decorate854();
   const id=String(window.AIP_ENG_SELECTED_MODEL||'');
   if(!id)return;
   const r=rows854().find(x=>rowId854(x)===id);
   if(r){
     r.tabIndex=0;
     try{r.focus({preventScroll:true})}catch(_){r.focus()}
     r.scrollIntoView({block:'nearest',inline:'nearest'});
   }
 });
}
function selectRow854(r){
 const id=rowId854(r); if(!id)return;
 window.AIP_ENG_SELECTION_MODE='selected';
 window.AIP_ENG_SELECTED_MODEL=id;
 try{window.renderAIP831Engineering?.()}catch(_){}
 focusSelected854();
}
function move854(delta,edge){
 const list=rows854(); if(!list.length)return;
 const active=document.activeElement;
 let i=list.indexOf(active);
 if(i<0){
   const id=String(window.AIP_ENG_SELECTED_MODEL||'');
   i=list.findIndex(r=>rowId854(r)===id);
 }
 let j;
 if(edge==='home')j=0;
 else if(edge==='end')j=list.length-1;
 else j=Math.max(0,Math.min(list.length-1,(i<0?0:i)+delta));
 selectRow854(list[j]);
}

/* Window-capture scope intentionally runs before the application's global arrow-key
   navigation. When keyboard focus is in the Engineering Models chooser, arrows belong
   to the model list, not to Asset Explorer / application navigation. */
window.addEventListener('keydown',function(e){
 const p=pane854(); if(!p || !p.classList.contains('active'))return;
 const t=e.target;
 const row=t?.closest?.('.aip831-model-row');
 const selector=t?.closest?.('#aip852ModelSelect');

 if(row && ['ArrowUp','ArrowDown','Home','End'].includes(e.key)){
   e.preventDefault();
   e.stopPropagation();
   e.stopImmediatePropagation();
   if(e.key==='ArrowUp')move854(-1);
   else if(e.key==='ArrowDown')move854(1);
   else if(e.key==='Home')move854(0,'home');
   else move854(0,'end');
   return;
 }

 /* The Choose / None dropdown also owns its Up/Down keys. We implement its selection
    explicitly because the global shell otherwise captures those arrows. */
 if(selector && ['ArrowUp','ArrowDown','Home','End'].includes(e.key)){
   e.preventDefault();
   e.stopPropagation();
   e.stopImmediatePropagation();
   const opts=[...selector.options];
   if(!opts.length)return;
   let i=Math.max(0,selector.selectedIndex),j=i;
   if(e.key==='ArrowUp')j=Math.max(0,i-1);
   else if(e.key==='ArrowDown')j=Math.min(opts.length-1,i+1);
   else if(e.key==='Home')j=0;
   else if(e.key==='End')j=opts.length-1;
   selector.selectedIndex=j;
   selector.dispatchEvent(new Event('change',{bubbles:true}));
   requestAnimationFrame(()=>{try{selector.focus({preventScroll:true})}catch(_){selector.focus()}});
 }
},true);

/* Clicking a model leaves keyboard focus on the chosen row after the detail pane rerenders. */
document.addEventListener('click',function(e){
 const r=e.target.closest?.('#view-assetrelationships .aip831-model-row');
 if(!r)return;
 const id=rowId854(r);
 if(!id)return;
 window.AIP_ENG_SELECTION_MODE='selected';
 window.AIP_ENG_SELECTED_MODEL=id;
 setTimeout(focusSelected854,0);
},true);

/* Reapply accessibility/keyboard state whenever model rows are rebuilt by search/filter/render. */
const mo854=new MutationObserver(ms=>{
 if(ms.some(m=>m.target?.closest?.('#view-assetrelationships [data-ar-pane="engineering"]') ||
                  m.target===pane854())){
   requestAnimationFrame(decorate854);
 }
});
if(document.documentElement)mo854.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(decorate854,120));
else setTimeout(decorate854,120);

window.AIP_V854_AUDIT={
 release:'v87_856',baseline:'v87_855',area:'Asset Relationships → Engineering Models',
 uiOnly:true,excelBusinessDataChanged:false,syntheticBusinessEvidenceChanged:false,
 rootCause:'Application-level arrow-key navigation was receiving ArrowUp/ArrowDown after Engineering Model selection, so keyboard navigation escaped the model list and could move to another Asset Relationships capability such as Asset Explorer.',
 audited:[
  'Click a model row, then ArrowDown selects the next visible model',
  'ArrowUp selects the previous visible model',
  'Home/End move to first/last visible model',
  'Selected model row retains keyboard focus after detail-pane rerender',
  'Model list auto-scrolls to keep keyboard-selected row visible',
  'Search/class-filtered visible model population is respected',
  'Choose / None dropdown owns Up/Down/Home/End without shell navigation',
  'Global Asset Relationships arrow navigation remains unchanged outside the Engineering Models chooser'
 ],
 changes:[
  'Scoped keyboard ownership to Engineering Models chooser',
  'Prevented model-list arrow keys from bubbling into global application navigation',
  'Added accessible listbox/option state and roving tabindex',
  'Added automatic focus and nearest scrolling after keyboard model selection'
 ]
};
})();
