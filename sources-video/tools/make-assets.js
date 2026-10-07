// Génère, avec le VRAI moteur du site, tous les visuels de la vidéo :
// carte, reconnaissance, tapis, tapis sans maisons/arbres, sprites de maisons et d'arbres, trajets des voitures.
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE || '/home/claude/work/minirue/js/';
const OUT = path.join(__dirname, '..', 'assets');
const SPR = path.join(OUT, 'sprites');
fs.mkdirSync(SPR, { recursive: true });
const SEED = +(process.env.SEED || 3);

require(SITE + 'sample.js');
require(SITE + 'matgen.js');

const save = (cv, file) => fs.writeFileSync(path.join(OUT, file), cv.toBuffer('image/png'));

// rogne un sprite à sa zone opaque
function trim(cv) {
  const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const out = createCanvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(cv, -x0, -y0);
  return { cv: out, dx: x0, dy: y0 };
}

(async () => {
  const S = MatGen.S;
  const src = createCanvas(1500, 1000);
  Sample.draw(src, 1500, 1000);
  save(src, 'map.png');

  const res = await MatGen.generate(src, {
    seed: SEED, houses: +(process.env.HOUSES || 1.35), trees: +(process.env.TREES || 1.25),
    layers: true, createCanvas: (w, h) => createCanvas(w, h)
  });
  save(res.canvas, 'mat.png');
  save(res.layers.base, 'mat_base.png');
  // reconnaissance : agrandie en douceur pour une jolie lecture à l'écran
  const cls = createCanvas(1500, 1000), cx = cls.getContext('2d');
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  cx.drawImage(res.classCanvas, 0, 0, 1500, 1000);
  save(cls, 'classes.png');

  // sprites : on dessine chaque élément avec la fonction du moteur, sur un canevas transparent local
  const M = 40;
  const layout = { W: 1500, H: 1000, houses: [], trees: [], paths: res.paths, stats: res.stats };
  res.layers.houses.forEach((h, i) => {
    const bx = Math.floor(h.x * S - M), by = Math.floor(h.y * S - M - 24);
    const w = Math.ceil(h.w * S + 2 * M), hh = Math.ceil(h.h * S + 2 * M + 24);
    const cv = createCanvas(w, hh), c = cv.getContext('2d');
    c.translate(-bx, -by);
    MatGen.drawHouse(c, h);
    const t = trim(cv); if (!t) return;
    const file = 'sprites/h' + String(i).padStart(2, '0') + '.png';
    save(t.cv, file);
    layout.houses.push({ file, x: bx + t.dx, y: by + t.dy, w: t.cv.width, h: t.cv.height, z: (h.y + h.h) * S });
  });
  res.layers.trees.forEach((tr, i) => {
    const r = tr.r * S, bx = Math.floor(tr.x * S - r - M), by = Math.floor(tr.y * S - r - M - 10);
    const w = Math.ceil(2 * r + 2 * M), hh = Math.ceil(2 * r + 2 * M + 20);
    const cv = createCanvas(w, hh), c = cv.getContext('2d');
    c.translate(-bx, -by);
    MatGen.drawTree(c, tr);
    const t = trim(cv); if (!t) return;
    const file = 'sprites/t' + String(i).padStart(2, '0') + '.png';
    save(t.cv, file);
    layout.trees.push({ file, x: bx + t.dx, y: by + t.dy, w: t.cv.width, h: t.cv.height, z: (tr.y + tr.r * .5) * S });
  });
  fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(layout));
  console.log('maisons', layout.houses.length, '| arbres', layout.trees.length, '| trajets', layout.paths.length,
    '| points', layout.paths.map(p => p.length).join(','), '|', JSON.stringify(res.stats));
})().catch(e => { console.error(e); process.exit(1); });
