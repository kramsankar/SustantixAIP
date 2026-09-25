
(function(){
 const SVG='<svg class="ms741-down-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><line class="ms741-arrow-shaft" x1="8" y1="2" x2="8" y2="10"></line><polyline class="ms741-arrow-head" points="4.5,7.5 8,11 11.5,7.5"></polyline></svg>';
 function normalize(){
   document.querySelectorAll('#view-preventive .ms690-expand,#view-predictive .ms690-expand,#view-corrective .ms690-expand,#view-riskbased .ms690-expand,#view-adaptive .ms690-expand').forEach(b=>{
     if(!b.querySelector('.ms741-arrow-shaft')) b.innerHTML=SVG;
   });
 }
 const target=document.getElementById('main')||document.body;
 new MutationObserver(()=>requestAnimationFrame(normalize)).observe(target,{subtree:true,childList:true});
 document.addEventListener('aip:data-source-changed',()=>setTimeout(normalize,40));
 document.addEventListener('click',()=>setTimeout(normalize,20),true);
 setTimeout(normalize,20);setTimeout(normalize,180);setTimeout(normalize,500);
})();
