
window.AIPPortfolioTotals901=function(){
 const rows=n=>window.AIP891?.raw(n)||[];
 const unique=(a,k)=>[...new Map(a.filter(r=>String(r[k]??'').trim()).map(r=>[String(r[k]).trim(),r])).values()];
 const sites=unique(rows('Sites'),'Plant_ID'),assets=unique(rows('Asset Master'),'Asset_ID');
 return sites.length+' SITES · '+assets.length.toLocaleString('en-IN')+' ASSETS · '+sites.reduce((n,r)=>n+(Number(r.Capacity_MW)||0),0).toLocaleString('en-IN',{maximumFractionDigits:2})+' MW AC';
};
