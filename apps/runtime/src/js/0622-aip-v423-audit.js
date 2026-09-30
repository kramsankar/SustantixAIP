
window.AIP_V423_AUDIT={
 release:'v423',
 baseline:'v422',
 scope:'Portfolio · Asset Intelligence Studio / Assistant redesign',
 findings:[
  'The synthetic Asset Registry generator creates 929 governed asset records after plant/class rounding',
  'Generic asset questions previously converted count intent into a health-sorted top-N table',
  'Voice recognition used continuous=false and replaced the textarea with the latest segment',
  'Conversation results had no per-result close control and only New chat cleared state'
 ],
 changes:[
  'Asset-count intent now returns the full governed count and source without an unnecessary shortlist',
  'How many assets do we have in AIP returns 929 for the current Synthetic asset population',
  'Voice dictation is continuous, accumulates final phrases, displays interim text and restarts after normal browser pause termination until explicitly stopped',
  'Microphone button visibly indicates listening state and has a live status line',
  'Submit stops voice cleanly and clears the compose box',
  'Reset clears voice state, query text, attachments and all results',
  'Each question/answer pair can be closed directly with an X control',
  'Browser microphone permission remains governed by browser security; the application does not attempt to bypass it'
 ],
 preserved:[
  'Offline NLP and Online AI modes',
  'existing source tags and charts',
  'v420 Test & Explain keyboard scrolling',
  'v421 RCM synchronized scrollbars',
  'v422 Test & Explain reset behavior'
 ]
};
