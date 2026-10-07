/* Démarrage : polices et images prêtes, puis construction de la timeline. */
(async function () {
  'use strict';
  var V = window.V;
  try {
    await Promise.all(['800 100px "Bricolage Grotesque"', '400 20px "DM Sans"', '500 20px "DM Sans"', '600 20px "DM Sans"', '700 20px "DM Sans"'].map(function (f) { return document.fonts.load(f); }));
    await document.fonts.ready;
  } catch (e) { }
  document.querySelectorAll('.mark').forEach(function (m) { m.innerHTML = V.LOGO; });
  V.builders.forEach(function (fn) { fn(); });
  V.tl.time(0, false); V.procs.forEach(function (p) { p(0); });
  var imgs = Array.prototype.slice.call(document.images);
  await Promise.all(imgs.map(function (i) { return i.decode ? i.decode().catch(function () { }) : null; }));
  window.__seek = function (t) { V.tl.time(t, false); V.procs.forEach(function (p) { p(t); }); };
  window.__events = V.events;
  window.__dur = V.DUR;
  window.__ready = true;
})();
