
(function(){
  function hasReturn(){
    if(window.AIP_ORL_ACTION_RETURN)return true;
    try{return !!sessionStorage.getItem('aip.orl.action.return')}catch(_){return false}
  }
  function restore(e){
    if(!hasReturn())return false;
    if(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}
    return !!window.orlRestoreFromAction?.();
  }
  window.addEventListener('click',function(e){
    const btn=e.target?.closest?.('#aipBackBtn');
    if(!btn||!hasReturn())return;
    restore(e);
  },true);
  window.addEventListener('keydown',function(e){
    if(!e.altKey||e.key!=='ArrowLeft'||!hasReturn())return;
    restore(e);
  },true);
})();
