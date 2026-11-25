// Test léger v0.1.2 : graine (?seed), indices cohérents, musique (boucle + intensité + atténuation), vibrations, ?cyd=1. 2 captures.
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const base = process.argv[2] || 'http://localhost:8792/';
const SEED = 4242;
const out = new URL('../shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
// journal des vibrations
await ctx.addInitScript(() => { window.__buzz = []; navigator.vibrate = (p) => { window.__buzz.push(p); return true; }; });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const G = () => p.evaluate(() => { const g = window.__game; return { seed: g.seed, code: g.code, order: g.order, wires: g.wires, unique: g.unique, trapOf: g.trapOf, step: g.step }; });
const status = () => p.evaluate(() => document.querySelector('#status').textContent);
const press = (id) => p.evaluate((k) => document.querySelector(`[data-key="${k}"] button`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), id);
await p.goto(`${base}?seed=${SEED}&debug=1`); await p.waitForTimeout(1200);
const seeds = await p.evaluate(() => [1, 2].map((s) => window.__makeRun(s)));
const vibBtn = await p.evaluate(() => { const v = document.querySelector('#btnVib'); return { hidden: v.hidden, pressed: v.getAttribute('aria-pressed'), label: v.getAttribute('aria-label'), w: v.offsetWidth }; });
await p.tap('#btnStart'); await p.waitForTimeout(900);
const run = await G();
const expected = await p.evaluate((s) => window.__makeRun(s), SEED);
const music0 = await p.evaluate(() => ({ ...window.__musique }));
const seedShown = await p.evaluate(() => document.querySelector('#seed').textContent);
const checks = {};
await p.tap('.guard-red .cover'); await p.waitForTimeout(300); await p.tap('.guard-red .lever'); await p.waitForTimeout(500);
checks.duckDuringVoice = await p.evaluate(() => window.__musique.sousVoix);
await p.tap('.guard-blue .cover'); await p.waitForTimeout(300); await p.tap('.guard-blue .lever'); await p.waitForTimeout(1400);
checks.s1 = (await status()).includes(`trappe ${run.trapOf.croix} `);
await p.evaluate(() => scrollTo(0, 0));
await p.screenshot({ path: out + 'v012-01-trappe-aleatoire-graine-412.png' });
await p.tap(`.trap[data-trap="${run.trapOf.croix}"] .trap-key`); await p.waitForTimeout(300);
await press('xa'); await press('xb'); await p.waitForTimeout(1300);
checks.s2 = (await status()).includes(`trappe ${run.trapOf.badge} `);
await p.tap(`.trap[data-trap="${run.trapOf.badge}"] .trap-key`); await p.waitForTimeout(300);
await p.tap('#rfid'); await p.waitForTimeout(2900);
checks.s3 = (await status()).includes(`trappe ${run.trapOf.cles} `);
checks.c2code = await p.evaluate((c) => document.querySelector('[data-code]').textContent === 'CODE ' + c && document.querySelector('[data-big]')?.textContent === c, run.code);
// intensité : on rapproche la fin du compte à rebours (20 s restantes)
const tlBefore = await p.evaluate(() => { const g = window.__game; const left = g.endAt - performance.now(); g.endAt = performance.now() + 20000; return left; });
await p.waitForTimeout(800);
const musicLow = await p.evaluate(() => ({ ...window.__musique }));
await p.evaluate((l) => { window.__game.endAt = performance.now() + l; }, tlBefore);
await p.tap(`.trap[data-trap="${run.trapOf.cles}"] .trap-key`); await p.waitForTimeout(2600);
// l'écran 2 ment d'abord (faux ordre), puis la vérité revient : on attend la vérité
checks.c2order = await p.waitForFunction((o) => document.querySelector('[data-big]')?.textContent === o, run.order.map((i) => ['I', 'II', 'III'][i]).join(' · '), { timeout: 8000 }).then(() => true, () => false);
// mauvais ordre volontaire -> vibration courte
const wrong = [0, 1, 2].find((i) => i !== run.order[0]);
await press(['k1', 'k2', 'k3'][wrong]); await p.waitForTimeout(500);
for (const i of run.order) await press(['k1', 'k2', 'k3'][i]);
await p.waitForTimeout(1900);
checks.wireNames = await p.evaluate((w) => [...document.querySelectorAll('.wire .wire-name')].map((e) => e.textContent.toLowerCase()).join() === w.join(), run.wires);
await p.click(`.wire[data-i="${run.wires.indexOf(run.unique)}"]`); await p.waitForTimeout(900);
for (const c of run.code) await p.click(`.kp:text-is("${c}")`);
await p.waitForTimeout(3200);
const box = await p.locator('#bigbtn').boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up();
await p.waitForTimeout(3600);
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
await p.screenshot({ path: out + 'v012-02-victoire-graine-412.png' });
const end = await p.evaluate(() => ({ result: window.__game.result, buzz: window.__buzz, music: { ...window.__musique } }));
// réglage vibrations : coupé puis rechargé -> reste coupé
await p.tap('#btnVib');
const persisted = await p.evaluate(() => localStorage.getItem('entite.vibrations'));
await p.reload(); await p.waitForTimeout(800);
const afterReload = await p.evaluate(() => document.querySelector('#btnVib').getAttribute('aria-pressed'));
// aperçu CYD
await p.goto(base + '?cyd=1'); await p.waitForTimeout(1500);
const cyd = await p.evaluate(() => ({ visible: !document.querySelector('#cydView').hidden, dots: window.__eye.stats.dots }));
console.log(JSON.stringify({ seeds, vibBtn, run, sameAsSeed: JSON.stringify(expected) === JSON.stringify({ seed: run.seed, code: run.code, order: run.order, unique: run.unique, wires: run.wires, trapOf: run.trapOf }), seedShown, music0, musicLow, checks, end, persisted, afterReload, cyd, logs }, null, 1));
await b.close();
