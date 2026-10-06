
/* ==========================================================================
   AIP v875 · dependency-free 3D renderer (Canvas 2D)
   Perspective camera, orbit/pan/zoom, painter's-sorted flat-shaded boxes,
   sun-driven Lambert shading, ground-projected shadows, picking, flow dots.
   ========================================================================== */
(function (root) {
  'use strict';
  var D2R = Math.PI / 180;
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgbStr(c, k) { k = k == null ? 1 : k; return 'rgb(' + Math.round(Math.min(255, c[0] * k)) + ',' + Math.round(Math.min(255, c[1] * k)) + ',' + Math.round(Math.min(255, c[2] * k)) + ')'; }

  /* Box as 8 verts, optional rotation about local axis 'x' or 'z' through its centre */
  function boxVerts(c, s, axis, ang) {
    var hx = s[0] / 2, hy = s[1] / 2, hz = s[2] / 2, v = [], ca = Math.cos(ang || 0), sa = Math.sin(ang || 0);
    var L = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]];
    for (var i = 0; i < 8; i++) {
      var p = L[i], x = p[0], y = p[1], z = p[2];
      if (axis === 'z') { var nx = x * ca - y * sa, ny = x * sa + y * ca; x = nx; y = ny; }
      else if (axis === 'x') { var ny2 = y * ca - z * sa, nz = y * sa + z * ca; y = ny2; z = nz; }
      v.push([c[0] + x, c[1] + y, c[2] + z]);
    }
    return v;
  }
  var FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]]; // -z,+z,-y,+y,+x,-x (outward CCW)

  function hull(pts) {
    pts.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [], i;
    for (i = 0; i < pts.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop(); lo.push(pts[i]); }
    for (i = pts.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], pts[i]) <= 0) up.pop(); up.push(pts[i]); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function pointInPoly(x, y, poly) {
    var ins = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }

  function Viewer(canvas, opts) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { target: [0, 0, 0], yaw: -35 * D2R, pitch: 38 * D2R, dist: 420, fov: 42 * D2R };
    this.sun = { dir: norm([0.3, 0.8, 0.3]), elev: 45, beam: 1 };
    this.objs = []; this.ground = []; this.flows = []; this.labels = [];
    this.picked = []; this.hoverId = null; this.selectedId = null;
    this.onPick = opts && opts.onPick; this.onHover = opts && opts.onHover;
    this.t0 = performance.now();
    this._bind();
  }
  Viewer.prototype._bind = function () {
    var self = this, cv = this.cv, drag = null;
    cv.addEventListener('mousedown', function (e) { drag = { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey, moved: 0 }; e.preventDefault(); });
    window.addEventListener('mousemove', function (e) {
      if (!cv.isConnected) { drag = null; return; }
      if (!drag) { self._hover(e); return; }
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      var c = self.cam;
      if (drag.btn === 2 || drag.shift) {
        var s = c.dist / 900, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
        // right = (cos yaw, 0, -sin yaw); ground-forward = (-sin yaw, 0, -cos yaw)
        c.target[0] += -dx * cy * s - dy * sy * s;
        c.target[2] += dx * sy * s - dy * cy * s;
      } else {
        c.yaw -= dx * 0.006; c.pitch = Math.max(8 * D2R, Math.min(85 * D2R, c.pitch + dy * 0.005));
      }
      self.dirty = true; if (self.onChange) self.onChange();
    });
    window.addEventListener('mouseup', function (e) {
      if (drag && drag.moved < 4) self._click(e);
      drag = null;
    });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); self.cam.dist = Math.max(self.minDist||60, Math.min(self.maxDist||6000, self.cam.dist * (e.deltaY > 0 ? 1.1 : 0.9))); self.dirty = true; if (self.onChange) self.onChange(); }, { passive: false });
    // touch: one-finger orbit
    var tp = null;
    cv.addEventListener('touchstart', function (e) { if (e.touches.length === 1) tp = { x: e.touches[0].clientX, y: e.touches[0].clientY, m: 0 }; }, { passive: true });
    cv.addEventListener('touchmove', function (e) { if (!tp || e.touches.length !== 1) return; var dx = e.touches[0].clientX - tp.x, dy = e.touches[0].clientY - tp.y; tp.x += dx; tp.y += dy; tp.m += Math.abs(dx) + Math.abs(dy); self.cam.yaw -= dx * 0.006; self.cam.pitch = Math.max(8 * D2R, Math.min(85 * D2R, self.cam.pitch + dy * 0.005)); }, { passive: true });
  };
  Viewer.prototype._xy = function (e) { var r = this.cv.getBoundingClientRect(); return [(e.clientX - r.left) * (this.cv.width / r.width), (e.clientY - r.top) * (this.cv.height / r.height)]; };
  Viewer.prototype.pickAt = function (x, y) {
    for (var i = this.picked.length - 1; i >= 0; i--) if (this.picked[i].id && pointInPoly(x, y, this.picked[i].poly)) return this.picked[i].id;
    return null;
  };
  Viewer.prototype._click = function (e) {
    var r = this.cv.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    var p = this._xy(e), id = this.pickAt(p[0], p[1]);
    this.selectedId = id; if (this.onPick) this.onPick(id);
  };
  Viewer.prototype._hover = function (e) {
    var r = this.cv.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { if (this.hoverId) { this.hoverId = null; if (this.onHover) this.onHover(null); } return; }
    var p = this._xy(e), id = this.pickAt(p[0], p[1]);
    this.cv.style.cursor = id ? 'pointer' : 'grab';
    if (id !== this.hoverId) { this.hoverId = id; if (this.onHover) this.onHover(id, e); }
    else if (id && this.onHover) this.onHover(id, e, true);
  };
  Viewer.prototype.setSun = function (azDeg, elDeg, beamFrac) {
    var az = azDeg * D2R, el = Math.max(elDeg, -5) * D2R;
    // world: x=E, y=up, z=S  -> sun vector: E=sin(az)cos(el), N=cos(az)cos(el) => z=-N
    this.sun.dir = norm([Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]);
    this.sun.elev = elDeg; this.sun.beam = beamFrac == null ? 1 : beamFrac;
  };
  Viewer.prototype.render = function () {
    var cv = this.cv, ctx = this.ctx, W = cv.width, H = cv.height, c = this.cam;
    var eye = [c.target[0] + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), c.target[1] + c.dist * Math.sin(c.pitch), c.target[2] + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw)];
    var f = norm(sub(c.target, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    var F = H / 2 / Math.tan(c.fov / 2), cx = W / 2, cy = H / 2;
    function proj(p) { var d = sub(p, eye), z = dot(d, f); if (z < 1) return null; return [cx + dot(d, r) * F / z, cy - dot(d, u) * F / z, z]; }
    this.eye = eye; this._proj = proj;
    var day = this.sun.elev > 0, L = this.sun.dir;
    var lightK = day ? 0.7 + 0.3 * Math.min(1, this.sun.elev / 25) : 0.78;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    // horizon haze
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.5); g.addColorStop(0, day ? '#ffffff' : '#f4f6f9'); g.addColorStop(1, day ? '#f6f9fb' : '#eef1f5');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.5);
    // ground polygons (no sort, drawn back-to-front by list order)
    var i, j;
    for (i = 0; i < this.ground.length; i++) {
      var gp = this.ground[i], pts = [];
      for (j = 0; j < gp.pts.length; j++) { var q = proj(gp.pts[j]); if (!q) { pts = null; break; } pts.push(q); }
      if (!pts) continue;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]); ctx.closePath();
      ctx.fillStyle = rgbStr(hex2rgb(gp.color), day ? 1 : 0.93); ctx.fill();
      if (gp.stroke) { ctx.strokeStyle = gp.stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }
    // shadows (single union path, alpha tied to direct-beam fraction)
    if (day && this.sun.elev > 2 && L[1] > 0.03) {
      ctx.beginPath(); var any = false;
      for (i = 0; i < this.objs.length; i++) {
        var o = this.objs[i]; if (!o.shadow) continue;
        var gpts = o.v.map(function (p) { var k = p[1] / L[1]; return [p[0] - L[0] * k, p[2] - L[2] * k]; });
        var hl = hull(gpts), sp = [];
        for (j = 0; j < hl.length; j++) { var qq = proj([hl[j][0], 0.02, hl[j][1]]); if (!qq) { sp = null; break; } sp.push(qq); }
        if (!sp || sp.length < 3) continue;
        ctx.moveTo(sp[0][0], sp[0][1]); for (j = 1; j < sp.length; j++) ctx.lineTo(sp[j][0], sp[j][1]); ctx.closePath(); any = true;
      }
      if (any) { ctx.fillStyle = 'rgba(38,52,66,' + (0.07 + 0.16 * this.sun.beam).toFixed(3) + ')'; ctx.fill('nonzero'); }
    }
    // flows (cables + moving dots)
    var tnow = (performance.now() - this.t0) / 1000;
    for (i = 0; i < this.flows.length; i++) {
      var fl = this.flows[i], P = [];
      for (j = 0; j < fl.path.length; j++) { var pp = proj(fl.path[j]); if (!pp) { P = null; break; } P.push(pp); }
      if (!P) continue;
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (j = 1; j < P.length; j++) ctx.lineTo(P[j][0], P[j][1]);
      ctx.strokeStyle = fl.cable || '#c3ccd4'; ctx.lineWidth = 1.2; ctx.stroke();
      if (Math.abs(fl.power) > 1e-3) {
        var segL = [], tot = 0; for (j = 1; j < P.length; j++) { var l = Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]); segL.push(l); tot += l; }
        if (tot < 4) continue;
        var spacing = 26, speed = 18 + 70 * Math.min(1, Math.abs(fl.power)), off = (tnow * speed) % spacing, dir = fl.power > 0 ? 1 : -1;
        ctx.fillStyle = fl.color;
        for (var s = off; s < tot; s += spacing) {
          var d = dir > 0 ? s : tot - s, acc = 0, k = 0;
          while (k < segL.length && acc + segL[k] < d) { acc += segL[k]; k++; }
          if (k >= segL.length) continue;
          var t = (d - acc) / (segL[k] || 1), x = P[k][0] + (P[k + 1][0] - P[k][0]) * t, y = P[k][1] + (P[k + 1][1] - P[k][1]) * t;
          ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.283); ctx.fill();
        }
      }
    }
    // faces
    var faces = [];
    for (i = 0; i < this.objs.length; i++) {
      var ob = this.objs[i], base = hex2rgb(ob.color), topC = ob.top ? hex2rgb(ob.top) : base, sideC = ob.side ? hex2rgb(ob.side) : base;
      var pv = ob.v.map(proj); if (pv.some(function (x) { return !x; })) continue;
      for (j = 0; j < 6; j++) {
        var fi = FACES[j], a = ob.v[fi[0]], b = ob.v[fi[1]], cc = ob.v[fi[2]];
        var n = norm(cross(sub(b, a), sub(cc, a)));
        var ctr = [(a[0] + cc[0]) / 2, (a[1] + cc[1]) / 2, (a[2] + cc[2]) / 2];
        if (dot(n, sub(ctr, eye)) >= 0) continue; // back-face
        var col = n[1] > 0.5 ? topC : (n[1] < -0.5 ? sideC.map(function (x) { return x * 0.7; }) : sideC);
        var lam = day ? Math.max(0, dot(n, L)) : 0;
        var shade = (0.58 + 0.42 * lam * (0.35 + 0.65 * this.sun.beam) + (n[1] > 0.5 ? 0.06 : 0)) * lightK;
        var poly = [pv[fi[0]], pv[fi[1]], pv[fi[2]], pv[fi[3]]];
        faces.push({ z: (poly[0][2] + poly[1][2] + poly[2][2] + poly[3][2]) / 4, poly: poly, fill: rgbStr(col, shade), id: ob.id, hl: ob.id && (ob.id === this.selectedId || ob.id === this.hoverId), sel: ob.id && ob.id === this.selectedId, stroke: ob.stroke });
      }
    }
    faces.sort(function (a, b) { return b.z - a.z; });
    this.picked = [];
    for (i = 0; i < faces.length; i++) {
      var fc = faces[i], p0 = fc.poly;
      ctx.beginPath(); ctx.moveTo(p0[0][0], p0[0][1]); for (j = 1; j < 4; j++) ctx.lineTo(p0[j][0], p0[j][1]); ctx.closePath();
      ctx.fillStyle = fc.fill; ctx.fill();
      ctx.lineWidth = fc.sel ? 1.6 : 0.6; ctx.strokeStyle = fc.sel ? '#0b3a63' : (fc.hl ? '#3f7fb3' : (fc.stroke || 'rgba(30,40,50,0.18)')); ctx.stroke();
      this.picked.push({ id: fc.id, poly: p0 });
    }
    // labels
    ctx.font = '600 11px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < this.labels.length; i++) {
      var lb = this.labels[i], lp = proj(lb.at); if (!lp) continue;
      var tw = ctx.measureText(lb.text).width + 10;
      ctx.fillStyle = lb.bg || 'rgba(255,255,255,0.88)'; ctx.strokeStyle = lb.border || 'rgba(23,74,115,0.25)'; ctx.lineWidth = 1;
      roundRect(ctx, lp[0] - tw / 2, lp[1] - 9, tw, 18, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = lb.color || '#1d3549'; ctx.fillText(lb.text, lp[0], lp[1] + 0.5);
    }
    this.dirty = false;
  };
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
  Viewer.prototype.project = function (p) { return this._proj ? this._proj(p) : null; };

  root.AIP3D = { Viewer: Viewer, boxVerts: boxVerts, hex2rgb: hex2rgb, mix: mix, rgbStr: rgbStr };
})(typeof window !== 'undefined' ? window : globalThis);

