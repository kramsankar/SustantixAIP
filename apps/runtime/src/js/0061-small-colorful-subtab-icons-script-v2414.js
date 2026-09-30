
(function(){
 const palette=[
  ['#e4f4ff','#1677b8'],['#e8f7ef','#16805b'],['#fff1df','#b76518'],['#f1eaff','#7252b8'],
  ['#ffe8ec','#b23a58'],['#e5f7f5','#087d78'],['#fff6d9','#9b7510'],['#eaf0ff','#4764b3']
 ];
 const icons={
  chart:'<path d="M2 9V6M5 9V3M8 9V5"/><path d="M1 9.5h8"/>',
  asset:'<rect x="2" y="2" width="6" height="6" rx="1"/><path d="M3.5 8v1.5M6.5 8v1.5M1 5h1M8 5h1"/>',
  link:'<path d="M4 6.5 3 7.5a2 2 0 0 1-3-3l1-1a2 2 0 0 1 3 0"/><path d="m6 3.5 1-1a2 2 0 0 1 3 3l-1 1a2 2 0 0 1-3 0"/><path d="m3.5 6.5 3-3"/>',
  wrench:'<path d="M7.8 1.4a2.5 2.5 0 0 0-3.1 3.1L1.4 7.8a1 1 0 0 0 1.4 1.4l3.3-3.3a2.5 2.5 0 0 0 3.1-3.1L7.7 4.3 5.7 2.3z"/>',
  eye:'<path d="M1 5s1.5-2.5 4-2.5S9 5 9 5 7.5 7.5 5 7.5 1 5 1 5z"/><circle cx="5" cy="5" r="1.2"/>',
  leaf:'<path d="M8.8 1.2C5 1.3 2.1 3 2.2 6.2c.1 1.4 1.1 2.5 2.5 2.6C8 9 9 5.7 8.8 1.2z"/><path d="M2 9c1.4-2.3 3-3.8 5.4-5.3"/>',
  database:'<ellipse cx="5" cy="2.5" rx="3.5" ry="1.5"/><path d="M1.5 2.5v5c0 .8 1.6 1.5 3.5 1.5s3.5-.7 3.5-1.5v-5M1.5 5c0 .8 1.6 1.5 3.5 1.5S8.5 5.8 8.5 5"/>',
  shield:'<path d="M5 1 8.5 2.4v2.7C8.5 7.2 7 8.7 5 9.5 3 8.7 1.5 7.2 1.5 5.1V2.4z"/><path d="m3.5 5 1 1 2-2"/>',
  users:'<circle cx="3.5" cy="3.5" r="1.5"/><circle cx="7.5" cy="4" r="1.2"/><path d="M1 8c.4-1.6 1.3-2.4 2.5-2.4S5.7 6.4 6 8M6.2 6c1.6-.3 2.5.5 2.8 1.8"/>',
  gear:'<circle cx="5" cy="5" r="1.5"/><path d="M5 1v1M5 8v1M1 5h1M8 5h1M2.2 2.2l.7.7M7.1 7.1l.7.7M7.8 2.2l-.7.7M2.9 7.1l-.7.7"/>'
 };
 function pick(view){
  view=(view||'').toLowerCase();
  if(/overview|performance|benefit|financial|benchmark|ranking|loss/.test(view)) return 'chart';
  if(/asset|twin|context|relationship/.test(view)) return 'asset';
  if(/integration|api|connector|trace/.test(view)) return 'link';
  if(/maintenance|workorder|corrective|adaptive|preventive|prescriptive|riskbased|opportunistic|reliability|rcm|spares|crew|resource|execution|approval/.test(view)) return 'wrench';
  if(/vision|model|ai|assistant|decision|scenario/.test(view)) return 'eye';
  if(/esg|climate|carbon|water|circular|hse/.test(view)) return 'leaf';
  if(/data/.test(view)) return 'database';
  if(/security|governance|warranty|risk/.test(view)) return 'shield';
  if(/management|portfolio/.test(view)) return 'users';
  return 'gear';
 }
 document.querySelectorAll('#sidebar .nav-item').forEach((btn,i)=>{
  const dot=btn.querySelector('.x-dot'); if(!dot) return;
  const [bg,fg]=palette[i%palette.length];
  dot.style.background=bg; dot.style.color=fg; dot.style.setProperty('--mini-icon-color',fg);
  dot.innerHTML='<svg viewBox="0 0 10 10" aria-hidden="true">'+icons[pick(btn.dataset.view)]+'</svg>';
 });
})();
