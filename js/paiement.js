/* ============================================================
   paiement.js — Formulaire de paiement SIMULÉ et confirmation
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  /* ---------- Récapitulatif ---------- */
  function buildOpts(host, data, key, name) {
    host.innerHTML = '';
    Object.keys(data).forEach(function (k) {
      var d = data[k], id = name + '_' + k, w = document.createElement('div');
      w.className = 'opt';
      var price = name === 'mat' ? (d.price ? '+ ' + MR.euro(d.price) : 'Inclus') : MR.euro(d.price);
      w.innerHTML = '<input type="radio" name="' + name + '" id="' + id + '" value="' + k + '"' + (MR.state[key] === k ? ' checked' : '') + '>' +
        '<label for="' + id + '"><span><b>' + d.label + '</b></span><span class="p">' + price + '</span></label>';
      w.querySelector('input').addEventListener('change', function () { MR.state[key] = k; MR.save(); refresh(); });
      host.appendChild(w);
    });
  }
  function refresh() {
    var s = MR.SIZES[MR.state.size], m = MR.MATS[MR.state.mat];
    $('#sumSize').textContent = 'Tapis ' + s.label; $('#sumSizeP').textContent = MR.euro(s.price);
    $('#sumMat').textContent = m.label; $('#sumMatP').textContent = m.price ? MR.euro(m.price) : 'Inclus';
    $('#total').textContent = MR.euro(MR.total());
    $('#pay').textContent = 'Payer ' + MR.euro(MR.total());
    var t = $('#total'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = 'pop .35s var(--ease)';
  }
  buildOpts($('#sizes'), MR.SIZES, 'size', 'size');
  buildOpts($('#mats'), MR.MATS, 'mat', 'mat');
  refresh();
  MR.ensureMat().then(function (m) { $('#thumb').src = m.img; });

  /* ---------- Saisie ---------- */
  function digits(s) { return s.replace(/\D/g, ''); }
  $('#fCard').addEventListener('input', function (e) {
    e.target.value = digits(e.target.value).slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    $('#cvNum').textContent = (e.target.value + '•••• •••• •••• ••••'.slice(e.target.value.length)).slice(0, 19);
  });
  $('#fExp').addEventListener('input', function (e) {
    var v = digits(e.target.value).slice(0, 4);
    e.target.value = v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v;
    $('#cvExp').textContent = e.target.value || 'MM/AA';
  });
  $('#fCvc').addEventListener('input', function (e) { e.target.value = digits(e.target.value).slice(0, 3); });
  $('#fZip').addEventListener('input', function (e) { e.target.value = digits(e.target.value).slice(0, 5); });
  $('#fName').addEventListener('input', function (e) { $('#cvName').textContent = e.target.value.toUpperCase() || 'NOM PRÉNOM'; });

  $('#fillTest').addEventListener('click', function () {
    var v = { fName: 'Camille Martin', fMail: 'camille.martin@example.fr', fAddr: '12 rue des Lilas', fZip: '75011', fCity: 'Paris', fCard: '4242 4242 4242 4242', fExp: '12/29', fCvc: '123' };
    Object.keys(v).forEach(function (k) { var el = $('#' + k); el.value = v[k]; el.dispatchEvent(new Event('input')); });
    document.querySelectorAll('.field').forEach(function (f) { f.classList.remove('bad'); });
  });

  /* ---------- Validation ---------- */
  function check(id, ok, msg) {
    var f = $('#' + id).closest('.field');
    f.classList.toggle('bad', !ok);
    if (!ok) f.querySelector('.err').textContent = msg;
    return ok;
  }
  function validate() {
    var rows = [
      ['fName', $('#fName').value.trim().length >= 3, 'Entrez votre prénom et votre nom.'],
      ['fMail', /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test($('#fMail').value.trim()), 'Entrez une adresse e-mail valide.'],
      ['fAddr', $('#fAddr').value.trim().length >= 5, 'Entrez votre adresse de livraison.'],
      ['fZip', digits($('#fZip').value).length === 5, 'Le code postal comporte 5 chiffres.'],
      ['fCity', $('#fCity').value.trim().length >= 2, 'Entrez votre ville.'],
      ['fCard', digits($('#fCard').value).length === 16, 'Le numéro de carte comporte 16 chiffres.'],
      ['fExp', (function () { var m = $('#fExp').value.match(/^(\d{2})\/(\d{2})$/); return !!m && +m[1] >= 1 && +m[1] <= 12; })(), 'Entrez la date au format MM/AA.'],
      ['fCvc', digits($('#fCvc').value).length === 3, 'Le code comporte 3 chiffres.']
    ], first = null;
    rows.forEach(function (r) { if (!check(r[0], r[1], r[2]) && !first) first = r[0]; });
    if (first) $('#' + first).focus();
    return !first;
  }

  /* ---------- Paiement simulé ---------- */
  $('#pay').addEventListener('click', function () {
    if (!validate()) return;
    var b = $('#pay'), txt = b.textContent;
    b.disabled = true; b.innerHTML = '<span class="spin"></span> Paiement en cours';
    setTimeout(function () {
      b.disabled = false; b.textContent = txt;
      confirmOrder();
    }, 1800);
  });

  function confirmOrder() {
    var s = MR.SIZES[MR.state.size], m = MR.MATS[MR.state.mat];
    var num = 'MR-' + Math.floor(10000 + Math.random() * 89999);
    var eta = new Date(); eta.setDate(eta.getDate() + 7);
    $('#doneImg').src = $('#thumb').src;
    $('#doneMsg').textContent = 'Merci ' + $('#fName').value.trim().split(' ')[0] + '. Un e-mail de confirmation serait envoyé à ' + $('#fMail').value.trim() + '.';
    $('#doneDl').innerHTML =
      '<dt>Commande</dt><dd>' + num + '</dd>' +
      '<dt>Tapis</dt><dd>' + s.label + '</dd>' +
      '<dt>Matière</dt><dd>' + m.label + '</dd>' +
      '<dt>Total payé</dt><dd>' + MR.euro(MR.total()) + '</dd>' +
      '<dt>Livraison estimée</dt><dd>' + eta.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + '</dd>';
    $('#payView').hidden = true; $('#doneView').hidden = false;
    var sp = $('#stepPay'); sp.classList.remove('on'); sp.classList.add('done');
    window.scrollTo({ top: 0, behavior: MR.reduced() ? 'auto' : 'smooth' });
    if (!MR.reduced()) confetti();
  }

  /* ---------- Confettis ---------- */
  function confetti() {
    var c = $('#confetti'), x = c.getContext('2d'), W, H;
    function size() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
    size();
    var cols = ['#FFC83D', '#5DA62E', '#2F72CC', '#E04A3A', '#F28C28', '#E85C93'], ps = [];
    for (var i = 0; i < 160; i++) {
      ps.push({ x: W / 2 + (Math.random() - .5) * 200, y: H * .35, vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 4, s: 6 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length] });
    }
    var start = performance.now();
    (function f(now) {
      var t = now - start;
      x.clearRect(0, 0, W, H);
      ps.forEach(function (p) {
        p.vy += .33; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - t / 4200);
        x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
      });
      if (t < 4200) requestAnimationFrame(f); else x.clearRect(0, 0, W, H);
    })(start);
  }
})();
