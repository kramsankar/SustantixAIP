
window.AIP_V188_AUDIT={
 release:'v1.88',
 baseline:'v1.87',
 excelBusinessDataChanged:false,
 changes:[
  'Calendar header no longer relies on hidden-viewport scrollLeft; it is translated by the exact top/bottom scrollbar position',
  'Gantt markers and calendar dates therefore share one horizontal time offset',
  'Weekly labels include year, including 2027 when a 12-month horizon crosses the year boundary',
  'Daily labels include year as well',
  'A 12-month weekly horizon generates the full weekly sequence through the governed horizon end date',
  'Scale changes reset both timeline scrollbars and calendar axis to Week/Day/Month 1 at the left edge'
 ]
};
