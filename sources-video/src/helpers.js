/* Outils partagés : maths, easing, trajets, voitures, anneau de transition, confettis */
(function () {
  'use strict';
  var V = window.V = { W: 1920, H: 1080, FPS: 30, DUR: 49, events: [], procs: [], builders: [] };
  var NS = 'http://www.w3.org/2000/svg';
  V.NS = NS;

  V.sfx = function (type, t, o) { V.events.push(Object.assign({ type: type, t: Math.round(t * 1000) / 1000 }, o || {})); };
  var clamp = V.clamp = function (x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, x)); };
  V.lerp = function (a, b, t) { return a + (b - a) * t; };
  V.seg = function (t, a, b) { return clamp((t - a) / (b - a)); };
  V.eo3 = function (x) { return 1 - Math.pow(1 - x, 3); };
  V.eio = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  V.eio2 = function (x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
  V.rng = function (seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  V.$ = function (s, p) { return (p || document).querySelector(s); };
  V.$$ = function (s, p) { return Array.prototype.slice.call((p || document).querySelectorAll(s)); };
  V.proc = function (fn) { V.procs.push(fn); };

  V.LOGO = '<svg width="60" height="60" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#5DA62E"/><rect x="12" y="0" width="8" height="32" fill="#8A8E94"/><path d="M16 2v28" stroke="#FFC83D" stroke-width="2" stroke-dasharray="4 3"/><rect x="3" y="5" width="7" height="8" rx="1.5" fill="#E04A3A"/><rect x="22" y="19" width="7" height="8" rx="1.5" fill="#2F72CC"/></svg>';

  V.shade = function (hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function f(c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  };

  /* ---------- voiture jouet vue du dessus (avant = côté droit) ---------- */
  V.carTopSVG = function (body) {
    var dk = V.shade(body, -.3), lt = V.shade(body, .28);
    return '<svg viewBox="0 0 100 50" width="100%" height="100%" style="overflow:visible">' +
      '<ellipse cx="52" cy="30" rx="48" ry="21" fill="rgba(0,0,0,.24)"/>' +
      '<rect x="12" y="0" width="17" height="8" rx="3.500" fill="#1D2430"/><rect x="12" y="42" width="17" height="8" rx="3.500" fill="#1D2430"/>' +
      '<rect x="68" y="0" width="17" height="8" rx="3.500" fill="#1D2430"/><rect x="68" y="42" width="17" height="8" rx="3.500" fill="#1D2430"/>' +
      '<rect x="3" y="5" width="94" height="40" rx="14" fill="' + body + '" stroke="' + dk + '" stroke-width="2.500"/>' +
      '<rect x="27" y="10" width="44" height="30" rx="9" fill="' + dk + '"/>' +
      '<rect x="33" y="13" width="31" height="24" rx="6" fill="' + lt + '"/>' +
      '<path d="M65 11L79 15V35L65 39Z" fill="#CFE9FF"/><path d="M34 11L23 14V36L34 39Z" fill="#CFE9FF" opacity=".85"/>' +
      '<circle cx="93.500" cy="12" r="3.600" fill="#FFE98A"/><circle cx="93.500" cy="38" r="3.600" fill="#FFE98A"/>' +
      '<rect x="3" y="9" width="3.500" height="9" rx="1.700" fill="#E04A3A"/><rect x="3" y="32" width="3.500" height="9" rx="1.700" fill="#E04A3A"/></svg>';
  };
  // crée une voiture : un conteneur « .ct » (positionné par le code) contenant le dessin (animé par GSAP)
  V.mkCarTop = function (host, color, sc) {
    var d = document.createElement('div');
    d.className = 'ct'; d.style.width = (100 * sc) + 'px'; d.style.height = (50 * sc) + 'px';
    d.innerHTML = V.carTopSVG(color);
    host.appendChild(d);
    return d;
  };

  /* ---------- trajets (points normalisés 0..1 → pixels du tapis), lissés ---------- */
  V.makePath = function (pts, W, H) {
    var P = pts.map(function (p) { return [p[0] * W, p[1] * H]; }), win = 6;
    var Q = P.map(function (_, i) {
      var sx = 0, sy = 0, n = 0;
      for (var k = -win; k <= win; k++) { var j = i + k; if (j < 0 || j >= P.length) continue; sx += P[j][0]; sy += P[j][1]; n++; }
      return [sx / n, sy / n];
    });
    var L = [0];
    for (var i = 1; i < Q.length; i++) L.push(L[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]));
    return { Q: Q, L: L, len: L[L.length - 1] };
  };
  function ptAt(p, s) {
    s = clamp(s, 0, p.len);
    var lo = 0, hi = p.L.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (p.L[m] <= s) lo = m; else hi = m; }
    var f = (s - p.L[lo]) / Math.max(1e-6, p.L[hi] - p.L[lo]);
    return [p.Q[lo][0] + (p.Q[hi][0] - p.Q[lo][0]) * f, p.Q[lo][1] + (p.Q[hi][1] - p.Q[lo][1]) * f];
  }
  V.pathAt = function (p, s) {
    var a = ptAt(p, s - 16), b = ptAt(p, s + 16), c = ptAt(p, s);
    return { x: c[0], y: c[1], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI };
  };

  /* ---------- anneau de rond-point (transitions) ---------- */
  V.mkRing = function (svg) {
    var g = document.createElementNS(NS, 'g'), r = {};
    [['a', '#8A8E94'], ['y1', '#FFC83D'], ['y2', '#FFC83D'], ['d', '#FFFFFF']].forEach(function (c) {
      var e = document.createElementNS(NS, 'circle'); e.setAttribute('fill', 'none'); e.setAttribute('stroke', c[1]);
      if (c[0] === 'd') e.setAttribute('stroke-dasharray', '38 30');
      g.appendChild(e); r[c[0]] = e;
    });
    svg.appendChild(g); r.g = g; return r;
  };
  V.drawRing = function (r, cx, cy, R, bw) {
    var set = function (e, rad, sw) { e.setAttribute('cx', cx); e.setAttribute('cy', cy); e.setAttribute('r', Math.max(0, rad)); e.setAttribute('stroke-width', sw); };
    set(r.a, R, bw); set(r.y1, R - bw / 2 + 4, 8); set(r.y2, R + bw / 2 - 4, 8); set(r.d, R, 7);
  };

  /* ---------- confettis (physique déterministe) ---------- */
  V.makeConfetti = function (host, n, seed) {
    var rnd = V.rng(seed), cols = ['#FFC83D', '#E04A3A', '#2F72CC', '#5DA62E', '#E85C93', '#FFFFFF', '#16202E'], arr = [];
    for (var i = 0; i < n; i++) {
      var e = document.createElement('i'); e.className = 'conf'; e.style.background = cols[i % cols.length];
      host.appendChild(e);
      var a = -Math.PI / 2 + (rnd() - .5) * 2.3, sp = 520 + rnd() * 760;
      arr.push({ e: e, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rnd() * 360, vr: (rnd() - .5) * 900, w: .7 + rnd() * .7 });
    }
    return arr;
  };
  V.stepConfetti = function (arr, ox, oy, s, life) {
    life = life || 2.6;
    arr.forEach(function (p) {
      if (s < 0 || s > life) { p.e.style.opacity = 0; return; }
      var x = ox + p.vx * s * (1 - .25 * s / 2.6), y = oy + p.vy * s + 0.5 * 1500 * s * s;
      p.e.style.opacity = s > life - .4 ? Math.max(0, (life - s) / .4) : 1;
      p.e.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (p.rot + p.vr * s).toFixed(1) + 'deg) scale(' + p.w.toFixed(2) + ')';
    });
  };
})();
