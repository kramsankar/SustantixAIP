
(function(){
'use strict';
function syncControlsSoon(){
  setTimeout(()=>{try{window.AIPSyncPortfolioControlState?.()}catch(_){}},0);
  setTimeout(()=>{try{window.AIPSyncPortfolioControlState?.()}catch(_){}},80);
}
document.addEventListener('click',e=>{
  const b=e.target?.closest?.('#view-operationaltwin .gf480-scopebtn');
  if(b)syncControlsSoon();
},false);
})();
