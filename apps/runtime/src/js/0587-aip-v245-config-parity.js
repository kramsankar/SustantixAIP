
(function(){
 const alternativeConfig=[
  {Alternative_ID:'ALT-STR-01',Objective_Name:'Balanced',Generation_Priority:1,Enabled:'Yes',Maximum_Per_Run:3,Duplicate_Key:'Intervention_ID + Proposed_Start',Governance_Status:'Approved',Governance_Note:'Composite governed objective; eligible whenever optimized alternatives are requested'},
  {Alternative_ID:'ALT-STR-02',Objective_Name:'Earliest Completion',Generation_Priority:2,Enabled:'Yes',Maximum_Per_Run:3,Duplicate_Key:'Intervention_ID + Proposed_Start',Governance_Status:'Approved',Governance_Note:'Prioritizes earliest hard-feasible completion'},
  {Alternative_ID:'ALT-STR-03',Objective_Name:'Lowest Execution Cost',Generation_Priority:3,Enabled:'Yes',Maximum_Per_Run:3,Duplicate_Key:'Intervention_ID + Proposed_Start',Governance_Status:'Approved',Governance_Note:'Prioritizes lowest governed execution cost'},
  {Alternative_ID:'ALT-STR-04',Objective_Name:'Resource Efficiency',Generation_Priority:4,Enabled:'Yes',Maximum_Per_Run:3,Duplicate_Key:'Intervention_ID + Proposed_Start',Governance_Status:'Approved',Governance_Note:'Prioritizes lowest resource burden / conflict score'},
  {Alternative_ID:'ALT-STR-05',Objective_Name:'Minimum Schedule Change',Generation_Priority:5,Enabled:'Yes',Maximum_Per_Run:3,Duplicate_Key:'Intervention_ID + Proposed_Start',Governance_Status:'Approved',Governance_Note:'Prioritizes minimum movement from baseline'}
 ];
 const compareConfig=[
  ['CMP-01','Plan completion','Earlier / lower elapsed time'],['CMP-02','Required Completion breaches','Lower'],['CMP-03','Resource conflicts','Lower'],['CMP-04','Crew hours','Context'],['CMP-05','Overtime hours','Lower'],['CMP-06','Execution cost','Lower'],['CMP-07','Schedule movement','Lower unless objective requires change'],['CMP-08','Hard constraint violations','Zero required']
 ].map(x=>({Measure_ID:x[0],Measure:x[1],Baseline_Required:'Yes',Alternative_Required:'Yes',Direction:x[2],Governance_Status:'Approved'}));
 const workflowConfig=[
  {Config_ID:'OPT-009',Parameter:'Maximum Optimized Alternatives',Value:3,Unit:'plans',Governance_Basis:'Governed upper bound; run-level selection may request 1, 2 or 3 optimized alternatives'},
  {Config_ID:'OPT-010',Parameter:'Default Optimized Alternatives',Value:3,Unit:'plans',Governance_Basis:'Default run selection; user may explicitly select 1, 2 or 3 before optimization'},
  {Config_ID:'OPT-011',Parameter:'Baseline Comparator',Value:'Always included',Unit:'rule',Governance_Basis:'Baseline is a first-class comparator and is not counted as an optimized alternative'},
  {Config_ID:'OPT-012',Parameter:'Baseline Retention',Value:'Permitted',Unit:'rule',Governance_Basis:'Retain Baseline is a valid recommendation and governance outcome'},
  {Config_ID:'OPT-013',Parameter:'Duplicate Alternative Suppression',Value:'Enabled',Unit:'rule',Governance_Basis:'Candidates with identical intervention start assignments are suppressed from comparison'},
  {Config_ID:'OPT-014',Parameter:'Recommendation Sequence',Value:'Compare → Recommend → Govern',Unit:'workflow',Governance_Basis:'Recommendation follows Schedule Alternatives; governance approves or returns the recommended plan'}
 ];
 try{
  window.EMBEDDED_EXCEL_DATA=window.EMBEDDED_EXCEL_DATA||{};
  window.EMBEDDED_EXCEL_DATA.PNO_Alternative_Config=alternativeConfig.map(x=>({...x}));
  window.EMBEDDED_EXCEL_DATA.PNO_Plan_Comparison_Config=compareConfig.map(x=>({...x}));
  window.EMBEDDED_EXCEL_DATA.PLAN_Optimization_Config=[...(window.EMBEDDED_EXCEL_DATA.PLAN_Optimization_Config||[]).filter(x=>!workflowConfig.some(y=>y.Config_ID===x.Config_ID)),...workflowConfig.map(x=>({...x}))];
  window.AIP_INDEPENDENT_SYNTHETIC_DATA=window.AIP_INDEPENDENT_SYNTHETIC_DATA||{};
  const p=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData||{};
  p.PNO_Alternative_Config=alternativeConfig.map(x=>({...x}));p.PNO_Plan_Comparison_Config=compareConfig.map(x=>({...x}));
  p.PLAN_Optimization_Config=[...(p.PLAN_Optimization_Config||[]).filter(x=>!workflowConfig.some(y=>y.Config_ID===x.Config_ID)),...workflowConfig.map(x=>({...x}))];
 }catch(e){console.error('v245 config parity',e)}
 window.AIP_V245_AUDIT={release:'v245',baseline:'v244',excelBusinessDataChanged:true,syntheticDataChanged:true,changes:[
  'Optimization solver yields to the browser event loop between intervention candidate expansions and alternative generation so the running spinner can repaint and the page remains responsive',
  'Optimization Assessment section and its drill route removed',
  'Optimized Alternatives run control added with explicit 1 / 2 / 3 selection; baseline is always a separate comparator',
  'Generated alternatives are deduplicated by intervention + proposed-start schedule signature',
  'Schedule Alternatives uses blue comparison headers',
  'Recommended Plan follows comparison and includes Retain Baseline plus only alternatives actually generated',
  'Governance approves the recommended plan rather than presenting a second competing plan selector',
  'Optimization Improvement and KPI typography constrained so values and mini bars stay inside cards',
  'Excel and Synthetic modes receive the same governed alternative and comparison configuration'
 ]};
 window.AIP_V245_SELF_TEST=function(){
  const issues=[];const html=document.documentElement.innerHTML;
  if(document.querySelector('#view-resourceplanning')&&/Optimization Assessment/.test(document.querySelector('#view-resourceplanning').innerText||''))issues.push('Optimization Assessment still visible');
  if(!window.AIP_V245_AUDIT)issues.push('Audit object missing');
  const ex=window.EMBEDDED_EXCEL_DATA||{},sy=window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData||{};
  if((ex.PNO_Alternative_Config||[]).length!==5)issues.push('Excel-mode alternative config missing');
  if((sy.PNO_Alternative_Config||[]).length!==5)issues.push('Synthetic-mode alternative config missing');
  return {pass:issues.length===0,issues,release:'v245'};
 };
})();
