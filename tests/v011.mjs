// Test léger v0.1.1 : plein écran, voix fichier (simulée) + repli synthèse, zones tactiles, 2 captures.
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8792/';
const out = new URL('../shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
// voix simulée : seule "intro" existe en fichier (MP3 de test hors dépôt) ; les autres passent en synthèse
const mp3 = existsSync('/tmp/test-voix.mp3') ? readFileSync('/tmp/test-voix.mp3') : null;
if (mp3) {
  await p.route('**/voix/voix.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ files: ['intro', 'caches'] }) }));
  await p.route('**/voix/intro.mp3', (r) => r.fulfill({ contentType: 'audio/mpeg', body: mp3 }));
  await p.route('**/voix/caches.mp3', (r) => r.fulfill({ contentType: 'audio/mpeg', body: Buffer.from('pas un mp3') }));
}
await p.goto(base); await p.waitForTimeout(1500);
const fsBtn = await p.evaluate(() => ({ hidden: document.querySelector('#btnFs').hidden, label: document.querySelector('#btnFs').getAttribute('aria-label') }));
await p.screenshot({ path: out + 'v011-01-accueil-bouton-plein-ecran-412.png' });
await p.tap('#btnStart'); await p.waitForTimeout(900);
const level = await p.evaluate(() => new Promise((res) => { let m = 0; const t0 = performance.now(); (function f() { m = Math.max(m, window.__eye ? 0 : 0); if (performance.now() - t0 < 800) requestAnimationFrame(f); else res(m); })(); }));
const fs = await p.evaluate(() => ({ active: !!document.fullscreenElement, pressed: document.querySelector('#btnFs').getAttribute('aria-pressed'), orient: screen.orientation?.type }));
// "caches" : fichier illisible -> repli synthèse
await p.tap('.guard-red .cover'); await p.waitForTimeout(300); await p.tap('.guard-red .lever'); await p.waitForTimeout(1500);
const voix = await p.evaluate(() => ({ ...window.__voix }));
// zones tactiles : on touche juste hors du dessin d'une touche (dans l'espace entre deux touches)
const hits = await p.evaluate(() => {
  const k = document.querySelectorAll('.kp')[5].getBoundingClientRect();
  const e1 = document.elementFromPoint(k.right + 1, k.top + k.height / 2);
  const l = document.querySelector('.keysw-btn').getBoundingClientRect();
  const e2 = document.elementFromPoint(l.left + l.width / 2, l.bottom + 1);
  return { kpDrawn: [Math.round(k.width), Math.round(k.height)], kpGapHit: e1?.className, keyDrawn: Math.round(l.width), keyBelowHit: e2?.className };
});
// sortie plein écran par le bouton
await p.tap('#btnFs'); await p.waitForTimeout(400);
const fsOut = await p.evaluate(() => ({ active: !!document.fullscreenElement, pressed: document.querySelector('#btnFs').getAttribute('aria-pressed') }));
// paysage (orientation verrouillée sur le téléphone) : panneau 273:169
await p.setViewportSize({ width: 915, height: 412 }); await p.waitForTimeout(900);
await p.screenshot({ path: out + 'v011-02-partie-paysage-915x412.png' });
const land = await p.evaluate(() => { const r = document.querySelector('#panel').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(3), bottom: Math.round(r.bottom) }; });
console.log(JSON.stringify({ fsBtn, fs, fsOut, voix, hits, land, logs }, null, 1));
await b.close();
