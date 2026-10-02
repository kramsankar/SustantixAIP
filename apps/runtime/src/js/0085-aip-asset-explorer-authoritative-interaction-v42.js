
(function(){
'use strict';
let suppressClickUntil=0;
function active(){return document.getElementById('view-assetexplorer')?.classList.contains('active')}
function handlePointer(e){
  if(!active())return;
  const row=e.target.closest?.('#view-assetexplorer .ax-asset[data-ax-id]');
  const tab=e.target.closest?.('#view-assetexplorer [data-ax-tab]');
  const filter=e.target.closest?.('#view-assetexplorer [data-ax-filter]');
  if(!row&&!tab&&!filter)return;
  const ctl=window.AIPAssetExplorerController;
  if(!ctl)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  suppressClickUntil=performance.now()+700;
  if(row)ctl.selectAsset(row.dataset.axId);
  else if(filter)ctl.setFilter?.(filter.dataset.axFilter);
  else ctl.setTab(tab.dataset.axTab);
}
function blockFollowupClick(e){
  if(performance.now()>suppressClickUntil)return;
  if(e.target.closest?.('#view-assetexplorer .ax-asset[data-ax-id],#view-assetexplorer [data-ax-tab],#view-assetexplorer [data-ax-filter]')){
    e.preventDefault();e.stopImmediatePropagation();
  }
}
document.addEventListener('pointerdown',handlePointer,true);
document.addEventListener('mousedown',function(e){
  if(window.PointerEvent)return;
  handlePointer(e);
},true);
document.addEventListener('click',blockFollowupClick,true);
})();
