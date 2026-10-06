
(function(){
'use strict';
function cleanOverviewOM(){
  const host=document.getElementById('view-overview'); if(!host)return;

  const allTables=[...host.querySelectorAll('table')];

  /* Site Registry: blue column-header row with white labels. */
  const registryTable=allTables.find(t=>{
    const h=[...t.querySelectorAll('thead th')].map(x=>(x.textContent||'').trim().toLowerCase());
    return h.includes('site') && h.includes('name') && h.includes('state') && h.includes('health') && h.includes('commissioned');
  });
  if(registryTable){
    const rhead=registryTable.querySelector('thead');
    if(rhead){
      rhead.style.background='#2A5C8A';
      rhead.querySelectorAll('tr').forEach(tr=>tr.style.background='#2A5C8A');
      rhead.querySelectorAll('th').forEach(th=>{
        th.style.setProperty('background','#2A5C8A','important');
        th.style.setProperty('color','#FFFFFF','important');
        th.style.setProperty('border-color','#2A5C8A','important');
      });
    }
  }

  const table=allTables.find(t=>{
    const txt=(t.textContent||'').toLowerCase();
    return txt.includes('procurement') && (txt.includes('o&m')||txt.includes('o&amp;m')) &&
           (txt.includes('₹/mwh')||txt.includes('rupee per megawatt')||txt.includes('blended'));
  });
  if(!table)return;

  const heads=[...table.querySelectorAll('thead th')];
  let removeIndex=-1;
  heads.forEach((th,i)=>{
    const t=(th.textContent||'').trim().toLowerCase();
    if(t.includes('₹/mwh')||t.includes('rupee per megawatt')||
       (t.includes('blended')&&t.includes('cost'))) removeIndex=i;
  });

  if(removeIndex>=0){
    table.querySelectorAll('tr').forEach(tr=>{
      const cells=[...tr.children];
      if(cells[removeIndex])cells[removeIndex].remove();
    });
  }

  /* Keep current DOM row order: it is already ranked by Blended O&M Cost descending.
     Only make the ranking basis explicit in the table title. */
  const container=table.closest('.card,.panel,.overview-card,.table-card')||table.parentElement;
  if(container){
    const heading=container.querySelector('h2,h3,.section-title,.card-title');
    if(heading){
      heading.textContent='Site O&M Performance — ranked by Blended O&M Cost (₹/MWh)';
    }
  }

  /* Reorder visible columns to:
     Site | Throughput/Generation | Total O&M Cost | Procurement Value | Work Orders | Availability
     without altering row sequence. */
  const desired=[
    /site/i,
    /(throughput|generation)/i,
    /total.*o&m.*cost|o&m.*total.*cost/i,
    /procurement.*value|procurement/i,
    /work orders?/i,
    /availability/i
  ];
  /* Portfolio Overview table presentation: blue header with white labels and clear 12-month wording. */
  const thead=table.querySelector('thead');
  if(thead){
    thead.style.background='#2A5C8A';
    thead.querySelectorAll('tr').forEach(tr=>tr.style.background='#2A5C8A');
    thead.querySelectorAll('th').forEach(th=>{
      th.style.setProperty('background','#2A5C8A','important');
      th.style.setProperty('color','#FFFFFF','important');
      th.style.setProperty('border-color','#2A5C8A','important');
    });
  }
  [...table.querySelectorAll('thead th')].forEach(th=>{
    if(/generation\s*\(\s*12\s*mo\s*\)/i.test((th.textContent||'').trim())) th.textContent='Generation (12 Months)';
  });

  const currentHeads=[...table.querySelectorAll('thead th')];
  if(currentHeads.length){
    const indices=[];
    desired.forEach(rx=>{
      const j=currentHeads.findIndex((th,k)=>!indices.includes(k)&&rx.test((th.textContent||'').trim()));
      if(j>=0)indices.push(j);
    });
    currentHeads.forEach((th,k)=>{if(!indices.includes(k))indices.push(k)});
    table.querySelectorAll('tr').forEach(tr=>{
      const cells=[...tr.children];
      if(cells.length!==currentHeads.length)return;
      indices.forEach(k=>{if(cells[k])tr.appendChild(cells[k]);});
    });
  }
}
const host=document.getElementById('view-overview');
if(host)new MutationObserver(()=>requestAnimationFrame(cleanOverviewOM)).observe(host,{childList:true,subtree:true});
document.addEventListener('click',()=>setTimeout(cleanOverviewOM,0),true);
document.addEventListener('aip:data-source-changed',()=>requestAnimationFrame(cleanOverviewOM));
document.addEventListener('apm:datasource-refreshed',()=>requestAnimationFrame(cleanOverviewOM));
cleanOverviewOM();
})();
