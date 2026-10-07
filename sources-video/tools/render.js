// Rendu image par image : Chromium (Playwright) -> ffmpeg. Segments en parallèle puis assemblage.
// usage : node tools/render.js [--workers 2] [--out out/silent.mp4] [--from 0] [--to 49] [--crf 14]
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const CHROME = require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const { spawn, spawnSync } = require('child_process');
const path = require('path'), fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = 30, W = +arg('workers', 2), CRF = arg('crf', '14');
const T0 = +arg('from', 0), T1 = +arg('to', 49);
const OUT = path.resolve(arg('out', path.join(__dirname, '..', 'out', 'silent.mp4')));
const F0 = Math.round(T0 * FPS), F1 = Math.round(T1 * FPS);
const URL = 'file://' + path.join(__dirname, '..', 'src', 'index.html');
const dir = path.dirname(OUT);

async function worker(k, a, b) {
  const file = path.join(dir, 'seg_' + k + '.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', CRF,
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => ff.on('close', r));
  const br = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--allow-file-access-from-files', '--force-device-scale-factor=1'] });
  const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  await pg.goto(URL);
  await pg.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  const t0 = Date.now();
  for (let f = a; f < b; f++) {
    await pg.evaluate(t => window.__seek(t), f / FPS);
    const buf = await pg.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 60 === 0) console.log('worker', k, 'frame', f - a, '/', b - a, ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  }
  ff.stdin.end(); await done; await br.close();
  return file;
}

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const n = F1 - F0, per = Math.ceil(n / W), jobs = [];
  for (let k = 0; k < W; k++) { const a = F0 + k * per, b = Math.min(F1, a + per); if (a < b) jobs.push(worker(k, a, b)); }
  const files = await Promise.all(jobs);
  const list = path.join(dir, 'concat.txt');
  fs.writeFileSync(list, files.map(f => "file '" + f + "'").join('\n'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
  // événements sonores (pour la musique)
  const br = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const pg = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto(URL); await pg.waitForFunction('window.__ready === true');
  fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify(await pg.evaluate('window.__events')));
  await br.close();
  console.log('OK', OUT);
})().catch(e => { console.error(e); process.exit(1); });
