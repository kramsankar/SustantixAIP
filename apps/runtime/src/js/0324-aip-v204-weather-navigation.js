
(function(){
  const apiNav=document.querySelector('#sidebar .nav-item[data-view="apiconnectors"]');
  let b=document.querySelector('#sidebar .nav-item[data-view="weatherconfiguration"]');
  if(apiNav && !b){
    b=document.createElement('button');
    b.className='nav-item aip-weather-tech-nav'; b.type='button'; b.dataset.view='weatherconfiguration';
    b.innerHTML='<span class="x-dot aip-weather-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.2 4.5 4.5 0 0 0 7 17Z"></path><path d="M12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4"></path></svg></span><span>Weather Integration &amp; Planning Rules</span>';
    apiNav.insertAdjacentElement('afterend',b);
  }
  function markWeatherView(on){
    const v=document.getElementById('view-apiconnectors');
    if(!v)return;
    v.classList.toggle('aip-weather-dedicated',!!on);
    if(on){
      const eng=v.querySelector('#tf832-api'); if(eng)eng.style.display='none';
    }
  }
  function openWeatherConfiguration(){
    window.__AIP_WEATHER_DEDICATED=true;
    try{window.AIP_V21?.open?.('apiconnectors')}catch(_e){apiNav?.click()}
    requestAnimationFrame(()=>{
      markWeatherView(true);
      document.querySelectorAll('#sidebar .nav-item').forEach(x=>x.classList.remove('active'));
      const n=document.querySelector('#sidebar .nav-item[data-view="weatherconfiguration"]');
      n?.classList.add('active');
      const g=n?.closest('.x-nav-group');g?.classList.add('open');g?.querySelector('.x-nav-head')?.setAttribute('aria-expanded','true');if(g)g.querySelector('.x-nav-icon').textContent='−';
    });
  }
  document.addEventListener('click',function(e){
    const n=e.target.closest('#sidebar .nav-item[data-view="weatherconfiguration"]');
    if(!n)return;
  },true);
  document.addEventListener('click',function(e){
    const n=e.target.closest('#sidebar .nav-item[data-view="apiconnectors"]');
    if(!n)return;window.__AIP_WEATHER_DEDICATED=false;markWeatherView(false);
  },false);
  const obsTarget=document.getElementById('view-apiconnectors');
  if(obsTarget)new MutationObserver(()=>{if(window.__AIP_WEATHER_DEDICATED)markWeatherView(true)}).observe(obsTarget,{childList:true,subtree:false});
  window.openWeatherConfiguration=openWeatherConfiguration;
})();
