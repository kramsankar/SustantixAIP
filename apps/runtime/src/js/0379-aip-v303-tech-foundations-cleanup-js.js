
(function(){
  /* Keep only models that are actually production-capable in the operational registry.
     Legacy catalogue data remains in source code for regression safety. */
  if (typeof MODEL_REGISTRY !== 'undefined' && Array.isArray(MODEL_REGISTRY)) {
    for (let i=MODEL_REGISTRY.length-1;i>=0;i--) {
      if (MODEL_REGISTRY[i].status !== 'Production') MODEL_REGISTRY.splice(i,1);
    }
  }

  /* Data Quality: replace literal demo KPIs/log with values derived from governed check rows.
     If no governed rows exist, say so rather than inventing a score. */
  window.renderDQ = function(){
    const src = (typeof contextGraphActiveRows==='function') ? contextGraphActiveRows('Data Quality Checks') : [];
    const rows = Array.isArray(src) ? src : [];
    const rules = rows.map((r,i)=>{
      const name=String(cgVal(r,['Check','Rule','Name'])||('Rule '+(i+1)));
      const raw=cgNum(cgVal(r,['Result','Score','Quality_Score_Pct']));
      const score=Math.max(0,Math.min(100,Number.isFinite(raw)?raw:0));
      const status=String(cgVal(r,['Status'])||(score>=95?'Healthy':score>=85?'Watch':'Improve'));
      const exRaw=cgNum(cgVal(r,['Exceptions','Exception_Count']));
      const exceptions=Math.max(0,Math.round(Number.isFinite(exRaw)&&exRaw>0?exRaw:Math.max(0,100-score)));
      return [name,score,status,exceptions];
    });
    const v=$('#view-dataquality'); if(!v) return;
    const has=rules.length>0;
    const avg=has ? rules.reduce((a,r)=>a+r[1],0)/rules.length : null;
    const exceptions=has ? rules.reduce((a,r)=>a+r[3],0) : null;
    const healthy=has ? rules.filter(r=>String(r[2]).toLowerCase()==='healthy').length : null;
    v.innerHTML=head('TECHNOLOGY FOUNDATION · TRUSTED DATA OPERATIONS','Data Quality & Observability','')+
      `<div class="xi-kpis">
        ${kpi('Governed quality score',has?avg.toFixed(1)+'%':'N/A',has?'Calculated from active quality checks':'No governed quality-check records')}
        ${kpi('Open exceptions',has?String(exceptions):'N/A',has?'Derived from active checks':'No governed exception population')}
        ${kpi('Healthy checks',has?`${healthy} of ${rules.length}`:'N/A',has?'Current active checks':'No governed quality-check records')}
      </div>
      <div class="xi-card">
        <h3>Governed data-quality checks</h3>
        ${has?`<table class="xi-table"><thead><tr><th>Rule</th><th>Score</th><th>Status</th><th>Exceptions</th></tr></thead><tbody>
          ${rules.map(r=>`<tr><td>${cgEsc(r[0])}</td><td>${r[1].toFixed(1)}%</td><td><span class="xi-pill">${cgEsc(r[2])}</span></td><td>${r[3]}</td></tr>`).join('')}
        </tbody></table>`:
        `<div class="sub" style="padding:12px 0">No governed Data Quality Checks records are available in the active data source. No synthetic observability events or quality scores are displayed.</div>`}
      </div>`;
  };

  /* Twin: retain engineering/model evidence, remove browser-local thresholds and generic controls. */
  if (typeof renderTwin === 'function') {
    const priorTwin=renderTwin;
    window.renderTwin=function(){
      priorTwin();
      const v=document.getElementById('view-twinmodel');
      if(!v) return;
      const aside=[...v.querySelectorAll('aside.xi-card')].find(x=>x.textContent.includes('Governed configuration'));
      if(aside){
        aside.innerHTML='<h3>Model governance</h3><div class="tw-govern"><b>Model auditability</b><span>Version and input provenance retained</span></div>';
      }
    };
  }

  /* Enterprise Integration: ensure external-twin configuration stays out even after rerender. */
  if (typeof renderIntegrations === 'function') {
    const priorInt=renderIntegrations;
    window.renderIntegrations=function(){
      priorInt();
      const v=document.getElementById('view-integrations');
      if(!v) return;
      const xt=v.querySelector('#externalTwinConnector'); if(xt) xt.remove();
      v.querySelectorAll('.payload-toggle,.payload-box,.int-meta,.tw293-flow').forEach(x=>x.remove());
    };
  }
})();
