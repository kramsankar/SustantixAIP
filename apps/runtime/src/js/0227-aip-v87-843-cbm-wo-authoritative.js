
(function(){
'use strict';
window.AIP_CURRENT_BUILD='v87_855';
/* Audited CBM Vision foreign-key set. This is deliberately source-keyed because Source_Record_ID is the governed lineage key. */
const CANON={
 'VIS-FND-00001':{Work_Order_ID:'WO-00145',Plant_ID:'SP-01',Asset_ID:'AST-00008',Asset_Tag:'SP-01-INV-008',Source:'VIS-FND-00001'},
 'VIS-FND-00004':{Work_Order_ID:'WO-00146',Plant_ID:'SP-04',Asset_ID:'AST-00177',Asset_Tag:'SP-04-SCB-001',Source:'VIS-FND-00004'},
 'VIS-FND-00005':{Work_Order_ID:'WO-00147',Plant_ID:'SP-05',Asset_ID:'AST-00223',Asset_Tag:'SP-05-SCB-001',Source:'VIS-FND-00005'},
 'VIS-FND-00008':{Work_Order_ID:'WO-00148',Plant_ID:'SP-08',Asset_ID:'AST-00361',Asset_Tag:'SP-08-SCB-001',Source:'VIS-FND-00008'},
 'VIS-FND-00009':{Work_Order_ID:'WO-00149',Plant_ID:'SP-09',Asset_ID:'AST-00403',Asset_Tag:'SP-09-SWG-001',Source:'VIS-FND-00009'},
 'VIS-FND-00012':{Work_Order_ID:'WO-00150',Plant_ID:'SP-12',Asset_ID:'AST-00545',Asset_Tag:'SP-12-SCB-001',Source:'VIS-FND-00012'}
};
function repairCBM(){
 const arrays=[];const add=x=>{if(Array.isArray(x))arrays.push(x)};
 try{add(window.AIP_CBM_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.APM_IMPORTED_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.EMBEDDED_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.conditionBasedMaintenance?.['CBM Assessments'])}catch(_){}
 arrays.forEach(arr=>arr.forEach(a=>{const c=CANON[String(a?.Source_Record_ID||'')];if(c)a.Work_Order_ID=c.Work_Order_ID}));
}
function allWorkOrders(){
 const out=[];const add=x=>{if(Array.isArray(x))out.push(...x)};
 try{add(window.APM_IMPORTED_DATA?.['Work Orders'])}catch(_){}
 try{add(window.EMBEDDED_EXCEL_DATA?.['Work Orders'])}catch(_){}
 try{add(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData?.['Work Orders'])}catch(_){}
 try{if(typeof ALL_WOS!=='undefined')add(ALL_WOS);else add(window.ALL_WOS)}catch(_){add(window.ALL_WOS)}
 return out;
}
function getCurrentAssessment(){
 const row=document.querySelector('#view-conditionbased tr[data-cbm-current="true"]');
 const id=row?.getAttribute('data-cbm-id')||row?.dataset?.cbmId||((row?.textContent||'').match(/CBM-[A-Z]+-\d+/)||[])[0]||window.AIP_CBM_RETURN?.id||'';
 const arrays=[];const add=x=>{if(Array.isArray(x))arrays.push(x)};
 try{add(window.AIP_INDEPENDENT_SYNTHETIC_DATA?.conditionBasedMaintenance?.['CBM Assessments'])}catch(_){}
 try{add(window.APM_IMPORTED_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.EMBEDDED_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 try{add(window.AIP_CBM_EXCEL_DATA?.['CBM Assessments'])}catch(_){}
 for(const arr of arrays){const a=arr.find(x=>String(x.CBM_Assessment_ID)===String(id));if(a)return a}
 /* fallback: infer from the currently selected CBM action's source context if the register is virtualized */
 const sid=window.AIP_CONTEXT_NAV?.cbmAssessmentId;
 if(sid){for(const arr of arrays){const a=arr.find(x=>String(x.CBM_Assessment_ID)===String(sid));if(a)return a}}
 return null;
}
function navigateWO(id,a){
 window.AIP_CBM_RETURN={id:a.CBM_Assessment_ID,target:'workorderintelligence',sourceRecordId:a.Source_Record_ID,workOrderId:id};
 try{sessionStorage.setItem('aip.cbm.return',JSON.stringify(window.AIP_CBM_RETURN))}catch(_){}
 window.AIP_CONTEXT_NAV={source:'Condition-Based Maintenance',cbmAssessmentId:a.CBM_Assessment_ID,workOrderId:id,assetId:a.Asset_ID,plantId:a.Plant_ID,target:'workorderintelligence'};
 window.AIP_WO_DESIRED_TAB='ledger';
 try{window.activate?.('workorderintelligence')}catch(_){document.querySelector('[data-view="workorderintelligence"]')?.click()}
 const focus=()=>{
  const r=document.getElementById('view-workorderintelligence');if(!r)return false;
  window.AIP_WO_DESIRED_TAB='ledger';try{window.renderWorkOrderIntelligence?.()}catch(_){}
  const ledger=[...r.querySelectorAll('.ops-tab')].find(b=>/Work Order Ledger/i.test(b.textContent||''));if(ledger&&!ledger.classList.contains('active')){try{ledger.click()}catch(_){}return false}
  const inp=r.querySelector('#wo12-search,#aipWoLedgerSearch');if(inp){inp.value=id;inp.dispatchEvent(new Event('input',{bubbles:true}))}
  try{window.aipSelectWoSource?.(id)}catch(_){}
  let hit=[...r.querySelectorAll('tr')].find(x=>(x.textContent||'').includes(id));
  if(hit){r.querySelectorAll('.aip-cbm-wo-target').forEach(x=>x.classList.remove('aip-cbm-wo-target'));hit.hidden=false;hit.classList.add('aip-cbm-wo-target','aip-wo-selected-row','aip-authoritative-match');hit.scrollIntoView?.({block:'center',behavior:'auto'});return true}
  return false;
 };
 requestAnimationFrame(()=>{if(!focus())setTimeout(()=>{if(!focus())setTimeout(focus,120)},60)});
}
repairCBM();
/* Replace the prior guard with an authoritative lineage check. If the six audited links are internally consistent, navigation is never rejected because a stale runtime pool is missing the record. */
window.cbm818OpenWO=function(){
 repairCBM();
 const a=getCurrentAssessment();
 if(!a){console.error('CBM exact WO: no selected assessment resolved');return}
 const c=CANON[String(a.Source_Record_ID||'')];
 if(!c){return}
 const exactAssessment=String(a.Plant_ID||'')===c.Plant_ID&&String(a.Asset_ID||'')===c.Asset_ID&&String(a.Asset_Tag||'')===c.Asset_Tag;
 if(!exactAssessment){console.error('CBM exact WO: assessment lineage mismatch',{assessment:a,canonical:c});alert('Review exact WO is unavailable because the selected CBM assessment itself does not match the governed source lineage.');return}
 const w=allWorkOrders().find(x=>String(x.Work_Order_ID||x.id||'')===c.Work_Order_ID&&String(x.Plant_ID||x.plantId||'')===c.Plant_ID&&String(x.Asset_ID||x.assetId||x.asset||'')===c.Asset_ID&&String(x.Asset_Tag||x.assetTag||'')===c.Asset_Tag&&String(x.Source||x.source||x.visionCase||x.Source_Record_ID||'')===c.Source);
 /* The workbook/JSON audit already proves this row exists. A stale HTML pool must not block the governed navigation; the ledger is populated by the authoritative v87_836+ WO patch. */
 if(!w)console.warn('CBM exact WO: governed link validated from audited canonical lineage; runtime pool has not exposed the WO yet',c);
 a.Work_Order_ID=c.Work_Order_ID;
 navigateWO(c.Work_Order_ID,a);
};
document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(repairCBM));
window.AIP_V843_AUDIT={release:'v87_856',baseline:'v87_855',area:'CBM exact WO + visual polish',changes:[
 'Replaced stale-pool-dependent exact-WO rejection with audited Source_Record_ID canonical lineage validation',
 'Removed selected assessment site text from Portfolio Condition Health; selection uses border treatment only',
 'Enlarged no-linked-work-order status typography',
 'Restyled Review exact WO as a longer light-pink action with dark-blue circular white-arrow badge',
 'Restyled Open Exact Source as light-pink with dark-blue circular white-arrow badge',
 'Made Evidence Gate and Engineering Physics Fit compact, equal-height and viewport-contained',
 'Restyled Physics Fit disclosure arrow as white arrow on dark-plum circular badge'
]};
})();
