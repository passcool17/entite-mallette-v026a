// Test v0.2.1 : une seule vue (mallette ouverte, tout à l'intérieur), partie complète avec graine (?seed=42&debug=1),
// portrait 412x915, paysage 915x412, bureau 1280x800. Vérifie : aucun onglet Dessus/Flanc, aucun bouton TRANSMIT rond,
// leviers à capot (bleu ARM, rouge TRANSMIT), plaque de série + 5 fiches + 3 serrures + 2 haut-parleurs dans la valise,
// tout dans le premier écran sans chevauchement, joystick 4 directions x 2 orientations (normal + sabotage),
// aucune réponse écrite, manifeste des voix propre, mp3 ElevenLabs aux bonnes tailles, 0 erreur console/réseau.
// Usage : node tests/v021.mjs [base] [graine]   (serveur local : python3 -m http.server 8794)
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';
import { canMove, DIRS } from '../js/game.js';
const base = process.argv[2] || 'http://127.0.0.1:8794/';
const SEED = +(process.argv[3] || 42);
const shots = process.env.SHOTS || '/workspace/qa/entite-mallette/v0.2.1-dev/';
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
    const sel = { cyd1: '#cyd1', spk: '.spk-cone', ws: '#bar', replay: '#btnReplay', pocket: '#btnPocket', serial: '#serialPlate', jacks: '.jack', locks: '.lock.key', tm: '.tm-small', oled: '.oled', enc: '.enc', cyd2: '.cyd2', joy: '#joy', keys: '.kp-key', traps: '.trap', toggles: '.gtoggle' };
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
  ok(`${tag} : toutes les commandes dans le premier écran`, m.bad.length === 0 && m.encN === 4 && m.keysN === 16 && m.trapsN === 3 && m.jacksN === 5 && m.locksN === 3 && m.togglesN === 2 && m.spkN === 2 && m.serialN === 1, [...new Set(m.bad)]);
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
  const setEnc = async (target) => {
    for (let i = 0; i < 4; i++) {
      const cur = await D(p, (k) => __entiteDebug.state.enc[k], i);
      const d = (target[i] - cur + 10) % 10, up = d <= 5, n = up ? d : 10 - d;
      for (let k = 0; k < n; k++) await p.tap(`.enc[data-i="${i}"] .enc-step.${up ? 'plus' : 'minus'}`);
    }
  };
  const keys = async (s) => { for (const c of s) { await p.tap(`.kp-key[data-k="${c}"]`); } };
  const inv = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const walk = async (path) => {
    for (const d of path) { const sab = await D(p, () => __entiteDebug.state.sabotage); await p.tap(`.joy-dir.${sab ? inv[d] : d}`); }
  };

  // 1. encodeurs (et mensonge quand deux encodeurs sont justes)
  await setEnc(run.enc1); await W(p, 450);
  const liarSeen = await D(p, () => document.querySelector('#cyd1').classList.contains('liar'));
  await p.tap('.enc[data-i="0"] .knob'); await W(p, 500);
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
  // 8. encodeurs 2
  await setEnc(run.enc2); await p.tap('.enc[data-i="1"] .knob'); await W(p, 500);
  ok('hésitation levée au geste', await D(p, () => !__entiteDebug.state.hesitating && __entiteDebug.state.rate === 1));
  ok('8 encodeurs 2 → 9', (await step()) === 9);
  // 9. verrou saboté : axes inversés quand l'œil est rouge
  await D(p, () => __entiteDebug.forceSabotage(true)); await W(p, 150);
  const d0 = run.maze2.path[0], p0 = await D(p, () => __entiteDebug.state.pos.slice());
  await p.tap(`.joy-dir.${inv[d0]}`); await W(p, 100);
  const p1 = await D(p, () => __entiteDebug.state.pos.slice());
  const dv = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d0];
  ok('sabotage : axes inversés', p1[0] === p0[0] + dv[0] && p1[1] === p0[1] + dv[1], { p0, p1, d0 });
  ok('sabotage : œil rouge + CYD 2 rouge', await D(p, () => document.querySelector('.cyd2').classList.contains('sab')));
  await p.screenshot({ path: shots + '04-mallette-412-sabotage.png' });
  await D(p, () => __entiteDebug.forceSabotage(false));
  await walk(run.maze2.path.slice(1)); await W(p, 500);
  ok('9 verrou saboté → 10', (await step()) === 10);
  // 10. fils 2
  await p.tap(`.jack[data-i="${run.wires2.cut}"] .plug`); await W(p, 500);
  ok('10 fils 2 → 11', (await step()) === 11);
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
  await p.screenshot({ path: shots + '02-mallette-915x412.png' });
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
  await p.screenshot({ path: shots + '03-mallette-1280x800.png' });
  R.errors.push(...errs.map((e) => 'bureau ' + e));
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
  ok('app.js : VERSION 0.2.1, aucun « gros bouton rouge » ni « sur le flanc / dessus »', appjs.includes("const VERSION = '0.2.1'") && !/gros bouton rouge|sur le flanc|sur le dessus/i.test(appjs));
  ok('manifeste : schéma complet', man.cues.every((c) => c.id && c.file === `voix/${c.id}.mp3` && /^\d{4}$/.test(c.dfplayerTrack) && ['intro', 'clue', 'digit', 'color', 'taunt', 'sabotage', 'outcome'].includes(c.category) && c.text));
  R.manifeste = { repliques: man.cues.length };
  const sw = await (await ctx.request.get(base + 'sw.js')).text();
  ok('sw : cache entite-mallette-v0.2.1 (manifeste, sans manuel, archives gardées)', sw.includes("`entite-mallette-v${VERSION}`") && sw.includes("const VERSION = '0.2.1'") && sw.includes('voix/manifest.json') && !sw.includes('manuel') && sw.includes("'entite-mallette-v015-'") && sw.includes("'entite-mallette-v016-'"));
  await ctx.close();
}
ok('0 erreur console / page / réseau', R.errors.length === 0, R.errors);
await b.close();
const fails = Object.entries(R.checks).filter(([, v]) => v !== 'PASS');
console.log(JSON.stringify(R, null, 1));
console.log(fails.length ? `ÉCHEC : ${fails.length} vérification(s)` : `PASS : ${Object.keys(R.checks).length} vérifications`);
process.exit(fails.length ? 1 : 0);
