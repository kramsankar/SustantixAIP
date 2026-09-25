
(function(){
 const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
 const arr=name=>{try{return Array.isArray(eval(name))?eval(name):[]}catch(e){return[]}};
 function axImportedRows(sheet){try{const d=(typeof APM_IMPORTED_DATA!=='undefined'&&APM_IMPORTED_DATA)||window.APM_IMPORTED_DATA||{};return Array.isArray(d[sheet])?d[sheet]:[]}catch(_){return[]}}
 function axEmbeddedRows(sheet){try{return (typeof EMBEDDED_EXCEL_DATA!=='undefined'&&EMBEDDED_EXCEL_DATA&&Array.isArray(EMBEDDED_EXCEL_DATA[sheet]))?EMBEDDED_EXCEL_DATA[sheet]:[]}catch(_){return[]}}
 function axWorkbookRows(sheet){
   const out=[];
   try{if(Array.isArray(window.EXCEL_DATA?.[sheet]))out.push(...window.EXCEL_DATA[sheet])}catch(_){}
   try{if(Array.isArray(window.WORKBOOK_DATA?.[sheet]))out.push(...window.WORKBOOK_DATA[sheet])}catch(_){}
   try{if(Array.isArray(window.ACTIVE_DATASET?.[sheet]))out.push(...window.ACTIVE_DATASET[sheet])}catch(_){}
   return out;
 }
 function axCollectRows(sheetNames,globalNames=[]){
   const rows=[]; globalNames.forEach(n=>rows.push(...arr(n)));
   for(const sh of sheetNames){rows.push(...axImportedRows(sh),...axWorkbookRows(sh),...axEmbeddedRows(sh));}
   const seen=new Set(),out=[];
   for(const r of rows){
     if(!r||typeof r!=='object')continue;
     const id=[r.Work_Order_ID,r.WO_ID,r.Alert_ID,r.Event_ID,r.Finding_ID,r.Claim_ID,r.Warranty_ID,r.Action_ID,r.assetId,r.Asset_ID,r.Asset_Tag,r.tag,r.id].find(v=>v!=null&&String(v).trim()!=='');
     const key=(id?String(id).toLowerCase().replace(/[^a-z0-9]/g,''):'')+'|'+JSON.stringify(r).slice(0,180);
     if(seen.has(key))continue;seen.add(key);out.push(r);
   }
   return out;
 }
 let selected='',selectedSite='',filter='All',query='',tab='Overview';
 let axContextBridgeAssets=[];
 let axRenderGeneration=0;
 let axOperatingStateTimers=[];
 function plantName(id){const p=arr('PLANTS').find(x=>x.id===id);return p?.name||id||'Unknown site'}
 function assets(){
   const base=axCollectRows(['Asset Master','Asset Explorer View','Graph Asset Selector','Assets','Asset Registry'],['ASSET_REGISTRY']).map(x=>{
     const governedId=x.Asset_ID??x.assetId??x.id??x.asset_id;
     const governedPlant=x.Plant_ID??x.plant??x.plantId??x.plant_id;
     const governedTag=x.Asset_Tag??x.tag??x.assetTag??x.asset_tag??governedId;
     const governedClass=x.Asset_Class??x.assetClass??x.cls??x.type??'Asset';
     const governedPlantName=x.Plant_Name??x.plantName??x.siteName??plantName(governedPlant);
     const sourceHealthRaw=x.Health_Score??x.health??x.healthScore;
     const a={assetId:String(governedId||''),plant:String(governedPlant||''),plantName:String(governedPlantName||governedPlant||'Unknown site'),tag:String(governedTag||governedId||''),assetClass:String(governedClass||'Asset'),description:x.Description??x.description??x.desc??'',status:x.Operating_Status??x.status??x.operatingStatus??'Operational',oem:x.OEM??x.oem??'—',model:x.Model??x.model??'—',sourceHealth:num(sourceHealthRaw,75),health:num(sourceHealthRaw,75),healthKnown:(sourceHealthRaw!==undefined&&sourceHealthRaw!==null&&sourceHealthRaw!==''),riskBand:x.Risk_Band??x.riskBand??x.risk??'',capacity:num(x.Rated_Capacity_MW??x.capacity??x.ratedCapacity??x.ratedMW,0),installYear:x.Install_Year??x.installYear??'',lastMaintenance:x.Last_Maintenance_Date??x.lastMaintenance??'',raw:x,governed:{Asset_ID:String(governedId||''),Plant_ID:String(governedPlant||''),Plant_Name:String(governedPlantName||governedPlant||''),Asset_Tag:String(governedTag||governedId||''),Asset_Class:String(governedClass||'Asset')}};
     const result=calculateAssetHealth(a);
     a.health=result.score;a.healthKnown=result.dataCompleteness>0;a.healthCalculation=result;
     a.riskBand=result.band==='critical'?'High':result.band==='watch'?'Medium':'Low';
     return a;
   }).filter(x=>x.assetId);
   const ids=new Set(base.map(x=>String(x.assetId)));
   return base.concat(axContextBridgeAssets.filter(x=>x&&x.assetId&&!ids.has(String(x.assetId))));
 }
 function assetKey(v){return String(v??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'')}
 function matchAsset(r,a){
   const wantedId=assetKey(a?.assetId),wantedTag=assetKey(a?.tag);
   const rowId=assetKey(r?.assetId??r?.asset_id??r?.Asset_ID);
   const rowTag=assetKey(r?.assetTag??r?.asset_tag??r?.Asset_Tag??r?.tag??r?.asset??r?.Asset);
   // When a source row contains both governed identifiers, both must agree.
   // This prevents a malformed row (for example AST-00001 with tag INV-008)
   // from contaminating two different assets.
   if(rowId&&rowTag&&wantedId&&wantedTag)return rowId===wantedId&&rowTag===wantedTag;
   if(rowId&&wantedId)return rowId===wantedId;
   if(rowTag&&wantedTag)return rowTag===wantedTag;
   return false;
 }
 function normalizeWorkOrder(r){
   return Object.assign({},r,{
     id:r?.id||r?.woId||r?.workOrderId||r?.Work_Order_ID||r?.WO_ID||'—',
     woId:r?.woId||r?.Work_Order_ID||r?.WO_ID||r?.id||'—',
     assetId:r?.assetId||r?.asset_id||r?.Asset_ID||'',
     assetTag:r?.assetTag||r?.asset_tag||r?.Asset_Tag||'',
     asset:r?.asset||r?.Asset_Tag||r?.Asset_ID||'',
     plant:r?.plant||r?.plantId||r?.Plant_ID||'',
     plantName:r?.plantName||r?.Plant_Name||plantName(r?.plant||r?.plantId||r?.Plant_ID),
     desc:r?.desc||r?.description||r?.Description||'',
     description:r?.description||r?.desc||r?.Description||'',
     type:r?.type||r?.maintenanceType||r?.Maintenance_Type||'',
     priority:r?.priority||r?.Priority||'',
     status:r?.status||r?.Status||'',
     created:r?.created||r?.Created_Date||'',
     dueDate:r?.dueDate||r?.SLA_Due||r?.Due_Date||'',
     source:r?.source||r?.Source||''
   });
 }
 function workOrders(a){
   const pools=axCollectRows(['Work Orders','Work_Orders','Intelligent WO Header','WO Ledger Runtime'],['ALL_WOS']);
   const seen=new Set(),out=[];
   pools.forEach(raw=>{
     const w=normalizeWorkOrder(raw);
     if(!matchAsset(w,a))return;
     // A work order may appear in more than one runtime pool (for example
     // ALL_WOS and the active workbook) with Asset_ID in one source and
     // Asset_Tag in another. Work_Order_ID is the governed unique key, so
     // deduplicate by that ID first. Only use an asset/detail composite when
     // a genuine work-order ID is unavailable.
     const woKey=assetKey(w.id);
     const hasGovernedId=woKey && woKey!=='—' && woKey!=='-';
     const key=hasGovernedId
       ? 'wo|'+woKey
       : 'fallback|'+assetKey(w.assetId||w.assetTag||w.asset)+'|'+assetKey(w.desc)+'|'+assetKey(w.created);
     if(seen.has(key))return;
     seen.add(key);out.push(w);
   });
   return out;
 }
 function normalizeTelemetry(r){
   return Object.assign({},r,{
     ts:r?.ts??r?.Timestamp??r?.timestamp??'',
     plant:r?.plant??r?.plantId??r?.Plant_ID??'',
     assetId:r?.assetId??r?.asset_id??r?.Asset_ID??r?.asset??'',
     asset:r?.asset??r?.Asset_ID??r?.Asset_Tag??'',
     irradiance:num(r?.irradiance??r?.POA_Irradiance_Wm2??r?.POA_Irradiance??r?.poa,NaN),
     acPower:num(r?.acPower??r?.AC_Power_kW??r?.Actual_AC_Output_kW??r?.actualPower,NaN),
     heatSinkTemp:num(r?.heatSinkTemp??r?.HeatSink_Temp_C??r?.Heatsink_Temperature_C,NaN),
     ambientTemp:num(r?.ambientTemp??r?.Ambient_Temp_C??r?.Ambient_Temperature_C,NaN),
     efficiency:num(r?.efficiency??r?.Efficiency_Pct??r?.Conversion_Efficiency_Pct,NaN),
     signal:r?.signal??r?.Signal_Status??r?.signalStatus??''
   });
 }
 function telemetry(a){
   const matched=axCollectRows(['Telemetry'],['TELEMETRY_LOG']).map(normalizeTelemetry).filter(t=>matchAsset(t,a)||assetKey(t.asset)===assetKey(a.assetId)||assetKey(t.asset)===assetKey(a.tag));
   const byKey=new Map();
   matched.forEach(t=>{const k=assetKey(t.ts)||JSON.stringify([t.irradiance,t.acPower,t.efficiency,t.signal]);const prior=byKey.get(k);const quality=[t.acPower,t.irradiance,t.efficiency].filter(Number.isFinite).length;if(!prior||quality>prior._quality)byKey.set(k,Object.assign({_quality:quality},t));});
   return [...byKey.values()].sort((x,y)=>String(x.ts).localeCompare(String(y.ts))).slice(-24);
 }
 function alertRows(){return axCollectRows(['AI Alerts & RUL','AI Alerts','Predictions','Predictive Maintenance','Risk Queue'],['AI_ALERTS','RISK_QUEUE'])}
 function alertFor(a){return alertRows().find(x=>matchAsset(x,a))||null}
 function actionFor(a){return axCollectRows(['Prescriptive Actions','Prescriptive Maintenance'],['PRESCRIPTIVE_ACTIONS']).find(x=>matchAsset(x,a))||null}
 function visionFor(a){return axCollectRows(['Vision Findings','AI Vision Findings','AI Vision','AI_Vision'],['VISION_FINDINGS']).filter(x=>matchAsset(x,a))}
 function eventsFor(a){return axCollectRows(['Event Log','Event Reconstruction','Event_Log','Events','Root Cause','Root Cause Analysis'],['EVENT_LOG']).filter(x=>matchAsset(x,a))}
 function eventValue(r,keys,fallback='') { for(const k of keys){const v=r?.[k];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v} return fallback }
 function eventTimestamp(r){return eventValue(r,['timestamp','Timestamp','dateTime','Date_Time','event_date_time','Event_Date_Time','eventDate','Event_Date','date','Date','ts','created','Created_Date','creationDate','inspectionDate','Inspection_Date','dueDate','Due_Date'],'')}
 function eventTimeValue(v){if(!v)return 0;const d=new Date(v);if(Number.isFinite(d.getTime()))return d.getTime();const m=String(v).match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);if(m){const y=Number(m[3].length===2?'20'+m[3]:m[3]);return new Date(y,Number(m[2])-1,Number(m[1])).getTime()||0}return 0}
 function eventSeverity(v){const z=String(v||'').trim();if(!z)return 'Information';if(/critical|emergency|trip/i.test(z))return 'Critical';if(/high|major|severe/i.test(z))return 'High';if(/medium|warning|watch|amber/i.test(z))return 'Medium';if(/low|minor/i.test(z))return 'Low';return z}
 function eventStatus(v){const z=String(v||'').trim().toLowerCase();return /resolved|closed|cleared|restored|completed|returned to normal|returned to service|normal operation/.test(z)?'Resolved':'Open'}
 function eventCategory(type,status,source){const z=[type,status,source].join(' ').toLowerCase();if(/resolved|closed|cleared|restored|returned to service/.test(z))return 'Resolved';if(/critical|trip|shutdown|outage|emergency/.test(z))return 'Critical';return 'Operational'}
 function eventSourceGroup(source,type){const s=String(source||'').toLowerCase(),t=String(type||'').toLowerCase();if(/vision|drone|rgb|cctv/.test(s))return 'AI Vision';if(/aip|analytics|condition monitoring|predictive|root cause|model/.test(s))return 'AI Analysis';if(/oem|inverter portal|tracker controller|relay/.test(s))return 'OEM';if(/scada|historian|telemetry|eam|system/.test(s))return 'SCADA';if(/vision|hotspot|image|thermal finding/.test(t))return 'AI Vision';if(/correlat|analy|root cause|predict/.test(t))return 'AI Analysis';return 'SCADA'}
 function eventSourceIcon(group){return group==='SCADA'?'⚡':group==='OEM'?'◈':group==='AI Vision'?'◉':'✦'}
 function eventRevenue(r){const v=eventValue(r,['revenueImpact','Revenue_Impact','revenue','Revenue','Revenue_Impact_INR','Estimated_Revenue_Impact_INR','lossValue','Loss_Value_INR'],'');if(v==='')return '—';if(typeof v==='number')return '₹'+Math.round(v).toLocaleString('en-IN');return String(v)}
 function normalizeEventRecord(r,a,index){
   const type=String(eventValue(r,['type','eventType','Event_Type','event_type','category','Category','sourceType'],'Operational event'));
   const status=eventStatus(eventValue(r,['status','Status','eventStatus','Event_Status','state','State'],'Recorded'));
   const source=String(eventValue(r,['source','Source','sourceSystem','Source_System'],'Operational system'));
   const id=String(eventValue(r,['id','eventId','Event_ID','alertId','Alert_ID','incidentId','Incident_ID'],'EVT-'+String(index+1).padStart(4,'0')));
   return {id,date:eventTimestamp(r),type,severity:eventSeverity(eventValue(r,['severity','Severity','priority','Priority','riskBand','Risk_Band'],'')),alarm:String(eventValue(r,['alarm','alarmCode','Alarm_Code','description','Description','message','Message','event','Event','title','Title','rootCause','Root_Cause'],'Operational event')),status,revenueImpact:eventRevenue(r),category:eventCategory(type,status,source),source,raw:r,_time:eventTimeValue(eventTimestamp(r))};
 }
 function eventIntelligenceFor(a){
   const out=[];
   const direct=eventsFor(a);direct.forEach((r,i)=>out.push(normalizeEventRecord(r,a,i)));
   const alert=alertFor(a);if(alert){const id=eventValue(alert,['Alert_ID','alertId','id'],'AI-'+assetKey(a.assetId).slice(-6).toUpperCase());out.push({id:String(id),date:eventTimestamp(alert),type:'Condition anomaly correlated',severity:eventSeverity(eventValue(alert,['Severity','severity','Risk_Band','riskBand'],a.riskBand)),alarm:String(eventValue(alert,['Failure_Mode','failureMode','Predicted_Failure','predictedFailure','Alert_Type','alertType','Issue','issue'],'Condition risk detected')),status:eventStatus(eventValue(alert,['Status','status','Decision_Status','decisionStatus'],'Open')),revenueImpact:eventRevenue(alert),category:'Operational',source:'AI Analysis',raw:alert,_time:eventTimeValue(eventTimestamp(alert))})}
   visionFor(a).forEach((v,i)=>out.push({id:String(eventValue(v,['Finding_ID','findingId','id'],'VIS-'+String(i+1).padStart(3,'0'))),date:eventTimestamp(v),type:'Visual condition detected',severity:eventSeverity(eventValue(v,['Severity','severity','Risk','risk'],'')),alarm:String(eventValue(v,['Finding','finding','Defect','defect','Issue','issue','Description','description'],'Visual condition finding')),status:eventStatus(eventValue(v,['Status','status'],'Recorded')),revenueImpact:eventRevenue(v),category:'Operational',source:'AI Vision',raw:v,_time:eventTimeValue(eventTimestamp(v))}));
   const seen=new Set(),clean=[];out.forEach(e=>{e.sourceGroup=eventSourceGroup(e.source,e.type);e.category=eventCategory(e.type,e.status,e.source);const key=[assetKey(e.id),e._time,assetKey(e.type),assetKey(e.alarm),assetKey(e.status)].join('|');if(seen.has(key))return;seen.add(key);clean.push(e)});
   clean.sort((x,y)=>(y._time-x._time)||String(y.date).localeCompare(String(x.date))||String(x.id).localeCompare(String(y.id)));
   return clean;
 }
 function matchLegacyWarrantyAsset(row,a){
   if(matchAsset(row,a))return true;
   const legacy=String(row?.Asset_ID??row?.assetId??row?.asset??'').trim().toUpperCase();
   const tag=String(a?.tag??a?.assetTag??'').trim().toUpperCase();
   const aid=String(a?.assetId??'').trim().toUpperCase();
   if(!legacy)return false;
   return tag===legacy||tag.endsWith('-'+legacy)||aid===legacy;
 }
 function warrantyFor(a){return axCollectRows(['Warranty Register'],['WARRANTY_REGISTER']).find(x=>matchLegacyWarrantyAsset(x,a))||null}
 function claimsFor(a){return axCollectRows(['Warranty Claims','Warranty Claim Opportunities','Warranty_Claims'],['WARRANTY_CLAIMS']).filter(x=>matchLegacyWarrantyAsset(x,a))}
 function context(a){
   const alert=alertFor(a),actionObj=actionFor(a),wos=workOrders(a),vision=visionFor(a),events=eventIntelligenceFor(a),warranty=warrantyFor(a),claims=claimsFor(a),tel=telemetry(a);
   let rawRisk=alert?.Failure_Risk_Pct??alert?.Risk_Score??alert?.failureRisk??alert?.riskScore??alert?.risk;
   let sourceRisk=num(rawRisk,Math.max(5,100-num(a.health,75))); if(sourceRisk>0&&sourceRisk<=1)sourceRisk*=100;
   const aligned=alignedConditionMetrics(a,alert||{});
   const fail=Number.isFinite(sourceRisk)?Math.round(Math.max(0,Math.min(99,sourceRisk))):aligned.failureRisk;
   const rawRul=alert?.RUL_Days??alert?.Remaining_Useful_Life_Days??alert?.rulDays??alert?.rul;
   const rul=Math.max(1,Math.round(num(rawRul,aligned.rul)));
   let confidence=num(alert?.Confidence_Pct??alert?.confidencePct??alert?.confidence,NaN);if(confidence>0&&confidence<=1)confidence*=100;if(!Number.isFinite(confidence))confidence=Math.max(55,Math.min(96,58+(alert?12:0)+events.length*2+vision.length*3+wos.length));
   const recommendation=recommendationFor(a,{alert,actionObj,wos,vision,events,warranty,claims,tel,fail,rul,openWO:wos.filter(w=>!/closed|complete|cancel|reject/i.test(String(w.status||''))).length,confidence});
   return {alert,actionObj,wos,vision,events,warranty,claims,tel,fail,rul,confidence,openWO:wos.filter(w=>!/closed|complete|cancel|reject/i.test(String(w.status||''))).length,action:recommendation.action,recommendation};
 }
 const AIP_HEALTH_CACHE=window.AIP_HEALTH_CACHE=window.AIP_HEALTH_CACHE||new Map();
 function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,Number(v)||0))}
 function severityPenalty(v){const z=String(v||'').toLowerCase();return z.includes('critical')?28:z.includes('high')||z.includes('major')?18:z.includes('medium')||z.includes('warning')?9:z.includes('low')||z.includes('minor')?3:0}
 function calculateAssetHealth(a){
   const model=window.AIPHealthModel?.get?.()||AIP_HEALTH_MODEL_DEFAULTS;
   const key=[a.assetId,model.calcRevision||0,window.DATA_MODE||window.ACTIVE_DATA_MODE||'active'].join('|');
   if(AIP_HEALTH_CACHE.has(key))return AIP_HEALTH_CACHE.get(key);
   const fallback=clamp(a.sourceHealth,0,100);
   const tel=telemetry(a), alert=alertFor(a), ev=eventsFor(a), wos=workOrders(a), vis=visionFor(a);
   const latest=tel[tel.length-1]||{};
   const expected=num(latest.expectedPower??latest.expectedAC??latest.expected,0), actual=num(latest.acPower??latest.actualPower,0);
   const perfExplicit=num(a.raw?.performanceScore??a.raw?.performance_condition,NaN);
   const performance=Number.isFinite(perfExplicit)?clamp(perfExplicit):expected>0?clamp(actual/expected*100):clamp(num(latest.efficiency,NaN),0,100)||fallback;
   let electrical=fallback;
   if(tel.length){const hs=num(latest.heatSinkTemp,0),amb=num(latest.ambientTemp,0),delta=Math.max(0,hs-amb);electrical=clamp(100-Math.max(0,delta-22)*1.5-severityPenalty(latest.signal));}
   const activeEvents=ev.filter(x=>!['closed','resolved','cleared'].includes(String(x.status||'').toLowerCase()));
   const alarms=clamp(100-activeEvents.reduce((p,x)=>p+severityPenalty(x.severity),0)-severityPenalty(alert?.severity));
   let risk=num(alert?.riskScore??alert?.risk,NaN);if(Number.isFinite(risk)&&risk<=1)risk*=100;
   const predictive=Number.isFinite(risk)?clamp(100-risk):fallback;
   const open=wos.filter(w=>!['completed','closed','cancelled','rejected'].includes(String(w.status||'').toLowerCase()));
   const maintenance=clamp(100-open.reduce((p,w)=>p+(String(w.priority||'').toLowerCase()==='critical'?22:String(w.priority||'').toLowerCase()==='high'?12:5),0));
   const inspection=clamp(100-vis.reduce((p,v)=>p+severityPenalty(v.severity),0));
   const components={performance,electrical,alarms,predictive,maintenance,inspection};
   const weights=model.weights;let weighted=0,total=0;Object.keys(weights).forEach(k=>{weighted+=clamp(components[k])*Number(weights[k]||0);total+=Number(weights[k]||0)});
   let score=total?weighted/total:fallback;const overrides=[];
   if(model.overrides.criticalAlarm&&(activeEvents.some(x=>String(x.severity||'').toLowerCase()==='critical')||String(alert?.severity||'').toLowerCase()==='critical')){score=Math.min(score,Number(model.thresholds.watch)-1);overrides.push('Critical alarm/event');}
   if(model.overrides.severeThermal&&vis.some(v=>String(v.severity||'').toLowerCase()==='critical'&&/hot|thermal|arc|fire/i.test(String(v.type||v.defectType||v.description||'')))){score=Math.min(score,Number(model.thresholds.watch)-1);overrides.push('Severe thermal/visual finding');}
   if(model.overrides.extendedOutage&&/offline|failed|outage|unavailable/i.test(String(a.status||''))){score=Math.min(score,Number(model.thresholds.watch)-1);overrides.push('Extended outage status');}
   score=Math.round(clamp(score)*10)/10;const band=window.AIPHealthModel.band(score,model);
   const evidenceCount=(tel.length?1:0)+(alert?1:0)+(ev.length?1:0)+(wos.length?1:0)+(vis.length?1:0)+(a.healthKnown?1:0);
   const result={score,band,components,weights,overrides,dataCompleteness:Math.round(evidenceCount/6*100),calculatedAt:new Date().toISOString(),sourceHealth:fallback};
   AIP_HEALTH_CACHE.set(key,result);return result;
 }
 function calculatedSiteHealthMap(){
   const grouped={};
   // Use only the currently active Asset Registry. In Synthetic mode this is the
   // generated synthetic fleet; in Excel mode applyImportedData() replaces it
   // with the workbook Asset Master. This prevents cross-mode mixing.
   arr('ASSET_REGISTRY').forEach(x=>{
     const assetId=x.Asset_ID??x.assetId??x.id??x.asset_id;
     const plant=x.Plant_ID??x.plant??x.plantId??x.plant_id;
     if(!assetId||!plant)return;
     const sourceHealthRaw=x.Health_Score??x.health??x.healthScore;
     const a={
       assetId:String(assetId), plant:String(plant),
       plantName:String(x.Plant_Name??x.plantName??plantName(plant)),
       tag:String(x.Asset_Tag??x.tag??x.assetTag??assetId),
       assetClass:String(x.Asset_Class??x.assetClass??x.cls??x.type??'Asset'),
       description:x.Description??x.description??x.desc??'',
       status:x.Operating_Status??x.status??x.operatingStatus??'Operational',
       sourceHealth:num(sourceHealthRaw,75), health:num(sourceHealthRaw,75),
       healthKnown:(sourceHealthRaw!==undefined&&sourceHealthRaw!==null&&sourceHealthRaw!==''),
       riskBand:x.Risk_Band??x.riskBand??x.risk??'', raw:x
     };
     const result=calculateAssetHealth(a);
     if(!Number.isFinite(Number(result?.score)))return;
     (grouped[String(plant)]||(grouped[String(plant)]=[])).push(Number(result.score));
   });
   const out={};
   Object.entries(grouped).forEach(([site,scores])=>{
     if(scores.length)out[site]=Math.round((scores.reduce((sum,v)=>sum+v,0)/scores.length)*10)/10;
   });
   return out;
 }
 window.AIPGetCalculatedSiteHealthMap=calculatedSiteHealthMap;
 window.calculateAssetHealth=calculateAssetHealth;
 function healthBreakdown(a){const c=a.healthCalculation||calculateAssetHealth(a);const labels={performance:'Performance',electrical:'Electrical / thermal',alarms:'Alarms / events',predictive:'Predictive condition',maintenance:'Maintenance history',inspection:'Inspection / AI Vision'};return `<div class="ax-health-breakdown"><div class="ax-health-breakdown-head"><b>Calculated Health Score ${c.score.toFixed(1)}%</b><span>Data completeness ${c.dataCompleteness}% · ${c.overrides.length?c.overrides.join(', '):'No critical override triggered'}</span></div>${Object.keys(c.components).map(k=>`<div class="ax-health-row"><span>${labels[k]}</span><b>${c.components[k].toFixed(1)}%</b><em>${Number(c.weights[k]).toFixed(0)}% weight</em></div>`).join('')}</div>`}
 function decisionText(records){
   return (records||[]).map(r=>Object.entries(r||{}).map(([k,v])=>`${k}: ${v}`).join(' ')).join(' ').toLowerCase();
 }
 function actionTypeFromText(s){
   s=String(s||'').toLowerCase();
   if(/replace (the )?(complete |entire )?(inverter|asset|assembly)/.test(s))return 'replace';
   if(/replace|repair|restore|correct/.test(s))return 'repair';
   if(/monitor|continue operat/.test(s))return 'monitor';
   return 'minor';
 }
 function buildDecisionTrace(input){
   const clamp100=v=>Math.max(0,Math.min(100,Number(v)||0));
   const defaults={version:'3.0',profile:'Balanced',weights:{technical:45,economic:25,execution:15,evidence:15},technical:{riskReduction:20,functionRestore:15,failureModeCoverage:20,rulImprovement:15,recurrencePrevention:15,consequenceReduction:15},economic:{avoidedGenerationLoss:30,avoidedFailureCost:25,costEfficiency:20,warrantyRecovery:10,lifecycleValue:15},execution:{spares:25,crew:20,leadTime:20,outageWindow:15,oem:10,toolsAccess:10},evidence:{sourceReliability:20,assetLinkage:20,corroboration:20,recency:15,completeness:15,diagnosticConfidence:10},gates:{specificRepairMinEvidence:60,maxResidualSafetyRisk:35,failureWindowBufferDays:3,requireIdentifierConsistency:true}};
   let config=defaults;try{const saved=JSON.parse(localStorage.getItem('aipScenarioRankingActive')||'null');if(saved&&saved.weights)config=Object.assign({},defaults,saved,{weights:Object.assign({},defaults.weights,saved.weights),technical:Object.assign({},defaults.technical,saved.technical),economic:Object.assign({},defaults.economic,saved.economic),execution:Object.assign({},defaults.execution,saved.execution),evidence:Object.assign({},defaults.evidence,saved.evidence),gates:Object.assign({},defaults.gates,saved.gates)});}catch(e){}
   const isInv=/inverter|pcs/.test(String(input.assetClass||'').toLowerCase());
   const records=[...(input.alerts||[]),...(input.workOrders||[]),...(input.events||[]),...(input.vision||[]),...(input.warranty||[])];
   const structured=[...((input.workOrders||[]).map(r=>[r.Failure_Mode,r.failureMode,r.Probable_Root_Cause,r.rootCause,r.Description,r.description].filter(Boolean).join(' '))),...((input.alerts||[]).map(r=>[r.Component,r.component,r.Failure_Mode,r.failureMode,r.Predicted_Failure,r.predictedFailure,r.Evidence_Summary,r.evidenceSummary].filter(Boolean).join(' '))),input.prescribedAction||''].join(' ').toLowerCase();
   const allText=(structured+' '+decisionText(records)).toLowerCase();
   let diagnosis={code:'general_degradation',label:'Asset performance degradation',confidence:Math.max(55,Math.min(92,input.confidence||65)),basis:[]};
   if(isInv&&/power[- ]?stage|igbt|power electronic|switching stage|harmonic|\bthd\b|filter degradation/.test(structured))diagnosis={code:'powerstage',label:'Power-stage or filter degradation',confidence:Math.max(72,Math.min(98,input.confidence||82)),basis:['Explicit component or failure-mode evidence identifies the inverter power stage','Thermal stress alone is not treated as proof of a cooling-fan fault']};
   else if(isInv&&/dc[- ]?link|capacitor|\besr\b|electrolytic/.test(structured))diagnosis={code:'capacitor',label:'DC-link capacitor ageing',confidence:Math.max(70,Math.min(97,input.confidence||80)),basis:['Explicit capacitor or DC-link evidence is linked','The mechanism is localized enough for component-level alternatives']};
   else if(/insulation|earth fault|ground fault|megger|leakage current|cable degradation/.test(structured))diagnosis={code:'insulation',label:'Insulation or cable degradation',confidence:Math.max(68,Math.min(97,input.confidence||78)),basis:['Explicit insulation, earth-fault or cable evidence is linked','Electrical integrity must be confirmed before continued operation']};
   else if(/hotspot|hot spot|connector defect|termination defect|junction defect/.test(structured))diagnosis={code:'hotspot',label:'Thermal hotspot or connection defect',confidence:Math.max(70,Math.min(98,input.confidence||82)),basis:['A localized hotspot or connection defect is explicitly identified','Localized repair is preferred when the defect is confirmed']};
   else if(isInv&&/cooling subsystem|cooling fan|fan speed|fan current|airflow|ventilation|heat sink restriction/.test(structured))diagnosis={code:'cooling',label:'Cooling subsystem degradation',confidence:Math.max(68,Math.min(97,input.confidence||80)),basis:['Explicit fan, airflow or cooling-subsystem evidence is linked','Cooling-specific evidence supports a specific intervention']};
   else if(/grid interface|grid-side|voltage fluctuation|frequency event|utility event|curtailment/.test(structured))diagnosis={code:'grid',label:'Grid-interface instability',confidence:Math.max(62,Math.min(94,input.confidence||74)),basis:['Grid or protection-interface evidence is linked','The asset may not be the primary cause']};
   else diagnosis.basis=[`Health ${Number(input.health||0).toFixed(0)}%, failure risk ${Number(input.risk||0).toFixed(1)}% and RUL ${Number(input.rul||0).toFixed(0)} days establish condition priority`,`No component failure mechanism is established strongly enough for a component-specific repair`];
   const rcm={
    cooling:{policy:'Condition-based maintenance',consequence:'Operational / economic',valid:['minor','repair','monitor','replace'],restricted:{monitor:70},redesign:false},
    capacitor:{policy:'Condition-based replacement',consequence:'Operational / economic',valid:['minor','repair','monitor','replace'],restricted:{monitor:65},redesign:false},
    insulation:{policy:'Condition-based maintenance',consequence:'Safety / operational',valid:['minor','repair','replace'],restricted:{monitor:100},redesign:false},
    hotspot:{policy:'Condition-based maintenance',consequence:'Safety / operational',valid:['minor','repair','replace'],restricted:{monitor:100},redesign:false},
    powerstage:{policy:'Condition-based repair',consequence:'Operational / economic',valid:['minor','repair','monitor','replace'],restricted:{monitor:65},redesign:/repeat|recurr|multiple/.test(allText)},
    grid:{policy:'Failure investigation / coordination',consequence:'Operational',valid:['minor','repair','monitor'],restricted:{replace:100},redesign:false},
    general_degradation:{policy:'Condition assessment',consequence:'Undetermined',valid:['minor','monitor'],restricted:{repair:100,replace:100},redesign:false}
   }[diagnosis.code];
   const prescribed=String(input.prescribedAction||'').trim(), prescribedType=actionTypeFromText(prescribed);
   const actionMap={cooling:[['Perform targeted cooling-path inspection and airflow test','minor'],['Replace defective cooling-fan assembly and verify thermal recovery','repair'],['Continue operating with enhanced thermal monitoring','monitor'],['Replace inverter','replace']],capacitor:[['Perform capacitor diagnostics and ESR test','minor'],['Replace DC-link capacitor bank','repair'],['Continue operating with enhanced monitoring','monitor'],['Replace inverter','replace']],insulation:[['Perform insulation-resistance and cable-integrity testing','minor'],['Repair or replace affected cable and termination','repair'],['Continue operating under controlled monitoring','monitor'],['Replace affected assembly','replace']],hotspot:[['Perform targeted thermography and torque verification','minor'],['Replace hotspot connector or termination','repair'],['Continue operating with enhanced thermal monitoring','monitor'],['Replace affected assembly','replace']],powerstage:[['Perform power-quality, thermography and switching-stage diagnostics','minor'],['Repair or replace the confirmed degraded power-stage component','repair'],['Continue operating with enhanced thermal-electrical monitoring','monitor'],['Replace inverter','replace']],grid:[['Validate grid-interface events and protection settings','minor'],['Correct interface settings or coordinate grid-side action','repair'],['Continue operating with event monitoring','monitor'],['Replace inverter only after confirming an internal asset fault','replace']],general_degradation:[['Perform targeted inspection and diagnostics','minor'],['Repair the confirmed affected component','repair'],['Continue operating with enhanced monitoring','monitor'],[isInv?'Replace inverter':'Replace asset','replace']]};
   let candidates=(actionMap[diagnosis.code]||actionMap.general_degradation).map(x=>[...x]);if(prescribed&&prescribedType!=='minor'&&diagnosis.code!=='general_degradation'){const i=candidates.findIndex(x=>x[1]===prescribedType);if(i>=0)candidates[i][0]=prescribed;}
   const health=Number(input.health||72),risk0=Math.max(0,Math.min(99,Number(input.risk||Math.max(10,100-health)))),rul=Math.max(1,Number(input.rul||120-risk0)),capacity=Math.max(.25,Number(input.capacity||1.25)),tariff=Number(input.tariff||4.5),derating=Math.max(2,Math.min(35,Number(input.derating||Math.max(2,(100-health)*.18))));
   const repairCost=Math.max(50000,Number(input.repairCost||capacity*510000)),replacementCost=Math.max(repairCost*2.5,Number(input.replacementCost||capacity*3100000)),dailyMWh=capacity*5.2,baseLoss=dailyMWh*(derating/100),conf=Number(diagnosis.confidence||70);
   const sourceCount=(input.alerts||[]).length+(input.workOrders||[]).length+(input.events||[]).length+(input.vision||[]).length+(input.warranty||[]).length;
   const sourceKinds=[(input.alerts||[]).length,(input.workOrders||[]).length,(input.events||[]).length,(input.vision||[]).length,(input.warranty||[]).length].filter(Boolean).length;
   const identifierConsistent=!records.some(r=>{const id=String(r.Asset_ID||r.assetId||'').trim(),tag=String(r.Asset_Tag||r.assetTag||r.Asset||'').trim();return id&&tag&&input.assetId&&input.tag&&id!==input.assetId&&tag===input.tag;});
   const evidenceParts={sourceReliability:sourceKinds?Math.min(95,65+sourceKinds*6):50,assetLinkage:identifierConsistent?95:20,corroboration:Math.min(100,35+sourceKinds*15),recency:sourceCount?82:50,completeness:Math.min(100,35+sourceCount*8),diagnosticConfidence:conf};
   const weighted=(parts,weights)=>Object.keys(weights).reduce((s,k)=>s+clamp100(parts[k])*Number(weights[k]||0)/100,0);
   const evidenceScore=weighted(evidenceParts,config.evidence);
   const options=candidates.map(([name,type])=>{
     const riskReduction={minor:15,repair:27,monitor:-8,replace:Math.max(0,risk0-6)},dtMap={minor:isInv?4:3,repair:isInv?8:6,monitor:Math.max(12,risk0*.45),replace:isInv?20:16},costFactor={minor:.34,repair:1,monitor:.24,replace:0};
     const risk=type==='replace'?6:Math.max(5,Math.min(98,risk0-riskReduction[type])),dt=dtMap[type],cost=type==='replace'?replacementCost:(type==='monitor'?180000:repairCost*costFactor[type]);
     const lostMWh=type==='monitor'?baseLoss*30+dailyMWh*(risk/100)*2.4:baseLoss*(dt/8)+dailyMWh*(type==='replace'?dt/8:.04),healthAfter=Math.max(5,Math.min(98,health+(type==='replace'?25:type==='repair'?18:type==='minor'?9:-4))),life=type==='replace'?15:Math.max(.25,type==='monitor'?rul/365:type==='repair'?5:2),total=cost+lostMWh*tariff*1000+risk/100*(capacity*1800000);
     const techParts={riskReduction:clamp100((risk0-risk)*2.2),functionRestore:clamp100(50+(healthAfter-health)*2),failureModeCoverage:diagnosis.code==='general_degradation'?(type==='minor'?90:type==='monitor'?55:20):(type==='repair'?95:type==='minor'?75:type==='replace'?88:45),rulImprovement:clamp100((life*365-rul)/5),recurrencePrevention:type==='replace'?95:type==='repair'?82:type==='minor'?58:25,consequenceReduction:clamp100(100-risk-(type==='monitor'?20:0))};
     const economicParts={avoidedGenerationLoss:clamp100(100-lostMWh/(dailyMWh*6)*100),avoidedFailureCost:clamp100((risk0-risk)*1.8),costEfficiency:clamp100(100-cost/replacementCost*100),warrantyRecovery:(input.warranty||[]).length?75:40,lifecycleValue:clamp100(life/10*100)};
     const execParts={spares:type==='replace'?45:type==='repair'?72:90,crew:type==='replace'?55:type==='repair'?75:92,leadTime:type==='replace'?35:type==='repair'?70:95,outageWindow:type==='replace'?45:type==='repair'?76:94,oem:type==='replace'?60:type==='repair'?75:88,toolsAccess:type==='replace'?55:type==='repair'?78:95};
     const technicalScore=weighted(techParts,config.technical),economicScore=weighted(economicParts,config.economic),executionScore=weighted(execParts,config.execution);
     const gates=[];let eligible=rcm.valid.includes(type);if(!eligible)gates.push('Not permitted by the applicable RCM strategy');
     if((type==='repair'||type==='replace')&&evidenceScore<Number(config.gates.specificRepairMinEvidence)){eligible=false;gates.push(`Evidence confidence ${evidenceScore.toFixed(1)}% is below the ${config.gates.specificRepairMinEvidence}% specific-action threshold`);}
     if(config.gates.requireIdentifierConsistency&&!identifierConsistent){eligible=false;gates.push('Conflicting asset identifiers');}
     if((diagnosis.code==='insulation'||diagnosis.code==='hotspot')&&type==='monitor'){eligible=false;gates.push('Residual safety risk is unacceptable');}
     if(type==='replace'&&diagnosis.code==='grid'){eligible=false;gates.push('Internal asset failure has not been established');}
     if(type==='monitor'&&risk0>(rcm.restricted.monitor||100)){eligible=false;gates.push('Residual risk exceeds the RCM monitoring limit');}
     const decisionScore=clamp100(technicalScore*config.weights.technical/100+economicScore*config.weights.economic/100+executionScore*config.weights.execution/100+evidenceScore*config.weights.evidence/100);
     return {name,type,risk,downtime:dt,lostMWh,cost,total,healthAfter,life,technicalScore,economicScore,executionScore,evidenceScore,decisionScore,eligible,gates,techParts,economicParts,execParts,evidenceParts};
   }).sort((a,b)=>(Number(b.eligible)-Number(a.eligible))||b.decisionScore-a.decisionScore);
   const best=options.find(o=>o.eligible)||options[0];
   return {diagnosis,rcm,config,options,best,recommended:Math.max(0,options.indexOf(best)),rankingBasis:`${config.weights.technical}% Technical Outcome + ${config.weights.economic}% Economic Outcome + ${config.weights.execution}% Execution Readiness + ${config.weights.evidence}% Evidence Confidence`,decisionStatus:'Awaiting enterprise prioritisation and approval',trace:{assetId:input.assetId,tag:input.tag,sourceEvidence:{alerts:(input.alerts||[]).length,workOrders:(input.workOrders||[]).length,events:(input.events||[]).length,vision:(input.vision||[]).length,warranty:(input.warranty||[]).length},identifierConsistent,evidenceScore,structuredEvidence:structured,prescribedAction:prescribed||null,rcmPolicy:rcm.policy,rcmConsequence:rcm.consequence,selectedAction:best.name,selectedType:best.type,score:best.decisionScore,eligible:best.eligible,generatedAt:new Date().toISOString()}};
 }
 window.AIPDecisionTrace={evaluate:buildDecisionTrace,version:'3.0'};
 function recommendationFor(a,ctx){
   const actionObj=ctx.actionObj||{};
   const prescribed=String(actionObj.action||actionObj.recommendedAction||actionObj.Recommended_Action||actionObj.recommendation||'').trim();
   const trace=window.AIPDecisionTrace.evaluate({assetId:a.assetId,tag:a.tag,assetClass:a.assetClass,health:a.health,risk:ctx.fail,rul:ctx.rul,confidence:ctx.confidence,capacity:a.capacity,alerts:ctx.alert?[ctx.alert]:[],workOrders:ctx.wos||[],events:ctx.events||[],vision:ctx.vision||[],warranty:[ctx.warranty,...(ctx.claims||[])].filter(Boolean),prescribedAction:prescribed,repairCost:Number(actionObj.Cost_Now_INR||actionObj.costNow||0)||undefined,replacementCost:Number(a.raw?.Replacement_Cost_INR||0)||undefined});
   const best=trace.best,health=Math.round(Number(a.health||0)),fail=Math.round(Number(ctx.fail||0)),rul=Math.round(Number(ctx.rul||0));
   let urgency='Monitor',windowText='Routine monitoring';
   if(best.type==='replace'||health<55||fail>=70||rul<=14){urgency='Immediate';windowText='Within 24–48 hours'}
   else if(best.type==='repair'||health<70||fail>=45||rul<=30){urgency='High';windowText='Within 7 days'}
   else if(best.type==='minor'){urgency='Planned';windowText='Next planned maintenance window'}
   const evidence=[`Health ${health}%`,`Failure risk ${fail}%`,`RUL ${rul} days`,`${trace.trace.sourceEvidence.workOrders} linked work order${trace.trace.sourceEvidence.workOrders===1?'':'s'}`,`${trace.trace.sourceEvidence.events+trace.trace.sourceEvidence.vision+trace.trace.sourceEvidence.alerts} diagnostic evidence record${trace.trace.sourceEvidence.events+trace.trace.sourceEvidence.vision+trace.trace.sourceEvidence.alerts===1?'':'s'}`];
   a.decisionTrace=trace;
   return {action:best.name,urgency,window:windowText,evidence,confidence:trace.diagnosis.confidence,rule:`${trace.diagnosis.label}; highest calculated score ${best.decisionScore.toFixed(1)}/100`,source:'Governed RCM Recommendation Engine v3.0',trace};
 }
 function related(a){return assets().filter(x=>x.plant===a.plant&&x.assetId!==a.assetId).sort((x,y)=>Math.abs(x.health-a.health)-Math.abs(y.health-a.health)).slice(0,5)}
 function nav(v){const n=document.querySelector('.nav-item[data-view="'+v+'"]');if(n)n.click()}
 function capabilityFor(kind,a,ctx){
   const cls=String(a.assetClass||'').toLowerCase();
   if(kind==='predictive') return {state:ctx.alert?'available':'no-data',count:ctx.alert?1:0,label:ctx.alert?'Available':'No Data',reason:'No prediction or RUL record is linked to this asset in the active dataset.'};
   if(kind==='rootcause') return {state:ctx.events.length?'available':'no-data',count:ctx.events.length,label:ctx.events.length?'Available':'No Data',reason:'No event-log or root-cause evidence is linked to this asset.'};
   if(kind==='workorderintelligence') return {state:ctx.wos.length?'available':'no-data',count:ctx.wos.length,label:ctx.wos.length?'Available':'No Data',reason:'No work order or maintenance record is linked to this asset.'};
   if(kind==='aivision'){
     const applicable=/module|panel|string|tracker|inverter|combiner|transformer|switchgear|battery/.test(cls);
     return {state:!applicable?'not-applicable':ctx.vision.length?'available':'no-data',count:ctx.vision.length,label:!applicable?'Not Applicable':ctx.vision.length?'Available':'No Data',reason:!applicable?'AI Vision is not configured for this asset class in the active demonstration dataset.':'No AI Vision inspection or finding is linked to this asset.'};
   }
   if(kind==='warrantyrecovery'){
     const count=(ctx.warranty?1:0)+ctx.claims.length;
     return {state:count?'available':'no-data',count,label:count?'Available':'No Data',reason:'No warranty coverage or claim record is linked to this asset.'};
   }
   if(kind==='scenariosimulator2'){
     const linkedEvidence=(ctx.alert?1:0)+(ctx.actionObj?1:0)+ctx.wos.length+ctx.events.length+ctx.vision.length+(ctx.warranty?1:0)+ctx.claims.length;
     const calculable=Boolean(a&&a.assetId&&Number.isFinite(Number(a.health)));
     return {state:calculable?'available':'no-data',count:linkedEvidence,label:calculable?(linkedEvidence?'Available':'Generated from health'):'No Data',reason:calculable?'Scenario Analysis is generated dynamically from Asset Master and the calculated Health Score; linked evidence strengthens diagnosis confidence but is not required for initialization.':'Scenario Analysis cannot initialize because the selected asset has no valid master record or calculated Health Score.'};
   }
   return {state:'no-data',count:0,label:'No Data',reason:'No linked record exists.'};
 }
 function showCapabilityNotice(title,a,cap){
   document.querySelector('.ax-context-notice')?.remove();
   const box=document.createElement('div');box.className='ax-context-notice';
   box.innerHTML=`<div class="ax-context-notice-card"><h3>${esc(title)} · ${esc(a.tag)}</h3><p>${cap.state==='not-applicable'?'This capability does not apply to the selected equipment in the active dataset.':'The capability is available, but there is no asset-specific record to display.'}</p><div class="ax-notice-reasons"><b>Selected asset:</b> ${esc(a.tag)} (${esc(a.assetClass)})<br><b>Site:</b> ${esc(a.plantName)}<br><b>Reason:</b> ${esc(cap.reason)}<br><b>Result:</b> No unrelated records have been opened.</div><button type="button">Close</button></div>`;
   document.body.appendChild(box); box.querySelector('button').onclick=()=>box.remove(); box.onclick=e=>{if(e.target===box)box.remove()};
 }
 function assetDrilldownRecord(target,a){
   const ctx=context(a);
   const rows=[];
   const add=(label,value)=>{if(value!==undefined&&value!==null&&String(value).trim()!=='')rows.push(`<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`)};
   if(target==='predictive'){
     const r=ctx.alert||{}; add('Asset',a.tag);add('Failure risk',`${Math.round(num(ctx.fail,0))}%`);add('Remaining useful life',`${Math.round(num(ctx.rul,0))} days`);add('Predicted condition',r.failureMode||r.predictedFailure||r.alertType||r.issue||'Condition risk signal');add('Confidence',`${num(ctx.confidence,82).toFixed(1)}%`);
   }else if(target==='rootcause'){
     const r=ctx.events[0]||{};add('Asset',a.tag);add('Linked events',ctx.events.length);add('Latest event',r.eventType||r.type||r.description||r.message||'Linked operating event');add('Timestamp',r.timestamp||r.date||r.eventDate||'—');add('Root-cause basis',r.rootCause||r.cause||r.failureMode||'Event correlation evidence');
   }else if(target==='workorderintelligence'){
     const r=ctx.wos[0]||{};add('Asset',a.tag);add('Work order',r.id||r.woId||r.workOrderId||'Linked work order');add('Status',r.status||'Open');add('Priority',r.priority||'—');add('Description',r.description||r.desc||r.title||'Maintenance intervention');
   }else if(target==='aivision'){
     const r=ctx.vision[0]||{};add('Asset',a.tag);add('Finding',r.finding||r.defect||r.issue||r.description||'Visual inspection finding');add('Severity',r.severity||r.risk||'—');add('Confidence',r.confidence!==undefined?`${num(r.confidence,0).toFixed(1)}%`:'—');add('Inspection',r.inspectionDate||r.date||r.timestamp||'—');
   }else if(target==='warrantyrecovery'){
     const r=ctx.claims[0]||ctx.warranty||{};add('Asset',a.tag);add('Claim / coverage',r.claimId||r.id||r.warrantyId||'Warranty coverage');add('Status',r.status||r.claimStatus||'Active');add('OEM',r.oem||a.oem||'—');add('Exposure / value',r.value||r.claimValue||r.recoveryValue||'—');
   }else{
     add('Asset',a.tag);add('Scenario status','Available');add('Health',`${Math.round(a.health)}%`);add('Failure risk',`${Math.round(num(ctx.fail,0))}%`);add('Recommended action',ctx.action);add('Decision basis',ctx.recommendation.rule);
   }
   return `<div class="ax-forced-record"><div class="ax-forced-record-title">Selected asset record</div><div class="ax-forced-record-grid">${rows.join('')}</div></div>`;
 }
 function applyAssetContextToView(target,a,cap){
   window.AIP_SELECTED_ASSET_CONTEXT={assetId:a.assetId,tag:a.tag,site:a.plantName,assetClass:a.assetClass,target};
   // Work Orders has its own authoritative focus renderer below. Do not also
   // create the legacy context banner / exact-record overlay, which duplicates
   // the selected inverter at the top of the Work Order screen.
   if(target==='workorderintelligence') return;
   const ctx=context(a);
   const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
   // Strict identifiers only. Never use isolated numeric fragments (for example
   // "1" from INV-001), because that makes unrelated rows look like matches.
   const tokens=[a.assetId,a.tag,a.serialNumber].filter(Boolean).flatMap(v=>{
     const raw=String(v).trim().toLowerCase();
     const n=norm(raw);
     const out=[raw,n];
     // Also allow a meaningful equipment suffix such as INV-001, but only when
     // it includes both letters and digits.
     const parts=raw.split(/[-_\s/]+/).filter(Boolean);
     for(let i=0;i<parts.length-1;i++){
       const pair=parts[i]+'-'+parts[i+1];
       if(/[a-z]/.test(pair)&&/\d/.test(pair)) out.push(pair,norm(pair));
     }
     return [...new Set(out.filter(x=>x&&x.length>=4&&/[a-z]/.test(x)&&/\d/.test(x)))];
   });
   const recordSet=()=>{
     if(target==='predictive') return ctx.alert?[ctx.alert]:[];
     if(target==='rootcause') return ctx.events||[];
     if(target==='workorderintelligence') return ctx.wos||[];
     if(target==='aivision') return ctx.vision||[];
     if(target==='warrantyrecovery') return [...(ctx.claims||[]),...(ctx.warranty?[ctx.warranty]:[])];
     if(target==='scenariosimulator2') return [{Asset_ID:a.tag,Health_Score:a.health,Failure_Risk_Pct:ctx.fail,RUL_Days:ctx.rul,Recommended_Action:ctx.action,Decision_Basis:ctx.recommendation.rule}];
     return [];
   };
   const records=recordSet();
   const fieldsFor=()=>{
     if(target==='predictive') return ['Asset_ID','Asset','Tag','Failure_Mode','Predicted_Failure','Risk_Score','Failure_Risk_Pct','RUL_Days','Confidence_Pct','Alert_Type','Status'];
     if(target==='rootcause') return ['Event_ID','Asset_ID','Asset','Event_Type','Timestamp','Date','Description','Root_Cause','Cause','Severity'];
     if(target==='workorderintelligence') return ['WO_ID','Work_Order_ID','id','Asset_ID','Asset','Description','Status','Priority','Type','Due_Date'];
     if(target==='aivision') return ['Finding_ID','Inspection_ID','Asset_ID','Asset','Finding','Defect','Issue','Severity','Confidence_Pct','Inspection_Date','Status'];
     if(target==='warrantyrecovery') return ['Claim_ID','Warranty_ID','Asset_ID','Asset','OEM','Claim_Status','Status','Claimed_Amount_INR','Approved_Amount_INR','Days_Open','Evidence_Completeness_Pct'];
     return ['Asset_ID','Health_Score','Failure_Risk_Pct','RUL_Days','Recommended_Action','Decision_Basis'];
   };
   const pretty=k=>String(k).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
   const val=(r,k)=>r?.[k] ?? r?.[k.toLowerCase()] ?? r?.[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())];
   const buildPanel=()=>{
     const fields=fieldsFor();
     const usable=fields.filter(k=>records.some(r=>val(r,k)!==undefined&&val(r,k)!==null&&String(val(r,k)).trim()!==''));
     const cols=usable.length?usable:fields.slice(0,6);
     return `<div class="ax-forced-record ax-source-records"><div class="ax-forced-record-title">Exact linked record · ${esc(a.tag)}</div><div class="table-scroll"><table class="xi-table ax-exact-table"><thead><tr>${cols.map(k=>`<th>${esc(pretty(k))}</th>`).join('')}</tr></thead><tbody>${records.map(r=>`<tr class="ax-forced-match">${cols.map(k=>`<td>${esc(val(r,k)??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
   };
   let attempts=0, stable=0;
   const focus=()=>{
     const current=document.getElementById('view-'+target);
     if(!current){if(attempts++<80)setTimeout(focus,100);return}
     current.querySelectorAll('.ax-context-banner,.ax-context-empty,.ax-forced-record,.ax-exact-drill-overlay').forEach(x=>x.remove());
     const banner=document.createElement('div'); banner.className='ax-context-banner';
     banner.innerHTML=`<div class="ax-context-copy"><b>Focused on selected asset:</b> ${esc(a.tag)} · ${esc(a.assetClass)} · ${esc(a.plantName)}</div><button type="button" class="ax-release-focus">Show all records</button>`;
     const head=current.querySelector('.view-head'); if(head)head.insertAdjacentElement('afterend',banner); else current.prepend(banner);
     const holder=document.createElement('div'); holder.className='ax-exact-drill-overlay'; holder.innerHTML=buildPanel(); banner.insertAdjacentElement('afterend',holder);

     // Suppress every unrelated native table row. Match on normalized IDs as well as visible tag text.
     current.querySelectorAll('tbody tr').forEach(r=>{
       if(r.closest('.ax-exact-table')) return;
       const text=r.textContent.toLowerCase(), nt=norm(text);
       const ok=tokens.some(t=>{
         const tn=norm(t);
         if(!tn) return false;
         // Exact normalized identifier match only; no partial numeric matching.
         return nt.includes(tn);
       });
       r.style.setProperty('display',ok?'table-row':'none','important');
       r.classList.toggle('ax-forced-match',ok);
     });
     // Hide native charts/cards that still summarize the full fleet, but retain headers and the exact record panel.
     current.classList.add('ax-asset-filter-active');
     current.querySelectorAll('.ai3-grid,.xi-kpis,.ai3-kpis,.ops-kpis,.vision-kpis,.chart-wrap,.charts-grid').forEach(el=>{ if(!el.closest('.ax-exact-drill-overlay')) el.style.display='none'; });
     const exact=holder.querySelector('.ax-forced-record'); if(exact&&stable===0){exact.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>{exact.classList.add('ax-focus-settled');current.querySelectorAll('tr.ax-forced-match').forEach(r=>r.classList.add('ax-focus-settled'))},3500);}

     // Reapply after asynchronous module rendering settles.
     stable++;
     if(stable<6&&window.AIP_SELECTED_ASSET_CONTEXT)setTimeout(focus,220);
   };
   setTimeout(focus,80);
 }
 function openAssetCapability(target,title,a,ctx){
   const cap=capabilityFor(target,a,ctx);
   if(cap.state!=='available'){showCapabilityNotice(title,a,cap);return}
   window.AIP_SELECTED_ASSET_CONTEXT={assetId:a.assetId,tag:a.tag,site:a.plantName,assetClass:a.assetClass,target};
   nav(target);applyAssetContextToView(target,a,cap);
 }
 function capButton(target,title,a,ctx){const c=capabilityFor(target,a,ctx);return `<button class="ax-capability ${c.state}" data-ax-cap="${target}" data-ax-title="${esc(title)}" aria-label="${esc(title)} — ${esc(c.label)}" title="${esc(c.label)}${c.reason?' · '+esc(c.reason):''}"><span class="ax-cap-label">${esc(title)}</span><small class="ax-cap-state">${esc(c.label)}</small></button>`}

 function conditionSessionAdjustment(a,calc){
   const result={score:calc.score,adjustment:0,completed:[],note:''};
   try{
     const raw=sessionStorage.getItem('aip_demo_session_v2');
     if(!raw)return result;
     const all=JSON.parse(raw||'{}');
     const modeText=((window.APM_DATA_MODE||window.DATA_SOURCE_MODE||window.dataMode||window.currentDataSource||'')+' '+(document.querySelector('.data-source-toggle .active,.source-toggle .active')?.textContent||'')).toLowerCase();
     const mode=/excel|bundled|upload/.test(modeText)?'excel':'synthetic';
     const actions=all?.[mode]?.assets?.[a.assetId]?.actions||{};
     const map={prediction:['Prediction reviewed',1.5],rootcause:['Root cause closed',2],workorder:['Work order approved',3],scenario:['Scenario approved',1],warranty:['Warranty action submitted',0.5],vision:['AI Vision finding accepted',1.5]};
     Object.keys(map).forEach(k=>{if(actions[k]){result.completed.push(map[k][0]);result.adjustment+=map[k][1]}});
     // Workflow completion is treated only as a small mitigation/readiness adjustment.
     // It does not erase the underlying technical evidence or make a critical asset healthy by approval alone.
     result.adjustment=Math.min(6,result.adjustment);
     result.score=Math.round(clamp(calc.score+result.adjustment)*10)/10;
     if(result.completed.length)result.note='A small mitigation adjustment reflects completed governed actions; underlying telemetry and condition evidence remain primary.';
   }catch(e){}
   return result;
 }
 function conditionStatus(a){
   if(!a)return {key:'unknown',label:'No data',detail:'No asset record is available.',calculation:null};
   const calc=calculateAssetHealth(a);
   if(!calc||!Number.isFinite(Number(calc.score))){
     return {key:'unknown',label:'No data',detail:'Insufficient governed evidence is available to calculate Asset Condition.',calculation:null};
   }
   const adjusted=conditionSessionAdjustment(a,calc);
   const model=window.AIPHealthModel?.get?.()||AIP_HEALTH_MODEL_DEFAULTS;
   const key=window.AIPHealthModel?.band?.(adjusted.score,model)||(adjusted.score>=80?'healthy':adjusted.score>=65?'watch':'critical');
   const label=key==='healthy'?'Healthy':key==='watch'?'Watch':'Critical';
   const detail=`Calculated Health Score ${adjusted.score.toFixed(1)}% from performance, electrical/thermal condition, alarms/events, predictive risk, maintenance history and inspection/AI Vision evidence.`;
   return {key,label,detail,calculation:calc,adjustedScore:adjusted.score,sessionAdjustment:adjusted.adjustment,completedActions:adjusted.completed,sessionNote:adjusted.note};
 }
 function conditionBadge(a){
   const s=conditionStatus(a),c=s.calculation;
   const payload=c?encodeURIComponent(JSON.stringify({assetId:a.assetId,assetTag:a.tag||a.assetId,label:s.label,score:s.adjustedScore,baseScore:c.score,band:s.key,components:c.components,weights:c.weights,overrides:c.overrides||[],completeness:c.dataCompleteness,sessionAdjustment:s.sessionAdjustment||0,completedActions:s.completedActions||[],sessionNote:s.sessionNote||'',calculatedAt:c.calculatedAt||new Date().toISOString()})):'';
   const tip=`${s.label} — ${s.detail} Click for the explainable condition assessment.`;
   return `<button type="button" class="ax-condition-badge ${s.key}" data-ax-condition-detail="${payload}" title="Asset Condition: ${esc(s.label)} · ${esc(tip)}" aria-label="Asset Condition: ${esc(s.label)}. Click for calculation details."><i aria-hidden="true"></i><span>${esc(s.label)}</span></button>`;
 }
 function alignedConditionMetrics(a,alert){
   const health=Math.max(0,Math.min(100,Number(a?.health)||0));
   const sourceRisk=Math.max(0,Math.min(99,num(alert?.riskScore??alert?.risk,(100-health)/100)*100));
   const sourceRul=Math.max(1,num(alert?.rulDays??alert?.rul,Math.max(8,health*4.5)));
   const baseRisk=100-health;
   const model=window.AIPHealthModel?.get?.()||AIP_HEALTH_MODEL_DEFAULTS;
   const band=window.AIPHealthModel?.band?.(health,model)||'critical';
   const riskRange=model.riskBands[band]||model.riskBands.critical;
   const rulRange=model.rulBands[band]||model.rulBands.critical;
   let riskMin=riskRange[0],riskMax=riskRange[1],rulMin=rulRange[0],rulMax=rulRange[1];
   const blendedRisk=(baseRisk*0.70)+(sourceRisk*0.30);
   const failureRisk=Math.round(Math.max(riskMin,Math.min(riskMax,blendedRisk)));
   const hHealthy=Number(model.thresholds.healthy),hWatch=Number(model.thresholds.watch); const healthRul=band==='healthy'?rulMin+(health-hHealthy)*Math.max(1,(rulMax-rulMin)/Math.max(1,100-hHealthy)):band==='watch'?rulMin+(health-hWatch)*Math.max(1,(rulMax-rulMin)/Math.max(1,hHealthy-hWatch)):Math.max(rulMin,health/Math.max(1,hWatch)*rulMax);
   const blendedRul=(healthRul*0.70)+(sourceRul*0.30);
   const rul=Math.round(Math.max(rulMin,Math.min(rulMax,blendedRul)));
   const riskBand=failureRisk<=20?'Low':failureRisk<=45?'Medium':'High';
   return {failureRisk,rul,riskBand};
 }
 function badge(v){const z=String(v||'').toLowerCase();const c=z.includes('critical')||z.includes('Overdue Actions')?'critical':z.includes('high')||z.includes('watch')?'high':'low';return `<span class="ax-chip ${c}">${esc(v||'—')}</span>`}
 function empty(msg){return `<div class="ax-empty">${esc(msg)}</div>`}
 function table(headers,rows){return rows.length?`<div class="ax-table-wrap"><table class="ax-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:empty('No linked records are available for this asset in the active dataset.')}

 function assetContextVisual(a){
   const raw=String(a.assetClass||a.cls||a.type||'Asset').toLowerCase();
   const label=esc(a.assetClass||a.cls||a.type||'Asset');
   const tag=esc(a.tag||a.serialNumber||a.assetId||'');
   const site=esc(a.plantName||a.site||a.plant||'');
   let kind='inverter';
   if(/transformer|xfmr/.test(raw)) kind='transformer';
   else if(/combiner|string.*box|scb/.test(raw)) kind='combiner';
   else if(/tracker|actuator/.test(raw)) kind='tracker';
   else if(/weather|met|sensor/.test(raw)) kind='weather';
   else if(/module|panel|string/.test(raw)) kind='module';
   else if(/switchgear|breaker|rmU|ht panel|lt panel/.test(raw)) kind='switchgear';
   else if(/battery|bess|storage/.test(raw)) kind='battery';
   const commonTop=`<text x="24" y="28" class="ax-svg-site">${site}</text><text x="24" y="47" class="ax-svg-title">${label}</text>`;
   const commonBottom=`<rect x="20" y="177" width="320" height="25" rx="7" fill="rgba(16,47,67,.78)"/><text x="30" y="194" class="ax-svg-tag">${tag}</text>`;
   const sun=`<circle cx="322" cy="34" r="17" fill="#ffd56a"/><g stroke="#efb83d" stroke-width="2">${[0,45,90,135].map(d=>`<line x1="322" y1="8" x2="322" y2="1" transform="rotate(${d} 322 34)"/><line x1="322" y1="67" x2="322" y2="60" transform="rotate(${d} 322 34)"/>`).join('')}</g>`;
   let art='';
   if(kind==='transformer') art=`<g transform="translate(106 66)"><rect x="32" y="25" width="104" height="72" rx="10" fill="#345f75"/><rect x="52" y="8" width="15" height="25" rx="3" fill="#9cc6d8"/><rect x="101" y="8" width="15" height="25" rx="3" fill="#9cc6d8"/><circle cx="59" cy="62" r="19" fill="none" stroke="#d8eef6" stroke-width="5"/><circle cx="109" cy="62" r="19" fill="none" stroke="#d8eef6" stroke-width="5"/><line x1="0" y1="62" x2="32" y2="62" stroke="#22a69a" stroke-width="5"/><line x1="136" y1="62" x2="171" y2="62" stroke="#22a69a" stroke-width="5"/></g>`;
   else if(kind==='combiner') art=`<g transform="translate(96 63)"><rect x="55" y="18" width="108" height="94" rx="9" fill="#274f64"/><g stroke="#d8eef6" stroke-width="4">${[0,1,2,3].map(i=>`<line x1="${10+i*18}" y1="${38+i*12}" x2="55" y2="${38+i*12}"/>`).join('')}</g><g fill="#43c6ac">${[0,1,2,3].map(i=>`<circle cx="${10+i*18}" cy="${38+i*12}" r="5"/>`).join('')}</g><rect x="82" y="38" width="54" height="34" rx="4" fill="#d8eef6"/><line x1="109" y1="72" x2="109" y2="112" stroke="#22a69a" stroke-width="5"/></g>`;
   else if(kind==='tracker') art=`<g transform="translate(67 69)"><g transform="skewY(-8)"><rect x="20" y="15" width="210" height="66" fill="#2d6f91" stroke="#173f55" stroke-width="4"/><g stroke="#d8eef6" stroke-width="2">${[1,2,3,4,5].map(i=>`<line x1="${20+i*35}" y1="15" x2="${20+i*35}" y2="81"/>`).join('')}<line x1="20" y1="48" x2="230" y2="48"/></g></g><line x1="125" y1="80" x2="125" y2="125" stroke="#365c6d" stroke-width="7"/><path d="M110 125h30" stroke="#365c6d" stroke-width="7"/><circle cx="125" cy="96" r="9" fill="#f2b84b"/></g>`;
   else if(kind==='weather') art=`<g transform="translate(121 58)"><line x1="70" y1="15" x2="70" y2="118" stroke="#355d70" stroke-width="6"/><line x1="25" y1="118" x2="115" y2="118" stroke="#355d70" stroke-width="6"/><line x1="70" y1="35" x2="108" y2="18" stroke="#355d70" stroke-width="4"/><circle cx="112" cy="16" r="10" fill="#43c6ac"/><line x1="70" y1="55" x2="35" y2="42" stroke="#355d70" stroke-width="4"/><path d="M28 33l14 9-14 9z" fill="#f2b84b"/><g fill="#2d6f91"><circle cx="70" cy="12" r="8"/><circle cx="57" cy="21" r="8"/><circle cx="83" cy="21" r="8"/></g></g>`;
   else if(kind==='module') art=`<g transform="translate(69 72) skewY(-8)"><rect x="10" y="0" width="220" height="82" fill="#2d6f91" stroke="#173f55" stroke-width="4"/><g stroke="#d8eef6" stroke-width="2">${[1,2,3,4,5].map(i=>`<line x1="${10+i*36.7}" y1="0" x2="${10+i*36.7}" y2="82"/>`).join('')}${[1,2].map(i=>`<line x1="10" y1="${i*27.3}" x2="230" y2="${i*27.3}"/>`).join('')}</g></g>`;
   else if(kind==='switchgear') art=`<g transform="translate(110 61)"><rect x="20" y="10" width="140" height="112" rx="8" fill="#345f75"/><g fill="#d8eef6">${[0,1,2].map(i=>`<rect x="${36+i*42}" y="26" width="28" height="50" rx="4"/>`).join('')}</g><g fill="#43c6ac">${[0,1,2].map(i=>`<circle cx="${50+i*42}" cy="94" r="6"/>`).join('')}</g><line x1="0" y1="66" x2="20" y2="66" stroke="#22a69a" stroke-width="5"/><line x1="160" y1="66" x2="185" y2="66" stroke="#22a69a" stroke-width="5"/></g>`;
   else if(kind==='battery') art=`<g transform="translate(105 66)"><rect x="28" y="15" width="135" height="94" rx="9" fill="#345f75"/><g>${[0,1,2].map(i=>`<rect x="${42+i*38}" y="32" width="27" height="58" rx="4" fill="#d8eef6"/><rect x="${50+i*38}" y="25" width="11" height="7" rx="2" fill="#43c6ac"/>`).join('')}</g><path d="M177 48h14v13h12v14h-12v13h-14V75h-12V61h12z" fill="#f2b84b"/></g>`;
   else art=`<g transform="translate(95 64)"><g transform="skewY(-8)"><rect x="0" y="30" width="80" height="55" fill="#2d6f91" stroke="#173f55" stroke-width="3"/><g stroke="#d8eef6" stroke-width="2"><line x1="27" y1="30" x2="27" y2="85"/><line x1="54" y1="30" x2="54" y2="85"/><line x1="0" y1="58" x2="80" y2="58"/></g></g><rect x="108" y="15" width="88" height="95" rx="10" fill="#274f64"/><rect x="127" y="36" width="50" height="29" rx="4" fill="#d8eef6"/><circle cx="152" cy="86" r="10" fill="#43c6ac"/><line x1="80" y1="66" x2="108" y2="66" stroke="#22a69a" stroke-width="5"/><line x1="196" y1="66" x2="225" y2="66" stroke="#22a69a" stroke-width="5"/></g>`;
   return `<div class="ax-context-visual ax-kind-${kind}"><svg viewBox="0 0 360 215" role="img" aria-label="${label} connected asset context">${commonTop}${sun}${art}${commonBottom}</svg></div>`;
 }
 function overviewPane(a,ctx){
   const t=ctx.telemetry; const latest=t[t.length-1]||{};
   const hasOutput=Number.isFinite(Number(latest.acPower)),hasPoa=Number.isFinite(Number(latest.irradiance)),hasEfficiency=Number.isFinite(Number(latest.efficiency));
   const output=hasOutput?`${Number(latest.acPower).toFixed(1)} kW`:'No linked telemetry';
   const freshness=t.length?esc(latest.ts||'Latest record'):'No linked timestamp';
   const operating=String(a.operatingStatus||a.status||latest.signal||'Operating');
   const poa=hasPoa?`${Number(latest.irradiance).toFixed(0)} W/m²`:'No linked telemetry';
   const efficiency=hasEfficiency?`${Number(latest.efficiency).toFixed(2)}%`:'No linked telemetry';
   return `<div class="ax-pane-grid ax-domain-pane ax-domain-overview"><div class="ax-card ax-domain-card ax-operating-state-card" id="axCurrentOperatingState" data-ax-operating-asset="${esc(a.assetId)}"><h3>Current operating state</h3><div class="ax-domain-metrics ax-operating-state-metrics"><div><span>Operating state</span><b>${esc(operating)}</b></div><div><span>Current AC output</span><b>${output}</b></div><div><span>POA irradiance</span><b>${poa}</b></div><div><span>Conversion efficiency</span><b>${efficiency}</b></div><div><span>Telemetry freshness</span><b>${freshness}</b></div><div><span>Signal status</span><b>${esc(latest.signal||'Available')}</b></div></div></div><div class="ax-card ax-relationship-cta ax-domain-card" id="axAssetRelationshipsCard"><h3>Asset relationships</h3><p>Open the selected asset in the relationship graph to inspect its electrical, upstream and downstream dependencies.</p><button type="button" class="ax-relationship-btn aip-ar-hard-nav" data-ax-relationship-asset="${esc(a.assetId)}">Asset Relationships</button></div></div>`
 }
 function healthPane(a,ctx){
   const t=ctx.telemetry;
   const rows=t.slice(-10).reverse().map(x=>`<tr><td>${esc(x.ts||'—')}</td><td>${num(x.irradiance).toFixed(0)}</td><td>${num(x.acPower).toFixed(1)}</td><td>${num(x.heatSinkTemp).toFixed(1)}</td><td>${num(x.ambientTemp).toFixed(1)}</td><td>${num(x.efficiency).toFixed(2)}%</td><td>${esc(x.signal||'—')}</td></tr>`);
   return `<div class="ax-pane-grid ax-domain-pane ax-domain-health ax-health-minimal"><div class="ax-card ax-domain-card ax-health-contributors-only"><h3>Health Score Contributors</h3>${healthBreakdown(a)}<button class="btn primary" data-ax-nav="assethealthmodel" style="width:100%;margin-top:12px">View Asset Health Scoring Framework</button></div></div>`
 }
 function maintenancePane(a,ctx){
   const rows=ctx.wos.slice(0,12).map(w=>`<tr><td>${esc(w.id||'—')}</td><td>${esc(w.type||'—')}</td><td>${esc(w.desc||w.description||'—')}</td><td>${badge(w.priority)}</td><td>${badge(w.status)}</td><td>${esc(w.created||w.createdDate||'—')}</td><td>${esc(w.crew||w.assignedCrew||'—')}</td></tr>`);
   const firstWo=ctx.wos.find(w=>w&&w.id)?.id||'';
   return `<div class="ax-pane-grid ax-domain-pane ax-domain-maintenance ax-maintenance-records-only"><div class="ax-card ax-domain-card"><h3>Asset-specific maintenance records</h3>${table(['Work order','Type','Description','Priority','Status','Created','Crew'],rows)}<button class="btn primary" data-ax-context-nav="workorderintelligence" data-ax-record-id="${esc(firstWo)}" style="width:100%;margin-top:12px">Open Work Order Intelligence</button></div></div>`
 }
 function timeline(a,ctx){
   const records=[];
   ctx.events.forEach(e=>records.push({date:e.date||e.ts||e.eventDate||e.event_date_time||'',title:e.type||e.eventType||'Operational event',sub:`${e.severity||''} ${e.status||''}`.trim()}));
   ctx.vision.forEach(v=>records.push({date:v.inspectionDate||'',title:v.type||v.defectType||'AI Vision finding',sub:`${v.severity||''} · ${v.status||''}`.trim()}));
   ctx.wos.slice(0,3).forEach(w=>records.push({date:w.created||'',title:w.desc||'Maintenance work order',sub:`${w.type||''} · ${w.status||''}`.trim()}));
   if(!records.length)records.push({date:'Current',title:'Asset condition evaluated',sub:'Latest governed condition assessment'},{date:a.lastMaintenance||'History',title:'Maintenance record available',sub:'Open the Maintenance tab for source records'});
   records.sort((x,y)=>String(y.date).localeCompare(String(x.date)));
   return `<div class="ax-timeline">${records.slice(0,7).map(r=>`<div class="ax-event"><i class="ax-event-dot"></i><div><b>${esc(r.title)}</b><span>${esc(r.date||'—')} · ${esc(r.sub||'')}</span></div></div>`).join('')}</div>`
 }
 function eventsPane(a,ctx){
   const events=ctx.events||[];
   const rows=events.map(e=>{const source=e.sourceGroup||eventSourceGroup(e.source,e.type);const status=eventStatus(e.status);return `<tr class="ax-event-row" data-ax-event-id="${esc(e.id)}"><td>${esc(e.date||'—')}</td><td>${esc(e.type||e.alarm||'Operational event')}</td><td><span class="ax-source-badge source-${source.toLowerCase().replace(/[^a-z]+/g,'-')}"><i>${eventSourceIcon(source)}</i>${esc(source)}</span></td><td>${badge(e.severity)}</td><td>${esc(status)}</td></tr>`});
   const critical=events.filter(e=>/critical/i.test(String(e.severity||''))).length;
   const openEvents=events.filter(e=>eventStatus(e.status)==='Open');
   const open=openEvents.length;
   const body=events.length?table(['Time','Event','Source','Severity','Status'],rows):empty(`No linked operational events are available for ${esc(a.tag||a.assetId)}.`);
   return `<div class="ax-pane-grid ax-domain-pane ax-domain-events"><div class="ax-card ax-domain-card"><h3>Alarm and event timeline</h3>${body}</div><div class="ax-card ax-domain-card"><h3>Event profile</h3><div class="ax-domain-metrics"><div><span>Open events</span><b>${open}</b></div><div><span>Critical events</span><b>${critical}</b></div><div><span>Latest event</span><b>${esc(events[0]?.date||'—')}</b></div></div><button class="btn primary" data-ax-nav="rootcause" data-ax-event-context="${esc(events[0]?.id||'')}" style="width:100%;margin-top:12px">Event & Root Cause Intelligence</button></div></div>`
 }
 function aiPane(a,ctx){
   const vrows=ctx.vision.map(v=>`<tr><td>${esc(v.id||'—')}</td><td>${esc(v.type||'—')}</td><td>${badge(v.severity)}</td><td>${num(v.confidence).toFixed(1)}%</td><td>${esc(v.action||'—')}</td></tr>`);
   return `<div class="ax-pane-grid ax-domain-pane ax-domain-ai"><div class="ax-card ax-domain-card"><h3>AI reasoning and recommendation</h3><div class="ax-ai-detail"><div><span>Model confidence</span><b>${ctx.confidence.toFixed(1)}%</b></div><div><span>Decision status</span><b>${esc(ctx.actionObj?.decisionStatus||'Monitor')}</b></div><div><span>Recommendation urgency</span><b>${esc(ctx.recommendation.urgency)}</b></div><div><span>Action window</span><b>${esc(ctx.recommendation.window)}</b></div></div><div class="ax-evidence"><b>Evidence summary</b><p>${esc(ctx.alert?.evidence||ctx.alert?.evidenceSummary||ctx.summary)}</p></div><div class="ax-evidence"><b>Recommendation rationale</b><p>${esc(ctx.actionObj?.rationale||ctx.recommendation.rule||'Intervene when governed evidence confirms condition deterioration and operational impact.')}</p></div><div class="ax-links ax-capability-links">${capButton('predictive','Prediction',a,ctx)}${capButton('rootcause','Root cause',a,ctx)}${capButton('aivision','AI Vision',a,ctx)}${capButton('scenariosimulator2','Scenario',a,ctx)}</div></div><div><div class="ax-card ax-domain-card" style="margin-bottom:14px"><h3>AI Vision evidence</h3>${table(['Finding','Defect','Severity','Confidence','Recommended action'],vrows)}</div><div class="ax-card ax-domain-card"><h3>Peer-signal comparison</h3><div class="ax-related">${related(a).map(x=>`<div class="ax-related-item" data-ax-id="${esc(x.assetId)}" style="cursor:pointer"><div><b>${esc(x.tag)}</b><div>${esc(x.assetClass)} · ${esc(x.oem)}</div></div><span>${Math.round(100-Math.abs(x.health-a.health))}% similar</span></div>`).join('')}</div></div></div></div>`
 }
 function financialPane(a,ctx){
   const action=ctx.actionObj||null;
   const readNum=(obj,keys)=>{for(const k of keys){const v=Number(obj?.[k]);if(Number.isFinite(v))return v}return null};
   const now=readNum(action,['Cost_Now_INR','costNow','cost_now']);
   const deferred=readNum(action,['Cost_If_Deferred_INR','costIfDeferred','cost_if_deferred']);
   const explicitAvoided=readNum(action,['Cost_Avoided_INR','costAvoided','cost_avoided']);
   const avoided=explicitAvoided!==null?explicitAvoided:(now!==null&&deferred!==null?Math.max(0,deferred-now):null);
   const energyLoss=readNum(action,['Energy_Loss_MWh','energyLossMWh','energy_loss_mwh']);
   const hasEconomics=action&&(now!==null||deferred!==null||avoided!==null||energyLoss!==null);
   const money=v=>v===null?'Not available':`₹${Math.round(v).toLocaleString('en-IN')}`;
   const claimRows=ctx.claims.map(c=>`<tr><td>${esc(c.Claim_ID||c.id||c.claimId||'—')}</td><td>${badge(c.Claim_Status||c.status||c.claimStatus)}</td><td>₹${num(c.Claimed_Amount_INR??c.claimedAmount??c.claimed).toLocaleString('en-IN')}</td><td>₹${num(c.Approved_Amount_INR??c.approvedAmount??c.approved).toLocaleString('en-IN')}</td><td>${Math.round(num(c.Days_Open??c.daysOpen))}</td><td>${num(c.Evidence_Completeness_Pct??c.evidence??c.evidenceCompleteness).toFixed(1)}%</td></tr>`);
   const economics=hasEconomics?`<div class="ax-finance-grid"><div><span>Estimated energy loss</span><b>${energyLoss===null?'Not available':energyLoss.toFixed(1)+' MWh'}</b></div><div><span>Cost now</span><b>${money(now)}</b></div><div><span>Cost if deferred</span><b>${money(deferred)}</b></div><div><span>Estimated cost avoided</span><b>${money(avoided)}</b></div></div>${now!==null&&deferred!==null?`<div class="ax-bar"><i style="width:${Math.min(100,Math.max(8,now/deferred*100))}%"></i></div>`:''}<div class="ax-evidence"><b>Decision basis</b><p>${esc(action.Recommendation_ID||action.recommendationId||'Linked recommendation')} compares the recorded intervention cost${now!==null?' of '+money(now):''}${deferred!==null?' with a deferred-cost estimate of '+money(deferred):''}${avoided!==null?', producing a calculated avoided-cost value of '+money(avoided):''}.${action.Rationale||action.rationale?' '+esc(action.Rationale||action.rationale):''}</p></div>`:empty('No exact intervention-economics record is linked to this Asset ID. No fallback financial estimate is being generated.');
   const warranty=ctx.warranty?`<div class="ax-mini-kpis vertical"><div><span>Status</span><b>${esc(ctx.warranty.Current_Status||ctx.warranty.status||ctx.warranty.currentStatus||'—')}</b></div><div><span>Coverage</span><b>${esc(ctx.warranty.Coverage_Type||ctx.warranty.coverage||ctx.warranty.coverageType||'—')}</b></div><div><span>End date</span><b>${esc(ctx.warranty.Warranty_End_Date||ctx.warranty.end||ctx.warranty.endDate||'—')}</b></div><div><span>Remaining value</span><b>₹${num(ctx.warranty.Remaining_Coverage_Value_INR??ctx.warranty.remainingValue??ctx.warranty.remainingCoverage).toLocaleString('en-IN')}</b></div></div>`:empty(`No exact warranty coverage record is linked to ${esc(a.tag||a.assetId)}.`);
   const claims=claimRows.length?table(['Claim','Status','Claimed','Approved','Days open','Evidence'],claimRows):empty(`No warranty claim is linked to ${esc(a.tag||a.assetId)}.`);
   return `<div class="ax-pane-grid ax-domain-pane ax-domain-financial"><div class="ax-card ax-domain-card"><h3>Intervention economics</h3>${economics}</div><div><div class="ax-card ax-domain-card" style="margin-bottom:14px"><h3>Warranty opportunity</h3>${warranty}</div><div class="ax-card ax-domain-card"><h3>Warranty claims</h3>${claims}</div></div></div>`
 }
 function resolveExternalAssetContext(all,pending){
   if(!pending||!Array.isArray(all)||!all.length)return null;
   const k=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
   const idRaw=String(pending.assetId||pending.Asset_ID||pending.sourceAssetId||'').trim();
   const tagRaw=String(pending.assetTag||pending.tag||pending.Asset_Tag||'').trim();
   const wid=k(idRaw),wtag=k(tagRaw);
   // 1. Governed identifiers always win when they are already exact.
   let hit=all.find(x=>(wid&&k(x.assetId)===wid)||(wtag&&k(x.tag)===wtag)||(wid&&k(x.tag)===wid));
   if(hit)return hit;

   // 2. Sustainability uses compact operational aliases (for example
   // SP-05-INV-01) while Asset Explorer uses governed IDs plus zero-padded
   // tags (SP-05-INV-001). Resolve the alias only within the same site and
   // asset class; this prevents a similarly numbered asset at another plant
   // or a TRA transformer/tracker abbreviation from being selected.
   const site=String(pending.plantId||pending.Plant_ID||pending.siteId||'').trim();
   const rawClass=String(pending.assetClass||pending.Asset_Class||'').trim();
   const classKey=v=>{
     const s=String(v||'').toLowerCase();
     if(/inverter/.test(s))return 'inverter';
     if(/transformer/.test(s))return 'transformer';
     if(/tracker/.test(s))return 'tracker';
     if(/weather/.test(s))return 'weather';
     if(/scada/.test(s))return 'scada';
     if(/combiner|string/.test(s))return 'combiner';
     if(/pv|module|array/.test(s))return 'pv';
     return k(v);
   };
   const wantedClass=classKey(rawClass);
   const sourceAlias=idRaw||tagRaw;
   const seqMatch=sourceAlias.match(/(\d+)\s*$/);
   const wantedSeq=seqMatch?Number(seqMatch[1]):null;
   const candidates=all.filter(x=>(!site||k(x.plant)===k(site))&&(!wantedClass||classKey(x.assetClass)===wantedClass));
   if(!candidates.length)return null;
   if(wantedSeq!==null){
     hit=candidates.find(x=>{const m=String(x.tag||'').match(/(\d+)\s*$/);return m&&Number(m[1])===wantedSeq;});
     if(hit)return hit;
   }
   // Never guess across multiple assets. A unique same-site/same-class asset
   // is safe; otherwise leave the context unresolved instead of falling back
   // to SP-01 / INV-001.
   return candidates.length===1?candidates[0]:null;
 }
 function ensureExternalContextAsset(ctx){
   const current=assets();
   const resolved=resolveExternalAssetContext(current,ctx);
   if(resolved)return resolved;
   const plant=String(ctx?.plantId||ctx?.Plant_ID||ctx?.siteId||'').trim();
   const sourceId=String(ctx?.assetId||ctx?.Asset_ID||ctx?.sourceAssetId||'').trim();
   const cls=String(ctx?.assetClass||ctx?.Asset_Class||'Asset').trim()||'Asset';
   if(!plant||!sourceId)return null;
   const bridgeId='SUS-LINK|'+plant+'|'+cls+'|'+sourceId;
   let bridge=axContextBridgeAssets.find(x=>String(x.assetId)===bridgeId);
   if(!bridge){
     bridge={
       assetId:bridgeId,
       plant,
       plantName:plantName(plant),
       tag:sourceId,
       assetClass:cls,
       description:'Sustainability-linked asset context',
       status:'Context linked',
       oem:'—',
       model:'—',
       sourceHealth:0,
       health:0,
       healthKnown:false,
       riskBand:'',
       capacity:0,
       installYear:'',
       lastMaintenance:'',
       contextBridge:true,
       raw:{Asset_ID:sourceId,Plant_ID:plant,Asset_Class:cls,Context_Source:'Sustainability Intelligence'},
       governed:{Asset_ID:sourceId,Plant_ID:plant,Plant_Name:plantName(plant),Asset_Tag:sourceId,Asset_Class:cls,Context_Source:'Sustainability Intelligence'}
     };
     axContextBridgeAssets.push(bridge);
   }
   return bridge;
 }
 function render(preserveFleet){
   preserveFleet=!!preserveFleet;
   const renderGeneration=++axRenderGeneration;
   axOperatingStateTimers.forEach(id=>clearTimeout(id));
   axOperatingStateTimers=[];
   const root=document.getElementById('view-assetexplorer');if(!root)return;
   const all=assets(); if(!all.length){root.innerHTML='<div class="view-head"><div><h1>Asset Explorer</h1></div></div>'+empty('No assets are loaded. Load the synthetic or Excel dataset from Data Management.');return}
   // v87_675 authoritative contextual selection: apply before first-record fallback.
   // External drill context is one-shot. Internal row selection is held in the
   // closure-owned `selected` state and must never reset class filters/search.
   const pending=window.AIP_ASSET_EXPLORER_PENDING_CONTEXT||null;
   if(pending && String(pending.target||'')==='assetexplorer'){
     const exact=ensureExternalContextAsset(pending);
     if(exact){
       selected=exact.assetId;
       selectedSite=exact.plantName||exact.plant||'';
       filter='All';query='';
       window.AIP_ASSET_EXPLORER_SELECTED_ID=exact.assetId;
       window.AIP_ASSET_EXPLORER_CONTEXT_HIGHLIGHT_ID=exact.assetId;
       window.AIP_SELECTED_ASSET_CONTEXT={assetId:exact.assetId,tag:exact.tag,site:exact.plantName||exact.plant||'',siteId:exact.plant||'',plantId:exact.plant||'',assetClass:exact.assetClass,sourceAssetId:String(pending.assetId||pending.Asset_ID||''),source:'Sustainability Intelligence',target:'assetexplorer',contextToken:pending.contextToken||''};
     }else{
       // Preserve an unresolved context explicitly. Do not silently translate
       // it into the first fleet record (the former SP-01 / INV-001 defect).
       window.AIP_ASSET_EXPLORER_UNRESOLVED_CONTEXT={...pending};
     }
     window.AIP_ASSET_EXPLORER_PENDING_CONTEXT=null;
   }
   if(!all.some(x=>x.assetId===selected))selected=all[0].assetId;
   const q=query.trim().toLowerCase();
   const visible=all.filter(x=>(filter==='All'||x.assetClass===filter)&&(!q||[x.tag,x.assetId,x.assetClass,x.plantName,x.plant,x.oem,x.model,x.description].join(' ').toLowerCase().includes(q)));
   const groups={};visible.forEach(x=>(groups[x.plantName||x.plant]??=[]).push(x));
   // Keep the detail pane synchronized with the current site/filter/search result.
   // When a search or filter excludes the prior asset, immediately show the first matching asset.
   if(visible.length && !visible.some(x=>x.assetId===selected)) selected=visible[0].assetId;
   if(selectedSite && groups[selectedSite]?.length && !groups[selectedSite].some(x=>x.assetId===selected)) selected=groups[selectedSite][0].assetId;
   const current=all.find(x=>x.assetId===selected)||visible[0]||all[0];
   if(!selectedSite && current) selectedSite=current.plantName||current.plant||'';
   selected=current.assetId;
   window.AIP_ASSET_EXPLORER_SELECTED_ID=current.assetId;
   window.AIP_SELECTED_ASSET_CONTEXT={...(window.AIP_SELECTED_ASSET_CONTEXT||{}),assetId:current.assetId,tag:current.tag,site:current.plantName||current.plant||'',assetClass:current.assetClass,target:'assetexplorer'};
   const alert=alertFor(current),actionObj=actionFor(current),wos=workOrders(current),tele=telemetry(current),vision=visionFor(current),events=eventIntelligenceFor(current),warranty=warrantyFor(current),claims=claimsFor(current);
   const a=current;
   const aligned=alignedConditionMetrics(a,alert);
   const fail=aligned.failureRisk; const rul=aligned.rul; const confidence=num(alert?.confidence??alert?.confidencePct??actionObj?.confidence,92.5); const openWO=wos.filter(w=>!['completed','closed','cancelled','rejected'].includes(String(w.status||'').toLowerCase())).length;
   const ctx={alert,actionObj,wos,telemetry:tele,vision,events,warranty,claims,fail,rul,confidence,openWO,summary:window.AIPHealthModel.band(a.health)==='critical'?'Condition evidence indicates material deterioration requiring prioritized intervention.':window.AIPHealthModel.band(a.health)==='watch'?'The asset is on condition watch; monitor the risk drivers and prepare an intervention window.':'The asset is operating within its expected envelope with no immediate critical exception.'};
   ctx.recommendation=recommendationFor(a,ctx); ctx.action=ctx.recommendation.action;
   if(!['Overview','Health','Maintenance','Events','Financial'].includes(tab))tab='Overview';
   const pane=tab==='Overview'?overviewPane(a,ctx):tab==='Health'?healthPane(a,ctx):tab==='Maintenance'?maintenancePane(a,ctx):tab==='Events'?eventsPane(a,ctx):financialPane(a,ctx);
   const renderedHtml=`<div class="view-head"><div><div class="eyebrow" style="color:var(--teal)">ASSET-CENTRIC OPERATIONS</div><h1>Asset Explorer</h1></div></div><div class="ax-shell"><aside class="ax-tree"><div class="ax-tree-head"><h3>Solar Fleet</h3><span style="font-size:10px;color:#8fb0bd">${all.length.toLocaleString('en-IN')} assets</span></div><input class="ax-search" id="axSearch" type="search" autocomplete="off" spellcheck="false" aria-label="Search solar park, asset, equipment type, OEM or model" placeholder="Search park, asset, type, OEM or model" value="${esc(query)}" oninput="window.AIPApplySolarFleetSearch && window.AIPApplySolarFleetSearch(this.value,this)" onsearch="window.AIPApplySolarFleetSearch && window.AIPApplySolarFleetSearch(this.value,this)"><div class="ax-filter">${['All',...new Set(all.map(x=>x.assetClass))].map(x=>`<button class="${filter===x?'active':''}" data-ax-filter="${esc(x)}">${esc(x)}</button>`).join('')}</div><div class="ax-condition-legend" aria-label="Asset condition status thresholds"><span>Green ≥${window.AIPHealthModel.get().thresholds.healthy}%</span><span>Amber ${window.AIPHealthModel.get().thresholds.watch}%–${window.AIPHealthModel.get().thresholds.healthy-1}%</span><span>Red &lt;${window.AIPHealthModel.get().thresholds.watch}%</span><span>Grey no data</span></div><div class="ax-condition-note">Active model: ${esc(window.AIPHealthModel.get().profileName)}. Health is the anchor; Failure Risk and RUL use its configured consistency bands.</div><div id="axMatchCount" style="font-size:9.5px;color:#688087;padding:2px 2px 7px">${visible.length.toLocaleString('en-IN')} matching asset${visible.length===1?'':'s'}</div><div class="ax-sites">${Object.entries(groups).map(([g,items])=>`<div class="ax-site ${selectedSite===g?'active':''}"><button type="button" class="ax-site-title" data-ax-site="${esc(g)}" title="Open ${esc(g)} and show its first matching asset">▾ ${esc(g)}</button><div class="ax-assets">${items.map(x=>`<div class="ax-asset ${x.assetId===a.assetId?'active':''} ${String(window.AIP_ASSET_EXPLORER_CONTEXT_HIGHLIGHT_ID||'')===String(x.assetId)?'ax-context-highlight':''}" data-ax-id="${esc(x.assetId)}" data-ax-search="${esc([x.tag,x.assetId,x.assetClass,x.plantName,x.plant,x.oem,x.model,x.description].join(' ').toLowerCase())}">${conditionBadge(x)}<div class="ax-asset-identity"><b>${esc(x.tag)}</b></div></div>`).join('')}</div></div>`).join('')||empty('No assets match the current search and filter.')}</div></aside><main class="ax-main"><section class="ax-hero"><div class="ax-hero-grid"><div><div class="ax-eyebrow">${esc(a.plantName)} · ${esc(a.assetClass)}</div><div class="ax-title">${esc(a.tag)}</div><div class="ax-meta">${esc(a.description)} · ${esc(a.oem)} ${esc(a.model)} · Asset ID ${esc(a.contextBridge?a.governed?.Asset_ID||a.tag:a.assetId)}</div>${a.contextBridge?'<div class="ax-meta" style="margin-top:3px;color:#9a5a00;font-weight:700">Context from Sustainability Intelligence · no governed Asset Explorer condition score available</div>':''}</div><div class="ax-score-card"><div style="position:relative"><div class="ax-ring" style="--p:${a.contextBridge?0:Math.round(a.health)}"></div><div class="ax-ring-label" style="inset:0;display:grid;place-items:center"><div><b>${a.contextBridge?'N/A':Math.round(a.health)+'%'}</b><span>Asset Health Score</span></div></div></div><div class="ax-score-copy"><b>Asset Condition: ${a.contextBridge?'Insufficient Evidence':window.AIPHealthModel.band(a.health)==='healthy'?'Healthy':window.AIPHealthModel.band(a.health)==='watch'?'Watch':'Critical'}</b><div class="ax-score-scale"><i class="critical"><span>0%–${window.AIPHealthModel.get().thresholds.watch-1}%</span><span>Critical</span></i><i class="watch"><span>${window.AIPHealthModel.get().thresholds.watch}%–${window.AIPHealthModel.get().thresholds.healthy-1}%</span><span>Watch</span></i><i class="healthy"><span>${window.AIPHealthModel.get().thresholds.healthy}%–100%</span><span>Healthy</span></i></div></div></div></div></section><div class="ax-kpis"><div class="ax-kpi" style="--ax-level:${a.contextBridge?0:Math.min(100,96.2+a.health/55)}"><span>AVAILABILITY</span><b>${a.contextBridge?'N/A':(96.2+a.health/55).toFixed(1)+'%'}</b><div class="ax-kpi-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div><div class="ax-kpi" style="--ax-level:${a.contextBridge?0:Math.max(12,fail)}"><span>FAILURE RISK</span><b>${a.contextBridge?'N/A':fail+'%'}</b><div class="ax-kpi-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div><div class="ax-kpi" style="--ax-level:${a.contextBridge?0:Math.min(100,Math.max(18,rul/4))}"><span>RUL</span><b>${a.contextBridge?'N/A':rul+' days'}</b><div class="ax-kpi-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div><div class="ax-kpi" style="--ax-level:${Math.min(100,Math.max(18,openWO*18))}"><span>OPEN WORK ORDERS</span><b>${openWO}</b><div class="ax-kpi-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div><div class="ax-kpi" style="--ax-level:${Math.min(100,Math.max(18,vision.length*20))}"><span>VISION FINDINGS</span><b>${vision.length}</b><div class="ax-kpi-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div><div class="ax-kpi" style="--ax-level:${a.contextBridge?0:Math.min(100,Math.max(18,100-a.health))}"><span>REVENUE RISK</span><b>${a.contextBridge?'N/A':'₹'+Math.max(18,Math.round((100-a.health)*4.8))+'k/day'}</b><div class="ax-kpi-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div></div><div class="ax-tabs">${['Overview','Health','Maintenance','Events','Financial'].map(x=>`<button class="ax-tab ${tab===x?'active':''}" data-ax-tab="${x}">${x}</button>`).join('')}</div><div id="axPane">${pane}</div></main></div>`;
   if(preserveFleet && root.querySelector('.ax-tree') && root.querySelector('.ax-main')){
     const mainStart=renderedHtml.indexOf('<main class="ax-main">');
     const mainHtml=mainStart>=0?renderedHtml.slice(mainStart,renderedHtml.lastIndexOf('</main>')+7):'';
     if(mainHtml){
       const holder=document.createElement('div');
       holder.innerHTML=mainHtml;
       const nextMain=holder.firstElementChild;
       const oldMain=root.querySelector('.ax-main');
       if(nextMain&&oldMain)oldMain.replaceWith(nextMain);
       root.querySelectorAll('.ax-asset[data-ax-id]').forEach(row=>row.classList.toggle('active',String(row.dataset.axId)===String(a.assetId)));
       root.querySelectorAll('.ax-site').forEach(site=>{
         const siteName=site.querySelector('[data-ax-site]')?.dataset.axSite||'';
         site.classList.toggle('active',siteName===selectedSite);
       });
     }else root.innerHTML=renderedHtml;
   }else root.innerHTML=renderedHtml;
   // The overview owns exactly one operating-state card and one relationship card.
   // Remove any stale duplicate nodes left by an interrupted legacy render.
   ['axCurrentOperatingState','axAssetRelationshipsCard'].forEach(id=>{
     const nodes=root.querySelectorAll('#'+id);
     nodes.forEach((node,index)=>{if(index>0)node.remove()});
   });

   // v36: First-entry legacy decorators can append duplicate labels/values to
   // the six Current Operating State metric cells. Rebuild the cells from the
   // current asset context at a few bounded paint points; never observe the DOM.
   const normalizeOperatingState=()=>{
     if(renderGeneration!==axRenderGeneration||selected!==a.assetId)return;
     const card=root.querySelector('#axCurrentOperatingState');
     if(!card||card.dataset.axOperatingAsset!==a.assetId)return;
     const grid=card.querySelector('.ax-operating-state-metrics');
     if(!grid)return;
     const latestTele=Array.isArray(ctx.telemetry)&&ctx.telemetry.length?ctx.telemetry[ctx.telemetry.length-1]:null;
     const latest=normalizeTelemetryRow(latestTele);
     const operating=latest.operatingState||((latest.acOutput??0)>0?'Operating':'No linked telemetry');
     const output=latest.acOutput===null||latest.acOutput===undefined?'No linked telemetry':num(latest.acOutput).toLocaleString('en-IN',{maximumFractionDigits:2})+' kW';
     const poa=latest.poa===null||latest.poa===undefined?'No linked telemetry':num(latest.poa).toLocaleString('en-IN',{maximumFractionDigits:2})+' W/m²';
     const efficiency=latest.efficiency===null||latest.efficiency===undefined?'No linked telemetry':num(latest.efficiency).toFixed(2)+'%';
     const freshness=latest.freshness||latest.timestamp||'No linked telemetry';
     const values=[
       ['Operating state',operating],
       ['Current AC output',output],
       ['POA irradiance',poa],
       ['Conversion efficiency',efficiency],
       ['Telemetry freshness',freshness],
       ['Signal status',latest.signal||'Available']
     ];
     grid.innerHTML=values.map(([label,value])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('');
   };
   normalizeOperatingState();
   requestAnimationFrame(()=>{
     if(renderGeneration!==axRenderGeneration)return;
     normalizeOperatingState();
     requestAnimationFrame(()=>{if(renderGeneration===axRenderGeneration)normalizeOperatingState()});
   });
   axOperatingStateTimers.push(setTimeout(normalizeOperatingState,120));
   axOperatingStateTimers.push(setTimeout(normalizeOperatingState,320));
   const searchBox=root.querySelector('#axSearch');
   const matchCount=root.querySelector('#axMatchCount');

   // v66: keep Solar Fleet search passive. Do not force focus, prevent default,
   // or intercept pointer events; those behaviours caused a focus/render loop.
   if(searchBox){
     searchBox.addEventListener('click',e=>e.stopPropagation());
     searchBox.addEventListener('keydown',e=>e.stopPropagation());
   }

   function applySearchInPlace(rawValue,inputEl){
     query=String(rawValue||'');
     const normalise=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
     const tokens=normalise(query).split(/\s+/).filter(Boolean);
     const sourceAssets=assets().filter(x=>filter==='All'||x.assetClass===filter);
     const matching=sourceAssets.filter(x=>{
       const haystack=normalise([
         x.tag,x.assetId,x.assetClass,x.plantName,x.plant,x.oem,x.model,x.description,
         x.raw?.OEM,x.raw?.OEM_Name,x.raw?.Manufacturer,x.raw?.Model,x.raw?.Model_Number,
         x.governed?.OEM,x.governed?.Manufacturer,x.governed?.Model
       ].join(' '));
       return !tokens.length||tokens.every(token=>haystack.includes(token));
     });
     const grouped=matching.reduce((acc,x)=>{
       const site=x.plantName||x.plant||'Unassigned site';
       (acc[site]||(acc[site]=[])).push(x);
       return acc;
     },{});
     const sitesHost=root.querySelector('.ax-sites');
     if(sitesHost){
       sitesHost.innerHTML=Object.entries(grouped).map(([site,items])=>
         `<div class="ax-site ${selectedSite===site?'active':''}">`+
         `<button type="button" class="ax-site-title" data-ax-site="${esc(site)}" title="Open ${esc(site)} and show its first matching asset">▾ ${esc(site)}<span>${items.length}</span></button>`+
         `<div class="ax-assets">${items.map(x=>
           `<div class="ax-asset ${String(x.assetId)===String(selected)?'active':''} ${String(window.AIP_ASSET_EXPLORER_CONTEXT_HIGHLIGHT_ID||'')===String(x.assetId)?'ax-context-highlight':''}" data-ax-id="${esc(x.assetId)}">`+
           `${conditionBadge(x)}<div class="ax-asset-identity"><b>${esc(x.tag)}</b></div></div>`
         ).join('')}</div></div>`
       ).join('') || `<div class="empty" style="padding:14px 8px;color:#b9cbd3">No matching assets</div>`;

       sitesHost.querySelectorAll('[data-ax-site]').forEach(btn=>btn.onclick=e=>{
         e.preventDefault(); e.stopPropagation();
         const site=btn.dataset.axSite||'';
         const first=grouped[site]?.[0];
         if(first) selectAssetExplorerAsset(first.assetId,site);
       });
       sitesHost.querySelectorAll('[data-ax-id]').forEach(row=>row.onclick=e=>{
         e.preventDefault(); e.stopPropagation();
         const site=row.closest('.ax-site')?.querySelector('[data-ax-site]')?.dataset.axSite||'';
         selectAssetExplorerAsset(row.dataset.axId,site);
       });
     }
     const counter=root.querySelector('#axMatchCount');
     if(counter) counter.textContent=matching.length
       ? `${matching.length.toLocaleString('en-IN')} matching asset${matching.length===1?'':'s'}`
       : 'No matching assets';
     const box=inputEl||root.querySelector('#axSearch');
     if(box){
       box.dataset.firstMatch=matching[0]?.assetId||'';
       if(box.value!==query) box.value=query;
     }
     return matching.length;
   }
   window.AIPApplySolarFleetSearch=(value,inputEl)=>applySearchInPlace(value,inputEl);

   // Search filters the existing hierarchy in place. The input element is never
   // destroyed while the user is typing, so it cannot lock or lose keystrokes.
   if(searchBox){
     searchBox.oninput=e=>applySearchInPlace(e.currentTarget.value,e.currentTarget);
     searchBox.onsearch=e=>applySearchInPlace(e.currentTarget.value,e.currentTarget);
   }

   searchBox?.addEventListener('keydown',e=>{
     if(e.key==='Escape'){
       e.preventDefault();
       e.currentTarget.value='';
       applySearchInPlace('');
       return;
     }
     if(e.key==='Enter'){
       e.preventDefault();
       const firstId=e.currentTarget.dataset.firstMatch;
       if(firstId){
         selected=firstId;
         const matched=assets().find(x=>x.assetId===firstId);
         selectedSite=matched?.plantName||matched?.plant||'';
         render();
       }
     }
   });

   // Re-apply the current query after any deliberate render caused by a site,
   // filter, asset or tab selection.
   if(query) applySearchInPlace(query,searchBox);
   root.querySelectorAll('[data-ax-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.axFilter;query='';selectedSite='';render()});
   root.querySelectorAll('[data-ax-site]').forEach(b=>b.onclick=()=>{
     selectedSite=b.dataset.axSite;
     const first=groups[selectedSite]?.[0];
     if(first)selected=first.assetId;
     render();
   });
   // v38: Use one authoritative asset selector. The large standalone page has
   // several delegated/capture click handlers; relying on per-row onclick allowed
   // those handlers to consume the click before Asset Explorer committed the new ID.
   const selectAssetExplorerAsset=(nextId,siteHint)=>{
     nextId=String(nextId||'').trim();
     if(!nextId)return false;
     const nextAsset=assets().find(x=>String(x.assetId)===nextId);
     if(!nextAsset)return false;
     selected=nextAsset.assetId;
     selectedSite=siteHint||nextAsset.plantName||nextAsset.plant||'';
     window.AIP_SELECTED_ASSET_CONTEXT={assetId:nextAsset.assetId,tag:nextAsset.tag,site:nextAsset.plantName||nextAsset.plant||'',assetClass:nextAsset.assetClass,target:'assetexplorer'};
     window.AIP_ASSET_RELATIONSHIP_SOURCE_CONTEXT={assetId:String(nextAsset.assetId||''),tag:String(nextAsset.tag||''),site:String(nextAsset.plantName||nextAsset.plant||''),assetClass:String(nextAsset.assetClass||''),selectionVersion:Date.now()};
     window.AIP_ASSET_EXPLORER_SELECTED_ID=nextAsset.assetId;
     document.querySelectorAll('#view-assetexplorer [data-ax-relationship-asset]').forEach(btn=>btn.dataset.axRelationshipAsset=nextAsset.assetId);
     render(true);
     return true;
   };
   window.AIPSelectAssetExplorerAsset=selectAssetExplorerAsset;
   root.querySelectorAll('[data-ax-id]').forEach(b=>b.onclick=e=>{
     e.preventDefault();
     e.stopPropagation();
     const nextId=b.dataset.axId;
     const siteHint=b.closest('.ax-site')?.querySelector('[data-ax-site]')?.dataset.axSite||'';
     selectAssetExplorerAsset(nextId,siteHint);
   });
   // v629: TAMS switches are pane-only. Keep the selected-asset hero, KPIs and
   // persistent Asset Condition context mounted so tab changes do not flash/repaint it.
   const bindAssetExplorerPaneHandlers=()=>{
     root.querySelectorAll('[data-ax-event-id]').forEach(r=>r.onclick=()=>{root.querySelectorAll('.ax-event-row.selected').forEach(x=>x.classList.remove('selected'));r.classList.add('selected');window.AIP_SELECTED_EVENT_CONTEXT={assetId:a.assetId,assetTag:a.tag,site:a.plantName||a.plant||'',assetClass:a.assetClass,eventId:r.dataset.axEventId||''}});
     root.querySelectorAll('[data-ax-nav]').forEach(b=>b.onclick=()=>{const navCtx={assetId:a.assetId,tag:a.tag,assetTag:a.tag,site:a.plantName||a.plant||'',plant:a.plant||'',assetClass:a.assetClass,oem:a.oem||'',model:a.model||'',recordId:b.dataset.axEventContext||'',eventId:b.dataset.axEventContext||''};window.AIP_SELECTED_EVENT_CONTEXT={...navCtx};window.AIP_CONTEXT_NAV={...navCtx};window.AIP_SELECTED_ASSET_CONTEXT={...(window.AIP_SELECTED_ASSET_CONTEXT||{}),...navCtx};try{sessionStorage.setItem('aip.context.nav',JSON.stringify(navCtx))}catch(_){}nav(b.dataset.axNav)});
     root.querySelectorAll('[data-ax-context-nav]').forEach(b=>b.onclick=()=>{const target=b.dataset.axContextNav;const recordId=b.dataset.axRecordId||'';if(window.AIPAssetDrillGo)window.AIPAssetDrillGo(target,'Asset Explorer · Maintenance',recordId);else openAssetCapability(target,'Work Orders',a,ctx)});
     root.querySelectorAll('[data-ax-cap]').forEach(b=>b.onclick=()=>openAssetCapability(b.dataset.axCap,b.dataset.axTitle,a,ctx));
   };
   root.querySelectorAll('[data-ax-tab]').forEach(b=>b.onclick=()=>{
     const nextTab=b.dataset.axTab;
     if(!['Overview','Health','Maintenance','Events','Financial'].includes(nextTab)||nextTab===tab)return;
     tab=nextTab;
     root.querySelectorAll('[data-ax-tab]').forEach(x=>x.classList.toggle('active',x.dataset.axTab===tab));
     const paneHost=root.querySelector('#axPane');
     if(!paneHost)return;
     paneHost.innerHTML=tab==='Overview'?overviewPane(a,ctx):tab==='Health'?healthPane(a,ctx):tab==='Maintenance'?maintenancePane(a,ctx):tab==='Events'?eventsPane(a,ctx):financialPane(a,ctx);
     bindAssetExplorerPaneHandlers();
     if(tab==='Overview'){
       normalizeOperatingState();
       requestAnimationFrame(()=>{if(renderGeneration===axRenderGeneration)normalizeOperatingState()});
     }
     document.dispatchEvent(new CustomEvent('aip:asset-explorer-rendered',{detail:{assetId:a.assetId,tab:tab,paneOnly:true}}));
   });
   root.querySelectorAll('[data-ax-event-id]').forEach(r=>r.onclick=()=>{root.querySelectorAll('.ax-event-row.selected').forEach(x=>x.classList.remove('selected'));r.classList.add('selected');window.AIP_SELECTED_EVENT_CONTEXT={assetId:a.assetId,assetTag:a.tag,site:a.plantName||a.plant||'',assetClass:a.assetClass,eventId:r.dataset.axEventId||''}});
   root.querySelectorAll('[data-ax-nav]').forEach(b=>b.onclick=()=>{const ctx={assetId:a.assetId,tag:a.tag,assetTag:a.tag,site:a.plantName||a.plant||'',plant:a.plant||'',assetClass:a.assetClass,oem:a.oem||'',model:a.model||'',recordId:b.dataset.axEventContext||'',eventId:b.dataset.axEventContext||''};window.AIP_SELECTED_EVENT_CONTEXT={...ctx};window.AIP_CONTEXT_NAV={...ctx};window.AIP_SELECTED_ASSET_CONTEXT={...(window.AIP_SELECTED_ASSET_CONTEXT||{}),...ctx};try{sessionStorage.setItem('aip.context.nav',JSON.stringify(ctx))}catch(_){}nav(b.dataset.axNav)});
   root.querySelectorAll('[data-ax-context-nav]').forEach(b=>b.onclick=()=>{
     const target=b.dataset.axContextNav;
     const recordId=b.dataset.axRecordId||'';
     if(window.AIPAssetDrillGo)window.AIPAssetDrillGo(target,'Asset Explorer · Maintenance',recordId);
     else openAssetCapability(target,'Work Orders',a,ctx);
   });
   root.querySelectorAll('[data-ax-cap]').forEach(b=>b.onclick=()=>openAssetCapability(b.dataset.axCap,b.dataset.axTitle,a,ctx));
   document.dispatchEvent(new CustomEvent('aip:asset-explorer-rendered',{detail:{assetId:a.assetId,tab:tab}}));
 }
 let axRenderFrame=0;
 function scheduleAssetExplorerRender(){
   AIP_HEALTH_CACHE.clear();
   if(axRenderFrame)cancelAnimationFrame(axRenderFrame);
   axRenderFrame=requestAnimationFrame(()=>{axRenderFrame=0;try{render()}catch(_){}});
 }
 // v42: authoritative public controller for fleet-row and internal-tab interaction.
 // This updates the closure-owned state directly, without depending on per-render onclick handlers.
 document.addEventListener('aip:asset-explorer-rendered',function(e){
   const id=String(e?.detail?.assetId||'');
   const pendingSource=window.AIP_SELECTED_ASSET_CONTEXT?.source;
   if(!id||pendingSource!=='Sustainability Intelligence')return;
   requestAnimationFrame(()=>{
     document.querySelectorAll('#view-assetexplorer .ax-asset.ax-context-highlight').forEach(x=>x.classList.remove('ax-context-highlight'));
     const targetId=String(window.AIP_ASSET_EXPLORER_CONTEXT_HIGHLIGHT_ID||id);
     const row=[...document.querySelectorAll('#view-assetexplorer .ax-asset[data-ax-id]')].find(x=>String(x.dataset.axId)===targetId);
     if(row){row.classList.add('active','ax-context-highlight');try{row.scrollIntoView({block:'nearest',behavior:'auto'})}catch(_){}}
   });
 },false);
 window.AIPAssetExplorerController={
   navigateContext(ctx){
     ctx=ctx||{};
     let all=assets();
     const exact=ensureExternalContextAsset(ctx);
     if(!exact)return false;
     all=assets();
     selected=exact.assetId;
     selectedSite=exact.plantName||exact.plant||'';
     filter='All';
     query='';
     window.AIP_ASSET_EXPLORER_SELECTED_ID=exact.assetId;
     window.AIP_ASSET_EXPLORER_CONTEXT_HIGHLIGHT_ID=exact.assetId;
     window.AIP_ASSET_EXPLORER_PENDING_CONTEXT=null;
     window.AIP_ASSET_EXPLORER_UNRESOLVED_CONTEXT=null;
     window.AIP_SELECTED_ASSET_CONTEXT={
       assetId:exact.assetId,
       tag:exact.tag,
       site:exact.plantName||exact.plant||'',
       siteId:exact.plant||'',
       plantId:exact.plant||'',
       assetClass:exact.assetClass,
       sourceAssetId:String(ctx.assetId||ctx.Asset_ID||ctx.sourceAssetId||''),
       source:'Sustainability Intelligence',
       target:'assetexplorer',
       contextToken:ctx.contextToken||''
     };
     window.AIP_ASSET_RELATIONSHIP_SOURCE_CONTEXT={
       assetId:String(exact.assetId||''),
       tag:String(exact.tag||''),
       site:String(exact.plantName||exact.plant||''),
       assetClass:String(exact.assetClass||''),
       selectionVersion:Date.now()
     };
     render(false);
     return true;
   },
   selectAsset(nextId){
     window.AIP_ASSET_EXPLORER_CONTEXT_HIGHLIGHT_ID=null;
     nextId=String(nextId||'').trim();
     const key=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
     const wanted=key(nextId);
     const ctx=window.AIP_ASSET_EXPLORER_PENDING_CONTEXT||window.AIP_SELECTED_ASSET_CONTEXT||window.AIP_CONTEXT_NAV||{};
     const wantedTag=key(ctx.assetTag||ctx.tag||ctx.Asset_Tag);
     const wantedId=key(ctx.assetId||ctx.Asset_ID);
     let nextAsset=assets().find(x=>key(x.assetId)===wanted || key(x.tag)===wanted);
     // Only use saved navigation context when the caller did not provide a
     // resolvable explicit asset. Never let an older/default context override
     // the row the user actually clicked.
     if(!nextAsset && (wantedId||wantedTag)){
       nextAsset=assets().find(x=>(wantedId&&key(x.assetId)===wantedId)||(wantedTag&&key(x.tag)===wantedTag));
     }
     if(!nextAsset)return false;
     selected=nextAsset.assetId;
     selectedSite=nextAsset.plantName||nextAsset.plant||'';
     window.AIP_ASSET_EXPLORER_SELECTED_ID=nextAsset.assetId;
     document.querySelectorAll('#view-assetexplorer [data-ax-relationship-asset]').forEach(btn=>btn.dataset.axRelationshipAsset=nextAsset.assetId);
     window.AIP_SELECTED_ASSET_CONTEXT={assetId:nextAsset.assetId,tag:nextAsset.tag,site:selectedSite,assetClass:nextAsset.assetClass,target:'assetexplorer'};
     window.AIP_ASSET_RELATIONSHIP_SOURCE_CONTEXT={assetId:String(nextAsset.assetId||''),tag:String(nextAsset.tag||''),site:String(selectedSite||''),assetClass:String(nextAsset.assetClass||''),selectionVersion:Date.now()};
     render(false);
     return true;
   },
   setFilter(nextFilter){
     nextFilter=String(nextFilter||'All');
     const classes=['All',...new Set(assets().map(x=>x.assetClass))];
     if(!classes.includes(nextFilter))return false;
     filter=nextFilter;
     query='';
     selectedSite='';
     const first=assets().find(x=>filter==='All'||x.assetClass===filter);
     if(first){selected=first.assetId;selectedSite=first.plantName||first.plant||'';}
     render(false);
     return true;
   },
   setTab(nextTab){
     nextTab=String(nextTab||'');
     if(!['Overview','Health','Maintenance','Events','Financial'].includes(nextTab))return false;
     if(nextTab===tab)return true;
     tab=nextTab;
     // v631: preserve the Solar Fleet tree DOM on TAMS changes. Rebuild the
     // right-hand Asset Explorer main only, retaining the proven controller/event path.
     render(true);
     return true;
   },
   getState(){const asset=assets().find(x=>String(x.assetId)===String(selected))||null;return {assetId:selected,site:selectedSite,tab,asset,tag:asset?.tag||'',assetClass:asset?.assetClass||'',plantId:asset?.plant||'',plantName:asset?.plantName||selectedSite||'',governed:asset?.governed||asset?.raw||null};}
 };
 window.renderAssetExplorer=render;
 ['aip:data-source-changed','apm:datasource-refreshed','aip:data-rendered'].forEach(name=>document.addEventListener(name,scheduleAssetExplorerRender));
 document.addEventListener('aip:health-model-changed',scheduleAssetExplorerRender);
 document.addEventListener('DOMContentLoaded',()=>{scheduleAssetExplorerRender();setTimeout(()=>{if(window.ALL_SCREEN_HELP_CATALOG)ALL_SCREEN_HELP_CATALOG.assetexplorer={title:'Asset Explorer',purpose:'Provides a data-driven 360° operational view for every asset in the active Asset Master dataset.',use:'Search or browse the full fleet hierarchy, select an asset, switch among the six functional tabs and drill into the source module.',kpis:[{name:'Asset Health Score',formula:'Health_Score from Asset Master.',unit:'score (0–100)',scope:'Selected asset',rules:'Higher is healthier.',meaning:'Composite condition indicator.'},{name:'Failure risk',formula:'Risk_Score from AI Alerts when linked; otherwise derived from health score.',unit:'%',scope:'Selected asset',rules:'Use source AI alert where available.',meaning:'Near-term failure exposure.'},{name:'RUL',formula:'RUL_Days from AI Alerts when linked; otherwise a clearly derived demo estimate.',unit:'days',scope:'Selected asset',rules:'Model estimate, not a guarantee.',meaning:'Expected intervention window.'}],visuals:'Full asset hierarchy, selected-asset hero, six working tabs, contextual KPIs, source-linked tables, timeline, similar assets and drill-down links.',data:'Asset Master, Telemetry, AI Alerts & RUL, Work Orders, Vision Findings, Event Log, Warranty, Claims and Prescriptive Actions.',limits:'Some assets may not have a record in every source sheet; empty states are shown instead of hardcoded records.'};},100)});
})();
