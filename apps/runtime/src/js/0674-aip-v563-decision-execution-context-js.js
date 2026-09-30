
(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function clearContext(){
    window.AIP_DI_EXECUTION_CONTEXT=null;
    const root=document.getElementById('view-decisionintelligence');
    if(!root)return;
    root.querySelector('.di563-exec-context')?.remove();
    root.querySelectorAll('.di563-exec-target').forEach(el=>el.classList.remove('di563-exec-target'));
  }

  function applyContext(){
    const ctx=window.AIP_DI_EXECUTION_CONTEXT;
    if(!ctx)return false;
    const root=document.getElementById('view-decisionintelligence');
    const state=window.AIP_DI_V401_STATE;
    if(!root||!state||state.tab!=='workspace'||state.stage!=='execution')return false;

    const panel=root.querySelector('.di445-exec');
    const flow=panel?.querySelector('.di445-exec-flow');
    if(!panel||!flow)return false;

    root.querySelectorAll('.di563-exec-target').forEach(el=>el.classList.remove('di563-exec-target'));

    let target=[...flow.querySelectorAll('.di445-exec-node')].find(n=>
      String(n.dataset.diExecStage||'').toLowerCase()===String(ctx.stage||'').toLowerCase() &&
      String(n.dataset.diExecSource||'').toLowerCase()===String(ctx.source||'').toLowerCase()
    );
    if(!target){
      target=[...flow.querySelectorAll('.di445-exec-node')].find(n=>
        /approved/i.test(n.dataset.diExecStage||'') && /approval history/i.test(n.dataset.diExecSource||'')
      );
    }
    if(!target)return false;

    target.classList.add('di563-exec-target');

    let banner=panel.querySelector('.di563-exec-context');
    if(!banner){
      banner=document.createElement('div');
      banner.className='di563-exec-context';
      const title=panel.querySelector('.di445-section-title');
      if(title)title.insertAdjacentElement('afterend',banner);
      else panel.insertBefore(banner,panel.firstChild);
    }
    banner.innerHTML=`<span><b>${esc(ctx.decisionId)}</b> · Execution Handoff · ${esc(ctx.stage)} · ${esc(ctx.status)} · ${esc(ctx.source)}</span><button type="button" aria-label="Clear execution context" title="Clear execution context">×</button>`;
    banner.querySelector('button').onclick=(e)=>{e.preventDefault();e.stopPropagation();clearContext();};
    target.scrollIntoView?.({block:'center',behavior:'auto'});
    return true;
  }

  function openExecutionContext(decisionId){
    const state=window.AIP_DI_V401_STATE;
    if(!state)return false;
    const did=String(decisionId||state.selected||'');
    if(!did)return false;

    state.selected=did;
    state.tab='workspace';
    state.stage='execution';
    window.AIP_DI_EXECUTION_CONTEXT={
      decisionId:did,
      stage:'Approved',
      status:'Not Started',
      source:'Approval History'
    };

    if(typeof window.renderDecisionIntelligenceV401==='function')window.renderDecisionIntelligenceV401();
    else if(typeof window.renderDecisionIntelligence==='function')window.renderDecisionIntelligence();

    requestAnimationFrame(()=>{if(!applyContext())setTimeout(applyContext,50)});
    return true;
  }

  window.AIPOpenDecisionExecutionContext=openExecutionContext;
  window.AIPClearDecisionExecutionContext=clearContext;

  /* Asset-to-Value: Execution Handoff is an internal Decision Intelligence lifecycle drill.
     Do not send it back to Loss Intelligence. */
  document.addEventListener('click',function(e){
    const host=e.target?.closest?.('#di401AtvHost');
    if(!host)return;
    const clickable=e.target.closest('button,[role="button"],a,.atv-node,.di-atv-node,[data-atv-node]');
    if(!clickable)return;
    const txt=((clickable.textContent||'')+' '+(clickable.getAttribute('title')||'')+' '+(clickable.getAttribute('aria-label')||'')).trim();
    if(!/execution\s*handoff/i.test(txt) && !(/approval\s*history/i.test(txt)&&/not\s*started/i.test(txt)))return;

    const did=window.AIP_DI_V401_STATE?.selected||window.AIP_DI_SELECTED_CONTEXT?.decisionId||'';
    if(!/(^|-)DEC-003$/i.test(String(did)))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openExecutionContext(did);
  },true);

  /* Reapply after normal Decision Intelligence rerenders while context is active. */
  document.addEventListener('click',function(){
    if(!window.AIP_DI_EXECUTION_CONTEXT)return;
    setTimeout(applyContext,0);
  });

  window.AIP_V563_AUDIT={
    release:'v563',baseline:'v562',
    decision:'DEC-003',
    sourceNode:'Asset-to-Value → Execution Handoff',
    destination:'Decision Workspace → Execution & Handoff',
    exactContext:{stage:'Approved',status:'Not Started',source:'Approval History'},
    behavior:[
      'Contextual internal navigation instead of returning to Loss Intelligence',
      'Exact Approved / Not Started / Approval History execution node highlighted pink',
      'Pink context row displayed in Execution & Handoff',
      '× clears both contextual row and exact-node highlight without leaving Decision Workspace'
    ],
    excelChanged:false
  };
})();
window.AIP_CURRENT_BUILD='v563';
