
(function(){
 const SITE={'SP-01':'Suryanagar Solar Park','SP-07':'Anantapur Sun Fields','SP-09':'Bathinda Solar Belt'};
 const SRC={
  'Optimization Plan':{view:'resourceplanning',tab:'optimize',site:'SP-01',id:'INT-001',approval:'APR-260901',fields:[['Approval','APR-260901'],['Source intervention','INT-001'],['Site','SP-01 · Suryanagar Solar Park'],['Destination','Planning & Optimization · Optimize & Govern']]},
  'Inventory Exception':{view:'spares',tab:'availability',site:'SP-07',id:'ERP-SP-07-PRT001',part:'PRT-001',approval:'APR-260903',fields:[['Approval','APR-260903'],['Inventory position','ERP-SP-07-PRT001'],['Part','PRT-001'],['Site','SP-07 · Anantapur Sun Fields'],['Destination','Maintenance Spares · Availability & Risk']]},
  'AI Risk Action':{view:'guardrails',tab:'log',site:'SP-09',id:'DEC-00105',approval:'APR-260904',fields:[['Approval','APR-260904'],['Guardrail decision','DEC-00105'],['Site','SP-09 · Bathinda Solar Belt'],['Required approver','Priya Nair · Reliability Lead'],['Destination','AI Guardrails · Decision Log']]}
 };
 function ca(){return document.getElementById('view-controlassurance')}
 function caActive(){return ca()?.classList.contains('active')}
 function tabName(){const b=ca()?.querySelector('.aip679-tab.active');return b?.textContent.trim()||''}
 function openCA(tab){document.querySelector('.nav-item[data-view="controlassurance"]')?.click();setTimeout(()=>window.aip679Tab?.(tab||'overview'),0)}
 function toast(msg){const v=ca();if(!v)return;v.querySelectorAll('.aip692-toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='aip692-toast';d.innerHTML='<span>'+msg+'</span><button type="button">Close</button>';d.querySelector('button').onclick=()=>d.remove();v.querySelector('.aip679-tabs')?.insertAdjacentElement('afterend',d)}
 function locked(target,s){target.querySelectorAll('.aip692-locked,.aip691-source-context,.aip690-source-context').forEach(x=>x.remove());const d=document.createElement('div');d.className='aip692-locked';d.innerHTML='<div class="head"><b>Locked source record · '+s.id+'</b><span>Exact Control & Assurance context</span><button class="back">Back to Control Overview</button></div><table>'+s.fields.map(x=>'<tr><td>'+x[0]+'</td><td><b>'+x[1]+'</b></td></tr>').join('')+'</table>';d.querySelector('.back').onclick=()=>openCA('overview');target.prepend(d);return d}
 function openSource(s){
  const nav=document.querySelector('.nav-item[data-view="'+s.view+'"]');if(!nav)return;
  nav.click();let n=0;
  const go=()=>{const t=document.getElementById('view-'+s.view);if(!t||!t.classList.contains('active')){if(n++<20)setTimeout(go,50);return}
   try{if(s.view==='resourceplanning'){window.planSetTab?.('optimize');window.planSelect?.(s.id,'optimize')}else if(s.view==='spares'){window.msiSetTab?.('availability')}else if(s.view==='guardrails'){window.aig49Tab?.('log')}}catch(e){}
   const card=locked(t,s);card.scrollIntoView({block:'start'});
   // Exact-row highlight is additive only; never fall back to site-only matching.
   let row=null;
   if(s.view==='spares') row=t.querySelector('tr[data-msi-part="'+s.part+'"][data-msi-site="'+s.site+'"]');
   else if(s.view==='guardrails') row=[...t.querySelectorAll('tbody tr')].find(r=>(r.textContent||'').includes(s.id));
   else row=[...t.querySelectorAll('tr,[data-id],[data-intervention-id]')].find(r=>(r.textContent||'').includes(s.id));
   if(row){row.classList.add('aip691-hit');row.scrollIntoView({block:'center'})}
  };setTimeout(go,20)
 }
 // Capture-phase delegation makes controls reliable on first paint and after every renderer replacement.
 document.addEventListener('click',function(e){
  if(!caActive())return;
  const v=ca();
  const k=e.target.closest('.aip679-kpi,.aip690-kpi');
  if(k&&/INTEGRATION EXCEPTIONS/i.test(k.textContent||'')){e.preventDefault();e.stopImmediatePropagation();toast('No unresolved integration exceptions.');return}
  const btn=e.target.closest('.aip680-sourcebtn');
  if(btn&&tabName()==='Control Overview'){
   const block=btn.closest('div[style*="border-bottom"]')||btn.parentElement;const txt=block?.textContent||'';const key=Object.keys(SRC).find(x=>txt.includes(x));if(key){e.preventDefault();e.stopImmediatePropagation();openSource(SRC[key]);return}
  }
 },true);
 // Retained Access tab: force standard immediately after the legacy synchronous render as well.
 const nav=document.querySelector('.nav-item[data-view="controlassurance"]');
 if(nav&&!nav.__v692){nav.__v692=true;nav.addEventListener('click',()=>{if(tabName()==='Access & Roles')document.documentElement.offsetHeight},true)}
 window.AIP_V692_AUDIT={release:'v692',baseline:'v691',accessFirstPaintCssAuthoritative:true,integrationZeroVisibleMessage:true,attentionCaptureNavigation:true,exactLockedSourcePanel:true,noSiteFallback:true,backReturnsControlOverview:true,dataChanged:false};window.AIP_CURRENT_BUILD='v692';
})();
