
(function(){
 'use strict';
 window.AIP_CURRENT_BUILD='v87_803';
 const VIEWS=['preventive','predictive','corrective','riskbased','adaptive'];
 const escCss=v=>(window.CSS&&CSS.escape)?CSS.escape(String(v)):String(v).replace(/["\\]/g,'\\$&');
 const previousOpenWO=window.ms791OpenWO;
 const previousOpenRCM=window.ms791OpenRCM;
 const previousPin=window.ms791Pin;
 window.AIP_STRATEGY_REASONING_LAST_PIN=window.AIP_STRATEGY_REASONING_LAST_PIN||{};
 window.ms791Pin=function(view,key){
   window.AIP_STRATEGY_REASONING_LAST_PIN[view]=key;
   return typeof previousPin==='function'?previousPin(view,key):undefined;
 };
 function captureReturn(origin,extra){
   const root=document.getElementById('view-'+origin),ws=root?.querySelector('.ms686-workspace');
   const ret={
     view:origin,
     asset:ws?.querySelector('.ms686-asset')?.value||root?.dataset.ms686asset||'All',
     site:ws?.querySelector('.ms686-site')?.value||root?.dataset.ms686site||'All',
     pinKey:window.AIP_STRATEGY_REASONING_LAST_PIN?.[origin]||''
   };
   window.AIP_STRATEGY_REASONING_RETURN=Object.assign(ret,extra||{});
   return ret;
 }
 function restoreStrategyReasoning(){
   const ret=window.AIP_STRATEGY_REASONING_RETURN;
   if(!ret?.view||!VIEWS.includes(ret.view))return false;
   const origin=ret.view;
   const activateOrigin=()=>{
     try{
       if(typeof window.activate==='function')window.activate(origin);
       else document.querySelector(`.nav-item[data-view="${escCss(origin)}"]`)?.click();
     }catch(_){document.querySelector(`.nav-item[data-view="${escCss(origin)}"]`)?.click()}
   };
   activateOrigin();
   const apply=()=>{
     const root=document.getElementById('view-'+origin);if(!root)return false;
     root.dataset.ms686site=ret.site||'All';root.dataset.ms686asset=ret.asset||'All';
     const ws=root.querySelector('.ms686-workspace');
     const siteSel=ws?.querySelector('.ms686-site'),assetSel=ws?.querySelector('.ms686-asset');
     try{
       if(siteSel&&[...siteSel.options].some(o=>String(o.value)===String(ret.site||'All')))siteSel.value=ret.site||'All';
       if(typeof window.ms686Change==='function')window.ms686Change(origin,'site',ret.site||'All');
     }catch(_){}
     try{
       if(assetSel&&[...assetSel.options].some(o=>String(o.value)===String(ret.asset||'All')))assetSel.value=ret.asset||'All';
       if((ret.asset||'All')!=='All'&&typeof window.ms686Change==='function')window.ms686Change(origin,'asset',ret.asset);
     }catch(_){}
     try{window.ms791RenderGraph?.(origin)}catch(_){}
     if(ret.pinKey)setTimeout(()=>{try{window.ms791Pin?.(origin,ret.pinKey)}catch(_){}},35);
     return true;
   };
   [20,70,150,280].forEach(t=>setTimeout(apply,t));
   window.AIP_STRATEGY_REASONING_RETURN=null;
   return true;
 }
 window.AIP_RETURN_TO_STRATEGY_REASONING=restoreStrategyReasoning;
 function focusRCM(id,attempt=0){
   const root=document.getElementById('view-rcm');
   if(!root){if(attempt<10)setTimeout(()=>focusRCM(id,attempt+1),100);return}
   window.RCM650_SELECTED=id;
   try{if(typeof window.renderRCM==='function')window.renderRCM()}catch(_){}
   // Re-assert after rendering because some legacy renderers reset selection on entry.
   window.RCM650_SELECTED=id;
   const exact=[...root.querySelectorAll('[data-rcm-id],[data-id],tr')].find(el=>
     String(el.getAttribute?.('data-rcm-id')||el.getAttribute?.('data-id')||el.textContent||'').includes(String(id))
   );
   if(exact){exact.classList.add('aip-authoritative-match');try{exact.scrollIntoView({behavior:'auto',block:'center'})}catch(_){}}
   else if(attempt<10)setTimeout(()=>focusRCM(id,attempt+1),120);
 }
 window.ms791OpenRCM=function(id,origin){
   if(!id||!origin)return;
   captureReturn(origin,{rcmId:String(id)});
   window.RCM650_SELECTED=String(id);
   try{window.AIP_HISTORY_NAV?.record?.(origin)}catch(_){}
   try{if(typeof window.activate==='function')window.activate('rcm');else document.querySelector('.nav-item[data-view="rcm"]')?.click()}catch(_){document.querySelector('.nav-item[data-view="rcm"]')?.click()}
   [25,80,170,320].forEach((t,i)=>setTimeout(()=>focusRCM(String(id),i),t));
 };
 // Wrap the already-correct exact-WO navigation so it stores the same symmetric return context/pinned reasoning step.
 window.ms791OpenWO=function(id,origin){
   if(!id||!origin)return;
   const saved=captureReturn(origin,{workOrderId:String(id)});
   if(typeof previousOpenWO==='function')previousOpenWO(id,origin);
   // v87_803's implementation rewrites the return object; merge the richer context back in afterwards.
   setTimeout(()=>{window.AIP_STRATEGY_REASONING_RETURN=Object.assign({},window.AIP_STRATEGY_REASONING_RETURN||{},saved,{workOrderId:String(id)})},0);
 };
 function activeView(){return document.querySelector('.view.active[id^="view-"]')?.id?.replace(/^view-/,'')||''}
 function shouldReturn(){
   const a=activeView();
   return !!window.AIP_STRATEGY_REASONING_RETURN&&(a==='rcm'||a==='workorderintelligence');
 }
 // Final capture authority: same Back and Alt+Left semantics from BOTH governed destinations.
 document.addEventListener('click',function(e){
   if(!e.target?.closest?.('#aipBackBtn')||!shouldReturn())return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restoreStrategyReasoning();
 },true);
 document.addEventListener('keydown',function(e){
   if(!(e.altKey&&e.key==='ArrowLeft')||!shouldReturn())return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restoreStrategyReasoning();
 },true);
 window.AIP_V803_AUDIT={rcmStrategyReturn:true,workOrderStrategyReturn:true,restorePinnedStep:true,commonBorder:'steel-blue',dynamicBorder:'amber',detailMaxWidthPx:780,excelBusinessDataChanged:false};
})();
