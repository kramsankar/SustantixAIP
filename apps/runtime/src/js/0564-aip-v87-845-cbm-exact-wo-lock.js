
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';

const AIP845_CANON={
 'VIS-FND-00001':{Work_Order_ID:'WO-00145',Plant_ID:'SP-01',Plant_Name:'Suryanagar Solar Park',Asset_ID:'AST-00008',Asset_Tag:'SP-01-INV-008',Source:'VIS-FND-00001'},
 'VIS-FND-00004':{Work_Order_ID:'WO-00146',Plant_ID:'SP-04',Plant_Name:'Thoothukudi Coastal PV',Asset_ID:'AST-00177',Asset_Tag:'SP-04-SCB-001',Source:'VIS-FND-00004'},
 'VIS-FND-00005':{Work_Order_ID:'WO-00147',Plant_ID:'SP-05',Plant_Name:'Rewa East Solar',Asset_ID:'AST-00223',Asset_Tag:'SP-05-SCB-001',Source:'VIS-FND-00005'},
 'VIS-FND-00008':{Work_Order_ID:'WO-00148',Plant_ID:'SP-08',Plant_Name:'Kurnool South Solar',Asset_ID:'AST-00361',Asset_Tag:'SP-08-SCB-001',Source:'VIS-FND-00008'},
 'VIS-FND-00009':{Work_Order_ID:'WO-00149',Plant_ID:'SP-09',Plant_Name:'Anantapur Solar Park',Asset_ID:'AST-00403',Asset_Tag:'SP-09-SWG-001',Source:'VIS-FND-00009'},
 'VIS-FND-00012':{Work_Order_ID:'WO-00150',Plant_ID:'SP-12',Plant_Name:'Neemuch Solar Farm',Asset_ID:'AST-00545',Asset_Tag:'SP-12-SCB-001',Source:'VIS-FND-00012'}
};

function pools(){
 const out=[],add=x=>{if(Array.isArray(x))out.push(...x)};
 try{add(window.APM_IMPORTED_DATA?.['Work Orders'])}catch(_){}
 try{add(window.EMBEDDED_EXCEL_DATA?.['Work Orders'])}catch(_){}
 try{add(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData?.['Work Orders'])}catch(_){}
 try{if(typeof ALL_WOS!=='undefined')add(ALL_WOS);else add(window.ALL_WOS)}catch(_){add(window.ALL_WOS)}
 return out;
}
function value(x,...ks){for(const k of ks){const v=x?.[k];if(v!==undefined&&v!==null&&String(v)!=='')return v}return ''}
function findWO(c){
 return pools().find(w=>String(value(w,'Work_Order_ID','id','wo'))===c.Work_Order_ID &&
   String(value(w,'Plant_ID','plantId'))===c.Plant_ID &&
   String(value(w,'Asset_ID','assetId','asset'))===c.Asset_ID &&
   String(value(w,'Asset_Tag','assetTag'))===c.Asset_Tag &&
   String(value(w,'Source','source','visionCase','Source_Record_ID'))===c.Source) || null;
}
function currentAssessment(){
 const row=document.querySelector('#view-conditionbased tr[data-cbm-current="true"]');
 const id=((row?.textContent||'').match(/CBM-[A-Z]+-\d+/)||[])[0]||window.AIP_CONTEXT_NAV?.cbmAssessmentId||'';
 const srcs=[];
 const add=x=>{if(Array.isArray(x))srcs.push(x)};
 try{add(window.AIP_CBM_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.APM_IMPORTED_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.EMBEDDED_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.conditionBasedMaintenance?.['CBM Assessments'])}catch(_){}
 for(const a of srcs){const r=a.find(x=>String(x.CBM_Assessment_ID)===String(id));if(r)return r}
 return null;
}
function lockedRowHTML(c,w){
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const type=value(w,'Maintenance_Type','type')||'Corrective';
 const priority=value(w,'Priority','priority')||'—';
 const status=value(w,'Status','status')||'—';
 const crew=value(w,'Assigned_Crew','crew')||'—';
 const desc=value(w,'Description','desc')||'Governed CBM-linked work order';
 const cols=13;
 return `<tr class="aip-cbm-wo-target aip-wo-selected-row aip-authoritative-match" data-wo-id="${esc(c.Work_Order_ID)}" data-wo-search="${esc((c.Work_Order_ID+' '+c.Plant_ID+' '+c.Asset_ID+' '+c.Asset_Tag+' '+type+' '+priority+' '+status+' '+desc).toLowerCase())}">
   <td><span class="aip-cbm-wo-lock">LOCKED</span></td>
   <td><b>${esc(c.Work_Order_ID)}</b></td>
   <td><b>${esc(c.Plant_ID)} · ${esc(c.Plant_Name||c.Plant_ID)}</b><br>${esc(c.Asset_Tag)}<br><small>${esc(c.Asset_ID)}</small></td>
   <td>${esc(type)}</td>
   <td>${esc(priority)}</td>
   <td>${esc(status)}</td>
   <td>${esc(crew)}</td>
   <td>${esc(value(w,'parts','Parts_Status')||'—')}</td>
   <td>${esc(value(w,'permit','Permit_Status')||'—')}</td>
   <td>${esc(value(w,'loss','Energy_Loss_MWh')||'—')}</td>
   <td>${esc(value(w,'Estimated_Cost_INR','cost')||'—')}</td>
   <td>${esc(value(w,'erp','ERP_Status')||'—')}</td>
   <td><span class="aip-cbm-wo-lock">CBM SOURCE</span></td>
 </tr>`;
}
function ensureLockedRow(){
 const ctx=window.AIP_CBM_LOCKED_WO;if(!ctx)return false;
 const root=document.getElementById('view-workorderintelligence');if(!root)return false;
 const table=root.querySelector('#wo12-table,#aipWoLedgerTable,.ops-table');
 if(!table)return false;
 const tbody=table.querySelector('tbody');if(!tbody)return false;
 let hit=[...tbody.querySelectorAll('tr')].find(tr=>(tr.textContent||'').includes(ctx.Work_Order_ID));
 if(!hit){
   tbody.insertAdjacentHTML('afterbegin',lockedRowHTML(ctx,ctx.record||null));
   hit=tbody.querySelector('tr.aip-cbm-wo-target');
 }
 if(!hit)return false;
 tbody.querySelectorAll('tr').forEach(tr=>{
   if(tr!==hit && window.AIP_CBM_LOCKED_WO) tr.hidden=true;
 });
 hit.hidden=false;
 hit.classList.add('aip-cbm-wo-target','aip-wo-selected-row','aip-authoritative-match');
 const input=root.querySelector('#wo12-search,#aipWoLedgerSearch');
 if(input){input.value=ctx.Work_Order_ID}
 let note=root.querySelector('.aip-cbm-wo-context-note');
 if(!note){
   note=document.createElement('div');note.className='aip-cbm-wo-context-note';
   table.parentElement?.insertAdjacentElement('beforebegin',note);
 }
 if(note)note.textContent=`Locked CBM work order · ${ctx.Work_Order_ID} · ${ctx.Plant_ID} · ${ctx.Asset_Tag} · ${ctx.Asset_ID}`;
 hit.scrollIntoView?.({block:'center',behavior:'auto'});
 return true;
}

