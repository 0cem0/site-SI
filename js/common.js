/* ============================================================
   common.js — Code partagé par toutes les pages
   (tarifs, mémoire entre les pages, en-tête, pied de page, animations)
   ============================================================ */
(function () {
  'use strict';
  var MR = window.MR = window.MR || {};

  /* ---------- Catalogue ---------- */
  MR.SIZES = {
    a: { label: '120 × 80 cm', w: 1.2, h: 0.8, price: 49, sub: 'Idéal pour une chambre' },
    b: { label: '150 × 100 cm', w: 1.5, h: 1.0, price: 69, sub: 'Le plus choisi' },
    c: { label: '180 × 120 cm', w: 1.8, h: 1.2, price: 89, sub: 'Pour une salle de jeux' }
  };
  MR.MATS = {
    tissu: { label: 'Tissu doux', price: 0, sub: 'Feutre épais, toucher laine' },
    mousse: { label: 'Mousse lavable', price: 10, sub: 'Antidérapant, essuyable' }
  };

  /* ---------- Mémoire entre les pages (navigateur) ---------- */
  var K = { state: 'minirue.state', mat: 'minirue.mat', orig: 'minirue.orig', paths: 'minirue.paths', isSample: 'minirue.isSample', sample: 'minirue.sample', samplePaths: 'minirue.samplePaths' };
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  MR.state = { size: 'b', mat: 'tissu', houses: 1, trees: 1, seed: 1 };
  try { Object.assign(MR.state, JSON.parse(get(K.state) || '{}')); } catch (e) {}
  if (!MR.SIZES[MR.state.size]) MR.state.size = 'b';
  if (!MR.MATS[MR.state.mat]) MR.state.mat = 'tissu';
  MR.save = function () { set(K.state, JSON.stringify(MR.state)); };
  MR.total = function () { return MR.SIZES[MR.state.size].price + MR.MATS[MR.state.mat].price; };
  MR.euro = function (n) { return n + ' €'; };

  MR.getMat = function () {
    var p = null; try { p = JSON.parse(get(K.paths) || 'null'); } catch (e) {}
    return { img: get(K.mat), orig: get(K.orig), paths: p, isSample: get(K.isSample) === '1' };
  };
  MR.setMat = function (img, orig, paths, isSample) {
    var ok = set(K.mat, img);
    if (orig) set(K.orig, orig);
    set(K.paths, JSON.stringify(paths || []));
    set(K.isSample, isSample ? '1' : '0');
    return ok;
  };

  /* Tapis d'exemple (généré une seule fois puis mémorisé) */
  MR.sampleMat = function (onProgress) {
    var img = get(K.sample), p = null;
    try { p = JSON.parse(get(K.samplePaths) || 'null'); } catch (e) {}
    if (img && p) return Promise.resolve({ img: img, paths: p });
    var c = document.createElement('canvas'); Sample.draw(c, 1500, 1000);
    return MatGen.generate(c, { seed: 3, onProgress: onProgress }).then(function (res) {
      var d = res.canvas.toDataURL('image/jpeg', 0.86);
      set(K.sample, d); set(K.samplePaths, JSON.stringify(res.paths));
      return { img: d, paths: res.paths };
    });
  };
  /* Garantit qu'il existe un tapis (sinon prend l'exemple) */
  MR.ensureMat = function (onProgress) {
    var m = MR.getMat();
    if (m.img) return Promise.resolve(m);
    return MR.sampleMat(onProgress).then(function (s) {
      MR.setMat(s.img, null, s.paths, true);
      return MR.getMat();
    });
  };

  /* ---------- Petits outils ---------- */
  MR.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  MR.reduced = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  MR.countUp = function (el, to, ms) {
    if (!el) return;
    if (MR.reduced()) { el.textContent = to; return; }
    var s = performance.now();
    (function f(now) {
      var t = Math.min(1, (now - s) / (ms || 900));
      el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(f);
    })(s);
  };
  MR.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- En-tête et pied de page ---------- */
  var LOGO = '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#5DA62E"/><rect x="12" y="0" width="8" height="32" fill="#8A8E94"/><path d="M16 2v28" stroke="#FFC83D" stroke-width="2" stroke-dasharray="4 3"/><rect x="3" y="5" width="7" height="8" rx="1.5" fill="#E04A3A"/><rect x="22" y="19" width="7" height="8" rx="1.5" fill="#2F72CC"/></svg>';

  function mountChrome() {
    var page = document.body.getAttribute('data-page') || '';
    var h = document.getElementById('site-header');
    if (h) {
      var links = [['index.html', 'Accueil', 'home'], ['index.html#video', 'Vidéo', 'video'], ['creer.html', 'Créer', 'creer'], ['visualiser.html', 'Voir en 3D', 'viewer'], ['paiement.html', 'Commander', 'pay']];
      h.innerHTML = '<header class="site"><div class="container bar">' +
        '<a class="logo" href="index.html" aria-label="Minirue, accueil">' + LOGO + '<span>Minirue</span></a>' +
        '<nav class="links" id="nav" aria-label="Navigation principale">' +
        links.map(function (l) { return '<a href="' + l[0] + '"' + (l[2] === page ? ' aria-current="page"' : '') + '>' + l[1] + '</a>'; }).join('') +
        '</nav>' +
        '<a class="btn btn-primary btn-sm cta-head" href="creer.html">Créer mon tapis</a>' +
        '<button class="burger" id="burger" aria-label="Ouvrir le menu" aria-expanded="false"><span></span><span></span></button>' +
        '</div></header>';
      var b = document.getElementById('burger'), nav = document.getElementById('nav');
      b.addEventListener('click', function () {
        var open = nav.classList.toggle('open'); b.setAttribute('aria-expanded', open);
      });
      var onScroll = function () { h.firstChild.classList.toggle('scrolled', window.scrollY > 8); };
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }
    var f = document.getElementById('site-footer');
    if (f) {
      f.innerHTML = '<footer class="site"><div class="container foot">' +
        '<div><a class="logo" href="index.html">' + LOGO + '<span>Minirue</span></a>' +
        '<p>Transformez votre rue en terrain de jeu.</p></div>' +
        '<div class="foot-links"><a href="index.html#video">Vidéo</a><a href="creer.html">Créer mon tapis</a><a href="visualiser.html">Voir en 3D</a><a href="paiement.html">Commander</a></div>' +
        '<p class="demo-note">Site de démonstration : la génération du tapis est simulée dans votre navigateur et le paiement est factice. Aucune image ni donnée n\'est envoyée.</p>' +
        '</div></footer>';
    }
  }

  /* ---------- Apparition au défilement ---------- */
  function setupReveal() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window) || MR.reduced()) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- Titre animé mot par mot ---------- */
  MR.splitWords = function (el) {
    if (!el || MR.reduced()) return;
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w, i) { return '<span class="w" style="--i:' + i + '"><span>' + MR.esc(w) + '</span></span>'; }).join(' ');
  };

  document.addEventListener('DOMContentLoaded', function () { mountChrome(); setupReveal(); });
})();
