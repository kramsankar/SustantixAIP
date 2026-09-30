
window.AIP_V195_AUDIT={
  release:'v1.95',
  baseline:'v1.94',
  excelBusinessDataChanged:false,
  changes:[
    'Fixed sticky containment: calendar row is now constrained by the entire Intervention Schedule card rather than the short header wrapper',
    'Calendar row locks at the top of the main workspace directly beneath the Sustantix 60px application banner',
    'Asset/intervention and Gantt rows continue scrolling vertically underneath the locked calendar',
    'Scrolling back above the calendar releases it naturally into its original document position',
    'Daily timeline cell width increased from 34px to 52px so month/year labels such as Sep 2026 are fully visible',
    'Legacy view/card containment that clipped sticky positioning is disabled only for the Intervention Schedule context'
  ]
};
