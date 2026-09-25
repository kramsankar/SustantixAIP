
(function(){
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
  function currentWeights(){
    var fallback={pr:25,av:20,failures:20,cost:15,inventory:10,productivity:10};
    try{
      var w=window.BENCHMARK_EDITING ? window.BENCHMARK_DRAFT_WEIGHTS : window.BENCHMARK_APPLIED_WEIGHTS;
      if(w && typeof w==='object') return Object.assign({},fallback,w);
    }catch(e){}
    return fallback;
  }
  function currentMode(eventDetail){
    var m='';
    try{
      if(eventDetail&&eventDetail.mode!=null)m=eventDetail.mode;
      else if(typeof APM_DATA_MODE!=='undefined')m=APM_DATA_MODE;
      else m=window.APM_DATA_MODE||window.DATA_SOURCE_MODE||window.dataMode||window.currentDataSource||'';
    }catch(e){m=window.APM_DATA_MODE||window.DATA_SOURCE_MODE||window.dataMode||window.currentDataSource||'';}
    m=String(m).toLowerCase();
    return (m.indexOf('excel')>=0||m.indexOf('upload')>=0)?'Excel data':'Synthetic data';
  }
  function currentScenarioWeights(){
    var fallback={technical:45,economic:25,execution:15,evidence:15};
    try{
      var raw=localStorage.getItem('aipScenarioRankingActive')||localStorage.getItem('aipScenarioRankingDraft');
      if(raw){
        var parsed=JSON.parse(raw);
        if(parsed&&parsed.weights) return Object.assign({},fallback,parsed.weights);
      }
    }catch(e){}
    return fallback;
  }
  function currentSiteCount(){
    try{
      if(Array.isArray(window.__BENCHMARK_BASE)&&window.__BENCHMARK_BASE.length) return window.__BENCHMARK_BASE.length;
      if(Array.isArray(window.PLANTS)&&window.PLANTS.length) return window.PLANTS.length;
      if(typeof PLANTS!=='undefined'&&Array.isArray(PLANTS)&&PLANTS.length) return PLANTS.length;
    }catch(e){}
    return 0;
  }
  function currentNormalizationLabel(){
    try{
      var n=String(window.BENCHMARK_NORMALIZATION||'percentile').toLowerCase();
      return n==='minmax'?'Portfolio Min–Max Scaling':'Portfolio Percentile Ranking';
    }catch(e){return 'Portfolio Percentile Ranking';}
  }
  function currentModeKey(){return currentMode().indexOf('Excel')===0?'excel':'synthetic';}
  function addMonthsIso(iso,months){
    var d=new Date(String(iso||'')+'T00:00:00');
    if(isNaN(d.getTime())) d=new Date();
    d.setMonth(d.getMonth()+months);
    return d.toISOString().slice(0,10);
  }
  function formatGovernanceDate(iso){
    if(!iso)return 'Not recorded';
    var d=new Date(String(iso)+'T00:00:00');
    if(isNaN(d.getTime()))return esc(iso);
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  }
  function governanceDefaults(key){
    return key==='excel'?{
      configurationId:'CFG-XLS-2026-07-001',status:'Approved',approvedBy:'Enterprise Asset Council (Demo)',
      effectiveFrom:'2026-07-15',lastReviewed:'2026-07-15',nextReviewDue:'2026-10-15',reviewFrequency:'Quarterly'
    }:{
      configurationId:'CFG-SYN-2026-07-001',status:'Approved',approvedBy:'Enterprise Asset Council (Demo)',
      effectiveFrom:'2026-07-15',lastReviewed:'2026-07-15',nextReviewDue:'2026-10-15',reviewFrequency:'Quarterly'
    };
  }
  function currentGovernance(){
    var key=currentModeKey(), base=governanceDefaults(key);
    try{
      var raw=localStorage.getItem('aipBenchmarkGovernance:'+key);
      if(raw)return Object.assign(base,JSON.parse(raw)||{});
    }catch(e){}
    return base;
  }
  function saveGovernance(g){
    try{localStorage.setItem('aipBenchmarkGovernance:'+currentModeKey(),JSON.stringify(g));}catch(e){}
  }
  function updateGovernanceOnActivation(){
    var g=currentGovernance(), today=new Date().toISOString().slice(0,10), stamp=Date.now().toString().slice(-6);
    g.configurationId='CFG-'+(currentModeKey()==='excel'?'XLS':'SYN')+'-'+today.replace(/-/g,'')+'-'+stamp;
    g.status='Approved'; g.effectiveFrom=today; g.lastReviewed=today; g.nextReviewDue=addMonthsIso(today,3);
    saveGovernance(g);
    var el=document.getElementById('benchmarkScoringModalV3');if(el&&el.classList.contains('is-open'))render();
  }
  function ensure(){
    var old=document.getElementById('benchmarkScoringModalV3');
    if(old) return old;
    var el=document.createElement('div');
    el.id='benchmarkScoringModalV3';
    el.setAttribute('aria-hidden','true');
    el.innerHTML='<div class="bsm3-backdrop" data-bsm3-close></div><section class="bsm3-panel" role="dialog" aria-modal="true" aria-labelledby="bsm3Title"><header class="bsm3-head"><div><h2 id="bsm3Title">Enterprise Benchmark Intelligence</h2></div><button class="bsm3-x" type="button" data-bsm3-close aria-label="Close workspace">&times;</button></header><main class="bsm3-body" id="bsm3Body"></main><footer class="bsm3-foot"></footer></section>';
    document.body.appendChild(el);
    el.addEventListener('click',function(e){if(e.target.closest('[data-bsm3-close]')) close();});
    return el;
  }
  function render(){
    var w=currentWeights();
    var labels={pr:'Performance Ratio',av:'Availability',failures:'Inverse Failure Rate',cost:'Inverse Maintenance Cost',inventory:'Inventory Efficiency',productivity:'Work-order Productivity'};
    var total=Object.keys(labels).reduce(function(a,k){return a+(Number(w[k])||0);},0);
    var rows=Object.keys(labels).map(function(k){return '<div class="bsm3-row"><span>'+esc(labels[k])+'</span><span class="bsm3-weight">'+(Number(w[k])||0).toFixed(0)+'%</span><span class="bsm3-pill">'+(k==='failures'||k==='cost'?'Inverse':'Direct')+'</span></div>';}).join('');
    var mode=currentMode();
    var sw=currentScenarioWeights();
    var scenarioRows='<div class="bsm3-row"><span>Technical Outcome</span><span class="bsm3-weight">'+(Number(sw.technical)||0).toFixed(0)+'%</span></div><div class="bsm3-row"><span>Economic Outcome</span><span class="bsm3-weight">'+(Number(sw.economic)||0).toFixed(0)+'%</span></div><div class="bsm3-row"><span>Execution Readiness</span><span class="bsm3-weight">'+(Number(sw.execution)||0).toFixed(0)+'%</span></div><div class="bsm3-row"><span>Evidence Confidence</span><span class="bsm3-weight">'+(Number(sw.evidence)||0).toFixed(0)+'%</span></div>';
    var body=document.getElementById('bsm3Body');
    if(!body)return;
    var gov=currentGovernance();
    body.innerHTML='<div class="bsm3-grid">'
      +'<section class="bsm3-card"><h3>Benchmark Weights</h3>'+rows+'</section>'
      +'<section class="bsm3-card"><h3>Scenario Ranking Weights</h3>'+scenarioRows+'</section>'
      +'<section class="bsm3-card bsm3-methodology"><h3>Scoring Framework</h3>'
        +'<div class="bsm3-framework-block"><h4>Score Calculation</h4>'
          +'<div class="bsm3-score-equation"><b>Composite Score =</b> PR norm × '+(Number(w.pr)||0).toFixed(0)+'% + Availability norm × '+(Number(w.av)||0).toFixed(0)+'% + Reliability norm × '+(Number(w.failures)||0).toFixed(0)+'% + O&amp;M Cost norm × '+(Number(w.cost)||0).toFixed(0)+'% + Inventory norm × '+(Number(w.inventory)||0).toFixed(0)+'% + Productivity norm × '+(Number(w.productivity)||0).toFixed(0)+'%.</div>'
          +'<div class="bsm3-score-note">Failure Rate and O&amp;M Cost are lower-is-better and therefore inverse-scored after normalization. The Site Benchmark Register recalculates this score at runtime from the active portfolio and approved weights; stored Composite_Score and Rank fields are not used to determine the displayed ranking.</div>'
          +'<div class="bsm3-score-bands aip681-benchmark-bands"><b>Benchmark Classification:</b> <span class="aip681-band leading">Leading ≥85</span><span class="aip681-sep">·</span><span class="aip681-band competitive">Competitive 70–&lt;85</span><span class="aip681-sep">·</span><span class="aip681-band watch">Watch 55–&lt;70</span><span class="aip681-sep">·</span><span class="aip681-band intervention">Intervention &lt;55</span></div>'
          +'<div class="bsm3-method-grid">'
          +'<div class="bsm3-method-item"><span>Scoring method</span><b>Weighted Composite Index</b></div>'
          +'<div class="bsm3-method-item"><span>KPIs evaluated</span><b>'+Object.keys(labels).length+' active KPIs</b></div>'
          +'<div class="bsm3-method-item"><span>Normalization method</span><b>'+esc(currentNormalizationLabel())+'</b></div>'
          +'<div class="bsm3-method-item"><span>Weight source</span><b>Approved weights</b></div>'
          +'<div class="bsm3-method-item"><span>Sites included</span><b>'+(currentSiteCount()||'Active portfolio')+(currentSiteCount()?' sites':'')+'</b></div>'
          +'<div class="bsm3-method-item"><span>Score range</span><b>0–100</b></div>'
          +'<div class="bsm3-method-item"><span>Decision direction</span><b>Higher score preferred</b></div>'
          +'<div class="bsm3-method-item"><span>Total weight</span><b>'+total.toFixed(0)+'%</b></div>'
        +'</div></div>'
        +'<div class="bsm3-framework-block"><h4>Governance</h4><div class="bsm3-method-grid bsm3-governance-grid">'
          +'<div class="bsm3-method-item"><span>Status</span><b>'+esc(gov.status)+'</b></div>'
          +'<div class="bsm3-method-item"><span>Approved by</span><b>'+esc(gov.approvedBy)+'</b></div>'
          +'<div class="bsm3-method-item"><span>Effective from</span><b>'+formatGovernanceDate(gov.effectiveFrom)+'</b></div>'
          +'<div class="bsm3-method-item"><span>Last reviewed</span><b>'+formatGovernanceDate(gov.lastReviewed)+'</b></div>'
          +'<div class="bsm3-method-item"><span>Next review due</span><b>'+formatGovernanceDate(gov.nextReviewDue)+'</b></div>'
          +'<div class="bsm3-method-item"><span>Review frequency</span><b>'+esc(gov.reviewFrequency)+'</b></div>'
        +'</div></div>'
      +'</section>'
      +'<section class="bsm3-card wide aip-psc-live"><h3>Performance Status Configuration</h3>'
        +'<div class="aip-psc-live-copy">Configure the Generation Variance vs Budget thresholds used to derive Portfolio Performance status.</div>'
        +'<div class="aip-psc-live-fields">'
          +'<label><span>Watch Threshold (%)</span><input id="aipPerformanceWatchThreshold" type="number" step="0.1" value="'+window.AIPPerformanceStatusConfig.current().watch+'"></label>'
          +'<label><span>Critical Threshold (%)</span><input id="aipPerformanceCriticalThreshold" type="number" step="0.1" value="'+window.AIPPerformanceStatusConfig.current().critical+'"></label>'
        +'</div>'
        +'<div class="aip-psc-live-range aip-psc-default-range"><b>Default range</b><span>'+esc(window.AIPPerformanceStatusConfig.rangesText(window.AIPPerformanceStatusConfig.defaults))+'</span></div>'
        +'<div class="aip-psc-live-range aip-psc-active-range"><b>Current active range</b><span id="aipPerformanceActiveRangeText">'+esc(window.AIPPerformanceStatusConfig.activeRangeLabel())+'</span></div>'
        +'<div class="aip-psc-live-lastsave" id="aipPerformanceStatusLastSaved">'+(function(){try{var x=JSON.parse(localStorage.getItem(window.AIPPerformanceStatusConfig.key)||'null');return x&&x.savedAt?'Last saved: '+new Date(x.savedAt).toLocaleString():'';}catch(_){return '';}})()+'</div>'
        +'<div class="aip-psc-live-actions"><button type="button" onclick="window.AIPPerformanceStatusConfig.reset()">Reset to Default</button><button id="aipPerformanceStatusSaveBtn" class="primary" type="button" onclick="window.AIPPerformanceStatusConfig.save(this)">Save Configuration</button></div>'
        +'<div id="aipPerformanceStatusSaved" class="aip-psc-live-saved"></div>'
      +'</section>'
      +'<section class="bsm3-card wide"><h3>Model Controls</h3><div class="bsm3-kpis">'
        +'<div class="bsm3-kpi"><b>'+total.toFixed(0)+'%</b><span>Total approved weight</span></div>'
        +'<div class="bsm3-kpi"><b>±5 pts</b><span>Weight sensitivity stress</span></div>'
        +'<div class="bsm3-kpi"><b>'+esc(mode)+'</b><span>Current data source</span></div>'
      +'</div></section>'
    +'</div>' 
  }
  function open(){
    var el=ensure();render();el.classList.add('is-open');el.setAttribute('aria-hidden','false');document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
    setTimeout(function(){var b=el.querySelector('.bsm3-x');if(b)b.focus();},0);
  }
  function close(){
    var el=document.getElementById('benchmarkScoringModalV3');if(!el)return;el.classList.remove('is-open');el.setAttribute('aria-hidden','true');document.documentElement.style.overflow='';document.body.style.overflow='';
  }
  window.AIPRenderBenchmarkScoringModal=render;
  window.benchmarkOpenScoringModel=open;
  window.benchmarkOpenIntelligence=open;
  window.benchmarkCloseIntelligence=close;
  window.benchmarkCloseScoringModel=close;
  try{benchmarkOpenScoringModel=open;}catch(e){}
  try{benchmarkOpenIntelligence=open;}catch(e){}
  try{benchmarkCloseIntelligence=close;}catch(e){}
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  document.addEventListener('DOMContentLoaded',ensure,{once:true});
  ['aip:data-source-changed','apm:datasource-refreshed'].forEach(function(evt){
    document.addEventListener(evt,function(){
      var el=document.getElementById('benchmarkScoringModalV3');
      if(el&&el.classList.contains('is-open'))setTimeout(render,0);
    });
  });
  window.addEventListener('aip:scenario-ranking-changed',updateGovernanceOnActivation);
  window.addEventListener('aip:benchmark-governance-reviewed',function(e){var g=currentGovernance(),d=(e&&e.detail&&e.detail.date)||new Date().toISOString().slice(0,10);g.lastReviewed=d;g.nextReviewDue=addMonthsIso(d,3);if(e&&e.detail&&e.detail.approvedBy)g.approvedBy=e.detail.approvedBy;saveGovernance(g);var el=document.getElementById('benchmarkScoringModalV3');if(el&&el.classList.contains('is-open'))render();});
  if(document.readyState!=='loading')ensure();
})();
