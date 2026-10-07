/* ============================================================
   sample.js — Dessine une fausse capture de plan « style Google Maps »
   (quartier imaginaire : rues, parc, rivière, rond-point, noms de rues,
   petites icônes de commerces). Sert d'exemple et de test au générateur.
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

  var FONT = '"Roboto","Helvetica Neue",Arial,sans-serif';

  function label(x, txt, px, py, color, size, rot, italic) {
    x.save(); x.translate(px, py); if (rot) x.rotate(rot);
    x.font = (italic ? 'italic ' : '') + '500 ' + size + 'px ' + FONT;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 4; x.strokeStyle = 'rgba(255,255,255,.92)';
    x.strokeText(txt, 0, 0); x.fillStyle = color; x.fillText(txt, 0, 0);
    x.restore();
  }

  function pin(x, px, py, col, txt) {
    x.fillStyle = col; x.beginPath(); x.arc(px, py, 10, 0, 7); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, 3.4, 0, 7); x.fill();
    if (txt) {
      x.save(); x.font = '500 12px ' + FONT; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.lineJoin = 'round'; x.lineWidth = 4; x.strokeStyle = 'rgba(255,255,255,.92)';
      x.strokeText(txt, px + 15, py); x.fillStyle = '#5F6368'; x.fillText(txt, px + 15, py);
      x.restore();
    }
  }

  function draw(canvas, W, H) {
    canvas.width = W; canvas.height = H;
    var x = canvas.getContext('2d'), r = rng(23);
    x.save(); x.scale(W / 1200, H / 800);
    x.fillStyle = '#F5F5F5'; x.fillRect(0, 0, 1200, 800);

    var vx = [170, 570, 840, 1040], hy = [110, 420, 660];
    var xs = [-40].concat(vx, [1100]), ys = [-40].concat(hy, [840]);
    var INS = 26, i, j, a, b;

    // rivière
    x.fillStyle = '#AADAFF';
    x.beginPath(); x.moveTo(1112, -10); x.bezierCurveTo(1062, 200, 1156, 430, 1098, 810); x.lineTo(1210, 810); x.lineTo(1210, -10); x.closePath(); x.fill();
    x.strokeStyle = '#97C8F2'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(1112, -10); x.bezierCurveTo(1062, 200, 1156, 430, 1098, 810); x.stroke();

    // îlots : parc, école, immeubles
    var feet = ['#E9E6E0', '#EAE7E1', '#E7E4DE'];
    for (i = 0; i < xs.length - 1; i++) for (j = 0; j < ys.length - 1; j++) {
      var bx0 = xs[i] + INS, bx1 = xs[i + 1] - INS, by0 = ys[j] + INS, by1 = ys[j + 1] - INS;
      if (bx1 - bx0 < 40 || by1 - by0 < 40) continue;
      var bw = bx1 - bx0, bh = by1 - by0;
      if (i === 1 && j === 1) {                                   // parc
        x.fillStyle = '#CBE8C8'; x.fillRect(bx0, by0, bw, bh);
        x.strokeStyle = '#FFFFFF'; x.lineWidth = 3; x.lineCap = 'round';
        x.beginPath(); x.moveTo(bx0, by1 - 40); x.bezierCurveTo(bx0 + 120, by1 - 120, bx0 + 220, by0 + 120, bx1, by0 + 60); x.stroke();
        x.beginPath(); x.moveTo(bx0 + 40, by0); x.bezierCurveTo(bx0 + 60, by0 + 100, bx0 + 150, by0 + 130, bx0 + 190, by1); x.stroke();
        continue;
      }
      if (i === 3 && j === 1) {                                   // école + terrain de sport
        x.fillStyle = '#E3E1DC'; x.fillRect(bx0, by0, bw, bh * 0.48);
        x.fillStyle = '#CBE8C8'; x.fillRect(bx0, by0 + bh * 0.54, bw, bh * 0.46);
        x.strokeStyle = '#FFFFFF'; x.lineWidth = 2.5; x.strokeRect(bx0 + 14, by0 + bh * 0.54 + 14, bw - 28, bh * 0.46 - 28);
        continue;
      }
      var cols = Math.max(1, Math.round(bw / (74 + r() * 46))), rows = Math.max(1, Math.round(bh / (62 + r() * 40)));
      for (a = 0; a < cols; a++) for (b = 0; b < rows; b++) {
        var cw = bw / cols, ch = bh / rows, gx = 6 + r() * 4, gy = 6 + r() * 4;
        x.fillStyle = feet[(r() * 3) | 0];
        x.fillRect(bx0 + a * cw + gx / 2, by0 + b * ch + gy / 2, cw - gx, ch - gy);
      }
    }

    // routes : d'abord tous les contours, puis tous les remplissages
    var roads = [];
    vx.forEach(function (v) { roads.push({ p: [[v, -30], [v, 830]], w: 34, f: '#FFFFFF', e: '#DADCE0' }); });
    [hy[0], hy[2]].forEach(function (v) { roads.push({ p: [[-30, v], [1230, v]], w: 34, f: '#FFFFFF', e: '#DADCE0' }); });
    roads.push({ p: [[705, hy[0]], [705, hy[1]]], w: 16, f: '#FFFFFF', e: '#DADCE0' });
    roads.push({ p: [[vx[0], 540], [vx[1], 540]], w: 16, f: '#FFFFFF', e: '#DADCE0' });
    roads.push({ p: [[vx[2], 545], [vx[3], 545]], w: 16, f: '#FFFFFF', e: '#DADCE0' });
    roads.push({ p: [[-30, hy[1]], [1230, hy[1]]], w: 46, f: '#FCE8A6', e: '#F0C36D' });
    [0, 1].forEach(function (pass) {
      roads.forEach(function (rd) {
        x.lineCap = 'round'; x.lineJoin = 'round';
        x.strokeStyle = pass ? rd.f : rd.e; x.lineWidth = rd.w + (pass ? 0 : 5);
        x.beginPath(); x.moveTo(rd.p[0][0], rd.p[0][1]);
        for (var k = 1; k < rd.p.length; k++) x.lineTo(rd.p[k][0], rd.p[k][1]);
        x.stroke();
      });
    });

    // rond-point
    x.strokeStyle = '#DADCE0'; x.lineWidth = 40; x.beginPath(); x.arc(vx[2], hy[1], 66, 0, 7); x.stroke();
    x.strokeStyle = '#FFFFFF'; x.lineWidth = 34; x.beginPath(); x.arc(vx[2], hy[1], 66, 0, 7); x.stroke();
    x.fillStyle = '#CBE8C8'; x.beginPath(); x.arc(vx[2], hy[1], 48, 0, 7); x.fill();
    x.fillStyle = '#AADAFF'; x.beginPath(); x.arc(vx[2], hy[1], 14, 0, 7); x.fill();

    // noms de rues
    var G = '#5F6368';
    label(x, 'Avenue de la République', 330, hy[1], G, 15, 0);
    label(x, 'Avenue de la République', 1005, hy[1] - 1, G, 15, 0);
    label(x, 'Rue Pasteur', 700, hy[0], G, 14, 0);
    label(x, 'Rue Mozart', 330, hy[2], G, 14, 0);
    label(x, 'Rue des Lilas', vx[0], 260, G, 14, -Math.PI / 2);
    label(x, 'Rue Victor Hugo', vx[1], 560, G, 14, -Math.PI / 2);
    label(x, 'Boulevard Jean Jaurès', vx[2], 570, G, 14, -Math.PI / 2);
    label(x, 'Parc Saint-Martin', 340, 330, '#2E7D32', 15, 0);
    label(x, 'Groupe scolaire', 950, 190, '#5F6368', 13, 0);

    // commerces et services
    pin(x, 700, 300, '#EA8600', 'Boulangerie');
    pin(x, 330, 515, '#F9AB00', 'Café des Lilas');
    pin(x, 690, 600, '#1A73E8', 'Supermarché');
    pin(x, 95, 505, '#D93025', 'Pharmacie');
    pin(x, 935, 600, '#E8710A', 'Restaurant');
    pin(x, 470, 760, '#1A73E8', null);
    x.restore();
  }

  root.Sample = { draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
