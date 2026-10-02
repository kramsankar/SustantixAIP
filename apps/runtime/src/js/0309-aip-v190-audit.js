
window.AIP_V190_AUDIT={
 release:'v1.90',baseline:'v1.89',excelBusinessDataChanged:false,
 architecture:'Single shared horizontal time viewport',
 changes:[
  'Calendar axis and Gantt body now live inside the same physical horizontally scrollable container',
  'Bottom scrolling therefore moves calendar dates and Gantt markers together by construction',
  'Top scrollbar is a synchronized proxy for that same single time viewport',
  'Scrolling either top or bottom updates the other scrollbar',
  'Fixed left Asset/Intervention pane and legend do not move horizontally',
  'Full horizon width remains based on generated Daily/Weekly/Monthly/Yearly units'
 ]
};
