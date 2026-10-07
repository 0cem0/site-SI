/* ============================================================
   home.js — Animations de la page d'accueil
   ============================================================ */
(function () {
  'use strict';

  MR.splitWords(document.getElementById('h1'));

  var card = document.getElementById('heroCard');
  var mapC = document.getElementById('heroMap');
  var matC = document.getElementById('heroMat');
  var skel = document.getElementById('heroSkel');
  var chipL = document.getElementById('chipL');
  var chipR = document.getElementById('chipR');

  // La capture d'exemple s'affiche tout de suite
  Sample.draw(mapC, 1500, 1000);
  card.style.setProperty('--pos', '100%');

  // Le tapis d'exemple est généré une fois, puis mémorisé
  MR.sampleMat().then(function (s) {
    var img = new Image();
    img.onload = function () {
      matC.width = img.naturalWidth; matC.height = img.naturalHeight;
      matC.getContext('2d').drawImage(img, 0, 0);
      skel.classList.add('done');
      document.getElementById('tiltImg').src = s.img;
      startWipe();
    };
    img.src = s.img;
  });

  /* ---- Balayage automatique : capture -> tapis ---- */
  function setPos(p) {
    card.style.setProperty('--pos', p + '%');
    chipL.style.opacity = p > 22 ? 1 : 0;
    chipR.style.opacity = p < 78 ? 1 : 0;
  }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function startWipe() {
    if (MR.reduced()) { setPos(0); return; }
    var steps = [
      { to: 100, ms: 1100, hold: 0 },
      { to: 0, ms: 2000, hold: 3000 },
      { to: 100, ms: 1400, hold: 1200 }
    ];
    var i = 0, from = 100;
    (function next() {
      var st = steps[i % steps.length], start = performance.now();
      (function f(now) {
        var t = Math.min(1, (now - start) / st.ms);
        setPos(from + (st.to - from) * ease(t));
        if (t < 1) return requestAnimationFrame(f);
        from = st.to; i++;
        setTimeout(next, st.hold);
      })(start);
    })();
  }

  /* ---- Tapis en perspective qui suit la souris ---- */
  var wrap = document.getElementById('tiltWrap'), tilt = document.getElementById('tilt');
  if (wrap && !MR.reduced()) {
    wrap.addEventListener('pointermove', function (e) {
      var r = wrap.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      tilt.style.setProperty('--rz', (-24 + px * 22) + 'deg');
      tilt.style.setProperty('--rx', (52 - py * 14) + 'deg');
    });
    wrap.addEventListener('pointerleave', function () {
      tilt.style.setProperty('--rz', '-24deg'); tilt.style.setProperty('--rx', '52deg');
    });
  }
})();
