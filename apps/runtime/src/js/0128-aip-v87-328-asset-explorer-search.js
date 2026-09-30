
(function(){
 'use strict';
 const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

 function filterFleet(value,input){
   const root=document.getElementById('view-assetexplorer');
   if(!root)return 0;
   const q=norm(value);
   const tokens=q?q.split(/\s+/).filter(Boolean):[];
   let matches=0;

   root.querySelectorAll('.ax-sites .ax-site').forEach(site=>{
     const siteBtn=site.querySelector('.ax-site-title');
     const siteText=norm(siteBtn?.textContent||siteBtn?.dataset.axSite||'');
     const siteMatches=tokens.length>0 && tokens.every(t=>siteText.includes(t));
     let siteAssetMatches=0;

     site.querySelectorAll('.ax-asset').forEach(asset=>{
       const searchable=norm(
         asset.getAttribute('data-ax-search')+' '+
         (asset.textContent||'')+' '+
         siteText
       );
       const assetMatches=!tokens.length || siteMatches || tokens.every(t=>searchable.includes(t));
       asset.style.display=assetMatches?'':'none';
       if(assetMatches){siteAssetMatches++;matches++;}
     });

     site.style.display=siteAssetMatches?'':'none';
   });

   const counter=root.querySelector('#axMatchCount');
   if(counter)counter.textContent=matches
     ? `${matches.toLocaleString('en-IN')} matching asset${matches===1?'':'s'}`
     : 'No matching assets';

   const box=input||root.querySelector('#axSearch');
   if(box){
     box.dataset.firstMatch=root.querySelector('.ax-site:not([style*="display: none"]) .ax-asset:not([style*="display: none"])')?.dataset.axId||'';
   }
   return matches;
 }

 function bind(){
   const root=document.getElementById('view-assetexplorer');
   const box=root?.querySelector('#axSearch');
   if(!box)return;
   window.AIPApplySolarFleetSearch=filterFleet;
   box.oninput=e=>filterFleet(e.currentTarget.value,e.currentTarget);
   box.onsearch=e=>filterFleet(e.currentTarget.value,e.currentTarget);
   if(box.value)filterFleet(box.value,box);
 }

 ['aip:asset-explorer-rendered','aip:data-rendered','aip:data-source-changed','apm:datasource-refreshed'].forEach(evt=>{
   document.addEventListener(evt,()=>setTimeout(bind,0));
 });
 document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,0));
 setTimeout(bind,0);
})();
