
(function(){
'use strict';
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function norm(v){return String(v||'').replace(/^SYN-/,'')}
function activeCommercialRows(){
 const mode=String(window.APM_DATA_MODE||'').toLowerCase();
 const syn=window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData?.['Commercial & PPA']||
           window.AIP_INDEPENDENT_SYNTHETIC_DATA?.['Commercial & PPA']||[];
 const imported=window.APM_IMPORTED_DATA?.['Commercial & PPA']||[];
 const embedded=window.EMBEDDED_EXCEL_DATA?.['Commercial & PPA']||[];
 return /synthetic/.test(mode)?(syn.length?syn:embedded):(imported.length?imported:embedded);
}
function rowForRecord(record,siteId){
 const rec=norm(record),rows=activeCommercialRows();
 return rows.find(r=>norm(r.PPA_ID)===rec)||
        rows.find(r=>String(r.Plant_ID||'')===String(siteId||''))||null;
}
function decorateCommercial(ctx){
 const root=document.getElementById('view-commercialppa');if(!root)return false;
 const r=rowForRecord(ctx.record,ctx.siteId);
 if(!r)return false;
 const pid=String(r.PPA_ID||norm(ctx.record)||''),plant=String(r.Plant_ID||ctx.siteId||'');
 root.querySelectorAll('.cppa-rank-row[data-plant]').forEach(el=>{
   const p=rowForRecord('',el.dataset.plant);
   let badge=el.querySelector('.aip-v589-ppa-id');
   if(!badge){badge=document.createElement('span');badge.className='aip-v589-ppa-id';el.querySelector('.cppa-rank-label')?.appendChild(badge)}
   if(badge)badge.textContent=p?.PPA_ID||'';
   el.dataset.cppaRecord=p?.PPA_ID||'';
   el.classList.toggle('aip-v589-commercial-target',norm(p?.PPA_ID)===norm(pid));
 });
 const target=[...root.querySelectorAll('.cppa-rank-row[data-plant]')].find(el=>norm(el.dataset.cppaRecord)===norm(pid));
 if(target)target.scrollIntoView?.({block:'center',behavior:'auto'});
 root.querySelector('.aip-v589-commercial-banner')?.remove();
 const host=root.querySelector('.cppa-analysis-workspace')||root.querySelector('#cppaBody')||root;
 const b=document.createElement('div');b.className='aip-v589-commercial-banner';
 b.innerHTML=`<div><b>${esc(ctx.decisionId||'Commercial decision')} context</b> · Commercial & PPA <b>${esc(pid)}</b> · ${esc(plant)}<br><span>Exact governed PPA source record locked for this Asset-to-Value navigation.</span></div><button type="button" aria-label="Clear commercial decision context" title="Clear commercial decision context">×</button>`;
 b.querySelector('button').onclick=()=>{window.AIP_COMMERCIAL_DECISION_CONTEXT=null;root.querySelectorAll('.aip-v589-commercial-target').forEach(x=>x.classList.remove('aip-v589-commercial-target'));b.remove()};
 host.insertAdjacentElement('beforebegin',b);
 return !!target;
}
window.AIPOpenCommercialPPARecord=function(ctx){
 ctx=ctx||{};window.AIP_COMMERCIAL_DECISION_CONTEXT={...ctx,active:true};
 const r=rowForRecord(ctx.record,ctx.siteId);
 const plant=String(r?.Plant_ID||ctx.siteId||'');
 const open=()=>{
   try{window.activate?.('commercialppa')}catch(_){document.querySelector('.nav-item[data-view="commercialppa"]')?.click()}
   try{window.renderCommercialPPA?.()}catch(_){}
   const root=document.getElementById('view-commercialppa');if(!root)return false;
   const rank=[...root.querySelectorAll('.cppa-rank-row[data-plant]')].find(x=>String(x.dataset.plant)===plant);
   if(rank&&!rank.classList.contains('selected'))rank.click();
   return decorateCommercial(ctx);
 };
 open();requestAnimationFrame(open);setTimeout(open,80);setTimeout(open,180);setTimeout(open,360);
 return true;
};

function decorateDI(){
 const ctx=window.AIP_DI_V589_CONTEXT;if(!ctx?.active)return;
 const S=window.AIP_DI_V401_STATE,root=document.getElementById('view-decisionintelligence');
 if(!root||!root.classList.contains('active')||String(S?.selected||'')!==String(ctx.decisionId||''))return;
 root.querySelector('.aip-v589-di-context-banner')?.remove();
 root.querySelectorAll('.aip-v589-di-target').forEach(x=>x.classList.remove('aip-v589-di-target'));
 let target=null,label='';
 if(S.stage==='governance'){
   target=[...root.querySelectorAll('.di485-gate')].find(x=>/Approval Authority/i.test(x.textContent||''))||
          [...root.querySelectorAll('.di485-gate')].find(x=>/Review/i.test(x.textContent||''));
   label='Governance & Approval';
 }else if(S.stage==='execution'){
   target=[...root.querySelectorAll('.di445-exec-node')].find(x=>/Approved/i.test(x.dataset.diExecStage||''))||
          [...root.querySelectorAll('.di445-exec-node')].find(x=>/Not Started/i.test(x.dataset.diExecStatus||''));
   label='Execution & Handoff';
 }
 if(!target)return;
 target.classList.add('aip-v589-di-target');target.scrollIntoView?.({block:'center',behavior:'auto'});
 const banner=document.createElement('div');banner.className='aip-v589-di-context-banner';
 banner.innerHTML=`<div><b>${esc(ctx.decisionId)} · ${esc(label)}</b><br><span>Commercial basis ${esc(ctx.ppaRecord)} · no governed downstream work order exists yet; the current approval/execution state is highlighted.</span></div><button type="button" aria-label="Clear decision context" title="Clear decision context">×</button>`;
 banner.querySelector('button').onclick=()=>{window.AIP_DI_V589_CONTEXT=null;target.classList.remove('aip-v589-di-target');banner.remove()};
 const stage=root.querySelector('.di401-stage');if(stage)stage.prepend(banner);
}
const oldRender=window.renderDecisionIntelligenceV401;
if(typeof oldRender==='function'&&!oldRender.__v589CommercialContext){
 const wrapped=function(){const out=oldRender.apply(this,arguments);requestAnimationFrame(decorateDI);return out};
 wrapped.__v589CommercialContext=true;window.renderDecisionIntelligenceV401=wrapped;window.renderDecisionIntelligence=wrapped;
 try{if(typeof renderFns!=='undefined')renderFns.decisionintelligence=wrapped}catch(_){}
}
const root=document.getElementById('view-decisionintelligence');
if(root)new MutationObserver(()=>requestAnimationFrame(decorateDI)).observe(root,{childList:true,subtree:true});
window.AIP_V589_COMMERCIAL_CONTEXT_AUDIT={
 release:'v589',baseline:'v588',
 decisions:{'DEC-012':'PPA-02','DEC-013':'PPA-04'},
 evidenceNavigation:'Source Evidence and Commercial / PPA Basis open Commercial & PPA and lock the exact PPA record with pink highlight and × clear.',
 governanceNavigation:'Governance & Readiness opens selected decision Governance & Approval and highlights the Approval Authority gate.',
 executionNavigation:'Execution / Handoff opens selected decision Execution & Handoff and highlights Approved / Not Started; no work order is fabricated.',
 excelBusinessDataChanged:false
};
window.AIP_CURRENT_BUILD='v589';
})();
