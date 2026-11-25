// Test v0.2.2 : KY-040 sans boutons + / − (on tourne le bouton lui-même : glisser, torsion, molette, bords, centre = clic),
// anneau cryptex de 20 lettres (ABCDEFGHIJLMNOPRSTUV, 20 crans = 1 tour) avec une étape « mot de 4 lettres » sur l'OLED,
// 5 câbles banane base → couvercle (branchés dans les douilles, puis fiche retombée sur la base une fois débranchée),
// partie complète graine 42 jusqu'à la victoire, levier rouge trop tôt, joystick 16/16, 0 débordement / chevauchement
// en 412x915, 915x412, 1280x800 (+ 320 px de large), voix (aucune réponse écrite), mp3 ElevenLabs intacts, 0 erreur.
// Usage : node tests/v022.mjs [base] [graine]   (serveur local : python3 -m http.server 8794)
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';
import { canMove, DIRS, RING, WORDS } from '../js/game.js';
const base = process.argv[2] || 'http://127.0.0.1:8794/';
const SEED = +(process.argv[3] || 42);
const shots = process.env.SHOTS || '/workspace/qa/entite-mallette/v0.2.2-dev/';
mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const R = { checks: {}, errors: [] };
const ok = (k, v, extra) => { R.checks[k] = v ? 'PASS' : `FAIL${extra ? ' ' + JSON.stringify(extra) : ''}`; };

