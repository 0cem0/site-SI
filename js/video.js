/* ============================================================
   video.js — Lecteur de la vidéo de présentation (page d'accueil)
   Lecture/pause, barre de progression, son, plein écran, chapitres,
   écran de fin, pause automatique quand on quitte la section.
   ============================================================ */
(function () {
  'use strict';
  var player = document.getElementById('player'), vid = document.getElementById('vid');
  if (!player || !vid) return;

  var $ = function (id) { return document.getElementById(id); };
  var bigPlay = $('bigPlay'), pp = $('pp'), seek = $('seek'), fill = $('seekFill'), buf = $('seekBuf'), knob = $('seekKnob'),
    tip = $('seekTip'), tm = $('time'), muteB = $('mute'), fsB = $('fs'), replay = $('replay');
  var chBtns = [].slice.call(document.querySelectorAll('#chapters .chapter'));
  var DUR = 49, started = false, idleT = 0, raf = 0, dragging = false, ignoreUntil = 0, lastSec = -1;

  // JavaScript actif : on remplace les commandes natives par les nôtres
  vid.controls = false;
  vid.removeAttribute('controls');

  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function fmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function dur() { return isFinite(vid.duration) && vid.duration > 1 ? vid.duration : DUR; }
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }

  /* ---- repères de chapitres sur la barre ---- */
  var chapters = chBtns.map(function (b) { return { t: parseFloat(b.getAttribute('data-t')), btn: b }; });
  chapters.forEach(function (c) {
    var i = document.createElement('i'); i.className = 'tick'; i.style.left = (c.t / DUR * 100) + '%';
    seek.insertBefore(i, knob);
  });

  /* ---- lecture ---- */
  function play() {
    if (vid.ended) vid.currentTime = 0;
    var p = vid.play();
    if (p && p.catch) p.catch(function () { /* lecture refusée par le navigateur */ });
  }
  function toggle() { if (vid.paused || vid.ended) play(); else vid.pause(); }
  function seekTo(t, andPlay) {
    vid.currentTime = clamp(t, 0, dur() - .05);
    update(true);
    if (andPlay && vid.paused) play();
  }

  /* ---- affichage ---- */
  function update(force) {
    var d = dur(), t = vid.currentTime || 0, p = clamp(t / d, 0, 1);
    fill.style.transform = 'scaleX(' + p + ')';
    knob.style.left = (p * 100) + '%';
    var sec = Math.floor(t);
    if (force || sec !== lastSec) {
      lastSec = sec;
      tm.textContent = fmt(t) + ' / ' + fmt(d);
      seek.setAttribute('aria-valuenow', sec);
      seek.setAttribute('aria-valuetext', fmt(t) + ' sur ' + fmt(d));
    }
    var cur = -1;
    chapters.forEach(function (c, i) { if (t >= c.t - .02) cur = i; });
    chapters.forEach(function (c, i) {
      var end = i < chapters.length - 1 ? chapters[i + 1].t : d, q = 0;
      if (i < cur) q = 1; else if (i === cur) q = clamp((t - c.t) / (end - c.t), 0, 1);
      c.btn.classList.toggle('on', i === cur);
      c.btn.classList.toggle('done', i < cur);
      c.btn.style.setProperty('--p', i === cur ? q.toFixed(3) : '0');
      if (i === cur) c.btn.setAttribute('aria-current', 'true'); else c.btn.removeAttribute('aria-current');
    });
  }
  function loop() { update(); if (!vid.paused && !vid.ended) raf = requestAnimationFrame(loop); }
  function showBuffer() {
    try { if (vid.buffered.length) buf.style.transform = 'scaleX(' + clamp(vid.buffered.end(vid.buffered.length - 1) / dur(), 0, 1) + ')'; } catch (e) { }
  }

  /* ---- état du lecteur ---- */
  function wake() {
    player.classList.remove('idle');
    clearTimeout(idleT);
    if (!vid.paused) idleT = setTimeout(function () { if (!seek.matches(':hover') && !player.querySelector('.ctrl:hover')) player.classList.add('idle'); }, 2600);
  }
  vid.addEventListener('play', function () {
    started = true; player.classList.add('started', 'playing'); player.classList.remove('ended');
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); wake();
    pp.setAttribute('aria-label', 'Pause'); bigPlay.setAttribute('aria-label', 'Reprendre la vidéo');
  });
  vid.addEventListener('pause', function () {
    player.classList.remove('playing', 'idle'); clearTimeout(idleT); update(true);
    pp.setAttribute('aria-label', 'Lecture');
  });
  vid.addEventListener('ended', function () {
    player.classList.remove('playing', 'idle'); player.classList.add('ended'); update(true);
    pp.setAttribute('aria-label', 'Revoir la vidéo');
  });
  vid.addEventListener('seeking', function () { player.classList.remove('ended'); update(true); });
  vid.addEventListener('timeupdate', function () { if (vid.paused) update(); });
  vid.addEventListener('progress', showBuffer);
  vid.addEventListener('loadedmetadata', function () { update(true); showBuffer(); });
  vid.addEventListener('volumechange', function () {
    player.classList.toggle('muted', vid.muted || vid.volume === 0);
    muteB.setAttribute('aria-pressed', vid.muted ? 'true' : 'false');
    muteB.setAttribute('aria-label', vid.muted ? 'Activer le son' : 'Couper le son');
  });
  // si aucune source ne peut être lue, on propose le téléchargement
  var srcs = vid.querySelectorAll('source');
  if (srcs.length) srcs[srcs.length - 1].addEventListener('error', function () { player.classList.add('error'); });
  vid.addEventListener('error', function () { if (!vid.currentSrc) player.classList.add('error'); });

  /* ---- boutons ---- */
  bigPlay.addEventListener('click', function () { toggle(); });
  pp.addEventListener('click', function () { toggle(); });
  vid.addEventListener('click', function () { toggle(); });
  replay.addEventListener('click', function () { vid.currentTime = 0; play(); });
  muteB.addEventListener('click', function () { vid.muted = !vid.muted; if (!vid.muted && vid.volume === 0) vid.volume = 1; });

  function toggleFs() {
    if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (player.requestFullscreen) player.requestFullscreen();
    else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
    else if (vid.webkitEnterFullscreen) vid.webkitEnterFullscreen();   // iPhone
  }
  var canFs = document.fullscreenEnabled || document.webkitFullscreenEnabled || vid.webkitEnterFullscreen;
  if (!canFs) fsB.hidden = true;
  fsB.addEventListener('click', toggleFs);
  function onFs() {
    var on = fsEl() === player;
    player.classList.toggle('is-fs', on);
    fsB.setAttribute('aria-label', on ? 'Quitter le plein écran' : 'Plein écran');
  }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);
  vid.addEventListener('dblclick', toggleFs);

  /* ---- barre de progression (souris, doigt, clavier) ---- */
  function timeAt(e) { var r = seek.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * dur(); }
  function tipAt(e) {
    var r = seek.getBoundingClientRect(), x = clamp(e.clientX - r.left, 0, r.width);
    tip.style.left = clamp(x, 28, r.width - 28) + 'px'; tip.textContent = fmt(x / r.width * dur());
  }
  seek.addEventListener('pointerdown', function (e) {
    dragging = true; seek.classList.add('drag'); try { seek.setPointerCapture(e.pointerId); } catch (x) { }
    tipAt(e); seekTo(timeAt(e)); wake();
  });
  seek.addEventListener('pointermove', function (e) { tipAt(e); if (dragging) seekTo(timeAt(e)); });
  function endDrag() { dragging = false; seek.classList.remove('drag'); }
  seek.addEventListener('pointerup', endDrag);
  seek.addEventListener('pointercancel', endDrag);
  seek.addEventListener('keydown', function (e) {
    var k = e.key, t = vid.currentTime, d = dur(), n = null;
    if (k === 'ArrowRight' || k === 'ArrowUp') n = t + 5;
    else if (k === 'ArrowLeft' || k === 'ArrowDown') n = t - 5;
    else if (k === 'Home') n = 0; else if (k === 'End') n = d - .1;
    if (n !== null) { e.preventDefault(); e.stopPropagation(); seekTo(n); }
  });

  /* ---- chapitres ---- */
  chapters.forEach(function (c) {
    c.btn.addEventListener('click', function () {
      ignoreUntil = Date.now() + 1500;
      var r = player.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight) player.scrollIntoView({ behavior: MR.reduced() ? 'auto' : 'smooth', block: 'center' });
      seekTo(c.t, true);
    });
  });

  /* ---- clavier sur le lecteur ---- */
  player.addEventListener('keydown', function (e) {
    if (e.target !== player && e.target !== vid) return;      // les boutons gardent leur comportement
    var k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'm') { vid.muted = !vid.muted; }
    else if (k === 'f') { toggleFs(); }
    else if (k === 'arrowright') { e.preventDefault(); seekTo(vid.currentTime + 5); }
    else if (k === 'arrowleft') { e.preventDefault(); seekTo(vid.currentTime - 5); }
  });

  /* ---- affichage / masquage des commandes ---- */
  ['pointermove', 'pointerdown', 'focusin', 'touchstart'].forEach(function (ev) { player.addEventListener(ev, wake, { passive: true }); });
  player.addEventListener('pointerleave', function () { if (!vid.paused) idleT = setTimeout(function () { player.classList.add('idle'); }, 700); });

  /* ---- boutons « Regarder la vidéo » ailleurs sur la page ---- */
  [].forEach.call(document.querySelectorAll('[data-play-video]'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      ignoreUntil = Date.now() + 2000;
      player.scrollIntoView({ behavior: MR.reduced() ? 'auto' : 'smooth', block: 'center' });
      if (vid.paused) play();
      try { history.replaceState(null, '', '#video'); } catch (x) { }
    });
  });

  /* ---- pause quand on quitte la section ou l'onglet ---- */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting && !vid.paused && !fsEl() && Date.now() > ignoreUntil) vid.pause();
    }, { threshold: 0.12 }).observe(player);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden && !vid.paused) vid.pause(); });

  update(true);
  player.classList.add('ready');
})();
