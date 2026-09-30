
window.AIP_V420_AUDIT={
 release:'v420',
 baseline:'v419',
 scope:'Operational Foundations · Asset Health Scoring Framework · Test & Explain deterministic one-row keyboard scrolling',
 rootCause:'Earlier versions treated ArrowUp/ArrowDown primarily as cursor navigation and only scrolled when the active row crossed the viewport edge. With four rows visible, the first three keypresses therefore appeared to do nothing to the scrollbar.',
 behavior:[
  'Each ArrowDown press advances the active asset exactly one record AND scrolls the dropdown down by one record height immediately',
  'Each ArrowUp press moves one record AND scrolls the dropdown up by one record height immediately',
  'The scrollbar thumb therefore moves from the first arrow press rather than waiting for the fourth/fifth row',
  'Stationary mouse position cannot reset the active keyboard row while records scroll underneath the pointer',
  'Physical mouse movement re-establishes the hovered row as the keyboard starting position',
  'Mouse wheel, draggable scrollbar, click-to-select, Enter and Escape remain available'
 ],
 noChange:['asset population','health scoring formulas','weights','thresholds','business data','framework layout']
};