async function page(vp) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = [], reqs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('page: ' + e.message));
  p.on('requestfailed', (r) => errs.push('failed: ' + r.url()));
  p.on('response', (r) => { reqs.push(r.url()); if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
  await p.goto(`${base}?seed=${SEED}&debug=1`);
  await p.waitForSelector('#btnStart:not([disabled])', { timeout: 20000 });
  await p.waitForSelector('#boot', { state: 'hidden' });
  return { ctx, p, errs, reqs };
}
const W = (p, ms) => p.waitForTimeout(ms);
const D = (p, f, a) => p.evaluate(f, a);
const overflow = (p) => D(p, () => document.documentElement.scrollWidth - innerWidth);

// Face Mallette : toutes les commandes essentielles dans le premier écran, sans défiler ni se chevaucher.
R.layout = {};
async function fold(p, tag) {
  await W(p, 250);
  const m = await D(p, () => {
    const se = document.scrollingElement, vh = innerHeight, vw = innerWidth;
    const sel = { cyd1: '#cyd1', spk: '.spk-cone', ws: '#bar', replay: '#btnReplay', pocket: '#btnPocket', serial: '#serialPlate', jacks: '.jack', locks: '.lock.key', tm: '.tm-small', oled: '.oled', enc: '.knob', ports: '.port', cyd2: '.cyd2', joy: '#joy', keys: '.kp-key', traps: '.trap', toggles: '.gtoggle' };
    const out = { scrollH: se.scrollHeight, clientH: se.clientHeight, scrollX: se.scrollWidth - vw, scrollY: se.scrollTop, bad: [], rects: {} };
    const all = [];
    for (const [k, q] of Object.entries(sel)) {
      const els = [...document.querySelectorAll(q)];
      out.rects[k] = els.map((e) => { const r = e.getBoundingClientRect(); all.push([k, e, r]);
        if (!(r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= vh + 2 && r.right <= vw + 2)) out.bad.push(k);
        return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
      out[k + 'N'] = els.length;
    }
    out.overlap = [];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const [ka, ea, a] = all[i], [kb, eb, b] = all[j];
      if (ea.contains(eb) || eb.contains(ea)) continue;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.overlap.push(ka + '/' + kb);
    }
    out.wsW = out.rects.ws[0][2]; out.wsLeds = document.querySelectorAll('#bar i').length;
    out.ledW = Math.round(document.querySelector('#bar i').getBoundingClientRect().width);
    out.replayH = out.rects.replay[0][3];
    out.pill = !document.querySelector('#scrollPill').hidden;
    return out;
  });
  R.layout[tag] = { scrollH: m.scrollH, clientH: m.clientH, spkL: m.rects.spk[0], cyd1: m.rects.cyd1[0], spkR: m.rects.spk[1], ws: m.rects.ws[0], replay: m.rects.replay[0], serial: m.rects.serial[0], jacks: m.rects.jacks, locks: m.rects.locks, keypadFirst: m.rects.keys[0], keypadLast: m.rects.keys[15], traps: m.rects.traps, toggles: m.rects.toggles, joy: m.rects.joy[0], cyd2: m.rects.cyd2[0] };
  ok(`${tag} : Mallette sans défilement vertical`, m.scrollH <= m.clientH + 4 && m.scrollY === 0, { scrollH: m.scrollH, clientH: m.clientH });
  ok(`${tag} : pas de débordement horizontal`, m.scrollX <= 0, m.scrollX);
  ok(`${tag} : toutes les commandes dans le premier écran`, m.bad.length === 0 && m.encN === 4 && m.keysN === 16 && m.trapsN === 3 && m.jacksN === 5 && m.locksN === 3 && m.togglesN === 2 && m.spkN === 2 && m.serialN === 1 && m.portsN === 5, [...new Set(m.bad)]);
  await cablesPlugged(p, tag);
  const sp = m.rects.spk, c1 = m.rects.cyd1[0];
  ok(`${tag} : couvercle symétrique [SPK-L | CYD 1 | SPK-R]`, sp[0][0] + sp[0][2] <= c1[0] && sp[1][0] >= c1[0] + c1[2] && Math.abs((c1[0] - sp[0][0] - sp[0][2]) - (sp[1][0] - c1[0] - c1[2])) <= 4 && Math.abs(sp[0][1] - sp[1][1]) <= 2, { sp, c1 });
  ok(`${tag} : aucune commande ne se chevauche`, m.overlap.length === 0, m.overlap.slice(0, 6));
  ok(`${tag} : WS2812B 8 LED, largeur >= 120 px`, m.wsLeds === 8 && m.wsW >= 120 && m.ledW >= 10, { w: m.wsW, led: m.ledW });
  ok(`${tag} : Réécouter >= 44 px de haut`, m.replayH >= 44, m.replayH);
  ok(`${tag} : pas d'indicateur de défilement quand tout tient`, !m.pill);
}

// structure : une seule vue, tout dans la valise, aucun bouton rond TRANSMIT
async function structure(p, tag) {
  const r = await D(p, () => ({
    tabs: document.querySelectorAll('.face-tab, .faces, [role="tablist"], #face-dessus, #face-flancs, #tab-dessus, #tab-flancs').length,
    transmit: document.querySelectorAll('#transmit, .transmit, .tx-guard').length,
    outside: ['#serialPlate', '#jacks', '#keyRow', '#gtArm', '#gtTx', '.spk-l', '.spk-r'].every((q) => document.querySelector('#face-mallette ' + q)),
    lidHas: ['.spk-l', '#cyd1', '.spk-r', '#bar', '#btnReplay', '#btnPocket', '#serialPlate', '#jacks'].every((q) => document.querySelector('.lid ' + q)),
    baseHas: ['.tm-small', '.oled', '#encRow', '.cyd2', '#joy', '#keypad', '#traps', '#keyRow', '#gtArm', '#gtTx'].every((q) => document.querySelector('.base ' + q)),
    baseGrill: document.querySelectorAll('.base .grill, .base .spk').length,
    txt: document.body.innerText,
  }));
  ok(`${tag} : aucun onglet Dessus / Flanc`, r.tabs === 0 && !/\bDESSUS\b|\bFLANC\b/i.test(r.txt), r.tabs);
  ok(`${tag} : aucun bouton TRANSMIT rond`, r.transmit === 0);
  ok(`${tag} : plaque, fiches, serrures, leviers, haut-parleurs dans la valise`, r.outside && r.lidHas && r.baseHas && r.baseGrill === 0);
}
// joystick : 4 directions, normal puis sabotage (axes inversés), dans le labyrinthe courant
async function joy16(p, tag) {
  const st0 = await D(p, () => ({ step: __entiteDebug.state.step, pos: __entiteDebug.state.pos && __entiteDebug.state.pos.slice() }));
  const run = await D(p, () => JSON.parse(JSON.stringify(__entiteDebug.run)));
  const maze = st0.step === 9 ? run.maze2 : run.maze1;
  const inv = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const res = {};
  for (const sab of [false, true]) {
    if (sab) await D(p, () => __entiteDebug.forceSabotage(true)); else await D(p, () => __entiteDebug.forceSabotage(false));
    for (const d of ['up', 'down', 'left', 'right']) {
      let cell = null;
      for (let y = 0; y < maze.n && !cell; y++) for (let x = 0; x < maze.n && !cell; x++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (canMove(maze, [x, y], d) && !(nx === maze.goal[0] && ny === maze.goal[1])) cell = [x, y];
      }
      await D(p, (c) => { __entiteDebug.state.pos = c; }, cell);
      await p.tap(`.joy-dir.${sab ? inv[d] : d}`); await W(p, 60);
      const pos = await D(p, () => __entiteDebug.state.pos.slice());
      res[(sab ? 'sab-' : '') + d] = pos[0] === cell[0] + DIRS[d][0] && pos[1] === cell[1] + DIRS[d][1];
    }
  }
  await D(p, () => __entiteDebug.forceSabotage(false));
  await D(p, (c) => { __entiteDebug.state.pos = c; }, st0.pos);
  R.joystick = R.joystick || {}; R.joystick[tag] = res;
  ok(`${tag} : joystick 4 directions normal + 4 en sabotage`, Object.values(res).length === 8 && Object.values(res).every(Boolean), res);
}
// démarrage : la mallette est ouverte tout de suite ; capot bleu levé puis levier ARM
async function arm(p, tapFn) {
  await tapFn('#btnStart'); await W(p, 500);
  ok('armement : capot bleu fermé, levier verrouillé', await D(p, () => __entiteDebug.state.phase === 'arm-toggle' && document.querySelector('#leverArm').disabled));
  await tapFn('#coverArm'); await W(p, 300);
  await tapFn('#leverArm'); await W(p, 1300);
}

// câbles : 5 câbles de couleur, chacun part d'un port de la BASE et entre par-dessous dans sa douille du COUVERCLE
async function cablesPlugged(p, tag) {
  await W(p, 500);
  const c = await D(p, () => ({ geo: __entiteDebug.cables(), n: document.querySelectorAll('#cables .cable').length, dom: [...document.querySelectorAll('#cables .cable')].map((g) => getComputedStyle(g.querySelector('.c-core')).stroke) }));
  const plugged = c.geo.filter((k) => !k.pulled);
  const okGeo = plugged.every((k) => Math.hypot(k.plug[0] - k.socket[0], k.plug[1] - k.socket[1]) < 1.5 && (k.stacked ? k.port[1] > k.hinge && k.socket[1] < k.hinge : k.port[0] > k.hinge && k.socket[0] < k.hinge) && (k.stacked ? k.tail[1] > k.socket[1] : k.tail[1] > k.socket[1]));
  R.cables = R.cables || {}; R.cables[tag] = c.geo.map((k) => ({ i: k.i, c: k.color, socket: k.socket, port: k.port, plug: k.plug, pulled: k.pulled }));
  ok(`${tag} : 5 câbles base → couvercle, fiches dans les douilles`, c.n === 5 && c.geo.length === 5 && plugged.length >= 4 && okGeo, c.geo);
  ok(`${tag} : câbles de couleur (bleu #2b7cff, noir #17181b distincts)`, new Set(c.dom).size >= 2 && c.dom.every((s) => s && s !== 'none'), c.dom);
}
async function cableDropped(p, tag, i) {
  await W(p, 600);
  const r = await D(p, (k) => ({ geo: __entiteDebug.cables()[k], empty: document.querySelector(`.jack[data-i="${k}"]`).classList.contains('pulled') }), i);
  const k = r.geo, onBase = k.stacked ? k.plug[1] > k.hinge && k.tail[1] > k.hinge : k.plug[0] > k.hinge && k.tail[0] > k.hinge;
  ok(`${tag} : câble ${i + 1} débranché → douille vide, fiche retombée côté base`, k.pulled && r.empty && onBase && Math.hypot(k.plug[0] - k.socket[0], k.plug[1] - k.socket[1]) > 20, k);
}
// KY-040 : vrais gestes sur le bouton (aucun + / −)
async function knobCenter(p, i) { return D(p, (k) => { const r = document.querySelector(`.enc[data-i="${k}"] .knob`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, l: r.left }; }, i); }
const encV = (p, i) => D(p, (k) => __entiteDebug.state.enc[k], i);
async function wheel(p, i, n) { const c = await knobCenter(p, i); await p.mouse.move(c.x, c.y); for (let k = 0; k < Math.abs(n); k++) { await p.mouse.wheel(0, n > 0 ? -60 : 60); await W(p, 25); } }
async function touchDrag(p, cdp, i, dx) {
  const c = await knobCenter(p, i);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] });
  for (let k = 1; k <= 10; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + (dx * k) / 10, y: c.y + 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await W(p, 60);
}
async function twist(p, i, deg) {
  const c = await knobCenter(p, i), r = c.w * 0.36, a0 = -90;
  await p.mouse.move(c.x + r * Math.cos(a0 * Math.PI / 180), c.y + r * Math.sin(a0 * Math.PI / 180)); await p.mouse.down();
  for (let k = 1; k <= 18; k++) { const a = (a0 + (deg * k) / 18) * Math.PI / 180; await p.mouse.move(c.x + r * Math.cos(a), c.y + r * Math.sin(a)); }
  await p.mouse.up(); await W(p, 60);
}
// compose une valeur sur les 4 encodeurs avec la molette (chemin le plus court sur l'anneau)
async function setEncWheel(p, target) {
  const n = await D(p, () => (__entiteDebug.state.encMode === 'alpha' ? 20 : 10));
  for (let i = 0; i < 4; i++) { const cur = await encV(p, i); const d = (target[i] - cur + n) % n; await wheel(p, i, d <= n / 2 ? d : d - n); }
}