/* AIP v875 · Operational Twin › 3D Plant View.
   Schematic 3D layout generated at run time from master data (Sites, Inverter Configuration, Asset Master, BESS Systems),
   with tracker angles, sun position and inverter state from the twin engines. No layout or values are embedded. */
(function(){
'use strict';
var E=window.AIPTwinPhysics,V3=window.AIP3D;if(!E||!V3)return;
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var n=function(v,d){if(v===null||v===undefined||v==='')return d===undefined?NaN:d;var x=Number(v);return Number.isFinite(x)?x:(d===undefined?NaN:d)};
var esc=function(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var f1=function(v){return Number.isFinite(v)?v.toLocaleString('en-IN',{minimumFractionDigits:1,maximumFractionDigits:1}):'—'},f2=function(v){return Number.isFinite(v)?v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'};
var MODE='status',VIEWER=null,CANVAS=null,SCENE=null,PLAY=null,RAF=0;
function pid(){var s=$('#view-operationaltwin #tSite');return (s&&s.value)||window.AIP_TWIN_SITE||'SP-01'}
function hourNow(){var t=$('#view-operationaltwin #tTime');return n(t&&t.value,12)}
function synth(){return window.AIP_SYNTHETIC_ACTIVE===true||/synthetic/i.test(String(window.APM_DATA_MODE||''))}
function modeLabel(){var m='';try{m=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'')}catch(_){}return synth()?'Synthetic dataset':(m||'Excel dataset')}
var TONE={green:'#3f8f6b',amber:'#e0a526',red:'#d64545',grey:'#9aa7b1'},PANEL='#2f4f73',CAUSE={trip:'#d64545',derate:'#f08c00',strings:'#8e24aa',tracker:'#1e88e5',conversion:'#6d4c41',data:'#9aa7b1',other:'#c0ca33'};

/* ---------- schematic layout from master data ---------- */
function build(){
  var inv=window.AIP_INV874&&window.AIP_INV874.model(pid());if(!inv||inv.error)return {error:inv?inv.error:'Inverter twin unavailable'};
  var P=inv.P,site=inv.site||{},cfg=inv.cfg.slice().sort(function(a,b){return String(a.Inverter_Tag).localeCompare(String(b.Inverter_Tag))}),N=cfg.length;
  var totalRows=n(site.Tracker_Rows,N*12),rowsPer=Math.max(4,Math.min(18,Math.round(totalRows/Math.max(1,N))));
  var gcr=P.mounting==='tracker'?P.gcr:0.45,rowW=4.6,pitch=rowW/gcr,rowL=62,sub=rowsPer*pitch,gapX=14,gapZ=26;
  var blocks={};cfg.forEach(function(c){(blocks[c.Block_ID||'B01']=blocks[c.Block_ID||'B01']||[]).push(c)});
  var bk=Object.keys(blocks).sort(),perRow=Math.ceil(Math.sqrt(N*rowL/(sub))*1.1),cells=[],col=0,row=0;
  // place subfields block by block, wrapping into rows
  bk.forEach(function(b){blocks[b].forEach(function(c){cells.push({c:c,b:b,x:col*(sub+gapX),z:row*(rowL+gapZ)});col++;if(col>=perRow){col=0;row++}})});
  var W=perRow*(sub+gapX),D=(row+1)*(rowL+gapZ),cx=W/2,cz=D/2;
  var byId={};inv.A.inverters.forEach(function(o){byId[o.id]=o});
  var S={inv:inv,P:P,cells:cells,rowsPer:rowsPer,pitch:pitch,rowW:rowW,rowL:rowL,sub:sub,W:W,D:D,cx:cx,cz:cz,byId:byId,
    bess:window.AIP_BESS873?window.AIP_BESS873.model(pid()):null};
  return S;
}
function stateAt(o,h){if(!o)return null;var q=o.iv.reduce(function(b,x){return !b||Math.abs(x.t.hour-h)<Math.abs(b.t.hour-h)?x:b},null);return q}
function toneOf(o){return window.AIP_INV874&&window.AIP_INV874.tone?window.AIP_INV874.tone(o):'green'}
function populate(S){
  var v=VIEWER,h=hourNow(),P=S.P,tel=S.inv.tel,r=tel.reduce(function(b,x){var hh=E.parseStamp(x.Timestamp).hour;return !b||Math.abs(hh-h)<Math.abs(E.parseStamp(b.Timestamp).hour-h)?x:b},null);
  var x=r?E.interval(P,r):null,sun=x?x.sun:{azimuth:180,elevation:45},rot=x&&x.orient&&x.orient.rotation!=null?x.orient.rotation:0;
  v.objs=[];v.ground=[];v.labels=[];v.flows=[];
  v.setSun(sun.azimuth,sun.elevation,x&&x.clearSky.poa>0?Math.min(1,x.poa/Math.max(1,x.clearSky.poa)):0);
  var pad=40;v.ground.push({pts:[[-S.cx-pad,0,-S.cz-pad],[S.W-S.cx+pad,0,-S.cz-pad],[S.W-S.cx+pad,0,S.D-S.cz+pad+60],[-S.cx-pad,0,S.D-S.cz+pad+60]],color:'#eef3ec',stroke:'#d5dfd2'});
  S.cells.forEach(function(cell){
    var o=S.byId[cell.c.Asset_ID],q=stateAt(o,h),tn=toneOf(o),fault=o&&o.primary;
    var stuck=o&&o.parts&&o.parts.tracker>0.0001,tripped=q&&/trip/i.test(q.st);
    var color=MODE==='status'?(tn==='green'?PANEL:TONE[tn]):MODE==='cause'?(fault&&o.flag!=='ok'?CAUSE[fault]:PANEL):(function(){var pi=o&&Number.isFinite(o.pi)?o.pi:1;var t=Math.max(0,Math.min(1,(pi-0.85)/0.15));return '#'+V3.mix(V3.hex2rgb('#d64545'),V3.hex2rgb('#3f8f6b'),t).map(function(c){return Math.round(c).toString(16).padStart(2,'0')}).join('')})();
    var x0=cell.x-S.cx,z0=cell.z-S.cz;
    v.ground.push({pts:[[x0-3,0.01,z0-3],[x0+S.sub+3,0.01,z0-3],[x0+S.sub+3,0.01,z0+S.rowL+3],[x0-3,0.01,z0+S.rowL+3]],color:'#e3ebe1'});
    var measured=q&&Number.isFinite(q.trackerAngle)?q.trackerAngle:null;var ang=(measured!=null?measured:rot)*Math.PI/180;
    for(var k=0;k<S.rowsPer;k++){
      var cxr=x0+S.pitch*(k+0.5),c=[cxr,1.9,z0+S.rowL/2];
      v.objs.push({v:V3.boxVerts(c,[S.rowW,0.12,S.rowL],'z',ang),color:color,top:color,side:'#1d3044',id:'inv:'+cell.c.Asset_ID,shadow:true});
    }
    var skC=tripped?'#d64545':(q&&/derat/i.test(q.st)?'#f08c00':'#dfe6ea');
    v.objs.push({v:V3.boxVerts([x0+S.sub/2,1.3,z0+S.rowL+9],[6,2.6,2.6],null,0),color:skC,top:skC,side:'#b8c4cb',id:'inv:'+cell.c.Asset_ID,shadow:true});
    if(o&&o.flag!=='ok'&&MODE!=='plain')v.labels.push({at:[x0+S.sub/2,9,z0+S.rowL/2],text:String(cell.c.Inverter_Tag).replace(/^.*INV-/,'INV ')+' · '+(window.AIP_INV874.causeLabel(o.primary)||''),bg:'rgba(255,255,255,0.92)',border:TONE[tn]||'#9aa7b1'});
  });
  // substation + BESS yard to the south
  var subX=-S.cx,subZ=S.D-S.cz+20;
  v.objs.push({v:V3.boxVerts([subX+18,3,subZ+14],[26,6,18],null,0),color:'#cfd8dc',top:'#e8edf0',id:'sub',shadow:true});
  v.labels.push({at:[subX+18,11,subZ+14],text:'Pooling substation · '+(S.inv.site&&S.inv.site.Grid_Connection_kV?S.inv.site.Grid_Connection_kV+' kV':'POI')});
  if(S.bess&&!S.bess.error){
    var B=S.bess,nC=n(B.P.containers,0),perR=Math.ceil(Math.sqrt(nC*2)),bi=S.bess.D.intervals,qb=bi.reduce(function(b,x){return !b||Math.abs(x.t.hour-h)<Math.abs(b.t.hour-h)?x:b},null);
    var soc=qb?qb.soc:NaN,mode=qb?(qb.pd>0?'discharging':qb.pc>0?'charging':'standby'):'',cc=mode==='discharging'?'#1687b1':mode==='charging'?'#43a047':'#c9d3da',hot=qb&&qb.tmax>=B.P.tAlarm;
    for(var i=0;i<nC;i++){var cx2=subX+60+(i%perR)*8.5,cz2=subZ+(Math.floor(i/perR))*5.2;v.objs.push({v:V3.boxVerts([cx2,1.3,cz2],[6.1,2.6,2.4],null,0),color:cc,top:'#eef2f5',id:'bess',shadow:true})}
    v.labels.push({at:[subX+60+perR*4.2,8,subZ+Math.ceil(nC/perR)*2.6],text:'BESS '+f1(B.P.mw)+' MW / '+f1(B.P.contracted)+' MWh · '+mode+' · SoC '+f1(soc)+'%'+(hot?' · cell temperature alarm':''),border:hot?'#d64545':undefined});
    v.flows.push({path:[[subX+60,1,subZ],[subX+31,1,subZ+14]],power:qb?(qb.pd-qb.pc)/Math.max(1,B.P.mw):0,color:'#1687b1'});
  }
  v.flows.push({path:[[0,0.6,S.D-S.cz],[subX+18,0.6,subZ+5]],power:r?Math.min(1,n(r.Actual_AC_MW,0)/Math.max(1,P.acMW)):0,color:'#f59e0b'});
  S.snap={r:r,x:x,rot:rot,h:h};
  v.dirty=true;
}
function frame(){RAF=0;var b=$('#view-operationaltwin #tLayers .t875-tab');if(!VIEWER||!CANVAS||!CANVAS.isConnected||!(b&&b.classList.contains('active')))return;
  var r=CANVAS.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(300,Math.round(r.width*dpr)),hh=Math.max(260,Math.round(r.height*dpr));
  if(CANVAS.width!==w||CANVAS.height!==hh){CANVAS.width=w;CANVAS.height=hh;VIEWER.dirty=true}
  var now=performance.now();if(VIEWER.dirty||(now-(VIEWER._last||0)>250&&VIEWER.flows.some(function(f){return Math.abs(f.power)>1e-3}))){var t0=performance.now();VIEWER.render();VIEWER._last=now;VIEWER._cost=performance.now()-t0}
  RAF=requestAnimationFrame(frame);}
function kick(){if(!RAF)RAF=requestAnimationFrame(frame)}
function hoverCard(id,e){var card=$('#t875Card');if(!card)return;if(!id||!SCENE){card.hidden=true;return}
  var html='';if(id.indexOf('inv:')===0){var o=SCENE.byId[id.slice(4)],q=stateAt(o,hourNow());if(!o)return;
    html='<b>'+esc(o.tag)+'</b><span>Block '+esc(o.block)+' · '+f2(o.ac)+' MW AC · '+f2(o.dc)+' MWp</span><span>Now: '+(q&&Number.isFinite(q.acM)?f2(q.acM):'no data')+' of '+(q?f2(q.acExp):'—')+' MW expected · '+esc(q?q.st:'')+'</span><span>Day performance '+f1(o.pi*100)+'% · '+esc(o.flag==='ok'?'no finding':window.AIP_INV874.causeLabel(o.primary))+'</span><em>Click to open the inverter trace</em>'}
  else if(id==='bess'&&SCENE.bess&&!SCENE.bess.error){var B=SCENE.bess;html='<b>'+esc(B.P.name)+'</b><span>'+f1(B.P.mw)+' MW / '+f1(B.P.contracted)+' MWh · '+esc(B.P.model)+'</span><em>Click to open the BESS twin</em>'}
  else if(id==='sub')html='<b>Pooling substation</b><span>Point of interconnection for PV'+(SCENE.bess&&!SCENE.bess.error?' and BESS':'')+'</span>';
  var wrap=$('#t875Wrap'),r=wrap.getBoundingClientRect();card.innerHTML=html;card.hidden=false;card.style.left=Math.min(r.width-260,e.clientX-r.left+14)+'px';card.style.top=Math.max(8,e.clientY-r.top-10)+'px';}
function onPick(id){if(!id)return;if(id.indexOf('inv:')===0&&window.AIP_INV874)window.AIP_INV874.open(id.slice(4));else if(id==='bess'&&window.AIP_BESS873)window.AIP_BESS873.activate()}
function fit(){if(!VIEWER||!SCENE)return;var c=VIEWER.cam,ext=Math.max(SCENE.W,SCENE.D+120);c.target=[0,0,Math.max(20,SCENE.D*0.08)];c.dist=ext*1.4;c.yaw=-28*Math.PI/180;c.pitch=40*Math.PI/180;VIEWER.maxDist=ext*4;VIEWER.minDist=40;VIEWER.dirty=true;kick()}
function render(){
  var v=$('#view-operationaltwin'),body=v&&$('#twBody',v);if(!body)return false;v.classList.add('t875-3d-active');var tk=$('#tKpis',v);if(tk)tk.innerHTML='';
  var S;try{S=build()}catch(e){console.error('[AIP v875 3D]',e);S={error:String(e&&e.message||e)}}
  if(S.error){body.innerHTML='<section class="ot297-card"><h3>3D plant view unavailable</h3><div class="t872-note warn">'+esc(S.error)+'</div></section>';return true}
  var siteChanged=!SCENE||SCENE.inv.id!==S.inv.id;SCENE=S;
  var under=S.inv.A.inverters.filter(function(o){return o.flag!=='ok'}).length;
  body.innerHTML='<div class="ot297-source t872-lineage"><span class="ot297-dot"></span><b>3D plant view</b><span>schematic layout generated from master data (Sites, Inverter Configuration, BESS Systems) — not a surveyed site plan · '+esc(modeLabel())+'</span><span class="t872-sep">·</span><span>'+esc(S.inv.name)+' · '+S.cells.length+' inverter blocks × '+S.rowsPer+' '+(S.P.mounting==='tracker'?'representative tracker rows':'representative table rows')+(S.bess&&!S.bess.error?' · BESS yard':'')+'</span></div>'+
   '<section class="ot297-card"><div class="t872-head"><div><h3>3D plant view — '+esc(S.inv.name)+'</h3><div class="t872-subline">Schematic geometry: dimensions and row count are representative. Colour shows operating-day findings; output and equipment state follow Solar Hour. Tracker angle is modelled unless measured telemetry is available. A suspected fault does not establish its physical angle. Drag to orbit, shift-drag or right-drag to pan, scroll to zoom. Hover for details; click an inverter block for its trace or the battery yard for the BESS twin.</div></div>'+
   '<div class="t875-tools"><div class="t872-seg">'+[['status','Day status'],['cause','Probable cause'],['pi','Day performance'],['plain','Plain']].map(function(m){return '<button type="button" data-m="'+m[0]+'" class="'+(MODE===m[0]?'active':'')+'">'+m[1]+'</button>'}).join('')+'</div><button type="button" class="t874-btn" id="t875Play">'+(PLAY?'Pause day':'Play day')+'</button><button type="button" class="t874-btn" id="t875Fit">Reset view</button><button type="button" class="t874-btn" id="t875Top">Plan view</button></div></div>'+
   '<div class="t875-wrap" id="t875Wrap"><div id="t875Host" class="t875-host"></div><div class="t875-card" id="t875Card" hidden></div><div class="t875-hud" id="t875Hud"></div></div>'+
   '<div class="t875-legend">'+(MODE==='cause'?Object.keys(CAUSE).map(function(k){return '<span><i style="background:'+CAUSE[k]+'"></i>'+esc(window.AIP_INV874.causeLabel(k))+'</span>'}).join(''):MODE==='pi'?'<span><i style="background:#d64545"></i>≤ 85%</span><span><i style="background:#3f8f6b"></i>100% of expected</span>':'<span><i style="background:'+PANEL+'"></i>Normal</span><span><i style="background:#e0a526"></i>Underperforming</span><span><i style="background:#d64545"></i>Trip or &lt; 90%</span><span><i style="background:#9aa7b1"></i>Telemetry gap</span>')+'<span><i style="background:#1687b1"></i>BESS discharging</span><span><i style="background:#43a047"></i>BESS charging</span><span class="t875-note">'+under+' inverter finding(s) today</span></div></section>';
  if(!CANVAS){CANVAS=document.createElement('canvas');CANVAS.className='t875-canvas';VIEWER=new V3.Viewer(CANVAS,{onPick:onPick,onHover:hoverCard});VIEWER.onChange=kick}
  $('#t875Host',body).appendChild(CANVAS);
  populate(S);if(siteChanged)fit();updateHud();kick();
  $$('.t875-tools [data-m]',body).forEach(function(b){b.onclick=function(){MODE=b.dataset.m;render()}});
  $('#t875Fit',body).onclick=fit;
  $('#t875Top',body).onclick=function(){VIEWER.cam.pitch=84*Math.PI/180;VIEWER.cam.yaw=0;VIEWER.dirty=true;kick()};
  $('#t875Play',body).onclick=togglePlay;
  return true;
}
function updateHud(){var hud=$('#t875Hud');if(!hud||!SCENE||!SCENE.snap)return;var s=SCENE.snap,r=s.r,x=s.x;
  hud.innerHTML='<b>'+E.hhmm(s.h*60)+'</b><span>Sun '+(x?f1(x.sun.elevation)+'° elevation · '+f1(x.sun.azimuth)+'° azimuth':'—')+'</span><span>'+(SCENE.P.mounting==='tracker'?'Modelled tracker angle '+f1(s.rot)+'°':'Fixed tilt '+f1(SCENE.P.tilt)+'°')+'</span><span>Plant output '+(r?f1(n(r.Actual_AC_MW))+' MW':'—')+' of '+f1(SCENE.P.acMW)+' MW</span>';}
function refresh(){if(!SCENE||!isActive())return;populate(SCENE);updateHud();kick()}
function togglePlay(){var t=$('#view-operationaltwin #tTime');if(PLAY){clearInterval(PLAY);PLAY=null;var b=$('#t875Play');if(b)b.textContent='Play day';return}
  if(!t)return;var b2=$('#t875Play');if(b2)b2.textContent='Pause day';if(n(t.value)>=n(t.max)-0.01)t.value=t.min;
  PLAY=setInterval(function(){if(!isActive()){clearInterval(PLAY);PLAY=null;return}var v=n(t.value)+0.25;if(v>n(t.max)){clearInterval(PLAY);PLAY=null;var b3=$('#t875Play');if(b3)b3.textContent='Play day';return}t.value=v;var hl=$('#view-operationaltwin #tHour');if(hl)hl.textContent=E.hhmm(v*60);refresh()},350);}
function isActive(){var b=$('#view-operationaltwin #tLayers .t875-tab');return !!(b&&b.classList.contains('active'))}
function activate(){var v=$('#view-operationaltwin');if(!v)return;$$('#tLayers .xi-tab',v).forEach(function(x){x.classList.remove('active')});var b=$('#tLayers .t875-tab',v);if(b)b.classList.add('active');v.classList.remove('t873-bess-active','t874-inv-active');
  window.AIP_V21=window.AIP_V21||{};window.AIP_V21.state=window.AIP_V21.state||{};window.AIP_V21.state.layer='3D Plant View';render()}
function ensureTab(){var v=$('#view-operationaltwin'),t=v&&$('#tLayers',v);if(!t)return;var b=$('.t875-tab',t);
  if(!b){b=document.createElement('button');b.type='button';b.className='xi-tab t875-tab';b.textContent='3D Plant View';var ref=$('.t874-tab',t);if(ref&&ref.nextSibling)t.insertBefore(b,ref.nextSibling);else t.appendChild(b)}
  b.onclick=function(e){if(e)e.preventDefault();activate()};
  if(window.AIP_V21&&window.AIP_V21.state&&window.AIP_V21.state.layer==='3D Plant View'&&!isActive())activate();else if(isActive())render();else v.classList.remove('t875-3d-active');}
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('#view-operationaltwin #tLayers .xi-tab');if(t&&!t.classList.contains('t875-tab')&&!t.classList.contains('t875-cr-tab')){var v=$('#view-operationaltwin');if(v)v.classList.remove('t875-3d-active');if(PLAY){clearInterval(PLAY);PLAY=null}}},true);
document.addEventListener('input',function(e){if(e.target&&e.target.id==='tTime'&&isActive())refresh()},false);
document.addEventListener('change',function(e){if(e.target&&e.target.matches&&e.target.matches('#view-operationaltwin #tSite')&&isActive()){setTimeout(activate,80);setTimeout(function(){if(isActive())render()},300)}},false);
document.addEventListener('aip:data-source-changed',function(){SCENE=null;setTimeout(ensureTab,450)});
function hook(){var Rr=window.AIP_V21&&window.AIP_V21.renderers;if(!Rr||typeof Rr.operationaltwin!=='function')return setTimeout(hook,100);var prior=Rr.operationaltwin;if(prior.__v875)return;
  var w=function(){var out=prior.apply(this,arguments);setTimeout(ensureTab,0);setTimeout(ensureTab,260);return out};w.__v875=true;Rr.operationaltwin=w;if($('#view-operationaltwin.active'))setTimeout(ensureTab,260)}
hook();
window.AIP_3D875={render:render,activate:activate,viewer:function(){return VIEWER}};
})();

