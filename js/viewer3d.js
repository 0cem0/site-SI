/* ============================================================
   viewer3d.js — Visualisation 3D du tapis (Three.js)
   Le tapis tombe sur le sol, puis de petites voitures
   roulent le long de vos vraies routes.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var stage = $('#stage'), canvas = $('#gl');

  function fail(img) {
    $('#loader').classList.add('done');
    $('#nogl').hidden = false;
    if (img) $('#fallbackImg').src = img;
  }
  if (!window.THREE) { MR.ensureMat().then(function (m) { fail(m.img); }); return; }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) { MR.ensureMat().then(function (m) { fail(m.img); }); return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var BG = 0xF1EFEA;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 7, 20);
  var camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);

  /* ---------- Lumières ---------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d2c6, 0.8));
  var sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(2.6, 4.2, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  var sc = sun.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 0.5; sc.far = 12;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  /* ---------- Sol en parquet ---------- */
  function parquetTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 1024;
    var x = c.getContext('2d'), rh = 128, rows = 8;
    for (var r = 0; r < rows; r++) {
      var off = (r % 2) * 256, px = -off;
      while (px < 1024) {
        var l = 70 + Math.random() * 8, hue = 32 + Math.random() * 5;
        x.fillStyle = 'hsl(' + hue + ',42%,' + l + '%)';
        x.fillRect(px, r * rh, 512, rh);
        x.strokeStyle = 'rgba(120,85,45,.10)'; x.lineWidth = 1;
        for (var g = 0; g < 7; g++) {
          var gy = r * rh + 8 + Math.random() * (rh - 16);
          x.beginPath(); x.moveTo(px, gy); x.lineTo(px + 512, gy + (Math.random() - .5) * 6); x.stroke();
        }
        x.fillStyle = 'rgba(90,60,30,.35)'; x.fillRect(px, r * rh, 3, rh);
        px += 512;
      }
      x.fillStyle = 'rgba(90,60,30,.35)'; x.fillRect(0, r * rh, 1024, 3);
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: parquetTexture(), roughness: 0.85, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  /* ---------- Ombre douce sous le tapis ---------- */
  var shadowTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d');
    x.shadowColor = 'rgba(0,0,0,.85)'; x.shadowBlur = 30; x.shadowOffsetX = 1000;
    x.fillStyle = '#000'; x.fillRect(-1000 + 46, 46, 164, 164);
    return new THREE.CanvasTexture(c);
  })();
  var shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false }));
  shadowMesh.rotation.x = -Math.PI / 2; shadowMesh.position.y = 0.002; scene.add(shadowMesh);

  /* ---------- Tapis ---------- */
  var matGroup = new THREE.Group(); scene.add(matGroup);
  var texture = null, matMesh = null, dims = null;
  var T = 0.012;

  function buildMat() {
    if (matMesh) { matGroup.remove(matMesh); matMesh.geometry.dispose(); }
    dims = MR.SIZES[MR.state.size];
    var top = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.97, metalness: 0, bumpMap: texture, bumpScale: 0.5 });
    var side = new THREE.MeshStandardMaterial({ color: 0x8D9096, roughness: 1 });
    matMesh = new THREE.Mesh(new THREE.BoxGeometry(dims.w, T, dims.h), [side, side, top, side, side, side]);
    matMesh.position.y = T / 2; matMesh.castShadow = true; matMesh.receiveShadow = true;
    matGroup.add(matMesh);
    shadowMesh.scale.set(dims.w + 0.34, dims.h + 0.34, 1);
    $('#infoSize').textContent = 'Tapis ' + dims.label;
    $('#infoMat').textContent = MR.MATS[MR.state.mat].label + ' · ' + MR.euro(MR.total());
    $('#buy').textContent = 'Commander · ' + MR.euro(MR.total());
    buildCars();
  }

  /* ---------- Petites voitures ---------- */
  var cars = [], carsGroup = new THREE.Group(); scene.add(carsGroup);
  var rawPaths = null;
  var CAR_COLORS = [0xE04A3A, 0x2F72CC, 0xF2B01E, 0x5DA62E];

  function makeCar(color, u) {
    var g = new THREE.Group();
    var paint = new THREE.MeshStandardMaterial({ color: color, roughness: 0.45 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x1d2430, roughness: 0.8 });
    var glass = new THREE.MeshStandardMaterial({ color: 0xcfe9fb, roughness: 0.2 });
    var L = 0.062 * u, Wd = 0.034 * u, wr = 0.0065 * u;
    var body = new THREE.Mesh(new THREE.BoxGeometry(L, 0.012 * u, Wd), paint); body.position.y = wr + 0.005 * u;
    var cab = new THREE.Mesh(new THREE.BoxGeometry(L * 0.46, 0.011 * u, Wd * 0.86), glass); cab.position.set(-L * 0.04, wr + 0.0165 * u, 0);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(L * 0.4, 0.002 * u, Wd * 0.8), paint); roof.position.set(-L * 0.04, wr + 0.0225 * u, 0);
    [body, cab, roof].forEach(function (m) { m.castShadow = true; g.add(m); });
    var wg = new THREE.CylinderGeometry(wr, wr, 0.006 * u, 14); wg.rotateX(Math.PI / 2);
    [[0.3, 1], [0.3, -1], [-0.3, 1], [-0.3, -1]].forEach(function (p) {
      var w = new THREE.Mesh(wg, dark); w.position.set(p[0] * L, wr, p[1] * Wd * 0.5); w.castShadow = true; g.add(w);
    });
    return g;
  }

  function buildCars() {
    while (carsGroup.children.length) carsGroup.remove(carsGroup.children[0]);
    cars = [];
    var u = dims.w / 1.5, paths = (rawPaths && rawPaths.length) ? rawPaths : null;
    if (!paths) { // chemin de secours : un grand rectangle
      paths = [[[.12, .15], [.88, .15], [.88, .85], [.12, .85], [.12, .15]]];
    }
    paths.slice(0, 3).forEach(function (raw, idx) {
      var pts = raw.map(function (p) { return new THREE.Vector3((p[0] - 0.5) * dims.w, T, (p[1] - 0.5) * dims.h); });
      // lissage
      var sm = pts.map(function (p, i) {
        var a = new THREE.Vector3(), n = 0;
        for (var k = -3; k <= 3; k++) { var q = pts[i + k]; if (q) { a.add(q); n++; } }
        return a.multiplyScalar(1 / n);
      });
      var cum = [0];
      for (var i = 1; i < sm.length; i++) cum.push(cum[i - 1] + sm[i].distanceTo(sm[i - 1]));
      var L = cum[cum.length - 1];
      if (L < 0.2) return;
      var mesh = makeCar(CAR_COLORS[idx % CAR_COLORS.length], u);
      mesh.scale.setScalar(0.001);
      carsGroup.add(mesh);
      cars.push({ mesh: mesh, pts: sm, cum: cum, L: L, off: Math.random() * L, speed: 0.16 * u + idx * 0.02, ang: 0, born: 0 });
    });
  }
  function pointAt(c, d) {
    var lo = 0, hi = c.cum.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (c.cum[mid] <= d) lo = mid; else hi = mid; }
    var seg = c.cum[hi] - c.cum[lo] || 1, t = (d - c.cum[lo]) / seg;
    return new THREE.Vector3().lerpVectors(c.pts[lo], c.pts[hi], t);
  }
  function updateCars(time, dt) {
    carsGroup.visible = $('#tgCars').classList.contains('on');
    cars.forEach(function (c) {
      var s = c.off + time * c.speed, m = s % (2 * c.L), fwd = m < c.L, d = fwd ? m : 2 * c.L - m;
      var p = pointAt(c, d), look = pointAt(c, Math.max(0, Math.min(c.L, d + (fwd ? 0.03 : -0.03))));
      c.mesh.position.copy(p);
      var dx = look.x - p.x, dz = look.z - p.z;
      if (dx * dx + dz * dz > 1e-8) {
        var target = -Math.atan2(dz, dx), diff = ((target - c.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        c.ang += diff * Math.min(1, dt * 8); c.mesh.rotation.y = c.ang;
      }
      var k = Math.min(1, Math.max(0, (time - 1.6 - c.born) / 0.6));
      c.mesh.scale.setScalar(Math.max(0.001, k * (2 - k)));
    });
  }

  /* ---------- Caméra : orbite maison ---------- */
  var cam = { theta: 0.6, phi: 1.0, r: 3, ty: 0 };
  var goal = null, auto = true, lastTouch = -10, userMoved = false;

  function applyCam() {
    var sp = Math.sin(cam.phi);
    camera.position.set(cam.r * sp * Math.sin(cam.theta), cam.ty + cam.r * Math.cos(cam.phi), cam.r * sp * Math.cos(cam.theta));
    camera.lookAt(0, cam.ty, 0);
  }
  function fitR(f) {
    var asp = camera.aspect || 1, t = Math.tan(camera.fov * Math.PI / 360);
    return Math.max(dims.w * f / (2 * t * asp), dims.h * f / (2 * t)) ;
  }
  var views = {
    persp: function () { return { theta: 0.6, phi: 1.0, r: fitR(1.18) * 1.12 }; },
    top: function () { return { theta: 0, phi: 0.04, r: fitR(1.12) }; },
    child: function () { return { theta: -0.45, phi: 1.34, r: fitR(1.0) * 0.55 }; }
  };
  var currentView = 'persp';
  function goTo(name, ms) {
    currentView = name;
    var to = views[name]();
    if (MR.reduced()) { Object.assign(cam, to); applyCam(); return; }
    var from = { theta: cam.theta, phi: cam.phi, r: cam.r };
    // tourne par le chemin le plus court
    var dth = ((to.theta - from.theta + Math.PI * 3) % (Math.PI * 2)) - Math.PI; to.theta = from.theta + dth;
    goal = { from: from, to: to, t0: performance.now(), ms: ms || 1300 };
    document.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('on', b.dataset.view === name); });
  }
  function stepGoal(now) {
    if (!goal) return;
    var t = Math.min(1, (now - goal.t0) / goal.ms), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    cam.theta = goal.from.theta + (goal.to.theta - goal.from.theta) * e;
    cam.phi = goal.from.phi + (goal.to.phi - goal.from.phi) * e;
    cam.r = goal.from.r + (goal.to.r - goal.from.r) * e;
    if (t >= 1) goal = null;
  }

  // souris et doigts
  var pts = {}, lastD = 0;
  canvas.addEventListener('pointerdown', function (e) { canvas.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; goal = null; lastTouch = performance.now() / 1000; hideHint(); });
  canvas.addEventListener('pointermove', function (e) {
    var p = pts[e.pointerId]; if (!p) return;
    var ids = Object.keys(pts);
    if (ids.length === 1) {
      cam.theta -= (e.clientX - p.x) * 0.006;
      cam.phi = Math.min(1.5, Math.max(0.04, cam.phi - (e.clientY - p.y) * 0.005));
    } else if (ids.length === 2) {
      var o = pts[ids[0]] === p ? pts[ids[1]] : pts[ids[0]];
      var nd = Math.hypot(e.clientX - o.x, e.clientY - o.y);
      if (lastD) cam.r = Math.min(9, Math.max(0.35, cam.r * lastD / nd));
      lastD = nd;
    }
    p.x = e.clientX; p.y = e.clientY; lastTouch = performance.now() / 1000;
  });
  function up(e) { delete pts[e.pointerId]; lastD = 0; }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault(); goal = null; hideHint();
    cam.r = Math.min(9, Math.max(0.35, cam.r * Math.exp(e.deltaY * 0.0012))); lastTouch = performance.now() / 1000;
  }, { passive: false });
  function hideHint() { $('#hint').classList.add('hide'); }
  setTimeout(hideHint, 9000);

  /* ---------- Interface ---------- */
  document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { goTo(b.dataset.view); lastTouch = performance.now() / 1000 + 4; }); });
  function markSize() { document.querySelectorAll('[data-size]').forEach(function (b) { b.classList.toggle('on', b.dataset.size === MR.state.size); }); }
  document.querySelectorAll('[data-size]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (MR.state.size === b.dataset.size) return;
      MR.state.size = b.dataset.size; MR.save(); markSize(); buildMat();
      matGroup.scale.set(0.9, 1, 0.9); popStart = performance.now();
      goTo(currentView, 900);
    });
  });
  ['#tgAuto', '#tgCars'].forEach(function (s) {
    $(s).addEventListener('click', function () {
      var on = this.classList.toggle('on'); this.setAttribute('aria-pressed', on);
      if (s === '#tgAuto') auto = on;
    });
  });
  var popStart = 0;

  /* ---------- Taille et boucle ---------- */
  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (dims && !goal && !Object.keys(pts).length && !userMoved) { var to = views[currentView](); cam.r = to.r; }
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  resize();

  function bounce(t) {
    var n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + .75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + .9375;
    return n1 * (t -= 2.625 / d1) * t + .984375;
  }

  var t0 = performance.now(), prev = t0, introDone = false;
  function frame(now) {
    requestAnimationFrame(frame);
    var time = (now - t0) / 1000, dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    if (!texture) return;

    // chute du tapis
    var k = MR.reduced() ? 1 : Math.min(1, time / 1.5);
    var fall = 1 - bounce(k);
    matGroup.position.y = fall * 1.3;
    matGroup.rotation.x = fall * 0.5; matGroup.rotation.y = fall * 0.7;
    var ps = (now - popStart) / 400;
    if (ps < 1) { var s = 0.9 + 0.1 * (1 - Math.pow(1 - ps, 3)); matGroup.scale.set(s, 1, s); } else matGroup.scale.set(1, 1, 1);
    shadowMesh.material.opacity = 0.5 * Math.min(1, k * 1.3) * (1 - fall * 0.6);
    if (!introDone && k >= 1) introDone = true;

    stepGoal(now);
    if (auto && !goal && (now / 1000 - lastTouch) > 2.5 && !Object.keys(pts).length) cam.theta += dt * 0.12;
    carsGroup.position.copy(matGroup.position);
    updateCars(time, dt);
    applyCam();
    renderer.render(scene, camera);
  }

  /* ---------- Démarrage ---------- */
  markSize();
  MR.ensureMat(function (p, txt) { $('#loaderTxt').textContent = txt; }).then(function (m) {
    rawPaths = m.paths;
    var img = new Image();
    img.onload = function () {
      texture = new THREE.Texture(img);
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      buildMat();
      var to = views.persp(); cam.theta = 0.6 + 1.2; cam.phi = 0.9; cam.r = to.r * 1.5;
      goTo('persp', 2200);
      t0 = performance.now();
      setTimeout(function () { $('#loader').classList.add('done'); }, 150);
    };
    img.onerror = function () { fail(m.img); };
    img.src = m.img;
  });
  requestAnimationFrame(frame);
})();
