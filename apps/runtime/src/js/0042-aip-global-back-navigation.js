
(function(){
  'use strict';

  const historyStack=[];
  let currentView='';
  let navigatingBack=false;
  let mutationQueued=false;
  let lastRecordedAt=0;

  function activeViewId(){
    const active=document.querySelector('.view.active[id^="view-"]');
    return active ? active.id.slice(5) : '';
  }

  function viewLabel(viewId){
    const nav=document.querySelector('.nav-item[data-view="'+CSS.escape(viewId)+'"]');
    const raw=(nav?.textContent||viewId||'Previous feature').replace(/\s+/g,' ').trim();
    return raw.replace(/[–—]\s*$/,'').trim();
  }

  function captureState(viewId){
    if(!viewId) return null;
    const view=document.getElementById('view-'+viewId);
    const activeTab=view?.querySelector(
      '.tab.active,[role="tab"][aria-selected="true"],.ops-tab.active,.sx-tab.active,.ax-tab.active,.subnav-item.active'
    );
    return {
      view:viewId,
      label:viewLabel(viewId),
      scrollY:window.scrollY||document.documentElement.scrollTop||0,
      viewScroll:view?.scrollTop||0,
      activeTabId:activeTab?.id||'',
      activeTabText:(activeTab?.textContent||'').replace(/\s+/g,' ').trim()
    };
  }

  function updateButton(){
    const btn=document.getElementById('aipGlobalBack');
    const origin=document.getElementById('aipBackOrigin');
    if(!btn) return;
    const previous=historyStack[historyStack.length-1];
    btn.style.display=previous?'inline-flex':'none';
    btn.disabled=!previous;
    if(origin) origin.textContent=previous ? 'to '+previous.label : '';
    btn.title=previous ? 'Back to '+previous.label : 'No previous feature';
    btn.setAttribute('aria-label',previous ? 'Back to '+previous.label : 'No previous feature');
  }

  function restoreTab(state){
    if(!state) return;
    const view=document.getElementById('view-'+state.view);
    if(!view) return;
    let tab=null;
    if(state.activeTabId){
      try{tab=view.querySelector('#'+CSS.escape(state.activeTabId));}catch(_){}
    }
    if(!tab && state.activeTabText){
      tab=Array.from(view.querySelectorAll(
        '.tab,.ops-tab,.sx-tab,.ax-tab,[role="tab"],.subnav-item'
      )).find(x=>(x.textContent||'').replace(/\s+/g,' ').trim()===state.activeTabText);
    }
    if(tab && !tab.classList.contains('active')){
      try{tab.click();}catch(_){}
    }
  }

  function restoreState(state){
    if(!state) return;
    navigatingBack=true;
    if(typeof window.activate==='function'){
      window.activate(state.view,true);
    }else{
      const nav=document.querySelector('.nav-item[data-view="'+CSS.escape(state.view)+'"]');
      if(nav) nav.click();
    }
    setTimeout(()=>{
      restoreTab(state);
      const view=document.getElementById('view-'+state.view);
      if(view) view.scrollTop=state.viewScroll||0;
      window.scrollTo({top:state.scrollY||0,left:0,behavior:'auto'});
      currentView=state.view;
      navigatingBack=false;
      updateButton();
    },60);
  }

  function recordTransition(){
    mutationQueued=false;
    if(window.__aipSilentValidation){currentView=activeViewId()||currentView;return;}
    const next=activeViewId();
    if(!next) return;
    if(!currentView){
      currentView=next;
      updateButton();
      return;
    }
    if(next===currentView) return;

    if(navigatingBack){
      currentView=next;
      updateButton();
      return;
    }

    const now=Date.now();
    const previousState=captureState(currentView);
    const last=historyStack[historyStack.length-1];
    const explicitOriginActive=Number(window.__aipExplicitNavOriginUntil||0)>now;

    // Avoid duplicate entries caused by several class mutations during one navigation.
    if(!explicitOriginActive && previousState && (!last || last.view!==previousState.view || now-lastRecordedAt>300)){
      historyStack.push(previousState);
      if(historyStack.length>40) historyStack.shift();
      lastRecordedAt=now;
    }
    currentView=next;
    updateButton();
  }

  function queueTransitionCheck(){
    if(mutationQueued) return;
    mutationQueued=true;
    requestAnimationFrame(recordTransition);
  }

  function goBack(){
    if(!historyStack.length) return;
    const state=historyStack.pop();
    restoreState(state);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    currentView=activeViewId();
    updateButton();

    const btn=document.getElementById('aipGlobalBack');
    btn?.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      goBack();
    });

    const observer=new window.__APMSafeMutationObserver(mutations=>{
      if(mutations.some(m=>m.type==='attributes' && m.attributeName==='class' &&
          m.target instanceof Element && m.target.classList.contains('view'))){
        queueTransitionCheck();
      }
    });
    document.querySelectorAll('.view').forEach(v=>{
      observer.observe(v,{attributes:true,attributeFilter:['class']});
    });

    // Keyboard equivalents: Alt+Left and Backspace outside editable controls.
    document.addEventListener('keydown',e=>{
      const editable=e.target?.matches?.('input,textarea,select,[contenteditable="true"]');
      if((e.altKey && e.key==='ArrowLeft') || (e.key==='Backspace' && !editable)){
        if(historyStack.length){
          e.preventDefault();
          goBack();
        }
      }
    },true);
  });

  window.aipPushNavigationOrigin=function(viewId){
    const id=viewId||activeViewId();
    const state=captureState(id);
    if(!state)return false;
    const last=historyStack[historyStack.length-1];
    if(!last || last.view!==state.view || Date.now()-lastRecordedAt>300){
      historyStack.push(state);
      if(historyStack.length>40)historyStack.shift();
      lastRecordedAt=Date.now();
    }
    window.__aipExplicitNavOriginUntil=Date.now()+700;
    updateButton();
    return true;
  };
  window.aipGoBack=goBack;
  window.aipNavigationHistory=historyStack;
})();
