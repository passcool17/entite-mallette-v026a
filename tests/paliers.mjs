// 1000 graines : répartition des paliers, bandes de notes avant/après rejet, temps de génération (CPU ralenti x4 = téléphone)
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8792/';
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome' });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });
const p = await ctx.newPage();
await p.goto(BASE + '?seed=1', { waitUntil: 'load' });
await p.waitForFunction(() => window.__makeRun);
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const out = await p.evaluate(() => {
  const st = (a) => { a = [...a].sort((x, y) => x - y); return { min: a[0], med: a[a.length >> 1], max: a[a.length - 1] }; };
  const res = { 'moyen-difficile': { raw: [], acc: [], tries: [], ms: [] }, difficile: { raw: [], acc: [], tries: [], ms: [] } };
  const { draw, accept, TIERS } = window.__puzzle;
  let fail = 0, nondet = 0, maxMs = 0;
  for (let s = 1; s <= 1000; s++) {
    const t0 = performance.now(); const r = window.__makeRun(s); const ms = performance.now() - t0;
    const R = res[r.tier]; R.acc.push(r.score.total); R.tries.push(r.tries); R.ms.push(ms); maxMs = Math.max(maxMs, ms);
    const d0 = draw(s, r.tier); R.raw.push(d0.score.total); R.rej = (R.rej || 0) + (accept(d0, r.tier, ...TIERS[r.tier].band) ? 0 : 1); // sans rejet
    if (!accept(r, r.tier, ...TIERS[r.tier].band)) fail++;
    if (JSON.stringify(window.__makeRun(s)) !== JSON.stringify(r)) nondet++;
  }
  const o = { fail, nondet, maxMs: +maxMs.toFixed(3) };
  for (const [t, R] of Object.entries(res)) {
    const [lo, hi] = TIERS[t].band;
    o[t] = { n: R.acc.length, band: TIERS[t].band, sansRejet: st(R.raw), rejet1erTirage: +(R.rej / R.raw.length * 100).toFixed(1) + ' %', horsBandeSansRejet: +(R.raw.filter((v) => v < lo || v > hi).length / R.raw.length * 100).toFixed(1) + ' %', accepte: st(R.acc), essais: st(R.tries), essaisMoy: +(R.tries.reduce((a, c) => a + c, 0) / R.tries.length).toFixed(2), msMax: +Math.max(...R.ms).toFixed(3) };
  }
  // exemples pour la QA
  o.exemples = {};
  for (let s = 1; s < 200 && Object.keys(o.exemples).length < 2; s++) { const r = window.__makeRun(s); if (!o.exemples[r.tier]) o.exemples[r.tier] = s; }
  return o;
});
console.log(JSON.stringify(out, null, 1));
await b.close();
