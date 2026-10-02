/* ============================================================
   sample.js — Dessine une carte d'exemple façon Google Maps
   (utilisée quand l'utilisateur n'a pas encore importé de capture)
   ============================================================ */
(function (root) {
  'use strict';

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function draw(canvas, W, H) {
    W = W || 1200; H = H || 800;
    canvas.width = W; canvas.height = H;
    var x = canvas.getContext('2d'), r = rng(11);
    x.save();
    x.scale(W / 1200, H / 800);
    x.fillStyle = '#F5F5F5'; x.fillRect(0, 0, 1200, 800);

    var vx = [150, 430, 720, 1010], hy = [140, 410, 660];
    var xs = [0].concat(vx, [1200]), ys = [0].concat(hy, [800]);

    // rivière à droite
    x.fillStyle = '#AADAFF';
    x.beginPath(); x.moveTo(1100, 0);
    x.bezierCurveTo(1050, 220, 1140, 420, 1085, 800);
    x.lineTo(1200, 800); x.lineTo(1200, 0); x.closePath(); x.fill();

    // blocs
    for (var i = 0; i < xs.length - 1; i++) {
      for (var j = 0; j < ys.length - 1; j++) {
        if (i === 4) continue;
        var bx = xs[i] + 26, by = ys[j] + 26, bw = xs[i + 1] - xs[i] - 52, bh = ys[j + 1] - ys[j] - 52;
        if (i === 1 && j === 1) {
          x.fillStyle = '#C8E6C9'; x.fillRect(bx, by, bw, bh);
          x.fillStyle = '#AADAFF'; x.beginPath(); x.ellipse(bx + bw * 0.5, by + bh * 0.5, 60, 38, 0, 0, 7); x.fill();
          continue;
        }
        x.fillStyle = '#E8E6E1';
        var cols = 2 + Math.floor(r() * 2), rows = 1 + Math.floor(r() * 2);
        for (var a = 0; a < cols; a++) for (var b = 0; b < rows; b++) {
          var w = bw / cols, h = bh / rows;
          x.fillRect(bx + a * w + 6, by + b * h + 6, w - 12, h - 12);
        }
      }
    }

    // routes : d'abord les contours, ensuite les remplissages
    var roads = [];
    vx.forEach(function (v) { roads.push({ p: [[v, -20], [v, 820]], w: 32, f: '#FFFFFF', e: '#DADCE0' }); });
    hy.forEach(function (v, k) { if (k !== 1) roads.push({ p: [[-20, v], [1220, v]], w: 32, f: '#FFFFFF', e: '#DADCE0' }); });
    roads.push({ p: [[-20, 410], [1220, 410]], w: 44, f: '#FCE8A6', e: '#F0C36D' });
    roads.push({ p: [[-20, 790], [430, 410], [720, 140], [1220, -30]], w: 22, f: '#FFFFFF', e: '#DADCE0' });
    [0, 1].forEach(function (pass) {
      roads.forEach(function (rd) {
        x.lineCap = 'round'; x.lineJoin = 'round';
        x.strokeStyle = pass ? rd.f : rd.e; x.lineWidth = pass ? rd.w : rd.w + 5;
        x.beginPath(); x.moveTo(rd.p[0][0], rd.p[0][1]);
        for (var k = 1; k < rd.p.length; k++) x.lineTo(rd.p[k][0], rd.p[k][1]);
        x.stroke();
      });
    });

    // rond-point
    x.strokeStyle = '#DADCE0'; x.lineWidth = 33; x.beginPath(); x.arc(720, 410, 62, 0, 7); x.stroke();
    x.strokeStyle = '#FFFFFF'; x.lineWidth = 28; x.beginPath(); x.arc(720, 410, 62, 0, 7); x.stroke();
    x.fillStyle = '#C8E6C9'; x.beginPath(); x.arc(720, 410, 46, 0, 7); x.fill();

    // pont
    x.fillStyle = '#FCE8A6'; x.fillRect(1060, 388, 80, 44);

    // noms de rues
    x.fillStyle = '#70757A'; x.font = '600 16px Arial'; x.textAlign = 'center';
    x.fillText('Avenue de la République', 300, 415);
    x.fillText('Rue Pasteur', 600, 145);
    x.restore();
  }

  root.Sample = { draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
