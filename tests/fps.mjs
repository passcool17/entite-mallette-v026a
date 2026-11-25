// Une seule mesure d'fps de l'œil, partie en cours, sans capture pendant la mesure.
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto(process.argv[2] || 'http://localhost:8792/'); await p.waitForTimeout(1500);
await p.tap('#btnStart');
const r = await p.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now(); let worst = 0, last = t0;
  setTimeout(() => {
    const go = (t) => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < 8000) requestAnimationFrame(go); else res({ fps: +(n * 1000 / (t - t0 - 2000)).toFixed(1), worstFrameMs: +worst.toFixed(1), drawMs: window.__eye.stats.frameMs, dots: window.__eye.stats.dots, canvas: [document.querySelector('#eye').width, document.querySelector('#eye').height] }); };
    last = performance.now(); requestAnimationFrame(go);
  }, 2000);
}));
console.log(JSON.stringify({ ...r, logs }));
await b.close();
