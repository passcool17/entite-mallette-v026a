// Test léger v0.1.4 (difficile) : une partie complète avec ?seed=N en lisant SEULEMENT l'écran
// (plaque du n° de série, fragment de l'écran 2, couleurs des fils, règles du texte d'étape). 3 captures.
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const base = process.argv[2] || 'http://localhost:8792/';
const SEED = +(process.argv[3] || 31337);
const out = new URL('../shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const text = (sel) => p.evaluate((s) => document.querySelector(s)?.textContent ?? '', sel);
const press = (id) => p.evaluate((k) => document.querySelector(`[data-key="${k}"] button`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), id);
const solved = {};
await p.goto(`${base}?seed=${SEED}`); await p.tap('#btnStart'); await p.waitForTimeout(800);
// 1) n° de série lu sur la plaque
const plate = await text('[data-part="label"]');
const serial = plate.match(/N° DE SÉRIE (\S+)/)[1];
const d = [...serial].filter((c) => /\d/.test(c)).map(Number);
solved.serial = serial; solved.digits = d;
const status0 = await text('#status');
// 2) interrupteurs : dernier chiffre pair -> bleu d'abord
const first = d[3] % 2 === 0 ? ['blue', 'red'] : ['red', 'blue'];
for (const c of first) { await p.tap(`.guard-${c} .cover`); await p.waitForTimeout(350); await p.tap(`.guard-${c} .lever`); await p.waitForTimeout(350); }
await p.waitForTimeout(900);
const trapNo = (s) => +s.match(/trappe (\d)/)[1];
// 3) clé en croix : la trappe est donnée par le texte d'étape
await p.tap(`.trap[data-trap="${trapNo(await text('#status'))}"] .trap-key`); await p.waitForTimeout(300);
await press('xa'); await press('xb'); await p.waitForTimeout(1300);
await p.tap(`.trap[data-trap="${trapNo(await text('#status'))}"] .trap-key`); await p.waitForTimeout(300);
await p.tap('#rfid'); await p.waitForTimeout(1300);
// mensonge signalé : pendant le faux code, l'œil grésille
const lie = await p.evaluate(() => ({ big: document.querySelector('#cyd2 [data-big]')?.textContent, liar: document.querySelector('#stage').classList.contains('liar') }));
await p.screenshot({ path: out + 'v014-01-mensonge-oeil-grésille-412.png' });
await p.waitForTimeout(1600);
const truthFrag = await p.evaluate(() => ({ big: document.querySelector('#cyd2 [data-big]')?.textContent, liar: document.querySelector('#stage').classList.contains('liar'), head: document.querySelector('#cyd2 [data-code]')?.textContent }));
const frag = truthFrag.head.replace('CODE ', '');
await p.tap(`.trap[data-trap="${trapNo(await text('#status'))}"] .trap-key`); await p.waitForTimeout(400);
// 4) clés I, II, III : poids = 1er, 2e, 3e chiffre ; de la plus légère à la plus lourde
const order = [0, 1, 2].sort((a, bb) => d[a] - d[bb]);
solved.order = order;
// une erreur volontaire d'abord (pénalité de temps + % qui remonte)
const tBefore = await p.evaluate(() => window.__game.endAt);
await press(['k1', 'k2', 'k3'][order[2]]); await p.waitForTimeout(500);
const penalty = await p.evaluate((t) => ({ sec: Math.round((t - window.__game.endAt) / 1000), prob: document.querySelector('#prob').textContent }), tBefore);
for (const i of order) await press(['k1', 'k2', 'k3'][i]);
await p.waitForTimeout(1800);
// 5) fils : règle du texte d'étape
const wires = await p.evaluate(() => [...document.querySelectorAll('#cyd2 .wire .wire-name')].map((e) => e.textContent.toLowerCase()));
const reds = wires.map((w, i) => (w === 'rouge' ? i : -1)).filter((i) => i >= 0);
const unique = wires.findIndex((w) => wires.filter((x) => x === w).length === 1);
const status4 = await text('#status');
const evenBranch = /pair → le 2e/.test(status4); // la règle affichée dit s'il y a la branche « pair »
const wireIdx = reds.length > 1 ? reds[reds.length - 1] : evenBranch && d[3] % 2 === 0 ? 1 : unique;
solved.wires = wires; solved.wireIdx = wireIdx;
await p.waitForTimeout(700); // défilement doux vers le haut
const wireView = await p.evaluate(() => {
  const H = innerHeight, els = [...document.querySelectorAll('#cyd2 .wire')];
  const st = document.querySelector('#status').getBoundingClientRect();
  return { inLoupe: !!document.querySelector('#loupe #cyd2'), allVisible: els.every((e) => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top >= 0 && r.bottom <= H && t && e.contains(t); }), minH: Math.round(Math.min(...els.map((e) => e.getBoundingClientRect().height))), ruleVisible: st.top >= 0 && st.bottom <= H };
});
await p.screenshot({ path: out + `v014-02-fils-portrait-412-s${SEED}.png` });
await p.tap(`#cyd2 .wire[data-i="${wireIdx}"]`); await p.waitForTimeout(900);
// 6) code : 1er = dernier chiffre ; 3e = somme mod 10 ; 2e et 4e = fragment
const status5 = await text('#status');
const third = /somme/.test(status5) ? (d[0] + d[1] + d[2] + d[3]) % 10 : /1er chiffre ;/.test(status5) ? d[0] : NaN;
const code = `${d[3]}${frag[1]}${third}${frag[3]}`;
solved.code = code;
for (const c of code) await p.tap(`.kp:text-is("${c}")`);
await p.waitForTimeout(3200);
const sceller = await p.evaluate(() => ({ caption: document.querySelector('#caption').textContent, glitch: document.querySelector('#caption').classList.contains('glitch'), liar: document.querySelector('#stage').classList.contains('liar') }));
const box = await p.locator('#bigbtn').boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(1700); await p.mouse.up();
await p.waitForTimeout(3600);
await p.evaluate(() => scrollTo(0, 0));
await p.screenshot({ path: out + `v014-03-victoire-412-s${SEED}.png` });
const st = await p.evaluate(() => { const g = window.__game; return { tier: g.tier, score: g.score, result: g.result, code: g.code, order: g.order, wireIdx: g.wireIdx, serial: g.serial }; });
const agree = st.code === code && st.order.join() === order.join() && st.wireIdx === wireIdx && st.serial === serial;
// une autre graine donne d'autres valeurs
const other = await p.evaluate(() => { const r = window.__makeRun(2024); return { serial: r.serial, code: r.code, order: r.order, wireIdx: r.wireIdx, first: r.first }; });
console.log(JSON.stringify({ seed: SEED, solved, status0, lie, truthFrag, penalty, tier: st.tier, score: st.score, status4, status5, wireView, sceller, result: st.result, agree, other, logs }, null, 1));
await b.close();
