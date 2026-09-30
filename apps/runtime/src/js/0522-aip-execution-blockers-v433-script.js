
(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function payload(){
    return String(window.APM_DATA_MODE||'').toLowerCase().includes('synthetic')
      ? window.AIP_DI_SYNTHETIC : window.AIP_DI_EXCEL;
  }
  function getDecision(id){
    return (payload()?.decisions||[]).find(d=>d.id===id);
  }
  function ensure(){
    let bd=document.querySelector('.di418-backdrop'),dr=document.querySelector('.di418-drawer');
    if(!bd){
      bd=document.createElement('div');bd.className='di418-backdrop';document.body.appendChild(bd);
      dr=document.createElement('aside');dr.className='di418-drawer';document.body.appendChild(dr);
      bd.addEventListener('click',close);
    }
    return {bd,dr};
  }
  function close(){
    document.querySelector('.di418-backdrop')?.classList.remove('open');
    document.querySelector('.di418-drawer')?.classList.remove('open');
  }
  function openGovernance(decisionId, blockerId){
    const s=window.AIP_DI_V401_STATE;
    if(!s)return;
    close();
    window.AIP_DI_ACTIVE_ROW=decisionId;
    window.AIP_DI_SELECTED_CONTEXT={decisionId};
    window.AIP_DI_WORKSPACE_ORIGIN={from:'overview',decisionId,blockerId,stage:'governance'};
    window.AIP_DI_RETURN_TO_OVERVIEW_ID=decisionId;
    s.selected=decisionId;
    s.tab='workspace';
    s.stage='governance';
    if(typeof window.renderDecisionIntelligenceV401==='function')window.renderDecisionIntelligenceV401();
    else if(typeof window.renderDecisionIntelligence==='function')window.renderDecisionIntelligence();
  }
  function openExternal(decisionId, blocker){
    const d=getDecision(decisionId); if(!d)return;
    close();
    window.AIP_DI_BLOCKER_RETURN={
      decisionId,
      blockerId:blocker.id,
      sourceTab:'overview',
      site:d.site,
      asset:d.asset,
      sourceRecord:blocker.sourceRecord,
      targetView:blocker.targetView
    };
    window.AIP_CONTEXT_NAV={
      source:'Decision Intelligence · Execution Blocker',
      target:blocker.targetView,
      decisionId,
      blockerId:blocker.id,
      plantId:d.site,
      plantName:d.site,
      assetId:d.asset,
      sourceRecord:blocker.sourceRecord,
      metric:blocker.title
    };
    const nav=document.querySelector(`.nav-item[data-view="${blocker.targetView}"]`);
    if(nav){nav.click();return;}
    if(typeof window.activate==='function')window.activate(blocker.targetView);
  }
  function open(id){
    const d=getDecision(id); if(!d)return;
    const {bd,dr}=ensure();
    const blockers=d.blockers||[];
    dr.innerHTML=`<div class="di418-drawer-head"><div><h3>Execution Blockers · ${esc(id)}</h3><div class="di401-meta">${esc(d.site)} · ${esc(d.asset)} · ${blockers.length} open blocker${blockers.length===1?'':'s'}</div></div><button class="di418-close">Close</button></div>${blockers.length?blockers.map(b=>`<div class="di418-blocker" data-blocker-id="${esc(b.id)}"><div class="di433-blocker-top"><h4>${esc(b.title)}</h4><span class="di433-blocker-status">${esc(b.status)}</span></div><p class="di433-blocker-detail">${esc(b.detail||'')}</p><div class="di418-blocker-meta">${esc(b.source)}${b.sourceRecord?` · ${esc(b.sourceRecord)}`:''}</div>${b.targetView?`<button class="di418-blocker-action" data-blocker-id="${esc(b.id)}">${esc(b.actionLabel||'View details')} <span aria-hidden="true">↗</span></button>`:''}</div>`).join(''):`<div class="di418-ready">Ready ✓</div>`}`;
    dr.querySelector('.di418-close')?.addEventListener('click',close);
    dr.querySelectorAll('.di418-blocker-action').forEach(btn=>btn.addEventListener('click',()=>{
      const blocker=blockers.find(b=>b.id===btn.dataset.blockerId); if(!blocker)return;
      if(blocker.targetView==='__governance__')openGovernance(id,blocker.id);
      else openExternal(id,blocker);
    }));
    bd.classList.add('open');dr.classList.add('open');
  }

  document.addEventListener('click',function(e){
    const b=e.target.closest?.('[data-di-blockers]');
    if(!b)return;
    e.preventDefault();
    e.stopPropagation();
    open(b.dataset.diBlockers);
  },true);

  window.AIPExecutionBlockersV433={open,close,openGovernance};
  window.AIPExecutionBlockersV418=window.AIPExecutionBlockersV433;
})();
