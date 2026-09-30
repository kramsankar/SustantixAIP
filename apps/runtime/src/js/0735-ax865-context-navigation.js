(function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rows=n=>window.AIP_PV864?.rows(n)||[];
 const routes=[['workorderintelligence','Work orders'],['preventive','Maintenance strategy'],['spares','Compatible spares'],['maintenancelearning','Warranty & claims'],['reliabilityanalytics','Reliability evidence'],['assetrelationships','Asset relationships'],['sustainabilityintelligence','Sustainability & end of life']];
 const titles=Object.fromEntries(routes);let context=null,sequence=0,queued=false;const hiddenNative=new Map();
 function openTarget(target){const nav=document.querySelector('.nav-item[data-view="'+target+'"]');if(nav)nav.click();else window.activate(target,false);}
 function selected(){const a=window.AIP_AX865_SELECTED;if(a)return {...a};const id=window.AIPAssetExplorerController?.getState?.()?.assetId||window.AIP_ASSET_EXPLORER_SELECTED_ID;return rows('Asset Master').find(r=>r.Asset_ID===id);}
 function exact(r,c){const id=r.Asset_ID??r.assetId??r.Group_ID;return String(id||'')===c.assetId&&(!r.Plant_ID||!c.plantId||String(r.Plant_ID)===c.plantId);}
 function unique(rs){const seen=new Set();return rs.filter(r=>{const k=JSON.stringify(r);if(seen.has(k))return false;seen.add(k);return true})}
 function sections(c){
  const own=n=>rows(n).filter(r=>exact(r,c)),wo=own('Work Orders'),woIds=new Set(wo.map(r=>r.Work_Order_ID));
  const section=(title,rs,cols)=>({title,rows:unique(rs),cols});
  const byAssetOrWork=r=>exact(r,c)||(!r.Asset_ID&&woIds.has(r.Work_Order_ID)&&(!r.Plant_ID||r.Plant_ID===c.plantId));
  switch(c.target){
   case 'workorderintelligence':return [section('Work orders',wo,[['Work order','Work_Order_ID'],['Type','Maintenance_Type'],['Description','Description'],['Priority','Priority'],['Status','Status'],['Created','Created_Date'],['Crew','Assigned_Crew']])];
   case 'preventive':return [section('Maintenance plans',own('PM Plans'),[['Plan','PM_Plan_ID'],['Task','Task'],['Frequency (days)','Frequency_Days'],['Last done','Last_Done'],['Next due','Next_Due']]),section('Condition and predictive alerts',own('AI Alerts & RUL'),[['Alert','Alert_ID'],['Component','Component'],['Evidence','Evidence_Summary|Failure_Mode'],['Severity','Severity|Risk_Tier'],['Status','Alert_Status|Status']]),section('Recommended interventions',own('Prescriptive Actions'),[['Recommendation','Recommendation_ID'],['Action','Recommended_Action'],['Status','Decision_Status|Status']])];
   case 'spares':{
    const demand=rows('MSI_Spare_Requirements').filter(byAssetOrWork),plans=own('PM Plans'),partIds=new Set([...demand.map(r=>r.Part_ID),...wo.map(r=>r.Required_Part_ID),...plans.map(r=>r.Primary_Part_ID)].filter(Boolean));
    const parts=unique([...rows('MSI_Part_Master'),...rows('Spare Parts Master')]).filter(r=>partIds.has(r.Part_ID));
    const dedup=new Map();parts.forEach(r=>dedup.set(r.Part_ID,{...(dedup.get(r.Part_ID)||{}),...r}));
    return [section('Linked spare demand',demand,[['Requirement','Requirement_ID'],['Part','Part_ID'],['Work order','Work_Order_ID'],['Quantity','Required_Qty'],['Required by','Required_By'],['Status','Requirement_Status']]),section('Linked compatible parts',[...dedup.values()],[['Part','Part_ID'],['Description','Part_Name'],['Category','Category'],['Lead time (days)','Lead_Time_Days']]),section('Availability at this site',rows('MSI_ERP_Spares').filter(r=>partIds.has(r.Part_ID)&&String(r.Plant_ID)===c.plantId),[['Part','Part_ID'],['Site','Plant_ID'],['Available','Available_Qty'],['Reserved','Reserved_Qty'],['In transit','In_Transit_Qty'],['Updated','Last_Updated']])];
   }
   case 'maintenancelearning':return [section('Warranty coverage',own('Warranty Register'),[['Contract','Warranty_ID'],['Type','Warranty_Type'],['Coverage','Coverage_Type'],['Status','Current_Status'],['Start','Warranty_Start_Date'],['End','Warranty_End_Date']]),section('Warranty claims',own('Warranty Claims'),[['Claim','Claim_ID'],['Contract','Warranty_ID'],['Status','Claim_Status'],['Claimed (INR)','Claimed_Amount_INR'],['Approved (INR)','Approved_Amount_INR'],['Next action','Next_Action']])];
   case 'reliabilityanalytics':{
    const segments=new Set(rows('PV_Population_Segments').filter(r=>r.Group_ID===c.assetId).map(r=>r.Segment_ID)),members=new Set(rows('PV_Module_Register').filter(r=>segments.has(r.Segment_ID)).map(r=>r.Module_ID));
    const evidence=rows('Reliability_Life_History').filter(r=>exact(r,c)||((members.has(r.Module_ID||r.Asset_ID))&&(!r.Plant_ID||r.Plant_ID===c.plantId)));
    return [section('Linked reliability observations',evidence,[['Record','Reliability_Record_ID'],['Observed asset / module','Asset_ID'],['Failure mode','Failure_Mode'],['Observed on','Observation_Date'],[c.assetClass==='PV Module'?'Calendar exposure hours':'Operating hours',c.assetClass==='PV Module'?'Calendar_Exposure_Hours':'Operating_Hours'],['Outcome','Failed_Surviving'],['Right censored','Right_Censored']])];
   }
   case 'assetrelationships':{
    const entities=rows('Graph Entities'),ids=new Set([c.assetId,...entities.filter(r=>exact(r,c)||r.Entity_ID===c.assetId).map(r=>r.Entity_ID)]),rels=rows('Graph Relationships').filter(r=>ids.has(r.From_Entity_ID)||ids.has(r.To_Entity_ID));
    return [section('Direct asset relationships',rels,[['Relationship','Relationship_ID'],['From','From_Entity_ID'],['Type','Relationship_Type'],['To','To_Entity_ID'],['Status','Relationship_Status'],['Confidence (%)','Confidence_Pct']])];
   }
   case 'sustainabilityintelligence':{
    const group=rows('PV_Module_Groups').find(r=>r.Group_ID===c.assetId&&(!r.Plant_ID||r.Plant_ID===c.plantId)),rs=rows('SUS_Circularity_EOL').filter(r=>exact(r,c)||(group&&r.EOL_Record_ID===group.Source_Record_ID&&String(r.Plant_ID)===c.plantId));
    return [section('Linked lifecycle records',rs,[['Record','EOL_Record_ID'],['Source asset','Asset_ID'],['Condition','Condition'],['Quantity','Quantity'],['Unit','Unit'],['Recovery path','Recovery_Path'],['Status','Data_Status']])];
   }
  }
  return [];
 }
 function cell(v){return esc(v==null||v===''?'—':v)}
 function hideNative(root,panel){for(const node of root.children){if(node===panel)continue;if(!hiddenNative.has(node))hiddenNative.set(node,[node.style.getPropertyValue('display'),node.style.getPropertyPriority('display')]);if(node.style.getPropertyValue('display')!=='none'||node.style.getPropertyPriority('display')!=='important')node.style.setProperty('display','none','important');}}
 function render(){
  const c=context;if(!c)return;const root=document.getElementById('view-'+c.target);if(!root||!root.classList.contains('active'))return;
  root.classList.add('ax865-context-active');let panel=root.querySelector(':scope > .ax865-focused');
  if(panel?.dataset.token===c.token){hideNative(root,panel);return;}
  panel?.remove();panel=document.createElement('section');panel.className='ax865-focused';panel.dataset.token=c.token;
  const ss=sections(c),count=ss.reduce((n,s)=>n+s.rows.length,0);panel.dataset.assetId=c.assetId;panel.dataset.siteId=c.plantId;panel.dataset.recordCount=String(count);
  panel.innerHTML='<h2>'+esc(titles[c.target])+'</h2><div class="ax865-context"><div><b>'+esc(c.assetTag||c.assetId)+'</b> · '+esc(c.assetClass)+'<small>Asset '+esc(c.assetId)+' · Site '+esc(c.plantId||'Not recorded')+(c.recordId?' · Record '+esc(c.recordId):'')+'</small></div><div class="ax865-context-actions"><button data-ax865-back>Back to asset</button><button data-ax865-clear>Clear asset filter</button></div></div>'+ss.map(s=>'<div class="ax-card ax-domain-card"><h3>'+esc(s.title)+' <small>('+s.rows.length+')</small></h3>'+(s.rows.length?'<div class="ax865-table-wrap"><table class="ax-table"><thead><tr>'+s.cols.map(([h])=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+s.rows.map(r=>'<tr data-ax865-record="'+esc(r[s.cols[0][1]]||'')+'">'+s.cols.map(([,k])=>'<td>'+cell(k.split('|').map(key=>r[key]).find(v=>v!=null&&v!==''))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<div class="ax-empty">No linked records for this asset in the active data source.</div>')+'</div>').join('');
  panel.querySelector('[data-ax865-back]').onclick=()=>back(c);
  panel.querySelector('[data-ax865-clear]').onclick=()=>{clear();openTarget(c.target)};
  root.appendChild(panel);hideNative(root,panel);
 }
 function clear(){const prior=context;context=null;for(const [node,[value,priority]] of hiddenNative){if(value)node.style.setProperty('display',value,priority);else node.style.removeProperty('display');}hiddenNative.clear();document.querySelectorAll('.ax865-context-active').forEach(r=>r.classList.remove('ax865-context-active'));document.querySelectorAll('.ax865-focused').forEach(r=>r.remove());window.AIP_AX865_CONTEXT=null;if(prior&&window.AIP_CONTEXT_NAV?.token===prior.token)window.AIP_CONTEXT_NAV=null;}
 function back(c){clear();openTarget('assetexplorer');window.AIPAssetExplorerController?.navigateContext?.({assetId:c.assetId,Asset_ID:c.assetId,plantId:c.plantId,Plant_ID:c.plantId,assetClass:c.assetClass});}
 function navigate(target,a,recordId){
  if(!titles[target]||!a)return;clear();
  const id=String(a.Asset_ID||a.assetId||''),site=String(a.Plant_ID||a.plantId||a.plant||'');if(!id)return;
  context={assetId:id,Asset_ID:id,assetTag:String(a.Asset_Tag||a.tag||id),plantId:site,Plant_ID:site,assetClass:String(a.Asset_Class||a.assetClass||'Asset'),target,source:'Asset Explorer',recordId:recordId||'',token:String(++sequence)};
  window.AIP_AX865_CONTEXT={...context};window.AIP_CONTEXT_NAV={...context};window.AIP_SELECTED_ASSET_CONTEXT={...context};
  window.AIP_ASSET_DRILL_CONTEXT=null;try{sessionStorage.removeItem('aip.asset.drill')}catch(_){}
  openTarget(target);render();requestAnimationFrame(render);
 }
 function decorate(){
  const pane=document.querySelector('#view-assetexplorer #axPane');
  pane?.querySelector('#axAssetRelationshipsCard')?.remove();
 }
 document.addEventListener('click',e=>{
  const button=e.target.closest?.('#view-assetexplorer [data-ax865-route],#view-assetexplorer [data-ax-context-nav],#view-assetexplorer [data-pv-claims],#view-assetexplorer [data-ax-nav],#view-assetexplorer .ax-kpi[data-aip-drill],#view-assetexplorer [data-ax-relationship-asset]');
  if(!button)return;const target=button.dataset.ax865Route||button.dataset.axContextNav||button.dataset.axNav||button.dataset.aipDrill||(button.hasAttribute('data-pv-claims')?'maintenancelearning':'assetrelationships');
  if(!titles[target])return;e.preventDefault();e.stopImmediatePropagation();navigate(target,selected(),button.dataset.axRecordId);
 },true);
 document.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const k=e.target.closest?.('#view-assetexplorer .ax-kpi[data-aip-drill]');if(k){e.preventDefault();e.stopImmediatePropagation();navigate(k.dataset.aipDrill,selected());}},true);
 document.addEventListener('aip:data-source-changed',()=>{if(context){context={...context,token:String(++sequence)};window.AIP_AX865_CONTEXT={...context};render();}});
 new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();decorate()})}).observe(document.body,{childList:true,subtree:true});
 window.AIP_AX865={navigate,decorate,clear,sections,selected,getContext:()=>context&&({...context})};
 window.AIP_CURRENT_BUILD='v871';
})();
