
(function(){
  const CFG=[
    {id:'DQ-001',name:'Asset master key completeness',domain:'Asset Master'},
    {id:'DQ-002',name:'Work-order key completeness',domain:'Maintenance'},
    {id:'DQ-003',name:'Duplicate work-order IDs',domain:'Maintenance'},
    {id:'DQ-004',name:'Crew master key completeness',domain:'Workforce'},
    {id:'DQ-005',name:'Crew-assignment key completeness',domain:'Workforce'},
    {id:'DQ-006',name:'Telemetry key completeness',domain:'Telemetry'},
    {id:'DQ-007',name:'Telemetry freshness SLA',domain:'Telemetry'},
    {id:'DQ-008',name:'Source / lineage coverage',domain:'Cross-domain'}
  ];
  try{ if(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined') AIP_INDEPENDENT_SYNTHETIC_DATA['Data Quality Checks']=CFG.map(x=>({...x,Governance_Status:'Active'})); }catch(e){}
  try{ if(typeof EMBEDDED_EXCEL_DATA!=='undefined') EMBEDDED_EXCEL_DATA['Data Quality Checks']=CFG.map(x=>({...x,Governance_Status:'Active'})); }catch(e){}

  function rows(name){
    try{
      if(name==='assets') return Array.isArray(ASSET_REGISTRY)?ASSET_REGISTRY:[];
      if(name==='wos') return Array.isArray(ALL_WOS)?ALL_WOS:[];
      if(name==='crew') return Array.isArray(CREW_ROSTER)?CREW_ROSTER:[];
      if(name==='asg') return Array.isArray(CREW_ASSIGNMENTS)?CREW_ASSIGNMENTS:[];
      if(name==='tel') return Array.isArray(TELEMETRY_LOG)?TELEMETRY_LOG:[];
    }catch(e){}
    return [];
  }
  function pick(o,keys){for(const k of keys){if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k]}return null}
  function complete(arr, fields){
    if(!arr.length) return {total:0,exceptions:0,score:null};
    let bad=0; arr.forEach(r=>{if(fields.some(fs=>pick(r,fs)==null)) bad++});
    return {total:arr.length,exceptions:bad,score:100*(arr.length-bad)/arr.length};
  }
  function duplicate(arr,keys){
    if(!arr.length)return {total:0,exceptions:0,score:null};
    const seen=new Set();let bad=0;arr.forEach(r=>{const v=pick(r,keys);if(v==null){bad++;return}const k=String(v);if(seen.has(k))bad++;else seen.add(k)});
    return {total:arr.length,exceptions:bad,score:100*(arr.length-bad)/arr.length};
  }
  function parseDate(v){if(v==null)return NaN;const d=new Date(String(v).replace(' ','T'));return d.getTime()}
  function freshness(arr){
    if(!arr.length)return {total:0,exceptions:0,score:null};
    const valid=arr.map(r=>({t:parseDate(pick(r,[['ts'],['Timestamp'],['timestamp'],['Date_Time'],['DateTime']])),p:pick(r,[['plant'],['Plant_ID'],['site'],['Site_ID']])})).filter(x=>Number.isFinite(x.t)&&x.p!=null);
    if(!valid.length)return {total:0,exceptions:0,score:null};
    const latest=Math.max(...valid.map(x=>x.t)), by=new Map(); valid.forEach(x=>by.set(String(x.p),Math.max(by.get(String(x.p))||0,x.t)));
    const limit=24*3600*1000; let fresh=0; by.forEach(t=>{if(latest-t<=limit)fresh++});
    return {total:by.size,exceptions:by.size-fresh,score:by.size?100*fresh/by.size:null};
  }
  function lineage(populations){
    const srcKeys=['Source','source','Source_System','sourceSystem','Data_Source','dataSource','Source_Authority','sourceAuthority','Lineage','lineage','Source_Module','sourceModule'];
    let eligible=0,covered=0;
    populations.forEach(arr=>arr.forEach(r=>{const hasField=srcKeys.some(k=>Object.prototype.hasOwnProperty.call(r||{},k));if(hasField){eligible++;if(srcKeys.some(k=>r&&r[k]!=null&&String(r[k]).trim()!==''))covered++}}));
    return {total:eligible,exceptions:eligible-covered,score:eligible?100*covered/eligible:null};
  }
  function calc(){
    const A=rows('assets'),W=rows('wos'),C=rows('crew'),G=rows('asg'),T=rows('tel');
    const rules=[
      {...CFG[0],...complete(A,[[ 'id','Asset_ID' ],['plant','Plant_ID'],['tag','Asset_Tag']])},
      {...CFG[1],...complete(W,[[ 'id','Work_Order_ID' ],['plant','Plant_ID'],['asset','Asset_ID','Asset_Tag']])},
      {...CFG[2],...duplicate(W,['id','Work_Order_ID'])},
      {...CFG[3],...complete(C,[[ 'id','Technician_ID','Crew_ID' ],['name','Technician_Name','Name'],['crew','Crew','Crew_ID']])},
      {...CFG[4],...complete(G,[[ 'id','Assignment_ID' ],['wo','Work_Order_ID'],['tech','Technician_ID']])},
      {...CFG[5],...complete(T,[[ 'ts','Timestamp','timestamp' ],['plant','Plant_ID'],['asset','Asset_ID']])},
      {...CFG[6],...freshness(T)},
      {...CFG[7],...lineage([A,W,C,G,T])}
    ];
    const qualityRules=rules.slice(0,6).filter(r=>r.total>0&&r.score!=null);
    const total=qualityRules.reduce((s,r)=>s+r.total,0), bad=qualityRules.reduce((s,r)=>s+r.exceptions,0);
    return {rules,quality:total?100*(total-bad)/total:null,exceptions:bad,freshness:rules[6].score,lineage:rules[7].score};
  }
  function fmt(v){return v==null||!Number.isFinite(v)?'N/A':v.toFixed(1)+'%'}
  function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}
  function card(label,value,note,color){return `<div class="aip306-dq-kpi" style="--dqbar:${color}"><span class="lbl">${label}</span><b class="val">${value}</b><span class="note">${note}</span><div class="aip306-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div>`}
  let lastRun='';
  window.renderDQ=function(){
    const v=document.getElementById('view-dataquality'); if(!v)return; const r=calc();
    v.innerHTML=`<div class="xi-head"><div><div class="xi-eyebrow">TECHNOLOGY FOUNDATION · TRUSTED DATA OPERATIONS</div><h1>Data Quality & Observability</h1></div><div class="xi-tools"><button class="xi-btn primary" id="dqRun">Run quality checks</button></div></div>`+
      `<div class="xi-kpis">${card('Quality score',fmt(r.quality),'Across active governed checks','#3979A8')}${card('Open exceptions',String(r.exceptions),'Current failed records','#8B6BAF')}${card('Freshness SLA',fmt(r.freshness),'Sites within 24h of latest telemetry','#3F8A6C')}${card('Lineage coverage',fmt(r.lineage),'Records with source / provenance evidence','#C27A3A')}</div>`+
      `${lastRun?`<div class="aip306-runmeta">Last checked: ${lastRun}</div>`:''}`+
      `<div class="xi-card"><h3>Governed data-quality checks</h3><table class="xi-table"><thead><tr><th>Rule</th><th>Domain</th><th>Score</th><th>Status</th><th>Exceptions</th></tr></thead><tbody>${r.rules.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.domain)}</td><td>${fmt(x.score)}</td><td><span class="xi-pill">${x.score==null?'N/A':x.exceptions===0?'PASS':'ATTENTION'}</span></td><td>${x.total?x.exceptions:'N/A'}</td></tr>`).join('')}</tbody></table></div>`;
    const b=document.getElementById('dqRun'); if(b)b.onclick=()=>{lastRun=new Date().toLocaleString();window.renderDQ();toast('Quality checks recalculated from the active data source')};
  };
  window.AIP_V306_AUDIT={release:'v306',baseline:'v305',scope:'Technology Foundations · Data Quality & Observability only',excelChanged:true,syntheticChanged:true,startupChanged:false,staticKpisRemoved:true,runQualityChecksReal:true};
})();
