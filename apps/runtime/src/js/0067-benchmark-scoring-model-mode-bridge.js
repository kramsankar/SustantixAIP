
/* Data-source-independent Scoring Model launcher.
   The workspace is generated with the actual benchmark renderer in a detached
   document host, then moved to document.body so Excel refreshes cannot remove it. */
function benchmarkBuildBodyScoringShell(){
  var existing=document.querySelector('body > #benchmarkIntelligenceShell');
  if(existing) return existing;
  if(typeof renderPortfolioBenchmarking!=='function'){
    console.error('Portfolio Benchmarking renderer is unavailable.');
    return null;
  }
  var live=document.getElementById('view-portfoliobenchmarking');
  if(!live) return null;
  var originalId='view-portfoliobenchmarking';
  var host=document.createElement('section');
  host.id=originalId;
  host.style.cssText='position:fixed;left:-30000px;top:-30000px;width:1500px;height:1000px;visibility:hidden;pointer-events:none;overflow:hidden;';
  try{
    live.id=originalId+'-live';
    document.body.appendChild(host);
    renderPortfolioBenchmarking();
    var generated=host.querySelector('#benchmarkIntelligenceShell');
    if(!generated){
      console.error('Benchmark renderer completed without producing the scoring workspace.');
      return null;
    }
    generated.remove();
    generated.classList.remove('open');
    document.querySelectorAll('body > #benchmarkIntelligenceShell').forEach(function(n){n.remove();});
    document.body.appendChild(generated);
    return generated;
  }catch(err){
    console.error('Unable to build Benchmark Scoring Model workspace',err);
    return null;
  }finally{
    host.remove();
    live.id=originalId;
  }
}
function benchmarkOpenScoringModel(){
  var shell=document.querySelector('body > #benchmarkIntelligenceShell') || benchmarkBuildBodyScoringShell();
  if(!shell){
    console.error('The Scoring Model workspace could not be initialized.');
    return;
  }
  window.BENCHMARK_DRAWER_OPEN=true;
  try{BENCHMARK_DRAWER_OPEN=true;}catch(_){ }
  shell.classList.add('open');
  document.body.style.overflow='hidden';
  var closeButton=shell.querySelector('.benchmark-drawer-close');
  if(closeButton) setTimeout(function(){try{closeButton.focus({preventScroll:true});}catch(_){try{closeButton.focus();}catch(__){}}},0);
}
window.benchmarkOpenScoringModel=benchmarkOpenScoringModel;

document.addEventListener('click',function(e){
  var button=e.target.closest('.benchmark-launch-btn');
  if(!button) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  benchmarkOpenScoringModel();
},true);

/* Remove stale body drawer after a data-source change; the next click rebuilds it
   from the currently active Synthetic or Excel dataset. */
['aip:data-source-changed','apm:datasource-refreshed','aip:data-rendered','aip:view-rendered'].forEach(function(name){
  document.addEventListener(name,function(){
    document.querySelectorAll('body > #benchmarkIntelligenceShell').forEach(function(n){n.remove();});
  });
});
