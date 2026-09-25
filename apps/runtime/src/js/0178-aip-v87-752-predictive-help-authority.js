
(function(){
 const k=[
  {name:'Predictive Models in Production',formula:'Count of Predictive Model Registry records where Deployment_Status = Production.',unit:'models',scope:'Active Excel or Synthetic data source.',rules:'Counts only models explicitly registered for Predictive Maintenance; Shadow/Pilot/Planned models are excluded.',meaning:'Governed predictive models currently approved for production use.'},
  {name:'Avg. Detection Lead Time',formula:'Average of (Failure/Impact Timestamp − First Valid Detection Timestamp) across validated True Positive predictions.',unit:'days',scope:'Validated true-positive prediction outcomes in the active data source.',rules:'Exclude false positives, false negatives and records missing either timestamp.',meaning:'Average useful warning time before the predicted condition becomes production-impacting.'},
  {name:'False Positive Rate',formula:'100 × False Positives ÷ (False Positives + True Negatives).',unit:'%',scope:'Validated model-classification outcomes in the active data source.',rules:'Uses the conventional FPR denominator; unresolved/unvalidated records are excluded.',meaning:'Share of actual negative cases incorrectly flagged positive; lower is better.'},
  {name:'Predictive Incident Resolution Rate',formula:'100 × Resolved actionable predictive incidents ÷ actionable predictive incidents due for resolution.',unit:'%',scope:'Actionable validated predictive incidents due for resolution.',rules:'Only incidents marked actionable and due are included; not-applicable validation windows are excluded.',meaning:'How effectively predictive detections are converted into completed operational resolution.'}
 ];
 try{if(typeof KPI_FORMULA_HELP!=='undefined')KPI_FORMULA_HELP.predictive=k;}catch(_e){}
 try{if(typeof FINAL_SCREEN_HELP!=='undefined'&&FINAL_SCREEN_HELP.predictive)FINAL_SCREEN_HELP.predictive.kpis=k;}catch(_e){}
})();
