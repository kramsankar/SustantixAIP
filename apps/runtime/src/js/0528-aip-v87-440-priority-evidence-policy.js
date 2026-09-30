
(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function payload(){
    return String(window.APM_DATA_MODE||'').toLowerCase().includes('synthetic')
      ? window.AIP_DI_SYNTHETIC : window.AIP_DI_EXCEL;
  }
  function decision(id){
    return (payload()?.decisions||[]).find(d=>d.id===id);
  }

  function ensure(){
    let bd=document.querySelector('.di440-policy-backdrop');
    let panel=document.querySelector('.di440-policy-panel');
    if(!bd){
      bd=document.createElement('div');
      bd.className='di440-policy-backdrop';
      document.body.appendChild(bd);
      panel=document.createElement('section');
      panel.className='di440-policy-panel';
      document.body.appendChild(panel);
      bd.addEventListener('click',close);
    }
    return {bd,panel};
  }

  function close(){
    document.querySelector('.di440-policy-backdrop')?.classList.remove('open');
    document.querySelector('.di440-policy-panel')?.classList.remove('open');
  }

  function openPriority(id){
    const d=decision(id); if(!d)return;
    const p=payload()?.priorityPolicy||{};
    const bands=p.bands||[];
    const weights=p.weights||{};
    const factors=d.priorityFactors||{};
    const {bd,panel}=ensure();

    panel.innerHTML=`
      <div class="di440-head">
        <div>
          <h3>Decision Priority Policy</h3>
          <div class="di401-meta">${esc(d.id)} · ${esc(d.site)} · ${esc(d.asset)}</div>
        </div>
        <button class="di440-close">Close</button>
      </div>

      <div class="di440-current">
        <span>Current priority</span>
        <b>${esc(d.priority)} · ${Number(d.priorityScore||0).toFixed(1)}</b>
      </div>

      <div class="di440-section">
        <h4>Weighted factors</h4>
        ${Object.entries(weights).map(([k,w])=>`
          <div class="di440-rule-row">
            <span>${esc(k)}</span>
            <b>${Number(w).toFixed(0)}%</b>
            <small>Current factor ${Number(factors[k]||0).toFixed(1)}</small>
          </div>`).join('')}
      </div>

      <div class="di440-section">
        <h4>Priority bands</h4>
        <div class="di440-bands">
          ${bands.map(b=>`<span class="band-${String(b.priority).toLowerCase()}"><b>${esc(b.priority)}</b><small>${Number(b.min).toFixed(0)}–${Number(b.max).toFixed(0)}</small></span>`).join('')}
        </div>
      </div>

      <div class="di440-section">
        <h4>Override rules</h4>
        ${(p.overrides||[]).map(x=>`<div class="di440-rule-note">${esc(x)}</div>`).join('')}
      </div>
    `;
    panel.querySelector('.di440-close')?.addEventListener('click',close);
    bd.classList.add('open'); panel.classList.add('open');
  }

  function evidencePolicyFor(d){
    const ev=d.evidence||[];
    const qualities=ev.map(x=>Number(x.quality||0)).filter(Number.isFinite);
    const avg=qualities.length?qualities.reduce((a,b)=>a+b,0)/qualities.length:0;
    const independentSources=new Set(ev.map(x=>String(x.source||'').trim()).filter(Boolean)).size;
    const directAsset=ev.some(x=>/asset|operational|performance|warranty|commercial|inventory|esg|model/i.test(String(x.type||'')));
    const modelConfidence=ev
      .map(x=>String(x.detail||'').match(/confidence\s+(\d+(?:\.\d+)?)%/i))
      .filter(Boolean).map(m=>Number(m[1]));
    const maxModelConf=modelConfidence.length?Math.max(...modelConfidence):null;

    return {
      avg,
      independentSources,
      directAsset,
      maxModelConf,
      rules:[
        {name:'Strong',desc:'High-quality evidence, good completeness, and corroboration from multiple relevant sources.'},
        {name:'Moderate',desc:'Usable evidence with some gaps in completeness, corroboration, freshness, or confidence.'},
        {name:'Limited',desc:'Evidence is incomplete, weakly corroborated, or insufficient for a high-confidence decision.'}
      ]
    };
  }

  function openEvidence(id){
    const d=decision(id); if(!d)return;
    const pol=evidencePolicyFor(d);
    const {bd,panel}=ensure();

    panel.innerHTML=`
      <div class="di440-head">
        <div>
          <h3>Evidence Strength Policy</h3>
          <div class="di401-meta">${esc(d.id)} · ${esc(d.site)} · ${esc(d.asset)}</div>
        </div>
        <button class="di440-close">Close</button>
      </div>

      <div class="di440-current">
        <span>Current evidence strength</span>
        <b>${esc(d.evidenceStrength)}</b>
      </div>

      <div class="di440-section">
        <h4>Classification criteria</h4>
        <div class="di440-rule-note"><b>Source quality</b> · reliability of the originating AIP record or model evidence.</div>
        <div class="di440-rule-note"><b>Completeness</b> · whether the evidence package is sufficiently complete for the decision.</div>
        <div class="di440-rule-note"><b>Corroboration</b> · whether multiple relevant sources support the same decision basis.</div>
        <div class="di440-rule-note"><b>Direct relevance</b> · evidence is linked to the specific site, asset, claim, work order, or commercial record.</div>
        <div class="di440-rule-note"><b>Model confidence / freshness</b> · applied where predictive or model-generated evidence is used.</div>
      </div>

      <div class="di440-section">
        <h4>Evidence bands</h4>
        <div class="di440-bands evidence">
          ${pol.rules.map(r=>`<span class="evidence-${r.name.toLowerCase()}"><b>${r.name}</b><small>${esc(r.desc)}</small></span>`).join('')}
        </div>
      </div>

      <div class="di440-section">
        <h4>Selected decision evidence profile</h4>
        <div class="di440-rule-row"><span>Linked evidence records</span><b>${(d.evidence||[]).length}</b></div>
        <div class="di440-rule-row"><span>Independent sources</span><b>${pol.independentSources}</b></div>
        <div class="di440-rule-row"><span>Average evidence quality</span><b>${pol.avg.toFixed(1)}</b></div>
        ${pol.maxModelConf!==null?`<div class="di440-rule-row"><span>Model confidence</span><b>${pol.maxModelConf.toFixed(1)}%</b></div>`:''}
      </div>
    `;
    panel.querySelector('.di440-close')?.addEventListener('click',close);
    bd.classList.add('open'); panel.classList.add('open');
  }

  // Priority policy drill from Decision Overview priority column.
  window.addEventListener('click',function(e){
    const p=e.target?.closest?.('#view-decisionintelligence [data-di-priority]');
    if(!p)return;
    if(!e.target.closest('.di440-policy-drill'))return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    openPriority(p.dataset.diPriority);
  },true);

  // Evidence policy drill.
  window.addEventListener('click',function(e){
    const b=e.target?.closest?.('#view-decisionintelligence [data-di-evidence-policy]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    openEvidence(b.dataset.diEvidencePolicy);
  },true);

  window.AIPDecisionPoliciesV440={openPriority,openEvidence,close};
})();
