
(function(){
'use strict';
if(window.__AIP_V121_SAFE_PATCH)return;
window.__AIP_V121_SAFE_PATCH=true;

function planRoot(){ return document.getElementById('view-resourceplanning'); }
function woRoot(){ return document.getElementById('view-workorderintelligence'); }
function scrollYNow(){
  const sc=document.scrollingElement||document.documentElement;
  return Number(sc?.scrollTop||window.scrollY||0);
}
function clearTarget(root){
  const r=root||document;
  r.querySelectorAll?.('.aip-v121-plan-target').forEach(x=>x.classList.remove('aip-v121-plan-target'));
  r.querySelectorAll?.('.aip-v121-context-banner').forEach(x=>x.remove());
}
window.planV121ClearTarget=function(){
  clearTarget(planRoot());
  clearTarget(woRoot());
};
function banner(root,label){
  if(!root)return;
  root.querySelectorAll('.aip-v121-context-banner').forEach(x=>x.remove());
  const b=document.createElement('div');
  b.className='aip-v121-context-banner';
  b.innerHTML='<b>'+String(label||'Planning context')+'</b><button type="button" onclick="planV121ClearTarget()">× Clear highlight</button>';
  const head=root.querySelector('.view-head');
  if(head)head.insertAdjacentElement('afterend',b);
  else root.prepend(b);
}
function mark(el,root,label){
  if(!el||!root)return false;
  clearTarget(root);
  el.classList.add('aip-v121-plan-target');
  banner(root,label);
  try{el.scrollIntoView({block:'center',behavior:'auto'});}catch(_){}
  return true;
}

/* Exact Work Order focus without changing the Work Order renderer. */
function focusWorkOrder(r,attempt){
  attempt=attempt||0;
  const root=woRoot();
  if(!root){ if(attempt<14)setTimeout(()=>focusWorkOrder(r,attempt+1),120); return; }

  try{
    if(typeof window.opsWOTab==='function') window.opsWOTab('ledger');
    else if(typeof opsWOTab==='function') opsWOTab('ledger');
  }catch(_){}

  const id=String(r.Work_Order_ID||'');
  if(!id)return;

  /* Use the ledger's own search control so the exact record is visible. */
  const input=[...root.querySelectorAll('input')].find(x=>/Search WO, asset or site/i.test(x.placeholder||''));
  if(input && input.value!==id){
    input.value=id;
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  try{ if(typeof opsSetSelectedWorkOrder==='function')opsSetSelectedWorkOrder(id); }catch(_){}

  const hit=[...root.querySelectorAll('.ops-table tbody tr')].find(tr=>
    [...tr.querySelectorAll('td')].some(td=>(td.textContent||'').trim()===id) ||
    (tr.textContent||'').includes(id)
  );
  if(hit){
    mark(hit,root,'Planning & Optimization context · '+id+' · '+String(r.Intervention_ID||''));
    return;
  }
  if(attempt<14)setTimeout(()=>focusWorkOrder(r,attempt+1),130);
}

/* Only override the two Planning drill functions. The v1.20 Planning renderer itself is untouched. */
function installOverrides(){
  if(typeof window.planOpenDependency==='function' && !window.planOpenDependency.__v121safe){
    const safeDependency=function(id,kind){
      const root=planRoot();
      const sc=document.scrollingElement||document.documentElement;
      window.AIP_PLAN_STATUS_RETURN={tab:'overview',selected:id,scrollY:Number(sc?.scrollTop||window.scrollY||0)};

      /* Use v1.20's public state actions so the current five-tab renderer remains authoritative. */
      if(kind==='schedule'){
        try{window.planSelect?.(id,'schedule');}catch(_){}
      }else if(kind==='governance'){
        try{window.planSelect?.(id,'optimize');}catch(_){}
      }else{
        try{window.planSelect?.(id,'resources');}catch(_){}
      }

      const labels={
        crew:'Crew & skills',
        material:'Materials & spares',
        toolvehicle:'Tools / tackles & vehicle',
        accessoutage:'Execution prerequisites'
      };

      setTimeout(function locate(){
        const r=planRoot(); if(!r)return;
        let target=null;
        if(kind==='crew'||kind==='material'||kind==='toolvehicle'||kind==='accessoutage'){
          const wanted=labels[kind];
          const h=[...r.querySelectorAll('h3')].find(x=>(x.textContent||'').trim()===wanted);
          target=h?.closest('.po-card')||null;
        }else{
          const candidates=[...r.querySelectorAll('tr,.po-gantt-row,.po-gantt104-row,.po-card')];
          target=candidates.find(x=>(x.textContent||'').includes(id))||null;
        }
        if(target)mark(target,r,'Planning context · '+id+' · '+(
          kind==='schedule'?'Intervention Schedule':
          kind==='governance'?'Optimize & Govern':
          labels[kind]||'Dependency'
        ));
      },60);
    };
    safeDependency.__v121safe=true;
    window.planOpenDependency=safeDependency;
  }

  if(typeof window.planOpenSource==='function' && !window.planOpenSource.__v121safe){
    const safeSource=function(id,type){
      /* Read the selected Planning record from the already-rendered v1.20 screen data by
         using the existing public selection first, then invoke the original source logic only
         if exact WO navigation is not requested. */
      let r=null;
      try{
        const all=(typeof rows==='function')?rows():[];
        r=all.find(x=>String(x.Intervention_ID)===String(id))||null;
      }catch(_){}
      if(!r){
        /* v1.20's row helper is lexical. Recover the visible identifiers from the Overview
           dependency context when needed, without touching the renderer. */
        const root=planRoot();
        const ctx=(root?.querySelector('.po-v120-banner b')?.textContent||'').trim();
        r={Intervention_ID:id,Work_Order_ID:'',Asset_ID:'',Plant_ID:'',_ctx:ctx};
      }

      if(type!=='wo'){
        const old=window.planOpenSource.__v121original;
        if(typeof old==='function')return old(id,type);
        return;
      }

      const currentRoot=planRoot();
      const woButton=[...currentRoot?.querySelectorAll('.po-v120-deps .po-dep-node')||[]].find(b=>
        /^Work Order$/i.test((b.querySelector('b')?.textContent||'').trim())
      );
      if(!r.Work_Order_ID)r.Work_Order_ID=(woButton?.querySelector('span')?.textContent||'').trim();

      window.AIP_PLAN_EXTERNAL_RETURN={
        tab:'overview',selected:id,scrollY:scrollYNow(),
        interventionId:id,workOrderId:r.Work_Order_ID||'',
        assetId:r.Asset_ID||'',plantId:r.Plant_ID||''
      };
      window.AIP_CONTEXT_NAV={
        source:'Planning & Optimization',
        interventionId:id,
        workOrderId:r.Work_Order_ID||'',
        assetId:r.Asset_ID||'',
        plantId:r.Plant_ID||'',
        target:'workorderintelligence',
        contextToken:'PLAN-'+Date.now()
      };
      try{sessionStorage.setItem('aip.context.nav',JSON.stringify(window.AIP_CONTEXT_NAV));}catch(_){}
      window.AIP_WO_DESIRED_TAB='ledger';

      try{window.activate?.('workorderintelligence');}
      catch(_){document.querySelector('[data-view="workorderintelligence"]')?.click();}

      [50,160,330,600,950].forEach((ms,i)=>setTimeout(()=>focusWorkOrder(r,i),ms));
    };
    safeSource.__v121safe=true;
    safeSource.__v121original=window.planOpenSource;
    window.planOpenSource=safeSource;
  }
}

/* Back from an external Planning-origin target must win before generic history.
   Window-capture runs before document-level handlers without changing global history code. */
window.addEventListener('click',function(e){
  const b=e.target?.closest?.('#aipBackBtn');
  const ret=window.AIP_PLAN_EXTERNAL_RETURN;
  if(!b||!ret)return;
  const active=document.querySelector('.view.active[id]')?.id||'';
  if(active!=='view-workorderintelligence'&&active!=='view-assetexplorer'&&active!=='view-aivision')return;

  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  clearTarget(woRoot());

  try{window.activate?.('resourceplanning');}
  catch(_){document.querySelector('[data-view="resourceplanning"]')?.click();}

  const restore=function(){
    const U=window.PLAN_UI||{};
    if(ret.selected||ret.interventionId)U.selected=ret.selected||ret.interventionId;
    try{window.planSetTab?.(ret.tab||'overview');}catch(_){}
    /* Re-apply the originating intervention only after the requested Planning tab is active.
       Overview uses the priority preview; Plan & Resources keeps the record selection without
       forcing the application back to Overview. */
    if((ret.tab||'overview')==='overview'){
      try{window.planPreviewPriority?.(ret.selected||ret.interventionId);}catch(_){}
    }else if((ret.tab||'')==='resources'){
      try{window.planSelect?.(ret.selected||ret.interventionId);}catch(_){}
    }
    setTimeout(()=>window.scrollTo(0,Number(ret.scrollY)||0),25);
  };
  requestAnimationFrame(()=>requestAnimationFrame(restore));
  setTimeout(restore,130);
  window.AIP_PLAN_EXTERNAL_RETURN=null;
},true);

window.addEventListener('keydown',function(e){
  if(!(e.altKey&&e.key==='ArrowLeft')||!window.AIP_PLAN_EXTERNAL_RETURN)return;
  const active=document.querySelector('.view.active[id]')?.id||'';
  if(active!=='view-workorderintelligence'&&active!=='view-assetexplorer'&&active!=='view-aivision')return;
  const back=document.getElementById('aipBackBtn');
  if(back){
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    back.click();
  }
},true);

installOverrides();
setTimeout(installOverrides,400);
setTimeout(installOverrides,1200);
setTimeout(installOverrides,2200);

window.AIP_V121_AUDIT={
  release:'v1.21',
  baseline:'AIP_v120.zip',
  safeAdditivePatch:true,
  planningRendererReplaced:false,
  sharedRendererChanged:false,
  excelBusinessDataChanged:false,
  changes:[
    'Planning Overview dependency descriptions replaced by icon-only navy drill cues',
    'Work Order Intelligence KPI titles left aligned only',
    'Planning dependency drills retain exact intervention context with persistent target highlight and Clear highlight',
    'Work Order drill opens Work Order Intelligence ledger with exact Work Order search/highlight',
    'Planning-origin external Back returns to Planning & Optimization Overview and restores prior scroll/context'
  ]
};
})();