// ================= portrait : partie complète =================
try {
  const { ctx, p, errs, reqs } = await page({ width: 412, height: 915 });
  ok('aucun RFID ni badge (DOM)', await D(p, () => !document.querySelector('.badge, .rf-ring, [class*="rfid" i], [id*="rfid" i]') && !/RFID|badge|RC522/i.test(document.body.innerText + document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, ''))));
  ok('pas de manuel.html', await D(p, () => !document.querySelector('a[href*="manuel"]')));
  await p.screenshot({ path: shots + '00-accueil-412.png' });
  await arm(p, (q) => p.tap(q));
  const run = await D(p, () => JSON.parse(JSON.stringify(__entiteDebug.run)));
  R.seed = run.seed; R.tier = run.tier; R.serial = run.serial;
  ok('partie lancée, étape 1, levier ARM basculé (DEL verte)', await D(p, () => __entiteDebug.state.phase === 'play' && __entiteDebug.state.step === 1 && document.querySelector('#gtArm').classList.contains('on') && document.querySelector('#leverArm').getAttribute('aria-checked') === 'true'));
  await structure(p, '412x915');
  await fold(p, '412x915'); await p.screenshot({ path: shots + '01-mallette-412.png' });
  ok('HUD : libellé « prob. échec »', await D(p, () => /prob\. échec/i.test(document.querySelector('#hud').innerText)));
  const step = () => D(p, () => __entiteDebug.state.step);
  const st = () => D(p, () => ({ step: __entiteDebug.state.step, errors: __entiteDebug.state.errors, rem: __entiteDebug.state.remaining }));
  const cdp = await ctx.newCDPSession(p);
  const keys = async (s) => { for (const c of s) { await p.tap(`.kp-key[data-k="${c}"]`); } };
  const inv = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const walk = async (path) => {
    for (const d of path) { const sab = await D(p, () => __entiteDebug.state.sabotage); await p.tap(`.joy-dir.${sab ? inv[d] : d}`); }
  };

  // KY-040 : aucun bouton + / −, le bouton lui-même se tourne
  const encDom = await D(p, () => ({ steps: document.querySelectorAll('.enc-step, .enc button:not(.knob)').length, txt: document.querySelector('#encRow').innerText.replace(/E\d/g, '').trim(), knobs: [...document.querySelectorAll('.knob')].map((k) => { const r = k.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(k).touchAction]; }), ring: !!document.querySelector('.knob .knob-ring') }));
  ok('KY-040 : 0 bouton + / − autour des encodeurs', encDom.steps === 0 && !/[+−-]/.test(encDom.txt), encDom);
  ok('KY-040 : bouton ≥ 48 px, touch-action none, anneau de crans', encDom.knobs.length === 4 && encDom.knobs.every(([w, h, t]) => w >= 48 && h >= 48 && t === 'none') && encDom.ring, encDom.knobs);
  ok('étape 1 : encodeurs en mode chiffres (0-9)', await D(p, () => __entiteDebug.state.encMode === 'digit' && document.querySelector('.knob').getAttribute('aria-valuemax') === '9'));
  const kg = {};
  let v0 = await encV(p, 0); await wheel(p, 0, 1); kg.wheelUp = (await encV(p, 0)) === (v0 + 1) % 10;
  v0 = await encV(p, 0); await wheel(p, 0, -1); kg.wheelDown = (await encV(p, 0)) === (v0 + 9) % 10;
  v0 = await encV(p, 1); await touchDrag(p, cdp, 1, 50); kg.dragRight2 = (await encV(p, 1)) === (v0 + 2) % 10;
  v0 = await encV(p, 1); await touchDrag(p, cdp, 1, -45); kg.dragLeft2 = (await encV(p, 1)) === (v0 + 8) % 10;
  v0 = await encV(p, 2); const raw0 = await D(p, () => __entiteDebug.state.encRaw[2]); await twist(p, 2, 95);
  const raw1 = await D(p, () => __entiteDebug.state.encRaw[2]); kg.twist90 = raw1 - raw0 === 5 && (await encV(p, 2)) === (v0 + 5) % 10;
  v0 = await encV(p, 3); { const c = await knobCenter(p, 3); await p.touchscreen.tap(c.l + c.w * 0.12, c.y); } await W(p, 60); kg.tapLeft = (await encV(p, 3)) === (v0 + 9) % 10;
  v0 = await encV(p, 3); { const c = await knobCenter(p, 3); await p.touchscreen.tap(c.l + c.w * 0.88, c.y); } await W(p, 60); kg.tapRight = (await encV(p, 3)) === (v0 + 1) % 10;
  await p.focus('.enc[data-i="0"] .knob'); v0 = await encV(p, 0); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft'); kg.keys = (await encV(p, 0)) === (v0 + 1) % 10;
  kg.notch18 = await D(p, () => { const st = __entiteDebug.state; return [...document.querySelectorAll('.knob-cap')].every((c, i) => c.style.transform === `rotate(${st.encRaw[i] * 18}deg)`); });
  const e0 = await st(); { const c = await knobCenter(p, 2); await p.touchscreen.tap(c.x, c.y); } await W(p, 80); const e1 = await st();
  kg.centerClick = e1.errors === e0.errors + 1 && e1.step === 1;  // clic au centre = valider (ici faux : −5 s)
  R.knob = kg;
  ok('KY-040 : molette, glisser au doigt, torsion (18°/cran), bords −1/+1, clavier, clic au centre', Object.values(kg).every(Boolean), kg);
  // 1. encodeurs (et mensonge quand deux encodeurs sont justes)
  await setEncWheel(p, run.enc1); await W(p, 450);
  const liarSeen = await D(p, () => document.querySelector('#cyd1').classList.contains('liar'));
  { const c = await knobCenter(p, 0); await p.touchscreen.tap(c.x, c.y); } await W(p, 500);
  ok('1 encodeurs → 2', (await step()) === 2);
  ok('mensonge : œil rouge pendant la réplique', liarSeen || (await D(p, () => __entiteDebug.voiceLog.some((v) => v.lie))));
  // raccourci TRANSMIT trop tôt = erreur (-8 s)
  const before = await st(); await p.tap('#coverTx'); await W(p, 200); await p.tap('#leverTx'); await W(p, 100); const after = await st();
  ok('levier rouge TRANSMIT trop tôt = −8 s + 1 erreur, le levier retombe', after.errors === before.errors + 1 && before.rem - after.rem >= 7.9 && after.step === before.step && !(await D(p, () => document.querySelector('#gtTx').classList.contains('on'))), { before, after });
  await p.tap('#coverTx'); await W(p, 200);
  // 2. trappe
  await p.tap(`.trap[data-i="${run.trap}"] .trap-door`); await W(p, 500);
  ok('2 trappe → 3', (await step()) === 3);
  // 3. séquence lumineuse sur le clavier
  await keys(run.seqCode); await W(p, 500);
  ok('3 séquence → 4', (await step()) === 4);
  // 4. fils (flanc)
  await p.tap(`.jack[data-i="${run.wires1.cut}"] .plug`); await W(p, 500);
  ok('4 fils → 5', (await step()) === 5);
  await cableDropped(p, '412x915', run.wires1.cut);
  await joy16(p, '412x915');
  // 5. verrou de signal
  await walk(run.maze1.path); await W(p, 500);
  ok('5 verrou → 6', (await step()) === 6);
  // aucune réponse écrite à l'écran (code, séquence, fragments)
  const txt = await D(p, () => document.body.innerText.replace(/\s+/g, ''));
  ok('aucun code ni consigne écrit', !txt.includes(run.code1) && !txt.includes(run.seqCode) && !/Fragment|Règle|débranche/i.test(txt), { code: run.code1 });
  // 6. code 1
  await keys(run.code1); await W(p, 600);
  ok('6 code 1 → 7', (await step()) === 7);
  // 7. clés (dessus)
  for (const k of run.keyOrder) await p.tap(`.lock.key[data-key="${k}"] .lock-btn`, { timeout: 4000 });
  await W(p, 500);
  ok('7 clés → 8', (await step()) === 8);
  // hésitation : 15 s sans geste → le temps accélère
  await D(p, () => __entiteDebug.idle(16000)); await W(p, 200);
  const hes = await D(p, () => ({ h: __entiteDebug.state.hesitating, r: __entiteDebug.state.rate, cls: document.body.classList.contains('hesitate') }));
  ok('hésitation : chrono x1,6', hes.h && hes.r === 1.6 && hes.cls, hes);
  // 8. cryptex : anneau de 20 lettres, mot de 4 lettres épelé par l'Entité
  const cx = await D(p, () => ({ mode: __entiteDebug.state.encMode, max: document.querySelector('.knob').getAttribute('aria-valuemax'), RING: __entiteDebug.RING, det: __entiteDebug.DETENTS, oled: document.querySelector('#oledText').textContent, body: document.body.innerText.replace(/\s+/g, '') }));
  ok('anneau cryptex = ABCDEFGHIJLMNOPRSTUV (20 crans = 1 tour, sans K Q W X Y Z)', cx.RING === 'ABCDEFGHIJLMNOPRSTUV' && RING === cx.RING && cx.det === 20 && !/[KQWXYZ]/.test(cx.RING), cx.RING);
  ok('étape 8 : encodeurs en mode lettres (A-V) sur l’OLED', cx.mode === 'alpha' && cx.max === '19' && /^Encodeurs [A-V] [A-V] [A-V] [A-V]$/.test(cx.oled), cx);
  ok('mot de 4 lettres français, toutes sur l’anneau (ni FEUX ni ZONE)', WORDS.includes(run.word) && run.word.length === 4 && [...run.word].every((ch) => RING.includes(ch)) && !WORDS.includes('FEUX') && !WORDS.includes('ZONE') && run.enc2.every((v, k) => RING[v] === run.word[k]), run.word);
  ok('mot jamais écrit à l’écran avant d’être composé', !cx.body.includes(run.word) && !cx.oled.replace(/\s/g, '').includes(run.word));
  const vlog8 = await D(p, () => __entiteDebug.voiceLog.map((v) => v.ids));
  const spellIds = run.spell.split('').map((ch) => `lettre_${ch.toLowerCase()}`);
  ok('l’Entité épelle le mot (voix : clue_mot_* + 4 lettres)', vlog8.some((ids) => /^clue_mot_(ordre|envers)$/.test(ids[0]) && ids.slice(1).join() === spellIds.join()), { spell: run.spell });
  // un tour complet (20 crans) ramène la même lettre ; le repère a fait 360°
  { const a = await encV(p, 3), r0 = await D(p, () => __entiteDebug.state.encRaw[3]); await wheel(p, 3, 20);
    const b2 = await encV(p, 3), r1 = await D(p, () => __entiteDebug.state.encRaw[3]);
    ok('20 crans = 1 tour complet = même lettre (repère 360°)', a === b2 && r1 - r0 === 20, { a, b2, r0, r1 }); }
  // compose 2 lettres (molette), photo avec câble retombé, puis le reste
  await setEncWheel(p, [run.enc2[0], run.enc2[1], await encV(p, 2), await encV(p, 3)]);
  await p.tap(`.jack[data-i="${(run.wires1.cut + 2) % 5}"] .plug`); await W(p, 250); // mauvais câble : retombe sur la base, −8 s, puis l'Entité le rebranche
  const drop2 = await D(p, () => __entiteDebug.cables().filter((c) => c.pulled).length);
  await p.screenshot({ path: shots + '02-mallette-412-cryptex-unplug.png' });
  ok('capture cryptex : 2 câbles débranchés posés sur la base', drop2 === 2, drop2);
  await W(p, 900);
  await setEncWheel(p, run.enc2);
  ok('OLED : le mot composé s’affiche en lettres', (await D(p, () => document.querySelector('#oledText').textContent)) === `Encodeurs ${run.word.split('').join(' ')}`);
  { const c = await knobCenter(p, 1); await p.touchscreen.tap(c.x, c.y); } await W(p, 500);
  ok('hésitation levée au geste', await D(p, () => !__entiteDebug.state.hesitating && __entiteDebug.state.rate === 1));
  ok('8 cryptex (mot) → 9', (await step()) === 9);
  // 9. verrou saboté : axes inversés quand l'œil est rouge
  await D(p, () => __entiteDebug.forceSabotage(true)); await W(p, 150);
  const d0 = run.maze2.path[0], p0 = await D(p, () => __entiteDebug.state.pos.slice());
  await p.tap(`.joy-dir.${inv[d0]}`); await W(p, 100);
  const p1 = await D(p, () => __entiteDebug.state.pos.slice());
  const dv = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d0];
  ok('sabotage : axes inversés', p1[0] === p0[0] + dv[0] && p1[1] === p0[1] + dv[1], { p0, p1, d0 });
  ok('sabotage : œil rouge + CYD 2 rouge', await D(p, () => document.querySelector('.cyd2').classList.contains('sab')));
  await D(p, () => __entiteDebug.forceSabotage(false));
  await walk(run.maze2.path.slice(1)); await W(p, 500);
  ok('9 verrou saboté → 10', (await step()) === 10);
  // 10. fils 2
  await cablesPlugged(p, '412x915 étape 10');
  await p.tap(`.jack[data-i="${run.wires2.cut}"] .plug`); await W(p, 500);
  ok('10 fils 2 → 11', (await step()) === 11);
  await cableDropped(p, '412x915 étape 10', run.wires2.cut);
  // 11. code 2
  await keys(run.code2); await W(p, 500);
  ok('11 code 2 → 12', (await step()) === 12);
  // 12. capot rouge levé puis levier TRANSMIT basculé
  await p.tap('#coverTx'); await W(p, 250); await p.tap('#leverTx'); await W(p, 3000);
  ok('12 levier rouge TRANSMIT → victoire', await D(p, () => __entiteDebug.state.result === 'win' && !document.querySelector('#end').hidden));
  ok('mallette sans débordement', (await overflow(p)) <= 0);
  const vl = await D(p, () => __entiteDebug.voiceLog);
  R.voix = { repliques: vl.length, mensonges: vl.filter((v) => v.lie).length, modes: [...new Set(vl.map((v) => v.mode))], intro: vl.find((v) => v.ids[0] === 'intro')?.mode, depart: vl.find((v) => v.ids[0] === 'depart')?.mode };
  ok('voix ElevenLabs intro + depart jouées en mp3', R.voix.intro === 'mp3' && R.voix.depart === 'mp3', R.voix);
  ok('aucune requête vers un mp3 non prêt', !reqs.some((u) => /voix\/(?!intro|depart)[^/]+\.mp3/.test(u)));
  R.errors.push(...errs.map((e) => 'portrait ' + e));
  R.result = await D(p, () => ({ errors: __entiteDebug.state.errors, remaining: Math.round(__entiteDebug.state.remaining) }));
  await ctx.close();
} catch (e) { R.checks['portrait : exception'] = 'FAIL ' + e.message.split('\n')[0]; }

