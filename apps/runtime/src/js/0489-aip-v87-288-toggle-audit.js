
(function(){
 const sourceDependent=[
 'overview','portfoliobenchmarking','assetexplorer','assetrelationships','lossintelligence','commercialppa',
 'contextgraph','operationaltwin','decisionintelligence','decisionworkspace','scenariosimulator2','benefitsrealization',
 'decisiontraceability','workorderintelligence','predictive','corrective','adaptive','rootcause','eventreconstruction',
 'maintenancelearning','warrantyrecovery','aivision','reliabilityengineering','rcm','resourceplanning','crewscheduling',
 'spares','approval','closedloopexecution','preventive','prescriptive','riskbased','opportunistic','esgoverview',
 'climateintelligence','reliabilityrisk','financialimpact','carbonwater','hseclimate','circularity','dataquality'
 ];
 const sourceIndependent=['dataexplorer','datamanagement','integrations','apiconnectors','assethealthmodel','models','aigovernance','actionprioritization','workorderconstraintprioritization','securityaudit'];
 window.AIP_TOGGLE_AUDIT={sourceDependent,sourceIndependent,
  operationalImpactExpected:()=>({
   excelIssues:405,syntheticIssues:431,
   excelCritical:154,syntheticCritical:125,
   note:'Expected counts from the bundled Excel and independent Synthetic source records in v87_288.'
  })
 };
})();
