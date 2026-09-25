
(function(){
  function humanise(value){
    return String(value||'Application View')
      .replace(/^view-/,'')
      .replace(/([a-z])([A-Z])/g,'$1 $2')
      .replace(/[-_]+/g,' ')
      .replace(/\b\w/g,function(c){return c.toUpperCase();});
  }
  function activeViewKey(){
    var v=document.querySelector('.view.active[id^="view-"]');
    if(v) return v.id.replace(/^view-/,'');
    var n=document.querySelector('.nav-item.active[data-view]');
    return n ? n.dataset.view : 'overview';
  }
  function ensureHelpDefinition(key,view){
    window.V2_HELP=window.V2_HELP||{};
    window.HELP_CONTENT=window.HELP_CONTENT||{};
    if(window.V2_HELP[key]||window.HELP_CONTENT[key]) return;
    var heading=view && view.querySelector('h1,h2,.page-title,.view-title');
    var title=(heading&&heading.textContent.trim())||humanise(key);
    window.V2_HELP[key]={
      title:title,
      what:'This help explains the purpose, principal information and recommended use of the '+title+' view.',
      metrics:[
        {name:'Displayed KPIs',desc:'Headline measures shown on this screen. Values reflect the currently selected data source and filters.'},
        {name:'Charts and tables',desc:'Supporting analysis used to understand drivers, exceptions, priorities and trends.'},
        {name:'Data source',desc:'The active synthetic, bundled Excel or uploaded workbook dataset used by this view.'}
      ],
      interact:'Review the KPI cards first, then use the available filters, charts, tables and drill-down controls to investigate the underlying drivers. Confirm the active data source before interpreting results.',
      tip:'Use F1 Help as the contextual guide for the currently visible screen.',
      sections:[
        {title:'Business value',html:'<p>This screen consolidates its principal business measures and exceptions so users can prioritise investigation and action.</p>'},
        {title:'How to read charts and tables',html:'<p>Use charts for patterns and prioritisation, and tables for record-level evidence. Always confirm filters, units, period and active data source.</p>'},
        {title:'AI and analytical logic',html:'<p>Analytical outputs are decision support. Review confidence, evidence, data quality and operational consequence before approval.</p>'},
        {title:'Data sources and Excel mapping',html:'<p>Values may come from synthetic, bundled Excel or validated uploaded workbook data. Missing fields may reduce coverage.</p>'},
        {title:'Limitations and cautions',html:'<p>Predictions and simulations are estimates. Safety-critical and high-consequence decisions require authorised human review.</p>'}
      ],
      spec:'Contextual screen guidance · KPI interpretation · data-source awareness · governance'
    };
  }
  function makeButton(key){
    var b=document.createElement('button');
    b.type='button';
    b.className='f1-btn';
    b.setAttribute('title','F1 Help');
    b.setAttribute('aria-label','Open F1 Help for '+humanise(key));
    b.setAttribute('aria-expanded','false');
    b.dataset.helpView=key;
    b.innerHTML='<span class="f1-key">F1</span> Help';
    b.addEventListener('click',function(){ window.openHelp(key); });
    return b;
  }
  function ensureF1Help(viewOrKey){
    var key=typeof viewOrKey==='string' ? viewOrKey : activeViewKey();
    var view=document.getElementById('view-'+key)||document.querySelector('.view.active');
    if(!view) return;
    ensureHelpDefinition(key,view);
    var buttons=view.querySelectorAll('.f1-btn');
    if(!buttons.length){
      var head=view.querySelector(':scope > .view-head, :scope > .page-head, .view-head, .page-head');
      var b=makeButton(key);
      if(head){
        head.appendChild(b);
      }else{
        var row=document.createElement('div');
        row.className='f1-help-fallback-row';
        row.appendChild(b);
        view.insertBefore(row,view.firstChild);
      }
    }else{
      buttons.forEach(function(b){
        b.dataset.helpView=b.dataset.helpView||key;
        b.setAttribute('title','F1 Help');
        b.setAttribute('aria-label','Open F1 Help for '+humanise(key));
        b.setAttribute('aria-expanded',document.getElementById('helpOverlay')?.classList.contains('open')?'true':'false');
      });
    }
  }
  window.ensureF1Help=ensureF1Help;

  var originalOpen=window.openHelp;
  window.openHelp=function(key){
    key=key||activeViewKey();
    var view=document.getElementById('view-'+key)||document.querySelector('.view.active');
    ensureHelpDefinition(key,view);
    ensureF1Help(key);
    if(typeof originalOpen==='function') originalOpen(key);
    document.querySelectorAll('.f1-btn').forEach(function(b){
      var isActive=(b.closest('.view.active') && (b.dataset.helpView||key)===key);
      b.classList.toggle('active',!!isActive);
      b.setAttribute('aria-expanded',isActive?'true':'false');
    });
  };

  var originalActivate=window.activate;
  if(typeof originalActivate==='function'){
    window.activate=function(view,force){
      var result=originalActivate(view,force);
      requestAnimationFrame(function(){
        ensureF1Help(view);
        setTimeout(function(){ensureF1Help(view);},80);
      });
      return result;
    };
  }

  document.addEventListener('keydown',function(e){
    if(e.key==='F1'){
      e.preventDefault();
      window.openHelp(activeViewKey());
    }
  });

  var overlay=document.getElementById('helpOverlay');
  if(overlay){
    new window.__APMSafeMutationObserver(function(){
      var open=overlay.classList.contains('open');
      document.querySelectorAll('.f1-btn').forEach(function(b){
        if(!open){ b.classList.remove('active'); b.setAttribute('aria-expanded','false'); }
      });
    }).observe(overlay,{attributes:true,attributeFilter:['class']});
  }

  var viewHost=document.getElementById('main')||document.body;
  var queued=false;
  new window.__APMSafeMutationObserver(function(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(function(){queued=false;ensureF1Help();});
  }).observe(viewHost,{childList:true,subtree:true});

  function boot(){
    document.querySelectorAll('.view[id^="view-"]').forEach(function(v){
      ensureF1Help(v.id.replace(/^view-/,''));
    });
    ensureF1Help();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
