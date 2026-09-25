
window.AIP_V193_AUDIT={
 release:'v1.93',baseline:'v1.92',excelBusinessDataChanged:false,
 changes:[
  'Removed all prior Intervention Schedule scroll-sync implementations and installed one authoritative global controller',
  'Top and bottom scrollbar now synchronize by the same exact pixel scrollLeft, not by independent ratios',
  'Calendar axis is clipped to the visible window and shifted by that exact same pixel offset',
  'Full timeline canvas width remains horizon-derived, so future time buckets appear as the bars move right',
  'Markers remain date-pegged inside the scrolling timeline and appear/disappear solely based on viewport position'
 ]
};
