
(function(){
 function apply(){
  var b=document.querySelector('#view-overview .ov527-top-wo-action');
  if(b){b.style.setProperty('background','#dbeeff','important');b.style.setProperty('color','#173f60','important');var a=b.querySelector('span');if(a){a.style.setProperty('background','#173f60','important');a.style.setProperty('color','#fff','important');}}
 }
 apply();
 document.addEventListener('click',function(){setTimeout(apply,0);},true);
 ['aip:view-rendered','aip:data-rendered','apm:datasource-refreshed'].forEach(function(n){document.addEventListener(n,apply);});
})();
