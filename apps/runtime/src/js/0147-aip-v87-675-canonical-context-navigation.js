
(function(){
 'use strict';
 function ret(){
   if(window.AIP_VISION_ROUTE_RETURN)return window.AIP_VISION_ROUTE_RETURN;
   try{return JSON.parse(sessionStorage.getItem('aip.vision.route.return')||'null')}catch(_){return null}
 }
 function active(){return document.querySelector('.view.active[id^="view-"]')?.id?.replace(/^view-/,'')||''}
 function restore(){
   const c=ret();if(!c)return;
   try{if(typeof window.activate==='function')window.activate('aivision');else window.AIP_V21?.open?.('aivision')}catch(_){}
   const apply=()=>{
     if(active()!=='aivision')return;
     try{window.VISION_UI_STATE.selected=c.findingId}catch(_){}
     try{window.visionSelect?.(c.findingId,3)}catch(_){}
     document.querySelector('#view-aivision .vision-card[data-id="'+CSS.escape(String(c.findingId))+'"]')?.scrollIntoView?.({block:'center',behavior:'auto'});
   };
   requestAnimationFrame(()=>requestAnimationFrame(apply));setTimeout(apply,120);setTimeout(apply,300);
   window.AIP_VISION_ROUTE_RETURN=null;
   try{sessionStorage.removeItem('aip.vision.route.return')}catch(_){}
 }
 window.addEventListener('click',function(e){
   const c=ret();if(!c)return;
   const b=e.target.closest?.('#aipBackBtn');if(!b)return;
   const v=active();if(v!=='assetexplorer'&&v!=='workorderintelligence')return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restore();
 },true);

 function markWO(id){
   if(!id)return;
   const root=document.getElementById('view-workorderintelligence');if(!root)return;
   try{window.aipSelectWoSource?.(id)}catch(_){}
   const selectors=['#aipWoLedgerTable tr[data-wo-id="'+CSS.escape(String(id))+'"]','#wo12-table tr[data-wo12-id="'+CSS.escape(String(id))+'"]','tr[data-wo-id="'+CSS.escape(String(id))+'"]','tr[data-id="'+CSS.escape(String(id))+'"]'];
   let row=null;for(const s of selectors){row=root.querySelector(s);if(row)break}
   root.querySelectorAll('.aip-vision-wo-target').forEach(x=>x.classList.remove('aip-vision-wo-target'));
   row?.classList.add('aip-vision-wo-target','aip-wo-selected-row');row?.scrollIntoView?.({block:'center',behavior:'auto'});
 }
 document.addEventListener('click',function(e){
   const c=ret();if(!c||c.target!=='workorderintelligence'||!c.workOrderId)return;
   const b=e.target.closest?.('#aipV8WoSave,#v9Save,#wo12-save,#aipWoSave,.aip-wo-btn');
   if(!b||!/save|update/i.test(String(b.textContent||'')))return;
   [40,130,300,650].forEach(ms=>setTimeout(()=>markWO(c.workOrderId),ms));
 },true);

 document.addEventListener('click',function(e){
   const node=e.target.closest?.('#view-rootcause .rc83-node');if(!node)return;
   const root=document.getElementById('view-rootcause');
   root?.querySelectorAll('.rc83-node').forEach(x=>x.classList.toggle('active',x===node));
 },true);
})();
