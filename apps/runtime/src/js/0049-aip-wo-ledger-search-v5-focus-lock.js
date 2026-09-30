
(function(){
  let searchFocused=false;
  let pendingRender=false;
  let savedRender=null;

  function isSearch(el){return !!el && el.id==='aipWoLedgerSearch'}

  function installRenderGuard(){
    const current=window.renderWorkOrderIntelligence;
    if(typeof current!=='function' || current.__aipSearchFocusGuard)return;
    savedRender=current;
    const guarded=function(){
      if(searchFocused || isSearch(document.activeElement)){
        pendingRender=true;
        return;
      }
      return savedRender.apply(this,arguments);
    };
    guarded.__aipSearchFocusGuard=true;
    guarded.__aipOriginal=savedRender;
    window.renderWorkOrderIntelligence=guarded;
  }

  function isolate(e){
    if(!isSearch(e.target))return;
    searchFocused=true;
    e.stopPropagation();
  }

  document.addEventListener('focusin',function(e){
    if(isSearch(e.target)){
      searchFocused=true;
      installRenderGuard();
    }
  },true);

  document.addEventListener('focusout',function(e){
    if(!isSearch(e.target))return;
    searchFocused=false;
    if(pendingRender){
      pendingRender=false;
      setTimeout(function(){
        if(!searchFocused && typeof window.renderWorkOrderIntelligence==='function'){
          window.renderWorkOrderIntelligence();
        }
      },0);
    }
  },true);

  ['keydown','keypress','keyup','beforeinput','input','compositionstart','compositionupdate','compositionend']
    .forEach(function(name){document.addEventListener(name,isolate,true)});

  // Reinstall after older enhancement layers replace the renderer.
  installRenderGuard();
  document.addEventListener('aip:view-rendered',installRenderGuard);
  document.addEventListener('aip:login-complete',installRenderGuard);

  // Keep focus and caret stable even if a third-party listener attempts to move it.
  let lastValue='';
  document.addEventListener('input',function(e){
    if(!isSearch(e.target))return;
    lastValue=e.target.value;
    const pos=e.target.selectionStart;
    requestAnimationFrame(function(){
      const input=document.getElementById('aipWoLedgerSearch');
      if(!input)return;
      if(input.value!==lastValue)input.value=lastValue;
      if(document.activeElement!==input)input.focus({preventScroll:true});
      try{input.setSelectionRange(pos,pos)}catch(_){ }
    });
  },false);
})();
