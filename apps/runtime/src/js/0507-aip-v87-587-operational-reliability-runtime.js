
(function(){
function n(v){v=Number(v);return Number.isFinite(v)?v:0}
function e(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(v){return '₹'+(n(v)/100000).toFixed(2)+' lakh'}

function orlNorm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function orlContainsRecord(obj,r){
  const hay=orlNorm(Object.values(obj||{}).join(' '));
  const asset=[r.Asset_Tag,r.Asset_ID].filter(Boolean).map(orlNorm);
  if(asset.some(a=>a&&hay.includes(a)))return true;
  const cls=orlNorm(r.Asset_Class),fm=orlNorm(r.Failure_Mode||r.Incident_Type);
  const fmTokens=fm.split(' ').filter(x=>x.length>4);
  return !!(cls&&hay.includes(cls)&&fmTokens.some(t=>hay.includes(t)));
}
function orlStrategyLink(r){
  const asset=String(r.Asset_Tag||r.Asset_ID||'').trim();if(!asset)return null;
  const eq=v=>String(v||'').trim()===asset;
  try{
    let row=PREVENTIVE_WOS.find(x=>eq(x.asset)||eq(x.Asset_Tag)||eq(x.Asset_ID));
    if(row)return {view:'preventive',label:'Preventive Maintenance',row,key:String(row.id||row.Work_Order_ID||asset),kind:'work-order'};
    row=CORRECTIVE_WOS.find(x=>eq(x.asset)||eq(x.Asset_Tag)||eq(x.Asset_ID));
    if(row)return {view:'corrective',label:'Corrective Maintenance',row,key:String(row.id||row.Work_Order_ID||asset),kind:'work-order'};
    // Predictive screen visibly renders RISK_ASSETS, not the hidden PREDICTIVE_WOS array.
    row=RISK_ASSETS.find(x=>String(x.asset||'').includes(asset));
    if(row)return {view:'predictive',label:'Predictive Maintenance',row,key:String(row.asset||asset),kind:'risk-asset'};
    row=RISK_QUEUE.find(x=>String(x.asset||'').includes(asset));
    if(row)return {view:'riskbased',label:'Risk-Based Maintenance',row,key:String(row.asset||asset),kind:'risk-record'};
    // Adaptive is only contextual when the visible adaptive register contains this exact asset/tag.
    row=ADAPTIVE_ASSETS.find(x=>eq(x.asset)||eq(x.Asset_Tag)||eq(x.Asset_ID));
    if(row)return {view:'adaptive',label:'Adaptive Maintenance',row,key:String(row.asset||row.Asset_Tag||row.Asset_ID),kind:'adaptive-record'};
  }catch(_){}
  return null;
}
function orlLearningLink(r){
  try{
    const rows=ai3Rows('Maintenance Learning')||[];
    return rows.find(x=>String(x.Source_Incident_ID||'')===String(r.Incident_ID))||
           rows.find(x=>orlNorm(x.Asset_Class)===orlNorm(r.Asset_Class)&&orlNorm(x.Failure_Mode)===orlNorm(r.Failure_Mode||r.Incident_Type))||null;
  }catch(_){return null}
}

function orlDismissibleMessage(root,msg){
  if(!root||!msg)return;
  root.querySelectorAll('.orl-context-unavailable').forEach(x=>x.remove());
  const d=document.createElement('div');d.className='orl-context-unavailable';
  d.innerHTML=e(msg)+'<button class="orl-msg-close" title="Close" aria-label="Close message">×</button>';
  d.querySelector('.orl-msg-close').onclick=ev=>{ev.stopPropagation();d.remove()};
  const head=root.querySelector('.xi-head')||root.querySelector('.view-head');
  if(head)head.insertAdjacentElement('afterend',d);else root.prepend(d);
}
function orlContextRecord(id){return (window.__ORL_ATTENTION_ROWS||[]).find(r=>String(r.Incident_ID)===String(id))||null}
function orlBuildContext(r){return r?{source:'Operational Reliability',sourceView:'reliabilityengineering',incidentId:r.Incident_ID,assetId:r.Asset_ID,assetTag:r.Asset_Tag,assetClass:r.Asset_Class,failureMode:r.Failure_Mode||r.Incident_Type,severity:r.Severity,priorityScore:r.Priority_Score,evidenceConfidence:r.Evidence_Confidence_Pct,valueAtStake:r.Value_at_Stake_INR}:null}
function orlStoreReturn(r){
  window.AIP_ORL_ACTION_RETURN={
    view:'reliabilityengineering',
    state:{assetClass:ORL_STATE.assetClass,failureMode:ORL_STATE.failureMode,incident:ORL_STATE.incident},
    context:orlBuildContext(r)
  };
  try{sessionStorage.setItem('aip.orl.action.return',JSON.stringify(window.AIP_ORL_ACTION_RETURN))}catch(_){}
  const b=document.getElementById('aipBackBtn');if(b)b.disabled=false;
}
function orlSetContext(r){
  window.AIP_CONTEXT_NAV=orlBuildContext(r);
  try{sessionStorage.setItem('aip.context.nav',JSON.stringify(window.AIP_CONTEXT_NAV||{}))}catch(_){}
}
function orlOpenView(view){
  try{
    if(typeof window.activate==='function'){window.activate(view,true);return}
    document.querySelector('#sidebar [data-view="'+view+'"]')?.click();
  }catch(_){}
}
function orlContextHTML(r){
  if(!r)return '';
  return '<div class="orl-target-context"><button class="orl-context-close" title="Close context" aria-label="Close context" onclick="event.stopPropagation();this.closest(\'.orl-target-context\').remove()">×</button><div class="orl-ctx-title">Operational Reliability context · source selection</div>'+
    '<b>'+e(r.Incident_ID)+'</b> · <b>'+e(r.Asset_Tag)+'</b> · '+e(r.Asset_Class)+' · '+e(r.Failure_Mode||r.Incident_Type)+
    ' · '+e(r.Severity)+' · Priority '+n(r.Priority_Score).toFixed(0)+'/100</div>';
}
function orlApplyDestinationContext(view,id){
  const r=orlContextRecord(id),root=document.getElementById('view-'+view);
  if(!r||!root)return;
  root.querySelectorAll('.orl-target-context').forEach(x=>x.remove());
  const holder=document.createElement('div');holder.innerHTML=orlContextHTML(r);
  const node=holder.firstElementChild;const lk=window.__MS_LOCK;if(lk&&lk.view===view&&lk.key){node.insertAdjacentHTML('beforeend','<div style="margin-top:4px"><b>Selected target record:</b> '+e(lk.key)+'</div>')}
  const head=root.querySelector('.view-head');
  if(head)head.insertAdjacentElement('afterend',node);else root.prepend(node);

  // Highlight a genuine matching destination record when one exists. Do not fabricate linkage.
  const keys=[r.Asset_Tag,r.Asset_ID,r.Failure_Mode,r.Incident_Type,r.Asset_Class].filter(Boolean).map(x=>String(x).toLowerCase());
  let hit=null;
  root.querySelectorAll('tbody tr,.inv-block,.ai3-panel,.card').forEach(el=>{
    if(hit)return;
    const s=String(el.textContent||'').toLowerCase();
    if(keys.some(k=>k&&s.includes(k)))hit=el;
  });
  if(hit){
    hit.classList.add('orl-context-hit');
    try{hit.scrollIntoView({block:'center',behavior:'auto'})}catch(_){}
  }
}
function orlEnsureRendered(view){
  try{
    if(view==='predictive'&&typeof renderPredictive==='function')renderPredictive();
    else if(view==='maintenancelearning'){const fn=window.renderMaintenanceLearningV856||window.renderMaintenanceLearning;if(typeof fn==='function')fn();}
    else if(view==='eventreconstruction'){
      if(typeof window.renderEventReconstructionForensicsV537==='function')window.renderEventReconstructionForensicsV537();
      else if(window.AIP_V21?.renderers?.eventreconstruction)window.AIP_V21.renderers.eventreconstruction();
    }
  }catch(e){console.error('Operational Reliability destination render failed',view,e)}
}
function openIncident(id){
  if(!id||id==='All')return;
  const r=orlContextRecord(id);if(!r)return;
  orlStoreReturn(r);orlSetContext(r);

  // Lock the requested incident before Event Reconstruction renderer authority runs.
  window.__ER_LOCKED_INCIDENT=id;
  orlEnsureRendered('eventreconstruction');
  orlOpenView('eventreconstruction');

  [20,100,240,500,900].forEach(ms=>setTimeout(()=>{
    try{
      const ok=window.erSelectIncident?.(id);
      if(ok!==false){setTimeout(()=>{try{window.erOpenRegister?.();window.erRenderRegister?.()}catch(_){}},40)}
      const root=document.getElementById('view-eventreconstruction');
      if(!root)return;

      root.querySelectorAll('.orl-target-context').forEach(x=>x.remove());
      const h=document.createElement('div');h.innerHTML=orlContextHTML(r);
      const node=h.firstElementChild;
      const head=root.querySelector('.xi-head')||root.querySelector('.view-head');
      if(head)head.insertAdjacentElement('afterend',node);else root.prepend(node);

      // If the governed incident truly exists, its Incident Register card and title must be active.
      if(ok!==false){
        root.querySelectorAll('.er-inc').forEach(card=>{
          card.classList.toggle('active',String(card.textContent||'').includes(r.Incident_Type) && String(card.textContent||'').includes(r.Asset_Tag));
        });
      }else{
        node.insertAdjacentHTML('beforeend','<div class="orl-context-unavailable orl-context-unavailable-inline">No forensic reconstruction record exists for this incident in the active data source.</div>');
      }
    }catch(_){}
  },ms));
}
function orlSetMaintenanceLock(link,r){window.__MS_LOCK={view:link.view,key:String(link.key||''),incidentId:r.Incident_ID,assetTag:r.Asset_Tag||r.Asset_ID};}
function orlFocusLocked(view){setTimeout(()=>{const root=document.getElementById('view-'+view),hit=root?.querySelector('.orl-exact-target');if(hit){try{hit.scrollIntoView({block:'center',behavior:'auto'})}catch(_){}}},30)}

function orlMaintenanceUnavailable(view,r){
  const root=document.getElementById('view-'+view);if(!root)return;
  root.querySelectorAll('.orl-ms-unavailable').forEach(x=>x.remove());
  const d=document.createElement('div');d.className='orl-ms-unavailable';
  d.innerHTML='<button class="orl-ms-close" title="Close" aria-label="Close message">×</button><b>Selected Reliability record is not available on this Maintenance Strategy tab.</b> The normal Maintenance Strategy page remains available below.';
  d.querySelector('.orl-ms-close').onclick=ev=>{ev.stopPropagation();d.remove()};
  const head=root.querySelector('.view-head');
  if(head)head.insertAdjacentElement('afterend',d);else root.prepend(d);
}
function orlEnsureStrategyContent(view){
  const root=document.getElementById('view-'+view);if(!root)return false;
  const hasContent=!!(root.querySelector('.view-head')&&(root.querySelector('canvas')||root.querySelector('table')||root.querySelector('.card')));
  if(hasContent)return true;
  try{
    if(view==='preventive')renderPreventive();
    else if(view==='predictive')renderPredictive();
    else if(view==='corrective')renderCorrective();
    else if(view==='adaptive')renderAdaptive();
    else if(view==='riskbased')renderRiskBased();
    return true;
  }catch(e){console.error('Maintenance Strategy recovery render failed',view,e);return false}
}
function openMaintenanceStrategy(id){
  if(!id||id==='All')return;
  const r=orlContextRecord(id);if(!r)return;
  const link=orlStrategyLink(r);if(!link)return;
  orlStoreReturn(r);orlSetContext(r);orlSetMaintenanceLock(link,r);

  // One navigation + one stable render only. Do not repeatedly rebuild canvases.
  orlOpenView(link.view);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    try{
      orlEnsureStrategyContent(link.view);
      orlApplyDestinationContext(link.view,id);
      setTimeout(()=>{
        const root=document.getElementById('view-'+link.view);
        const hit=root?.querySelector('.orl-exact-target');
        if(hit){
          root.querySelectorAll('.orl-ms-unavailable').forEach(x=>x.remove());
          orlFocusLocked(link.view);
        }else{
          orlMaintenanceUnavailable(link.view,r);
        }
      },90);
    }catch(err){
      console.error('Operational Reliability maintenance route error',err);
      orlEnsureStrategyContent(link.view);
      orlMaintenanceUnavailable(link.view,r);
    }
  }));
}
function openLearning(id){
  if(!id||id==='All')return;
  const r=orlContextRecord(id);if(!r)return;
  const link=orlLearningLink(r);if(!link)return;
  orlStoreReturn(r);orlSetContext(r);
  window.__ML_LOCKED_INCIDENT=id;
  orlOpenView('maintenancelearning');
  [80,220,500].forEach(ms=>setTimeout(()=>{
    try{renderMaintenanceLearning();orlApplyDestinationContext('maintenancelearning',id)}catch(_){}
  },ms));
}
function orlRestoreFromAction(){
  window.__ER_LOCKED_INCIDENT=null;window.__ML_LOCKED_INCIDENT=null;window.__MS_LOCK=null;
  let ret=window.AIP_ORL_ACTION_RETURN;
  if(!ret){try{ret=JSON.parse(sessionStorage.getItem('aip.orl.action.return')||'null')}catch(_){}}
  if(!ret)return false;
  window.AIP_ORL_ACTION_RETURN=null;
  try{sessionStorage.removeItem('aip.orl.action.return')}catch(_){}
  const st=ret.state||{};
  ORL_STATE.assetClass=st.assetClass||'All';
  ORL_STATE.failureMode=st.failureMode||'All';
  ORL_STATE.incident=st.incident||'All';
  orlOpenView('reliabilityengineering');
  [0,80,220].forEach(ms=>setTimeout(()=>{
    try{
      renderOperationalReliability();
      if(ret.context?.incidentId&&ORL_STATE.incident==='All')ORL_STATE.incident=ret.context.incidentId;
    }catch(_){}
  },ms));
  return true;
}
window.orlOpenIncident=openIncident;
window.orlOpenMaintenanceStrategy=openMaintenanceStrategy;
window.orlOpenLearning=openLearning;
window.orlRestoreFromAction=orlRestoreFromAction;
function tipEl(){let t=document.getElementById('orlRichTip');if(!t){t=document.createElement('div');t.id='orlRichTip';document.body.appendChild(t)}return t} window.__orlTipPinned=false;
window.orlShowTip=function(ev,id){if(window.__orlTipPinned)return;const r=orlContextRecord(id);if(!r)return;const t=tipEl(),sev=String(r.Severity||'');t.classList.remove('orl-pinned');t.innerHTML='<div class="rt-title">'+e(r.Incident_ID)+' · <span class="rt-asset">'+e(r.Asset_Tag)+'</span></div><div class="rt-grid"><span class="rt-label">Failure / incident</span><span>'+e(r.Incident_Type)+'</span><span class="rt-label">Priority</span><span class="rt-priority">'+n(r.Priority_Score).toFixed(0)+'/100</span><span class="rt-label">Evidence</span><span class="rt-evidence">'+n(r.Evidence_Confidence_Pct).toFixed(2)+'%</span><span class="rt-label">Value at stake</span><span class="rt-value">'+money(r.Value_at_Stake_INR)+'</span><span class="rt-label">Energy at risk</span><span class="rt-energy">'+n(r.Energy_at_Risk_MWh).toFixed(2)+' MWh</span><span class="rt-label">Severity</span><span class="'+(sev==='Critical'?'rt-critical':'rt-high')+'">'+e(sev)+'</span></div>';t.style.display='block';window.orlMoveTip(ev)}
window.orlMoveTip=function(ev){const t=tipEl();let x=ev.clientX+16,y=ev.clientY+16;if(x+t.offsetWidth>innerWidth-10)x=ev.clientX-t.offsetWidth-16;if(y+t.offsetHeight>innerHeight-10)y=ev.clientY-t.offsetHeight-16;t.style.left=x+'px';t.style.top=y+'px'}
window.orlHideTip=function(){if(window.__orlTipPinned)return;const t=document.getElementById('orlRichTip');if(t)t.style.display='none'}
window.orlClosePinnedTip=function(ev){try{ev?.stopPropagation?.()}catch(_){}window.__orlTipPinned=false;const t=document.getElementById('orlRichTip');if(t){t.classList.remove('orl-pinned');t.style.display='none'}}
window.orlPinTip=function(ev,id){try{ev?.stopPropagation?.()}catch(_){}const r=orlContextRecord(id);if(!r)return;window.__orlTipPinned=true;const t=tipEl(),sev=String(r.Severity||'');t.classList.add('orl-pinned');t.innerHTML='<button class="rt-close" aria-label="Close details" title="Close" onclick="orlClosePinnedTip(event)">×</button><div class="rt-title">'+e(r.Incident_ID)+' · <span class="rt-asset">'+e(r.Asset_Tag)+'</span></div><div class="rt-grid"><span class="rt-label">Failure / incident</span><span>'+e(r.Incident_Type)+'</span><span class="rt-label">Priority</span><span class="rt-priority">'+n(r.Priority_Score).toFixed(0)+'/100</span><span class="rt-label">Evidence</span><span class="rt-evidence">'+n(r.Evidence_Confidence_Pct).toFixed(2)+'%</span><span class="rt-label">Value at stake</span><span class="rt-value">'+money(r.Value_at_Stake_INR)+'</span><span class="rt-label">Energy at risk</span><span class="rt-energy">'+n(r.Energy_at_Risk_MWh).toFixed(2)+' MWh</span><span class="rt-label">Severity</span><span class="'+(sev==='Critical'?'rt-critical':'rt-high')+'">'+e(sev)+'</span></div>';t.style.display='block';window.orlMoveTip(ev)}
window.orlOpenIncident=openIncident;window.orlOpenMaintenanceStrategy=openMaintenanceStrategy;window.orlOpenLearning=openLearning;
const ORL_V589_EXCEL=[{"Reliability_ID":"REL-001","Record_Type":"Asset Class","Asset_Class":"Inverter","Period":"Rolling 12M","MTBF_Hours":4751.99,"MTTR_Hours":3.91,"Reliability_Pct":94.21,"Technical_Availability_Pct":94.4,"Criticality":"Critical","Trend_Status":"Excel Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Work Orders","Source_Record_ID":null,"Calculation_Basis":"Operating hours ÷ corrective failure count; repair hours ÷ corrective count"},{"Reliability_ID":"REL-002","Record_Type":"Asset Class","Asset_Class":"Transformer","Period":"Rolling 12M","MTBF_Hours":7377.68,"MTTR_Hours":8.67,"Reliability_Pct":95.18,"Technical_Availability_Pct":100,"Criticality":"Critical","Trend_Status":"Excel Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Work Orders","Source_Record_ID":null,"Calculation_Basis":"Operating hours ÷ corrective failure count; repair hours ÷ corrective count"},{"Reliability_ID":"REL-003","Record_Type":"Asset Class","Asset_Class":"Tracker","Period":"Rolling 12M","MTBF_Hours":3344.81,"MTTR_Hours":3.29,"Reliability_Pct":96.37,"Technical_Availability_Pct":100,"Criticality":"High","Trend_Status":"Excel Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Work Orders","Source_Record_ID":null,"Calculation_Basis":"Operating hours ÷ corrective failure count; repair hours ÷ corrective count"},{"Reliability_ID":"REL-004","Record_Type":"Asset Class","Asset_Class":"String/Combiner","Period":"Rolling 12M","MTBF_Hours":5904.28,"MTTR_Hours":3.16,"Reliability_Pct":100,"Technical_Availability_Pct":93.68,"Criticality":"High","Trend_Status":"Excel Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Work Orders","Source_Record_ID":null,"Calculation_Basis":"Operating hours ÷ corrective failure count; repair hours ÷ corrective count"},{"Reliability_ID":"REL-005","Record_Type":"Asset Class","Asset_Class":"Module","Period":"Rolling 12M","MTBF_Hours":12506.57,"MTTR_Hours":1.99,"Reliability_Pct":99.63,"Technical_Availability_Pct":100,"Criticality":"Medium","Trend_Status":"Excel Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Vision Findings","Source_Record_ID":null,"Calculation_Basis":"Operating hours ÷ confirmed functional failure count"},{"Reliability_ID":"REL-006","Record_Type":"Asset Class","Asset_Class":"Weather Station","Period":"Rolling 12M","MTBF_Hours":8175.36,"MTTR_Hours":2.87,"Reliability_Pct":98.92,"Technical_Availability_Pct":100,"Criticality":"Medium","Trend_Status":"Excel Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Work Orders","Source_Record_ID":null,"Calculation_Basis":"Operating hours ÷ corrective failure count"},{"Reliability_ID":"REL-F01","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"Cooling fan degradation","Failure_Share_Pct":25.37,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Root Cause Analysis","Source_Record_ID":null,"Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-F02","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"IGBT thermal stress","Failure_Share_Pct":18.53,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Root Cause Analysis","Source_Record_ID":null,"Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-F03","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"Tracker drive fault","Failure_Share_Pct":15.55,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Root Cause Analysis","Source_Record_ID":null,"Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-F04","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"String open circuit","Failure_Share_Pct":14.41,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Root Cause Analysis","Source_Record_ID":null,"Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-F05","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"Other","Failure_Share_Pct":26.14,"Reliability_Index_Points":null,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Root Cause Analysis","Source_Record_ID":null,"Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-T01","Record_Type":"Growth Trend","Asset_Class":null,"Period":"Q3 FY25","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":85.25,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Maintenance Outcomes","Source_Record_ID":null,"Calculation_Basis":"Indexed MTBF improvement, MTTR reduction and repeat-failure reduction"},{"Reliability_ID":"REL-T02","Record_Type":"Growth Trend","Asset_Class":null,"Period":"Q4 FY25","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":89.25,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Maintenance Outcomes","Source_Record_ID":null,"Calculation_Basis":"Indexed MTBF improvement, MTTR reduction and repeat-failure reduction"},{"Reliability_ID":"REL-T03","Record_Type":"Growth Trend","Asset_Class":null,"Period":"Q1 FY26","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":94.25,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Maintenance Outcomes","Source_Record_ID":null,"Calculation_Basis":"Indexed MTBF improvement, MTTR reduction and repeat-failure reduction"},{"Reliability_ID":"REL-T04","Record_Type":"Growth Trend","Asset_Class":null,"Period":"Q2 FY26","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":99.25,"Incident_ID":null,"Plant_ID":null,"Plant_Name":null,"Asset_ID":null,"Asset_Tag":null,"Incident_Type":null,"Severity":null,"Priority_Score":null,"Evidence_Confidence_Pct":null,"Value_at_Stake_INR":null,"Energy_at_Risk_MWh":null,"Source_Sheet":"Maintenance Outcomes","Source_Record_ID":null,"Calculation_Basis":"Indexed MTBF improvement, MTTR reduction and repeat-failure reduction"},{"Reliability_ID":"REL-A01","Record_Type":"Reliability Attention","Asset_Class":"Inverter","Period":"Current qualified incident","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":"Critical","Trend_Status":"Attention","Failure_Mode":"Thermal degradation intervention","Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":"XINC-001","Plant_ID":"SP-01","Plant_Name":"Suryanagar Solar Park","Asset_ID":"AST-00001","Asset_Tag":"SP-01-INV-001","Incident_Type":"Thermal degradation intervention","Severity":"Critical","Priority_Score":89,"Evidence_Confidence_Pct":72,"Value_at_Stake_INR":2246200,"Energy_at_Risk_MWh":null,"Source_Sheet":"Event Reconstruction Incidents","Source_Record_ID":"XINC-001","Calculation_Basis":"Governed incident record used for reliability attention visualization"},{"Reliability_ID":"REL-A02","Record_Type":"Reliability Attention","Asset_Class":"Inverter","Period":"Current qualified incident","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":"High","Trend_Status":"Attention","Failure_Mode":"Predictive inverter intervention","Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":"XINC-002","Plant_ID":"SP-02","Plant_Name":"Kalyanpura SPV","Asset_ID":"AST-00048","Asset_Tag":"SP-02-INV-002","Incident_Type":"Predictive inverter intervention","Severity":"High","Priority_Score":80,"Evidence_Confidence_Pct":86,"Value_at_Stake_INR":265046,"Energy_at_Risk_MWh":65.85,"Source_Sheet":"Event Reconstruction Incidents","Source_Record_ID":"XINC-002","Calculation_Basis":"Governed incident record used for reliability attention visualization"},{"Reliability_ID":"REL-A03","Record_Type":"Reliability Attention","Asset_Class":"Inverter","Period":"Current qualified incident","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":"Critical","Trend_Status":"Attention","Failure_Mode":"High-risk inverter intervention","Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":"XINC-003","Plant_ID":"SP-06","Plant_Name":"Solapur Plains SPV","Asset_ID":"AST-00231","Asset_Tag":"SP-06-INV-001","Incident_Type":"High-risk inverter intervention","Severity":"Critical","Priority_Score":83,"Evidence_Confidence_Pct":90,"Value_at_Stake_INR":247538,"Energy_at_Risk_MWh":61.5,"Source_Sheet":"Event Reconstruction Incidents","Source_Record_ID":"XINC-003","Calculation_Basis":"Governed incident record used for reliability attention visualization"},{"Reliability_ID":"REL-A04","Record_Type":"Reliability Attention","Asset_Class":"String/Combiner","Period":"Current qualified incident","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":"High","Trend_Status":"Attention","Failure_Mode":"SCB protection intervention","Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":"XINC-004","Plant_ID":"SP-09","Plant_Name":"Bathinda Solar Belt","Asset_ID":"AST-00409","Asset_Tag":"SP-09-SCB-003","Incident_Type":"SCB protection intervention","Severity":"High","Priority_Score":78,"Evidence_Confidence_Pct":87,"Value_at_Stake_INR":381592,"Energy_at_Risk_MWh":91.95,"Source_Sheet":"Event Reconstruction Incidents","Source_Record_ID":"XINC-004","Calculation_Basis":"Governed incident record used for reliability attention visualization"},{"Reliability_ID":"REL-A05","Record_Type":"Reliability Attention","Asset_Class":"Transformer","Period":"Current qualified incident","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":"High","Trend_Status":"Attention","Failure_Mode":"Transformer defect response","Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":"XINC-005","Plant_ID":"SP-07","Plant_Name":"Anantapur Sun Fields","Asset_ID":"AST-00296","Asset_Tag":"SP-07-TRF-002","Incident_Type":"Transformer defect response","Severity":"High","Priority_Score":77,"Evidence_Confidence_Pct":87,"Value_at_Stake_INR":281509,"Energy_at_Risk_MWh":65.85,"Source_Sheet":"Event Reconstruction Incidents","Source_Record_ID":"XINC-005","Calculation_Basis":"Governed incident record used for reliability attention visualization"},{"Reliability_ID":"REL-A06","Record_Type":"Reliability Attention","Asset_Class":"Switchgear","Period":"Current qualified incident","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":"Critical","Trend_Status":"Attention","Failure_Mode":"Switchgear access / permit delay","Failure_Share_Pct":null,"Reliability_Index_Points":null,"Incident_ID":"XINC-006","Plant_ID":"SP-04","Plant_Name":"Thoothukudi Coastal PV","Asset_ID":"AST-00176","Asset_Tag":"SP-04-SWG-004","Incident_Type":"Switchgear access / permit delay","Severity":"Critical","Priority_Score":74,"Evidence_Confidence_Pct":91,"Value_at_Stake_INR":70200,"Energy_at_Risk_MWh":18,"Source_Sheet":"Event Reconstruction Incidents","Source_Record_ID":"XINC-006","Calculation_Basis":"Governed incident record used for reliability attention visualization"}];
const ORL_V589_SYNTHETIC=[{"Reliability_ID":"REL-001","Record_Type":"Asset Class","Asset_Class":"Inverter","Period":"Rolling 12M","MTBF_Hours":4751.99,"MTTR_Hours":3.91,"Reliability_Pct":94.21,"Technical_Availability_Pct":94.4,"Criticality":"Critical","Trend_Status":"Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Source_Sheet":"Work Orders","Calculation_Basis":"Operating hours ÷ corrective failure count; repair hours ÷ corrective count"},{"Reliability_ID":"REL-002","Record_Type":"Asset Class","Asset_Class":"Transformer","Period":"Rolling 12M","MTBF_Hours":7377.68,"MTTR_Hours":8.67,"Reliability_Pct":95.18,"Technical_Availability_Pct":100,"Criticality":"Critical","Trend_Status":"Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Source_Sheet":"Work Orders","Calculation_Basis":"Operating hours ÷ corrective failure count; repair hours ÷ corrective count"},{"Reliability_ID":"REL-003","Record_Type":"Asset Class","Asset_Class":"Tracker","Period":"Rolling 12M","MTBF_Hours":3344.81,"MTTR_Hours":3.29,"Reliability_Pct":96.37,"Technical_Availability_Pct":100,"Criticality":"High","Trend_Status":"Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Source_Sheet":"Work Orders","Calculation_Basis":"Operating hours ÷ corrective failure count; repair hours ÷ corrective count"},{"Reliability_ID":"REL-004","Record_Type":"Asset Class","Asset_Class":"String/Combiner","Period":"Rolling 12M","MTBF_Hours":5904.28,"MTTR_Hours":3.16,"Reliability_Pct":100,"Technical_Availability_Pct":93.68,"Criticality":"High","Trend_Status":"Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Source_Sheet":"Work Orders","Calculation_Basis":"Operating hours ÷ corrective failure count; repair hours ÷ corrective count"},{"Reliability_ID":"REL-005","Record_Type":"Asset Class","Asset_Class":"Module","Period":"Rolling 12M","MTBF_Hours":12506.57,"MTTR_Hours":1.99,"Reliability_Pct":99.63,"Technical_Availability_Pct":100,"Criticality":"Medium","Trend_Status":"Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Source_Sheet":"Vision Findings","Calculation_Basis":"Operating hours ÷ confirmed functional failure count"},{"Reliability_ID":"REL-006","Record_Type":"Asset Class","Asset_Class":"Weather Station","Period":"Rolling 12M","MTBF_Hours":8175.36,"MTTR_Hours":2.87,"Reliability_Pct":98.92,"Technical_Availability_Pct":100,"Criticality":"Medium","Trend_Status":"Improving","Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":null,"Source_Sheet":"Work Orders","Calculation_Basis":"Operating hours ÷ corrective failure count"},{"Reliability_ID":"REL-F01","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"Cooling fan degradation","Failure_Share_Pct":25.37,"Reliability_Index_Points":null,"Source_Sheet":"Root Cause Analysis","Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-F02","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"IGBT thermal stress","Failure_Share_Pct":18.53,"Reliability_Index_Points":null,"Source_Sheet":"Root Cause Analysis","Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-F03","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"Tracker drive fault","Failure_Share_Pct":15.55,"Reliability_Index_Points":null,"Source_Sheet":"Root Cause Analysis","Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-F04","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"String open circuit","Failure_Share_Pct":14.41,"Reliability_Index_Points":null,"Source_Sheet":"Root Cause Analysis","Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-F05","Record_Type":"Failure Mode","Asset_Class":null,"Period":"Rolling 12M","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":"Other","Failure_Share_Pct":26.14,"Reliability_Index_Points":null,"Source_Sheet":"Root Cause Analysis","Calculation_Basis":"Failure-mode count ÷ total failure count"},{"Reliability_ID":"REL-T01","Record_Type":"Growth Trend","Asset_Class":null,"Period":"Q3 FY25","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":85.25,"Source_Sheet":"Maintenance Outcomes","Calculation_Basis":"Indexed MTBF improvement, MTTR reduction and repeat-failure reduction"},{"Reliability_ID":"REL-T02","Record_Type":"Growth Trend","Asset_Class":null,"Period":"Q4 FY25","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":89.25,"Source_Sheet":"Maintenance Outcomes","Calculation_Basis":"Indexed MTBF improvement, MTTR reduction and repeat-failure reduction"},{"Reliability_ID":"REL-T03","Record_Type":"Growth Trend","Asset_Class":null,"Period":"Q1 FY26","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":94.25,"Source_Sheet":"Maintenance Outcomes","Calculation_Basis":"Indexed MTBF improvement, MTTR reduction and repeat-failure reduction"},{"Reliability_ID":"REL-T04","Record_Type":"Growth Trend","Asset_Class":null,"Period":"Q2 FY26","MTBF_Hours":null,"MTTR_Hours":null,"Reliability_Pct":null,"Technical_Availability_Pct":null,"Criticality":null,"Trend_Status":null,"Failure_Mode":null,"Failure_Share_Pct":null,"Reliability_Index_Points":99.25,"Source_Sheet":"Maintenance Outcomes","Calculation_Basis":"Indexed MTBF improvement, MTTR reduction and repeat-failure reduction"},{"Reliability_ID":"SREL-A01","Record_Type":"Reliability Attention","Asset_Class":"Inverter","Period":"Current synthetic incident","Criticality":"Critical","Trend_Status":"Attention","Failure_Mode":"Inverter cooling failure","Incident_ID":"INC-001","Plant_ID":"SOL-01","Plant_Name":"SOL-01","Asset_ID":"INV-001","Asset_Tag":"INV-001","Incident_Type":"Inverter cooling failure","Severity":"Critical","Priority_Score":94,"Evidence_Confidence_Pct":91.18,"Value_at_Stake_INR":54189.87,"Energy_at_Risk_MWh":8.04,"Source_Sheet":"Synthetic Event Reconstruction","Source_Record_ID":"INC-001","Calculation_Basis":"Existing synthetic incident record used for reliability attention visualization"},{"Reliability_ID":"SREL-A02","Record_Type":"Reliability Attention","Asset_Class":"Transformer","Period":"Current synthetic incident","Criticality":"Critical","Trend_Status":"Attention","Failure_Mode":"Transformer insulation degradation","Incident_ID":"INC-002","Plant_ID":"SOL-04","Plant_Name":"SOL-04","Asset_ID":"TRF-004","Asset_Tag":"TRF-004","Incident_Type":"Transformer insulation degradation","Severity":"Critical","Priority_Score":92,"Evidence_Confidence_Pct":94.94,"Value_at_Stake_INR":115834.02,"Energy_at_Risk_MWh":19.61,"Source_Sheet":"Synthetic Event Reconstruction","Source_Record_ID":"INC-002","Calculation_Basis":"Existing synthetic incident record used for reliability attention visualization"},{"Reliability_ID":"SREL-A03","Record_Type":"Reliability Attention","Asset_Class":"Other","Period":"Current synthetic incident","Criticality":"Critical","Trend_Status":"Attention","Failure_Mode":"Combiner connector hotspot","Incident_ID":"INC-003","Plant_ID":"SOL-07","Plant_Name":"SOL-07","Asset_ID":"CMB-017","Asset_Tag":"CMB-017","Incident_Type":"Combiner connector hotspot","Severity":"Critical","Priority_Score":90,"Evidence_Confidence_Pct":88.38,"Value_at_Stake_INR":34561.0,"Energy_at_Risk_MWh":5.68,"Source_Sheet":"Synthetic Event Reconstruction","Source_Record_ID":"INC-003","Calculation_Basis":"Existing synthetic incident record used for reliability attention visualization"},{"Reliability_ID":"SREL-A04","Record_Type":"Reliability Attention","Asset_Class":"Tracker","Period":"Current synthetic incident","Criticality":"Critical","Trend_Status":"Attention","Failure_Mode":"Tracker drive failure","Incident_ID":"INC-004","Plant_ID":"SOL-02","Plant_Name":"SOL-02","Asset_ID":"TRK-118","Asset_Tag":"TRK-118","Incident_Type":"Tracker drive failure","Severity":"Critical","Priority_Score":88,"Evidence_Confidence_Pct":84.34,"Value_at_Stake_INR":21905.66,"Energy_at_Risk_MWh":3.98,"Source_Sheet":"Synthetic Event Reconstruction","Source_Record_ID":"INC-004","Calculation_Basis":"Existing synthetic incident record used for reliability attention visualization"},{"Reliability_ID":"SREL-A05","Record_Type":"Reliability Attention","Asset_Class":"Other","Period":"Current synthetic incident","Criticality":"Critical","Trend_Status":"Attention","Failure_Mode":"SCADA communication loss","Incident_ID":"INC-005","Plant_ID":"SOL-09","Plant_Name":"SOL-09","Asset_ID":"SCADA-009","Asset_Tag":"SCADA-009","Incident_Type":"SCADA communication loss","Severity":"Critical","Priority_Score":86,"Evidence_Confidence_Pct":85.2,"Value_at_Stake_INR":60843.94,"Energy_at_Risk_MWh":9.85,"Source_Sheet":"Synthetic Event Reconstruction","Source_Record_ID":"INC-005","Calculation_Basis":"Existing synthetic incident record used for reliability attention visualization"},{"Reliability_ID":"SREL-A06","Record_Type":"Reliability Attention","Asset_Class":"Other","Period":"Current synthetic incident","Criticality":"Critical","Trend_Status":"Attention","Failure_Mode":"Switchgear relay trip","Incident_ID":"INC-006","Plant_ID":"SOL-12","Plant_Name":"SOL-12","Asset_ID":"SWG-012","Asset_Tag":"SWG-012","Incident_Type":"Switchgear relay trip","Severity":"Critical","Priority_Score":84,"Evidence_Confidence_Pct":96.68,"Value_at_Stake_INR":143415.03,"Energy_at_Risk_MWh":23.76,"Source_Sheet":"Synthetic Event Reconstruction","Source_Record_ID":"INC-006","Calculation_Basis":"Existing synthetic incident record used for reliability attention visualization"}];
const ORL_STATE=window.ORL_STATE||{assetClass:'All',failureMode:'All',incident:'All'};
window.ORL_STATE=ORL_STATE;
function orlClearFilters(){ORL_STATE.assetClass='All';ORL_STATE.failureMode='All';ORL_STATE.incident='All';renderOperationalReliability()}
function orlFilterAssetClass(v){ORL_STATE.assetClass=(ORL_STATE.assetClass===v?'All':v);ORL_STATE.incident='All';renderOperationalReliability()}
function orlFilterFailureMode(v){ORL_STATE.failureMode=(ORL_STATE.failureMode===v?'All':v);ORL_STATE.incident='All';renderOperationalReliability()}
function orlFilterIncident(v){ORL_STATE.incident=(ORL_STATE.incident===v?'All':v);renderOperationalReliability()}
window.orlClearFilters=orlClearFilters;window.orlFilterAssetClass=orlFilterAssetClass;window.orlFilterFailureMode=orlFilterFailureMode;window.orlFilterIncident=orlFilterIncident;
function renderOperationalReliability(){
  const mode=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:(window.APM_DATA_MODE||'')).toLowerCase();
  const runtimeRows=(typeof wdRows==='function'?wdRows('Operational Reliability'):null);
  const synthMode=(mode.includes('demo')||mode.includes('synthetic'));
  const rows=(runtimeRows&&runtimeRows.length)?runtimeRows:(synthMode?ORL_V589_SYNTHETIC:ORL_V589_EXCEL);
  if(!rows||!rows.length){console.error('Operational Reliability: no dataset resolved');return;}
  const v=document.getElementById('view-reliabilityengineering');if(!v)return;
  const assetsAll=rows.filter(r=>r.Record_Type==='Asset Class');
  const failsAll=rows.filter(r=>r.Record_Type==='Failure Mode').sort((a,b)=>n(b.Failure_Share_Pct)-n(a.Failure_Share_Pct));
  const trend=rows.filter(r=>r.Record_Type==='Growth Trend');
  const attentionAll=rows.filter(r=>r.Record_Type==='Reliability Attention');

  const selectedClass=ORL_STATE.assetClass, selectedFail=ORL_STATE.failureMode, selectedIncident=ORL_STATE.incident;
  const attention=attentionAll; window.__ORL_ATTENTION_ROWS=attentionAll;
  const linkedAttention=attentionAll.filter(r=>
    (selectedClass==='All'||String(r.Asset_Class)===selectedClass) &&
    (selectedFail==='All'||String(r.Failure_Mode)===selectedFail||String(r.Incident_Type)===selectedFail) &&
    (selectedIncident==='All'||String(r.Incident_ID)===selectedIncident)
  );
  const assetScope=(selectedClass==='All'?assetsAll:assetsAll.filter(r=>String(r.Asset_Class)===selectedClass));
  const fails=(selectedFail==='All'?failsAll:failsAll.filter(r=>String(r.Failure_Mode)===selectedFail));

  const mtbf=assetScope.reduce((s,r)=>s+n(r.MTBF_Hours),0)/Math.max(1,assetScope.length);
  const mttr=assetScope.reduce((s,r)=>s+n(r.MTTR_Hours),0)/Math.max(1,assetScope.length);
  const avail=assetScope.reduce((s,r)=>s+n(r.Technical_Availability_Pct),0)/Math.max(1,assetScope.length);
  const critical=attention.filter(r=>String(r.Severity||r.Criticality)==='Critical').length;
  const energy=attention.reduce((s,r)=>s+n(r.Energy_at_Risk_MWh),0);
  const exposure=attention.reduce((s,r)=>s+n(r.Value_at_Stake_INR),0);
  const linkedCritical=linkedAttention.filter(r=>String(r.Severity||r.Criticality)==='Critical').length;
  const linkedEnergy=linkedAttention.reduce((s,r)=>s+n(r.Energy_at_Risk_MWh),0);
  const linkedExposure=linkedAttention.reduce((s,r)=>s+n(r.Value_at_Stake_INR),0);
  const maxMtbf=Math.max(1,...assetsAll.map(r=>n(r.MTBF_Hours)));
  const topConcentration=fails.slice(0,2).reduce((s,r)=>s+n(r.Failure_Share_Pct),0);
  const growthDelta=trend.length?n(trend[trend.length-1].Reliability_Index_Points)-n(trend[0].Reliability_Index_Points):0;
  const lowest=(selectedClass==='All'?assetsAll:assetScope).slice().sort((a,b)=>n(a.MTBF_Hours)-n(b.MTBF_Hours))[0]||{};
  const kpis=[
    [selectedClass==='All'?'Fleet MTBF':selectedClass+' MTBF',mtbf.toFixed(2),'h','#2f7d9f'],
    [selectedClass==='All'?'Fleet MTTR':selectedClass+' MTTR',mttr.toFixed(2),'h','#855fa8'],
    ['Technical Availability',avail.toFixed(2),'%','#2b8560'],
    ['Critical Reliability Events',critical.toFixed(0),'','#b44942'],
    ['Reliability Energy at Risk',energy.toFixed(2),'MWh','#d18a16']
  ];
  const activeChips=[selectedClass!=='All'?`Asset class: ${selectedClass}`:'',selectedFail!=='All'?`Failure mode: ${selectedFail}`:'',selectedIncident!=='All'?`Incident: ${selectedIncident}`:''].filter(Boolean);

  const growthSvg=(()=>{
    if(!trend.length)return '';
    const W=520,H=168,L=42,R=18,T=24,B=32,raw=trend.map(r=>n(r.Reliability_Index_Points)),base=Math.max(.0001,raw[0]),vals=raw.map(v=>v/base*100),mn=Math.min(96,...vals)-2,mx=Math.max(104,...vals)+2;
    const pts=vals.map((y,i)=>[L+(W-L-R)*i/Math.max(1,vals.length-1),H-B-(H-T-B)*(y-mn)/Math.max(1,mx-mn)]);
    const y100=H-B-(H-T-B)*(100-mn)/Math.max(1,mx-mn);
    return `<div class="orl-growth-legend"><b>${e(trend[0].Period)} = 100 baseline</b><span>governed source index ${raw[0].toFixed(2)}</span></div><svg viewBox="0 0 ${W} ${H}"><line class="orl-growth-baseline" x1="${L}" y1="${y100}" x2="${W-R}" y2="${y100}"/>${[100,105,110,115,120].filter(v=>v>=mn&&v<=mx).map(v=>{const y=H-B-(H-T-B)*(v-mn)/(mx-mn);return `<line class="orl-gridline" x1="${L}" y1="${y}" x2="${W-R}" y2="${y}"/><text class="orl-svg-label" x="${L-6}" y="${y+4}" text-anchor="end">${v}</text>`}).join('')}<polyline class="orl-growth-line" points="${pts.map(p=>p.join(',')).join(' ')}"/>${pts.map((p,i)=>`<circle class="orl-growth-dot" cx="${p[0]}" cy="${p[1]}" r="4.5"/><text class="orl-growth-value" x="${p[0]}" y="${p[1]-10}" text-anchor="middle">${vals[i].toFixed(1)}</text><text class="orl-svg-label" x="${p[0]}" y="${H-8}" text-anchor="middle">${e(trend[i].Period)}</text>`).join('')}</svg><div class="orl-growth-method"><b>How it grows:</b> governed reliability index combines <strong>MTBF improvement</strong>, <strong>MTTR reduction</strong> and <strong>repeat-failure reduction</strong>. Display is rebased to the first period = 100; source index values are unchanged.</div>`;
  })();

  const paretoSvg=(()=>{
    if(!failsAll.length)return '';
    const W=520,H=266,L=42,R=24,T=22,B=62,GAP=22;
    const shares=failsAll.map(r=>n(r.Failure_Share_Pct)),cums=[];let c=0;shares.forEach(v=>{c+=v;cums.push(Math.min(100,c))});
    const step=(W-L-R)/failsAll.length,barW=Math.min(50,step*.58),shareMax=Math.max(30,Math.ceil(Math.max(...shares)/5)*5);
    const cumTop=T+18,cumBottom=104,shareTop=cumBottom+GAP+18,shareBottom=H-B;
    let out=`<div class="orl-pareto-legend"><span><i class="bar"></i>Failure share (%)</span><span><i class="line"></i>Cumulative share (%)</span><span><i class="threshold"></i>80% concentration threshold</span></div><svg class="orl-pareto-svg" viewBox="0 0 ${W} ${H}">`;
    out+=`<text class="orl-pareto-panel-title" x="${L}" y="${T+8}">Cumulative share (%) · 0–100 scale</text><text class="orl-pareto-panel-title" x="${L}" y="${shareTop-8}">Failure share (%) · 0–${shareMax} scale</text><line class="orl-pareto-divider" x1="${L}" y1="${cumBottom+GAP/2}" x2="${W-R}" y2="${cumBottom+GAP/2}"/>`;
    [0,50,80,100].forEach(v=>{const y=cumBottom-(cumBottom-cumTop)*v/100;out+=`<line class="orl-gridline" x1="${L}" y1="${y}" x2="${W-R}" y2="${y}"/><text class="orl-svg-label" x="${L-6}" y="${y+3}" text-anchor="end">${v}%</text>`});
    const y80=cumBottom-(cumBottom-cumTop)*.8;out+=`<line class="orl-pareto-80" x1="${L}" y1="${y80}" x2="${W-R}" y2="${y80}"/>`;
    [0,10,20,30].filter(v=>v<=shareMax).forEach(v=>{const y=shareBottom-(shareBottom-shareTop)*v/shareMax;out+=`<line class="orl-gridline" x1="${L}" y1="${y}" x2="${W-R}" y2="${y}"/><text class="orl-svg-label" x="${L-6}" y="${y+3}" text-anchor="end">${v}%</text>`});
    failsAll.forEach((r,i)=>{const x=L+step*(i+.5),share=shares[i],cum=cums[i],sel=selectedFail===String(r.Failure_Mode),cy=cumBottom-(cumBottom-cumTop)*cum/100,sy=shareBottom-(shareBottom-shareTop)*share/shareMax,name=String(r.Failure_Mode||''),words=name.split(/\s+/),split=Math.max(1,Math.ceil(words.length/2)),line1=words.slice(0,split).join(' '),line2=words.slice(split).join(' ');out+=`<g class="orl-pareto-item ${sel?'selected':''}" onclick="orlFilterFailureMode('${e(r.Failure_Mode)}')"><title>${e(r.Failure_Mode)} · Failure share ${share.toFixed(2)}% · Cumulative ${cum.toFixed(2)}%</title><rect class="orl-pareto-cumbar ${sel?'selected':''}" x="${x-barW/2}" y="${cy}" width="${barW}" height="${Math.max(1,cumBottom-cy)}" rx="3"/><text class="orl-pareto-cum-label" x="${x}" y="${Math.max(cumTop+10,cy-5)}" text-anchor="middle">${cum.toFixed(2)}%</text><rect class="orl-pareto-sharebar ${sel?'selected':''}" x="${x-barW/2}" y="${sy}" width="${barW}" height="${Math.max(1,shareBottom-sy)}" rx="3"/><text class="orl-pareto-share-inside" x="${x}" y="${shareBottom-6}" text-anchor="middle">${share.toFixed(2)}%</text><text class="orl-pareto-cat" x="${x}" y="${H-27}" text-anchor="middle"><tspan x="${x}" dy="0">${e(line1)}</tspan>${line2?`<tspan x="${x}" dy="10">${e(line2)}</tspan>`:''}</text></g>`});
    return out+'</svg>';
  })();

  const attentionSvg=(()=>{
    const plot=attentionAll;
    if(!plot.length)return '';
    const W=520,H=150,L=38,R=18,T=16,B=28,minX=70,maxX=92,minY=68,maxY=94,maxExp=Math.max(1,...plot.map(r=>n(r.Value_at_Stake_INR)));
    let s=`<svg viewBox="0 0 ${W} ${H}"><line class="orl-axis" x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/><line class="orl-axis" x1="${L}" y1="${T}" x2="${L}" y2="${H-B}"/><text class="orl-axis-title" x="${(L+W-R)/2}" y="${H-1}" text-anchor="middle">Priority Score</text><text class="orl-axis-title" transform="translate(10 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle">Evidence Confidence (%)</text>`;
    [75,80,85,90].forEach(x=>{let px=L+(W-L-R)*(x-minX)/(maxX-minX);s+=`<line class="orl-gridline" x1="${px}" y1="${T}" x2="${px}" y2="${H-B}"/><text class="orl-svg-label" x="${px}" y="${H-9}" text-anchor="middle">${x}</text>`});
    [70,80,90].forEach(y=>{let py=H-B-(H-T-B)*(y-minY)/(maxY-minY);s+=`<line class="orl-gridline" x1="${L}" y1="${py}" x2="${W-R}" y2="${py}"/><text class="orl-svg-label" x="${L-6}" y="${py+3}" text-anchor="end">${y}%</text>`});
    plot.forEach(r=>{let rad=5+8*Math.sqrt(n(r.Value_at_Stake_INR)/maxExp),rawX=L+(W-L-R)*(n(r.Priority_Score)-minX)/(maxX-minX),x=Math.max(L+rad+3,Math.min(W-R-rad-3,rawX)),y=H-B-(H-T-B)*(n(r.Evidence_Confidence_Pct)-minY)/(maxY-minY),fill=String(r.Severity)==='Critical'?'#b44942':'#d18a16',sel=selectedIncident===String(r.Incident_ID),match=(selectedClass==='All'||String(r.Asset_Class)===selectedClass)&&(selectedFail==='All'||String(r.Failure_Mode)===selectedFail||String(r.Incident_Type)===selectedFail)&&(selectedIncident==='All'||String(r.Incident_ID)===selectedIncident),filtered=(selectedClass!=='All'||selectedFail!=='All'||selectedIncident!=='All'),op=filtered?(match?1:.48):1,nearRight=(x+rad+54>W-R),lx=nearRight?x-rad-4:x+rad+4,anchor=nearRight?'end':'start',tag=String(r.Asset_Tag||'').slice(0,10);s+=`<g class="orl-attention-point" opacity="${op}" onmouseenter="orlShowTip(event,'${e(r.Incident_ID)}')" onmousemove="orlMoveTip(event)" onmouseleave="orlHideTip()" onclick="orlFilterIncident('${e(r.Incident_ID)}');orlPinTip(event,'${e(r.Incident_ID)}')"><circle class="orl-attention-dot ${sel?'selected':''}" cx="${x}" cy="${y}" r="${sel?rad+2:rad}" fill="${fill}"><title>${e(r.Incident_ID)} · ${e(r.Asset_Tag)} · ${e(r.Incident_Type)} · Priority ${n(r.Priority_Score).toFixed(0)}/100 · Evidence ${n(r.Evidence_Confidence_Pct).toFixed(0)}% · ${money(r.Value_at_Stake_INR)} · ${e(r.Severity)}</title></circle></g>`});
    
    return s+'</svg>';
  })();

  v.innerHTML='<div class="view-head"><div><h1>Reliability Engineering</h1></div></div>'+
  `<div class="orl-shell">
    <div class="orl-filterbar"><div class="orl-filter-chips">${activeChips.length?activeChips.map(c=>`<span class="${c.startsWith('Incident:')?'incident-chip':c.startsWith('Asset class:')?'asset-chip':c.startsWith('Failure mode:')?'failure-chip':''}">${e(c)}</span>`).join(''):'<span class="muted">Portfolio view</span>'}</div>${activeChips.length?'<button class="orl-clear" onclick="orlClearFilters()">Clear selection</button>':''}</div>
    <div class="orl-kpis">${kpis.map((k,idx)=>`<div class="orl-kpi" style="--orl:${k[3]}"><span>${k[0]}</span><b>${k[1]}${k[2]?`<small>${k[2]}</small>`:''}</b><div class="orl-kpi-mini" aria-hidden="true"><i style="height:${[7,10,13,11,15][idx%5]}px"></i><i style="height:${[10,13,9,14,11][idx%5]}px"></i><i style="height:${[13,9,15,10,14][idx%5]}px"></i><i style="height:${[9,15,11,13,10][idx%5]}px"></i><i style="height:${[15,11,14,9,13][idx%5]}px"></i></div></div>`).join('')}</div>
    <div class="orl-grid">
      <div class="orl-card"><h3>Asset-class reliability comparison</h3><div class="orl-class-head"><span>Asset class</span><span></span><b>MTBF (h)</b><em>Availability (%)</em></div>${assetsAll.map(r=>`<button class="orl-class-row ${selectedClass===String(r.Asset_Class)?'selected':''}" onclick="orlFilterAssetClass('${e(r.Asset_Class)}')"><span>${e(r.Asset_Class)}</span><div class="orl-bar"><i style="width:${Math.max(4,n(r.MTBF_Hours)/maxMtbf*100)}%"></i></div><b>${Math.round(n(r.MTBF_Hours)).toLocaleString('en-IN')} h</b><em>${n(r.Technical_Availability_Pct).toFixed(2)}%</em></button>`).join('')}</div>
      <div class="orl-card orl-pareto"><h3>Failure-mode Pareto</h3>${paretoSvg}</div>
      <div class="orl-card orl-growth"><h3>Reliability Growth · Index Points</h3>${growthSvg}</div>
      <div class="orl-card orl-attention"><h3>Reliability attention map</h3><div class="orl-attention-guide"><span>● Larger bubble = greater value at stake</span><span><i class="crit"></i>Critical</span><span><i class="high"></i>High</span></div>${attentionSvg}<div class="orl-attention-note"><b>Interpretation:</b> Hover a bubble for incident, asset, priority, evidence, exposure and severity.</div></div>
    </div>
    <div class="orl-patterns">
      <div class="orl-pattern" style="--pc:#b44942"><em>Top-2 Failure Concentration</em><b>${topConcentration.toFixed(2)}%</b></div>
      <div class="orl-pattern" style="--pc:#d18a16"><em>Lowest MTBF Asset Class</em><b>${e(lowest.Asset_Class||'—')} · ${Math.round(n(lowest.MTBF_Hours)).toLocaleString('en-IN')} h</b></div>
      <div class="orl-pattern" style="--pc:#2b8560"><em>Reliability growth</em><b>+${growthDelta.toFixed(2)} points</b><span>${trend.length?e(trend[0].Period)+' → '+e(trend[trend.length-1].Period):''}</span></div>
    </div>
    <div class="orl-card" style="margin-top:9px"><h3>Reliability → business impact bridge</h3><div class="orl-bridge"><div class="orl-step" style="--sc:#b44942"><span>Qualified events</span><b>${attention.length}</b></div><div class="orl-arrow">→</div><div class="orl-step" style="--sc:#d18a16"><span>Critical events</span><b>${critical}</b></div><div class="orl-arrow">→</div><div class="orl-step" style="--sc:#2f7d9f"><span>Energy at risk</span><b>${energy.toFixed(2)} MWh</b></div><div class="orl-arrow">→</div><div class="orl-step" style="--sc:#855fa8"><span>Value exposure</span><b>${money(exposure)}</b></div></div>
      <div class="orl-action-route"><span>Action route</span><div class="orl-actions">${selectedIncident!=='All'?(()=>{const rr=attention.find(x=>String(x.Incident_ID)===String(selectedIncident))||{},sl=orlStrategyLink(rr),ll=orlLearningLink(rr);return `<button class="orl-action orl-investigate" onclick="orlOpenIncident('${e(selectedIncident)}')">Investigate →</button>${sl?`<button class="orl-action orl-strategy" onclick="orlOpenMaintenanceStrategy('${e(selectedIncident)}')">Review ${e(sl.label)} →</button>`:`<button class="orl-action no-link orl-strategy-none" disabled title="No matching record exists in the five Maintenance Strategy tabs">No linked strategy record</button>`}${ll?`<button class="orl-action orl-learning" onclick="orlOpenLearning('${e(selectedIncident)}')">Learning & recovery →</button>`:`<button class="orl-action no-link orl-learning-none" disabled>No linked learning record</button>`}`})():`<button class="orl-action" disabled>Investigate event →</button><button class="orl-action" disabled>Review maintenance strategy →</button><button class="orl-action" disabled>Learning & recovery →</button>`}</div>${selectedIncident==='All'?'<div class="orl-action-hint">Select a Reliability Attention record or bubble first. Actions are enabled only where a genuine downstream record exists.</div>':''}</div>
    </div>
    <details class="orl-register" open><summary><span class="orl-register-title-text">Reliability Attention Records</span></summary><div class="orl-reg-head"><b>Incident</b><b>Asset</b><b>Incident / failure type</b><b>Severity</b><b>Value at stake</b></div>${attention.map(r=>{const match=(selectedClass==='All'||String(r.Asset_Class)===selectedClass)&&(selectedFail==='All'||String(r.Failure_Mode)===selectedFail||String(r.Incident_Type)===selectedFail)&&(selectedIncident==='All'||String(r.Incident_ID)===selectedIncident);return `<div class="orl-reg-row ${selectedIncident===String(r.Incident_ID)?'selected':''}" style="opacity:${(selectedClass!=='All'||selectedFail!=='All'||selectedIncident!=='All')?(match?1:.35):1}" onclick="orlFilterIncident('${e(r.Incident_ID)}')"><b>${e(r.Incident_ID)}</b><span>${e(r.Asset_Tag)}</span><span>${e(r.Incident_Type)}</span><b>${e(r.Severity)}</b><span>${money(r.Value_at_Stake_INR)}</span></div>`}).join('')}</details>
  </div>`;
  /* v645: restore the shared Reliability Engineering TAMS synchronously in the same render task.
     Operational Reliability replaces its view DOM; without this, the tab row is briefly absent and
     a later observer/restorer re-inserts it, producing the visible vertical shift. */
  try{ if(typeof window.applyMaintenanceGroupingSubtabs==='function') window.applyMaintenanceGroupingSubtabs('reliabilityengineering'); }catch(_){}
}
window.renderReliabilityEngineering=renderOperationalReliability;
try{renderReliabilityEngineering=renderOperationalReliability}catch(_){}
try{if(window.AIP_V21?.renderers)window.AIP_V21.renderers.reliabilityengineering=renderOperationalReliability}catch(_){}
const orlForce=()=>{const v=document.getElementById('view-reliabilityengineering');if(v&&v.classList.contains('active')&&!v.querySelector('.orl-shell'))renderOperationalReliability();};
document.addEventListener('click',ev=>{
 const target=ev.target.closest?.('[data-view="reliabilityengineering"],[data-aip-maint-nav="reliabilityengineering"],button,.xi-tab');
 const label=String(target?.textContent||'').trim();
 if(target&&(target.matches?.('[data-view="reliabilityengineering"],[data-aip-maint-nav="reliabilityengineering"]')||/Operational Reliability|Reliability Analysis/i.test(label))){
   requestAnimationFrame(orlForce);
 }
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(orlForce,120));else setTimeout(orlForce,120);  // v87_675: Operational Reliability replaces the whole view with innerHTML.
  // Restore the Reliability Engineering subtab strip immediately in the same navigation cycle.
  const restoreReliabilitySubtabs=()=>{
    try{
      if(typeof window.applyMaintenanceGroupingSubtabs==='function'){
        window.applyMaintenanceGroupingSubtabs('reliabilityengineering');
      }
    }catch(err){console.error('Reliability subtab restore failed',err)}
  };
  restoreReliabilitySubtabs();


})();
