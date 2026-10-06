
(function(){
 if(window.__AIP_V797_FIRST_PAINT__)return;
 window.__AIP_V797_FIRST_PAINT__=true;
 function upgradePreventive(){
   const root=document.getElementById('view-preventive');
   const ws=root?.querySelector('.ms686-workspace');
   if(!ws)return false;
   const card=[...ws.querySelectorAll('.ms686-card')].find(c=>/Strategy Reasoning Graph/i.test(c.querySelector(':scope>.ms686-head h3')?.textContent||''));
   if(!card)return false;
   try{window.ms791RenderGraph?.('preventive')}catch(_){}
   const host=card.querySelector(':scope>.ms791-host');
   if(host){card.querySelector(':scope>.ms686-kg')?.remove();card.querySelector(':scope>.ms686-active-note')?.remove();return true}
   return false;
 }
 function boundedFirstPaint(){
   let n=0;
   const delays=[0,18,45,90,160,260];
   delays.forEach(d=>setTimeout(()=>{if(n>=0&&upgradePreventive())n=-1;else if(n>=0)n++;},d));
 }
 document.addEventListener('click',e=>{
   const el=e.target?.closest?.('[data-view]');
   if(!el)return;
   const v=String(el.dataset.view||'').toLowerCase();
   if(v==='predictive' && /maintenance strategy/i.test(el.textContent||'')) boundedFirstPaint();
   if(v==='preventive') boundedFirstPaint();
 },true);
 window.addEventListener('aip:runtime-ready',boundedFirstPaint,{once:true});
})();
