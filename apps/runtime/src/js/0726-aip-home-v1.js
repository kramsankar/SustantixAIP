
(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}

  // ---- value / unit-of-measure split: the number stays bold + colored, the
  // unit (%, MW, MWh, Cr, L, tCO2e, "claims", ...) renders in light gray so
  // the number reads as the headline and the unit reads as a caption, never
  // both in the same bright color.
  function splitValUnit(raw){
    var s=String(raw==null?'':raw).trim();
    if(!s||s==='—') return {v:s,u:''};
    var m=s.match(/^(₹?-?[\d,]+(?:\.\d+)?)\s*(.*)$/);
    if(!m||!m[1]) return {v:s,u:''};
    return {v:m[1],u:m[2].trim()};
  }
  function numUnitHTML(numStr,unit,color){
    if(numStr==null||numStr==='') return '—';
    var v='<span'+(color?' style="color:'+color+'"':'')+'>'+esc(numStr)+'</span>';
    var u=unit?' <span class="unit-tag">'+esc(unit)+'</span>':'';
    return v+u;
  }
  // Small five-bar accent icon reused on every KPI card (mirrors the
  // .aip-kpi-master-bars glyph used throughout the rest of the platform's
  // own KPI cards), tinted to match that KPI's own accent color.
  function kpiBars(color){
    return '<span class="home-kpi-bars" aria-hidden="true" style="--bar-c:'+esc(color||'#5B7083')+'"><i></i><i></i><i></i><i></i><i></i></span>';
  }
  function vuHTML(raw,color){
    var p=splitValUnit(raw);
    if(!p.v) return '—';
    return numUnitHTML(p.v,p.u,color);
  }
  function nameValUnit(name,numStr,unit,color){
    return '<span class="fv-name">'+esc(name)+'</span> '+numUnitHTML(numStr,unit,color);
  }

  var STATE_CENTROID={
    'Rajasthan':[27.0,74.2],'Gujarat':[22.3,71.8],'Karnataka':[15.3,75.7],
    'Tamil Nadu':[11.1,78.7],'Telangana':[18.1,79.0],'Maharashtra':[19.7,75.7],
    'Andhra Pradesh':[15.9,79.7],'Madhya Pradesh':[23.5,78.6],'Punjab':[31.1,75.3],
    'Haryana':[29.0,76.0],'Odisha':[20.9,85.1],'Uttar Pradesh':[26.8,80.9]
  };
  /* India outline traced directly from the reference map graphic the user
     supplied — OpenCV contour extraction on that image's own India silhouette,
     approximated to a 252-point polygon (high-fidelity pass; an earlier build
     used a coarser 72-point simplification that read as too blocky). The
     source file itself is a watermarked stock graphic, so the literal image
     is not embedded in this product — only its outline geometry (the shape)
     is reused, redrawn as a plain two-tone vector matching the app's palette.
     Site markers use a linear lat/lon fit onto that same image's pixel
     bounding box (India's real geographic extent mapped onto the source
     graphic's canvas), carried through the same crop/scale used to fit the
     outline into this viewBox — so a marker's position is only as precise as
     (a) the reference graphic's own projection and (b) each state's centroid
     being a single representative point, not the whole state. Already
     labeled "state-level, approximate" in the UI. */
  var LAT_MIN=6.5,LAT_MAX=37.5,LON_MIN=68.0,LON_MAX=97.5;
  var SRC_X0=0,SRC_Y0=0,SRC_W=386,SRC_H=430;
  var VB_W=430,VB_H=478,MAP_PAD=10;
  var MAP_SCALE=Math.min((VB_W-2*MAP_PAD)/SRC_W,(VB_H-2*MAP_PAD)/SRC_H);
  var INDIA_OUTLINE_D='M113.0,10.0 L109.8,12.1 L103.5,12.1 L101.3,14.2 L92.8,15.3 L86.5,21.7 L85.4,25.9 L90.7,27.0 L102.4,38.7 L102.4,44.0 L95.0,51.4 L97.1,56.7 L96.0,65.2 L97.1,71.6 L107.7,78.0 L110.9,82.2 L116.2,83.3 L117.3,88.6 L106.7,93.9 L106.7,104.5 L99.2,112.0 L97.1,118.3 L93.9,121.5 L89.7,122.6 L85.4,132.2 L75.9,139.6 L65.2,152.3 L58.9,154.5 L50.4,154.5 L46.1,149.1 L33.4,161.9 L32.3,165.1 L33.4,169.3 L38.7,170.4 L40.8,172.5 L39.7,179.9 L40.8,183.1 L46.1,186.3 L50.4,194.8 L51.4,206.5 L45.1,207.6 L42.9,205.4 L36.6,208.6 L31.2,208.6 L18.5,205.4 L15.3,210.8 L10.0,211.8 L10.0,215.0 L13.2,216.1 L13.2,220.3 L18.5,226.7 L31.2,230.9 L30.2,236.2 L20.6,235.2 L18.5,236.2 L21.7,242.6 L38.7,261.7 L49.3,262.8 L56.7,258.5 L59.9,258.5 L65.2,252.2 L70.5,253.2 L70.5,258.5 L74.8,262.8 L74.8,267.0 L72.7,269.2 L70.5,276.6 L70.5,283.0 L72.7,290.4 L71.6,305.3 L74.8,315.9 L76.9,336.1 L84.4,356.3 L89.7,361.6 L92.8,371.1 L92.8,380.7 L97.1,392.4 L97.1,396.6 L102.4,406.2 L106.7,410.4 L114.1,430.6 L115.2,442.3 L119.4,454.0 L130.0,466.7 L135.3,466.7 L141.7,464.6 L143.8,461.4 L143.8,457.2 L148.1,452.9 L156.6,449.7 L159.8,440.2 L163.0,438.1 L164.0,432.7 L171.5,431.7 L172.5,415.8 L170.4,407.3 L174.6,404.1 L179.9,389.2 L177.8,375.4 L177.8,353.1 L182.1,346.7 L190.6,347.8 L194.8,343.5 L196.9,338.2 L210.8,335.0 L211.8,332.9 L210.8,327.6 L215.0,323.3 L225.6,318.0 L230.9,310.6 L239.4,306.3 L246.9,296.8 L246.9,293.6 L255.4,289.4 L256.4,284.0 L263.9,284.0 L273.4,276.6 L275.5,276.6 L276.6,272.4 L279.8,269.2 L278.7,259.6 L285.1,254.3 L291.5,252.2 L296.8,252.2 L298.9,254.3 L309.5,253.2 L310.6,251.1 L307.4,241.6 L306.3,230.9 L302.1,222.4 L302.1,212.9 L294.7,208.6 L294.7,204.4 L297.8,202.3 L297.8,199.1 L305.3,198.0 L304.2,194.8 L300.0,193.8 L294.7,188.4 L294.7,183.1 L297.8,177.8 L306.3,178.9 L310.6,185.3 L313.8,182.1 L318.0,182.1 L321.2,185.3 L321.2,190.6 L319.1,194.8 L320.2,196.9 L325.5,198.0 L353.1,196.9 L354.1,198.0 L353.1,206.5 L339.3,216.1 L340.3,225.6 L344.6,230.9 L346.7,230.9 L349.9,222.4 L355.2,221.4 L361.6,241.6 L365.8,243.7 L369.0,239.4 L368.0,228.8 L372.2,223.5 L371.1,213.9 L381.8,212.9 L383.9,202.3 L387.1,199.1 L386.0,188.4 L391.3,186.3 L392.4,183.1 L392.4,170.4 L404.1,158.7 L409.4,157.6 L417.9,158.7 L417.9,156.6 L415.8,155.5 L415.8,151.3 L418.9,150.2 L420.0,142.8 L416.8,140.6 L409.4,140.6 L408.3,139.6 L409.4,133.2 L405.1,132.2 L404.1,127.9 L400.9,125.8 L397.7,126.8 L392.4,132.2 L386.0,132.2 L380.7,130.0 L359.5,147.0 L354.1,154.5 L342.5,156.6 L342.5,158.7 L346.7,160.8 L348.8,165.1 L348.8,169.3 L346.7,171.5 L323.3,171.5 L320.2,173.6 L307.4,172.5 L301.0,167.2 L302.1,154.5 L296.8,153.4 L292.5,160.8 L294.7,177.8 L288.3,179.9 L260.7,177.8 L258.5,175.7 L253.2,175.7 L238.4,165.1 L220.3,165.1 L215.0,160.8 L204.4,158.7 L200.1,156.6 L194.8,150.2 L181.0,143.8 L181.0,138.5 L184.2,129.0 L191.6,121.5 L191.6,119.4 L185.3,116.2 L181.0,110.9 L172.5,108.8 L168.3,102.4 L164.0,102.4 L163.0,92.8 L160.8,90.7 L161.9,85.4 L167.2,86.5 L171.5,83.3 L170.4,72.7 L167.2,70.5 L167.2,63.1 L169.3,61.0 L172.5,61.0 L175.7,54.6 L182.1,49.3 L186.3,36.6 L182.1,32.3 L177.8,32.3 L172.5,28.1 L169.3,28.1 L157.6,35.5 L149.1,36.6 L146.0,32.3 L141.7,30.2 L137.5,23.8 L132.2,21.7 L124.7,14.2 L123.7,11.1 Z';

  function projectSite(state){
    var c=STATE_CENTROID[state];
    if(!c) return null;
    var px=SRC_X0+(c[1]-LON_MIN)/(LON_MAX-LON_MIN)*SRC_W;
    var py=SRC_Y0+(LAT_MAX-c[0])/(LAT_MAX-LAT_MIN)*SRC_H;
    var x=(px-SRC_X0)*MAP_SCALE+MAP_PAD;
    var y=(py-SRC_Y0)*MAP_SCALE+MAP_PAD;
    return [Math.round(x*10)/10, Math.round(y*10)/10];
  }

  function healthBand(score){
    if(!isFinite(score)) return {key:'unknown',color:'#8398A0',label:'No data'};
    if(score>=80) return {key:'healthy',color:'#1E8E5A',label:'Healthy'};
    if(score>=65) return {key:'watch',color:'#C9821F',label:'Watch'};
    return {key:'critical',color:'#C0392B',label:'Critical'};
  }

  function num(n,fallback){var v=Number(n);return isFinite(v)?v:fallback;}
  function r1(n){return Math.round(num(n,0)*10)/10;}
  function r2(n){return Math.round(num(n,0)*100)/100;}
  function enIN(n){try{return Number(n).toLocaleString('en-IN');}catch(e){return String(n);}}

  function dataSourceLabel(){
    var m=(typeof APM_DATA_MODE!=='undefined')?APM_DATA_MODE:null;
    if(m==='Excel demo data') return 'Excel data';
    if(m==='Uploaded data') return 'Uploaded workbook';
    if(m==='Demo data') return 'Synthetic data';
    return m||'Synthetic data';
  }

  function activeRows(sheet){const result=__pv864_base_activeRows(sheet);return window.AIP_PV864?.linkedRows(sheet,result)??result;}function __pv864_base_activeRows(sheet){if(window.AIP891?.isUploaded())return window.AIP891.raw(sheet);
    try{ if(typeof contextGraphActiveRows==='function') return contextGraphActiveRows(sheet)||[]; }catch(e){}
    try{ if(typeof window.contextGraphActiveRows==='function') return window.contextGraphActiveRows(sheet)||[]; }catch(e){}
    return [];
  }

  // Forecast module (AIP_V475) keeps its own header/rows arrays as window.AIP_V475,
  // independent of EMBEDDED_EXCEL_DATA's data-mode lifecycle. objs() reconstructs
  // row objects from a (header[], rows[][]) pair the same way the app's own
  // forecast module does internally.
  function objs(h,rows){
    if(!h||!rows) return [];
    return rows.map(function(r){
      var o={};
      h.forEach(function(x,i){o[x]=r[i];});
      return o;
    });
  }
  function safeV475(){
    try{ return (typeof window.AIP_V475!=='undefined'&&window.AIP_V475)?window.AIP_V475:null; }catch(e){ return null; }
  }

  function readAllOverviewKPIs(){
    var out={};
    try{
      var cards=document.querySelectorAll('#view-overview .aip-kpi-master');
      cards.forEach(function(c){
        var lbl=c.querySelector('[data-kpi-label]'), val=c.querySelector('[data-kpi-value]');
        if(lbl&&val) out[lbl.textContent.replace(/\s+/g,' ').trim()]=val.textContent.trim();
      });
    }catch(e){}
    return out;
  }

  function fmtGeneration(mwh){
    if(!isFinite(mwh)||mwh<=0) return {value:'—',unit:'generation not available'};
    if(mwh>=1000000) return {value:enIN(r2(mwh/1000000)),unit:'TWh generated'};
    if(mwh>=1000) return {value:enIN(r1(mwh/1000)),unit:'GWh generated'};
    return {value:enIN(Math.round(mwh)),unit:'MWh generated'};
  }
  function fmtINR(v){
    if(!isFinite(v)) return '—';
    if(Math.abs(v)>=10000000) return '₹'+r2(v/10000000)+' Cr';
    if(Math.abs(v)>=100000) return '₹'+r2(v/100000)+' L';
    return '₹'+enIN(Math.round(v));
  }

  function safePlants(){try{return (typeof PLANTS!=='undefined'&&PLANTS)?PLANTS:[];}catch(e){return [];}}
  function safeWOs(){try{return (typeof ALL_WOS!=='undefined'&&ALL_WOS)?ALL_WOS:[];}catch(e){return [];}}
  function safePRTrend(){try{return (typeof PR_TREND!=='undefined'&&Array.isArray(PR_TREND))?PR_TREND:[];}catch(e){return [];}}
  function safeAvailTrend(){try{return (typeof AVAIL_TREND!=='undefined'&&Array.isArray(AVAIL_TREND))?AVAIL_TREND:[];}catch(e){return [];}}
  function safeClimate(){try{return (typeof ESG_CLIMATE!=='undefined'&&Array.isArray(ESG_CLIMATE))?ESG_CLIMATE:[];}catch(e){return [];}}
  function climateBand(score){
    var s=Number(score)||0;
    if(s>=0.7) return {label:'High',color:'#C0392B'};
    if(s>=0.4) return {label:'Moderate',color:'#C9821F'};
    return {label:'Low',color:'#1E8E5A'};
  }
  function dominantHazard(c){
    var opts=[['Heat',Number(c.heat)||0],['Flood',Number(c.flood)||0],['Wind',Number(c.wind)||0],['Water',Number(c.water)||0]];
    opts.sort(function(a,b){return b[1]-a[1];});
    return {label:opts[0][0],value:opts[0][1]};
  }
  function climateColHTML(list,selectedId){
    if(!list.length) return '<div class="home-climate-empty">No climate risk data</div>';
    return list.map(function(c){
      var band=climateBand(c.score);
      var haz=dominantHazard(c);
      var scorePct=Math.round((Number(c.score)||0)*100);
      var isSel=selectedId&&c.plant===selectedId;
      return '<div class="home-climate-row'+(isSel?' selected':'')+'" data-climate-site="'+esc(c.plant)+'" style="'+(isSel?'border-color:'+band.color+';':'')+'" title="'+esc(c.plantName||c.plant)+' · '+esc(haz.label)+' hazard '+haz.value+'/5 · composite risk '+scorePct+'/100 · '+esc(band.label)+'">'+
        '<i class="home-climate-dot" style="background:'+band.color+'"></i>'+
        '<b>'+esc(c.plant)+'</b>'+
        '<span class="home-climate-hazard">'+esc(haz.label)+'-led</span>'+
        '<span class="home-climate-score" style="color:'+band.color+'">'+scorePct+'<span class="home-climate-score-unit">/100</span></span>'+
      '</div>';
    }).join('');
  }

  // Site-wise recoverable generation, sourced from the same Loss Intelligence /
  // Site Loss Ranking data the platform's own "Generation & Revenue Loss
  // Intelligence" view uses (v2LossData(), governed by the "Generation Loss
  // Attribution" sheet when present, else the app's own synthetic loss engine).
  // That sheet carries one governed loss record per site per month across the
  // 24-month history, each with its own Recoverable_Loss_MWh — exactly what the
  // Site Loss Ranking table itself lists (per-record, "Recoverable loss is
  // prioritised for maintenance action"). Summing those records per Plant_ID
  // turns that same real field into one site-wise recoverable-MWh figure,
  // matching the one-row-per-site shape of the climate column beside it.
  function safeLossData(){try{return (typeof v2LossData==='function')?(v2LossData()||[]):[];}catch(e){return [];}}
  function lossBySite(){
    var map={};
    safeLossData().forEach(function(r){
      var pid=String(r.Plant_ID||'').trim();
      if(!pid) return;
      if(!map[pid]) map[pid]={plant:pid,recoverable:0,total:0,records:0};
      map[pid].recoverable+=Number(r.Recoverable_Loss_MWh)||0;
      map[pid].total+=Number(r.Total_Loss_MWh)||0;
      map[pid].records+=1;
    });
    return Object.keys(map).map(function(k){return map[k];});
  }
  function lossColHTML(list,selectedId){
    if(!list.length) return '<div class="home-climate-empty">No loss data</div>';
    return list.map(function(l){
      var mwh=Math.round(l.recoverable*10)/10;
      var totalMwh=Math.round(l.total*10)/10;
      var isSel=selectedId&&String(l.plant)===String(selectedId);
      return '<div class="home-climate-row home-loss-row'+(isSel?' selected':'')+'" data-loss-site="'+esc(l.plant)+'" title="'+esc(l.plant)+' · '+mwh+' MWh recoverable of '+totalMwh+' MWh total loss, across '+l.records+' governed loss records (loss intelligence · site loss ranking)">'+
        '<i class="home-climate-dot" style="background:var(--teal)"></i>'+
        '<b>'+esc(l.plant)+'</b>'+
        '<span class="home-climate-score" style="color:var(--teal)">'+enIN(Math.round(mwh))+'</span>'+
      '</div>';
    }).join('');
  }

  function buildSites(){
    var healthMap={};
    try{ if(typeof window.AIPGetCalculatedSiteHealthMap==='function') healthMap=window.AIPGetCalculatedSiteHealthMap()||{}; }catch(e){}
    return safePlants().map(function(p){
      var pos=projectSite(p.state);
      var health=isFinite(Number(healthMap[p.id]))?Number(healthMap[p.id]):Number(p.healthScore||0);
      var band=healthBand(health);
      return {id:p.id,name:p.name,state:p.state,mw:p.mw,pr:p.pr,availability:p.availability,health:Math.round(health),band:band,pos:pos};
    }).filter(function(s){return !!s.pos;});
  }

  function buildAttention(){
    try{
      if(typeof aipPriorityActions!=='function') return {items:[],threshold:null};
      var r=aipPriorityActions();
      return {items:(r.priority||[]).slice(0,4),total:(r.priority||[]).length,threshold:r.config?r.config.priorityThreshold:null};
    }catch(e){return {items:[],threshold:null};}
  }

  var SOFT_BY_COLOR={
    '#6B4E9C':'#EFE9F5','#B84A2E':'#FBEAE4','#8B3A3A':'#F5E9E9','#2A5C8A':'#E7EEF5',
    '#5B7083':'#EAEDF0','#1E8E5A':'#E4F5EC','#C9821F':'#FBF0DF','#0E7C7B':'#E4F3F2',
    '#C0392B':'#FBEAE8'
  };
  function withSoft(list){
    return list.map(function(k){ k.soft=SOFT_BY_COLOR[k.color]||'#F6F8F8'; return k; });
  }

  function homePerformanceRows(){
    // Use the same executive-performance population that the portfolio performance
    // experience can fall back to when the optional Executive Portfolio Summary
    // worksheet is absent. This prevents false zero/blank Home KPIs.
    try{
      if(typeof latestExecutive==='function'){ var a=latestExecutive()||[]; if(a.length) return a; }
    }catch(e){}
    try{
      if(typeof v2ExecData==='function'){ var b=v2ExecData()||[]; if(b.length) return b; }
    }catch(e){}
    return [];
  }

  function buildKPIStrip(){
    var ov=readAllOverviewKPIs();
    var wos=safeWOs();
    var dataExceptions=window.AIP891?window.AIP891.audit().length:'Not verified';
    var get=function(label){ return (ov[label]!=null && ov[label]!=='') ? ov[label] : '—'; };

    // Action-oriented site exception count from the same latest reporting-period
    // generation-variance data used by Portfolio Intelligence > Performance.
    var sitesBelowTarget=0;window.AIP891Performance=homePerformanceRows();
    try{ sitesBelowTarget=homePerformanceRows().filter(function(r){return Number(r.Generation_Variance_Pct||0)<0;}).length; }catch(e){}

    return withSoft([
      {abbr:'PA',label:'Priority Actions',value:get('Priority Actions'),color:'#6B4E9C'},
      {abbr:'CI',label:'Critical Interventions',value:get('Critical Interventions'),color:'#B84A2E'},
      {abbr:'LP',label:'Lowest-Performing Site',value:get('Lowest-Performing Site'),color:'#8B3A3A'},
      {abbr:'PR',label:'Portfolio PR',value:get('Portfolio PR'),color:'#2A5C8A'},
      {abbr:'AV',label:'Availability',value:get('Availability'),color:'#2A5C8A'},
      {abbr:'WO',label:'Open Work Orders',value:get('Open Work Orders'),color:'#5B7083'},
      {abbr:'RR',label:'Generation loss value (YTD)',value:get('Generation loss value (YTD)'),color:'#8B3A3A'},
      {abbr:'CO2',label:'CO₂ Avoided',value:get('CO₂ Avoided'),color:'#1E8E5A'},
      {abbr:'DQ',label:'Sustainability Data Exceptions',value:dataExceptions,color:'#C9821F'},
      {abbr:'BT',label:'Sites Below Target',value:String(sitesBelowTarget),color:'#0E7C7B'}
    ]);
    // Note: site-level Healthy/Watch/Critical counts are shown once, on the map
    // card below (legend + distribution bar), not repeated here as strip tiles.
  }

  function buildForecast(){
    /* v887: physics forecast from the same engine as Operational Twin → Generation Forecast; no ML accuracy is claimed
       because the residual model has not been trained on plant forecast-vs-actual history. */
    try{
      if(typeof window.AIPTwinPortfolioForecast==='function'){var v=window.AIPTwinPortfolioForecast(24);if(v&&v.available)return v;}
      return {available:false};
    }catch(e){ return {available:false}; }
  }

  function buildFailureRisk(){
    try{
      var alerts=activeRows('AI Alerts & RUL');
      if(!alerts.length) return {available:false};
      var open=alerts.filter(function(a){return a.Alert_Status==='Open';});
      var tierCounts={};
      open.forEach(function(a){var t=a.Risk_Tier||'Unknown';tierCounts[t]=(tierCounts[t]||0)+1;});
      var highRisk=open.filter(function(a){return a.Risk_Tier==='Critical'||a.Risk_Tier==='High';});
      var minRUL=highRisk.length?Math.min.apply(null,highRisk.map(function(a){return num(a.RUL_Days,9999);})):null;
      var avgConf=highRisk.length?r1(highRisk.reduce(function(s,a){return s+num(a.Confidence_Pct,0);},0)/highRisk.length):null;
      var nearest=highRisk.length?highRisk.slice().sort(function(a,b){return num(a.RUL_Days,9999)-num(b.RUL_Days,9999);})[0]:null;
      return {available:true,totalOpen:open.length,highRiskOpen:highRisk.length,minRUL:minRUL,avgConfidence:avgConf,nearestConfidence:nearest?r1(num(nearest.Confidence_Pct,0)):null,nearestAlertId:nearest?String(nearest.Alert_ID||''):null,nearestAssetId:nearest?String(nearest.Asset_ID||''):null,tierCounts:tierCounts};
    }catch(e){ return {available:false}; }
  }

  function buildKPIs(){
    var wos=safeWOs();
    var openWOs=wos.filter(function(w){return w.status!=='Closed'&&w.status!=='Completed';}).length;
    var perf={value:'—',unit:'Generation vs expected',energyGap:null,period:'latest governed period'};
    try{
      var ex=homePerformanceRows();
      if(ex.length){
        var actual=ex.reduce(function(s,r){return s+num(r.Actual_Generation_MWh,0);},0);
        var expected=ex.reduce(function(s,r){return s+num(r.Budget_Generation_MWh,0);},0);
        if(expected>0){
          var pct=(actual-expected)/expected*100;
          perf.value=(pct>0?'+':'')+r1(pct)+'%';
          var rawPeriod=String(ex[0].Month||''); var pd=new Date(rawPeriod); var periodLabel=!Number.isNaN(pd.getTime())?pd.toLocaleString('en-IN',{month:'short',year:'numeric'}):'latest governed period';
          perf.period=periodLabel; perf.unit='Generation vs expected · '+periodLabel;
          perf.energyGap=r1(actual-expected);
        }
      }
    }catch(e){}
    return {openWOs:openWOs,generationPerformance:perf};
  }

  /* ---- Executive panels: warranty/OEM recovery, fleet reliability engineering,
     HSE safety register, composite risk register. Each degrades to
     {available:false} when its governed sheet has no rows in the active data
     source (mirrors buildForecast/buildFailureRisk), rather than showing a
     stale or fabricated number. */

  function buildWarranty(){
    try{
      var reg=activeRows('Warranty Register');
      var claims=activeRows('Warranty Claims');
      if(!reg.length&&!claims.length) return {available:false};
      var active=reg.filter(function(w){return w.Current_Status==='Active';});
      var coverage=active.reduce(function(s,w){return s+num(w.Remaining_Coverage_Value_INR,0);},0);
      var claimedTotal=claims.reduce(function(s,c){return s+num(c.Claimed_Amount_INR,0);},0);
      var approvedTotal=claims.reduce(function(s,c){return s+num(c.Approved_Amount_INR,0);},0);
      var statusCounts={};
      claims.forEach(function(c){var s=c.Claim_Status||'Unknown';statusCounts[s]=(statusCounts[s]||0)+1;});
      var openClaims=claims.filter(function(c){return c.Claim_Status!=='Approved'&&c.Claim_Status!=='Rejected';}).length;
      return {available:true,activeCount:active.length,totalCount:reg.length,coverage:Math.round(coverage),
        claimCount:claims.length,claimedTotal:Math.round(claimedTotal),approvedTotal:Math.round(approvedTotal),
        openClaims:openClaims,statusCounts:statusCounts};
    }catch(e){ return {available:false}; }
  }

  function orlActiveRows(){
    try{
      var mode=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'').toLowerCase();
      var synth=(mode==='demo data'||mode.indexOf('synthetic')>-1||window.AIP_SYNTHETIC_ACTIVE===true);
      var src=synth?window.ORL_V589_SYNTHETIC:window.ORL_V589_EXCEL;
      return Array.isArray(src)?src:[];
    }catch(e){ return []; }
  }

  function buildReliability(){
    try{
      var rows=orlActiveRows();
      var classes=rows.filter(function(r){return r.Record_Type==='Asset Class';});
      if(!classes.length) return {available:false};
      var best=classes.slice().sort(function(a,b){return num(b.Reliability_Pct,0)-num(a.Reliability_Pct,0);})[0];
      var worst=classes.slice().sort(function(a,b){return num(a.Reliability_Pct,0)-num(b.Reliability_Pct,0);})[0];
      var worstMTTR=classes.slice().sort(function(a,b){return num(b.MTTR_Hours,0)-num(a.MTTR_Hours,0);})[0];
      var bestMTBF=classes.slice().sort(function(a,b){return num(b.MTBF_Hours,0)-num(a.MTBF_Hours,0);})[0];
      var avgAvail=classes.reduce(function(s,r){return s+num(r.Technical_Availability_Pct,0);},0)/classes.length;
      return {available:true,classCount:classes.length,
        best:{name:best.Asset_Class,pct:r1(best.Reliability_Pct)},
        worst:{name:worst.Asset_Class,pct:r1(worst.Reliability_Pct)},
        worstMTTR:{name:worstMTTR.Asset_Class,hrs:r1(worstMTTR.MTTR_Hours)},
        bestMTBF:{name:bestMTBF.Asset_Class,hrs:Math.round(num(bestMTBF.MTBF_Hours,0))},
        avgAvail:r1(avgAvail)};
    }catch(e){ return {available:false}; }
  }

  function buildSafety(){
    try{
      var events=activeRows('SUS_HSE_Events');
      if(!events.length) return {available:false};
      var sevCounts={},typeCounts={};
      events.forEach(function(e){
        var s=e.Severity||'Unknown'; sevCounts[s]=(sevCounts[s]||0)+1;
        var t=e.Event_Type||'Unknown'; typeCounts[t]=(typeCounts[t]||0)+1;
      });
      var openCount=events.filter(function(e){return String(e.Status||'').toLowerCase()!=='closed';}).length;
      return {available:true,total:events.length,sevCounts:sevCounts,typeCounts:typeCounts,openCount:openCount,
        recordable:typeCounts['Recordable']||0,nearMiss:typeCounts['Near Miss']||0};
    }catch(e){ return {available:false}; }
  }

  function buildRiskRegister(){
    try{
      var rows=activeRows('Risk Queue');
      if(!rows.length) return {available:false};
      var tierCounts={};
      rows.forEach(function(r){var t=r.Priority_Tier||'Unknown';tierCounts[t]=(tierCounts[t]||0)+1;});
      var top=rows.slice().sort(function(a,b){return num(a.Queue_Rank,999)-num(b.Queue_Rank,999);})[0];
      return {available:true,total:rows.length,tierCounts:tierCounts,
        top:top?{asset:top.Asset_Tag,plant:top.Plant_ID,composite:num(top.Composite_Risk,0)}:null};
    }catch(e){ return {available:false}; }
  }

  function riskOutlookCard(r,fcst){
    if(!r.available) return '<div class="card home-exec-card home-risk-outlook-card"><h3>Portfolio Risk Outlook</h3><div class="home-fcst-empty">Not available in the active data source.</div></div>';
    var elevated=(r.tierCounts.P1||0)+(r.tierCounts.P2||0);
    var elevatedShare=r.total?Math.round((elevated/r.total)*1000)/10:0;
    var energy=(fcst&&fcst.available)?fcst.energyAtRisk:null;
    return '<div class="card home-exec-card home-risk-outlook-card" style="border-left:4px solid #6B4E9C">'+
      '<h3>Portfolio Risk Outlook<button type="button" class="home-lite-nav home-head-nav" data-home-nav="predictive" aria-label="Open maintenance risk details">↗</button></h3><div class="sub">Decision view of current asset-risk concentration and forward operational exposure</div>'+
      '<div class="home-risk-outlook-grid">'+
        '<div class="home-fcst-item" style="background:#F5E9E9"><div class="fi-label">Elevated-Risk Assets</div><div class="fi-value">'+numUnitHTML(String(elevated),'P1 + P2','#8B3A3A')+'</div></div>'+
        '<div class="home-fcst-item" style="background:#EFE9F5"><div class="fi-label">Elevated-Risk Share</div><div class="fi-value">'+numUnitHTML(String(elevatedShare),'%','#6B4E9C')+'</div></div>'+
        '<div class="home-fcst-item" style="background:#FBF0DF"><div class="fi-label">24h Operational Energy at Risk</div><div class="fi-value">'+(energy!=null?numUnitHTML(String(energy),'MWh','#C9821F'):'—')+'</div></div>'+
      '</div>'+
      '<div class="home-fcst-foot">Asset counts are derived from the governed Composite Asset Risk Register; 24h energy exposure is sourced from the active generation forecast.</div>'+
    '</div>';
  }

  function mapSVG(sites,selectedId){
    var dots=sites.map(function(s){
      var sel=s.id===selectedId;
      return '<circle class="home-site-dot'+(sel?' selected':'')+'" data-site="'+esc(s.id)+'" cx="'+s.pos[0]+'" cy="'+s.pos[1]+'" r="'+(sel?9.5:7.5)+'" fill="'+s.band.color+'"><title>'+esc(s.id)+' · '+esc(s.name)+' · '+esc(s.band.label)+'</title></circle>'+
        '<text class="home-site-label" x="'+(s.pos[0]+8)+'" y="'+(s.pos[1]+3)+'">'+esc(s.id)+'</text>';
    }).join('');
    return '<svg viewBox="0 0 '+VB_W+' '+VB_H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="India site locations, traced outline">'+
      '<rect x="0.5" y="0.5" width="'+(VB_W-1)+'" height="'+(VB_H-1)+'" rx="8" fill="#F7FAFB"/>'+
      '<path d="'+INDIA_OUTLINE_D+'" fill="#DCEAE8" stroke="#7BA6A0" stroke-width="1.5" stroke-linejoin="round"/>'+
      dots+'</svg>';
  }

  var __sparkId=0;
  function sparkline(values,color){
    var W=260,H=56,PAD=4;
    var vals=(values||[]).filter(function(v){return isFinite(v);});
    if(vals.length<2) return '<div class="home-fcst-empty">No trend data</div>';
    var min=Math.min.apply(null,vals), max=Math.max.apply(null,vals);
    if(min===max){min-=1;max+=1;}
    var n=values.length;
    var x=function(i){return PAD+i/(n-1)*(W-2*PAD);};
    var y=function(v){return H-PAD-(v-min)/(max-min)*(H-2*PAD);};
    var pts=values.map(function(v,i){return [x(i),y(v)];});
    // Catmull-Rom -> cubic Bezier smoothing through the real monthly points,
    // so the governed series reads as a continuous trend line rather than a
    // jagged straight-segment "connect the dots" sparkline. The underlying
    // data points are unchanged; only the interpolation between them is curved.
    var smoothPath=function(){
      var d='M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);
      for(var i=0;i<pts.length-1;i++){
        var p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
        var c1x=p1[0]+(p2[0]-p0[0])/6, c1y=p1[1]+(p2[1]-p0[1])/6;
        var c2x=p2[0]-(p3[0]-p1[0])/6, c2y=p2[1]-(p3[1]-p1[1])/6;
        d+=' C'+c1x.toFixed(1)+','+c1y.toFixed(1)+' '+c2x.toFixed(1)+','+c2y.toFixed(1)+' '+p2[0].toFixed(1)+','+p2[1].toFixed(1);
      }
      return d;
    };
    var line=smoothPath();
    var lastX=pts[n-1][0], lastY=pts[n-1][1];
    var area=line+' L'+lastX.toFixed(1)+','+(H-PAD)+' L'+pts[0][0].toFixed(1)+','+(H-PAD)+' Z';
    var gid='aipHomeSparkGrad'+(__sparkId++);
    var gridY1=(H-PAD-(H-2*PAD)*0.3).toFixed(1), gridY2=(H-PAD-(H-2*PAD)*0.7).toFixed(1);
    return '<svg viewBox="0 0 '+W+' '+H+'" class="home-spark" role="img" aria-label="24-month trend" preserveAspectRatio="none">'+
      '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">'+
        '<stop offset="0%" stop-color="'+color+'" stop-opacity="0.26"/>'+
        '<stop offset="100%" stop-color="'+color+'" stop-opacity="0"/>'+
      '</linearGradient>'+
      '<clipPath id="'+gid+'-clip"><rect x="0" y="0" width="'+W+'" height="'+H+'"/></clipPath></defs>'+
      '<line x1="'+PAD+'" y1="'+gridY1+'" x2="'+(W-PAD)+'" y2="'+gridY1+'" stroke="#DCE3E6" stroke-width="1" stroke-dasharray="2,2"/>'+
      '<line x1="'+PAD+'" y1="'+gridY2+'" x2="'+(W-PAD)+'" y2="'+gridY2+'" stroke="#DCE3E6" stroke-width="1" stroke-dasharray="2,2"/>'+
      '<g clip-path="url(#'+gid+'-clip)">'+
      '<path d="'+area+'" fill="url(#'+gid+')" stroke="none"/>'+
      '<path d="'+line+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+
      '</g>'+
      '<circle cx="'+lastX.toFixed(1)+'" cy="'+lastY.toFixed(1)+'" r="4" fill="#fff" stroke="'+color+'" stroke-width="1.4"/>'+
      '<circle cx="'+lastX.toFixed(1)+'" cy="'+lastY.toFixed(1)+'" r="2" fill="'+color+'"/>'+
      '</svg>';
  }

  function trendItem(label,values,color,unit){
    var soft=SOFT_BY_COLOR[color]||'#F6F8F8';
    if(!values||values.length<2) return '<div class="home-trend-item" style="background:'+soft+';border-left:3px solid '+color+';"><div class="home-trend-label">'+esc(label)+'</div><div class="home-fcst-empty">No trend data</div></div>';
    var last=values[values.length-1], first=values[0];
    var delta=r1(last-first);
    var dir=delta>=0?'up':'down';
    var arrow=delta>=0?'▲':'▼';
    return '<div class="home-trend-item" style="background:'+soft+';border-left:3px solid '+color+';">'+
      '<div class="home-trend-top"><span class="home-trend-label">'+esc(label)+'</span><span class="home-trend-delta '+dir+'">'+arrow+' '+Math.abs(delta)+unit+' / 24mo</span></div>'+
      '<span class="home-trend-value">'+numUnitHTML(String(last),unit,color)+'</span>'+
      sparkline(values,color)+
      '</div>';
  }

  function siteDetail(site){
    if(!site) return '';
    var c=safeClimate().filter(function(x){return x.plant===site.id;})[0];
    var climateBlock='';
    if(c){
      climateBlock=
        '<div class="hsd-climate">'+
          '<div class="hsd-climate-head"><span>Climate &amp; physical asset risk</span></div>'+
          '<div class="hsd-row">'+
            '<span>Exposure<b>'+fmtINR(c.annualLoss)+'/yr</b></span>'+
            '<span>Vulnerability<b>'+(isFinite(c.readiness)?c.readiness+'% ready':'—')+'</b></span>'+
          '</div>'+
          (c.adaptation?'<div class="hsd-climate-note">Priority adaptation: '+esc(c.adaptation)+' · '+esc(c.status||'Planned')+'</div>':'')+
        '</div>';
    }
    return '<h4>'+esc(site.id)+' · '+esc(site.name)+'</h4>'+
      '<div class="hsd-row">'+
      '<span>State<b>'+esc(site.state)+'</b></span>'+
      '<span>Capacity<b>'+esc(site.mw)+' MWac</b></span>'+
      '<span>PR<b>'+esc(isFinite(site.pr)?r1(site.pr)+'%':'—')+'</b></span>'+
      '<span>Availability<b>'+esc(isFinite(site.availability)?r1(site.availability)+'%':'—')+'</b></span>'+
      '<span>Health<b style="color:'+site.band.color+'">'+esc(site.band.label)+' · '+esc(site.health)+'</b></span>'+
      '</div>'+
      climateBlock+
      '<button type="button" class="home-explorer-btn" data-open-site-explorer="'+esc(site.id)+'">Open Asset Explorer <span class="home-explorer-tag">('+esc(site.id)+')</span><span class="home-explorer-arrow" aria-hidden="true">↗</span></button>';
  }

  var BAND_COLOR={'Critical':'#8B3A3A','High':'#B84A2E','Medium':'#C9821F','Standard':'#5B7083'};
  function attentionRows(attn){
    if(!attn.items.length){
      var t=attn.threshold==null?'the governed priority threshold':('the governed priority threshold of '+attn.threshold+'/100');
      return '<div class="home-attn-empty">No action currently exceeds '+t+'.</div>';
    }
    return attn.items.map(function(a,i){
      var bc=BAND_COLOR[a.band]||'#5B7083';
      var money=num(a.exposureINR,0);
      var metaBits=[a.entity||a.category||''];
      /* APS is rendered as its own governed drill-down control below; do not bury it in metadata. */
      if(money>0) metaBits.push(fmtINR(money)+' exposure');
      if(Number(a.energyAtRiskMWh||0)>0) metaBits.push(r1(Number(a.energyAtRiskMWh))+' MWh at risk');
      if(a.inclusionTrigger) metaBits.push(a.inclusionTrigger);
      return '<div class="home-attn-row" style="border-left:3px solid '+bc+';padding-left:9px;">'+
        '<span class="home-attn-idx">'+String(i+1).padStart(2,'0')+'</span>'+
        '<span class="home-attn-body"><b>'+esc(a.title)+'</b>'+
          (a.band?'<span class="home-attn-band" style="background:'+(SOFT_BY_COLOR[bc]||'#EAEDF0')+';color:'+bc+'">'+esc(a.band)+'</span>':'')+
          (a.score!=null?'<button type="button" class="home-aps-drill" data-aps-record="'+esc(a.id||'')+'" title="Open APS calculation and ranking evidence">APS '+esc(a.score)+'/100 ↗</button>':'')+
          '<span>'+esc(metaBits.filter(Boolean).join(' · '))+'</span></span>'+
        '<button type="button" class="home-attn-open" data-open-view="'+esc(a.sourceView||'')+'" data-record-id="'+esc(a.id||'')+'" data-record-type="'+esc(a.type||'')+'" data-record-entity="'+esc(a.entity||'')+'" data-record-site="'+esc(a.site||'')+'">↗</button>'+
        '</div>';
    }).join('');
  }

  function kpiStripHTML(strip){
    return strip.map(function(k){
      var navMap={'Priority Actions':'home-priority-actions','Critical Interventions':'home-critical-interventions','Lowest-Performing Site':'home-lowest-site','Portfolio PR':'home-portfolio-pr','Availability':'home-availability','Open Work Orders':'home-open-workorders','Generation loss value (YTD)':'home-revenue-risk','CO₂ Avoided':'home-co2','Data Exceptions':'home-data-exceptions','Sustainability Data Exceptions':'home-data-exceptions','Sites Below Target':'home-sites-below-target'};
      var nv=navMap[k.label]||'';
      return '<div class="card home-strip-card" style="background:'+k.soft+';border-left:3px solid '+k.color+';" title="'+esc(k.label)+': '+esc(k.value)+'">'+
        '<span class="home-strip-label">'+esc(k.label)+'</span><span class="home-strip-value">'+vuHTML(k.value,k.color)+'</span>'+kpiBars(k.color)+(nv?'<button type="button" class="home-lite-nav" data-home-nav="'+nv+'" aria-label="Open '+esc(k.label)+' details">↗</button>':'')+
      '</div>';
    }).join('');
  }

  function riskTierBar(tierCounts){
    var order=[['Critical','#8B3A3A'],['High','#B84A2E'],['Medium','#C9821F'],['Low','#5B7083']];
    var total=0; order.forEach(function(o){total+=tierCounts[o[0]]||0;});
    if(!total) return '';
    var present=order.filter(function(o){return tierCounts[o[0]]>0;});
    var segs=present.map(function(o){
      var pct=tierCounts[o[0]]/total*100;
      return '<span style="width:'+pct.toFixed(1)+'%;background:'+o[1]+'"></span>';
    }).join('');
    var legend=present.map(function(o){
      return '<span><i style="background:'+o[1]+'"></i>'+o[0]+' · '+tierCounts[o[0]]+'</span>';
    }).join('');
    return '<div class="home-tier-bar">'+segs+'</div><div class="home-tier-legend">'+legend+'</div>';
  }

  function distBar(segments){
    var total=0; segments.forEach(function(s){total+=s.count||0;});
    if(!total) return '';
    var present=segments.filter(function(s){return s.count>0;});
    var segs=present.map(function(s){
      var pct=s.count/total*100;
      return '<span style="width:'+pct.toFixed(1)+'%;background:'+s.color+'"></span>';
    }).join('');
    var legend=present.map(function(s){
      return '<span><i style="background:'+s.color+'"></i>'+esc(s.label)+' · '+s.count+'</span>';
    }).join('');
    return '<div class="home-tier-bar">'+segs+'</div><div class="home-tier-legend">'+legend+'</div>';
  }

  function forecastCard(fcst){
    if(!fcst.available){
      return '<div class="card home-fcst-card"><h3>Generation Forecast <span class="home-fcst-tag">Next 24h · Physics</span></h3><div class="home-fcst-empty">Forecasting engine output not available in the active data source.</div></div>';
    }
    var footBits=[];
    footBits.push('Physics engine only · ML residual correction <b>not trained</b>');
    if(fcst.hindcastBias!=null) footBits.push(fcst.hindcastDays+'-day back-test bias <b>'+(fcst.hindcastBias>0?'+':'')+fcst.hindcastBias+'%</b>');
    if(fcst.topPlant&&fcst.topExposure>0) footBits.push('Highest forward exposure: <b>'+esc(fcst.topPlant)+'</b> ('+fmtINR(fcst.topExposure)+')');
    return '<div class="card home-fcst-card">'+
      '<h3>Generation Forecast <span class="home-fcst-tag">Next 24h · Physics</span><button type="button" class="home-lite-nav home-head-nav" data-home-nav="forecast" aria-label="Open Generation Forecast">↗</button></h3>'+
      '<div class="home-fcst-grid">'+
        '<div class="home-fcst-item" data-home-nav="forecast-overview" style="background:#E4F3F2;cursor:pointer" title="Σ sites, latest weather snapshot, same physics chain as Operational Twin"><div class="fi-label">Forecast Generation</div><div class="fi-value">'+numUnitHTML(enIN(fcst.forecastMWh),'MWh','#0E7C7B')+'</div></div>'+
        '<div class="home-fcst-item" data-home-nav="forecast-validation" style="background:#E4F5EC;cursor:pointer" title="Mean 15-min error of the physics model on observed weather ÷ AC rating, all sites — a model back-test, not a forecast-skill score"><div class="fi-label">Model Error · Back-test</div><div class="fi-value">'+(fcst.hindcastNMAE!=null?numUnitHTML(String(fcst.hindcastNMAE),'% nMAE','#1E8E5A'):'—')+'</div></div>'+
        '<div class="home-fcst-item" data-home-nav="forecast-risk" style="background:#FBF0DF;cursor:pointer" title="Planned outages and forecast curtailment in the next 24 h"><div class="fi-label">Energy at Risk</div><div class="fi-value">'+numUnitHTML(enIN(fcst.energyAtRisk),'MWh','#C9821F')+'</div></div>'+
        '<div class="home-fcst-item" data-home-nav="forecast-commercial" style="background:#F5E9E9;cursor:pointer" title="Energy at risk × PPA tariff (Commercial & PPA)"><div class="fi-label">Forward Exposure</div><div class="fi-value">'+vuHTML(fmtINR(fcst.exposureINR),'#8B3A3A')+'</div></div>'+
      '</div>'+
      '<div class="home-fcst-foot">'+footBits.join(' &nbsp;·&nbsp; ')+'</div>'+
    '</div>';
  }

  function execEmpty(title,tag){
    return '<div class="card home-exec-card"><h3>'+esc(title)+'</h3><div class="home-fcst-empty">'+esc(tag||'Not available in the active data source.')+'</div></div>';
  }

  function warrantyCard(w){
    if(!w.available) return execEmpty('Supplier Warranty & OEM Recovery');
    var statusOrder=[['Approved','#1E8E5A'],['Submitted','#2A5C8A'],['Evidence Ready','#C9821F'],['Opportunity','#8398A0'],['Rejected','#C0392B']];
    var legend=statusOrder.filter(function(o){return w.statusCounts[o[0]]>0;}).map(function(o){
      return '<span><i style="background:'+o[1]+'"></i>'+esc(o[0])+' · '+w.statusCounts[o[0]]+'</span>';
    }).join('');
    var realized=w.claimedTotal>0?r1(w.approvedTotal/w.claimedTotal*100):null;
    return '<div class="card home-exec-card" style="border-left:4px solid #6B4E9C">'+
      '<h3>Supplier Warranty &amp; OEM Recovery<button type="button" class="home-lite-nav home-head-nav" data-home-nav="warrantyrecovery" aria-label="Open details">↗</button></h3><div class="sub">'+w.activeCount+' of '+w.totalCount+' warranties active · '+w.claimCount+' claims on file</div>'+
      '<div class="home-exec-grid">'+
        '<div class="home-fcst-item" style="background:#EFE9F5"><div class="fi-label">Recorded Warranty Value</div><div class="fi-value">'+vuHTML(fmtINR(w.coverage),'#6B4E9C')+'</div></div>'+
        '<div class="home-fcst-item" style="background:#F5E9E9"><div class="fi-label">Claim Value Recorded</div><div class="fi-value">'+vuHTML(fmtINR(w.claimedTotal),'#8B3A3A')+'</div></div>'+
        '<div class="home-fcst-item" style="background:#E4F5EC"><div class="fi-label">OEM-Approved Value</div><div class="fi-value">'+vuHTML(fmtINR(w.approvedTotal),'#1E8E5A')+'</div></div>'+
        '<div class="home-fcst-item" style="background:#EAEDF0"><div class="fi-label">In Pipeline</div><div class="fi-value">'+numUnitHTML(String(w.openClaims),'claims','#5B7083')+'</div></div>'+
      '</div>'+
      '<div class="home-tier-legend" style="margin-top:11px">'+legend+'</div>'+
      (realized!=null?'<div class="home-fcst-foot">Approval conversion: <b>'+realized+'%</b> of recorded claim value approved by OEMs</div>':'')+
    '</div>';
  }

  function reliabilityCard(r){
    if(!r.available) return execEmpty('Fleet Reliability Engineering');
    return '<div class="card home-exec-card" style="border-left:4px solid #2A5C8A">'+
      '<h3>Fleet Reliability Engineering<button type="button" class="home-lite-nav home-head-nav" data-home-nav="fleetreliability" aria-label="Open fleet reliability details">↗</button></h3><div class="sub">'+r.classCount+' asset classes · rolling 12-month, work-order &amp; vision-confirmed failures</div>'+
      '<div class="home-exec-grid">'+
        '<div class="home-fcst-item" style="background:#E4F5EC"><div class="fi-label">Best Reliability</div><div class="fi-value">'+nameValUnit(r.best.name,String(r.best.pct),'%','#1E8E5A')+'</div></div>'+
        '<div class="home-fcst-item" style="background:#F5E9E9"><div class="fi-label">Lowest Reliability</div><div class="fi-value">'+nameValUnit(r.worst.name,String(r.worst.pct),'%','#8B3A3A')+'</div></div>'+
        '<div class="home-fcst-item" style="background:#FBF0DF"><div class="fi-label">Longest Repair Time</div><div class="fi-value">'+nameValUnit(r.worstMTTR.name,String(r.worstMTTR.hrs),'h MTTR','#C9821F')+'</div></div>'+
        '<div class="home-fcst-item" style="background:#E7EEF5"><div class="fi-label">Avg. Technical Availability</div><div class="fi-value">'+numUnitHTML(String(r.avgAvail),'%','#2A5C8A')+'</div></div>'+
      '</div>'+
      '<div class="home-fcst-foot">Best MTBF: <b>'+esc(r.bestMTBF.name)+'</b> at '+enIN(r.bestMTBF.hrs)+' operating hours between failures</div>'+
    '</div>';
  }

  function safetyCard(s){
    if(!s.available) return execEmpty('Safety & HSE Register');
    var sevOrder=[['High','#B84A2E'],['Medium','#C9821F'],['Low','#5B7083']];
    var legend=sevOrder.filter(function(o){return s.sevCounts[o[0]]>0;}).map(function(o){
      return '<span><i style="background:'+o[1]+'"></i>'+esc(o[0])+' · '+s.sevCounts[o[0]]+'</span>';
    }).join('');
    return '<div class="card home-exec-card" style="border-left:4px solid #B84A2E">'+
      '<h3>Safety &amp; HSE Register<button type="button" class="home-lite-nav home-head-nav" data-home-nav="sustainabilityintelligence" aria-label="Open details">↗</button></h3><div class="sub">'+s.total+' logged events · governed HSE log, FY2026 YTD</div>'+
      '<div class="home-exec-grid">'+
        '<div class="home-fcst-item" style="background:#FBEAE4"><div class="fi-label">Recordable Events</div><div class="fi-value" style="color:#B84A2E">'+s.recordable+'</div></div>'+
        '<div class="home-fcst-item" style="background:#FBF0DF"><div class="fi-label">Near Misses Logged</div><div class="fi-value" style="color:#C9821F">'+s.nearMiss+'</div></div>'+
        '<div class="home-fcst-item" style="background:#EAEDF0"><div class="fi-label">Open / In Review</div><div class="fi-value" style="color:#5B7083">'+s.openCount+'</div></div>'+
        '<div class="home-fcst-item" style="background:#F5E9E9"><div class="fi-label">High Severity</div><div class="fi-value" style="color:#8B3A3A">'+(s.sevCounts['High']||0)+'</div></div>'+
      '</div>'+
      '<div class="home-tier-legend" style="margin-top:11px">'+legend+'</div>'+
      '<div class="home-fcst-foot">Demo HSE activity log — not a certified regulatory filing</div>'+
    '</div>';
  }

  function riskRegisterCard(r){
    if(!r.available) return execEmpty('Composite Asset Risk Register');
    var order=[['P1','Critical','#8B3A3A'],['P2','High','#B84A2E'],['P3','Medium','#C9821F'],['P4','Low','#5B7083']];
    var bar=distBar(order.filter(function(o){return r.tierCounts[o[0]];}).map(function(o){return {label:o[0]+' · '+o[1],count:r.tierCounts[o[0]]||0,color:o[2]};}));
    return '<div class="card home-exec-card" style="border-left:4px solid #8B3A3A">'+
      '<h3>Composite Asset Risk Register<button type="button" class="home-lite-nav home-head-nav" data-home-nav="predictive" aria-label="Open maintenance risk details">↗</button></h3><div class="sub">Equipment-level risk (not climate) &middot; '+r.total+' assets scored on blended safety + energy-impact risk</div>'+
      bar+
      '<div class="home-fcst-foot">P1&ndash;P4 = priority tier, most to least urgent'+(r.top?'. Top-ranked: <b>'+esc(r.top.asset)+'</b> ('+esc(r.top.plant)+') &middot; composite risk score '+r.top.composite:'')+'</div>'+
    '</div>';
  }

  var selectedSiteId=null;

  function render(){
    var overlay=document.getElementById('aipHomeOverlay');
    if(!overlay) return;
    var sites=buildSites();
    var attn=buildAttention();
    var kpi=buildKPIs();
    var strip=buildKPIStrip();
    var fcst=buildForecast();
    var risk=buildFailureRisk();
    var warranty=buildWarranty();
    var reliability=buildReliability();
    var safety=buildSafety();
    var riskReg=buildRiskRegister();
    var prTrend=safePRTrend();
    var availTrend=safeAvailTrend();
    var climateRanked=safeClimate().slice().sort(function(a,b){return (Number(b.score)||0)-(Number(a.score)||0);});
    var lossRanked=lossBySite().sort(function(a,b){return b.recoverable-a.recoverable;});
    var selected=selectedSiteId?sites.filter(function(s){return s.id===selectedSiteId;})[0]:null;
    var now=new Date();
    var stamp=now.toLocaleString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    var dateStamp=now.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit'}).replace(/\//g,'-');
    var monthStamp=now.toLocaleString('en-IN',{month:'short',year:'numeric'});
    overlay.innerHTML =
      '<div class="home-head">'+
          '<div class="home-brand">'+
            '<img alt="Sustantix" class="home-brand-logo" src="assets/img-30711ced6015ff.png"/>'+
            '<div class="home-brand-text"><b>Asset Intelligence Platform</b><span class="home-badge">Operations Hub</span></div>'+
          '</div>'+
          '<div class="home-skip-wrap"><button type="button" class="home-skip" id="aipHomeSkip">Skip to workspace <span class="home-skip-arrow" aria-hidden="true">↗</span></button></div>'+
      '</div>'+

      '<div class="home-wrap">'+
        '<div class="home-scope-bar">'+
          '<span class="home-scope-chip" style="background:#F0EAF8;color:#6B3FA0">Portfolio snapshot · as of <b>&nbsp;'+dateStamp+'</b></span>'+
          '<span class="home-scope-chip" style="background:#E4F3F2;color:#0E7C7B">Forecast · <b>&nbsp;next 24h</b> (physics)</span>'+
          '<span class="home-scope-chip" style="background:#FBEAE4;color:#B84A2E">Predictive risk · open alerts as of <b>&nbsp;'+dateStamp+'</b></span>'+
          '<span class="home-scope-chip" style="background:#EAEDF0;color:#5B7083">Trend · trailing <b>&nbsp;24 months</b> through '+monthStamp+'</span>'+
        '</div>'+

        '<div class="home-strip">'+kpiStripHTML(strip)+'</div>'+

        '<div class="home-grid">'+
          '<div class="home-left">'+
            '<div class="card home-map-card" style="position:relative">'+
              '<div style="position:absolute;right:14px;top:13px;font-size:10px;color:#5B7083;font-weight:600;z-index:2">Installed Capacity · '+enIN(r1(safePlants().reduce(function(t,p){return t+num(p.mw,0);},0)))+' MW AC</div>'+
              '<h3>Site Map — India <span class="home-fcst-tag" style="color:#FFFFFF;background:#187A4A;font-size:9.5px;padding:3.5px 8px;border-radius:20px;">Click a site for details</span></h3>'+
              '<div class="home-map-flank">'+
                '<div class="home-climate-col">'+
                  '<div class="home-col-heading">Climate &amp; physical asset risk</div>'+
                  '<div class="home-col-rows">'+climateColHTML(climateRanked,selectedSiteId)+'</div>'+
                '</div>'+
                '<div class="home-map-stage" id="aipHomeMapStage">'+mapSVG(sites,selectedSiteId)+'</div>'+
                '<div class="home-climate-col home-loss-col">'+
                  '<div class="home-col-heading">Recoverable MWh</div>'+
                  '<div class="home-col-rows">'+lossColHTML(lossRanked,selectedSiteId)+'</div>'+
                '</div>'+
              '</div>'+
              '<div class="home-health-legend-wrap">'+
                '<div class="home-health-legend-title">Site Operational Health</div>'+
                '<div class="home-legend">'+
                  '<span><i style="background:#1E8E5A"></i>Healthy (≥80)</span>'+
                  '<span><i style="background:#C9821F"></i>Watch (65–79)</span>'+
                  '<span><i style="background:#C0392B"></i>Critical (&lt;65)</span>'+
                '</div>'+
              '</div>'+
              '<div class="home-site-detail'+(selected?' show':'')+'" id="aipHomeSiteDetail">'+siteDetail(selected)+'</div>'+
            '</div>'+
            '<div class="card home-trend-card">'+
              '<h3>24-Month Portfolio Trend</h3><div class="sub">Trailing performance and availability, governed monthly series · through '+monthStamp+'</div>'+
              '<div class="home-trend-grid">'+
                trendItem('Trailing 24-Month PR', prTrend, '#2A5C8A', '%')+
                trendItem('Trailing 24-Month Availability', availTrend, '#0E7C7B', '%')+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div class="home-right">'+
            '<div class="home-kpi-2">'+
              '<div class="card home-pulse-card"><button type="button" class="home-lite-nav" data-home-nav="home-generation-performance" aria-label="Open generation performance">↗</button><div class="hpc-label">Portfolio Pulse</div><div class="hpc-value">'+esc(kpi.generationPerformance.value)+'</div><div class="hpc-unit">'+esc(kpi.generationPerformance.unit)+'</div><div class="hpc-asof">'+(kpi.generationPerformance.energyGap!=null?((kpi.generationPerformance.energyGap>0?'+':'')+enIN(kpi.generationPerformance.energyGap)+' MWh variance · '):'')+'as of '+dateStamp+'</div>'+kpiBars('#2A5C8A')+'</div>'+
              '<div class="card home-risk-card"><button type="button" class="home-lite-nav" data-home-nav="predictive" aria-label="Open Predictive Maintenance">↗</button><div class="hpc-label">Predictive Failure Risk</div><div class="hpc-value">'+(risk.available?risk.highRiskOpen:'—')+'</div><div class="hpc-unit">open high-risk AI alerts</div>'+
                (risk.available&&risk.minRUL!=null?'<div class="hpc-note">Next predicted failure in '+risk.minRUL+' days · '+risk.nearestConfidence+'% confidence</div>':'')+
                '<div class="hpc-asof">'+(risk.available?(risk.tierCounts.Medium||0)+' Medium · '+risk.totalOpen+' Open total · ':'')+'as of '+dateStamp+'</div>'+
                (risk.available?riskTierBar(risk.tierCounts):'')+kpiBars('#B84A2E')+
              '</div>'+
            '</div>'+
            forecastCard(fcst)+
            '<div class="card home-attn-card">'+
              '<h3>What requires attention now</h3><div class="sub">'+Math.min(4,attn.total||0)+' shown · '+(attn.total||0)+' require attention · governed APS ≥ '+(attn.threshold==null?'—':attn.threshold)+'/100 · as of '+dateStamp+'</div>'+
              attentionRows(attn)+
            '</div>'+
          '</div>'+
        '</div>'+

        '<div class="home-section-label" style="margin-top:22px">Executive risk &amp; commercial intelligence — for portfolio leadership</div>'+
        '<div class="home-exec-cards">'+
          warrantyCard(warranty)+
          reliabilityCard(reliability)+
          safetyCard(safety)+
          riskRegisterCard(riskReg)+
          riskOutlookCard(riskReg,fcst)+
        '</div>'+
      '</div>';

    var skip=document.getElementById('aipHomeSkip');
    if(skip) skip.onclick=function(){ AIPHideHome(); };

    var stage=document.getElementById('aipHomeMapStage');
    if(stage) stage.addEventListener('click',function(ev){
      var dot=ev.target.closest?ev.target.closest('[data-site]'):null;
      if(!dot) return;
      selectedSiteId=dot.getAttribute('data-site');
      render();
    });

    // Spares reorder attention items carry sourceView:'inventory', which opens
    // the read-only Spares Inventory quantity-balance ledger — not the Spare
    // Parts Planning screen where reorder point vs. on-hand stock (the thing
    // the alert is actually about) is shown and actionable. Route those to the
    // correct, current screen instead.
    var VIEW_REDIRECT={inventory:'spares'};
    overlay.querySelectorAll('[data-aps-record]').forEach(function(btn){
      btn.addEventListener('click',function(ev){
        ev.preventDefault();ev.stopPropagation();
        var id=btn.getAttribute('data-aps-record')||'';
        window.AIP_APS_SELECTED_ID=id;
        window.AIP_APS_RETURN_TO_HOME=true;
        try{AIPHideHome();}catch(_){ }
        try{activate('actionprioritization');}catch(_){ }
        setTimeout(function(){try{window.renderActionPrioritization?.();document.getElementById('apcfgTrace')?.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){ }},40);
      });
    });
    overlay.querySelectorAll('[data-open-view]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var view=btn.getAttribute('data-open-view');
        if(view && VIEW_REDIRECT[view]) view=VIEW_REDIRECT[view];
        // Mark this as a genuine user navigation — same fix as
        // openAssetExplorerForSite() below. Without this, a still-running
        // background "restoreDatasetScreen" retry loop (fired after the
        // app's own initial Excel/Synthetic data load, which repeats
        // activate(<its captured view>) for up to ~4s after login) silently
        // reverts this navigation back to whichever view was active at
        // login a moment later.
        window.__aipLastUserNavTime=Date.now();
        AIPHideHome();
        if(view && typeof activate==='function'){ try{ activate(view); }catch(e){} }
        var rid=btn.getAttribute('data-record-id')||'', rtype=btn.getAttribute('data-record-type')||'', rent=btn.getAttribute('data-record-entity')||'', rsite=btn.getAttribute('data-record-site')||'';
        if(rid && rtype==='Work Order'){ setTimeout(function(){ try{ if(typeof opsOpenWO==='function') opsOpenWO(rid); }catch(e){} },120); }
        else if(rid && rtype==='Asset Risk'){ setTimeout(function(){ try{ openAssetExplorerForRecord(rid,rsite,rent); }catch(e){} },120); }
        else if(rid && rtype==='HSE Event'){
          setTimeout(function(){
            try{
              var root=document.getElementById('view-sustainabilityintelligence');
              if(root){
                var tabs=[...root.querySelectorAll('button,[role="tab"],[data-sus8-tab]')];
                var h=tabs.find(function(x){return /HSE|Resilience/i.test(x.textContent||'')}); if(h&&h.click)h.click();
              }
              setTimeout(function(){
                var scope=document.getElementById('view-sustainabilityintelligence')||document;
                var cells=[...scope.querySelectorAll('td,tr,.rigour-row,.sus-row')];
                var hit=cells.find(function(x){return (x.textContent||'').indexOf(rid)>=0});
                var row=hit&&(hit.closest('tr')||hit); if(row){row.style.background='#fff1f5';row.scrollIntoView({block:'center',behavior:'auto'});}
              },160);
            }catch(e){}
          },120);
        }
      });
    });

    function openHomeForecastContext(kind){
      window.__aipLastUserNavTime=Date.now();
      AIPHideHome();
      try{ if(typeof activate==='function') activate('operationaltwin'); }catch(e){}
      var settle=function(){
        try{
          document.body.classList.remove('aip-home-open','aip-home-handoff');
          var ov=document.getElementById('aipHomeOverlay'); if(ov) ov.classList.remove('open');
          var root=document.getElementById('view-operationaltwin');
          // A direct Home drill can arrive before the Operational Twin shell has
          // been rendered (or can arrive while Operational Twin is already the
          // active view). Initialise that shell explicitly before selecting GF.
          var shellReady=!!(root&&root.querySelector('#tLayers')&&root.querySelector('#twBody'));
          if(!shellReady && window.AIP_V21 && window.AIP_V21.renderers && typeof window.AIP_V21.renderers.operationaltwin==='function'){
            window.AIP_V21.renderers.operationaltwin();
            root=document.getElementById('view-operationaltwin');
          }
          if(typeof window.AIPActivateOperationalTwinLayer==='function'){
            window.AIPActivateOperationalTwinLayer('Generation Forecast');
          }else if(typeof window.AIPRenderGenerationForecast==='function'){
            window.AIPRenderGenerationForecast();
          }
          // The current governed Generation Forecast is one integrated screen.
          // For contextual Home KPI drills, bring the relevant governed section
          // into view after the forecast renderer is live; never navigate to an
          // unrendered/blank intermediate workspace.
          root=document.getElementById('view-operationaltwin');
          // Operations Hub forecast KPIs are portfolio-level Next 24h values.
          // Force the destination to the identical All Sites / 24h governed context
          // so the four Home values reconcile immediately on arrival.
          if(typeof window.AIPOpenPortfolioForecast==='function') window.AIPOpenPortfolioForecast(24);
          root=document.getElementById('view-operationaltwin');
          if(root && kind && kind!=='overview'){
            var terms=kind==='validation'?['Validation','Model Accuracy']:kind==='commercial'?['Commercial Exposure','Forward Exposure','Commercial']:kind==='risk'?['Energy at Risk','Operational Energy at Risk']:[];
            var candidates=[].slice.call(root.querySelectorAll('button,.xi-tab,[role="tab"],h3,h4,.gf377-kpi,.gf377-card'));
            var hit=candidates.find(function(x){var t=(x.textContent||'').trim();return terms.some(function(q){return t.indexOf(q)>=0;});});
            if(hit && typeof hit.click==='function' && /button|tab/i.test((hit.tagName||'')+' '+(hit.getAttribute&&hit.getAttribute('role')||''))) hit.click();
            else if(hit && hit.scrollIntoView) hit.scrollIntoView({block:'center',behavior:'auto'});
          }
        }catch(e){ console.error('Operations Hub Generation Forecast navigation failed',e); }
      };
      // Render after the main view activation, then repeat once after the shell
      // has settled. Both passes are idempotent and keep Home closed.
      setTimeout(settle,40); setTimeout(settle,180); setTimeout(settle,420);
    }
    function openHomePredictiveRisk(){
      var riskIds=[],riskRows=[],allOpen=[],mediumCount=0,nearest=null,avgConf=null;
      try{
        var alerts=activeRows('AI Alerts & RUL');
        allOpen=alerts.filter(function(a){return a.Alert_Status==='Open';});
        riskRows=allOpen.filter(function(a){return a.Risk_Tier==='Critical'||a.Risk_Tier==='High';});
        riskIds=riskRows.map(function(a){return String(a.Alert_ID||'');}).filter(Boolean);
        mediumCount=allOpen.filter(function(a){return a.Risk_Tier==='Medium';}).length;
        nearest=riskRows.length?riskRows.slice().sort(function(a,b){return Number(a.RUL_Days||9999)-Number(b.RUL_Days||9999);})[0]:null;
        avgConf=riskRows.length?Math.round((riskRows.reduce(function(sum,a){return sum+Number(a.Confidence_Pct||0);},0)/riskRows.length)*10)/10:null;
      }catch(e){}
      window.__aipLastUserNavTime=Date.now(); AIPHideHome();
      try{ if(typeof activate==='function') activate('predictive'); }catch(e){}
      var apply=function(){
        try{
          if(typeof renderPredictive==='function') renderPredictive();
          var root=document.getElementById('view-predictive'); if(!root)return;
          var old=root.querySelector('.home-predictive-lineage'); if(old)old.remove();
          var anchor=root.querySelector('.p754-main,.p754-table')||root.firstElementChild;
          if(anchor){
            var assets=[];try{assets=activeRows('Asset Master');}catch(e){}
            var nearestAsset=nearest?assets.find(function(a){return String(a.Asset_ID||'')===String(nearest.Asset_ID||'');}):null;
            var nearestTag=nearestAsset?String(nearestAsset.Asset_Tag||nearest.Asset_ID||'—'):(nearest?String(nearest.Asset_ID||'—'):'—');
            var note=document.createElement('div');note.className='home-predictive-lineage';note.style.cssText='margin:8px 0;padding:10px 11px;background:#fff7f7;border:1px solid #efb0b0;border-left:4px solid #c62828;border-radius:6px;font-family:Arial;color:#263f4c;';
            var head=document.createElement('div');head.style.cssText='display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px';
            var title=document.createElement('div');title.innerHTML='<div style="font:800 10px Arial;color:#9b1c1c">Operations Hub Reconciliation</div><div style="font:400 8px/1.35 Arial;color:#667b85;margin-top:2px">Exact governed population behind the Predictive Failure Risk card</div>';
            var close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Close Operations Hub reconciliation');close.textContent='×';close.style.cssText='border:0;background:transparent;color:#9b1c1c;font:700 16px/1 Arial;cursor:pointer;padding:0 2px;flex:0 0 auto';
            head.appendChild(title);head.appendChild(close);note.appendChild(head);
            var strip=document.createElement('div');strip.style.cssText='display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-bottom:7px';
            var cells=[['Open High/Critical',riskRows.length],['Medium',mediumCount],['Total Open',allOpen.length],['Nearest RUL',nearest?String(nearest.RUL_Days)+' days':'—'],['Avg High-Risk Confidence',avgConf!=null?avgConf.toFixed(1)+'%':'—']];
            cells.forEach(function(c){var d=document.createElement('div');d.style.cssText='background:#fff;border:1px solid #eadede;border-radius:5px;padding:6px 7px;min-width:0';d.innerHTML='<div style="font:700 7.4px Arial;color:#758892">'+c[0]+'</div><div style="font:800 11px Arial;color:#263f4c;margin-top:2px">'+c[1]+'</div>';strip.appendChild(d);});note.appendChild(strip);
            var detail=document.createElement('div');detail.style.cssText='font:700 8.2px/1.4 Arial;color:#536b76';detail.textContent=nearest?('Nearest predicted failure: '+String(nearest.Alert_ID||'—')+' · '+nearestTag+' · RUL '+String(nearest.RUL_Days)+' days · Confidence '+Number(nearest.Confidence_Pct||0).toFixed(1)+'%'):'No open High/Critical predictive alerts.';note.appendChild(detail);
            var lineage=document.createElement('div');lineage.style.cssText='font:400 7.8px/1.4 Arial;color:#71848d;margin-top:4px';lineage.textContent='Highlighted table population: '+riskIds.join(', ');note.appendChild(lineage);
            close.onclick=function(){root.querySelectorAll('tr[data-p754-alert]').forEach(function(tr){tr.hidden=false;tr.style.background='';});note.remove();};
            anchor.parentNode.insertBefore(note,anchor);
          }
          root.querySelectorAll('tr[data-p754-alert]').forEach(function(tr){var id=tr.getAttribute('data-p754-alert')||'';tr.hidden=riskIds.indexOf(id)<0;if(!tr.hidden)tr.style.background='#fff1f5';});
        }catch(e){}
      };
      setTimeout(apply,120); setTimeout(apply,320);
    }

    overlay.querySelectorAll('[data-home-nav]').forEach(function(btn){
      btn.addEventListener('click',function(ev){
        ev.stopPropagation();
        var view=btn.getAttribute('data-home-nav');
        window.__aipLastUserNavTime=Date.now();
        AIPHideHome();
        try{
          if(view==='forecast'||view==='forecast-overview'){ openHomeForecastContext('overview'); return; }
          if(view==='forecast-validation'){ openHomeForecastContext('overview'); setTimeout(function(){try{if(window.AIP_TWIN872&&window.AIP_TWIN872.openValidation)window.AIP_TWIN872.openValidation()}catch(_){}},650); return; }
          if(view==='forecast-risk'){ openHomeForecastContext('risk'); return; }
          if(view==='forecast-commercial'){ openHomeForecastContext('commercial'); return; }
          if(view==='predictive'){ openHomePredictiveRisk(); return; }
          if(view==='warrantyrecovery'){ window.__AIP_HOME_WARRANTY_RECON=true; window.__ml534WarrantySearch=''; window.__ml534WarrantyStatus='All'; window.__ml534SelectedClaim=''; if(window.AIP856_MLR_STATE) window.AIP856_MLR_STATE.tab='warranty'; activate('warrantyrecovery'); return; }
          if(view==='fleetreliability'){
            window.__AIP_HOME_RELIABILITY_RECON=false;
            try{ORL_STATE.assetClass='All';ORL_STATE.failureMode='All';ORL_STATE.incident='All';}catch(e){}
            /* v803: use the exact proven user navigation path. Reliability Engineering is
               the sidebar parent (rootcause); Operational Reliability is a grouped sub-tab,
               not a sidebar view. Direct activation of reliabilityengineering leaves the
               shell without its parent/group state and can render a blank right pane. */
            activate('rootcause');
            var openOperationalReliability=function(){
              try{
                var parent=document.getElementById('view-rootcause');
                var tab=parent&&parent.querySelector('.aip-maint-subtabs [data-aip-maint-nav="reliabilityengineering"]');
                if(!tab) tab=document.querySelector('.view.active .aip-maint-subtabs [data-aip-maint-nav="reliabilityengineering"]');
                if(tab){ tab.click(); return true; }
              }catch(e){ console.error('Home Operational Reliability sub-tab route failed',e); }
              return false;
            };
            if(!openOperationalReliability()){
              requestAnimationFrame(function(){
                if(!openOperationalReliability()) setTimeout(openOperationalReliability,80);
              });
            }
            return;
          }
          // Home KPI navigation is semantic: land on the exact Portfolio Intelligence
          // tab that contains the KPI's governed detail, rather than routing by a
          // similar word in another module.
          if(view==='home-priority-actions'){ if(window.openPortfolioIntelligenceTab) window.openPortfolioIntelligenceTab('overview'); else activate('portfoliointelligence'); setTimeout(function(){try{ if(typeof aipOpenActions==='function') aipOpenActions('priority'); else document.querySelector('#view-overview .executive-priorities')?.scrollIntoView({block:'center',behavior:'auto'}); }catch(e){}},140); return; }
          if(view==='home-lowest-site'){
            var lp=(typeof PLANTS!=='undefined'&&Array.isArray(PLANTS)?PLANTS:[]).slice().sort(function(a,b){return Number(a.pr||0)-Number(b.pr||0);})[0];
            if(window.openPortfolioIntelligenceTab) window.openPortfolioIntelligenceTab('benchmarking'); else activate('benchmarking');
            setTimeout(function(){try{ if(lp&&typeof benchmarkSelect==='function') benchmarkSelect(lp.name); }catch(e){}},160); return;
          }
          if(view==='home-generation-performance'){ if(window.openPortfolioIntelligenceTab) window.openPortfolioIntelligenceTab('performance'); else activate('performance'); return; }
          if(view==='home-sites-below-target'){ if(window.openPortfolioIntelligenceTab) window.openPortfolioIntelligenceTab('benchmarking'); else activate('benchmarking'); return; }
          if(view==='home-portfolio-pr'||view==='home-availability'){ if(window.openPortfolioIntelligenceTab) window.openPortfolioIntelligenceTab('performance'); else activate('performance'); return; }
          if(view==='home-revenue-risk'){ if(window.openRevenueCommercialTab) window.openRevenueCommercialTab('commercialppa'); else activate('revenuecommercial'); return; }
          if(view==='home-co2'){
            activate('sustainabilityintelligence');
            setTimeout(function(){try{var b=[...document.querySelectorAll('#view-sustainabilityintelligence [data-sus8-tab]')].find(function(x){return x.getAttribute('data-sus8-tab')==='energy'}); if(b)b.click();}catch(e){}},140); return;
          }
          if(view==='home-critical-interventions'||view==='home-open-workorders'){ activate('workorderintelligence'); setTimeout(function(){try{var r=document.getElementById('view-workorderintelligence');var b=r&&[...r.querySelectorAll('.ops-tab')].find(function(x){return /Command Centre/i.test(x.textContent||'')});if(b)b.click();}catch(e){}},120); return; }
          if(view==='home-data-exceptions'){ activate('dataquality'); return; }
          if(view==='sustainabilityintelligence'){ activate('sustainabilityintelligence'); setTimeout(function(){try{var b=[...document.querySelectorAll('#view-sustainabilityintelligence [data-sus8-tab]')].find(function(x){return x.getAttribute('data-sus8-tab')==='hse';});if(b)b.click();}catch(e){}},140); return; }
          if(view && typeof activate==='function') activate(view);
        }catch(e){}
      });
    });

    overlay.querySelectorAll('[data-open-site-explorer]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var siteId=btn.getAttribute('data-open-site-explorer');
        AIPHideHome();
        openAssetExplorerForSite(siteId);
      });
    });
  }

  // ---- Contextual navigation: "Open Asset Explorer" from a Home screen site
  // must land on THAT site's own asset record, not whichever asset the
  // Explorer last had selected (e.g. always SP-01). We resolve the site's
  // first governed Asset Master row and drive the app's own established
  // context-navigation contract (window.AIP_CONTEXT_NAV /
  // AIP_ASSET_EXPLORER_PENDING_CONTEXT + AIPAssetExplorerController.
  // navigateContext), the same mechanism other modules (e.g. Sustainability
  // Intelligence drill-through) already use, with the same short retry loop
  // since the Explorer's own render can be a frame behind activate().
  function openAssetExplorerForSite(siteId){
    // Mark this as a genuine user navigation (exactly what the sidebar's own
    // click handler does). Without this, a still-running background
    // "restoreDatasetScreen" retry loop (fired after the app's own initial
    // Excel/Synthetic data load, which repeats activate(<its captured view>)
    // for up to ~4s after login) does not know a newer navigation happened
    // and can silently revert this contextual jump back to whichever view
    // was active at login. This one line is the fix for that.
    window.__aipLastUserNavTime=Date.now();
    try{
      var rows=activeRows('Asset Master');
      var match=null;
      for(var i=0;i<rows.length;i++){
        if(String(rows[i].Plant_ID)===String(siteId)){ match=rows[i]; break; }
      }
      if(!match){
        if(typeof activate==='function'){ try{ activate('assetexplorer'); }catch(e){} }
        return;
      }
      var ctx={
        assetId:String(match.Asset_ID||''), Asset_ID:String(match.Asset_ID||''),
        assetTag:String(match.Asset_Tag||''), tag:String(match.Asset_Tag||''),
        plantId:String(siteId), Plant_ID:String(siteId), siteId:String(siteId),
        assetClass:String(match.Asset_Class||''), Asset_Class:String(match.Asset_Class||''),
        source:'AIP Intelligence Home', target:'assetexplorer',
        contextToken:'HOME-SITE-'+Date.now()
      };
      window.AIP_CONTEXT_NAV=ctx;
      window.AIP_SELECTED_ASSET_CONTEXT=ctx;
      window.AIP_ASSET_EXPLORER_PENDING_CONTEXT=ctx;
      try{ sessionStorage.setItem('aip.context.nav',JSON.stringify(ctx)); }catch(e){}
      if(typeof activate==='function'){ try{ activate('assetexplorer'); }catch(e){} }
      var applied=false;
      try{ applied=(window.AIPAssetExplorerController&&window.AIPAssetExplorerController.navigateContext&&window.AIPAssetExplorerController.navigateContext(ctx)===true); }catch(e){}
      if(!applied){
        var attempts=0;
        var ensure=function(){
          attempts++;
          var ok=false;
          try{ ok=(window.AIPAssetExplorerController&&window.AIPAssetExplorerController.navigateContext&&window.AIPAssetExplorerController.navigateContext(ctx)===true); }catch(e){}
          if(!ok&&attempts<8) requestAnimationFrame(ensure);
        };
        requestAnimationFrame(ensure);
      }
    }catch(e){
      try{ if(typeof activate==='function') activate('assetexplorer'); }catch(e2){}
    }
  }

  function openAssetExplorerForRecord(recordId,siteId,entity){
    try{
      var rows=activeRows('Asset Master'), match=null;
      for(var i=0;i<rows.length;i++){
        var r=rows[i], vals=[r.Asset_ID,r.Asset_Tag,r.Asset_Name,r.Description].map(function(x){return String(x||'')});
        if(vals.indexOf(String(recordId))>=0 || vals.indexOf(String(entity))>=0){ match=r; break; }
      }
      if(match){
        var ctx={assetId:String(match.Asset_ID||''),Asset_ID:String(match.Asset_ID||''),assetTag:String(match.Asset_Tag||''),tag:String(match.Asset_Tag||''),plantId:String(match.Plant_ID||siteId||''),Plant_ID:String(match.Plant_ID||siteId||''),siteId:String(match.Plant_ID||siteId||''),assetClass:String(match.Asset_Class||''),Asset_Class:String(match.Asset_Class||''),source:'AIP Intelligence Home',target:'assetexplorer',contextToken:'HOME-RISK-'+Date.now()};
        window.AIP_CONTEXT_NAV=ctx;window.AIP_SELECTED_ASSET_CONTEXT=ctx;window.AIP_ASSET_EXPLORER_PENDING_CONTEXT=ctx;
        try{sessionStorage.setItem('aip.context.nav',JSON.stringify(ctx));}catch(e){}
        if(typeof activate==='function') activate('assetexplorer');
        var tries=0,go=function(){tries++;try{if(window.AIPAssetExplorerController&&window.AIPAssetExplorerController.navigateContext&&window.AIPAssetExplorerController.navigateContext(ctx)===true)return;}catch(e){}if(tries<8)requestAnimationFrame(go);};requestAnimationFrame(go);return;
      }
    }catch(e){}
    if(siteId) openAssetExplorerForSite(siteId);
  }

  function ensureOverlay(){
    if(document.getElementById('aipHomeOverlay')) return;
    var d=document.createElement('div');
    d.id='aipHomeOverlay';
    document.body.appendChild(d);
  }

  window.AIPShowHome=function(){
    ensureOverlay();
    render();
    var overlay=document.getElementById('aipHomeOverlay');
    if(overlay) overlay.classList.add('open');
    // Complete the shared KPI and responsive passes in this same event turn,
    // before the browser can paint Home or start fading the login screen.
    window.AIPTAM895?.refresh();
    window.AIP891?.scan();
    window.AIPTAM895?.refresh();
    window.AIPResponsive896?.refresh();
    document.body.classList.add('aip-home-open');
    document.body.classList.remove('aip-home-handoff');
  };
  window.AIPHideHome=function(){
    var overlay=document.getElementById('aipHomeOverlay');
    if(overlay) overlay.classList.remove('open');
    document.body.classList.remove('aip-home-open');
  };

  function installHomeButton(){
    try{
      var topRight=document.querySelector('.top-right');
      if(topRight && !document.getElementById('topHomeBtn')){
        var b=document.createElement('button');
        b.id='topHomeBtn'; b.type='button';
        b.innerHTML='Operations Hub <span class="tophome-arrow" aria-hidden="true">↗</span>';
        b.addEventListener('click',function(){ AIPShowHome(); });
        topRight.insertBefore(b,topRight.firstChild);
      }
    }catch(e){}
  }

  document.addEventListener('keydown',function(ev){
    if(ev.key==='Escape'){
      var overlay=document.getElementById('aipHomeOverlay');
      if(overlay && overlay.classList.contains('open')) AIPHideHome();
    }
  });

  document.addEventListener('aip:layout-ready',function(){ document.body.classList.add('aip-home-handoff'); },true);

  document.addEventListener('aip:login-complete',function(){
    installHomeButton();
    // Login already prepared and opened Home before fading the login overlay.
    // Keep that DOM intact; retain the fallback for alternate login paths.
    var home=document.getElementById('aipHomeOverlay');
    if(!home || !home.classList.contains('open')) AIPShowHome();
    else document.body.classList.remove('aip-home-handoff');
  });

  window.AIP_HOME_V2_AUDIT={release:'home-v2',scope:'AIP Intelligence Home: 10-card KPI strip, traced India site map, 24-month PR/Availability trend, ML generation-forecast panel (window.AIP_V475), predictive failure-risk panel (AI Alerts & RUL), an executive panel row — Warranty & OEM Recovery, Fleet Reliability Engineering, Safety & HSE Register, Composite Asset Risk Register — plus site-level contextual navigation into Asset Explorer (resolves the clicked site\'s own first Asset Master record via the app\'s existing AIP_CONTEXT_NAV/AIPAssetExplorerController.navigateContext contract, mirroring the Sustainability Intelligence drill-through pattern). Additive only, no existing view/render function modified.',dependsOn:['PLANTS','ALL_WOS','esgSum','aipPriorityActions','AIPGetCalculatedSiteHealthMap','activate','contextGraphActiveRows','window.__aipDQCalc','window.AIP_V475','window.ORL_V589_EXCEL','window.ORL_V589_SYNTHETIC','PR_TREND','AVAIL_TREND','window.AIPAssetExplorerController'],businessDataChanged:false,startupLoginSequenceChanged:false};
window.AIP_HOME_V772_AUDIT={release:'v772',baseline:'v771',scope:'Generation Forecast portfolio 24h KPI reconciliation and site contribution lineage',changes:['Home Generation Forecast drill forces All Sites / 24h portfolio context','Generation Forecast top KPIs exactly mirror Home: Forecast Generation, Model Accuracy, Energy at Risk, Forward Exposure','Site contribution register reconciles additive KPIs and shows governed portfolio accuracy separately'],dataChanged:false};
})();
