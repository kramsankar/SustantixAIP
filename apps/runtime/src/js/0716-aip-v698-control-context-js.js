
(function(){'use strict';
 const ca=()=>document.getElementById('view-controlassurance');
 const tab=()=>{const t=ca()?.querySelector('.aip679-tab.active')?.textContent?.trim();return t==='Approvals'?'approvals':t==='Access & Roles'?'access':t==='Audit Trail'?'audit':'overview'};
 let internalReturn=false;
 function openCAOverview(){document.querySelector('.nav-item[data-view="controlassurance"]')?.click();requestAnimationFrame(()=>window.aip679Tab?.('overview'));internalReturn=false;window.__aip693ControlReturn=null}
 function note(msg){const v=ca();if(!v)return;v.querySelectorAll('.aip698-note').forEach(x=>x.remove());const d=document.createElement('div');d.className='aip698-note info';d.innerHTML='<span>'+msg+'</span><button type="button">Close</button>';d.querySelector('button').onclick=()=>d.remove();(v.querySelector('.aip690-kpis,.aip679-kpis,.aip679-card')||v.firstChild)?.insertAdjacentElement('afterend',d)}
 function destinationNote(t,html){t.querySelectorAll('.aip698-note,.aip693-context,.aip692-locked,.aip691-source-context,.aip690-source-context').forEach(x=>x.remove());const d=document.createElement('div');d.className='aip698-note';d.innerHTML='<span>'+html+'</span><button type="button">Back to Control Overview</button>';d.querySelector('button').onclick=openCAOverview;t.prepend(d)}
 function go(view,ready){window.__aip693ControlReturn={tab:'overview',scroll:0};document.querySelector('.nav-item[data-view="'+view+'"]')?.click();let n=0;const run=()=>{const t=document.getElementById('view-'+view);if(t?.classList.contains('active'))return ready(t,n);if(n++<30)setTimeout(run,50)};setTimeout(run,25)}
 function optimization(){go('resourceplanning',(t,n)=>{try{window.planSelect?.('INT-001','resources')}catch(_){};setTimeout(()=>{const row=[...t.querySelectorAll('tr')].find(r=>(r.textContent||'').includes('INT-001'));const sel=[...t.querySelectorAll('select option')].find(o=>(o.textContent||'').includes('INT-001'))?.parentElement;if(row){row.classList.add('aip698-source-hit');row.scrollIntoView({block:'center'});destinationNote(t,'Source intervention selected: <b>INT-001</b> · SP-01 · Suryanagar Solar Park · Plan & Resources. Optimization output is not being represented as the source record.')}else if(sel){sel.classList.add('aip698-source-hit');destinationNote(t,'Source intervention selected: <b>INT-001</b> · SP-01 · Suryanagar Solar Park · Plan & Resources.')}else if(n<15)setTimeout(()=>optimization(),80)},20)})}
 function inventory(){go('spares',(t,n)=>{try{window.msiSetTab?.('inventory')}catch(_){};setTimeout(()=>{const row=t.querySelector('tr[data-msi-record="ERP-SP-07-PRT001"]');if(row){row.classList.add('aip698-source-hit');row.scrollIntoView({block:'center'});destinationNote(t,'Inventory source selected: <b>ERP-SP-07-PRT001</b> · PRT-001 · SP-07 · Anantapur Sun Fields. Available 6 units vs reorder point 8.')}else if(n<15)setTimeout(()=>inventory(),80);else destinationNote(t,'Source record not available: <b>ERP-SP-07-PRT001</b>')},25)})}
 function risk(){go('guardrails',(t,n)=>{try{window.aig49Tab?.('log')}catch(_){};setTimeout(()=>{const row=t.querySelector('tr[data-aig-decision-id="DEC-00105"]');if(row){row.classList.add('aip698-source-hit');row.scrollIntoView({block:'center'});destinationNote(t,'Guardrail decision selected: <b>DEC-00105</b> · SP-09 · Bathinda Solar Belt · Approval Required.')}else if(n<15)setTimeout(()=>risk(),80);else destinationNote(t,'Source record not available: <b>DEC-00105</b>')},25)})}
 document.addEventListener('click',function(e){
   const v=ca(), active=v?.classList.contains('active');
   if(active&&tab()==='overview'){
     const card=e.target.closest('.aip690-kpi,.aip679-kpi'); const txt=card?.textContent||'';
     if(/OVERDUE APPROVALS/i.test(txt)){e.preventDefault();e.stopImmediatePropagation();note('No overdue approvals.');return}
     if(/PENDING APPROVALS/i.test(txt)){internalReturn=true;setTimeout(()=>{},0)}
     if(/ACCESS\s*\/\s*SOD EXCEPTIONS/i.test(txt)){internalReturn=true}
     const b=e.target.closest('.aip680-sourcebtn');if(b){const x=(b.closest('div[style*="border-bottom"]')||b.parentElement)?.textContent||'';if(/Optimization Plan/i.test(x)){e.preventDefault();e.stopImmediatePropagation();optimization();return}if(/Inventory Exception/i.test(x)){e.preventDefault();e.stopImmediatePropagation();inventory();return}if(/AI Risk Action/i.test(x)){e.preventDefault();e.stopImmediatePropagation();risk();return}}
   }
   const back=e.target.closest('#aipBackBtn');
   if(back&&((active&&internalReturn&&tab()!=='overview')||window.__aip693ControlReturn)){e.preventDefault();e.stopImmediatePropagation();openCAOverview();return}
 },true);
 window.AIP_V698_AUDIT={release:'v698',baseline:'v697',appBackControlOrigin:true,zeroOverdueMessage:true,optimizationSource:'INT-001 / Plan & Resources',inventorySource:'ERP-SP-07-PRT001 visible in Inventory table',guardrailSource:'DEC-00105 visible in Decision Log',dataChanged:false};window.AIP_CURRENT_BUILD='v698';
})();
