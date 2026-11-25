// Test chargement v0.1.3 : 1re visite à froid (contexte neuf, Fast 3G, CPU x4), capture à mi-chargement 412x915,
// une seule navigation (plus de rechargement au 1er SW), téléchargements comptés côté serveur, revisite, échec + Réessayer.
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8792/';
const LOG = '/tmp/srv8792.log';
const out = new URL('../shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
let navs = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs++; });
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable');
const fast3g = { offline: false, latency: 562.5, downloadThroughput: (1.6e6 / 8) * 0.9, uploadThroughput: (750e3 / 8) * 0.9 };
await cdp.send('Network.emulateNetworkConditions', fast3g);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const logStart = existsSync(LOG) ? readFileSync(LOG, 'utf8').length : 0;
const t0 = Date.now(), samples = [];
let shot = null, firstBoot = null;
p.goto(base).catch(() => {});
const state = () => p.evaluate(() => { const e = document.getElementById('boot'); return e ? { boot: !e.hidden && !e.classList.contains('gone'), pct: +document.getElementById('bootPct').textContent, sub: document.getElementById('bootSub').textContent, aria: document.getElementById('bootBar').getAttribute('aria-valuenow'), start: document.getElementById('btnStart')?.disabled === false, scan: getComputedStyle(document.querySelector('.b-scan')).animationName } : null; }).catch(() => null);
let ready = null;
for (let i = 0; i < 120 && !ready; i++) {
  await p.waitForTimeout(250);
  const s = await state(); if (!s) continue;
  const t = (Date.now() - t0) / 1000;
  if (firstBoot === null && s.boot) firstBoot = t;
  samples.push([t.toFixed(2), s.pct, s.sub]);
  if (!shot && s.pct >= 25 && s.pct <= 80) { await p.screenshot({ path: out + 'v013-03-chargement-froid-fast3g-412.png' }); shot = { t: t.toFixed(2), pct: s.pct, sub: s.sub, aria: s.aria, scan: s.scan }; }
  if (s.start && !s.boot) ready = t;
}
await p.waitForTimeout(4000); // laisse le SW s'installer après le préchargement
const sw = await p.evaluate(() => !!navigator.serviceWorker.controller);
const hits = (readFileSync(LOG, 'utf8').slice(logStart).match(/"GET [^ ]+/g) || []).map((l) => l.slice(5));
const count = (re) => hits.filter((h) => re.test(h)).length;
const downloads = { tension: count(/tension\.mp3/), intro: count(/intro\.mp3/), depart: count(/depart\.mp3/), fonts: count(/\.woff2/), appjs: count(/app\.js/), html: count(/^\/(\?|$|index)/) };
// revisite (SW + cache), toujours en Fast 3G
const t1 = Date.now(); await p.reload();
await p.waitForFunction(() => document.getElementById('btnStart').disabled === false && document.getElementById('boot').hidden, null, { timeout: 30000 });
const revisit = ((Date.now() - t1) / 1000).toFixed(2);
// échec d'un fichier : message + Réessayer (contexte neuf, musique en 404)
const ctx2 = await b.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
const p2 = await ctx2.newPage();
await p2.route('**/audio/tension.mp3', (r) => r.fulfill({ status: 404, body: '' }));
await p2.goto(base); await p2.waitForTimeout(1500);
const fail = await p2.evaluate(() => ({ err: document.getElementById('bootErr').textContent, retry: !document.getElementById('bootRetry').hidden, skip: !document.getElementById('bootSkip').hidden, start: document.getElementById('btnStart').disabled }));
await p2.unroute('**/audio/tension.mp3'); await p2.click('#bootRetry'); await p2.waitForTimeout(1500);
fail.afterRetry = await p2.evaluate(() => ({ bootHidden: document.getElementById('boot').hidden, start: document.getElementById('btnStart').disabled === false }));
console.log(JSON.stringify({ firstBoot, ready, navs, shot, samples: samples.filter((_, i) => i % 3 === 0), sw, downloads, revisit, fail, logs }, null, 1));
await b.close();
