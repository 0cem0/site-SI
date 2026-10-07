/* Scènes 0 à 2 : accueil, capture, génération + moteur de transitions */
(function () {
  'use strict';
  var V = window.V, $ = V.$, $$ = V.$$, clamp = V.clamp, seg = V.seg, eo3 = V.eo3, eio = V.eio, eio2 = V.eio2;
  var tl = V.tl = gsap.timeline({ paused: true });
  var WD = V.WD = 1.2;
  var WIPES = V.WIPES = [
    { t: 5.4, x: 1400, y: 470, to: 's1' },
    { t: 11.4, x: 1350, y: 570, to: 's2' },
    { t: 21.4, x: 1444, y: 576, to: 's3' },
    { t: 29.4, x: 960, y: 540, to: 's4' },
    { t: 41.4, x: 1300, y: 760, to: 's5' }
  ];
  var SCENES = { s0: [0, 6.7], s1: [5.4, 12.7], s2: [11.4, 22.7], s3: [21.4, 30.7], s4: [29.4, 42.7], s5: [41.4, 49.5] };

  /* ---------- petits outils d'animation ---------- */
  V.reveal = function (sel, t, st) {
    tl.fromTo($$('.in', $(sel)), { yPercent: 118 }, { yPercent: 0, duration: .9, ease: 'power4.out', stagger: st === undefined ? .1 : st }, t);
  };
  V.unreveal = function (sel, t) {
    tl.to($$('.in', $(sel)), { yPercent: -118, duration: .55, ease: 'power3.in', stagger: .05 }, t);
  };
  V.pop = function (sel, t, o) {
    o = o || {};
    tl.fromTo(sel, { scale: o.from === undefined ? 0 : o.from, y: o.y || 0, autoAlpha: 0 }, { scale: 1, y: 0, autoAlpha: 1, duration: o.dur || .55, ease: o.ease || 'back.out(2)' }, t);
  };
  V.cx = function (X) { return X - 8; };
  V.cy = function (Y) { return Y - 4; };
  V.ripple = function (sel, X, Y, t) {
    tl.fromTo(sel, { x: X, y: Y, scale: .3, autoAlpha: .95 }, { scale: 1.7, autoAlpha: 0, duration: .5, ease: 'power2.out', immediateRender: false }, t);
  };

  /* ---------- visibilité des scènes + transitions « rond-point » ---------- */
  var ringG = V.mkRing($('#ring'));
  V.proc(function (t) {
    Object.keys(SCENES).forEach(function (id) {
      $('#' + id).style.visibility = (t >= SCENES[id][0] && t < SCENES[id][1]) ? 'visible' : 'hidden';
    });
    var active = null;
    WIPES.forEach(function (w) {
      var next = $('#' + w.to), u = seg(t, w.t, w.t + WD);
      if (u > 0 && u < 1) {
        var R = eio2(u) * 2450;
        next.style.clipPath = 'circle(' + R.toFixed(1) + 'px at ' + w.x + 'px ' + w.y + 'px)';
        V.drawRing(ringG, w.x, w.y, R, 150);
        active = w;
      } else next.style.clipPath = 'none';
    });
    $('#ring').style.display = active ? 'block' : 'none';
  });

  /* ---------- étapes (pastilles du haut) ---------- */
  V.builders.push(function () {
    var pills = $$('#steps .pill');
    tl.fromTo('#steps', { y: -70, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .7, ease: 'back.out(1.6)' }, 6.3);
    tl.to('#steps', { y: -80, autoAlpha: 0, duration: .5, ease: 'power2.in' }, 41.0);
    function on(i, t) {
      tl.to(pills[i], { backgroundColor: '#16202E', color: '#ffffff', duration: .35 }, t);
      tl.to($('b', pills[i]), { backgroundColor: '#FFC83D', color: '#16202E', duration: .35 }, t);
      if (i > 0) V.sfx('tick', t);
    }
    function off(i, t) {
      tl.to(pills[i], { backgroundColor: 'rgba(255,255,255,0.6)', color: 'rgba(22,32,46,0.62)', duration: .35 }, t);
      tl.to($('b', pills[i]), { backgroundColor: 'rgba(22,32,46,0.12)', color: 'rgba(22,32,46,0.62)', duration: .35 }, t);
    }
    on(0, 6.5); off(0, 12.3); on(1, 12.3); off(1, 22.3); on(2, 22.3); off(2, 30.3); on(3, 30.3);
    WIPES.forEach(function (w) { V.sfx('whoosh', w.t + .05); });
  });

  /* ---------- voitures de profil (accueil et final) ---------- */
  function sideCars(host, cfg) {
    cfg.forEach(function (c) {
      var s = document.createElementNS(V.NS, 'svg');
      s.setAttribute('class', 'carH'); s.setAttribute('viewBox', '0 0 120 56'); s.style.color = c.c;
      s.style.width = c.w + 'px'; s.style.height = (c.w * 56 / 120) + 'px'; s.innerHTML = '<use href="#car"/>';
      host.appendChild(s); c.el = s;
    });
    return cfg;
  }
  var CFG = [
    { c: '#E04A3A', y: 962, dir: 1, x0: 120, v: 230, w: 180 }, { c: '#2F72CC', y: 962, dir: 1, x0: 1100, v: 200, w: 160 },
    { c: '#FFFFFF', y: 962, dir: 1, x0: 1750, v: 260, w: 170 },
    { c: '#5DA62E', y: 876, dir: -1, x0: 600, v: 180, w: 170 }, { c: '#E85C93', y: 876, dir: -1, x0: 1500, v: 215, w: 160 }
  ];
  V.sideCars = sideCars; V.CFG = CFG;
  function driveCars(cars, t, k) {
    var span = 1920 + 620;
    cars.forEach(function (c) {
      var x = (((c.x0 + c.dir * c.v * (t + (k || 0))) % span) + span) % span - 310;
      c.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + c.y + 'px) scaleX(' + c.dir + ')';
    });
  }

  V.driveCars = driveCars;

  /* ================= SCÈNE 0 : accueil ================= */
  V.builders.push(function () {
    var cars = sideCars($('#cars0'), JSON.parse(JSON.stringify(CFG)).map(function (c, i) { return Object.assign(c, {}); }));
    V.proc(function (t) { if (t < 6.7) { driveCars(cars, t, 0); $('#tilt0 .tiltIn').style.translate = '0px ' + (Math.sin(t * 1.7) * 9).toFixed(1) + 'px'; } });
    var lock = $('#lock0'), lw = lock.offsetWidth, lh = lock.offsetHeight, k = 2.3;
    gsap.set(lock, { x: 960 - lw * k / 2, y: 540 - lh * k / 2, scale: k, transformOrigin: '0 0' });
    tl.fromTo('#lock0 .mark', { scale: 0, rotation: -50 }, { scale: 1, rotation: 0, duration: .8, ease: 'back.out(2.2)', transformOrigin: '50% 50%' }, .15);
    tl.fromTo('#lock0 .word', { clipPath: 'inset(0 100% 0 0)', x: -40 }, { clipPath: 'inset(0 0% 0 0)', x: 0, duration: .8, ease: 'power3.out' }, .55);
    tl.to(lock, { x: 120, y: 54, scale: 1, duration: .95, ease: 'power3.inOut' }, 1.5);
    V.reveal('#h0', 2.0, .12);
    V.reveal('#sub0', 3.3, .12);
    tl.fromTo('#tilt0', { x: 900, rotation: 9, autoAlpha: 0 }, { x: 0, rotation: 0, autoAlpha: 1, duration: 1.2, ease: 'back.out(1.25)' }, 2.5);
    V.sfx('pop', .2, { n: 4 }); V.sfx('swish', .6); V.sfx('swish', 2.0); V.sfx('swish', 3.3); V.sfx('slide', 2.6);
  });

  /* ================= SCÈNE 1 : capture ================= */
  V.builders.push(function () {
    var b = 6.0, cx = V.cx, cy = V.cy;
    V.reveal('#h1', b + .4); V.reveal('#sub1', b + 1.0, .1);
    tl.fromTo('#win', { x: 700, y: 60, rotation: 6, autoAlpha: 0 }, { x: 0, y: 0, rotation: 0, autoAlpha: 1, duration: 1.1, ease: 'back.out(1.25)' }, b + .5);
    tl.fromTo('#mapImg', { scale: 1 }, { scale: 1.05, duration: 4.4, ease: 'none' }, b + .6);
    // curseur : il rejoint le coin, puis tire un cadre de sélection
    tl.fromTo('#cur1', { autoAlpha: 0, x: cx(1740), y: cy(1000) }, { autoAlpha: 1, x: cx(930), y: cy(300), duration: .9, ease: 'power2.inOut' }, b + 2.0);
    V.ripple('#rip1', 930, 300, b + 3.0);
    tl.set('#sel', { autoAlpha: 1 }, b + 3.0);
    tl.fromTo('#sel', { width: 0, height: 0 }, { width: 840, height: 560, duration: 1.1, ease: 'power2.inOut', immediateRender: false }, b + 3.0);
    tl.to('#cur1', { x: cx(1770), y: cy(860), duration: 1.1, ease: 'power2.inOut' }, b + 3.0);
    // déclic : flash, la capture sort du cadre
    V.ripple('#rip1', 1770, 860, b + 4.1);
    tl.fromTo('#flash', { opacity: 0 }, { opacity: .85, duration: .06, ease: 'none', immediateRender: false }, b + 4.1);
    tl.to('#flash', { opacity: 0, duration: .4, ease: 'power2.out' }, b + 4.16);
    tl.set('#sel', { autoAlpha: 0 }, b + 4.1);
    tl.set('#shot', { autoAlpha: 1 }, b + 4.1);
    tl.to('#shot', { left: 880, top: 255, width: 940, height: 627, borderRadius: 18, duration: .9, ease: 'power3.inOut' }, b + 4.35);
    tl.to('#win', { x: -160, y: 90, scale: .9, autoAlpha: 0, duration: .7, ease: 'power2.in' }, b + 4.3);
    tl.to('#cur1', { autoAlpha: 0, x: cx(1800), y: cy(900), duration: .4, ease: 'power2.in' }, b + 4.3);
    tl.fromTo('#file1', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, ease: 'back.out(2)', immediateRender: false }, b + 4.9);
    V.proc(function (t) {
      if (t < 9 || t > 11) return;
      var s = $('#sel'); $('#selsz').textContent = Math.round(s.offsetWidth * 1.7857) + ' × ' + Math.round(s.offsetHeight * 1.7857);
    });
    V.sfx('swish', b + .4); V.sfx('slide', b + .5); V.sfx('click', b + 3.0); V.sfx('click', b + 4.1); V.sfx('shutter', b + 4.1); V.sfx('slide', b + 4.35); V.sfx('pop', b + 4.9, { n: 2 });
  });

  /* ================= SCÈNE 2 : génération ================= */
  V.builders.push(function () {
    var b = 12.0, L = window.LAYOUT, sc = .62667;
    V.reveal('#h2', b + .4); V.reveal('#sub2', b + 1.0, .1);
    V.pop('#st-r', b + 1.5, { from: .6 }); V.pop('#st-h', b + 1.65, { from: .6 }); V.pop('#st-t', b + 1.8, { from: .6 });

    // lecture : la barre balaye la capture, la « reconnaissance » apparaît derrière
    var s0 = 13.6, s1 = 15.8;
    tl.set('#scan', { autoAlpha: 1 }, s0);
    tl.fromTo('#scan', { x: 0 }, { x: 940, duration: s1 - s0, ease: 'power1.inOut', immediateRender: false }, s0);
    tl.set('#scan', { autoAlpha: 0 }, s1 + .05);
    tl.fromTo('#clsLay', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: s1 - s0, ease: 'power1.inOut' }, s0);
    V.sfx('scan', s0);

    // pastilles explicatives
    var wrap = $('#callwrap');
    [
      { k: 'Routes', x: 190, y: 321, px: 60, py: 214, c: '#4B5563', t: 13.95 },
      { k: 'Parc', x: 470, y: 180, px: 540, py: 78, c: '#60B84E', t: 14.45 },
      { k: 'Rond-point', x: 564, y: 321, px: 590, py: 404, c: '#6B7280', t: 14.8 },
      { k: 'Rivière', x: 885, y: 430, px: 690, py: 522, c: '#2F8DE0', t: 15.45 }
    ].forEach(function (c) {
      var dot = document.createElement('div'), line = document.createElement('div'), pill = document.createElement('div');
      dot.className = 'co-dot'; line.className = 'co-line'; pill.className = 'co-pill'; pill.textContent = c.k;
      [dot, pill].forEach(function (e) { e.style.setProperty('--c', c.c); });
      dot.style.left = c.x + 'px'; dot.style.top = c.y + 'px';
      var tx = c.px + 36, ty = c.py + 26, len = Math.hypot(tx - c.x, ty - c.y), ang = Math.atan2(ty - c.y, tx - c.x) * 180 / Math.PI;
      line.style.left = c.x + 'px'; line.style.top = c.y + 'px'; line.style.width = len + 'px';
      pill.style.left = c.px + 'px'; pill.style.top = c.py + 'px';
      wrap.appendChild(line); wrap.appendChild(dot); wrap.appendChild(pill);
      gsap.set(line, { rotation: ang, transformOrigin: '0 50%' });
      tl.fromTo(dot, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .35, ease: 'back.out(3)' }, c.t);
      tl.fromTo(line, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: .3, ease: 'power2.out' }, c.t + .1);
      tl.fromTo(pill, { scale: 0, autoAlpha: 0, transformOrigin: '0% 50%' }, { scale: 1, autoAlpha: 1, duration: .45, ease: 'back.out(2.2)' }, c.t + .22);
      tl.to([dot, line, pill], { autoAlpha: 0, scale: .6, duration: .3, ease: 'power2.in' }, 16.15);
      V.sfx('chip', c.t + .22);
    });

    // peinture : une onde part du rond-point et dévoile le tapis (sans maisons ni arbres)
    var rr = V.mkRing($('#cardRing')), r0 = 16.2, r1 = 17.3;
    tl.fromTo('#baseLay', { clipPath: 'circle(0px at 564px 321px)' }, { clipPath: 'circle(1200px at 564px 321px)', duration: r1 - r0, ease: 'power2.inOut' }, r0);
    tl.set('#clsLay', { autoAlpha: 0 }, r1 + .05);
    V.proc(function (t) {
      var u = seg(t, r0, r1), svg = $('#cardRing');
      if (u > 0 && u < 1) { svg.style.display = 'block'; V.drawRing(rr, 564, 321, eio2(u) * 1200, 60); } else svg.style.display = 'none';
    });
    V.sfx('ripple', r0);

    // maisons et arbres apparaissent un à un, de gauche à droite
    var host = $('#mspace2'), items = [];
    L.houses.forEach(function (h) { items.push({ k: 'h', s: h }); });
    L.trees.forEach(function (h) { items.push({ k: 't', s: h }); });
    items.sort(function (a, c) { return (a.s.x + a.s.w / 2) - (c.s.x + c.s.w / 2); });
    var t0 = 17.35, dt = 2.5 / items.length, hn = 0;
    items.forEach(function (it, i) {
      var img = document.createElement('img'); img.className = 'sp'; img.src = '../assets/' + it.s.file;
      img.style.left = it.s.x + 'px'; img.style.top = it.s.y + 'px'; img.style.width = it.s.w + 'px'; img.style.height = it.s.h + 'px'; img.style.zIndex = Math.round(it.s.z);
      host.appendChild(img);
      it.t = t0 + i * dt;
      tl.fromTo(img, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .5, ease: 'back.out(2.4)' }, it.t);
      if (it.k === 'h') { V.sfx('pop', it.t, { n: hn++ }); } else if (i % 3 === 0) V.sfx('leaf', it.t);
    });
    var nh = items.filter(function (x) { return x.k === 'h'; }).length, nt = items.length - nh;
    V.proc(function (t) {
      if (t < 12 || t > 22.7) return;
      var road = Math.round(32 * eio(seg(t, 13.6, 15.8)));
      var h = 0, tr = 0; items.forEach(function (it) { if (t >= it.t + .2) { if (it.k === 'h') h++; else tr++; } });
      $('#n-r').textContent = road + ' %'; $('#n-h').textContent = h; $('#n-t').textContent = tr;
    });

    // voitures qui roulent sur les routes détectées
    var cols = ['#E04A3A', '#2F72CC', '#FFC83D'], hostC = $('#cars2'), cars = [];
    L.paths.slice(0, 3).forEach(function (pts, i) {
      var el = V.mkCarTop(hostC, cols[i], 1.5), p = V.makePath(pts, 1500, 1000), ts = 19.3 + i * .25;
      cars.push({ el: el, p: p, ts: ts, w: 150, h: 75 });
      tl.fromTo($('svg', el), { scale: 0 }, { scale: 1, duration: .5, ease: 'back.out(2.4)' }, ts);
      V.sfx('beep', ts, { n: i });
    });
    V.proc(function (t) {
      cars.forEach(function (c) {
        if (t < c.ts || t > 22.7) { c.el.style.opacity = 0; return; }
        var q = V.pathAt(c.p, 30 + 250 * (t - c.ts));
        c.el.style.opacity = 1;
        c.el.style.transform = 'translate(' + (q.x - c.w / 2).toFixed(1) + 'px,' + (q.y - c.h / 2).toFixed(1) + 'px) rotate(' + q.ang.toFixed(1) + 'deg)';
      });
    });

    // finitions : le vrai tapis (avec la texture feutre) remplace l'assemblage
    tl.fromTo('#finalLay', { autoAlpha: 0 }, { autoAlpha: 1, duration: .6, ease: 'none' }, 20.3);
    tl.fromTo('#ready2', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, ease: 'back.out(2)', immediateRender: false }, 20.45);
    V.sfx('ding', 20.5, { soft: 1 });
  });
})();
