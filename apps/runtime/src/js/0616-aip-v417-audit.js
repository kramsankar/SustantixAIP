
window.AIP_V417_AUDIT={
 release:'v417',
 baseline:'v416',
 scope:'Operational Foundations · Asset Health Scoring Framework · Test & Explain arrow-key isolation',
 rootCause:'Hovering the asset menu did not transfer keyboard focus/scope from the previously focused sidebar navigation item. Therefore ArrowDown could still originate from the sidebar and activate Portfolio Action Prioritization before picker-level handlers could own the interaction.',
 changes:[
  'Pointer-enter on the open asset menu establishes Test & Explain keyboard scope and focuses the search field without scrolling the page',
  'A window-capture key handler intercepts ArrowUp, ArrowDown, Enter and Escape before AIP document/sidebar capture handlers',
  'The hovered asset row is retained as the current keyboard position',
  'ArrowDown advances from the hovered row; ArrowUp moves to the previous row',
  'The list auto-scrolls to keep the highlighted row visible',
  'No arrow key from an active Test & Explain list can reach sidebar navigation',
  'Mouse-wheel scrolling, scrollbar dragging and click-to-select remain available',
  'No business data, score formula, weights, thresholds, layout or asset population changed'
 ]
};
