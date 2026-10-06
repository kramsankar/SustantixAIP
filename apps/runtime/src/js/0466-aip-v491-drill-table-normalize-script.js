
(function(){
'use strict';
function normalizeForecastDrillTables(root){
  const scope=root||document;
  scope.querySelectorAll('.gf476-gridtable table,.gf480-modal table').forEach(t=>{
    t.style.tableLayout='fixed';
    t.style.width='100%';
    t.querySelectorAll('th,td').forEach(c=>{
      c.style.whiteSpace='normal';
      c.style.overflow='visible';
      c.style.textOverflow='clip';
      c.style.overflowWrap='anywhere';
      c.style.wordBreak='normal';
      c.style.fontFamily='Arial, sans-serif';
      c.style.fontSize='8px';
      c.style.lineHeight='1.25';
    });
  });
}
document.addEventListener('click',e=>{
  if(e.target?.closest?.('#view-operationaltwin .gf476-nav,#view-operationaltwin .gf480-nav')){
    setTimeout(()=>normalizeForecastDrillTables(document),0);
    setTimeout(()=>normalizeForecastDrillTables(document),80);
  }
},true);
document.addEventListener('aip:data-source-changed',()=>setTimeout(()=>normalizeForecastDrillTables(document),80));
document.addEventListener('apm:datasource-refreshed',()=>setTimeout(()=>normalizeForecastDrillTables(document),80));
window.AIPNormalizeForecastDrillTables=normalizeForecastDrillTables;
setTimeout(()=>normalizeForecastDrillTables(document),300);
})();
