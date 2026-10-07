/* Scènes 3 à 5 : vue 3D, commande et livraison, final */
(function () {
  'use strict';
  var V = window.V, $ = V.$, $$ = V.$$, clamp = V.clamp, seg = V.seg, eo3 = V.eo3, eio = V.eio, tl = V.tl, L = window.LAYOUT;
  var lerp = V.lerp;

  /* ================= SCÈNE 3 : le tapis en 3D ================= */
  V.builders.push(function () {
    // parquet (texture qui se répète)
    (function () {
      var c = document.createElement('canvas'); c.width = c.height = 1024;
      var x = c.getContext('2d'), r = V.rng(11), tones = ['#E3AB6C', '#DDA262', '#E8B676', '#D99A58', '#E0A867', '#E6AF72'];
      x.fillStyle = '#DDA15E'; x.fillRect(0, 0, 1024, 1024);
      function plank(x0, y0, w, h, tone, seed) {
        var q = V.rng(seed);
        x.fillStyle = tone; x.fillRect(x0, y0, w, h);
        var g = x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(120,60,10,.10)');
        x.fillStyle = g; x.fillRect(x0, y0, w, h);
        x.lineWidth = 2;
        for (var k = 0; k < 7; k++) {
          var yy = y0 + 10 + q() * (h - 20), a = q() * .12 + .04;
          x.strokeStyle = 'rgba(120,64,14,' + a.toFixed(3) + ')'; x.beginPath(); x.moveTo(x0 + 4, yy);
          x.bezierCurveTo(x0 + w * .3, yy + (q() - .5) * 8, x0 + w * .65, yy + (q() - .5) * 8, x0 + w - 4, yy + (q() - .5) * 4); x.stroke();
        }
        x.strokeStyle = 'rgba(90,46,8,.42)'; x.lineWidth = 3; x.strokeRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);
      }
      for (var j = 0; j < 8; j++) {
        var o = ((j * 3) % 8) * 128;
        for (var k = 0; k < 2; k++) {
          var x0 = o + k * 512, tone = tones[Math.floor(r() * tones.length)], sd = 100 + j * 7 + k;
          plank(x0, j * 128, 512, 128, tone, sd);
          if (x0 + 512 > 1024) plank(x0 - 1024, j * 128, 512, 128, tone, sd);
        }
      }
      $('#floor').style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
    })();

    var world = $('#world'), matbox = $('#matbox'), shadow = $('#shadow');
    var cam = { rx: 58, rz: -130, s: 1, tx: 0, ty: 0, drop: 620 };
    var T = { a: 22.2, b: 23.4, c: 25.9, d: 27.0, e: 27.1, f: 28.7, g: 30.7 };
    // atterrissage (rebonds)
    tl.to(cam, { drop: 0, duration: 1.0, ease: 'bounce.out' }, T.a);
    V.sfx('thud', T.a + .364, { v: 1 }); V.sfx('thud', T.a + .727, { v: .5 }); V.sfx('thud', T.a + .909, { v: .25 }); V.sfx('swish', T.a - .05);
    // caméra : rotation + inclinaison + zoom
    tl.to(cam, { rz: -34, duration: 1.1, ease: 'power3.out' }, T.a);
    tl.to(cam, { rz: 14, rx: 50, s: 1.05, duration: T.c - T.b, ease: 'sine.inOut' }, T.b);          // tour du tapis
    tl.to(cam, { rz: 0, rx: 0, s: 1.1, ty: -12, duration: T.d - T.c, ease: 'power3.inOut' }, T.c);   // vue de dessus
    tl.to(cam, { rz: -38, rx: 71, s: 1.22, tx: -340, ty: -5, duration: T.f - T.e, ease: 'power3.inOut' }, T.e); // vue enfant
    tl.to(cam, { rz: -20, rx: 66, s: 1.16, duration: T.g - T.f, ease: 'sine.inOut' }, T.f);
    V.sfx('whoosh', T.c, { soft: 1 }); V.sfx('whoosh', T.e, { soft: 1 });

    V.proc(function (t) {
      if (t < 21.3 || t > 30.8) return;
      world.style.transform = 'translate3d(' + cam.tx.toFixed(1) + 'px,' + cam.ty.toFixed(1) + 'px,0) rotateX(' + cam.rx.toFixed(2) + 'deg) rotateZ(' + cam.rz.toFixed(2) + 'deg) scale(' + cam.s.toFixed(4) + ')';
      matbox.style.transform = 'translateZ(' + cam.drop.toFixed(1) + 'px)';
      $('#haze').style.opacity = seg(cam.rx, 56, 68).toFixed(3);
      var vis = seg(t, 22.12, 22.4);
      matbox.style.opacity = vis;
      var d = 24 + cam.drop * .16, a = cam.rz * Math.PI / 180;
      shadow.style.transform = 'translate3d(' + (d * Math.sin(a)).toFixed(1) + 'px,' + (d * Math.cos(a)).toFixed(1) + 'px,1px)';
      shadow.style.opacity = ((.3 + .7 / (1 + cam.drop / 110)) * vis).toFixed(3);
    });

    // texte
    V.reveal('#h3', 22.4, .12); V.reveal('#sub3', 22.95, .1);
    V.unreveal('#h3', 26.7); V.unreveal('#sub3', 26.78);
    // sélecteur de vues
    tl.fromTo('#modes', { y: 70, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .7, ease: 'back.out(1.6)' }, 22.7);
    var m = [$('#m1'), $('#m2'), $('#m3')];
    function on(i, t) { tl.to(m[i], { backgroundColor: '#16202E', color: '#ffffff', duration: .3 }, t); }
    function off(i, t) { tl.to(m[i], { backgroundColor: 'rgba(22,32,46,0)', color: '#586374', duration: .3 }, t); }
    on(0, 23.1); off(0, T.c - .1); on(1, T.c - .1); off(1, T.e - .05); on(2, T.e - .05);
    V.sfx('click', T.c - .1); V.sfx('click', T.e - .05);

    // voitures qui roulent sur le tapis
    var cols = ['#E04A3A', '#2F72CC', '#FFC83D'], host = $('#cars3'), cars = [];
    L.paths.slice(0, 3).forEach(function (pts, i) {
      var el = V.mkCarTop(host, cols[i], .85), p = V.makePath(pts, 960, 640), ts = 23.5 + i * .3;
      cars.push({ el: el, p: p, ts: ts, w: 85, h: 42.5, sp: p.len / 8.6 });
      tl.fromTo($('svg', el), { scale: 0 }, { scale: 1, duration: .45, ease: 'back.out(2.4)' }, ts);
      V.sfx('beep', ts, { n: i });
    });
    V.proc(function (t) {
      cars.forEach(function (c) {
        if (t < c.ts || t > 30.8) { c.el.style.opacity = 0; return; }
        var q = V.pathAt(c.p, c.p.len * .03 + c.sp * (t - c.ts));
        c.el.style.opacity = 1;
        c.el.style.transform = 'translate(' + (q.x - c.w / 2).toFixed(1) + 'px,' + (q.y - c.h / 2).toFixed(1) + 'px) rotate(' + q.ang.toFixed(1) + 'deg)';
      });
    });
  });

  /* ================= SCÈNE 4 : commande et livraison ================= */
  V.builders.push(function () {
    var cx = V.cx, cy = V.cy;
    /* --- 4a : taille et matière --- */
    V.reveal('#h4a', 30.35, .12); V.reveal('#sub4a', 30.85, .1);
    [['#sz1', 30.6], ['#sz2', 30.72], ['#sz3', 30.84]].forEach(function (a, i) {
      tl.fromTo(a[0], { y: 90, scale: .92, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: .6, ease: 'back.out(1.7)' }, a[1]);
      V.sfx('pop', a[1], { n: i });
    });
    tl.fromTo('#cur4', { autoAlpha: 0, x: cx(1760), y: cy(930) }, { autoAlpha: 1, x: cx(1338), y: cy(520), duration: .9, ease: 'power2.inOut' }, 31.2);
    V.ripple('#rip4', 1338, 520, 32.1); V.sfx('click', 32.1);
    tl.fromTo('#selring', { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: .3, ease: 'back.out(2.5)', immediateRender: false }, 32.1);
    tl.to('#sz2', { scale: 1.05, duration: .25, ease: 'power2.out' }, 32.1);
    tl.to(['#sz1', '#sz3'], { opacity: .5, duration: .3 }, 32.1);
    V.pop('#mt1', 32.35, { y: 40, from: .85 }); V.pop('#mt2', 32.5, { y: 40, from: .85 }); V.sfx('pop', 32.35, { n: 5 }); V.sfx('pop', 32.5, { n: 6 });
    tl.to('#cur4', { x: cx(922), y: cy(769), duration: .45, ease: 'power2.inOut' }, 32.6);
    V.ripple('#rip4', 922, 769, 33.05); V.sfx('click', 33.05);
    tl.to('#rd1', { scale: 1, duration: .28, ease: 'back.out(3)' }, 33.05);
    tl.fromTo('#tot', { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, ease: 'back.out(1.7)' }, 33.15);
    V.sfx('chip', 33.2);
    tl.to('#cur4', { autoAlpha: 0, x: cx(960), y: cy(830), duration: .35, ease: 'power2.in' }, 33.3);
    V.proc(function (t) { if (t > 33 && t < 34.6) $('#totv').textContent = Math.round(69 * eo3(seg(t, 33.25, 33.85))) + ' €'; });
    tl.to(['#sz1', '#sz2', '#sz3', '#mt1', '#mt2', '#tot'], { y: -70, autoAlpha: 0, duration: .36, ease: 'power2.in', stagger: .03 }, 33.9);
    V.unreveal('#h4a', 33.9); V.unreveal('#sub4a', 33.95);

    /* --- 4b : paiement --- */
    V.reveal('#h4b', 34.3, .12); V.reveal('#sub4b', 34.75, .1);
    tl.fromTo('#pay', { x: 1000, rotation: 5, autoAlpha: 0 }, { x: 0, rotation: 0, autoAlpha: 1, duration: .9, ease: 'back.out(1.3)' }, 34.1);
    V.sfx('slide', 34.1);
    var tf = [
      { el: $('#ty-name'), txt: 'Camille Martin', a: 34.75, b: 35.25 },
      { el: $('#ty-mail'), txt: 'camille@exemple.fr', a: 35.3, b: 35.9 },
      { el: $('#ty-card'), txt: '•••• •••• •••• 4242', a: 35.95, b: 36.45 }
    ];
    tf.forEach(function (f, i) { f.end = i < tf.length - 1 ? tf[i + 1].a - .05 : 36.7; for (var k = 0; k < 14; k++) V.sfx('key', f.a + (f.b - f.a) * k / 14, { n: k }); });
    V.proc(function (t) {
      if (t < 34 || t > 38.9) return;
      tf.forEach(function (f) {
        f.el.textContent = f.txt.slice(0, Math.round(f.txt.length * seg(t, f.a, f.b)));
        var act = t >= f.a - .1 && t < f.end, u = f.el.parentNode.querySelector('u');
        u.style.visibility = act && (t < f.b + .05 || Math.floor(t * 3) % 2 === 0) ? 'visible' : 'hidden';
        f.el.parentNode.style.borderColor = act ? '#16202E' : '#E2E6EC';
      });
      var pay = t >= 36.75 && t < 37.45;
      $('#spin').style.opacity = pay ? 1 : 0; $('#spin').style.transform = 'rotate(' + (t * 760).toFixed(0) + 'deg)';
      $('#paytxt').textContent = pay ? 'Paiement en cours…' : 'Payer 69 €';
    });
    tl.fromTo('#cur4', { autoAlpha: 0, x: cx(1560), y: cy(660) }, { autoAlpha: 1, x: cx(1370), y: cy(801), duration: .5, ease: 'power2.inOut', immediateRender: false }, 36.15);
    V.ripple('#rip4', 1370, 801, 36.7); V.sfx('click', 36.7);
    tl.to('#btnpay', { y: 8, boxShadow: '0 2px 0 #05090F', duration: .08, ease: 'none' }, 36.7);
    tl.to('#btnpay', { y: 0, boxShadow: '0 10px 0 #05090F', duration: .15, ease: 'power2.out' }, 36.82);
    tl.to('#cur4', { autoAlpha: 0, duration: .3 }, 36.95);
    tl.fromTo('#okbox', { autoAlpha: 0 }, { autoAlpha: 1, duration: .08, ease: 'none', immediateRender: false }, 37.45);
    tl.fromTo('#okbox .big', { scale: 0 }, { scale: 1, duration: .65, ease: 'back.out(2.6)', immediateRender: false }, 37.5);
    tl.fromTo('#okbox h4, #okbox p', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .5, ease: 'power3.out', stagger: .1, immediateRender: false }, 37.75);
    V.sfx('ding', 37.5); V.sfx('confetti', 37.5);
    var conf = V.makeConfetti($('#s4'), 70, 7);
    V.proc(function (t) { V.stepConfetti(conf, 1370, 580, t - 37.5, 1.5); });

    /* --- 4c : livraison --- */
    V.unreveal('#h4b', 38.2); V.unreveal('#sub4b', 38.25);
    tl.to('#pay', { y: 90, scale: .9, autoAlpha: 0, duration: .5, ease: 'power2.in' }, 38.3);
    V.reveal('#h4c', 38.6, .12); V.reveal('#sub4c', 39.05, .1);
    tl.fromTo('#road4', { y: 340, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .7, ease: 'power3.out' }, 38.35);
    tl.fromTo('#walk', { y: 120, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, ease: 'power3.out' }, 38.4);
    gsap.set('#house', { transformOrigin: '50% 100%' }); gsap.set('#tree4a, #tree4b', { transformOrigin: '50% 100%' });
    tl.fromTo('#house', { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .7, ease: 'back.out(1.8)' }, 38.55);
    tl.fromTo('#tree4a', { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .55, ease: 'back.out(2.2)' }, 38.7);
    tl.fromTo('#tree4b', { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .55, ease: 'back.out(2.2)' }, 38.8);
    V.sfx('pop', 38.55, { n: 3 }); V.sfx('leaf', 38.7); V.sfx('leaf', 38.8); V.sfx('van', 38.7);
    // camionnette : arrive de la gauche et freine devant la porte
    var van = $('#van'), parcel = $('#parcel'), VY = 772, VS = 1.5, VX1 = 1080;
    V.proc(function (t) {
      var u = seg(t, 38.7, 40.0), x = lerp(-520, VX1, 1 - Math.pow(1 - u, 2));
      van.style.opacity = t >= 38.65 ? 1 : 0;
      var bob = u > 0 && u < 1 ? Math.sin(t * 38) * 1.8 * (1 - u) : 0;
      van.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (VY + bob).toFixed(1) + 'px) scale(' + VS + ')';
      van.style.transformOrigin = '0 0';
      var p = seg(t, 40.05, 40.65);
      if (t < 40.05) { parcel.style.opacity = 0; return; }
      var x0 = VX1 + 150 * VS * .8, y0 = VY + 20, x1 = 1534, y1 = 690;
      parcel.style.opacity = 1;
      var sc = clamp(p * 4, 0, 1) * (p >= 1 ? 1 : 1) + (p >= 1 ? Math.max(0, .12 * Math.sin((t - 40.65) * 26) * Math.exp(-(t - 40.65) * 8)) : 0);
      parcel.style.transform = 'translate(' + lerp(x0, x1, eio(p)).toFixed(1) + 'px,' + (lerp(y0, y1, p) - 150 * Math.sin(Math.PI * p)).toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')';
    });
    V.sfx('thud', 40.65, { v: .6 });
    tl.fromTo('#deliv', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, ease: 'back.out(2)', immediateRender: false }, 40.75);
    V.sfx('ding', 40.8);
  });

  /* ================= SCÈNE 5 : final ================= */
  V.builders.push(function () {
    var b = 42.0, cars = V.sideCars($('#cars5'), JSON.parse(JSON.stringify(V.CFG)));
    V.proc(function (t) {
      if (t < 41.3) return;
      V.driveCars(cars, t, 3.1);
      $('#tilt5 .tiltIn').style.translate = '0px ' + (Math.sin(t * 1.7) * 9).toFixed(1) + 'px';
    });
    gsap.set('#lock5', { x: 120, y: 54, transformOrigin: '0 0' });
    tl.fromTo('#lock5 .mark', { scale: 0, rotation: -50 }, { scale: 1, rotation: 0, duration: .8, ease: 'back.out(2.2)', transformOrigin: '50% 50%' }, b - .05);
    tl.fromTo('#lock5 .word', { clipPath: 'inset(0 100% 0 0)', x: -40 }, { clipPath: 'inset(0 0% 0 0)', x: 0, duration: .8, ease: 'power3.out' }, b + .3);
    V.reveal('#h5', b + .35, .12);
    tl.fromTo('#tilt5', { x: 900, rotation: 9, autoAlpha: 0 }, { x: 0, rotation: 0, autoAlpha: 1, duration: 1.2, ease: 'back.out(1.25)' }, b + .45);
    V.sfx('swish', b + .35); V.sfx('slide', b + .5);
    // bouton d'appel à l'action
    var cta = $('#cta'), cw = cta.offsetWidth;
    $('#price5').style.left = (120 + cw + 28) + 'px';
    tl.fromTo('#cta', { scale: .6, y: 40, autoAlpha: 0 }, { scale: 1, y: 0, autoAlpha: 1, duration: .6, ease: 'back.out(2)' }, b + 2.0);
    tl.fromTo('#price5', { scale: .6, y: 30, autoAlpha: 0 }, { scale: 1, y: 0, autoAlpha: 1, duration: .55, ease: 'back.out(2)' }, b + 2.35);
    V.sfx('pop', b + 2.0, { n: 7 }); V.sfx('pop', b + 2.35, { n: 8 });
    var px = 120 + cw / 2, py = 742;
    tl.fromTo('#cur5', { autoAlpha: 0, x: V.cx(1500), y: V.cy(930) }, { autoAlpha: 1, x: V.cx(px), y: V.cy(py), duration: 1.0, ease: 'power2.inOut', immediateRender: false }, b + 3.2);
    V.ripple('#rip5', px, py, b + 4.3); V.sfx('click', b + 4.3);
    tl.to('#cta', { y: 8, scale: .97, boxShadow: '0 2px 0 #05090F', duration: .08, ease: 'none' }, b + 4.3);
    tl.to('#cta', { y: 0, scale: 1.0, boxShadow: '0 10px 0 #05090F', duration: .2, ease: 'power2.out' }, b + 4.42);
    tl.to('#cta', { scale: 1.04, duration: .55, ease: 'sine.inOut', yoyo: true, repeat: 3 }, b + 4.9);
    V.sfx('ding', b + 4.4);
  });
})();
