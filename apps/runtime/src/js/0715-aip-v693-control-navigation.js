
(function(){
 'use strict';
 const APPROVAL={
  'APR-260901':{label:'Optimization Plan',view:'resourceplanning',tab:'optimize',id:'INT-001',site:'SP-01'},
  'APR-260902':{label:'Work Order Release',view:'workorderintelligence',id:'WO-00105',site:'SP-04'},
  'APR-260903':{label:'Inventory Exception',view:'spares',tab:'inventory',id:'ERP-SP-07-PRT001',part:'PRT-001',site:'SP-07'},
  'APR-260904':{label:'AI Risk Action',view:'guardrails',tab:'log',id:'DEC-00105',site:'SP-09'},
  'APR-260905':{label:'Outbound Work Order',view:'integrations',id:'OUT-WO-5519',site:'SP-02'}
 };
 const AUDIT={
  'OPT-260916-041':{label:'Optimization audit event',view:'resourceplanning',tab:'optimize',id:'INT-001',auditId:'OPT-260916-041'},
  'WO-260916-118':{label:'Work order release audit event',view:'workorderintelligence',id:'WO-260916-118'},
  'INV-ERP-7812':{label:'Inventory interface audit event',view:'integrations',id:'INV-ERP-7812'},
  'AI-RSK-2407':{label:'AI risk audit event',view:'guardrails',tab:'log',id:'DEC-00105',auditId:'AI-RSK-2407'},
  'OUT-WO-5519':{label:'Outbound work-order audit event',view:'integrations',id:'OUT-WO-5519'}
 };
 let origin=null;
 function ca(){return document.getElementById('view-controlassurance')}
 function caTab(){const b=ca()?.querySelector('.aip679-tab.active');const t=b?.textContent.trim();return t==='Approvals'?'approvals':t==='Access & Roles'?'access':t==='Audit Trail'?'audit':'overview'}
 function captureOrigin(){origin={tab:caTab(),scroll:ca()?.scrollTop||0,status:document.getElementById('aip690ApprStatus')?.value||document.getElementById('aip679ApprStatus')?.value||'',site:document.getElementById('aip684ApprSite')?.value||'',search:document.getElementById('aip679Search')?.value||'',eventType:document.getElementById('aip690EventType')?.value||'',source:document.getElementById('aip690AuditSource')?.value||''};window.__aip693ControlReturn=origin;try{window.aipPushNavigationOrigin?.('controlassurance')}catch(_){}}
 function restore(){const o=window.__aip693ControlReturn||origin||{tab:'overview'};document.querySelector('.nav-item[data-view="controlassurance"]')?.click();setTimeout(()=>{window.aip679Tab?.(o.tab||'overview');setTimeout(()=>{if(o.tab==='approvals'){const st=document.getElementById('aip690ApprStatus'),si=document.getElementById('aip684ApprSite');if(st&&o.status)st.value=o.status;if(si&&o.site)si.value=o.site;window.aip690ApplyApprovals?.()}if(o.tab==='audit'){const q=document.getElementById('aip679Search'),et=document.getElementById('aip690EventType'),so=document.getElementById('aip690AuditSource');if(q)q.value=o.search||'';if(et&&o.eventType)et.value=o.eventType;if(so&&o.source)so.value=o.source;window.aip690AuditFilter?.()}const v=ca();if(v)v.scrollTop=o.scroll||0},20)},0);window.__aip693ControlReturn=null;origin=null}
 function context(t,s,ok){t.querySelectorAll('.aip693-context,.aip692-locked,.aip691-source-context,.aip690-source-context').forEach(x=>x.remove());const d=document.createElement('div');d.className='aip693-context'+(ok?'':' missing');d.innerHTML='<span>'+(ok?'Source record selected: ':'Source record not available in this destination: ')+'<b>'+s.label+'</b> · '+s.id+'</span><button type="button">Back to Control & Assurance</button>';d.querySelector('button').onclick=restore;t.prepend(d)}
 function exactTextRow(t,id){if(!id)return null;return [...t.querySelectorAll('tbody tr,tr,[data-id],[data-intervention-id],[data-record-id]')].find(r=>(r.textContent||'').includes(id))||null}
 function select(s){captureOrigin();document.querySelector('.nav-item[data-view="'+s.view+'"]')?.click();let n=0;const run=()=>{const t=document.getElementById('view-'+s.view);if(!t||!t.classList.contains('active')){if(n++<25)setTimeout(run,50);return}try{if(s.view==='resourceplanning')window.planSelect?.(s.id,'optimize');else if(s.view==='spares')window.msiSetTab?.(s.tab||'inventory');else if(s.view==='guardrails')window.aig49Tab?.('log')}catch(_){}t.querySelectorAll('.aip693-source-hit,.aip691-hit,.aip690-hit').forEach(x=>x.classList.remove('aip693-source-hit','aip691-hit','aip690-hit'));let row=exactTextRow(t,s.id);if(!row&&s.view==='spares'&&s.part)row=t.querySelector('tr[data-msi-part="'+s.part+'"][data-msi-site="'+s.site+'"]');if(!row&&s.view==='guardrails'){const data=(window.AIP_GUARDRAIL_DECISIONS||window.EMBEDDED_EXCEL_DATA?.['AI Guardrail Decisions']||[]),rec=data.find(x=>String(x.Decision_ID||x.id||'')===s.id);if(rec){const action=String(rec.Action||rec.action||''),policy=String(rec.Policy_ID||rec.policy||'');row=[...t.querySelectorAll('tbody tr')].find(r=>{const z=r.textContent||'';return (!action||z.includes(action))&&(!policy||z.includes(policy))})||null}}
 if(row){row.classList.add('aip693-source-hit');row.dataset.aip693Source=s.id;row.scrollIntoView({block:'center'});context(t,s,true)}else if(n++<16)setTimeout(run,70);else context(t,s,false)};setTimeout(run,30)}
 function approvalSource(id){const s=APPROVAL[id];if(s)select(s)}
 function auditSource(id){const s=AUDIT[id];if(s)select(s)}
 window.aip693ApprovalSource=approvalSource;window.aip693AuditSource=auditSource;window.aip693BackToControl=restore;
 document.addEventListener('click',function(e){
  const c=ca();
  if(c?.classList.contains('active')){
   const btn=e.target.closest('.aip679-nav,.aip680-sourcebtn');if(btn){
    const tr=btn.closest('tr');
    if(tr&&caTab()==='approvals'){const id=tr.cells[0]?.textContent.trim();if(APPROVAL[id]){e.preventDefault();e.stopImmediatePropagation();approvalSource(id);return}}
    if(tr&&caTab()==='audit'){const id=tr.cells[1]?.textContent.trim();if(AUDIT[id]){e.preventDefault();e.stopImmediatePropagation();auditSource(id);return}}
    if(caTab()==='overview'&&btn.classList.contains('aip680-sourcebtn')){const block=btn.closest('div[style*="border-bottom"]')||btn.parentElement,txt=block?.textContent||'';const id=txt.includes('Optimization Plan')?'APR-260901':txt.includes('Inventory Exception')?'APR-260903':txt.includes('AI Risk Action')?'APR-260904':null;if(id){e.preventDefault();e.stopImmediatePropagation();approvalSource(id);return}}
   }
  }
  if(window.__aip693ControlReturn){const b=e.target.closest('#aipGlobalBack,#navBackBtn,#backBtn,#navBack,#appBack,.back-btn,.nav-back,.top-back,.app-back,[data-back],[data-nav-back],button[title*="Back" i],button[aria-label*="Back" i]');if(b&&!b.closest('#view-controlassurance')){e.preventDefault();e.stopImmediatePropagation();restore();return}}
 },true);
 window.AIP_V693_AUDIT={release:'v693',baseline:'v692',universalControlReturn:true,approvalSourceDelegation:true,auditSourceDelegation:true,attentionSourceDelegation:true,noSiteOnlyFallback:true,exactRowRequiredForSuccess:true,dataChanged:false};window.AIP_CURRENT_BUILD='v693';
})();
