/* ============================================================
   matgen.js — Moteur de génération du tapis de jeu
   Transforme une capture de plan (Google Maps) en tapis illustré :
   routes grises à lignes jaunes, pelouses, maisons à toits colorés,
   arbres, terrains de foot, parkings, étangs...
   (Simulation locale : tout se passe dans le navigateur.)
   ============================================================ */
(function (root) {
  'use strict';

  var AW = 750, AH = 500;          // résolution d'analyse
  var S = 2;                       // facteur vers le rendu final
  var FW = AW * S, FH = AH * S;    // 1500 x 1000

  /* ---------- utilitaires ---------- */
  function rngFrom(seed) {
    var a = (seed | 0) + 0x9E3779B9;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function tick() {
    return new Promise(function (res) {
      var d = false;
      function f() { if (!d) { d = true; res(); } }
      if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(f); setTimeout(f, 50); }
      else setTimeout(f, 0);
    });
  }
  function defaultCanvas(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function inv(m) { var o = new Uint8Array(m.length); for (var i = 0; i < m.length; i++) o[i] = m[i] ? 0 : 1; return o; }

  /* distance (en px) au pixel "feature" le plus proche — chanfrein 3-4 */
  function dt(feat, w, h) {
    var INF = 1e8, d = new Int32Array(w * h), i, x, y, v;
    for (i = 0; i < d.length; i++) d[i] = feat[i] ? 0 : INF;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; v = d[i]; if (!v) continue;
      if (x > 0 && d[i - 1] + 3 < v) v = d[i - 1] + 3;
      if (y > 0) {
        if (d[i - w] + 3 < v) v = d[i - w] + 3;
        if (x > 0 && d[i - w - 1] + 4 < v) v = d[i - w - 1] + 4;
        if (x < w - 1 && d[i - w + 1] + 4 < v) v = d[i - w + 1] + 4;
      }
      d[i] = v;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) {
      i = y * w + x; v = d[i]; if (!v) continue;
      if (x < w - 1 && d[i + 1] + 3 < v) v = d[i + 1] + 3;
      if (y < h - 1) {
        if (d[i + w] + 3 < v) v = d[i + w] + 3;
        if (x < w - 1 && d[i + w + 1] + 4 < v) v = d[i + w + 1] + 4;
        if (x > 0 && d[i + w - 1] + 4 < v) v = d[i + w - 1] + 4;
      }
      d[i] = v;
    }
    var out = new Float32Array(w * h);
    for (i = 0; i < out.length; i++) out[i] = d[i] >= INF ? 999 : d[i] / 3;
    return out;
  }

  function integral(mask, w, h) {
    var W1 = w + 1, I = new Int32Array(W1 * (h + 1));
    for (var y = 0; y < h; y++) {
      var row = 0;
      for (var x = 0; x < w; x++) { row += mask[y * w + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; }
    }
    return I;
  }
  function rectSum(I, w, x0, y0, x1, y1) {
    var W1 = w + 1;
    return I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
  }

  function lattice(w, h, cell, rng) {
    var gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = new Float32Array(gw * gh), i;
    for (i = 0; i < g.length; i++) g[i] = rng();
    var out = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      var fy = y / cell, y0 = fy | 0, ty = fy - y0; ty = ty * ty * (3 - 2 * ty);
      for (var x = 0; x < w; x++) {
        var fx = x / cell, x0 = fx | 0, tx = fx - x0; tx = tx * tx * (3 - 2 * tx);
        var a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
        var top = a + (b - a) * tx, bot = c + (d - c) * tx;
        out[y * w + x] = top + (bot - top) * ty;
      }
    }
    return out;
  }

  /* ---------- 1. reconnaissance des couleurs de la carte ---------- */
  // 0 fond, 1 route, 3 bâtiment, 4 parc, 5 eau
  var CLS_ID = { land: 0, road: 1, building: 3, park: 4, water: 5 };

  // Couleur du fond = le pic le plus clair de l'histogramme des gris (hors blanc pur des routes).
  // Les pixels de bord (dégradés entre deux couleurs) sont répartis sur tous les niveaux : ils ne forment pas de pic.
  function estimateLand(data, n) {
    var hist = new Float64Array(256), sm = new Float64Array(256), i, l, r, g, b, mn, mx, maxc = 0;
    for (i = 0; i < n; i++) {
      r = data[i * 4]; g = data[i * 4 + 1]; b = data[i * 4 + 2];
      mn = Math.min(r, g, b); mx = Math.max(r, g, b);
      if (mn >= 251 || mx - mn > 24) continue;
      hist[((r + g + b) / 3) | 0]++;
    }
    for (l = 0; l < 256; l++) {
      sm[l] = (hist[Math.max(0, l - 1)] + hist[l] * 2 + hist[Math.min(255, l + 1)]) / 4;
      if (sm[l] > maxc) maxc = sm[l];
    }
    if (maxc < 1) return [245, 245, 245];
    var floor = Math.max(maxc * 0.1, n * 0.008), best = -1, d, q, isPeak;
    for (l = 255; l >= 0 && best < 0; l--) {
      if (sm[l] < floor) continue;
      isPeak = true;
      for (d = -2; d <= 2; d++) { q = l + d; if (q >= 0 && q < 256 && sm[q] > sm[l]) { isPeak = false; break; } }
      if (isPeak) best = l;
    }
    if (best < 0) for (l = 0; l < 256; l++) if (sm[l] === maxc) { best = l; break; }
    var tr = 0, tg = 0, tb = 0, tn = 0;
    for (i = 0; i < n; i++) {
      r = data[i * 4]; g = data[i * 4 + 1]; b = data[i * 4 + 2];
      mn = Math.min(r, g, b); mx = Math.max(r, g, b);
      if (mn >= 251 || mx - mn > 24) continue;
      l = ((r + g + b) / 3) | 0;
      if (Math.abs(l - best) <= 2) { tr += r; tg += g; tb += b; tn++; }
    }
    return tn ? [tr / tn, tg / tn, tb / tn] : [best, best, best];
  }
  function pdist(r, g, b, c) { var dr = r - c[0], dg = g - c[1], db = b - c[2]; return Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9); }
  function avgColor(list) {
    var r = 0, g = 0, b = 0;
    list.forEach(function (c) { r += c[0]; g += c[1]; b += c[2]; });
    return [r / list.length, g / list.length, b / list.length];
  }

  // palette (facultative) : { road:[[r,g,b],...], park:[...], water:[...], building:[...], land:[...] }
  // couleurs relevées à la main avec la pipette : elles s'ajoutent à la détection automatique
  // et l'emportent sur elle pour les pixels de teinte voisine (écart < 28).
  function classify(data, n, palette) {
    palette = palette || {};
    var land = (palette.land && palette.land.length) ? avgColor(palette.land) : estimateLand(data, n);
    var Lr = land[0], Lg = land[1], Lb = land[2];
    var Ll = (Lr + Lg + Lb) / 3, Lch = Math.max(Lr, Lg, Lb) - Math.min(Lr, Lg, Lb);
    var Lbr = Lb - Lr, Lgr = Lg - Lr, Lgb = Lg - Lb;
    var samples = [], key;
    for (key in palette) if (CLS_ID[key] != null && palette[key] && palette[key].length) {
      palette[key].forEach(function (c) { samples.push({ id: CLS_ID[key], c: c }); });
    }
    // Rayon d'influence de chaque pipette : au plus 28, mais jamais plus de 45 % de l'écart
    // avec la couleur d'une autre classe (ou du fond), pour ne pas avaler des teintes voisines.
    var refs = samples.slice();
    if (!(palette.land && palette.land.length)) refs.push({ id: 0, c: land });
    samples.forEach(function (sm) {
      var dm = 60;
      refs.forEach(function (t) { if (t.id !== sm.id) { var dd = pdist(sm.c[0], sm.c[1], sm.c[2], t.c); if (dd < dm) dm = dd; } });
      sm.rad = Math.max(6, Math.min(28, dm * 0.45));
    });
    var cls = new Uint8Array(n), i, r, g, b, mn, mx, lum, ch, c, j, bd, bid, d;
    for (i = 0; i < n; i++) {
      r = data[i * 4]; g = data[i * 4 + 1]; b = data[i * 4 + 2];
      mn = Math.min(r, g, b); mx = Math.max(r, g, b); lum = (r + g + b) / 3; ch = mx - mn; c = 0;
      if (r - b > 38 && r > 200 && (r - b) > (Lr - Lb) + 30) c = 1;                                 // route principale (jaune, orange)
      else if (mn >= 252 || (lum > Ll + 4 && ch <= Lch + 10)) c = 1;                                  // route claire
      else if ((b - r) - Lbr > 22 && b >= g - 6 && b > 140 && lum < 246) c = 5;                       // eau
      else if ((g - r) - Lgr > 8 && (g - b) - Lgb > 4 && g > 140) c = 4;                              // parc
      else if (lum < Ll - 6 && ch <= Lch + 14) c = 3;                                                 // bâtiment
      if (samples.length) {
        bd = 1e9; bid = -1;
        for (j = 0; j < samples.length; j++) { d = pdist(r, g, b, samples[j].c); if (d < samples[j].rad && d < bd) { bd = d; bid = samples[j].id; } }
        if (bid >= 0) c = bid;
      }
      cls[i] = c;
    }
    return cls;
  }

  // Une « rivière » très fine et très longue est en réalité un réseau de routes mal reconnu.
  function fixThinWater(cls, w, h) {
    var n = w * h, wm = new Uint8Array(n), i;
    for (i = 0; i < n; i++) wm[i] = cls[i] === 5 ? 1 : 0;
    var din = dt(inv(wm), w, h), seen = new Uint8Array(n), stack = new Int32Array(n);
    for (i = 0; i < n; i++) {
      if (!wm[i] || seen[i]) continue;
      var sp = 0, list = [], maxD = 0;
      stack[sp++] = i; seen[i] = 1;
      while (sp) {
        var p = stack[--sp]; list.push(p); if (din[p] > maxD) maxD = din[p];
        var x = p % w, y = (p / w) | 0, q;
        if (x > 0 && wm[q = p - 1] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
        if (x < w - 1 && wm[q = p + 1] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
        if (y > 0 && wm[q = p - w] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
        if (y < h - 1 && wm[q = p + w] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
      }
      if (maxD < 6 && list.length > 8 * Math.PI * maxD * maxD + 40) for (var k = 0; k < list.length; k++) cls[list[k]] = 1;
    }
    return cls;
  }

  // Supprime les petites taches isolées (pastilles d'icônes, halos blancs autour des libellés, flèches) :
  // elles prennent la classe dominante de leur voisinage. Les routes qui ne font pas partie du réseau
  // principal (moins de 3 % du plus grand réseau) sont traitées de la même façon.
  function despeckle(cls, w, h) {
    var n = w * h, seen = new Uint8Array(n), stack = new Int32Array(n), comps = [], maxRoad = 0;
    for (var i = 0; i < n; i++) {
      var k = cls[i];
      if (!k || seen[i]) continue;
      var sp = 0, list = [], nbc = [0, 0, 0, 0, 0, 0];
      stack[sp++] = i; seen[i] = 1;
      while (sp) {
        var p = stack[--sp]; list.push(p);
        var x = p % w, y = (p / w) | 0, q;
        if (x > 0) { q = p - 1; if (cls[q] === k) { if (!seen[q]) { seen[q] = 1; stack[sp++] = q; } } else nbc[cls[q]]++; }
        if (x < w - 1) { q = p + 1; if (cls[q] === k) { if (!seen[q]) { seen[q] = 1; stack[sp++] = q; } } else nbc[cls[q]]++; }
        if (y > 0) { q = p - w; if (cls[q] === k) { if (!seen[q]) { seen[q] = 1; stack[sp++] = q; } } else nbc[cls[q]]++; }
        if (y < h - 1) { q = p + w; if (cls[q] === k) { if (!seen[q]) { seen[q] = 1; stack[sp++] = q; } } else nbc[cls[q]]++; }
      }
      comps.push({ k: k, list: list, nbc: nbc });
      if (k === 1 && list.length > maxRoad) maxRoad = list.length;
    }
    var lim = { 1: Math.max(140, maxRoad * 0.03), 3: 30, 4: 120, 5: 220 };
    comps.forEach(function (cmp) {
      if (cmp.list.length >= lim[cmp.k]) return;
      var best = 0, bc = -1;
      for (var c = 0; c < 6; c++) if (cmp.nbc[c] > bc) { bc = cmp.nbc[c]; best = c; }
      for (var j = 0; j < cmp.list.length; j++) cls[cmp.list[j]] = best;
    });
    return cls;
  }

  function modeFilter(cls, w, h, rad) {
    var out = new Uint8Array(w * h), cnt = new Float32Array(6);
    var wt = [1, 1.7, 1.7, 1, 1, 1];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      cnt[0] = cnt[1] = cnt[2] = cnt[3] = cnt[4] = cnt[5] = 0;
      var y0 = Math.max(0, y - rad), y1 = Math.min(h - 1, y + rad), x0 = Math.max(0, x - rad), x1 = Math.min(w - 1, x + rad);
      for (var yy = y0; yy <= y1; yy++) { var row = yy * w; for (var xx = x0; xx <= x1; xx++) cnt[cls[row + xx]]++; }
      var bi = cls[y * w + x], bc = cnt[bi] * wt[bi];
      for (var q = 0; q < 6; q++) if (cnt[q] * wt[q] > bc) { bc = cnt[q] * wt[q]; bi = q; }
      out[y * w + x] = bi;
    }
    return out;
  }

  /* ---------- 2. squelette des routes (Zhang-Suen) ---------- */
  async function thin(img, w, h) {
    var buf = new Int32Array(w * h), changed = true, iter = 0;
    while (changed) {
      changed = false;
      for (var step = 0; step < 2; step++) {
        var cnt = 0;
        for (var y = 1; y < h - 1; y++) {
          var row = y * w;
          for (var x = 1; x < w - 1; x++) {
            var i = row + x; if (!img[i]) continue;
            var p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1],
              p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
            var B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            if (B < 2 || B > 6) continue;
            var A = (p2 === 0 && p3 === 1) + (p3 === 0 && p4 === 1) + (p4 === 0 && p5 === 1) + (p5 === 0 && p6 === 1) +
              (p6 === 0 && p7 === 1) + (p7 === 0 && p8 === 1) + (p8 === 0 && p9 === 1) + (p9 === 0 && p2 === 1);
            if (A !== 1) continue;
            if (step === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
            else { if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue; }
            buf[cnt++] = i;
          }
        }
        for (var k = 0; k < cnt; k++) img[buf[k]] = 0;
        if (cnt) changed = true;
      }
      if ((++iter) % 4 === 0) await tick();
    }
  }

  function crossing(img, i, w) {
    var p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1],
      p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
    return (p2 === 0 && p3 === 1) + (p3 === 0 && p4 === 1) + (p4 === 0 && p5 === 1) + (p5 === 0 && p6 === 1) +
      (p6 === 0 && p7 === 1) + (p7 === 0 && p8 === 1) + (p8 === 0 && p9 === 1) + (p9 === 0 && p2 === 1);
  }

  /* promenade le long des routes (pour les petites voitures en 3D) */
  function walkPaths(skel, w, h, rng, count) {
    var idx = [], i;
    for (i = 0; i < skel.length; i++) if (skel[i]) idx.push(i);
    if (idx.length < 60) return [];
    var nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], paths = [];
    for (var c = 0; c < count; c++) {
      var bestPath = null;
      for (var attempt = 0; attempt < 5; attempt++) {
        var cur = idx[(rng() * idx.length) | 0], vis = new Int32Array(w * h).fill(-1e6), dx = 0, dy = 0, path = [cur];
        for (var step = 0; step < 1400; step++) {
          vis[cur] = step;
          var cx = cur % w, cy = (cur / w) | 0, bi = -1, bs = -9, bdx = 0, bdy = 0;
          for (var k = 0; k < 8; k++) {
            var ox = nb[k][0], oy = nb[k][1], nx = cx + ox, ny = cy + oy;
            if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
            var ni = ny * w + nx;
            if (!skel[ni] || step - vis[ni] < 45) continue;
            var len = Math.sqrt(ox * ox + oy * oy);
            var sc = step === 0 ? rng() : (dx * ox + dy * oy) / len + rng() * 0.05;
            if (sc > bs) { bs = sc; bi = ni; bdx = ox / len; bdy = oy / len; }
          }
          if (bi < 0) break;
          dx = dx * 0.6 + bdx * 0.4; dy = dy * 0.6 + bdy * 0.4;
          var dl = Math.sqrt(dx * dx + dy * dy) || 1; dx /= dl; dy /= dl;
          cur = bi; path.push(cur);
        }
        if (!bestPath || path.length > bestPath.length) bestPath = path;
        if (path.length > 700) break;
      }
      if (bestPath && bestPath.length > 120) {
        var pts = [];
        for (i = 0; i < bestPath.length; i += 4) pts.push([+((bestPath[i] % w) / w).toFixed(4), +(((bestPath[i] / w) | 0) / h).toFixed(4)]);
        paths.push(pts);
      }
    }
    return paths;
  }

  /* ---------- 3. dessins "style tapis enfant" ---------- */
  var ROOFS = [
    ['#EE5646', '#D13A2D', '#A32A20'], ['#4E96EC', '#2F72CC', '#235799'],
    ['#FAAA3E', '#EA8718', '#BB6609'], ['#F7D24C', '#E0B422', '#B38D10'], ['#E85C93', '#CC3F74', '#A22E58']
  ];
  var WALLS = ['#F7E8B6', '#F9DC94', '#ECD7AA', '#FFF5D8'];
  var INK = '#2A1D12';

  function drawTree(c, t) {
    var x = t.x * S, y = t.y * S, r = t.r * S, i;
    c.fillStyle = 'rgba(10,50,5,.26)'; c.beginPath(); c.ellipse(x + r * .28, y + r * .4, r, r * .78, 0, 0, 6.283); c.fill();
    var o = [[0, 0, 1], [.62, 0, .62], [-.62, 0, .62], [0, .6, .62], [0, -.6, .62], [.44, .44, .55], [-.44, -.44, .55], [.44, -.44, .55], [-.44, .44, .55]];
    c.strokeStyle = '#18560F'; c.lineWidth = Math.max(2, r * .15); c.lineJoin = 'round';
    for (i = 0; i < o.length; i++) { c.beginPath(); c.arc(x + o[i][0] * r * .6, y + o[i][1] * r * .6, o[i][2] * r * .62, 0, 6.283); c.stroke(); }
    c.fillStyle = '#2F8A22';
    for (i = 0; i < o.length; i++) { c.beginPath(); c.arc(x + o[i][0] * r * .6, y + o[i][1] * r * .6, o[i][2] * r * .62, 0, 6.283); c.fill(); }
    c.fillStyle = '#48A92D'; c.beginPath(); c.arc(x - r * .18, y - r * .2, r * .5, 0, 6.283); c.fill();
    c.fillStyle = '#76CF48'; c.beginPath(); c.arc(x - r * .3, y - r * .33, r * .2, 0, 6.283); c.fill();
  }

  function drawHouse(c, h) {
    var x = h.x * S, y = h.y * S, w = h.w * S, hh = h.h * S, lw = Math.max(2, w * .032);
    var pal = ROOFS[h.roof], wall = WALLS[h.wall];
    c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = lw; c.strokeStyle = INK;
    c.fillStyle = 'rgba(10,50,5,.27)'; c.fillRect(x + w * .1, y + hh * .16, w * 1.02, hh * .98);
    // murs
    c.fillStyle = wall; c.beginPath(); c.rect(x + w * .07, y + hh * .5, w * .86, hh * .5); c.fill(); c.stroke();
    // porte et fenêtres
    c.fillStyle = '#8A5A2B'; c.fillRect(x + w * .44, y + hh * .72, w * .13, hh * .28);
    c.lineWidth = lw * .6; c.strokeRect(x + w * .44, y + hh * .72, w * .13, hh * .28);
    c.fillStyle = '#BFE3F7';
    c.fillRect(x + w * .16, y + hh * .72, w * .17, hh * .14); c.strokeRect(x + w * .16, y + hh * .72, w * .17, hh * .14);
    c.fillRect(x + w * .68, y + hh * .72, w * .17, hh * .14); c.strokeRect(x + w * .68, y + hh * .72, w * .17, hh * .14);
    c.lineWidth = lw;
    // toit
    var rh = hh * .62;
    if (h.kind === 0) {
      c.fillStyle = pal[0]; c.fillRect(x, y, w, rh / 2);
      c.fillStyle = pal[1]; c.fillRect(x, y + rh / 2, w, rh / 2);
      c.strokeRect(x, y, w, rh);
      c.beginPath(); c.moveTo(x, y + rh / 2); c.lineTo(x + w, y + rh / 2); c.stroke();
      c.strokeStyle = pal[2]; c.lineWidth = lw * .55;
      for (var k = 1; k <= 2; k++) { var yy = y + rh / 2 + k * rh / 6; c.beginPath(); c.moveTo(x + lw, yy); c.lineTo(x + w - lw, yy); c.stroke(); }
      c.strokeStyle = INK; c.lineWidth = lw;
    } else {
      var rx0 = x + w * .3, rx1 = x + w * .7, ry = y + rh / 2;
      poly(c, [[x, y], [x + w, y], [rx1, ry], [rx0, ry]], pal[0]);
      poly(c, [[x, y + rh], [x + w, y + rh], [rx1, ry], [rx0, ry]], pal[1]);
      poly(c, [[x, y], [rx0, ry], [x, y + rh]], pal[2]);
      poly(c, [[x + w, y], [rx1, ry], [x + w, y + rh]], pal[2]);
    }
    // cheminée
    c.fillStyle = '#9A4E3C'; c.fillRect(x + w * .7, y - hh * .06, w * .12, hh * .2); c.lineWidth = lw * .7; c.strokeRect(x + w * .7, y - hh * .06, w * .12, hh * .2);
  }
  function poly(c, pts, fill) {
    c.fillStyle = fill; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath(); c.fill(); c.stroke();
  }

  function drawPitch(c, p) {
    var x = p.x * S, y = p.y * S, w = p.w * S, h = p.h * S, i;
    c.fillStyle = '#9EA2A8'; c.fillRect(x - 8, y - 8, w + 16, h + 16);
    c.strokeStyle = '#6A6E74'; c.lineWidth = 3; c.strokeRect(x - 8, y - 8, w + 16, h + 16);
    for (i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#4C9A28' : '#5BAA33'; c.fillRect(x + i * w / 8, y, w / 8 + 1, h); }
    c.strokeStyle = '#FFFFFF'; c.lineWidth = Math.max(2, w * .012);
    var m = w * .035; c.strokeRect(x + m, y + m, w - 2 * m, h - 2 * m);
    c.beginPath(); c.moveTo(x + w / 2, y + m); c.lineTo(x + w / 2, y + h - m); c.stroke();
    c.beginPath(); c.arc(x + w / 2, y + h / 2, h * .15, 0, 6.283); c.stroke();
    c.strokeRect(x + m, y + h * .26, w * .14, h * .48); c.strokeRect(x + w - m - w * .14, y + h * .26, w * .14, h * .48);
  }

  function drawParking(c, p, rng) {
    var x = p.x * S, y = p.y * S, w = p.w * S, h = p.h * S;
    c.fillStyle = '#9C9FA4'; c.fillRect(x, y, w, h);
    c.strokeStyle = '#6A6E74'; c.lineWidth = 3; c.strokeRect(x, y, w, h);
    var n = Math.max(3, Math.floor(w / (h * .3))), bw = w / n, bh = h * .38, i;
    c.strokeStyle = '#FFFFFF'; c.lineWidth = Math.max(2, h * .035);
    for (i = 0; i <= n; i++) {
      c.beginPath(); c.moveTo(x + i * bw, y); c.lineTo(x + i * bw, y + bh); c.stroke();
      c.beginPath(); c.moveTo(x + i * bw, y + h); c.lineTo(x + i * bw, y + h - bh); c.stroke();
    }
    var sq = Math.min(bw * .8, bh * .85);
    for (i = 0; i < n; i++) if (rng() < .45) {
      var top = rng() < .5, sx = x + i * bw + (bw - sq) / 2, sy = top ? y + (bh - sq) / 2 : y + h - bh + (bh - sq) / 2;
      c.fillStyle = '#2F6FD0'; c.fillRect(sx, sy, sq, sq);
      c.fillStyle = '#FFFFFF'; c.font = 'bold ' + Math.round(sq * .75) + 'px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('P', sx + sq / 2, sy + sq / 2 + 1);
    }
  }

  function drawTennis(c, p) {
    var x = p.x * S, y = p.y * S, w = p.w * S, h = p.h * S;
    c.fillStyle = '#9EA2A8'; c.fillRect(x - 6, y - 6, w + 12, h + 12);
    c.fillStyle = '#D8693E'; c.fillRect(x, y, w, h);
    c.strokeStyle = '#FFFFFF'; c.lineWidth = Math.max(2, w * .03);
    var m = w * .1; c.strokeRect(x + m, y + m, w - 2 * m, h - 2 * m);
    c.beginPath(); c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); c.stroke();
  }

  function drawTrack(c, p) {
    var cx = (p.x + p.w / 2) * S, cy = (p.y + p.h / 2) * S, a = p.w * S * .4, b = p.h * S * .34, t, pass;
    function path() {
      c.beginPath();
      for (t = 0; t <= 6.2832; t += .05) {
        var px = cx + a * Math.cos(t) + a * .16 * Math.cos(3 * t), py = cy + b * Math.sin(t) + b * .3 * Math.sin(2 * t);
        if (t === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
    }
    c.lineJoin = 'round';
    var ws = [b * .62, b * .5, b * .34], cs = ['#7A5A2C', '#C99A4B', '#E0BC72'];
    for (pass = 0; pass < 3; pass++) { c.strokeStyle = cs[pass]; c.lineWidth = ws[pass]; path(); c.stroke(); }
    c.strokeStyle = '#B3843A'; c.lineWidth = 3; c.setLineDash([10, 12]); path(); c.stroke(); c.setLineDash([]);
  }

  function drawCross(c, k) {
    c.save(); c.translate(k.x * S, k.y * S);
    if (k.vertical) c.rotate(Math.PI / 2);
    c.fillStyle = 'rgba(244,244,240,.96)';
    var depth = 13 * S, th = 3.4 * S, gap = 3.2 * S;
    for (var yy = -k.hw; yy < k.hw - th * .5; yy += th + gap) c.fillRect(-depth / 2, yy * S, depth, th);
    c.restore();
  }

  /* ---------- génération ---------- */
  async function generate(src, opts) {
    opts = opts || {};
    var mk = opts.createCanvas || defaultCanvas;
    var prog = opts.onProgress || function () {};
    var rng = rngFrom((opts.seed || 1) * 1013 + 7);
    var hMul = opts.houses == null ? 1 : opts.houses;
    var tMul = opts.trees == null ? 1 : opts.trees;
    var n = AW * AH, i, x, y;

    prog(0.04, 'Lecture de la carte'); await tick();
    var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    var ac = mk(AW, AH), ax = ac.getContext('2d');
    var sc = Math.max(AW / sw, AH / sh), dw = sw * sc, dh = sh * sc;
    ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high';
    ax.fillStyle = '#f5f5f5'; ax.fillRect(0, 0, AW, AH);
    ax.drawImage(src, (AW - dw) / 2, (AH - dh) / 2, dw, dh);
    var data = ax.getImageData(0, 0, AW, AH).data;

    prog(0.12, 'Reconnaissance des routes, parcs et rivières'); await tick();
    var cls = fixThinWater(despeckle(modeFilter(classify(data, n, opts.palette), AW, AH, 2), AW, AH), AW, AH);
    var road = new Uint8Array(n), water = new Uint8Array(n), park = new Uint8Array(n), bld = new Uint8Array(n);
    var cntRoad = 0, cntWater = 0;
    for (i = 0; i < n; i++) {
      var c0 = cls[i];
      if (c0 === 1 || c0 === 2) { road[i] = 1; cntRoad++; cls[i] = 1; }
      else if (c0 === 5) { water[i] = 1; cntWater++; }
      else if (c0 === 4) park[i] = 1;
      else if (c0 === 3) bld[i] = 1;
    }
    await tick();

    // referme les petits trous (noms de rues, numéros...) dans les routes
    if (cntRoad > 400) {
      var dCl = dt(road, AW, AH), grown = new Uint8Array(n);
      for (i = 0; i < n; i++) grown[i] = dCl[i] <= 4 ? 1 : 0;
      var dCl2 = dt(inv(grown), AW, AH);
      for (i = 0; i < n; i++) if (dCl2[i] > 4 && !water[i]) { if (!road[i]) { road[i] = 1; cntRoad++; park[i] = 0; bld[i] = 0; cls[i] = 1; } }
    }
    // image « ce que le générateur a compris »
    var cc = mk(AW, AH), cx = cc.getContext('2d'), cid = cx.createImageData(AW, AH), cd = cid.data;
    var CC = { 0: [243, 239, 226], 1: [75, 85, 99], 3: [236, 168, 64], 4: [96, 184, 78], 5: [47, 141, 224] };
    for (i = 0; i < n; i++) {
      var cv = CC[road[i] ? 1 : water[i] ? 5 : park[i] ? 4 : bld[i] ? 3 : 0];
      cd[i * 4] = cv[0]; cd[i * 4 + 1] = cv[1]; cd[i * 4 + 2] = cv[2]; cd[i * 4 + 3] = 255;
    }
    cx.putImageData(cid, 0, 0);
    // élargit les routes pour qu'elles ressemblent à celles d'un tapis
    prog(0.22, 'Élargissement des routes'); await tick();
    var dIn0 = dt(inv(road), AW, AH);
    var hist = new Uint32Array(64);
    for (i = 0; i < n; i++) if (road[i]) hist[Math.min(63, Math.round(dIn0[i]))]++;
    var k = 0;
    if (cntRoad > 400) {
      var acc = 0, h85 = 0;
      for (i = 0; i < 64; i++) { acc += hist[i]; if (acc >= cntRoad * 0.85) { h85 = i; break; } }
      k = Math.max(0, Math.min(7, Math.round(13 - h85)));
    }
    var dRoad0 = dt(road, AW, AH), R = new Uint8Array(n), cntR = 0;
    for (i = 0; i < n; i++) if (dRoad0[i] <= k) { R[i] = 1; cntR++; }
    var dIn = dt(inv(R), AW, AH), dR = dt(R, AW, AH);
    var dWin = dt(inv(water), AW, AH), dWout = dt(water, AW, AH);
    await tick();

    // squelette : lignes centrales, carrefours, passages piétons
    prog(0.34, 'Tracé des lignes de route'); await tick();
    var skel = new Uint8Array(R);
    for (x = 0; x < AW; x++) { skel[x] = 0; skel[(AH - 1) * AW + x] = 0; }
    for (y = 0; y < AH; y++) { skel[y * AW] = 0; skel[y * AW + AW - 1] = 0; }
    await thin(skel, AW, AH);
    var paths = walkPaths(skel, AW, AH, rng, 3);

    var centers = [];
    for (y = 2; y < AH - 2; y++) for (x = 2; x < AW - 2; x++) {
      i = y * AW + x;
      if (skel[i] && crossing(skel, i, AW) >= 3) {
        var near = false;
        for (var q = 0; q < centers.length; q++) { var ddx = centers[q].x - x, ddy = centers[q].y - y; if (ddx * ddx + ddy * ddy < 196) { near = true; break; } }
        if (!near) centers.push({ x: x, y: y, r: dIn[i] });
      }
    }
    var dash = new Uint8Array(skel);
    centers.forEach(function (c) {
      var rr = Math.ceil(c.r * 1.3 + 7);
      for (var yy = Math.max(0, c.y - rr); yy <= Math.min(AH - 1, c.y + rr); yy++)
        for (var xx = Math.max(0, c.x - rr); xx <= Math.min(AW - 1, c.x + rr); xx++) dash[yy * AW + xx] = 0;
    });
    for (i = 0; i < n; i++) if (dash[i] && dIn[i] < 5) dash[i] = 0;

    var crosswalks = [], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    centers.forEach(function (c) {
      if (c.r < 5) return;
      dirs.forEach(function (d) {
        var t = c.r * 1.15 + 10, ok = true;
        for (var s = c.r * .8; s <= t + 12; s += 2) {
          var px = Math.round(c.x + d[0] * s), py = Math.round(c.y + d[1] * s);
          if (px < 3 || py < 3 || px >= AW - 3 || py >= AH - 3) { ok = false; break; }
          var pi = py * AW + px;
          if (!R[pi] || dIn[pi] < c.r * .5) { ok = false; break; }
        }
        if (!ok) return;
        var cx = Math.round(c.x + d[0] * t), cy = Math.round(c.y + d[1] * t);
        crosswalks.push({ x: cx, y: cy, vertical: d[0] === 0, hw: Math.max(4, dIn[cy * AW + cx] - 3.5) });
      });
    });

    // zones libres : terrains, parkings, circuit
    prog(0.5, 'Placement des terrains et parkings'); await tick();
    var occ = new Uint8Array(n);
    function markRect(x0, y0, w, h, pad) {
      for (var yy = Math.max(0, y0 - pad); yy < Math.min(AH, y0 + h + pad); yy++)
        for (var xx = Math.max(0, x0 - pad); xx < Math.min(AW, x0 + w + pad); xx++) occ[yy * AW + xx] = 1;
    }
    var pads = [];
    function tryPad(kind, rw, rh, prob) {
      if (rng() > prob) return;
      var free = new Uint8Array(n);
      for (var j = 0; j < n; j++) free[j] = (!R[j] && !water[j] && !occ[j] && dR[j] >= 5 && dWout[j] >= 5) ? 1 : 0;
      var I = integral(free, AW, AH), cands = [];
      for (var yy = 8; yy + rh < AH - 8; yy += 6) for (var xx = 8; xx + rw < AW - 8; xx += 6)
        if (rectSum(I, AW, xx, yy, xx + rw, yy + rh) >= rw * rh * 0.985) cands.push([xx, yy]);
      if (!cands.length) return;
      var p = cands[(rng() * cands.length) | 0];
      pads.push({ kind: kind, x: p[0], y: p[1], w: rw, h: rh });
      markRect(p[0], p[1], rw, rh, 5);
    }
    tryPad('track', 190, 120, 0.85);
    tryPad('pitch', 104, 66, 1);
    tryPad('parking', 76, 48, 1);
    tryPad('parking', 76, 48, 0.55);
    tryPad('tennis', 44, 70, 0.7);

    // maisons
    prog(0.62, 'Construction des maisons'); await tick();
    var IB = integral(bld, AW, AH), IP = integral(park, AW, AH);
    var nonRoad = 0, bCount = 0;
    for (i = 0; i < n; i++) if (!R[i] && !water[i]) { nonRoad++; if (bld[i]) bCount++; }
    var hasFootprints = nonRoad > 0 && bCount / nonRoad > 0.08;
    var baseP = hasFootprints ? 0.45 : 0.5;
    var HW = 40, HH = 34, houses = [];
    function clearAt(rx, ry, rw, rh, minD) {
      var pts = [[0, 0], [1, 0], [0, 1], [1, 1], [.5, .5], [.5, 0], [.5, 1], [0, .5], [1, .5]];
      for (var j = 0; j < pts.length; j++) {
        var px = Math.min(AW - 1, Math.max(0, Math.round(rx + pts[j][0] * rw))), py = Math.min(AH - 1, Math.max(0, Math.round(ry + pts[j][1] * rh))), pi = py * AW + px;
        if (R[pi] || water[pi] || dR[pi] < minD || dWout[pi] < 3) return false;
      }
      for (var yy = ry; yy < ry + rh; yy += 3) for (var xx = rx; xx < rx + rw; xx += 3) if (occ[Math.min(AH - 1, yy) * AW + Math.min(AW - 1, xx)]) return false;
      return true;
    }
    for (var gy = 16; gy < AH - HH - 14; gy += HH + 8) for (var gx = 16; gx < AW - HW - 14; gx += HW + 9) {
      var jx = gx + Math.round((rng() - .5) * 8), jy = gy + Math.round((rng() - .5) * 6);
      if (jx < 8 || jy < 8 || jx + HW > AW - 8 || jy + HH > AH - 8) continue;
      if (!clearAt(jx, jy, HW, HH, 3)) continue;
      var bcov = rectSum(IB, AW, jx, jy, jx + HW, jy + HH) / (HW * HH);
      var pcov = rectSum(IP, AW, jx, jy, jx + HW, jy + HH) / (HW * HH);
      var p = bcov > 0.3 ? 0.95 : (pcov > 0.5 ? 0.08 : baseP);
      if (rng() < p * hMul) {
        houses.push({ x: jx, y: jy, w: HW, h: HH, roof: (rng() * ROOFS.length) | 0, wall: (rng() * WALLS.length) | 0, kind: rng() < .55 ? 0 : 1 });
        markRect(jx, jy, HW, HH, 3);
      }
    }

    // arbres
    prog(0.74, 'Plantation des arbres'); await tick();
    var trees = [];
    for (var ty = 12; ty < AH - 12; ty += 22) for (var tx = 12; tx < AW - 12; tx += 22) {
      var ex = Math.round(tx + (rng() - .5) * 18), ey = Math.round(ty + (rng() - .5) * 18);
      if (ex < 10 || ey < 10 || ex > AW - 10 || ey > AH - 10) continue;
      var ii = ey * AW + ex, rad = 8.5 + rng() * 3.5;
      if (R[ii] || water[ii] || dR[ii] < rad * 0.8 + 2 || dWout[ii] < rad * 0.6 + 2) continue;
      var bad = false;
      for (var oy = -1; oy <= 1 && !bad; oy++) for (var ox = -1; ox <= 1; ox++) {
        var oi = Math.min(n - 1, Math.max(0, (ey + oy * Math.round(rad * .7)) * AW + ex + ox * Math.round(rad * .7)));
        if (occ[oi]) { bad = true; break; }
      }
      if (bad) continue;
      var pt = park[ii] ? 0.6 : 0.2;
      if (dR[ii] < 16) pt += 0.1;
      if (rng() < pt * tMul) { trees.push({ x: ex, y: ey, r: rad }); markRect(ex - 5, ey - 5, 10, 10, 2); }
    }

    // rendu des pixels (pelouse, eau, routes)
    prog(0.84, 'Peinture du tapis'); await tick();
    var n1 = lattice(AW, AH, 40, rng), n2 = lattice(AW, AH, 13, rng);
    var pix = mk(AW, AH), px = pix.getContext('2d'), out = px.createImageData(AW, AH), o = out.data;
    for (i = 0; i < n; i++) {
      var nn = n1[i] * 0.6 + n2[i] * 0.4, gr = (rng() - .5) * 6, r, g, b;
      if (water[i] && !R[i]) {
        var dw2 = dWin[i];
        if (dw2 < 2.2) { r = 30; g = 108; b = 186; }
        else { var tt = Math.min(1, dw2 / 14); r = 66 - tt * 18 + nn * 10; g = 168 - tt * 22 + nn * 8; b = 236 - tt * 10; }
      } else if (!R[i] && dWout[i] > 0 && dWout[i] < 2.4) { r = 226; g = 202; b = 132; }
      else { r = 84 + 40 * nn; g = 158 + 34 * nn; b = 40 + 22 * nn; }
      if (R[i]) {
        var de = dIn[i];
        if (de < 1.5) { r = 98; g = 101; b = 106; }
        else if (de >= 3.6 && de < 5.3) { r = 238; g = 192; b = 50; }
        else { r = 138 + (nn - .5) * 10; g = 141 + (nn - .5) * 10; b = 146 + (nn - .5) * 10; }
      }
      o[i * 4] = r + gr; o[i * 4 + 1] = g + gr; o[i * 4 + 2] = b + gr; o[i * 4 + 3] = 255;
    }
    for (i = 0; i < n; i++) if (dash[i]) {
      x = i % AW; y = (i / AW) | 0;
      if (((x + y) % 22) < 12) {
        for (var a = 0; a < 2; a++) for (var bq = 0; bq < 2; bq++) {
          var di = ((y + bq) * AW + x + a) * 4;
          if (x + a < AW && y + bq < AH) { o[di] = 242; o[di + 1] = 242; o[di + 2] = 238; }
        }
      }
    }
    px.putImageData(out, 0, 0);
    await tick();

    // rendu final (compose() peut aussi sortir le fond seul, sans maisons ni arbres)
    prog(0.92, 'Ajout des maisons, arbres et finitions'); await tick();
    var finSeed = (rng() * 4294967296) | 0;
    function compose(withItems) {
      var r2 = rngFrom(finSeed);
      var fc = mk(FW, FH), c = fc.getContext('2d');
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(pix, 0, 0, FW, FH);

      crosswalks.forEach(function (cw) { drawCross(c, cw); });

      // vaguelettes
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; c.lineCap = 'round';
      for (var wv = 0; wv < 260; wv++) {
        var wx = (r2() * AW) | 0, wy = (r2() * AH) | 0, wi = wy * AW + wx;
        if (water[wi] && !R[wi] && dWin[wi] > 8) { c.beginPath(); c.arc(wx * S, wy * S, 7 * S * .5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      }

      pads.forEach(function (p) {
        if (p.kind === 'track') drawTrack(c, p);
        else if (p.kind === 'pitch') drawPitch(c, p);
        else if (p.kind === 'parking') drawParking(c, p, r2);
        else drawTennis(c, p);
      });

      if (withItems) {
        var items = [];
        houses.forEach(function (h) { items.push({ y: h.y + h.h, f: function () { drawHouse(c, h); } }); });
        trees.forEach(function (t) { items.push({ y: t.y + t.r * .5, f: function () { drawTree(c, t); } }); });
        items.sort(function (a, b) { return a.y - b.y; });
        items.forEach(function (it) { it.f(); });
      }

      // texture de feutre
      var nz = mk(160, 160), nx = nz.getContext('2d'), nd = nx.createImageData(160, 160);
      for (var q = 0; q < nd.data.length; q += 4) { var v = r2() * 255; nd.data[q] = nd.data[q + 1] = nd.data[q + 2] = v; nd.data[q + 3] = 255; }
      nx.putImageData(nd, 0, 0);
      c.save(); c.globalAlpha = 0.1; c.globalCompositeOperation = 'multiply';
      c.fillStyle = c.createPattern(nz, 'repeat'); c.fillRect(0, 0, FW, FH); c.restore();

      // bordure
      var bw = 22;
      c.fillStyle = '#8D9096';
      c.fillRect(0, 0, FW, bw); c.fillRect(0, FH - bw, FW, bw); c.fillRect(0, 0, bw, FH); c.fillRect(FW - bw, 0, bw, FH);
      c.strokeStyle = '#6C7076'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, FW - 3, FH - 3);
      c.strokeStyle = '#A9ACB1'; c.lineWidth = 2; c.strokeRect(bw, bw, FW - 2 * bw, FH - 2 * bw);
      return fc;
    }
    var fc = compose(true);
    var baseCanvas = opts.layers ? compose(false) : null;

    prog(1, 'Terminé'); await tick();
    var waterPct = cntWater / n, roadPct = cntR / n;
    return {
      canvas: fc,
      classCanvas: cc,
      paths: paths,
      layers: opts.layers ? { base: baseCanvas, houses: houses, trees: trees, pads: pads } : null,
      stats: {
        roadPct: roadPct, waterPct: waterPct, houses: houses.length, trees: trees.length,
        hasWater: waterPct > 0.004, pads: pads.map(function (p) { return p.kind; }),
        suspicious: roadPct > 0.5 || roadPct < 0.02 || waterPct > 0.45 || (waterPct > 0.12 && waterPct > 2 * roadPct)
      }
    };
  }

  root.MatGen = { generate: generate, FW: FW, FH: FH, AW: AW, AH: AH, S: S, drawHouse: drawHouse, drawTree: drawTree };
})(typeof window !== 'undefined' ? window : globalThis);
