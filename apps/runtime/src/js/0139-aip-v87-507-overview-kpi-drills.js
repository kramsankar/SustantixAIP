
(function(){
 document.addEventListener('click',function(e){
  const cards=[...document.querySelectorAll('#view-overview .ov507-core-kpis>.ov507-drill')];
  const c=e.target.closest('#view-overview .ov507-core-kpis>.ov507-drill'); if(!c)return;
  const i=cards.indexOf(c); if(i===0)activate('lossintelligence'); else if(i===1)activate('carbonwater');
 });
 document.addEventListener('keydown',function(e){if(e.key!=='Enter'&&e.key!==' ')return;const c=e.target.closest('#view-overview .ov507-core-kpis>.ov507-drill');if(!c)return;e.preventDefault();c.click();});
})();
