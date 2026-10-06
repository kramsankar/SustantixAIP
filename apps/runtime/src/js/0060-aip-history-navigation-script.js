
(function(){
  'use strict';
  const backBtn=document.getElementById('aipBackBtn');
  const forwardBtn=document.getElementById('aipForwardBtn');
  if(!backBtn||!forwardBtn)return;

  const history=[];
  let index=-1;
  let suppressRecord=false;
  let lastObserved='';

  function cleanText(value){return String(value||'').replace(/[+−]/g,'').replace(/\s+/g,' ').trim();}
  function activeViewId(){
    const view=document.querySelector('.view.active[id^="view-"]');
    if(view)return view.id.replace(/^view-/,'');
    const active=document.querySelector('#sidebar .nav-item.active[data-view]');
    return active?active.dataset.view:'overview';
  }
  function navItem(view){return document.querySelector('#sidebar .nav-item[data-view="'+CSS.escape(view)+'"]');}
  function labelFor(view){
    const item=navItem(view);
    if(!item)return view.replace(/([a-z])([A-Z])/g,'$1 $2');
    const clone=item.cloneNode(true);
    clone.querySelectorAll('svg,.ic,.nav-icon,.x-nav-icon').forEach(x=>x.remove());
    return cleanText(clone.textContent)||view;
  }
  function groupFor(view){
    const item=navItem(view);
    const group=item&&item.closest('.x-nav-group');
    if(!group)return 'Portfolio';
    const head=group.querySelector('.x-nav-head');
    if(!head)return 'Portfolio';
    const clone=head.cloneNode(true);
    clone.querySelectorAll('svg,.ic,.x-nav-icon').forEach(x=>x.remove());
    return cleanText(clone.textContent)||'Portfolio';
  }
  function updateUI(){
    backBtn.disabled=index<=0;
    forwardBtn.disabled=index<0||index>=history.length-1;
  }
  function record(view,replace){
    if(!view)return;
    if(index>=0&&history[index]===view){updateUI();return;}
    if(replace&&index>=0){history[index]=view;}
    else{
      history.splice(index+1);
      history.push(view);
      index=history.length-1;
      if(history.length>60){history.shift();index--;}
    }
    updateUI();
  }
  function activate(view){
    if(!view)return;
    suppressRecord=true;
    try{
      if(window.AIP_V21&&typeof window.AIP_V21.open==='function'){
        const customView=document.getElementById('view-'+view);
        const customIds=['contextgraph','operationaltwin','twinfoundation','decisionworkspace','scenarios','eventreconstruction','resourceplanning','apiconnectors','dataquality','securityaudit','reliabilityrisk'];
        if(customView&&customIds.includes(view))window.AIP_V21.open(view);
        else navItem(view)?.click();
      }else navItem(view)?.click();
    }finally{
      setTimeout(()=>{suppressRecord=false;lastObserved=view;updateUI();},30);
    }
  }
  function go(delta){
    /* Local Decision Intelligence drill-back takes precedence over global view history. */
    if(delta<0){
      const active=activeViewId();
      if(active==='sustainabilityintelligence'&&window.AIP_SUS_PRIORITY_NAV?.back?.()){updateUI();return;}
      const diState=window.AIP_DI_V401_STATE;
      if(active==='decisionintelligence'&&diState&&diState.tab==='workspace'){
        diState.tab='overview';
        window.AIP_DI_WORKSPACE_ORIGIN=null;
        if(typeof window.renderDecisionIntelligenceV401==='function')window.renderDecisionIntelligenceV401();
        else if(typeof window.renderDecisionIntelligence==='function')window.renderDecisionIntelligence();
        updateUI();
        return;
      }
    }
    const target=index+delta;
    if(target<0||target>=history.length)return;
    index=target;
    activate(history[index]);
    updateUI();
  }

  backBtn.addEventListener('click',()=>go(-1));
  forwardBtn.addEventListener('click',()=>go(1));
  document.addEventListener('keydown',e=>{
    if(!e.altKey)return;
    if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}
    else if(e.key==='ArrowRight'){e.preventDefault();go(1);}
  });

  document.addEventListener('click',e=>{
    const item=e.target.closest&&e.target.closest('#sidebar .nav-item[data-view]');
    if(!item||suppressRecord)return;
    const view=item.dataset.view;
    setTimeout(()=>{record(view,false);lastObserved=view;},0);
  },true);

  const observer=new MutationObserver(()=>{
    const view=activeViewId();
    if(!view||view===lastObserved)return;
    lastObserved=view;
    if(suppressRecord){updateUI();return;}
    record(view,false);
  });
  observer.observe(document.getElementById('app')||document.body,{subtree:true,attributes:true,attributeFilter:['class']});

  const initial=activeViewId();
  history.push(initial);index=0;lastObserved=initial;updateUI();
  window.AIP_HISTORY_NAV={back:()=>go(-1),forward:()=>go(1),history:()=>history.slice(),current:()=>history[index],record:(view)=>{record(view,false);lastObserved=view;},recordPath:(source,target)=>{record(source,false);record(target,false);lastObserved=target;}};
})();
