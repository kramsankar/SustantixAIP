
(function(){
 const schedulingRules=[
  {Rule_ID:'SCH-01',Rule_Name:'Scheduling method',Rule_Type:'METHOD',Rule_Value:'Backward — Required Completion',Governance_Status:'Approved'},
  {Rule_ID:'SCH-02',Rule_Name:'Crew skill mandatory',Rule_Type:'HARD_CONSTRAINT',Rule_Value:'Yes',Governance_Status:'Approved'},
  {Rule_ID:'SCH-03',Rule_Name:'Material availability mandatory',Rule_Type:'HARD_CONSTRAINT',Rule_Value:'Yes',Governance_Status:'Approved'},
  {Rule_ID:'SCH-04',Rule_Name:'Tool availability mandatory',Rule_Type:'HARD_CONSTRAINT',Rule_Value:'Yes',Governance_Status:'Approved'},
  {Rule_ID:'SCH-05',Rule_Name:'Vehicle availability mandatory',Rule_Type:'HARD_CONSTRAINT',Rule_Value:'Yes',Governance_Status:'Approved'},
  {Rule_ID:'SCH-06',Rule_Name:'Site / access availability mandatory',Rule_Type:'HARD_CONSTRAINT',Rule_Value:'Yes',Governance_Status:'Approved'},
  {Rule_ID:'SCH-07',Rule_Name:'Outage window mandatory when required',Rule_Type:'HARD_CONSTRAINT',Rule_Value:'Yes',Governance_Status:'Approved'},
  {Rule_ID:'SCH-08',Rule_Name:'Weather influence',Rule_Type:'INFORMATIONAL_ONLY',Rule_Value:'No',Governance_Status:'Approved'}
 ];
 const objectives=[
  {Objective_ID:'OBJ-01',Objective_Name:'Earliest Completion',Metric:'Plan_Completion_Hours',Direction:'Minimize',Weight:1,Governance_Status:'Approved'},
  {Objective_ID:'OBJ-02',Objective_Name:'Lowest Execution Cost',Metric:'Execution_Cost_INR',Direction:'Minimize',Weight:1,Governance_Status:'Approved'},
  {Objective_ID:'OBJ-03',Objective_Name:'Resource Efficiency',Metric:'Resource_Conflict_Count',Direction:'Minimize',Weight:1,Governance_Status:'Approved'},
  {Objective_ID:'OBJ-04',Objective_Name:'Minimum Schedule Change',Metric:'Schedule_Movement_Hours',Direction:'Minimize',Weight:1,Governance_Status:'Approved'},
  {Objective_ID:'OBJ-05',Objective_Name:'Balanced',Metric:'Composite_Governed_Objective',Direction:'Minimize',Weight:1,Governance_Status:'Approved'}
 ];
 const iface=[
  {Interface_ID:'OPT-API-01',Engine:'External Solver',Direction:'AIP → Solver',Payload:'Baseline Plan + Constraints + Objective',Status:'Configured',Validation_Required:'Yes'},
  {Interface_ID:'OPT-API-02',Engine:'External Solver',Direction:'Solver → AIP',Payload:'Schedule Alternatives + Assignments + Metrics',Status:'Configured',Validation_Required:'Yes'},
  {Interface_ID:'OPT-AIP-01',Engine:'AIP Optimizer',Direction:'Internal',Payload:'Baseline Plan + Constraints + Objective',Status:'Available',Validation_Required:'Yes'}
 ];
 window.EMBEDDED_EXCEL_DATA=window.EMBEDDED_EXCEL_DATA||{};
 window.EMBEDDED_EXCEL_DATA.PNO_Scheduling_Rules=schedulingRules;
 window.EMBEDDED_EXCEL_DATA.PNO_Optimization_Objectives=objectives;
 window.EMBEDDED_EXCEL_DATA.PNO_Optimization_Interface=iface;
 window.AIP_INDEPENDENT_SYNTHETIC_DATA=window.AIP_INDEPENDENT_SYNTHETIC_DATA||{};
 const p=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData=window.AIP_INDEPENDENT_SYNTHETIC_DATA.platformSyntheticData||{};
 p.PNO_Scheduling_Rules=schedulingRules.map(x=>({...x}));
 p.PNO_Optimization_Objectives=objectives.map(x=>({...x}));
 p.PNO_Optimization_Interface=iface.map(x=>({...x}));
 window.planViewAlternative=function(altId,intId){try{U.selected=intId;U.tab='schedule';render()}catch(e){console.error(e)}};
 window.planGovernSelected=function(decision){try{
   U.planGovernance=U.planGovernance||{};
   U.planGovernance.status=decision==='Return for Re-optimization'?'Returned for Re-optimization':decision==='Approve with Conditions'?'Approved with Conditions':'Approved';
   if(/^Approved/.test(U.planGovernance.status)){/* approved plan governance retained; Intervention Schedule renderer remains unchanged */}
   render();
 }catch(e){console.error(e)}};
 window.AIP_V218_AUDIT={release:'v2.18',baseline:'v2.17',area:'Planning & Optimization · Optimize & Govern + Intervention Schedule terminology',excelBusinessDataChanged:true,syntheticDataChanged:true};
})();
