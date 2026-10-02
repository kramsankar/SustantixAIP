
window.AIP_V591_DECISION_TRACE_AUDIT={
 release:'v591',baseline:'v590',
 businessFlowChanged:false,
 secondView:'Decision Trace',
 coverage:'All decisions exposed through Decision Overview / Asset-to-Value Intelligence',
 rules:[
  'Primary source uses governed source-specific routing.',
  'Supporting evidence preserves exact record navigation and displays evidence quality.',
  'Work-order IDs are never passed into Predictive as model/alert IDs.',
  'DEC-001, DEC-007 and DEC-009 use ALT-0001, ALT-0011 and ALT-0017 for predictive condition trace.',
  'DEC-010 uses SP-07-TRF-002 asset-condition trace; no predictive alert is fabricated.',
  'Live reconciled Work Order status replaces stale status text inside Decision Trace only.',
  'Decision Value opens the selected governed decision; Governed Decision opens Governance & Approval.',
  'Execution / Handoff opens the exact governed WO when one exists, otherwise the selected decision execution stage.',
  'Outcome navigation is enabled only when a governed benefits record exists.'
 ],
 excelBusinessDataChanged:false
};
window.AIP_CURRENT_BUILD='v592';
