// Test léger v0.1.3 : paysage 915x412, 915x340 (barres du navigateur), 800x360. Fils et clavier dans la loupe, panneau entier visible.
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const base = process.argv[2] || 'http://localhost:8792/';
const out = new URL('../shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const press = (id) => p.evaluate((k) => document.querySelector(`[data-key="${k}"] button`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), id);
const vp = async (w, h) => { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(500); };
// mesure : panneau entier visible + éléments demandés dans l'écran, taille de zone tactile (cible au bord + 1 px)
const measure = (sels) => p.evaluate((sels) => {
  const H = innerHeight, W = innerWidth, inView = (r) => r.top >= 0 && r.left >= 0 && r.bottom <= H + 0.5 && r.right <= W + 0.5;
  const pr = document.querySelector('#panel').getBoundingClientRect();
  const res = { vp: `${W}x${H}`, scrollY, step: window.__game.step, panel: { w: Math.round(pr.width), bottom: Math.round(pr.bottom), fits: inView(pr) } };
  for (const s of sels) {
    const els = [...document.querySelectorAll(s)];
    res[s] = { n: els.length, allInView: els.every((e) => inView(e.getBoundingClientRect())), minH: Math.round(Math.min(...els.map((e) => e.getBoundingClientRect().height))),
      topHit: els.every((e) => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t && (t === e || e.contains(t)); }) };
  }
  return res;
}, sels);
const M = {};
await p.goto(base + '?seed=777'); await p.waitForTimeout(1000);
await p.tap('#btnStart'); await p.waitForTimeout(800);
const run = await p.evaluate(() => ({ code: window.__game.code, order: window.__game.order, wires: window.__game.wires, unique: window.__game.unique, wireIdx: window.__game.wireIdx, trapOf: window.__game.trapOf }));
for (const [w, h] of [[915, 412], [915, 340], [800, 360]]) { await vp(w, h); M['step0_' + w + 'x' + h] = await measure(['.guard .cover', '#btnSon']); }
await vp(915, 412);
for (const c of (await p.evaluate(() => window.__game.first)) === 'rouge' ? ['red', 'blue'] : ['blue', 'red']) { await p.tap(`.guard-${c} .cover`); await p.waitForTimeout(400); await p.tap(`.guard-${c} .lever`); await p.waitForTimeout(400); }
await p.waitForTimeout(1100);
M.step1 = await measure([`.trap[data-trap="${run.trapOf.croix}"] .trap-key`, '.keysw-btn']);
await p.tap(`.trap[data-trap="${run.trapOf.croix}"] .trap-key`); await p.waitForTimeout(300);
await press('xa'); await press('xb'); await p.waitForTimeout(1300);
await p.tap(`.trap[data-trap="${run.trapOf.badge}"] .trap-key`); await p.waitForTimeout(300);
M.step2 = await measure(['#rfid']);
await p.tap('#rfid'); await p.waitForTimeout(2600);
await p.tap(`.trap[data-trap="${run.trapOf.cles}"] .trap-key`); await p.waitForTimeout(300);
for (const i of run.order) await press(['k1', 'k2', 'k3'][i]);
await p.waitForTimeout(2200);
await p.evaluate(() => scrollTo(0, 0));
M.wires_915x412 = await measure(['.wire']);
await p.screenshot({ path: out + 'v013-01-fils-paysage-915x412.png' });
await vp(915, 340); M.wires_915x340 = await measure(['.wire']);
await vp(800, 360); M.wires_800x360 = await measure(['.wire']);
await p.screenshot({ path: out + 'v013-02-fils-paysage-800x360.png' });
await p.tap(`.wire[data-i="${run.wireIdx}"]`); await p.waitForTimeout(1000);
M.code_800x360 = await measure(['.kp', '[data-entry]']);
M.kpHit = await p.evaluate(() => { const k = document.querySelectorAll('#loupe .kp')[5]?.getBoundingClientRect(); if (!k) return null; const e = document.elementFromPoint(k.right + 2, k.top + k.height / 2); return { w: Math.round(k.width), gapHit: e?.className }; });
await vp(915, 340); M.code_915x340 = await measure(['.kp']);
for (const c of run.code) await p.tap(`#loupe .kp:text-is("${c}")`);
await p.waitForTimeout(3200);
M.big_915x340 = await measure(['#bigbtn']);
M.loupeAfter = await p.evaluate(() => ({ hidden: document.querySelector('#loupe').hidden, kpHome: !!document.querySelector('#panel #keypad'), c2Home: !!document.querySelector('#panel #cyd2') }));
const box = await p.locator('#bigbtn').boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up();
await p.waitForTimeout(800);
M.result = await p.evaluate(() => window.__game.result);
// portrait inchangé : pas de loupe
await vp(412, 915); M.portrait = await p.evaluate(() => ({ loupeHidden: document.querySelector('#loupe').hidden, panelW: Math.round(document.querySelector('#panel').getBoundingClientRect().width) }));
console.log(JSON.stringify({ run, M, logs }, null, 1));
await b.close();
