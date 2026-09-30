
(function(){
 function refresh(){if(document.getElementById('view-contextgraph')?.classList.contains('active')&&typeof renderGraph==='function')renderGraph()}
 document.addEventListener('aip:data-source-changed',()=>setTimeout(refresh,0));
 document.addEventListener('apm:datasource-refreshed',()=>setTimeout(refresh,0));
 window.addEventListener('aip:data-rendered',refresh);
})();
