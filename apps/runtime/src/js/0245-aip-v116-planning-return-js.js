
(function(){
 if(window.__AIP_V116_PLAN_RETURN_INSTALLED)return;window.__AIP_V116_PLAN_RETURN_INSTALLED=true;
 function restorePlanningOrigin(){
   const ret=window.AIP_PLAN_STATUS_RETURN;if(!ret)return false;
   const view=document.getElementById('view-resourceplanning');if(!view?.classList.contains('active'))return false;
   window.AIP_PLAN_STATUS_RETURN=null;try{window.planCloseDrawer?.()}catch(_){}
   try{
     if(ret.selected&&typeof window.planSelect==='function')window.planSelect(ret.selected,ret.tab||'overview');
     else if(typeof window.planSetTab==='function')window.planSetTab(ret.tab||'overview');
     requestAnimationFrame(()=>{const sc=document.scrollingElement||document.documentElement;if(sc&&Number.isFinite(Number(ret.scrollY)))sc.scrollTop=Number(ret.scrollY)});
     return true;
   }catch(_){return false}
 }
 document.addEventListener('click',function(e){const b=e.target?.closest?.('#aipBackBtn');if(!b||!window.AIP_PLAN_STATUS_RETURN)return;const view=document.getElementById('view-resourceplanning');if(!view?.classList.contains('active'))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restorePlanningOrigin()},true);
 document.addEventListener('keydown',function(e){if(!(e.altKey&&e.key==='ArrowLeft')||!window.AIP_PLAN_STATUS_RETURN)return;const view=document.getElementById('view-resourceplanning');if(!view?.classList.contains('active'))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();restorePlanningOrigin()},true);
 window.AIP_V116_AUDIT={release:'v1.16',baseline:'v1.15',area:'Planning & Optimization',uiOnly:true,excelBusinessDataChanged:false,changes:['Planning & Optimization five-tab strip now scrolls away with page content instead of remaining sticky','Planning drawer Open drill-through buttons are compact purple navigation controls','Planning drill-through Back and Alt+Left restore the originating Planning tab and scroll position','Default Selected intervention dependency status logic remains highest Value Exposure in current Required Completion scope until user selection']};
})();
