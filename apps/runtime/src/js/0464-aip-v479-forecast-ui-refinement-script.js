
(function(){
  if(window.__AIP_V479_FORECAST_UI__)return; window.__AIP_V479_FORECAST_UI__=true;
  document.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('#view-operationaltwin .gf476-nav[data-fd]');
    if(!b)return;
    const wrap=b.closest('.gf476-explore');
    if(wrap)wrap.querySelectorAll('.gf476-nav[data-fd]').forEach(x=>x.classList.toggle('is-selected',x===b));
  },true);
})();
