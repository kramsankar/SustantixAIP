
(function(){
'use strict';
function syncWarrantyClaimScrollbars(){
  const root=document.getElementById('view-maintenancelearning');
  if(!root)return;

  const table=root.querySelector('.ml534-table');
  if(!table)return;

  let wrap=table.closest('.ml534-claim-table-wrap');
  if(!wrap){
    const parent=table.parentElement;
    if(!parent)return;
    wrap=document.createElement('div');
    wrap.className='ml534-claim-table-wrap';
    parent.insertBefore(wrap,table);
    wrap.appendChild(table);
  }

  let host=wrap.parentElement;
  if(!host.classList.contains('ml534-claim-scroll-host')){
    const h=document.createElement('div');
    h.className='ml534-claim-scroll-host';
    host.insertBefore(h,wrap);
    h.appendChild(wrap);
    host=h;
  }

  let top=host.querySelector('.ml534-top-scroll');
  if(!top){
    top=document.createElement('div');
    top.className='ml534-top-scroll';
    top.innerHTML='<div></div>';
    host.insertBefore(top,wrap);
  }

  const spacer=top.firstElementChild;
  const refresh=()=>{
    spacer.style.width=Math.max(wrap.scrollWidth,wrap.clientWidth)+'px';
    const needs=wrap.scrollWidth>wrap.clientWidth+2;
    top.style.display=needs?'block':'none';
  };

  if(!top.dataset.synced){
    let lock=false;
    top.addEventListener('scroll',()=>{
      if(lock)return;
      lock=true; wrap.scrollLeft=top.scrollLeft; lock=false;
    });
    wrap.addEventListener('scroll',()=>{
      if(lock)return;
      lock=true; top.scrollLeft=wrap.scrollLeft; lock=false;
    });
    top.dataset.synced='1';
  }

  refresh();
  setTimeout(refresh,0);
  setTimeout(refresh,120);
}
window.AIPSyncWarrantyClaimScrollbars=syncWarrantyClaimScrollbars;

const oldRender=window.renderMaintenanceLearningV856;
if(typeof oldRender==='function' && !oldRender.__v539wrapped){
  const wrapped=function(...args){
    const out=oldRender.apply(this,args);
    requestAnimationFrame(syncWarrantyClaimScrollbars);
    setTimeout(syncWarrantyClaimScrollbars,80);
    return out;
  };
  wrapped.__v539wrapped=true;
  window.renderMaintenanceLearningV856=wrapped;
}
document.addEventListener('click',()=>{
  setTimeout(syncWarrantyClaimScrollbars,0);
});
window.addEventListener('resize',syncWarrantyClaimScrollbars);

window.AIP_CURRENT_BUILD='v648';
})();
