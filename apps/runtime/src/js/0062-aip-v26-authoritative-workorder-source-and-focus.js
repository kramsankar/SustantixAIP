
(function(){
'use strict';
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const val=(r,...ks)=>{for(const k of ks){if(r&&r[k]!=null&&String(r[k]).trim()!=='')return r[k]}return ''};
let focusTimer=0;
let focusBusy=false;
let lastFocusKey='';
function embeddedRows(){try{return (EMBEDDED_EXCEL_DATA&&EMBEDDED_EXCEL_DATA['Work Orders'])||[]}catch(_){return []}}
function sites(){try{return (EMBEDDED_EXCEL_DATA&&EMBEDDED_EXCEL_DATA['Sites'])||[]}catch(_){return []}}
function plantName(id){const x=sites().find(s=>String(s.Plant_ID)===String(id));return x?.Plant_Name||id||''}
function mappedWorkbookRows(){return embeddedRows().map((r,i)=>({
 id:String(val(r,'Work_Order_ID','WO_ID','id')||('WO-X'+i)),
 Work_Order_ID:String(val(r,'Work_Order_ID','WO_ID','id')||('WO-X'+i)),
 assetId:String(val(r,'Asset_ID','Asset Id','assetId')),
 Asset_ID:String(val(r,'Asset_ID','Asset Id','assetId')),
 asset:String(val(r,'Asset_Tag','Asset','asset')||val(r,'Asset_ID')),
 Asset_Tag:String(val(r,'Asset_Tag','Asset','asset')||''),
 plant:String(val(r,'Plant_Name','Site','plant')||plantName(val(r,'Plant_ID'))),
 Plant_ID:String(val(r,'Plant_ID')||''), type:String(val(r,'Maintenance_Type','Work_Type','Type')||'Corrective'),
 priority:String(val(r,'Priority')||'Medium'), status:String(val(r,'Status','Work_Order_Status')||'Draft'),
 crew:String(val(r,'Crew_ID','Assigned_Crew')||''), parts:String(val(r,'Parts_Status')||'Not Required'),
 permit:String(val(r,'Permit_Status')||'Not Required'), loss:Number(val(r,'Generation_Loss_MWh','Loss_MWh')||0),
 cost:Number(val(r,'Estimated_Cost_INR','Estimated_Cost','Cost_INR')||0), erp:String(val(r,'ERP_Sync_Status','ERP_Status')||'Pending'),
 desc:String(val(r,'Description')||'Maintenance intervention'), description:String(val(r,'Description')||'Maintenance intervention')
}))}
function mergeRows(){
 const runtime=(()=>{try{return Array.isArray(window.ALL_WOS)?window.ALL_WOS:[]}catch(_){return []}})();
 const map=new Map();
 [...runtime,...mappedWorkbookRows()].forEach(r=>{const id=String(r.id||r.Work_Order_ID||'');if(id)map.set(id,{...(map.get(id)||{}),...r})});
 return [...map.values()];
}
try{window.opsWOs=mergeRows;opsWOs=mergeRows}catch(_){window.opsWOs=mergeRows}
function resolve(ctx){
 const aid=norm(ctx?.assetId),tag=norm(ctx?.tag);
 return mappedWorkbookRows().find(r=>(aid&&norm(r.assetId)===aid)||(tag&&norm(r.asset)===tag))||null;
}
function clearTimer(){if(focusTimer){clearTimeout(focusTimer);focusTimer=0}}
function release(){
 clearTimer(); focusBusy=false; lastFocusKey='';
 const view=document.getElementById('view-workorderintelligence'); if(!view)return;
 view.classList.remove('aip-authoritative-wo-focus');
 view.querySelector('#aipAuthoritativeWoBanner')?.remove();
 view.querySelectorAll('.ax-context-banner,.ax-exact-drill-overlay,.ax-forced-record.ax-source-records').forEach(el=>el.remove());
 view.querySelectorAll('#wo12-table tbody tr').forEach(tr=>tr.classList.remove('aip-authoritative-match'));
 const q=view.querySelector('#wo12-search'); if(q){q.value='';q.dispatchEvent(new Event('input',{bubbles:true}))}
 window.AIP_WO_AUTHORITATIVE_FOCUS=null;
}
function scheduleFocus(ctx,delay=100,attempt=0){
 clearTimer();
 focusTimer=setTimeout(()=>focus(ctx,attempt),delay);
}
function focus(ctx,attempt=0){
 if(focusBusy)return;
 const view=document.getElementById('view-workorderintelligence');
 if(!view){if(attempt<30)scheduleFocus(ctx,120,attempt+1);return}
 const rec=resolve(ctx); if(!rec)return;
 const targetId=String(rec.id);
 const key=[ctx?.assetId||'',ctx?.tag||'',targetId].join('|');
 const ledger=view.querySelector('[data-wo12-tab="ledger"]');
 if(ledger&&!ledger.classList.contains('active')){ledger.click();if(attempt<20)scheduleFocus(ctx,140,attempt+1);return}
 let table=view.querySelector('#wo12-table');
 if(!table){
   if(attempt===0){try{window.renderWorkOrderIntelligence?.()}catch(_){}}
   if(attempt<25)scheduleFocus(ctx,140,attempt+1);
   return;
 }
 focusBusy=true;
 try{
   const q=view.querySelector('#wo12-search');
   if(q&&q.value!==targetId){q.value=targetId;q.dispatchEvent(new Event('input',{bubbles:true}))}
   const escId=(window.CSS&&CSS.escape)?CSS.escape(targetId):targetId.replace(/["\\]/g,'\\$&');
   const row=view.querySelector(`#wo12-table tbody tr[data-wo12-id="${escId}"]`);
   if(!row){
     if(attempt<20)scheduleFocus(ctx,150,attempt+1);
     return;
   }
   view.classList.add('aip-authoritative-wo-focus');
   view.querySelectorAll('#wo12-table tbody tr').forEach(tr=>tr.classList.toggle('aip-authoritative-match',tr===row));
   view.querySelector('#aipAuthoritativeWoBanner')?.remove();
   view.querySelectorAll('.ax-context-banner,.ax-exact-drill-overlay,.ax-forced-record.ax-source-records').forEach(el=>el.remove());
   const banner=document.createElement('div'); banner.id='aipAuthoritativeWoBanner';
   banner.innerHTML=`<span>Selected asset <b>${String(ctx.tag||ctx.assetId)}</b> · exact work order <b>${targetId}</b></span><button type="button">Show all records</button>`;
   const head=view.querySelector('.view-head'); if(head)head.insertAdjacentElement('afterend',banner); else view.prepend(banner);
   banner.querySelector('button').onclick=release;
   window.AIP_WO_AUTHORITATIVE_FOCUS={ctx:{...ctx},id:targetId}; lastFocusKey=key;
   requestAnimationFrame(()=>row.scrollIntoView({behavior:'auto',block:'center'}));
 } finally {focusBusy=false}
}
document.addEventListener('click',function(e){
 const tile=e.target.closest('#view-assetexplorer .ax-capability[data-ax-cap="workorderintelligence"]');
 if(!tile)return;
 clearTimer(); lastFocusKey='';
 scheduleFocus({...window.AIP_SELECTED_ASSET_CONTEXT},300,0);
},false);
// A narrowly-scoped, debounced observer only restores styling if the Work Order
// table itself is replaced. It never calls the renderer and cannot recurse.
const viewObserver=new MutationObserver(()=>{
 const f=window.AIP_WO_AUTHORITATIVE_FOCUS; if(!f||focusBusy)return;
 const view=document.getElementById('view-workorderintelligence'); if(!view||!view.classList.contains('active'))return;
 const escId=(window.CSS&&CSS.escape)?CSS.escape(f.id):String(f.id).replace(/["\\]/g,'\\$&');
 if(!view.querySelector(`#wo12-table tbody tr[data-wo12-id="${escId}"].aip-authoritative-match`))scheduleFocus(f.ctx,120,0);
});
function attachObserver(){
 const view=document.getElementById('view-workorderintelligence');
 if(!view){setTimeout(attachObserver,300);return}
 viewObserver.observe(view,{childList:true,subtree:true});
}
attachObserver();
})();
