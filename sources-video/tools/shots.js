// Images de contrôle : node tools/shots.js 2 8 14 ...  (écrit out/shots/t_XX.XX.jpg)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const CHROME = require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const path = require('path');
(async () => {
  const times = process.argv.slice(2).map(Number);
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--allow-file-access-from-files', '--force-device-scale-factor=1'] });
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.text()); });
  await pg.goto('file://' + path.join(__dirname, '..', 'src', 'index.html'));
  await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  for (const t of times) {
    const t0 = Date.now();
    await pg.evaluate(t => window.__seek(t), t);
    await pg.screenshot({ path: path.join(__dirname, '..', 'out', 'shots', 't_' + t.toFixed(2) + '.jpg'), type: 'jpeg', quality: 80 });
    console.log('t=' + t, (Date.now() - t0) + ' ms');
  }
  console.log('events', await pg.evaluate('window.__events.length'));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
