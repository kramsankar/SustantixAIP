
(function(){
 const strategyConfig=[
  {Strategy_ID:'OPT-STR-01',Strategy_Name:'Balanced',Selection_Allowed:'Yes',Default_Selected:'Yes',UI_Order:1,Maximum_Selected_Per_Run:3,Behavior:'Independent multi-objective profile',Governance_Status:'Approved'},
  {Strategy_ID:'OPT-STR-02',Strategy_Name:'Earliest Completion',Selection_Allowed:'Yes',Default_Selected:'No',UI_Order:2,Maximum_Selected_Per_Run:3,Behavior:'Earliest hard-feasible completion',Governance_Status:'Approved'},
  {Strategy_ID:'OPT-STR-03',Strategy_Name:'Lowest Execution Cost',Selection_Allowed:'Yes',Default_Selected:'No',UI_Order:3,Maximum_Selected_Per_Run:3,Behavior:'Lowest governed execution cost',Governance_Status:'Approved'},
  {Strategy_ID:'OPT-STR-04',Strategy_Name:'Resource Efficiency',Selection_Allowed:'Yes',Default_Selected:'No',UI_Order:4,Maximum_Selected_Per_Run:3,Behavior:'Lowest resource burden / conflicts',Governance_Status:'Approved'},
  {Strategy_ID:'OPT-STR-05',Strategy_Name:'Minimum Schedule Change',Selection_Allowed:'Yes',Default_Selected:'No',UI_Order:5,Maximum_Selected_Per_Run:3,Behavior:'Minimum movement from baseline',Governance_Status:'Approved'}
 ];
 const workflowConfig=[
  {Config_ID:'OPT-009',Parameter:'Maximum Selected Optimization Strategies',Value:3,Unit:'strategies',Priority:0,Governance_Basis:'Governed upper bound for a single optimization run'},
  {Config_ID:'OPT-010',Parameter:'Default Selected Optimization Strategy',Value:'Balanced',Unit:'strategy',Priority:0,Governance_Basis:'Balanced is selected by default; it remains an independent multi-objective strategy'},
  {Config_ID:'OPT-011',Parameter:'Baseline Comparator',Value:'Always included',Unit:'rule',Priority:0,Governance_Basis:'Baseline is a first-class comparator and is not counted as an optimized alternative'},
  {Config_ID:'OPT-012',Parameter:'Baseline Retention',Value:'Permitted',Unit:'rule',Priority:0,Governance_Basis:'Retain Baseline is a valid recommendation and governance outcome'},
  {Config_ID:'OPT-013',Parameter:'Duplicate Alternative Suppression',Value:'Enabled',Unit:'rule',Priority:0,Governance_Basis:'Selected strategies producing identical schedules are shown once'},
  {Config_ID:'OPT-014',Parameter:'Recommendation Sequence',Value:'Compare → Recommend → Govern',Unit:'workflow',Priority:0,Governance_Basis:'Recommendation follows Schedule Alternatives; governance approves or returns the recommended plan'},
  {Config_ID:'OPT-015',Parameter:'Strategy Selection',Value:'User selects 1 to 3 approved strategies',Unit:'rule',Priority:0,Governance_Basis:'Generate alternatives only for explicitly selected strategies; do not auto-fill first N strategies'},
  {Config_ID:'OPT-016',Parameter:'Locked Planning Context',Value:'Planning basis + horizon + interventions in scope',Unit:'rule',Priority:0,Governance_Basis:'Inherited from Plan & Resources and displayed read-only in Optimize & Govern'},
  {Config_ID:'OPT-017',Parameter:'Balanced Strategy Behavior',Value:'Independent multi-objective profile',Unit:'rule',Priority:0,Governance_Basis:'Selecting Balanced does not automatically select the other individual strategies'},
  {Config_ID:'OPT-018',Parameter:'Selected Strategy Naming',Value:'Alternative — Strategy Name',Unit:'rule',Priority:0,Governance_Basis:'Comparison columns retain exact selected strategy identity for auditability'}
 ];
 const enrichObjectives=rows=>(rows||[]).map(x=>{const cfg=strategyConfig.find(c=>c.Strategy_Name===x.Objective_Name);return cfg?{...x,Selection_Allowed:cfg.Selection_Allowed,Default_Selected:cfg.Default_Selected,UI_Order:cfg.UI_Order}:x});
 const apply=root=>{root.PNO_Optimization_Strategy_Config=strategyConfig.map(x=>({...x}));root.PLAN_Optimization_Config=[...(root.PLAN_Optimization_Config||[]).filter(x=>!workflowConfig.some(y=>y.Config_ID===x.Config_ID)),...workflowConfig.map(x=>({...x}))];root.PNO_Optimization_Objectives=enrichObjectives(root.PNO_Optimization_Objectives)};
 try{window.EMBEDDED_EXCEL_DATA=window.EMBEDDED_EXCEL_DATA||{};apply(window.EMBEDDED_EXCEL_DATA);window.AIP_INDEPENDENT_SYNTHETIC_DATA=window.AIP_INDEPENDENT_SYNTHETIC_DATA||{};const p=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData||{};apply(p)}catch(e){console.error('v246 config parity',e)}
 window.AIP_V246_AUDIT={release:'v246',baseline:'v245',excelBusinessDataChanged:true,syntheticDataChanged:true,changes:[
  'Planning Basis, Planning Horizon and Interventions in Scope are inherited from Plan & Resources and rendered as light-gray locked context with dark text',
  'Removed Optimization Objective and Optimized Alternatives count dropdowns',
  'Added explicit governed checkbox selection for Balanced, Earliest Completion, Lowest Execution Cost, Resource Efficiency and Minimum Schedule Change',
  'Maximum three strategies per run; Balanced defaults selected and remains independent rather than selecting every strategy',
  'Solver generates only explicitly selected strategies with no first-N or unselected-strategy fallback',
  'Duplicate schedule signatures remain suppressed and are disclosed in Schedule Alternatives',
  'Selected strategy identity is retained in comparison, governance summary and lineage',
  'Excel and embedded Synthetic configurations use the same selection and locked-context rules'
 ]};
 window.AIP_V246_SELF_TEST=function(){const issues=[],ex=window.EMBEDDED_EXCEL_DATA||{},sy=window.AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData||{};if((ex.PNO_Optimization_Strategy_Config||[]).length!==5)issues.push('Excel strategy config missing');if((sy.PNO_Optimization_Strategy_Config||[]).length!==5)issues.push('Synthetic strategy config missing');if(!/Maximum Selected Optimization Strategies/.test(JSON.stringify(ex.PLAN_Optimization_Config||[])))issues.push('Excel workflow config not updated');if(!/Locked Planning Context/.test(JSON.stringify(sy.PLAN_Optimization_Config||[])))issues.push('Synthetic locked-context config missing');return {pass:issues.length===0,issues,release:'v246'}};
})();
