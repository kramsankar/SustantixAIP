
window.AIP_V422_AUDIT={
 release:'v422',
 baseline:'v421',
 scope:'Operational Foundations · Asset Health Scoring Framework · Test & Explain browse-state reset',
 behavior:[
  'Closing the asset dropdown without selecting an asset discards the hover/keyboard browse position',
  'The dropdown scrollTop is reset to 0 whenever the menu closes',
  'Reopening an empty Test & Explain picker starts again from the first governed asset record',
  'Hover active state and keyboard active index are cleared on close',
  'A genuinely selected asset remains in the search box and its explanation remains unchanged',
  'v420 keyboard scrolling and v421 RCM table improvements are preserved'
 ],
 noChange:['asset population','health scoring formulas','weights','thresholds','RCM logic','business data']
};
