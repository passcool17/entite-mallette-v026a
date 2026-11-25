// Test léger : console, fps de l'œil, 3 captures (vue principale, panneau en cours de séquence, aperçu CYD).
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const base = process.argv[2] || 'http://localhost:8792/';
const out = new URL('../shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto(base); await p.waitForTimeout(2500);
await p.screenshot({ path: out + '01-vue-principale-412.png' });
// fps de l'œil sur 5 s, avant le départ
await p.waitForTimeout(5000);
const idle = await p.evaluate(() => ({ ...window.__eye.stats }));
// séquence
await p.tap('#btnStart'); await p.waitForTimeout(600);
for (const c of (await p.evaluate(() => window.__game.first)) === 'rouge' ? ['red', 'blue'] : ['blue', 'red']) { await p.tap(`.guard-${c} .cover`); await p.waitForTimeout(400); await p.tap(`.guard-${c} .lever`); await p.waitForTimeout(400); }
await p.waitForTimeout(1100);
await p.tap(`.trap[data-trap="${await p.evaluate(() => window.__game.trapOf.croix)}"] .trap-key`); await p.waitForTimeout(400);
await p.evaluate(() => { for (const id of ['xa', 'xb']) document.querySelector(`[data-key="${id}"] button`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
await p.waitForTimeout(1300);
await p.tap(`.trap[data-trap="${await p.evaluate(() => window.__game.trapOf.badge)}"] .trap-key`); await p.waitForTimeout(300);
await p.tap('#rfid'); await p.waitForTimeout(2600);
const st1 = await p.evaluate(() => ({ step: window.__game.step, code: window.__game.code, order: window.__game.order }));
await p.tap(`.trap[data-trap="${await p.evaluate(() => window.__game.trapOf.cles)}"] .trap-key`); await p.waitForTimeout(2600);
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
await p.screenshot({ path: out + '02-panneau-mi-sequence-412.png', fullPage: true });
const playing = await p.evaluate(() => ({ ...window.__eye.stats, mood: window.__eye.mood }));
// on continue jusqu'à la victoire pour vérifier la logique
await p.waitForTimeout(2200);
for (const i of st1.order) await p.evaluate((k) => document.querySelector(`[data-key="${k}"] button`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), ['k1', 'k2', 'k3'][i]);
await p.waitForTimeout(400);
const uniq = await p.evaluate(() => window.__game.wireIdx);
await p.click(`.wire[data-i="${uniq}"]`); await p.waitForTimeout(400);
for (const c of st1.code) await p.click(`.kp:text-is("${c}")`);
await p.waitForTimeout(3200);
const box = await p.locator('#bigbtn').boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up();
await p.waitForTimeout(2600);
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
await p.screenshot({ path: out + '04-victoire-disque-412.png' });
await p.setViewportSize({ width: 915, height: 412 }); await p.waitForTimeout(800);
await p.screenshot({ path: out + '05-paysage-915x412.png' });
const end = await p.evaluate(() => ({ result: window.__game.result, step: window.__game.step, prob: document.querySelector('#prob').textContent }));
// aperçu CYD
const p2 = await ctx.newPage();
p2.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push('cyd ' + m.type() + ': ' + m.text()); });
p2.on('pageerror', (e) => logs.push('cyd pageerror: ' + e.message));
await p2.goto(base + '?cyd=1'); await p2.waitForTimeout(3500);
await p2.screenshot({ path: out + '03-apercu-cyd-240x320.png' });
await p2.locator('#cydCanvas').screenshot({ path: out + '03b-cyd-natif-240x320.png', scale: 'css' });
const cyd = await p2.evaluate(() => ({ ...window.__eye.stats }));
console.log(JSON.stringify({ idle, playing, st1, end, cyd, logs }, null, 1));
await b.close();
