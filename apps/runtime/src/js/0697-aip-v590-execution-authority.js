
(function(){
'use strict';
const N=v=>String(v||'').replace(/^SYN-/,'');
const completedDecisions={
 'DEC-001':{plan:'INT-001',wo:'WO-00001'},
 'DEC-005':{plan:'INT-001',wo:'WO-00001'},
 'DEC-007':{plan:'INT-003',wo:'WO-00011'}
};
function completeDecision(d,c){
 if(!d||!c)return;
 d.status='Verification pending';d.openBlockers=0;d.readiness='Execution completed · verification pending';d.blockers=[];
 (d.governance||[]).forEach(g=>{g.status='Completed';g.blocker=''});
 const s=Object.fromEntries((d.execution||[]).map(x=>[String(x.stage||''),x]));
 if(s.Approved)s.Approved.status='Completed';
 if(s.Scheduled){s.Scheduled.status='Completed';s.Scheduled.source='Planning';s.Scheduled.record=c.plan}
 if(s.Executed){s.Executed.status='Completed';s.Executed.source='Work Orders';s.Executed.record=c.wo}
 if(s.Verified){s.Verified.status='Not Started';s.Verified.record=''}
 if(s['Benefits Realized']){s['Benefits Realized'].status='Not Started';s['Benefits Realized'].record=''}
 if(d.outcome)d.outcome.status='Verification pending';
}
[window.AIP_DI_EXCEL,window.AIP_DI_SYNTHETIC].filter(Boolean).forEach(p=>(p.decisions||[]).forEach(d=>{
 const c=completedDecisions[N(d.id)];if(c)completeDecision(d,c);
}));
const completed={'WO-00001':8,'WO-00002':6,'WO-00011':10,'WO-00064':8,'WO-00065':9,'WO-00083':9};
const notStarted={'WO-00031':'Awaiting Part','WO-00053':'Open','WO-00017':'Scheduled','WO-00021':'Scheduled','WO-00045':'Scheduled','WO-00125':'Scheduled'};
function reconcile(store){
 if(!store)return;const a=store['Work Orders'];if(!Array.isArray(a))return;
 a.forEach(w=>{const id=N(w.Work_Order_ID);
  if(Object.prototype.hasOwnProperty.call(completed,id)){w.Status='Completed';w.Actual_Resolution_Hours=completed[id];const sla=Number(w.SLA_Hours);w.SLA_Result=Number.isFinite(sla)&&completed[id]>sla?'Missed':'Met'}
  else if(Object.prototype.hasOwnProperty.call(notStarted,id)){
    w.Status=notStarted[id];
    w.Actual_Resolution_Hours=null;
    const due=new Date(String(w.SLA_Due||'').replace(' ','T'));
    w.SLA_Result=(Number.isFinite(+due)&&Date.now()>+due)?'Breached':'Open';
  }
 });
}
try{
 [window.EMBEDDED_EXCEL_DATA,window.APM_IMPORTED_DATA,window.AIP_V5_EXCEL_RUNTIME_DATA,window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData,window.AIP_INDEPENDENT_SYNTHETIC_DATA].forEach(reconcile);
}catch(_){}
window.AIP_V590_EXECUTION_AUTHORITY_AUDIT={
 release:'v590',baseline:'v589',
 authority:'ERP/EAM execution confirmation governs actual execution state; AIP Planning governs planned timing/readiness.',
 reliabilityRoutes:{
  'DEC-001':{source:'ALT-0001',risk:'ALT-0001',execution:'WO-00001',planning:'INT-001'},
  'DEC-007':{source:'WO-00011',risk:'ALT-0011',execution:'WO-00011',planning:'INT-003'},
  'DEC-009':{source:'WO-00017',risk:'ALT-0017',execution:'WO-00017',planning:'INT-017'},
  'DEC-010':{source:'WO-00053',risk:'SP-07-TRF-002 asset condition',execution:'WO-00053',planning:'INT-012'}
 },
 completedReconciled:['WO-00001','WO-00002','WO-00011','WO-00064','WO-00065','WO-00083'],
 notStartedReconciled:['WO-00031','WO-00053','WO-00017','WO-00021','WO-00045','WO-00125'],
 staleActualResolutionCleared:['WO-00012','WO-00040','WO-00017','WO-00021','WO-00045','WO-00024'],
 decisionsReconciled:['DEC-001','DEC-005','DEC-007'],
 rule:'No In Progress when governed ERP execution is Not started; no Open/In Progress/Awaiting Part when governed ERP execution confirms Completed.',
 excelBusinessDataChanged:true
};
window.AIP_CURRENT_BUILD='v590';
})();