// ================= paysage 915x412 =================
{
  const { ctx, p, errs } = await page({ width: 915, height: 412 });
  ok('paysage accueil sans débordement', (await overflow(p)) <= 0);
  await arm(p, (q) => p.tap(q));
  ok('paysage mallette sans débordement', (await overflow(p)) <= 0);
  await fold(p, '915x412'); await structure(p, '915x412');
  await D(p, () => { __entiteDebug.state.step = 5; __entiteDebug.state.pos = __entiteDebug.run.maze1.start.slice(); });
  await joy16(p, '915x412');
  await D(p, () => { __entiteDebug.state.step = 1; });
  const vis = await D(p, () => ['#eye', '#btnReplay', '.knob', '#cyd2', '#joy', '#keypad', '#gtTx', '#gtArm', '#jacks', '#serialPlate'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, r.width > 0 && r.left >= 0 && r.right <= innerWidth + 0.5]; }));
  ok('paysage : commandes clés visibles en largeur', vis.every((v) => v[1]), vis);
  const small = await D(p, () => [...document.querySelectorAll('#face-mallette button, .icon-btn')].filter((e) => e.offsetParent && !e.hidden && !e.matches('.gtoggle.open .gt-cover')).map((e) => { const r = e.getBoundingClientRect(); return [e.className, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 32 || h < 32));
  ok('cibles tactiles ≥ 32 px (44 px visé)', small.length === 0, small);
  await p.screenshot({ path: shots + '03-mallette-915x412.png' });
  const lrun = await D(p, () => JSON.parse(JSON.stringify(__entiteDebug.run)));
  await D(p, () => { __entiteDebug.state.step = 4; });
  await p.tap(`.jack[data-i="${lrun.wires1.cut}"] .plug`);
  await cableDropped(p, '915x412', lrun.wires1.cut);
  ok('915x412 : toujours 0 débordement après débranchement', (await overflow(p)) <= 0 && (await D(p, () => document.scrollingElement.scrollHeight <= innerHeight + 2)));
  await p.screenshot({ path: shots + '03b-mallette-915x412-unplug.png' });
  R.errors.push(...errs.map((e) => 'paysage ' + e));
  await ctx.close();
}

// ================= bureau 1280x800 =================
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('page: ' + e.message));
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
  await p.goto(`${base}?seed=${SEED}&debug=1`);
  await p.waitForSelector('#btnStart:not([disabled])', { timeout: 20000 }); await p.waitForSelector('#boot', { state: 'hidden' });
  await arm(p, (q) => p.click(q));
  await fold(p, '1280x800'); await structure(p, '1280x800');
  await p.screenshot({ path: shots + '04-mallette-1280x800.png' });
  { const v0 = await D(p, () => __entiteDebug.state.enc[0]); const r = await D(p, () => { const b = document.querySelector('.enc[data-i="0"] .knob').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await p.mouse.move(r[0], r[1]); await p.mouse.down(); for (let k = 1; k <= 8; k++) await p.mouse.move(r[0] + k * 5, r[1]); await p.mouse.up(); await W(p, 60);
    const v1 = await D(p, () => __entiteDebug.state.enc[0]); ok('bureau : glisser à la souris = 2 crans', v1 === (v0 + 2) % 10, { v0, v1 }); }
  const dl = await D(p, () => __entiteDebug.state.step); await D(p, () => { __entiteDebug.state.step = 4; });
  const drun = await D(p, () => __entiteDebug.run.wires1.cut); await p.click(`.jack[data-i="${drun}"] .plug`);
  await cableDropped(p, '1280x800', drun);
  R.errors.push(...errs.map((e) => 'bureau ' + e));
  await ctx.close();
}
// ================= très petit téléphone 320 px =================
{
  const { ctx, p } = await page({ width: 320, height: 640 });
  await arm(p, (q) => p.tap(q));
  const m = await D(p, () => {
    const els = [...document.querySelectorAll('.spk-cone, #cyd1, #bar, #btnReplay, #btnPocket, #serialPlate, .jack, .tm-small, .oled, .knob, .cyd2, #joy, .kp-key, .trap, .gtoggle, .lock.key, .port')];
    const R2 = els.map((e) => e.getBoundingClientRect()), o = [];
    for (let i = 0; i < R2.length; i++) for (let j = i + 1; j < R2.length; j++) { if (els[i].contains(els[j]) || els[j].contains(els[i])) continue; const a = R2[i], b = R2[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) o.push(els[i].className + '/' + els[j].className); }
    return { sw: document.scrollingElement.scrollWidth, o };
  });
  ok('320x640 : 0 débordement horizontal, 0 chevauchement', m.sw <= 320 && m.o.length === 0, m);
  await ctx.close();
}
// ================= écran très court : l'indicateur de défilement apparaît, puis disparaît en bas =================
{
  const ctx = await b.newContext({ viewport: { width: 360, height: 600 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.goto(`${base}?seed=${SEED}&debug=1`);
  await p.waitForSelector('#btnStart:not([disabled])', { timeout: 20000 }); await p.waitForSelector('#boot', { state: 'hidden' });
  await arm(p, (q) => p.tap(q));
  await D(p, () => scrollTo(0, 0)); await W(p, 300);
  const shown = await D(p, () => !document.querySelector('#scrollPill').hidden);
  await D(p, () => scrollTo(0, document.scrollingElement.scrollHeight)); await W(p, 300);
  const gone = await D(p, () => document.querySelector('#scrollPill').hidden);
  ok('360x600 : « ↓ COMMANDES » visible si ça déborde, caché une fois en bas', shown && gone, { shown, gone });
  await ctx.close();
}

// ================= fichiers servis =================
{
  const ctx = await b.newContext();
  const size = async (u) => { const r = await ctx.request.get(base + u); return [r.status(), (await r.body()).length]; };
  R.fichiers = { 'voix/intro.mp3': await size('voix/intro.mp3'), 'voix/depart.mp3': await size('voix/depart.mp3'), 'audio/tension.mp3': await size('audio/tension.mp3'), 'manuel.html': (await size('manuel.html'))[0] };
  ok('intro 41318 B', R.fichiers['voix/intro.mp3'][0] === 200 && R.fichiers['voix/intro.mp3'][1] === 41318);
  ok('depart 63783 B', R.fichiers['voix/depart.mp3'][0] === 200 && R.fichiers['voix/depart.mp3'][1] === 63783);
  ok('tension 192827 B', R.fichiers['audio/tension.mp3'][0] === 200 && R.fichiers['audio/tension.mp3'][1] === 192827);
  ok('manuel.html absent', R.fichiers['manuel.html'] === 404);
  const man = await (await ctx.request.get(base + 'voix/manifest.json')).json();
  const ready = man.cues.filter((c) => c.mp3Ready).map((c) => c.id);
  ok('manifeste : seuls intro + depart prêts (ElevenLabs)', ready.join() === 'intro,depart' && man.cues.filter((c) => c.mp3Ready).every((c) => c.source === 'elevenlabs'));
  ok('manifeste : aucun badge/RFID', !man.cues.some((c) => /badge|rfid/i.test(c.id + c.text)));
  ok('manifeste : ni « gros bouton rouge », ni flanc, ni dessus, ni loquets', !man.cues.some((c) => /bouton|flanc|dessus|loquet/i.test(c.text)), man.cues.filter((c) => /bouton|flanc|dessus|loquet/i.test(c.text)).map((c) => c.id));
  ok('manifeste : le levier à capot rouge est nommé', man.cues.some((c) => c.id === 'clue_transmit' && /capot rouge/.test(c.text)) && man.cues.some((c) => c.id === 'arm_cache' && /capot bleu/.test(c.text)));
  const appjs = await (await ctx.request.get(base + 'js/app.js')).text();
  ok('app.js : VERSION 0.2.2, aucun « gros bouton rouge » ni « sur le flanc / dessus », aucun bouton + / −', !appjs.includes('enc-step') && appjs.includes("const VERSION = '0.2.2'") && !/gros bouton rouge|sur le flanc|sur le dessus/i.test(appjs));
  ok('manifeste : schéma complet', man.cues.every((c) => c.id && c.file === `voix/${c.id}.mp3` && /^\d{4}$/.test(c.dfplayerTrack) && ['intro', 'clue', 'digit', 'color', 'letter', 'taunt', 'sabotage', 'outcome'].includes(c.category) && c.text));
  R.manifeste = { repliques: man.cues.length };
  ok('manifeste : 20 lettres de l’anneau (mp3Ready false) + consignes du mot', RING.split('').every((ch) => man.cues.some((c) => c.id === `lettre_${ch.toLowerCase()}` && c.category === 'letter' && !c.mp3Ready)) && ['clue_mot_ordre', 'clue_mot_envers'].every((id) => man.cues.some((c) => c.id === id && !c.mp3Ready)) && !man.cues.some((c) => /^lettre_[kqwxyz]$/.test(c.id)) && new Set(man.cues.map((c) => c.dfplayerTrack)).size === man.cues.length && man.version === '0.2.2');
  const sw = await (await ctx.request.get(base + 'sw.js')).text();
  ok('sw : cache entite-mallette-v0.2.2 (manifeste, sans manuel, archives gardées)', sw.includes("`entite-mallette-v${VERSION}`") && sw.includes("const VERSION = '0.2.2'") && sw.includes('voix/manifest.json') && !sw.includes('manuel') && sw.includes("'entite-mallette-v015-'") && sw.includes("'entite-mallette-v016-'"));
  await ctx.close();
}
ok('0 erreur console / page / réseau', R.errors.length === 0, R.errors);
await b.close();
const fails = Object.entries(R.checks).filter(([, v]) => v !== 'PASS');
console.log(JSON.stringify(R, null, 1));
console.log(fails.length ? `ÉCHEC : ${fails.length} vérification(s)` : `PASS : ${Object.keys(R.checks).length} vérifications`);
process.exit(fails.length ? 1 : 0);
