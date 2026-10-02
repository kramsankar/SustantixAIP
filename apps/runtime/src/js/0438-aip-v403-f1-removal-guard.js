
(function(){
  function purgeF1Help(){
    document.querySelectorAll('.f1-btn,.f1-help-top-right,.f1-help-fallback-row,.cp155-help-btn,[data-f1-help],[aria-label*="F1 Help" i],[title="F1 Help"]').forEach(function(el){el.remove();});
    var overlay=document.getElementById('helpOverlay');
    if(overlay){ overlay.classList.remove('open'); overlay.setAttribute('aria-hidden','true'); }
  }
  document.addEventListener('keydown',function(e){
    if(e.key==='F1'){ e.preventDefault(); e.stopImmediatePropagation(); }
  },true);
  function start(){
    purgeF1Help();
    var root=document.getElementById('main')||document.body||document.documentElement;
    if(root){ new MutationObserver(function(){purgeF1Help();}).observe(root,{childList:true,subtree:true}); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
