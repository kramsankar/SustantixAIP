
window.AIP_V419_AUDIT={
 release:'v419',
 baseline:'v418',
 scope:'Operational Foundations · Asset Health Scoring Framework · Test & Explain visible-row scroll tracking',
 rootCause:'The v418 scroll calculation used option offsetTop values, which could be relative to an intermediate positioned ancestor rather than the dropdown scroll container. The active cursor moved, but the visible dropdown viewport and scrollbar thumb did not reliably follow.',
 changes:[
  'Dropdown scrolling now uses getBoundingClientRect geometry relative to the asset menu viewport',
  'When the highlighted row reaches the bottom edge, the menu scrollTop advances by the exact overflow distance',
  'When the highlighted row reaches the top edge, the menu scrollTop moves upward by the exact overflow distance',
  'Added a row-height fallback if browser geometry does not immediately alter the scroll position',
  'The dropdown scrollbar thumb must now move together with keyboard navigation beyond the visible 3–4 rows',
  'Mouse wheel, scrollbar drag, hover, click selection, Enter and Escape are preserved',
  'No business data, scoring formula, thresholds, layout or asset population changed'
 ]
};
