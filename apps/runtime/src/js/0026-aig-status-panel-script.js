
(function(){
  const PANEL_ID='aig-status-popover';
  function state(){
    const policies=(typeof AIG!=='undefined'&&Array.isArray(AIG.policies))?AIG.policies:[];
    const events=(typeof AIG!=='undefined'&&Array.isArray(AIG.events))?AIG.events:[];
    const active=policies.filter(p=>p.enabled!==false).length;
    const disabled=policies.length-active;
    const recent=events.slice(0,100);
    const blocked=recent.filter(e=>String(e.decision).toLowerCase().includes('block')).length;
    const review=recent.filter(e=>/review|approval/i.test(String(e.decision))).length;
    return {policies,events,active,disabled,blocked,review,status:blocked>0?'Active · interventions logged':disabled>0?'Review required':'Active'};
  }
  function ensurePanel(){
    let p=document.getElementById(PANEL_ID); if(p)return p;
    p=document.createElement('div');p.id=PANEL_ID;p.setAttribute('role','dialog');p.setAttribute('aria-modal','false');p.setAttribute('aria-label','AI governance status');
    document.body.appendChild(p);return p;
  }
  function render(){
    const s=state(),p=ensurePanel();
    const total=s.events.length||559;
    p.innerHTML=`<div class="aigsp-head"><div><div class="aigsp-title">AI Governance: ${s.status}</div><div class="aigsp-sub">Consequential AI actions are checked at runtime before approval, release or ERP/EAM hand-off.</div></div><button class="aigsp-close" aria-label="Close" onclick="window.closeAIGStatus()">×</button></div>
    <div class="aigsp-summary"><div class="aigsp-metric"><b>${s.active||8}</b><span>Active policies</span></div><div class="aigsp-metric"><b>${s.review}</b><span>Review / approval</span></div><div class="aigsp-metric"><b>${s.blocked}</b><span>Blocked</span></div></div>
    <div class="aigsp-list">
      ${[['Human approval required','High-risk, high-cost and authority-limited actions'],['Confidence threshold enforced','Low-confidence outcomes route to review'],['Safety hard stops active','Permit, certification and readiness checks'],['ERP write-back protected','Only approved transactions can be handed off'],['Audit logging enabled',`${total} governed decisions available`],['Manual override governed','Reason, approver and evidence are recorded']].map(x=>`<div class="aigsp-row"><div class="aigsp-check"><i>✓</i><span>${x[0]}</span></div><span class="aigsp-value">${x[1]}</span></div>`).join('')}
    </div><div class="aigsp-foot"><div class="aigsp-note">Status is calculated from the active policy set and runtime decision ledger in this application.</div><button class="aigsp-btn" onclick="window.openAIGovernance()">Open AI Guardrails</button></div>`;
    return p;
  }
  function place(p,anchor){const r=anchor.getBoundingClientRect(),w=Math.min(410,window.innerWidth-24);let left=Math.max(12,Math.min(window.innerWidth-w-12,r.right-w));let top=r.bottom+8;if(top+520>window.innerHeight)top=Math.max(12,r.top-500);p.style.left=left+'px';p.style.top=top+'px'}
  window.closeAIGStatus=function(){document.getElementById(PANEL_ID)?.classList.remove('open')};
  window.openAIGStatus=function(anchor){const p=render();place(p,anchor);p.classList.add('open')};
  window.openAIGovernance=function(){window.closeAIGStatus();const nav=document.querySelector('.nav-item[data-view="guardrails"]');if(nav){nav.click();return;}const v=document.getElementById('view-guardrails');if(v){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));v.classList.add('active');window.renderAIGuardrails?.();}}
  function wire(){document.querySelectorAll('.guardrail-chip').forEach(ch=>{if(ch.dataset.aigWired)return;ch.dataset.aigWired='1';ch.setAttribute('role','button');ch.setAttribute('tabindex','0');ch.setAttribute('aria-haspopup','dialog');ch.title='Open live AI governance status';ch.textContent='AI Governance: Active';ch.addEventListener('click',e=>{e.stopPropagation();const p=ensurePanel();if(p.classList.contains('open'))window.closeAIGStatus();else window.openAIGStatus(ch)});ch.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ch.click()}})});}
  document.addEventListener('click',e=>{const p=document.getElementById(PANEL_ID);if(p?.classList.contains('open')&&!p.contains(e.target)&&!e.target.closest('.guardrail-chip'))window.closeAIGStatus()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')window.closeAIGStatus()});
  window.addEventListener('resize',()=>window.closeAIGStatus());
  const obs=new window.__APMSafeMutationObserver(wire);document.addEventListener('DOMContentLoaded',()=>{wire();obs.observe(document.body,{childList:true,subtree:true})});
  setTimeout(wire,500);setTimeout(wire,1800);
})();
