
window.AIP_V416_AUDIT={
 release:'v416',
 baseline:'v415',
 scope:'Operational Foundations · Asset Health Scoring Framework · Test & Explain keyboard ownership',
 rootCause:'Global AIP arrow-key navigation was receiving Up/Down keystrokes from the Test & Explain picker and moving focus/navigation to the left pane.',
 changes:[
  'Captured ArrowUp, ArrowDown, Enter and Escape inside the Test & Explain picker before global handlers can receive them',
  'Stopped propagation and immediate propagation for picker navigation keys',
  'Up/Down now move only within the asset list and auto-scroll the highlighted row',
  'Enter selects the highlighted asset; Escape closes the asset list',
  'Mouse hover/wheel scrolling remains unchanged',
  'No layout, scoring logic, data, formulas, thresholds or asset population changed'
 ]
};
