
window.AIP_V424_AUDIT={
 release:'v424',
 baseline:'v423',
 scope:'Portfolio · Asset Intelligence Studio / Assistant interaction correction',
 changes:[
  'Voice input is one-shot: click microphone, speak one question, transcript finalizes, microphone stops',
  'Transcript remains editable and cursor is placed at the end',
  'Added explicit navy circular ↑ Ask button',
  'Added visible Clear button beside the microphone',
  'Spoken clear/reset/start over commands clear the transcript without searching',
  'Speaking alone never runs a query; ↑ or Enter explicitly submits it',
  'Offline mode remains governed search over the active AIP / Excel dataset',
  'Reset and per-answer close controls remain available'
 ],
 architectureNote:'A standalone HTML can provide governed local search without an external AI service. ChatGPT-class conversational reasoning requires a secure backend/API integration; API credentials must not be embedded in the HTML.'
};
