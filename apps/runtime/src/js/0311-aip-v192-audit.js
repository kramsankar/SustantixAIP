
window.AIP_V192_AUDIT={
 release:'v1.92',
 baseline:'v1.91',
 excelBusinessDataChanged:false,
 fix:'Native three-surface scroll synchronization',
 changes:[
  'Removed CSS-transform based calendar movement entirely',
  'Calendar header is now a real native horizontal scroller with its scrollbar visually hidden',
  'Top scrollbar, calendar header and bottom Gantt viewport now synchronize bidirectionally using native scrollLeft',
  'Moving either visible scrollbar moves the other visible scrollbar and the calendar header to the same normalized horizon position',
  'Calendar dates and Gantt markers retain one shared timeline width derived from the selected planning horizon',
  'Sticky Intervention Schedule header remains visible during vertical scrolling'
 ]
};
