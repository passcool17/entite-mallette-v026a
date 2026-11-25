// Test léger v0.1.5 : une partie complète (2 couches, 12 étapes) avec ?seed=N en lisant SEULEMENT l'écran
// (plaque, textes d'étape, écran 2, couleurs des fils, clones Podkova). 3 captures 412x915.
// Usage : node tests/v015.mjs [base] [seed]
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const base = process.argv[2] || 'http://localhost:8792/';
const SEED = +(process.argv[3] || 1);
const out = new URL('../shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const W = (ms) => p.waitForTimeout(ms);
const text = (sel) => p.evaluate((s) => document.querySelector(s)?.textContent ?? '', sel);
const press = (id) => p.evaluate((k) => document.querySelector(`[data-key="${k}"] button`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), id);
const liar = () => p.evaluate(() => ({ caption: document.querySelector('#caption').textContent, glitch: document.querySelector('#caption').classList.contains('glitch'), red: document.querySelector('#stage').classList.contains('liar') }));
const step = () => p.evaluate(() => window.__game.step);
let taps = 0; const tap = async (sel) => { taps++; await p.tap(sel); };
const S = {}, checks = {};
const t0 = Date.now();
await p.goto(`${base}?seed=${SEED}`); await p.tap('#btnStart'); await W(800);
// n° de série lu sur la plaque
const serial = (await text('[data-part="label"]')).match(/N° DE SÉRIE (\S+)/)[1];
const d = [...serial].filter((c) => /\d/.test(c)).map(Number), L = [...serial].filter((c) => /[A-Z]/.test(c));
S.serial = serial;
const flip = async (first) => { for (const c of first === 'bleu' ? ['blue', 'red'] : ['red', 'blue']) { await tap(`.guard-${c} .cover`); await W(300); await tap(`.guard-${c} .lever`); await W(300); } };
// ---- COUCHE 1
// 1) interrupteurs : voyelle -> bleu ; sinon dernier chiffre pair -> bleu, impair -> rouge
const r1 = await text('#status'); checks.r1 = r1;
S.first = L.some((c) => /[AEUY]/.test(c)) || d[3] % 2 === 0 ? 'bleu' : 'rouge';
await flip(S.first); await W(600);
// 2) trappe de la clé en croix = (d1 mod 3) + 1, d'après la règle affichée
checks.r2 = await text('#status');
S.trapCroix = (d[0] % 3) + 1;
await tap(`.trap[data-trap="${S.trapCroix}"] .trap-pick`); await W(900);
await tap(`.trap[data-trap="${S.trapCroix}"] .trap-key`); await W(300);
await press('xa'); await press('xb'); taps += 2; await W(1300);
// 3) badges : 3 clones, le vrai porte une lettre du n°
const trapNo = (s) => +s.match(/trappe (\d)/)[1];
checks.r3 = await text('#status');
await tap(`.trap[data-trap="${trapNo(checks.r3)}"] .trap-key`); await W(700);
const badges = await p.evaluate(() => [...document.querySelectorAll('#cyd2 .badge')].map((e) => e.textContent.replace('PODKOVA·', '')));
S.badges = badges; S.badge = badges.find((c) => L.includes(c));
await p.screenshot({ path: out + `v015-01-clones-podkova-412-s${SEED}.png` });
checks.badgesInView = await p.evaluate(() => [...document.querySelectorAll('#cyd2 .badge')].every((e) => { const r = e.getBoundingClientRect(); return r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight; }));
await tap(`#cyd2 .badge[data-i="${badges.indexOf(S.badge)}"]`); await W(500);
await tap('#rfid'); await W(1300);
checks.lieCode = await p.evaluate(() => ({ big: document.querySelector('#cyd2 [data-big]')?.textContent, red: document.querySelector('#stage').classList.contains('liar') }));
await W(1700);
const frag = (await text('#cyd2 [data-code]')).replace('CODE ', ''); S.fragment = frag;
await tap(`.trap[data-trap="${trapNo(await text('#status'))}"] .trap-key`); await W(400);
// 4) clés : léger -> lourd ; une erreur volontaire d'abord (pénalité allégée)
S.order = [0, 1, 2].sort((a, c) => d[a] - d[c]).map((i) => ['I', 'II', 'III'][i]);
const ids = (o) => o.map((n) => ({ I: 'k1', II: 'k2', III: 'k3' })[n]);
const tB = await p.evaluate(() => window.__game.endAt);
await press(ids(S.order)[2]); taps++; await W(500);
checks.penalty = await p.evaluate((t) => ({ sec: Math.round((t - window.__game.endAt) / 1000), prob: document.querySelector('#prob').textContent }), tB);
for (const k of ids(S.order)) { await press(k); taps++; }
await W(1500);
// 5) fils couche 1 : règle affichée (2 ou 3 branches)
const wireNames = () => p.evaluate(() => [...document.querySelectorAll('#cyd2 .wire .wire-name')].map((e) => e.textContent.toLowerCase()));
const uniq = (ws) => ws.findIndex((w) => ws.filter((x) => x === w).length === 1);
checks.r5 = await text('#status');
let ws = await wireNames(); const reds = ws.map((w, i) => (w === 'rouge' ? i : -1)).filter((i) => i >= 0);
S.wires = ws; S.wire = reds.length > 1 ? reds.at(-1) : /pair → le 2e/.test(checks.r5) && d[3] % 2 === 0 ? 1 : uniq(ws);
await tap(`#cyd2 .wire[data-i="${S.wire}"]`); await W(900);
// 6) code 1
checks.r6 = await text('#status');
const third = /somme/.test(checks.r6) ? (d[0] + d[1] + d[2] + d[3]) % 10 : d[0];
S.code1 = `${d[3]}${frag[1]}${third}${frag[3]}`;
for (const c of S.code1) await tap(`.kp:text-is("${c}")`);
await W(2900);
checks.mentFini = await liar();
await W(3200);
// ---- COUCHE 2
checks.step6 = await step();
checks.r7 = await text('#status');
S.first2 = d[0] % 2 === 0 ? 'bleu' : 'rouge';
if ((await p.evaluate(() => window.__game.hard))) { await W(5000); checks.colorLie = await liar(); }
await flip(S.first2); await W(500);
await press('xa'); await press('xb'); taps += 2; await W(900);
S.order2 = [...S.order].reverse();
for (const k of ids(S.order2)) { await press(k); taps++; }
await W(1500);
checks.r10 = await text('#status');
ws = await wireNames(); const blues = ws.map((w, i) => (w === 'bleu' ? i : -1)).filter((i) => i >= 0);
S.wires2 = ws; S.wire2 = /plus d'un bleu/.test(checks.r10) && blues.length > 1 ? blues[0] : uniq(ws);
await W(400);
await p.screenshot({ path: out + `v015-02-fils-panneau2-412-s${SEED}.png` });
checks.wires2View = await p.evaluate(() => [...document.querySelectorAll('#cyd2 .wire')].every((e) => { const r = e.getBoundingClientRect(); return r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight; }));
await tap(`#cyd2 .wire[data-i="${S.wire2}"]`); await W(900);
const head = await text('#cyd2 [data-code]');
S.code2 = [...head.replace('CODE 1 ', '')].reverse().join('');
for (const c of S.code2) await tap(`.kp:text-is("${c}")`);
await W(3000);
checks.sceller = await liar();
const box = await p.locator('#bigbtn').boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await W(1700); await p.mouse.up(); taps++;
await W(3600);
await p.evaluate(() => scrollTo(0, 0));
await p.screenshot({ path: out + `v015-03-victoire-412-s${SEED}.png` });
const g = await p.evaluate(() => { const x = window.__game; return { tier: x.tier, score: x.score, result: x.result ?? null, step: x.step, entry: x.entry, c2: x.c2, left: Math.round((x.endAt - x.endT) / 1000), code: x.code, code2: x.code2, wireIdx: x.wireIdx, wireIdx2: x.wireIdx2, badge: x.badges[x.badgeIdx], first: x.first, first2: x.first2, trap: x.trapOf.croix }; });
const agree = g.code === S.code1 && g.code2 === S.code2 && g.wireIdx === S.wire && g.wireIdx2 === S.wire2 && g.badge === S.badge && g.first === S.first && g.first2 === S.first2 && g.trap === S.trapCroix;
// estimation humaine : temps de réflexion par déduction + 1,5 s par geste + animations du jeu
const deductions = 10, think = g.tier === 'difficile' ? 25 : 20;
const est = { deductions, taps, think, anim: 40, total: deductions * think + taps * 1.5 + 40 };
console.log(JSON.stringify({ seed: SEED, tier: g.tier, score: g.score, solved: S, result: g.result, end: { step: g.step, entry: g.entry, c2: g.c2 }, agree, botSec: Math.round((Date.now() - t0) / 1000), timerLeft: g.left, est, checks, logs }, null, 1));
await b.close();
