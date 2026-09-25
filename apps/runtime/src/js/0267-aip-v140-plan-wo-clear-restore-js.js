
(function(){
'use strict';
window.planV139ClearWOHighlight=function(){
  const root=document.getElementById('view-workorderintelligence');
  if(!root)return;

  /* Remove every contextual/selection outline applied by the Planning exact-WO drill. */
  root.querySelectorAll('.aip-v139-plan-wo-target,.aip-v121-plan-target,.aip-wo-selected-row,.aip-authoritative-match')
      .forEach(el=>el.classList.remove('aip-v139-plan-wo-target','aip-v121-plan-target','aip-wo-selected-row','aip-authoritative-match'));
  root.querySelectorAll('.aip-v139-wo-banner,.aip-v121-context-banner').forEach(el=>el.remove());

  /* Restore the complete ledger population, not merely the row styling. */
  const search=root.querySelector('#wo12-search,#aipWoLedgerSearch') ||
    [...root.querySelectorAll('input[type="search"],input')].find(x=>/Search WO, asset, site, crew or status/i.test(x.placeholder||''));
  if(search){
    search.value='';
    search.dispatchEvent(new Event('input',{bubbles:true}));
  }
  const status=root.querySelector('#wo12-status-filter');
  if(status){
    status.value='All';
    status.dispatchEvent(new Event('change',{bubbles:true}));
  }

  /* Defensive restore for any ledger implementation that had rows hidden directly. */
  root.querySelectorAll('#wo12-table tbody tr[data-wo12-id],#aipWoLedgerTable tbody tr,[data-wo-id]')
      .forEach(tr=>{tr.hidden=false; tr.style.removeProperty('display');});

  const count=root.querySelector('#wo12-count');
  if(count){
    const n=root.querySelectorAll('#wo12-table tbody tr[data-wo12-id]').length;
    if(n)count.textContent=n+' work orders';
  }
};
window.planV140ClearWOHighlight=window.planV139ClearWOHighlight;
window.AIP_V140_AUDIT={release:'v1.40',baseline:'v1.39',area:'Planning & Optimization → Work Order Intelligence contextual drill',uiOnly:true,excelBusinessDataChanged:false,changes:['Clear highlight now clears the exact Work Order search filter and restores the complete Work Order Ledger population','Clear highlight resets the ledger status filter to All','Removes Planning contextual highlight, authoritative-match and selected-row boundary classes','Keeps the user on Work Order Ledger after clearing context']};
})();
