
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_803';
 const priorPin=window.ms791Pin;
 const priorOpenRCM=window.ms791OpenRCM;
 const escCss=v=>(window.CSS&&CSS.escape)?CSS.escape(String(v)):String(v).replace(/["\\]/g,'\\$&');
 function currentCase(view){
   try{
     const api=window.AIP_STRATEGY_REASONING_SELECTION;if(!api?.selectedCase)return null;
     const root=document.getElementById('view-'+view),ws=root?.querySelector('.ms686-workspace');if(!ws)return null;
     const asset=ws.querySelector('.ms686-asset')?.value||root.dataset.ms686asset||'All';
     const site=ws.querySelector('.ms686-site')?.value||root.dataset.ms686site||'All';
     const all=(()=>{
       const synthetic=window.AIP_SYNTHETIC_ACTIVE===true||/synthetic/i.test(String(window.APM_DATA_MODE||window.DATA_SOURCE_MODE||''));
       if(synthetic){try{return AIP_INDEPENDENT_SYNTHETIC_DATA?.platformSyntheticData?.['Strategy Reasoning Evidence']||window.AIP_STRATEGY_REASONING_SYNTHETIC||[]}catch(_){return window.AIP_STRATEGY_REASONING_SYNTHETIC||[]}}
       try{if(typeof APM_IMPORTED_DATA!=='undefined'&&Array.isArray(APM_IMPORTED_DATA?.['Strategy Reasoning Evidence'])&&APM_IMPORTED_DATA['Strategy Reasoning Evidence'].length)return APM_IMPORTED_DATA['Strategy Reasoning Evidence']}catch(_){}
       try{if(Array.isArray(window.APM_IMPORTED_DATA?.['Strategy Reasoning Evidence'])&&window.APM_IMPORTED_DATA['Strategy Reasoning Evidence'].length)return window.APM_IMPORTED_DATA['Strategy Reasoning Evidence']}catch(_){}
       try{if(typeof EMBEDDED_EXCEL_DATA!=='undefined'&&Array.isArray(EMBEDDED_EXCEL_DATA?.['Strategy Reasoning Evidence']))return EMBEDDED_EXCEL_DATA['Strategy Reasoning Evidence']}catch(_){}
       return window.AIP_STRATEGY_REASONING_EXCEL||[];
     })();
     const names={preventive:'Preventive',predictive:'Predictive',corrective:'Corrective',riskbased:'Risk-Based',adaptive:'Adaptive'};
     let rows=all.filter(r=>String(r.Strategy_Type||'')===names[view]);
     if(site!=='All')rows=rows.filter(r=>String(r.Plant_ID||'')===String(site));
     if(asset!=='All')rows=rows.filter(r=>String(r.Asset_ID||'')===String(asset));
     return api.selectedCase(view,{rows,asset,site,root,ws});
   }catch(_){return null}
 }
 function basis(view){
   try{
     const api=window.AIP_STRATEGY_REASONING_SELECTION,r=currentCase(view),root=document.getElementById('view-'+view),ws=root?.querySelector('.ms686-workspace');
     if(!api?.selectionBasis||!r||!ws)return '';
     const asset=ws.querySelector('.ms686-asset')?.value||root.dataset.ms686asset||'All';
     const site=ws.querySelector('.ms686-site')?.value||root.dataset.ms686site||'All';
     return api.selectionBasis(view,r,{asset,site,rows:[],root,ws})||'';
   }catch(_){return ''}
 }
 window.ms791Pin=function(view,key){
   if(typeof priorPin!=='function')return;
   priorPin(view,key);
   const box=document.getElementById('ms791Pin-'+view);if(!box)return;
   let selection=basis(view);
   const cell=box.querySelector('.ms800-selection-basis');
   if(cell){selection=cell.querySelector('b')?.textContent?.trim()||selection;cell.remove()}
   const oldTop=box.querySelector('.ms800-pin-top,.ms791-pin-head');
   const close=oldTop?.querySelector('.ms791-pin-close');
   const top=document.createElement('div');top.className='ms802-pin-top';
   const line=document.createElement('div');line.className='ms802-selection-line';
   const s=document.createElement('span');s.textContent='Selection basis';
   const b=document.createElement('b');b.textContent=selection||'Current governed case';
   line.append(s,b);top.append(line);
   if(close){oldTop.remove();top.append(close)}else{const x=document.createElement('button');x.className='ms791-pin-close';x.textContent='×';x.onclick=()=>box.classList.remove('open');top.append(x)}
   box.prepend(top);
   // Remove fields that duplicate the already-visible common Asset context.
   const step=box.querySelector('.ms799-step');
   if(step){
     [...step.querySelectorAll('.ms791-pin-cell')].forEach(c=>{
       const label=(c.querySelector('span')?.textContent||'').trim().toLowerCase();
       if(label==='asset class')c.remove();
     });
   }
 };
 function renderAndFocusExactWO(id,attempt=0){
   const root=document.getElementById('view-workorderintelligence');
   if(!root){if(attempt<14)setTimeout(()=>renderAndFocusExactWO(id,attempt+1),100);return false}
   window.AIP_WO_DESIRED_TAB='ledger';
   try{window.renderWorkOrderIntelligence?.()}catch(_){}
   const ledger=root.querySelector('.ops-tab[data-wo12-tab="ledger"]');
   if(ledger&&!ledger.classList.contains('active')){try{ledger.click()}catch(_){};if(attempt<14)setTimeout(()=>renderAndFocusExactWO(id,attempt+1),100);return false}
   const status=root.querySelector('#wo12-status-filter');if(status&&status.value!=='All'){status.value='All';status.dispatchEvent(new Event('change',{bubbles:true}))}
   const input=root.querySelector('#wo12-search');
   if(input){input.value=String(id);input.dispatchEvent(new Event('input',{bubbles:true}))}
   const row=root.querySelector(`#wo12-table tbody tr[data-wo12-id="${escCss(id)}"]`);
   if(!row){if(attempt<14)setTimeout(()=>renderAndFocusExactWO(id,attempt+1),120);return false}
   root.querySelectorAll('tr.ms802-exact-wo,.corr773-context-row,.aip-authoritative-match').forEach(x=>x.classList.remove('ms802-exact-wo','corr773-context-row','aip-authoritative-match'));
   row.hidden=false;row.classList.add('ms802-exact-wo','corr773-context-row','aip-authoritative-match');
   row.scrollIntoView({behavior:'auto',block:'center'});
   window.AIP_STRATEGY_REASONING_WO_FOCUS={id:String(id),at:Date.now()};
   return true;
 }
 window.ms791OpenWO=function(id,origin){
   if(!id||!origin)return;
   const root=document.getElementById('view-'+origin),ws=root?.querySelector('.ms686-workspace');
   const r=currentCase(origin);
   window.AIP_STRATEGY_REASONING_RETURN={view:origin,asset:ws?.querySelector('.ms686-asset')?.value||root?.dataset.ms686asset||'All',site:ws?.querySelector('.ms686-site')?.value||root?.dataset.ms686site||'All',reasoningId:r?.Reasoning_ID||'',workOrderId:String(id)};
   window.AIP_WO_DESIRED_TAB='ledger';
   try{if(typeof window.activate==='function')window.activate('workorderintelligence');else document.querySelector('.nav-item[data-view="workorderintelligence"]')?.click()}catch(_){document.querySelector('.nav-item[data-view="workorderintelligence"]')?.click()}
   [20,70,150,280,500,850].forEach((t,i)=>setTimeout(()=>renderAndFocusExactWO(String(id),i),t));
 };
 function restoreReasoningReturn(){
   const ret=window.AIP_STRATEGY_REASONING_RETURN;if(!ret?.view)return false;
   const origin=ret.view;
   const root=document.getElementById('view-'+origin);
   if(root){root.dataset.ms686site=ret.site||'All';root.dataset.ms686asset=ret.asset||'All';}
   try{if(typeof window.activate==='function')window.activate(origin);else document.querySelector(`.nav-item[data-view="${escCss(origin)}"]`)?.click()}catch(_){}
   const apply=()=>{
     const r=document.getElementById('view-'+origin);if(!r)return;
     r.dataset.ms686site=ret.site||'All';r.dataset.ms686asset=ret.asset||'All';
     try{if(typeof window.ms686Change==='function'){window.ms686Change(origin,'site',ret.site||'All');if((ret.asset||'All')!=='All')window.ms686Change(origin,'asset',ret.asset)}}catch(_){}
     try{window.ms791RenderGraph?.(origin)}catch(_){}
   };
   [25,90,180].forEach(t=>setTimeout(apply,t));
   window.AIP_STRATEGY_REASONING_RETURN=null;
   return true;
 }
 document.addEventListener('click',function(e){
   const b=e.target?.closest?.('#aipBackBtn');if(!b)return;
   const active=document.querySelector('.view.active[id^="view-"]')?.id?.replace(/^view-/,'')||'';
   if(active!=='workorderintelligence'||!window.AIP_STRATEGY_REASONING_RETURN)return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restoreReasoningReturn();
 },true);
 document.addEventListener('keydown',function(e){
   if(!(e.altKey&&e.key==='ArrowLeft'))return;
   const active=document.querySelector('.view.active[id^="view-"]')?.id?.replace(/^view-/,'')||'';
   if(active!=='workorderintelligence'||!window.AIP_STRATEGY_REASONING_RETURN)return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restoreReasoningReturn();
 },true);
 // Preserve RCM function explicitly; the v87_803 patch only changes Work Order routing.
 if(typeof priorOpenRCM==='function')window.ms791OpenRCM=priorOpenRCM;
 window.AIP_V802_AUDIT={compactPin:true,selectionBasisInHeader:true,pinOnlyVerticalArrow:true,exactWorkOrderFocus:true,strategyReturnBack:true,excelBusinessDataChanged:false};
})();
