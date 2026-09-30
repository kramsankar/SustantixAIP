
window.AIP_V418_AUDIT={
 release:'v418',
 baseline:'v417',
 scope:'Operational Foundations · Asset Health Scoring Framework · Test & Explain dropdown scroll tracking',
 rootCause:'The highlighted row used scrollIntoView(), which could affect an ancestor/page and did not reliably advance the dropdown container scrollbar.',
 changes:[
  'ArrowUp/ArrowDown now update the asset dropdown container scrollTop directly',
  'The dropdown scrollbar thumb follows the highlighted asset as keyboard navigation moves beyond the currently visible rows',
  'Later and earlier assets are automatically brought into view without requiring mouse-wheel scrolling',
  'The page and left navigation are not scrolled by this operation',
  'Mouse hover, wheel scrolling, scrollbar dragging, click selection and Enter/Escape behavior remain unchanged',
  'No business data, scoring logic, formulas, thresholds, layout or asset population changed'
 ]
};
