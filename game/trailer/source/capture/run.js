// Usage: node capture/run.js <clip> [maxFrames]   -> frames/<clip>/f0000.jpg ...
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const CLIPS = require('./clips.js');
const name = process.argv[2]; const clip = CLIPS[name]; if (!clip) { console.error('unknown clip', name, Object.keys(CLIPS)); process.exit(1); }
const max = +process.argv[3] || clip.frames; const OUT = path.join(__dirname, '..', 'frames', name); fs.mkdirSync(OUT, { recursive: true });
const VC = fs.readFileSync(path.join(__dirname, 'vclock.js'), 'utf8');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); p.setDefaultTimeout(600000);
  p.on('pageerror', (e) => { if (!/Pointer Lock/.test(e.message)) console.log('PAGEERROR', e.message); });
  await p.addInitScript(({ settings, profile, vc }) => {
    const k = 'clayfront.profile.v1'; const d = JSON.parse(localStorage.getItem(k) || '{}'); d.tutorialOffered = true;
    d.settings = Object.assign(d.settings || {}, { graphics: 'medium', keyHints: false, showFps: false, dmgNumbers: true, master: 0 }, settings || {});
    Object.assign(d, profile || {}); localStorage.setItem(k, JSON.stringify(d)); (0, eval)(vc);
  }, { settings: clip.settings, profile: clip.profile, vc: VC });
  await p.goto('http://localhost:8765/game/' + (clip.query || ''), { waitUntil: 'load' });
  await p.waitForFunction(() => window.CLAYFRONT && document.getElementById('boot').classList.contains('hidden'), null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(async () => { window.__installVC(); const g = window.CLAYFRONT.gfx; g.trackFrame = () => null; window.CLAYFRONT.openPause = () => {};
    // log every game sound with the frame it happened on, so the trailer can place matching sounds exactly
    const { audio } = await import('/game/js/engine/audio.js'); window.__sfx = []; window.__frame = -1;
    for (const n of ['gunshot', 'hitmarker', 'killConfirm', 'press', 'riser', 'impactHit', 'sparkle', 'stinger', 'explosion', 'reload', 'dryFire', 'levelUp', 'melee', 'pickup', 'crate', 'hurt']) {
      const f = audio[n]; if (typeof f !== 'function') continue;
      audio[n] = function (...a) { const x = a[0]; window.__sfx.push({ n, f: window.__frame, a: typeof x === 'string' || typeof x === 'boolean' || typeof x === 'number' ? x : (n === 'gunshot' && a[2] ? (a[2].local ? 'local' : 'remote') : null) }); return f.apply(this, a); };
    } });
  const step = (n = 1) => p.evaluate((n) => { for (let i = 0; i < n; i++) window.__vc.step(1000 / 30); }, n);
  if (clip.setup) await p.evaluate(clip.setup);
  if (clip.ready) { let guard = 0; while (!(await p.evaluate(clip.ready)) && guard++ < 4000) await step(1); }
  if (clip.preroll) for (let i = 0; i < clip.preroll; i++) { if (clip.pre) await p.evaluate(clip.pre, i); await step(1); }
  const t0 = Date.now();
  for (let i = 0; i < max; i++) {
    await p.evaluate((i) => { window.__frame = i; }, i);
    if (clip.direct) await p.evaluate(clip.direct, i);
    await step(1);
    await p.screenshot({ path: path.join(OUT, 'f' + String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 });
    if (i % 30 === 0) console.log(name, i, '/', max, ((Date.now() - t0) / (i + 1) / 1000).toFixed(2) + 's/frame');
  }
  fs.writeFileSync(path.join(OUT, 'sfx.json'), JSON.stringify(await p.evaluate(() => window.__sfx.filter((e) => e.f >= 0))));
  await b.close();
})();