const priorOpen=window.cbm818OpenWO;
window.cbm818OpenWO=function(){
 const a=currentAssessment();
 const c=a?AIP845_CANON[String(a.Source_Record_ID||'')]:null;
 if(!a||!c){return priorOpen?.()}
 const exact=String(a.Plant_ID||'')===c.Plant_ID&&String(a.Asset_ID||'')===c.Asset_ID&&String(a.Asset_Tag||'')===c.Asset_Tag;
 if(!exact){
   console.error('CBM exact WO lineage mismatch',a,c);
   alert('Review exact WO is unavailable because the selected CBM assessment does not match the governed Plant / Asset lineage.');
   return;
 }
 const rec=findWO(c);
 window.AIP_CBM_LOCKED_WO={...c,record:rec,cbmAssessmentId:a.CBM_Assessment_ID};
 a.Work_Order_ID=c.Work_Order_ID;
 window.AIP_CONTEXT_NAV={source:'Condition-Based Maintenance',cbmAssessmentId:a.CBM_Assessment_ID,workOrderId:c.Work_Order_ID,assetId:c.Asset_ID,plantId:c.Plant_ID,target:'workorderintelligence'};
 window.AIP_WO_DESIRED_TAB='ledger';
 window.AIP_CBM_RETURN={id:a.CBM_Assessment_ID,target:'workorderintelligence',sourceRecordId:a.Source_Record_ID,workOrderId:c.Work_Order_ID};
 try{sessionStorage.setItem('aip.cbm.return',JSON.stringify(window.AIP_CBM_RETURN))}catch(_){}
 try{window.activate?.('workorderintelligence')}catch(_){document.querySelector('[data-view="workorderintelligence"]')?.click()}
 const go=()=>{
   const root=document.getElementById('view-workorderintelligence');if(!root)return false;
   try{window.renderWorkOrderIntelligence?.()}catch(_){}
   const ledger=[...root.querySelectorAll('.ops-tab')].find(b=>/Work Order Ledger/i.test(b.textContent||''));
   if(ledger&&!ledger.classList.contains('active')){ledger.click();return false}
   return ensureLockedRow();
 };
 requestAnimationFrame(()=>{if(!go())setTimeout(()=>{if(!go())setTimeout(go,80)},40)});
};

document.addEventListener('click',e=>{
 const row=e.target.closest?.('#view-workorderintelligence tr.aip-cbm-wo-target');
 if(row && window.AIP_CBM_LOCKED_WO){
   e.stopPropagation();
 }
},true);

window.AIP_V845_AUDIT={
 release:'v87_856',baseline:'v87_855',area:'CBM / Work Order Intelligence',
 changes:[
  'Review exact WO now locks and visibly surfaces the governed Work Order row in the Work Order Ledger',
  'Locked row explicitly shows matching site, asset tag and asset ID',
  'Evidence Gate and Engineering Physics Fit are aligned to the same top baseline and closed height',
  'Removed ambiguous attention count from Portfolio Condition Health cards',
  'Condition Health percentage now uses the same green family as the proportional health bar'
 ]
};
})();
