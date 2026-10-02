
(function(){
'use strict';
const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
function commit(){
 const root=document.getElementById('view-assetrelationships');
 const site=root?.querySelector('#arSite'),type=root?.querySelector('#arAssetType'),focus=root?.querySelector('#arFocus');
 if(!root||!site||!type||!focus||!focus.value)return false;
 const rows=Array.isArray(window.arAssetSelectorRows?.())?window.arAssetSelectorRows():[];
 const rec=rows.find(r=>norm(r.Asset_ID)===norm(focus.value))||{};
 const tag=String(rec.Asset_Tag||focus.options[focus.selectedIndex]?.textContent?.split(' — ')[0]||focus.value).trim();
 const c={assetId:String(rec.Asset_ID||focus.value),tag,
  siteId:String(rec.Plant_ID||site.value),
  site:String(rec.Plant_Name||site.options[site.selectedIndex]?.textContent||site.value),
  assetClass:String(rec.Asset_Class||type.value),selectorRecord:rec,target:'assetrelationships',
  source:'Asset Relationship Intelligence · automatic selector context',
  contextToken:'AR-AUTO-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)};
 window.AIP_CONTEXT_NAV={...c};
 window.AIP_SELECTED_ASSET_CONTEXT={...(window.AIP_SELECTED_ASSET_CONTEXT||{}),...c};
 window.AIP_ASSET_RELATIONSHIP_SOURCE_CONTEXT={...c};
 window.AIP_PENDING_RELATIONSHIP_CONTEXT={...c};
 window.AIP_RELATIONSHIP_FOCUS_ASSET=c.assetId;
 window.AIP_LAST_ASSET_EXPLORER_RELATIONSHIP_ID=c.assetId;
 try{sessionStorage.setItem('aip.context.nav',JSON.stringify(c))}catch(_){}
 root.dataset.aipContextToken=c.contextToken;
 root.dataset.aipAppliedRelationshipAsset=c.assetId;
 root.classList.add('aip-contextual-relationship');
 const title=root.querySelector('h1');if(title)title.textContent='Asset Relationship Intelligence — '+c.tag;
 return true;
}
document.addEventListener('change',function(e){
 if(!e.target?.matches?.('#view-assetrelationships #arSite,#view-assetrelationships #arAssetType,#view-assetrelationships #arFocus'))return;
 setTimeout(commit,0);
},true);
window.AIPCommitCurrentRelationshipContext=commit;
})();