/* AIP v875 · Control Room — dark full-screen operations wall (the one deliberate dark view).
   Replays the operating day from the active data source through the PV, inverter and BESS engines. Advisory only. */
(function(){
'use strict';
var E=window.AIPTwinPhysics;if(!E)return;
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var n=function(v,d){if(v===null||v===undefined||v==='')return d===undefined?NaN:d;var x=Number(v);return Number.isFinite(x)?x:(d===undefined?NaN:d)};
var esc=function(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var fx=function(v,d){return Number.isFinite(v)?v.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—'};
var T=12*60,PLAY=null,SPEED=1,DATA=null,DAY=null;
function synth(){return window.AIP_SYNTHETIC_ACTIVE===true||/synthetic/i.test(String(window.APM_DATA_MODE||''))}
function R(k){if(window.AIP891?.isUploaded())return window.AIP891.raw(k);var st=[];try{if(typeof APM_IMPORTED_DATA!=='undefined')st.push(APM_IMPORTED_DATA)}catch(_){}
  try{st.push(synth()?(typeof AIP_INDEPENDENT_SYNTHETIC_DATA!=='undefined'?AIP_INDEPENDENT_SYNTHETIC_DATA:null):(typeof EMBEDDED_EXCEL_DATA!=='undefined'?EMBEDDED_EXCEL_DATA:null))}catch(_){}
  st.push(synth()?window.AIP_INDEPENDENT_SYNTHETIC_DATA:window.EMBEDDED_EXCEL_DATA);
  for(var i=0;i<st.length;i++){var a=st[i]&&st[i][k];if(Array.isArray(a)&&a.length)return a}return []}
function load(day){
  var ids=R('Twin Engineering Parameters').map(function(p){return String(p.Plant_ID)}),sites=[],events=[],losses=[];
  ids.forEach(function(id){
    var M=window.AIP_TWIN872&&(window.AIP_TWIN872.modelDay?window.AIP_TWIN872.modelDay(id,day):window.AIP_TWIN872.model(id)),I=window.AIP_INV874&&window.AIP_INV874.model(id),B=window.AIP_BESS873&&window.AIP_BESS873.model(id);
    if(!M||M.error)return;if(I&&I.date&&I.date!==M.date)I=null;if(B&&B.date&&B.date!==M.date)B=null;
    var s={id:id,name:String(M.params.Plant_Name||id),M:M,I:I&&!I.error?I:null,B:B&&!B.error?B:null};sites.push(s);
    if(s.I){
      s.I.A.inverters.forEach(function(o){if(o.flag!=='ok')losses.push({site:s,o:o})});
      var by={};s.I.it.forEach(function(r){(by[r.Asset_ID]=by[r.Asset_ID]||[]).push(r)});
      Object.keys(by).forEach(function(a){var rows=by[a].sort(function(x,y){return String(x.Timestamp).localeCompare(String(y.Timestamp))}),prev='Running';
        rows.forEach(function(r){var st=String(r.Status||''),t=E.parseStamp(r.Timestamp);var bad=/trip|derat|no data/i.test(st),was=/trip|derat|no data/i.test(prev);
          if(bad&&!was)events.push({m:t.minute,site:s,sev:/trip/i.test(st)?'crit':/derat/i.test(st)?'warn':'info',text:String(r.Inverter_Tag)+' '+(/trip/i.test(st)?'tripped':/derat/i.test(st)?'derating':'telemetry lost')+(r.Alarm_Code&&!/COMMS/.test(r.Alarm_Code)?' · '+r.Alarm_Code:'')});
          if(!bad&&was)events.push({m:t.minute,site:s,sev:'ok',text:String(r.Inverter_Tag)+' back to normal'});prev=st;});});
    }
    if(s.B){var P=s.B.P,lastT=false,lastA=false,lastS=false;s.B.D.intervals.forEach(function(q){
      var hot=q.tmax>=P.tAlarm,av=q.avail<P.mw,so=q.soc>P.socMax+0.5||q.soc<P.socMin-0.5;
      if(hot&&!lastT)events.push({m:q.t.minute,site:s,sev:'warn',text:'BESS cell temperature '+fx(q.tmax,1)+' °C (alarm '+fx(P.tAlarm,0)+' °C)'});
      if(av&&!lastA)events.push({m:q.t.minute,site:s,sev:'warn',text:'BESS available '+fx(q.avail,1)+' of '+fx(P.mw,0)+' MW'});
      if(so&&!lastS)events.push({m:q.t.minute,site:s,sev:'info',text:'BESS SoC '+fx(q.soc,1)+'% outside '+fx(P.socMin,0)+'–'+fx(P.socMax,0)+'% window'});
      lastT=hot;lastA=av;lastS=so;});}
  });
  losses.sort(function(a,b){return (b.o.value||b.o.lost)-(a.o.value||a.o.lost)});events.sort(function(a,b){return a.m-b.m});
  var hasI=sites.some(function(x){return x.I}),hasB=sites.some(function(x){return x.B});
  return {sites:sites,events:events,losses:losses,date:sites[0]?sites[0].M.date:'',dates:sites[0]?sites[0].M.dates||[]:[],latest:sites[0]?sites[0].M.latest:'',hasI:hasI,hasB:hasB};
}
function at(list,m,key){var b=null;list.forEach(function(x){var mm=key(x);if(mm<=m+0.1&&(!b||mm>key(b)))b=x});return b}
function snapshot(){
  var m=T,P={mw:0,exp:0,cap:0,e:0,s1:0,avN:0,av:0,bmw:0,soc:[],find:0,lostV:0},tiles=[];
  DATA.sites.forEach(function(s){
    var iv=s.M.D.intervals,x=at(iv,m,function(q){return q.t.minute}),cap=s.M.P.acMW,dt=s.M.D.dt,e=0,s1=0;
    iv.forEach(function(q){if(q.t.minute<=m){e+=q.actual*dt;s1+=q.states.s1*dt}});
    var mw=x&&m-x.t.minute<=15?x.actual:0,exp=x&&m-x.t.minute<=15?x.expectedPOI:0,av=x?x.availability*100:NaN;
    var trips=0,derates=0,gaps=0;if(s.I){s.I.A.inverters.forEach(function(o){var q=at(o.iv,m,function(z){return z.t.minute});if(q&&m-q.t.minute<=15){if(/trip/i.test(q.st))trips++;else if(/derat/i.test(q.st))derates++;else if(!Number.isFinite(q.acM))gaps++}})}
    var find=s.I?s.I.A.inverters.filter(function(o){return o.flag!=='ok'}).length:0,lostV=s.I?s.I.A.inverters.reduce(function(a,o){return a+(o.flag!=='ok'&&Number.isFinite(o.value)?o.value:0)},0):0;
    var b=null;if(s.B){var qb=at(s.B.D.intervals,m,function(z){return z.t.minute});if(qb)b={soc:qb.soc,p:qb.pd-qb.pc,mode:qb.pd>0?'Discharging':qb.pc>0?'Charging':'Standby',hot:qb.tmax>=s.B.P.tAlarm};if(b){P.bmw+=b.p;P.soc.push(b.soc)}}
    P.mw+=mw;P.exp+=exp;P.cap+=cap;P.e+=e;P.s1+=s1;if(Number.isFinite(av)&&mw>0){P.av+=av;P.avN++}P.find+=find;P.lostV+=lostV;
    tiles.push({s:s,mw:mw,exp:exp,cap:cap,e:e,pr:s1>0?e/s1*100:NaN,av:av,trips:trips,derates:derates,gaps:gaps,find:find,b:b,state:trips?'crit':(derates||find)?'warn':'ok'});
  });
  return {P:P,tiles:tiles,events:DATA.events.filter(function(e){return e.m<=m}).slice(-16).reverse()};
}
function paint(){
  var root=$('#t875CR');if(!root||!DATA)return;var S=snapshot(),P=S.P,soc=P.soc.length?P.soc.reduce(function(a,b){return a+b},0)/P.soc.length:NaN;
  window.AIP891Control={S,T};$('#crClock',root).textContent=E.hhmm(T);$('#crSlider',root).value=T/60;
  var k=[['Portfolio output',fx(P.mw,1)+' MW','of '+fx(P.cap,0)+' MW AC · expected '+fx(P.exp,1)+' MW'],['Energy today',fx(P.e,0)+' MWh','to '+E.hhmm(T)],['Performance ratio',fx(P.s1>0?P.e/P.s1*100:NaN,1)+'%','portfolio, day to time'],['Availability',fx(P.avN?P.av/P.avN:NaN,2)+'%','generating sites'],['Battery',(P.bmw>=0?'+':'−')+fx(Math.abs(P.bmw),1)+' MW','average state of charge '+fx(soc,0)+'%'],['Inverter findings',fx(P.find,0),'lost value today ₹'+fx(P.lostV/1e5,2)+' lakh']];
  $('#crKpis',root).innerHTML=k.map(function(x){return '<div class="cr-kpi"><span>'+x[0]+'</span><b>'+x[1]+'</b><small>'+x[2]+'</small></div>'}).join('');
  $('#crSites',root).innerHTML=S.tiles.map(function(t){var pct=t.cap>0?Math.min(100,t.mw/t.cap*100):0;
    return '<button type="button" class="cr-site '+t.state+'" data-site="'+esc(t.s.id)+'"><div class="cr-sh"><b>'+esc(t.s.id)+'</b><span>'+esc(t.s.name)+'</span></div><div class="cr-mw"><b>'+fx(t.mw,1)+'</b><span>/ '+fx(t.cap,0)+' MW</span></div><div class="cr-bar"><i style="width:'+pct.toFixed(1)+'%"></i><em style="left:'+Math.min(100,t.exp/t.cap*100).toFixed(1)+'%"></em></div>'+
      '<div class="cr-meta"><span>PR '+fx(t.pr,1)+'%</span><span>Avail '+fx(t.av,1)+'%</span><span>'+fx(t.e,0)+' MWh</span></div>'+
      '<div class="cr-flags">'+(t.trips?'<i class="crit">'+t.trips+' tripped</i>':'')+(t.derates?'<i class="warn">'+t.derates+' derating</i>':'')+(t.gaps?'<i class="info">'+t.gaps+' no data</i>':'')+(t.find&&!t.trips&&!t.derates?'<i class="warn">'+t.find+' findings</i>':'')+(t.b?'<i class="bess'+(t.b.hot?' crit':'')+'">BESS '+t.b.mode.toLowerCase()+' · SoC '+fx(t.b.soc,0)+'%</i>':'')+(!t.trips&&!t.derates&&!t.gaps&&!t.find&&!t.b?'<i class="ok">Normal</i>':'')+'</div></button>'}).join('');
  $('#crFeed',root).innerHTML=S.events.length?S.events.map(function(e){return '<li class="'+e.sev+'"><time>'+E.hhmm(e.m)+'</time><b>'+esc(e.site.id)+'</b><span>'+esc(e.text)+'</span></li>'}).join(''):'<li class="ok"><span>No events up to '+E.hhmm(T)+'</span></li>';
  $('#crLoss',root).innerHTML=DATA.losses.slice(0,9).map(function(l){return '<li><b>'+esc(l.o.tag)+'</b><span>'+esc(window.AIP_INV874?window.AIP_INV874.causeLabel(l.o.primary):l.o.primary)+'</span><em>'+fx(l.o.lost,2)+' MWh · ₹'+fx((l.o.value||0)/1e5,2)+' L</em></li>'}).join('')||'<li><span>'+(DATA.hasI?'No inverter losses':'No inverter telemetry for this day')+'</span></li>';
}
function open(){
  if($('#t875CR'))return;
  var el=document.createElement('div');el.id='t875CR';el.setAttribute('role','dialog');el.setAttribute('aria-label','Control room');
  el.innerHTML='<div class="cr-top"><div class="cr-brand"><b>Control Room</b><span id="crSub"></span></div><div class="cr-time"><b id="crClock">--:--</b><span>replay of the operating day · advisory only, no plant control</span></div>'+
    '<div class="cr-ctl"><select id="crDay" title="Operating day"></select><button type="button" id="crPlay">Play</button><select id="crSpeed"><option value="1">1×</option><option value="4">4×</option><option value="12">12×</option></select><input type="range" id="crSlider" min="0" max="23.75" step="0.25"><button type="button" id="crClose" aria-label="Close control room">Exit ✕</button></div></div>'+
    '<div class="cr-kpis" id="crKpis"></div><div class="cr-main"><div class="cr-sites" id="crSites"></div><div class="cr-side"><section><h4>Event feed</h4><ul class="cr-feed" id="crFeed"></ul></section><section><h4>Top inverter losses today</h4><ul class="cr-loss" id="crLoss"></ul></section></div></div>';
  document.body.appendChild(el);document.documentElement.classList.add('t875-cr-open');
  try{DATA=load(DAY)}catch(e){console.error('[control room]',e);DATA={sites:[],events:[],losses:[],date:'',dates:[]}}
  var dd=function(d){var q=String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);return q?q[3]+'-'+q[2]+'-'+q[1].slice(2):d};
  var sub=function(){var m='';try{m=String(typeof APM_DATA_MODE!=='undefined'?APM_DATA_MODE:'')}catch(_){}
    $('#crSub',el).textContent='Operating day '+dd(DATA.date)+' · '+DATA.sites.length+' sites · '+(synth()?'Synthetic dataset':(m||'Excel dataset'))+(DATA.hasI||DATA.hasB?'':' · inverter and BESS telemetry exist for '+dd(DATA.latest)+' only');};
  sub();
  var ds=$('#crDay',el);ds.innerHTML=(DATA.dates||[]).slice().reverse().map(function(d){return '<option value="'+d+'">'+dd(d)+(d===DATA.latest?' · latest':'')+'</option>'}).join('');ds.value=DATA.date;
  ds.onchange=function(){DAY=ds.value===DATA.latest?null:ds.value;try{DATA=load(DAY)}catch(e){console.error('[control room]',e)}sub();paint()};
  var tt=$('#view-operationaltwin #tTime');T=Math.round(n(tt&&tt.value,12)*60/15)*15;
  $('#crClose',el).onclick=close;$('#crPlay',el).onclick=toggle;$('#crSpeed',el).onchange=function(e){SPEED=+e.target.value};
  $('#crSlider',el).oninput=function(e){T=Math.round(+e.target.value*60);paint()};
  el.addEventListener('click',function(e){var b=e.target.closest('[data-site]');if(!b)return;var s=$('#view-operationaltwin #tSite');close();if(s){s.value=b.dataset.site;window.AIP_TWIN_SITE=b.dataset.site;s.dispatchEvent(new Event('change',{bubbles:true}))}});
  document.addEventListener('keydown',esc0);paint();
}
function esc0(e){if(e.key==='Escape')close()}
function toggle(){var b=$('#crPlay');if(PLAY){clearInterval(PLAY);PLAY=null;if(b)b.textContent='Play';return}if(b)b.textContent='Pause';
  PLAY=setInterval(function(){T+=15;if(T>23*60+45){T=0}paint()},Math.max(60,700/SPEED))}
function close(){if(PLAY){clearInterval(PLAY);PLAY=null}var el=$('#t875CR');if(el)el.remove();document.documentElement.classList.remove('t875-cr-open');document.removeEventListener('keydown',esc0)}
function ensureTab(){var v=$('#view-operationaltwin'),t=v&&$('#tLayers',v);if(!t)return;var b=$('.t875-cr-tab',t);
  if(!b){b=document.createElement('button');b.type='button';b.className='xi-tab t875-cr-tab';b.textContent='Control Room';b.title='Full-screen dark operations wall for all sites';t.appendChild(b)}
  b.onclick=function(e){if(e){e.preventDefault();e.stopPropagation()}open()};}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('#view-operationaltwin #tLayers .t875-cr-tab');if(b){e.stopImmediatePropagation();e.preventDefault();open()}},true);
document.addEventListener('aip:data-source-changed',function(){close();setTimeout(ensureTab,500)});
function hook(){var Rr=window.AIP_V21&&window.AIP_V21.renderers;if(!Rr||typeof Rr.operationaltwin!=='function')return setTimeout(hook,100);var prior=Rr.operationaltwin;if(prior.__v875cr)return;
  var w=function(){var out=prior.apply(this,arguments);setTimeout(ensureTab,0);setTimeout(ensureTab,300);return out};w.__v875cr=true;Rr.operationaltwin=w;if($('#view-operationaltwin.active'))setTimeout(ensureTab,300)}
hook();
window.AIP_CR875={open:open,close:close};
window.AIP_CURRENT_BUILD='v875';
})();

