/* ============================================================
   creer.js — Import de la capture, génération du tapis, options
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var W = 1500, H = 1000;

  var origC = $('#origC'), matC = $('#matC'), compare = $('#compare'), slider = $('#slider');
  var clsC = $('#clsC'), palette = {}, pickKey = null, lastCls = null;
  var srcCanvas = document.createElement('canvas');   // capture recadrée en 3:2
  var label = 'Exemple', isSample = true, busy = false, pending = false, debounce = null;

  /* ---------- Options taille / matière ---------- */
  function buildOpts(host, data, key, name) {
    host.innerHTML = '';
    Object.keys(data).forEach(function (k) {
      var d = data[k], id = name + '_' + k, w = document.createElement('div');
      w.className = 'opt';
      var price = name === 'mat' ? (d.price ? '+ ' + MR.euro(d.price) : 'Inclus') : MR.euro(d.price);
      w.innerHTML = '<input type="radio" name="' + name + '" id="' + id + '" value="' + k + '"' + (MR.state[key] === k ? ' checked' : '') + '>' +
        '<label for="' + id + '"><span><b>' + d.label + '</b><small>' + d.sub + '</small></span><span class="p">' + price + '</span></label>';
      w.querySelector('input').addEventListener('change', function () { MR.state[key] = k; MR.save(); refresh(); });
      host.appendChild(w);
    });
  }
  function refresh() {
    var s = MR.SIZES[MR.state.size], m = MR.MATS[MR.state.mat];
    $('#sumSize').textContent = 'Tapis ' + s.label; $('#sumSizeP').textContent = MR.euro(s.price);
    $('#sumMat').textContent = m.label; $('#sumMatP').textContent = m.price ? MR.euro(m.price) : 'Inclus';
    $('#total').textContent = MR.euro(MR.total());
  }
  buildOpts($('#sizes'), MR.SIZES, 'size', 'size');
  buildOpts($('#mats'), MR.MATS, 'mat', 'mat');
  refresh();

  /* ---------- Curseurs de style ---------- */
  var words = ['Aucun', 'Très peu', 'Peu', 'Un peu moins', 'Normal', 'Un peu plus', 'Beaucoup', 'Énormément', 'Maximum'];
  function sliderLabel(v) { return words[Math.round(v * 4)]; }
  ['houses', 'trees'].forEach(function (k) {
    var el = $('#' + k), out = $('#' + k + 'Out');
    el.value = MR.state[k]; out.textContent = sliderLabel(+el.value);
    el.addEventListener('input', function () {
      MR.state[k] = +el.value; out.textContent = sliderLabel(+el.value); MR.save();
      clearTimeout(debounce); debounce = setTimeout(function () { run(true); }, 350);
    });
  });
  $('#reroll').addEventListener('click', function () { MR.state.seed = (MR.state.seed % 9999) + 1; MR.save(); run(true); });

  /* ---------- Comparateur ---------- */
  function setPos(v) { compare.style.setProperty('--pos', v + '%'); slider.value = v; }
  slider.addEventListener('input', function () { setPos(slider.value); });
  function reveal() {
    if (MR.reduced()) { setPos(50); return; }
    var s = performance.now();
    (function f(now) {
      var t = Math.min(1, (now - s) / 1300), e = 1 - Math.pow(1 - t, 3);
      setPos(100 - 50 * e);
      if (t < 1) requestAnimationFrame(f);
    })(s);
  }

  /* ---------- Chargement d'une capture ---------- */
  function coverInto(canvas, src, sw, sh) {
    canvas.width = W; canvas.height = H;
    var c = canvas.getContext('2d'), s = Math.max(W / sw, H / sh), dw = sw * s, dh = sh * s;
    c.imageSmoothingQuality = 'high';
    c.fillStyle = '#f5f5f5'; c.fillRect(0, 0, W, H);
    c.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  function showOrig() {
    origC.width = W; origC.height = H;
    origC.getContext('2d').drawImage(srcCanvas, 0, 0);
  }
  function setStatus(html) { $('#status').innerHTML = html; }
  var PK_DEFAULT = { road: '#FFFFFF', park: '#CBE8C8', water: '#AADAFF', building: '#E9E6E0', land: '#F5F5F5' };
  function resetPalette() {
    palette = {};
    document.querySelectorAll('.pk').forEach(function (b) { b.querySelector('i').style.background = PK_DEFAULT[b.dataset.k]; });
    if (pickKey) setPick(pickKey);
  }

  function useSample() {
    Sample.draw(srcCanvas, W, H); showOrig();
    label = 'Exemple'; isSample = true; resetPalette();
    setStatus('<i></i><span>Exemple affiché. Importez votre propre capture pour la remplacer.</span>');
    run(false);
  }
  function useFile(file) {
    if (!file || !/^image\//.test(file.type)) {
      setStatus('<i style="background:var(--danger)"></i><span style="color:var(--danger)">Ce fichier n\'est pas une image. Importez un PNG ou un JPG.</span>'); return;
    }
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      coverInto(srcCanvas, im, im.naturalWidth, im.naturalHeight); showOrig(); URL.revokeObjectURL(url);
      label = file.name || 'Capture collée'; isSample = false; resetPalette();
      setStatus('<i style="background:var(--ok)"></i><span>' + MR.esc(label) + '</span><button class="lnk" id="backSample" type="button">Revoir l\'exemple</button>');
      $('#backSample').addEventListener('click', useSample);
      run(false);
    };
    im.onerror = function () { setStatus('<i style="background:var(--danger)"></i><span style="color:var(--danger)">Impossible de lire cette image.</span>'); };
    im.src = url;
  }

  var drop = $('#drop'), file = $('#file');
  drop.addEventListener('click', function () { file.click(); });
  file.addEventListener('change', function () { useFile(file.files[0]); file.value = ''; });
  ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (ev) { useFile(ev.dataTransfer.files[0]); });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files[0]) useFile(e.dataTransfer.files[0]); });
  window.addEventListener('paste', function (e) {
    var items = (e.clipboardData || {}).items || [];
    for (var i = 0; i < items.length; i++) if (items[i].type.indexOf('image') === 0) { useFile(items[i].getAsFile()); break; }
  });


  /* ---------- Pipette : corriger la détection à la main ---------- */
  function paintCls() {
    if (!lastCls) return;
    clsC.width = lastCls.width; clsC.height = lastCls.height;
    clsC.getContext('2d').drawImage(lastCls, 0, 0);
  }
  var pickBtns = document.querySelectorAll('.pk');
  function setPick(k) {
    var wasOn = !!pickKey;
    pickKey = (pickKey === k) ? null : k;
    pickBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.k === pickKey ? 'true' : 'false'); });
    compare.classList.toggle('picking', !!pickKey);
    if (pickKey) {
      compare.classList.remove('show-cls'); $('#viewCls').textContent = 'Voir ce que le générateur a compris';
      setPos(100);
    } else if (wasOn) reveal();
  }
  pickBtns.forEach(function (b) { b.addEventListener('click', function () { setPick(b.dataset.k); }); });
  compare.addEventListener('click', function (e) {
    if (!pickKey || busy) return;
    var rect = compare.getBoundingClientRect();
    var fx = Math.round((e.clientX - rect.left) / rect.width * W), fy = Math.round((e.clientY - rect.top) / rect.height * H);
    var d = srcCanvas.getContext('2d').getImageData(Math.max(0, fx - 1), Math.max(0, fy - 1), 3, 3).data, r = 0, g = 0, b = 0, m = d.length / 4;
    for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    var col = [Math.round(r / m), Math.round(g / m), Math.round(b / m)];
    (palette[pickKey] = palette[pickKey] || []).push(col);
    if (palette[pickKey].length > 8) palette[pickKey].shift();
    var sw = document.querySelector('.pk[data-k="' + pickKey + '"] i');
    if (sw) sw.style.background = 'rgb(' + col.join(',') + ')';
    clearTimeout(debounce); debounce = setTimeout(function () { run(true); }, 250);
  });
  $('#viewCls').addEventListener('click', function () {
    var on = compare.classList.toggle('show-cls');
    this.textContent = on ? 'Revenir au tapis' : 'Voir ce que le générateur a compris';
    if (on) { paintCls(); if (pickKey) setPick(pickKey); }
  });
  $('#resetPal').addEventListener('click', function () { resetPalette(); run(true); });

  /* ---------- Génération ---------- */
  function setBusy(on) {
    $('#busy').classList.toggle('on', on);
    ['#go3d', '#order'].forEach(function (s) { $(s).classList.toggle('disabled', on); });
  }
  function setProgress(p, txt) {
    $('#barI').style.width = (p * 100) + '%';
    $('#bcar').style.left = (p * 100) + '%';
    $('#busyTxt').textContent = txt;
  }

  async function run(quick) {
    if (busy) { pending = true; return; }
    busy = true; pending = false;
    setBusy(true); setProgress(0.02, 'Lecture de la carte');
    if (!quick) setPos(100);
    var res;
    try {
      res = await MatGen.generate(srcCanvas, { seed: MR.state.seed, houses: MR.state.houses, trees: MR.state.trees, palette: palette, onProgress: setProgress });
    } catch (err) {
      console.error(err); busy = false; setBusy(false);
      setStatus('<i style="background:var(--danger)"></i><span style="color:var(--danger)">La génération a échoué. Essayez une autre image.</span>'); return;
    }
    matC.width = res.canvas.width; matC.height = res.canvas.height;
    matC.getContext('2d').drawImage(res.canvas, 0, 0);
    lastCls = res.classCanvas; paintCls();
    await MR.sleep(350);
    setBusy(false); busy = false;
    reveal();
    showStats(res.stats);

    // mémorise pour les pages suivantes (3D et paiement)
    var thumb = document.createElement('canvas'); thumb.width = 600; thumb.height = 400;
    thumb.getContext('2d').drawImage(srcCanvas, 0, 0, 600, 400);
    var ok = MR.setMat(res.canvas.toDataURL('image/jpeg', 0.86), thumb.toDataURL('image/jpeg', 0.75), res.paths, isSample);
    if (!ok) MR.setMat(res.canvas.toDataURL('image/jpeg', 0.7), null, res.paths, isSample);
    if (pending) run(true);
  }

  function showStats(st) {
    MR.countUp($('#stRoad'), Math.round(st.roadPct * 100), 800);
    MR.countUp($('#stHouses'), st.houses, 800);
    MR.countUp($('#stTrees'), st.trees, 900);
    MR.countUp($('#stPads'), st.pads.length, 700);
    var al = $('#alert');
    if (st.suspicious) {
      al.hidden = false;
      al.textContent = st.roadPct < 0.02
        ? 'Très peu de routes détectées. Utilisez la vue plan de Google Maps (pas la vue satellite), ou corrigez les couleurs ci-dessous.'
        : 'La détection semble incorrecte. Ouvrez « Corriger les couleurs », puis cliquez sur une route, un parc et l\'eau dans la capture.';
      $('#fix').open = true;
    } else al.hidden = true;
  }

  /* ---------- Démarrage : reprend la dernière capture ou l'exemple ---------- */
  var saved = MR.getMat();
  if (saved.img && saved.orig && !saved.isSample) {
    var o = new Image();
    o.onload = function () {
      coverInto(srcCanvas, o, o.naturalWidth, o.naturalHeight); showOrig();
      label = 'Votre dernière capture'; isSample = false;
      setStatus('<i style="background:var(--ok)"></i><span>Votre dernière capture</span><button class="lnk" id="backSample" type="button">Revoir l\'exemple</button>');
      $('#backSample').addEventListener('click', useSample);
      run(false);
    };
    o.onerror = useSample;
    o.src = saved.orig;
  } else useSample();
})();
