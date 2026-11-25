// Test v0.2.4 : son mixé (voix PAR-DESSUS la musique, −8 dB sous la voix, volume / muet gardés), jauge batterie 3S,
// paliers moyen / difficile au hasard + variantes d'énigmes (deux parties de suite différentes, toutes solubles),
// CLARTÉ (bandeau objectif sans solution, module actif qui brille, indices 1-2-3, tutoriel, retours vert / rouge),
// joueur « débutant » simulé qui gagne sur de nombreuses graines en n'utilisant QUE ce qu'un joueur perçoit
// (répliques entendues = voiceLog, œil rouge = mensonge, plaque, barre DEL, écrans, libellés d'accessibilité visibles),
// + essentiels v0.2.3 (rotatifs lettres seulement, baie 5x5, ECG, démarrage 0 → prêt, imports ?v=, 0 erreur, 0 débordement).
// Usage : node tests/v024.mjs [base] [nbGraines]   (serveur local : python3 -m http.server 8794)
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { makeRun, sigDiff, SLOTS, POOLS, RING, DETENTS, canMove } from '../js/game.js?v=0.2.4';
import { OBJECTIVE, MODULES, GUIDE_CUES, hintCues, firstMove } from '../js/guide.js?v=0.2.4';
import { packVolts } from '../js/battery.js?v=0.2.4';
const base = process.argv[2] || 'http://127.0.0.1:8794/';
const NSIM = +(process.argv[3] || 12);
const shots = process.env.SHOTS || '/workspace/qa/entite-mallette/v0.2.4-dev/';
mkdirSync(shots, { recursive: true });
const R = { checks: {}, errors: [], sims: [] };
const ok = (k, v, extra) => { R.checks[k] = v ? 'PASS' : `FAIL${extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 600) : ''}`; if (!v) console.log('FAIL', k, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); };
const man = JSON.parse(readFileSync(new URL('../voix/manifest.json', import.meta.url)));
const TEXT = Object.fromEntries(man.cues.map((c) => [c.id, c.text]));
const COLORS = ['rouge', 'noir', 'jaune', 'vert', 'bleu'];
const nextOnRing = (ch) => RING[(RING.indexOf(ch) + 1) % DETENTS];

// ================= 1. logique pure (node) =================
{
  const N = 4000; let moyen = 0; const seen = {}; for (const k of SLOTS) seen[k] = new Set();
  for (let i = 0; i < N; i++) { const r = makeRun((i * 2654435761 + 7) >>> 0); if (r.tier === 'moyen') moyen++; for (const k of SLOTS) seen[k].add(r.v[k]); }
  R.tiers = { moyen, difficile: N - moyen };
  ok(`paliers au hasard : moyen ET difficile (~50/50 sur ${N} graines)`, moyen > N * 0.44 && moyen < N * 0.56, R.tiers);
  ok('chaque variante de chaque étape apparaît', SLOTS.every((k) => [...new Set([...POOLS[k].moyen, ...POOLS[k].difficile])].every((v) => seen[k].has(v))), Object.fromEntries(SLOTS.map((k) => [k, [...seen[k]]])));
  ok('?seed=N reproductible (même graine = même partie)', JSON.stringify(makeRun(42)) === JSON.stringify(makeRun(42)) && makeRun(42).sig !== makeRun(43).sig);
  // parties de suite (algorithme d'app.js : on retire tant que < 3 étapes diffèrent de la précédente)
  let prev = '', minDiff = 99, seed = 12345;
  for (let i = 0; i < 300; i++) { let r; let k = 0; do { seed = (seed * 1103515245 + 12345) >>> 0; r = makeRun(seed); k++; } while (k < 40 && sigDiff(r.sig, prev) < 3); if (prev) minDiff = Math.min(minDiff, sigDiff(r.sig, prev)); prev = r.sig; }
  ok('300 parties de suite : chacune diffère de la précédente sur ≥ 3 règles', minDiff >= 3, minDiff);
}
// solveur « joueur » pur : à partir de ce qui est VISIBLE (plaque, barre, liserés, couleurs des câbles) et ENTENDU
// (répliques run.cues + fragments vrais), recalcule chaque réponse sans lire les champs de solution de la partie.
function solveFromPerception(P) {
  const L = P.plate.replace('-', '').split('').filter((c) => /[A-Z]/.test(c)), D = P.plate.replace('-', '').split('').filter((c) => /\d/.test(c)).map(Number);
  const cl = (n) => P.cues[n].filter((id) => !id.startsWith('obj_'));
  const rule = (n, pre) => cl(n).find((id) => id.startsWith(pre))?.slice(pre.length);
  const out = {};
  const r1 = rule(1, 'clue_enc1_');
  out.enc1 = ({ ordre: L, envers: L.slice().reverse(), suivante: L.map(nextOnRing), paires: [L[1], L[0], L[3], L[2]] })[r1].join('');
  const cnt = {}; P.bar.forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; }); const byCount = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  const tr = rule(2, 'clue_trappe_'); const tc = ({ frequente: byCount[0], moyenne: byCount[1], rare: byCount[2], gauche: P.bar[0] })[tr];
  out.trap = P.trapColors.indexOf(tc);
  const sq = rule(3, 'clue_sequence_'); out.seq = (sq === 'envers' ? P.seq.slice().reverse() : sq === 'plus1' ? P.seq.map((d) => d + 1) : P.seq).join('');
  const patch = (n) => {
    const ids = cl(n), cabs = ids.filter((i) => i.startsWith('cable_')).map((i) => P.wires.indexOf(i.slice(6)));
    const pr = ids.find((i) => i.startsWith('prise_')), le = ids.find((i) => i.startsWith('lettre_'));
    const sock = pr ? +pr.slice(6) - 1 : le ? L.indexOf(le.slice(7).toUpperCase()) : null;
    const head = ids[0];
    if (/route|clue_patch_serie$/.test(head)) return { [cabs[0]]: sock };
    if (/echange/.test(head)) return { [cabs[0]]: cabs[1], [cabs[1]]: cabs[0] };
    if (/debranche/.test(head)) return { [cabs[0]]: null, [cabs[1]]: null };
    return { [cabs[0]]: null, [cabs[1]]: sock }; // double / couche 2 série
  };
  out.patch1 = patch(4); out.patch2 = patch(10);
  const F = P.frags;
  const c1 = cl(6)[0]; out.code1 = (c1 === 'clue_code1_envers' ? F.slice().reverse() : c1 === 'clue_code1_plus1' ? F.map((f) => (f + 1) % 10) : F).join('');
  const c2 = rule(11, 'clue_code2_'); out.code2 = (c2 === 'rotation' ? [F[2], F[3], F[0], F[1]] : c2 === 'decale' ? F.map((f) => (f + D[3]) % 10) : F.slice().reverse()).join('');
  const kr = rule(7, 'clue_cles_'); out.keys = [0, 1, 2].sort((a, b) => (kr === 'lourde' ? D[b] - D[a] : D[a] - D[b])).join('');
  const w = rule(8, 'clue_mot_'), heard = cl(8).filter((i) => i.startsWith('lettre_')).map((i) => i.slice(7).toUpperCase());
  const word = w === 'envers' ? heard.slice().reverse() : heard; out.enc2 = (w === 'suivante' ? word.map(nextOnRing) : word).join('');
  return out;
}
{
  const bad = []; let n = 0;
  for (let i = 0; i < 3000; i++) {
    const r = makeRun((i * 40503 + 99) >>> 0); n++;
    const s = solveFromPerception({ plate: r.serial, cues: r.cues, bar: r.bar, trapColors: r.trapColors, seq: r.seq, wires: r.wires, frags: r.frags });
    const reqEq = (a, b) => JSON.stringify(Object.entries(a).map(([k, v]) => [+k, v]).sort()) === JSON.stringify(Object.entries(b).map(([k, v]) => [+k, v]).sort());
    const good = s.enc1 === r.enc1.map((v) => RING[v]).join('') && s.trap === r.trap && s.seq === r.seqCode && reqEq(s.patch1, r.patch1.req) && reqEq(s.patch2, r.patch2.req)
      && s.code1 === r.code1 && s.code2 === r.code2 && s.keys === r.keyOrder.join('') && s.enc2 === r.enc2.map((v) => RING[v]).join('')
      && /^\d{4}$/.test(r.code1) && /^\d{4}$/.test(r.code2) && /^[2-9]{4}$|^[1-8]{4}$/.test(r.seqCode) && r.maze1.path.length && r.maze2.path.length
      && Object.entries(r.patch1.req).some(([c, sk]) => +c !== sk) && Object.entries(r.patch2.req).some(([c, sk]) => +c !== sk)
      && new Set(Object.values(r.patch1.req).filter((x) => x != null)).size === Object.values(r.patch1.req).filter((x) => x != null).length;
    if (!good) bad.push({ seed: r.seed, sig: r.sig, s, want: { enc1: r.enc1.map((v) => RING[v]).join(''), trap: r.trap, seq: r.seqCode, p1: r.patch1.req, p2: r.patch2.req, c1: r.code1, c2: r.code2, keys: r.keyOrder, enc2: r.enc2.map((v) => RING[v]).join('') } });
  }
  ok(`${n} graines : chaque variante est soluble à partir de ce qu'on voit et entend (solveur indépendant)`, bad.length === 0, bad.slice(0, 2));
  // répliques : toutes présentes, synthèse (mp3Ready false) sauf intro / depart
  const ids = new Set(man.cues.map((c) => c.id)), miss = new Set();
  for (let i = 0; i < 1500; i++) { const r = makeRun(i * 7919); for (const a of Object.values(r.cues)) a.forEach((id) => !ids.has(id) && miss.add(id)); for (let st = 0; st <= 12; st++) for (let l = 1; l <= 3; l++) hintCues(r, st, l, {}).forEach((id) => !ids.has(id) && miss.add(id)); }
  GUIDE_CUES.forEach((id) => !ids.has(id) && miss.add(id));
  ok('manifeste : toutes les répliques des variantes, objectifs et indices existent', miss.size === 0, [...miss]);
  ok('manifeste v0.2.4 : pistes DFPlayer uniques, seuls intro / depart en mp3', man.version === '0.2.4' && new Set(man.cues.map((c) => c.dfplayerTrack)).size === man.cues.length && man.cues.filter((c) => c.mp3Ready).map((c) => c.id).join() === 'intro,depart' && man.cues.every((c) => c.file === `voix/${c.id}.mp3` && c.text));
  // objectifs : quoi faire et où, jamais la solution (aucun chiffre, aucune couleur, aucune lettre isolée)
  const objTexts = [...new Set(Object.values(OBJECTIVE))].map((id) => TEXT[id]);
  const noMod = (t) => t.replace(/capot (bleu|rouge)|cercle vert/g, '');
  ok('objectifs : 1 phrase courte, sans chiffre / couleur de réponse / lettre isolée', objTexts.every((t) => t && t.length <= 48 && !/\d/.test(t) && !new RegExp(`\\b(${COLORS.join('|')})\\b`, 'i').test(noMod(t)) && !/(^|\s)[A-Z](\s|[.,]|$)/.test(t)), objTexts);
  ok('batterie 3S : 12,6 V pleine, 9,0 V vide, courbe croissante', Math.abs(packVolts(100) - 12.6) < 0.01 && Math.abs(packVolts(0) - 9) < 0.01 && [...Array(100).keys()].every((p) => packVolts(p + 1) >= packVolts(p)));
  const r42 = makeRun(42); R.seed42 = { tier: r42.tier, sig: r42.sig, serial: r42.serial };
}

// ================= 2. navigateur =================
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
async function page(vp, { query = '', tuto = true, fresh = false, track = true } = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: vp.width < 1000 ? 2 : 1, isMobile: vp.width < 1000, hasTouch: true, serviceWorkers: 'block' });
  if (tuto && !fresh) await ctx.addInitScript(() => { try { localStorage.setItem('entite-tuto-vu', '1'); } catch {} });
  const p = await ctx.newPage(); const errs = [], reqs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('page: ' + e.message));
  p.on('requestfailed', (r) => { if (!/\.mp3/.test(r.url()) || !/ERR_ABORTED/.test(r.failure()?.errorText || '')) errs.push('failed: ' + r.url() + ' ' + r.failure()?.errorText); });
  p.on('response', (r) => { reqs.push(r.url()); if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
  await p.goto(`${base}?debug=1${query}`);
  await p.waitForSelector('#btnStart:not([disabled])', { timeout: 30000 });
  await p.waitForSelector('#boot', { state: 'hidden' });
  if (track) R.errors.push = R.errors.push; // (placeholder)
  return { ctx, p, errs, reqs, done: async () => { R.errors.push(...errs); await ctx.close(); } };
}
const W = (p, ms) => p.waitForTimeout(ms);
const D = (p, f, a) => p.evaluate(f, a);
const stepNo = (p) => D(p, () => { const m = /Étape (\d+)\/12/.exec(document.querySelector('#objLabel').textContent); return m ? +m[1] : document.querySelector('#app').hidden ? -1 : 0; });
const heard = (p) => D(p, () => __entiteDebug.voiceLog.map((v) => ({ ids: v.ids, lie: v.lie })));
async function waitStep(p, n, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { const s = await D(p, () => __entiteDebug.state.phase === 'win' ? 99 : __entiteDebug.state.step); if (s === n || s === 99) return true; await W(p, 60); } return false; }

// ---------- 2a. tutoriel au premier lancement, « Passer », puis plus jamais ; rejouable via « Comment jouer »
{
  const { p, done } = await page({ width: 412, height: 915 }, { query: '&seed=42', fresh: true });
  await p.tap('#btnStart'); await W(p, 300);
  const shown = await D(p, () => !document.querySelector('#tuto').hidden && document.querySelector('#app').hidden);
  await p.tap('#tutoNext'); await W(p, 150);
  const second = await D(p, () => document.querySelector('#tutoNo').textContent === '2');
  await p.screenshot({ path: shots + 'tuto-412.png' });
  const skipBox = await (await p.$('#tutoSkip')).boundingBox();
  await p.tap('#tutoSkip'); await W(p, 700);
  const started = await D(p, () => document.querySelector('#tuto').hidden && !document.querySelector('#app').hidden && __entiteDebug.state.phase === 'arm-toggle' && localStorage.getItem('entite-tuto-vu') === '1');
  ok('tutoriel : affiché au premier lancement (5 écrans, Suivant)', shown && second);
  ok('tutoriel : « Passer » ≥ 44 px, lance la partie et retient le choix', started && skipBox.height >= 44 && skipBox.width >= 44, skipBox);
  await done();
  const { p: p2, done: d2 } = await page({ width: 412, height: 915 }, { query: '&seed=42' });
  await p2.tap('#btnHelp'); await W(p2, 200);
  const replay = await D(p2, () => !document.querySelector('#tuto').hidden);
  await p2.tap('#tutoSkip'); await W(p2, 150); await p2.tap('#btnStart'); await W(p2, 500);
  ok('tutoriel : rejouable via « Comment jouer », pas de tutoriel forcé ensuite', replay && await D(p2, () => document.querySelector('#tuto').hidden && __entiteDebug.state.phase === 'arm-toggle'));
  await d2();
}

// ---------- joueur débutant simulé : uniquement perçu (voix entendues, plaque, barre, libellés visibles)
async function playerSim(p, { useHints = false, label = '' } = {}) {
  const log = [];
  const plate = await D(p, () => document.querySelector('#serial').textContent.trim());
  const L = plate.replace('-', '').split('').filter((c) => /[A-Z]/.test(c)), Dg = plate.replace('-', '').split('').filter((c) => /\d/.test(c)).map(Number);
  const lastClue = async (pre) => { const h = await heard(p); for (let i = h.length - 1; i >= 0; i--) { if (h[i].lie) continue; const k = h[i].ids.findIndex((id) => id.startsWith(pre)); if (k >= 0) return h[i].ids.slice(k); } return null; };
  const waitClue = async (pre, ms = 8000) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const t = Date.now(); while (Date.now() - t < ms) { const c = await lastClue(pre); if (c) return c; await W(p, 60); }
      log.push('reecouter:' + pre); await p.tap('#btnReplay');   // comme un joueur : « Réécouter »
    }
    console.log('DEBUG voiceLog', pre, JSON.stringify((await heard(p)).slice(-8)), await D(p, () => JSON.stringify({ st: __entiteDebug.state.step, ph: __entiteDebug.state.phase, a: __entiteDebug.audio() })));
    return null;
  };
  const fragsHeard = async () => (await heard(p)).filter((v) => !v.lie && v.ids[0] === 'clue_fragment').map((v) => +v.ids[1].slice(8));
  const rotateTo = async (letters) => {
    for (let i = 0; i < 4; i++) {
      for (let guard = 0; guard < 25; guard++) {
        const cur = await D(p, (k) => /lettre (\w)/.exec(document.querySelectorAll('.enc .knob')[k].getAttribute('aria-valuetext'))[1], i);
        if (cur === letters[i]) break;
        const d = (RING.indexOf(letters[i]) - RING.indexOf(cur) + DETENTS) % DETENTS;
        await D(p, ([k, s]) => __entiteDebug.turn(k, s), [i, d <= 10 ? 1 : -1]);
      }
    }
    const kb = await (await p.$('.enc[data-i="0"] .knob')).boundingBox(); await p.touchscreen.tap(kb.x + kb.width / 2, kb.y + kb.height / 2);
  };
  const keys = async (code) => { for (const k of code) { await p.tap(`.kp-key[data-k="${k}"]`); await W(p, 25); } };
  const cableColors = await D(p, () => [...document.querySelectorAll('#ports .port-btn')].map((b) => /Câble (\w+)/.exec(b.getAttribute('aria-label'))[1]));
  const socketOf = (c) => D(p, (col) => { const j = [...document.querySelectorAll('#jacks .plug')].findIndex((e) => e.getAttribute('aria-label').includes(`câble ${col} branché`)); return j < 0 ? null : j; }, cableColors[c]);
  const patch = async (pre) => {
    const ids = (await waitClue(pre === 4 ? 'clue_patch' : 'clue_patch')).filter(Boolean);
    const head = ids[0], cabs = ids.filter((i) => i.startsWith('cable_')).map((i) => cableColors.indexOf(i.slice(6)));
    const pr = ids.find((i) => i.startsWith('prise_')), le = ids.find((i) => i.startsWith('lettre_'));
    const sock = pr ? +pr.slice(6) - 1 : le ? L.indexOf(le.slice(7).toUpperCase()) : null;
    let plan;
    if (/route|clue_patch_serie$/.test(head)) plan = [[cabs[0], sock]];
    else if (/echange/.test(head)) plan = [[cabs[0], await socketOf(cabs[1])], [cabs[1], await socketOf(cabs[0])]];
    else if (/debranche/.test(head)) plan = [[cabs[0], null], [cabs[1], null]];
    else plan = [[cabs[0], null], [cabs[1], sock]];
    const st = await stepNo(p);
    for (const [c, s] of plan) {
      if ((await stepNo(p)) !== st) break;
      const cur = await socketOf(c); if (cur === s) continue;
      await p.tap(`#ports .port-btn[data-c="${c}"]`); await W(p, 80);
      if (s == null) await p.tap(`#ports .port-btn[data-c="${c}"]`); else await p.tap(`#jacks .jack[data-s="${s}"] .plug`);
      await W(p, 150);
    }
    log.push(head);
  };
  const maze = async () => {
    const pos = () => D(p, () => { const m = /colonne (\d), ligne (\d)/.exec(document.querySelector('#cyd2').getAttribute('aria-label') || ''); return m ? [+m[1] - 1, +m[2] - 1] : null; });
    const sab = () => D(p, () => document.querySelector('.cyd2').classList.contains('sab'));
    const inv = { up: 'down', down: 'up', left: 'right', right: 'left' }, DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const walls = new Set(), n = 5, goal = [n - 1, 0], st = await stepNo(p);
    for (let k = 0; k < 160; k++) {
      if ((await stepNo(p)) !== st) return true;
      const c = await pos(); if (!c) { await W(p, 60); continue; }
      // plus court chemin en supposant ouvert tout ce qui n'est pas un mur connu
      const key = (q) => q.join(','), prev = new Map([[key(c), null]]), Q = [c]; let first = null;
      while (Q.length) { const u = Q.shift(); if (u[0] === goal[0] && u[1] === goal[1]) { let kk = key(u), d = null; while (prev.get(kk)) { [kk, d] = prev.get(kk); } first = d; break; }
        for (const d of Object.keys(DIR)) { const v = [u[0] + DIR[d][0], u[1] + DIR[d][1]]; if (v[0] < 0 || v[1] < 0 || v[0] >= n || v[1] >= n || walls.has(key(u) + d) || prev.has(key(v))) continue; prev.set(key(v), [key(u), d]); Q.push(v); } }
      if (!first) return false;
      const s = await sab();
      await p.tap(`.joy-dir.${s ? inv[first] : first}`); await W(p, 70);
      const c2 = await pos();
      if ((await stepNo(p)) !== st) return true;
      if (c2 && c2[0] === c[0] && c2[1] === c[1] && (await sab()) === s) walls.add(key(c) + first);
    }
    return false;
  };
  // ---- armement
  if ((await D(p, () => __entiteDebug.state.phase)) === 'arm-toggle') { await p.tap('#coverArm'); await W(p, 120); await p.tap('#leverArm'); await waitStep(p, 1); }
  for (let guard = 0; guard < 40; guard++) {
    const st = await stepNo(p); const ph = await D(p, () => __entiteDebug.state.phase);
    if (ph === 'win' || ph === 'boom') break;
    // bandeau : objectif présent, sans solution ; module actif = celui de l'étape
    const ob = await D(p, () => ({ t: document.querySelector('#objText').textContent, k: document.querySelector('#objective').className }));
    const act = await D(p, () => [...document.querySelectorAll('.active-mod')].map((e) => e.id || [...e.classList].find((c) => c !== 'cyd' && c !== 'active-mod')));
    log.push(`${st}:${act.join('+')}`);
    if (useHints) { await p.tap('#btnHint'); await W(p, 60); }
    switch (st) {
      case 1: { const c = await waitClue('clue_enc1_'); const r = c[0].slice(10); await rotateTo(({ ordre: L, envers: L.slice().reverse(), suivante: L.map(nextOnRing), paires: [L[1], L[0], L[3], L[2]] })[r]); log.push(c[0]); break; }
      case 2: {
        const c = await waitClue('clue_trappe_');
        for (let k = 0; k < 60 && await D(p, () => document.querySelector('#cyd1').classList.contains('liar')); k++) await W(p, 80);
        const LED = { '#ff3b30': 'rouge', '#36f08a': 'vert', '#3d8bff': 'bleu' };
        // comme un joueur : on lit la barre quand elle est stable (pas pendant un scintillement)
        const readBar = async () => (await D(p, () => [...document.querySelectorAll('#bar i')].map((e) => e.style.getPropertyValue('--c').trim()))).map((h) => LED[h]);
        let bar = await readBar();
        for (let k = 0; k < 40; k++) { await W(p, 150); const b2 = await readBar(); if (b2.every(Boolean) && b2.join() === bar.join()) break; bar = b2; }
        const rims = await D(p, () => [...document.querySelectorAll('.trap-door')].map((d) => /liseré (\w+)/.exec(d.getAttribute('aria-label'))[1]));
        const cnt = {}; bar.forEach((x) => { cnt[x] = (cnt[x] || 0) + 1; }); const by = Object.keys(cnt).sort((a, b2) => cnt[b2] - cnt[a]);
        const col = ({ frequente: by[0], moyenne: by[1], rare: by[2], gauche: bar[0] })[c[0].slice(12)];
        await p.tap(`.trap[data-i="${rims.indexOf(col)}"] .trap-door`); log.push(c[0]); break;
      }
      case 3: {
        const c = await waitClue('clue_sequence_'); let seq = [];
        for (let attempt = 0; attempt < 3 && seq.length < 4; attempt++) {
          seq = []; let last = -1; const t0 = Date.now();
          while (Date.now() - t0 < 6000 && seq.length < 4) {
            const on = await D(p, () => [...document.querySelectorAll('#bar i')].findIndex((e) => e.classList.contains('on') && e.style.getPropertyValue('--c').trim() === '#62d6ff'));
            if (on >= 0 && on !== last) seq.push(on + 1); last = on; await W(p, 40);
          }
          if (seq.length < 4) { await p.tap('#btnReplay'); }
        }
        const r = c[0].slice(14); await keys((r === 'envers' ? seq.slice().reverse() : r === 'plus1' ? seq.map((d) => d + 1) : seq).join('')); log.push(c[0]); break;
      }
      case 4: case 10: await patch(st); break;
      case 5: case 9: await maze(); break;
      case 6: case 11: {
        const c = await waitClue(st === 6 ? 'clue_code1' : 'clue_code2_');
        let F = (await fragsHeard()).slice(0, 4);
        if (F.length < 4) { // un fragment a été couvert par une autre réplique : l'indice 2 les redit
          while ((await D(p, () => __entiteDebug.state.hint)) < 2) { await p.tap('#btnHint'); await W(p, 80); }
          const h = await lastClue('hint_rappel_fragments'); F = h.slice(1).map((i) => +i.slice(8)); log.push('rappel-fragments');
        }
        const r = c[0];
        const code = st === 6 ? (r === 'clue_code1_envers' ? F.slice().reverse() : r === 'clue_code1_plus1' ? F.map((f) => (f + 1) % 10) : F)
          : (r === 'clue_code2_rotation' ? [F[2], F[3], F[0], F[1]] : r === 'clue_code2_decale' ? F.map((f) => (f + Dg[3]) % 10) : F.slice().reverse());
        await keys(code.join('')); log.push(r); break;
      }
      case 7: { const c = await waitClue('clue_cles_'); const ord = [0, 1, 2].sort((a, b2) => (c[0] === 'clue_cles_lourde' ? Dg[b2] - Dg[a] : Dg[a] - Dg[b2])); for (const k of ord) { await p.tap(`.lock.key[data-key="${k}"] .lock-btn`); await W(p, 60); } log.push(c[0]); break; }
      case 8: { const c = await waitClue('clue_mot_'); const hw = c.filter((i) => i.startsWith('lettre_')).map((i) => i.slice(7).toUpperCase()); const r = c[0].slice(9);
        const w = r === 'envers' ? hw.slice().reverse() : hw; await rotateTo(r === 'suivante' ? w.map(nextOnRing) : w); log.push(c[0]); break; }
      case 12: await p.tap('#coverTx'); await W(p, 120); await p.tap('#leverTx'); break;
    }
    await waitStep(p, st + 1, 9000);
  }
  const fin = await D(p, () => ({ phase: __entiteDebug.state.phase, errors: __entiteDebug.state.errors, rem: Math.round(__entiteDebug.state.remaining), sig: __entiteDebug.run.sig, tier: __entiteDebug.run.tier, seed: __entiteDebug.run.seed, hints: __entiteDebug.state.hintsUsed }));
  return { ...fin, log };
}

// ---------- 2b. graine 42 : son mixé, volume, batterie, bandeau, module actif, indices, retours, victoire
{
  const { p, reqs, errs, done } = await page({ width: 412, height: 915 }, { query: '&seed=42&voix=rapide' });
  const boot = await D(p, () => ({ ready: window.__boot?.ready, hidden: document.querySelector('#boot').hidden }));
  ok('démarrage 0 → prêt (écran de chargement fermé)', boot.ready && boot.hidden, boot);
  await p.tap('#btnStart'); await W(p, 400);
  const arm = await D(p, () => ({ obj: document.querySelector('#objText').textContent, act: [...document.querySelectorAll('.active-mod')].map((e) => e.id), hint: !document.querySelector('#btnHint').disabled }));
  ok('armement : objectif « capot bleu, puis levier », levier ARM en surbrillance, indice disponible', /capot bleu/.test(arm.obj) && arm.act.join() === 'gtArm' && arm.hint, arm);
  // batterie
  const bt = await D(p, () => { const e = document.querySelector('#batt'), s = document.querySelector('#cyd1 .screen').getBoundingClientRect(), r = e.getBoundingClientRect(); return { inScreen: e.closest('#cyd1 .screen') != null, txt: e.innerText.replace(/\s+/g, ' '), corner: r.left > s.left + s.width * 0.5 && r.bottom < s.top + s.height * 0.3, w: r.width, aria: e.getAttribute('aria-label'), ...__entiteDebug.battery() }; });
  ok('batterie : icône + % + tension sur le CYD 1, coin haut droit (l’œil reste dégagé)', bt.inScreen && /\d+ %/.test(bt.txt) && bt.corner && /Batterie \d+ %, \d+,\d volts/.test(bt.aria), bt);
  ok('batterie : départ plausible 62-100 % (nouvelle session)', bt.pct >= 61 && bt.pct <= 100 && bt.why === 'neuve', bt);
  await p.tap('#coverArm'); await W(p, 120); await p.tap('#leverArm'); await W(p, 400);
  // son mixé : la voix (depart.mp3) passe PAR-DESSUS la musique, qui baisse de 8 dB puis remonte
  const a1 = await D(p, () => __entiteDebug.audio());
  let a2 = null; for (let k = 0; k < 120; k++) { await W(p, 100); const a = await D(p, () => __entiteDebug.audio()); if (!a.ducked && a.duck > 0.97) { a2 = a; break; } }
  R.audio = { pendantVoix: a1, apres: a2, DUCK: await D(p, () => __entiteDebug.DUCK) };
  ok('son : musique atténuée −8 dB (×0,398) pendant la voix, contexte actif, limiteur + panoramiques L/R', a1.ducked && Math.abs(a1.duck - 0.398) < 0.03 && a1.music > 0 && a1.state === 'running' && a1.panners && a1.limiter <= -6, a1);
  ok('son : la musique continue et remonte à 0 dB quand la voix se tait (relâche 400 ms)', !!a2 && a2.music > 0.0005, a2);
  ok('son : depart.mp3 joué en fichier (mp3), musique tension.mp3 chargée', await D(p, () => __entiteDebug.voiceLog.some((v) => v.ids[0] === 'depart' && v.mode === 'mp3') && __entiteDebug.musicStats.fichier));
  // volume + muet gardés
  await D(p, () => __entiteDebug.setVolume(0.5)); await W(p, 250);
  const vol = await D(p, () => __entiteDebug.audio().master);
  await p.tap('#btnSon'); await W(p, 250);
  const mute = await D(p, () => ({ m: __entiteDebug.audio().master, pressed: document.querySelector('#btnSon').getAttribute('aria-pressed'), store: JSON.parse(localStorage.getItem('entite-son')) }));
  await p.tap('#btnSon'); await W(p, 250);
  const un = await D(p, () => __entiteDebug.audio().master);
  ok('volume : réglage 0,5 appliqué ; bouton son coupe / rétablit, état gardé (localStorage)', Math.abs(vol - 0.5) < 0.05 && mute.m < 0.02 && mute.pressed === 'true' && mute.store.muted === true && mute.store.volume === 0.5 && Math.abs(un - 0.5) < 0.05, { vol, mute, un });
  await D(p, () => __entiteDebug.setVolume(0.9));
  // batterie : vidange et alerte < 15 %
  const b0 = await D(p, () => __entiteDebug.battery().pct); await W(p, 4000); const b1 = await D(p, () => __entiteDebug.battery().pct);
  await D(p, () => __entiteDebug.battDip('sabotage')); const b2 = await D(p, () => __entiteDebug.battery().pct);
  ok('batterie : se vide pendant la partie (≈0,5 %/min) + chute sur un sabotage (−0,5 %)', b1 < b0 && b0 - b1 < 0.2 && Math.abs((b1 - b2) - 0.5) < 0.05, { b0, b1, b2 });
  ok('batterie : niveau gardé dans localStorage', await D(p, () => JSON.parse(localStorage.getItem('entite-batterie')).pct > 0));
  await D(p, () => __entiteDebug.setBattery(14.2)); await W(p, 700);
  const low = await D(p, () => ({ ...__entiteDebug.battery(), cls: document.querySelector('#batt').className, lvl: document.querySelector('#batt').dataset.level, anim: getComputedStyle(document.querySelector('#batt .batt-ico')).animationName }));
  await W(p, 700); const low2 = await D(p, () => __entiteDebug.battery().warnings);
  ok('batterie < 15 % : icône rouge qui clignote + 1 seul bip, aucune pénalité', low.low && /low/.test(low.cls) && low.lvl === 'low' && low.anim === 'batt-blink' && low.warnings === 1 && low2 === 1, low);
  await p.screenshot({ path: shots + 'jeu-412-batterie-faible.png' });
  await D(p, () => __entiteDebug.setBattery(80));
  // ---- étape 1 : bandeau + module actif
  const s1 = await D(p, () => ({ ...__entiteDebug.objective(), act: __entiteDebug.active() }));
  ok('étape 1 : bandeau « Étape 1/12 » + objectif court, molettes et OLED en surbrillance', /Étape 1\/12/.test(s1.label) && s1.text === TEXT[OBJECTIVE[1]] && s1.act.join() === '#encRow,#oled', s1);
  ok('étape 1 : l’Entité DIT l’objectif puis la consigne', await D(p, () => __entiteDebug.voiceLog.some((v) => v.ids[0] === 'obj_molettes_code' && v.ids[1].startsWith('clue_enc1_'))));
  // retour faux : clic au centre avec de mauvaises lettres
  const e0 = await D(p, () => __entiteDebug.state.errors);
  const kb = await (await p.$('.enc[data-i="0"] .knob')).boundingBox(); await p.touchscreen.tap(kb.x + kb.width / 2, kb.y + kb.height / 2); await W(p, 120);
  const ko = await D(p, () => ({ ...__entiteDebug.objective(), fx: document.querySelectorAll('.fx-ko').length, err: __entiteDebug.state.errors }));
  ok('retour faux : bandeau rouge « −5 s », module flashé en rouge, 1 erreur', /ko/.test(ko.kind) && /−5 s/.test(ko.text) && ko.fx >= 1 && ko.err === e0 + 1, ko);
  // indice automatique après 45 s sans progrès (horloge avancée), puis Indice 2 (−15 s) et 3 (−30 s)
  await W(p, 2100);
  const rem0 = await D(p, () => __entiteDebug.state.remaining);
  await D(p, () => __entiteDebug.ageStep(46000)); await W(p, 250);
  const h1 = await D(p, () => ({ hint: __entiteDebug.state.hint, rem: __entiteDebug.state.remaining, ...__entiteDebug.objective(), cost: document.querySelector('#hintCost').textContent, last: __entiteDebug.voiceLog.at(-1).ids }));
  ok('indice 1 automatique après 45 s sans progrès : dit + bandeau (source d’info), gratuit', h1.hint === 1 && /hint/.test(h1.kind) && rem0 - h1.rem < 2 && h1.last[0] === 'hint1_plaque' && /regarde la plaque/.test(h1.text) && h1.cost === '−15 s', h1);
  await p.screenshot({ path: shots + 'jeu-412-indice-objectif.png' });
  await p.tap('#btnHint'); await W(p, 200);
  const h2 = await D(p, () => ({ hint: __entiteDebug.state.hint, rem: __entiteDebug.state.remaining, ...__entiteDebug.objective(), cost: document.querySelector('#hintCost').textContent, last: __entiteDebug.voiceLog.at(-1).ids }));
  await p.tap('#btnHint'); await W(p, 200);
  const h3 = await D(p, () => ({ hint: __entiteDebug.state.hint, rem: __entiteDebug.state.remaining, ...__entiteDebug.objective(), dis: document.querySelector('#btnHint').disabled, last: __entiteDebug.voiceLog.at(-1).ids, want: __entiteDebug.RING[__entiteDebug.run.enc1[0]] }));
  ok('Indice 2 : −15 s, la règle expliquée (voix), coût suivant affiché −30 s', h2.hint === 2 && h1.rem - h2.rem > 14.5 && h1.rem - h2.rem < 16.5 && h2.last[0].startsWith('hint2_enc1_') && h2.cost === '−30 s' && /−15 s/.test(h2.label), h2);
  ok('Indice 3 : −30 s, dit la première lettre (jamais écrite), puis bouton épuisé', h3.hint === 3 && h2.rem - h3.rem > 29.5 && h2.rem - h3.rem < 31.5 && h3.last.join() === `hint3_molette1,lettre_${h3.want.toLowerCase()}` && h3.dis && !new RegExp(`\\b${h3.want}\\b`).test(h3.text), h3);
  R.sims.push({ seed: 42, ...(await playerSim(p, { label: 'seed42' })) });
  const s42 = R.sims.at(-1);
  ok('graine 42 : victoire complète par le joueur simulé (perception seule)', s42.phase === 'win', s42);
  ok('graine 42 : chaque étape avait son module en surbrillance = le bon module', ['1:oled+encRow', '2:traps', '3:bar+keypad', '4:jacks+ports', '5:cyd2+joy', '6:keypad', '7:keyRow', '8:oled+encRow', '9:cyd2+joy', '10:jacks+ports', '11:keypad', '12:gtTx'].every((x) => s42.log.includes(x)), s42.log.filter((x) => /^\d+:/.test(x)));
  // pas de requêtes de voix non prêtes, imports versionnés
  ok('aucun mp3 non prêt demandé (0 404), imports ?v=0.2.4 partout', !reqs.some((u) => /voix\/(?!intro|depart)\w+\.mp3/.test(u)) && reqs.filter((u) => /\/js\/\w[\w-]*\.js/.test(u)).every((u) => /\?v=0\.2\.4$/.test(u)) && reqs.some((u) => /guide\.js\?v=0\.2\.4/.test(u)) && reqs.some((u) => /battery\.js\?v=0\.2\.4/.test(u)), reqs.filter((u) => /\.js/.test(u)));
  await done();
}

// ---------- 2c. bandeau sans solution à chaque étape + module actif + mensonge : le contour reste sur le vrai module
{
  const { p, done } = await page({ width: 915, height: 412 }, { query: '&seed=7&voix=rapide' });
  await p.tap('#btnStart'); await W(p, 300); await p.tap('#coverArm'); await W(p, 120); await p.tap('#leverArm'); await W(p, 300);
  const run = await D(p, () => JSON.parse(JSON.stringify(__entiteDebug.run)));
  const spoil = [...run.serial.replace('-', '')].filter((c) => /[A-Z]/.test(c)).concat(run.word.split(''), run.encWord.split(''));
  const bad = [], wrongMod = [];
  for (let st = 1; st <= 12; st++) {
    await D(p, (n) => __entiteDebug.goto(n), st);
    await W(p, 80);
    const o = await D(p, () => ({ ...__entiteDebug.objective(), act: __entiteDebug.active(), n: document.querySelectorAll('.active-mod').length, step: __entiteDebug.state.step }));
    const t = o.text;
    if (/\d/.test(t) || new RegExp(`\\b(${COLORS.join('|')})\\b`, 'i').test(t.replace(/capot (bleu|rouge)|cercle vert/g, '')) || spoil.some((ch) => new RegExp(`(^|\\s)${ch}(\\s|[.,]|$)`).test(t))) bad.push([st, t]);
    if (o.act.join() !== MODULES[st].join() || o.n !== MODULES[st].length) wrongMod.push([st, o.act, o.n]);
  }
  ok('12 étapes : bandeau = objectif, aucun chiffre / couleur / lettre de réponse', bad.length === 0, bad);
  ok('12 étapes : le module en surbrillance est celui de l’étape', wrongMod.length === 0, wrongMod);
  // mensonge à l'étape 2 (≈ 5,5 s) : œil rouge + trappe-leurre, mais le contour reste sur les trappes, le leurre ne brille pas seul
  await D(p, () => __entiteDebug.goto(2)); let lie = null;
  for (let k = 0; k < 90; k++) { await W(p, 100); const s = await D(p, () => ({ liar: document.querySelector('#cyd1').classList.contains('liar'), decoy: [...document.querySelectorAll('.decoy')].map((e) => e.className), act: __entiteDebug.active(), decoyGlow: document.querySelectorAll('.trap.decoy.active-mod, .decoy.active-mod:not(#traps):not(#jacks)').length })); if (s.liar && s.decoy.length) { lie = s; break; } }
  ok('mensonge (œil rouge) : le contour reste sur le vrai module, aucun leurre ne brille', !!lie && lie.act.join() === '#traps' && lie.decoyGlow === 0, lie);
  await done();
}

// ---------- 2d. joueur débutant simulé sur de nombreuses graines (les deux paliers, toutes les variantes)
{
  const need = new Set(); for (const k of SLOTS) for (const v of new Set([...POOLS[k].moyen, ...POOLS[k].difficile])) need.add(`${k}:${v}`);
  const seeds = []; const cover = new Set(); let tiers = { moyen: 0, difficile: 0 };
  for (let s = 1; s < 20000 && (seeds.length < NSIM); s++) {
    const r = makeRun(s); const add = SLOTS.map((k) => `${k}:${r.v[k]}`).filter((x) => !cover.has(x));
    const tierNeed = tiers[r.tier] < Math.ceil(NSIM / 2);
    if ((add.length && tierNeed) || (cover.size === need.size && tierNeed)) { seeds.push(s); add.forEach((x) => cover.add(x)); tiers[r.tier]++; }
  }
  ok(`graines du joueur simulé : ${seeds.length} graines couvrent toutes les variantes, les deux paliers`, cover.size === need.size && tiers.moyen > 0 && tiers.difficile > 0, { cover: cover.size, need: need.size, tiers });
  const results = [];
  for (const [i, s] of seeds.entries()) {
    const vp = [{ width: 412, height: 915 }, { width: 915, height: 412 }, { width: 1280, height: 800 }][i % 3];
    const { p, done } = await page(vp, { query: `&seed=${s}&voix=rapide` });
    await p.tap('#btnStart'); await W(p, 300);
    let r;
    try { r = await playerSim(p, { useHints: i % 4 === 3 }); }
    catch (e) { r = { phase: 'erreur: ' + String(e.message).split('\n')[0], tier: '?', errors: -1, rem: 0, hints: 0, sig: '', log: [] }; }
    results.push({ seed: s, vp: `${vp.width}x${vp.height}`, phase: r.phase, tier: r.tier, errors: r.errors, rem: r.rem, hints: r.hints, sig: r.sig });
    R.sims.push({ seed: s, ...r, log: r.log.filter((x) => !/^\d+:/.test(x)) });
    await done();
  }
  R.simResults = results;
  const wins = results.filter((x) => x.phase === 'win');
  ok(`joueur débutant simulé : ${wins.length}/${results.length} victoires (perception seule, les deux paliers, toutes les variantes)`, wins.length === results.length, results.filter((x) => x.phase !== 'win'));
  ok('joueur simulé : parties avec indices (bouton Indice à chaque étape) aussi gagnées', results.filter((x) => x.hints > 0).every((x) => x.phase === 'win') && results.some((x) => x.hints > 0), results.map((x) => x.hints));
}

// ---------- 2e. deux parties de suite différentes (sans ?seed), mémoire localStorage
{
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('entite-tuto-vu', '1'); } catch {} });
  const p = await ctx.newPage(); const sigs = [];
  for (let k = 0; k < 5; k++) {
    await p.goto(`${base}?debug=1`); await p.waitForSelector('#btnStart:not([disabled])', { timeout: 30000 });
    await p.click('#btnStart'); await W(p, 200);
    sigs.push(await D(p, () => ({ sig: __entiteDebug.run.sig, stored: localStorage.getItem('entite-derniere-partie') })));
  }
  const diffs = sigs.slice(1).map((s, i) => sigDiff(s.sig, sigs[i].sig));
  ok('5 parties de suite (sans graine) : chacune diffère de la précédente sur ≥ 3 règles, signature gardée', diffs.every((d) => d >= 3) && sigs.every((s) => s.stored === s.sig), { diffs, sigs: sigs.map((s) => s.sig) });
  await ctx.close();
}

// ---------- 2f. mise en page : 412x915, 915x412, 1280x800 (sans défilement), 320x640 ; essentiels v0.2.3
for (const vp of [{ width: 412, height: 915 }, { width: 915, height: 412 }, { width: 1280, height: 800 }, { width: 320, height: 640 }]) {
  const tag = `${vp.width}x${vp.height}`;
  const { p, done } = await page(vp, { query: '&seed=42&voix=rapide' });
  await p.tap('#btnStart'); await W(p, 400); await p.tap('#coverArm'); await W(p, 120); await p.tap('#leverArm'); await W(p, 900);
  await D(p, () => scrollTo(0, 0)); await W(p, 150);
  const m = await D(p, () => {
    const se = document.scrollingElement, vh = innerHeight, vw = innerWidth;
    const sel = { obj: '#objective', hint: '#btnHint', son: '#btnSon', tm: '.tm', cyd1: '#cyd1', batt: '#batt', spk: '.spk-cone', ws: '#bar', replay: '#btnReplay', pocket: '#btnPocket', serial: '#serialPlate', jacks: '.jack', locks: '.lock.key', oled: '.oled', enc: '.knob', ports: '.port-btn', cyd2: '.cyd2', joy: '#joy', keys: '.kp-key', traps: '.trap', toggles: '.gtoggle' };
    const all = [], out = { scrollH: se.scrollHeight, clientH: se.clientHeight, scrollX: se.scrollWidth - vw, overlap: [], small: [] };
    for (const [k, q] of Object.entries(sel)) for (const e of document.querySelectorAll(q)) { const r = e.getBoundingClientRect(); if (r.width) all.push([k, e, r]); }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const [ka, ea, a] = all[i], [kb, eb, bb] = all[j];
      if (ea.contains(eb) || eb.contains(ea)) continue;
      if (a.left < bb.right - 1 && bb.left < a.right - 1 && a.top < bb.bottom - 1 && bb.top < a.bottom - 1) out.overlap.push(ka + '/' + kb);
    }
    for (const q of ['#btnHint', '#btnReplay', '#btnSon']) { const r = document.querySelector(q).getBoundingClientRect(); if (r.height < 44 || r.width < 44) out.small.push(q); }
    const objR = document.querySelector('#objective').getBoundingClientRect(), t = document.querySelector('#objText');
    out.objFits = objR.right <= vw + 1 && objR.left >= 0 && t.scrollHeight <= t.clientHeight + 2;
    out.letters = [...document.querySelectorAll('.enc .knob')].every((k) => /^lettre [A-V]$/.test(k.getAttribute('aria-valuetext')));
    out.ecg = __entiteDebug.ecg(); out.cables = __entiteDebug.cables().length; out.colors = [...new Set(__entiteDebug.cables().map((c) => c.color))].length;
    return out;
  });
  const fit = vp.width !== 320;
  ok(`${tag} : 0 débordement horizontal${fit ? ', 0 défilement vertical' : ''}`, m.scrollX <= 0 && (!fit || m.scrollH <= m.clientH + 2), m);
  ok(`${tag} : 0 chevauchement (bandeau, Indice, batterie et commandes)`, m.overlap.length === 0, m.overlap.slice(0, 8));
  ok(`${tag} : Indice, Réécouter, son ≥ 44 px ; bandeau objectif lisible en entier`, m.small.length === 0 && m.objFits, m);
  ok(`${tag} : rotatifs lettres A-V seulement, baie 5 câbles / 5 couleurs, ECG CYD 2`, m.letters && m.cables === 5 && m.colors === 5 && m.ecg.bpm > 0, m);
  if (vp.width === 915) await p.screenshot({ path: shots + 'jeu-915x412.png' });
  await done();
}

// ---------- 2g. fichiers : service worker, médias intacts
{
  const ctx = await b.newContext();
  const sw = await (await ctx.request.get(base + 'sw.js')).text();
  ok('sw.js : VERSION 0.2.4, cache entite-mallette-v0.2.4, archives v015 / v016 gardées, guide + batterie en cache', sw.includes("const VERSION = '0.2.4'") && sw.includes("'entite-mallette-v015-'") && sw.includes("'entite-mallette-v016-'") && sw.includes("'battery', 'guide'"));
  const app = await (await ctx.request.get(base + 'js/app.js?v=0.2.4')).text();
  ok('app.js?v=0.2.4 : VERSION 0.2.4, imports ?v=0.2.4 uniquement', app.includes("const VERSION = '0.2.4'") && !/\?v=0\.2\.[0-3]'/.test(app));
  const sizes = {}; for (const f of ['voix/intro.mp3', 'voix/depart.mp3', 'audio/tension.mp3']) sizes[f] = (await (await ctx.request.get(base + f)).body()).length;
  ok('mp3 intacts : intro 41318, depart 63783, tension 192827 octets', sizes['voix/intro.mp3'] === 41318 && sizes['voix/depart.mp3'] === 63783 && sizes['audio/tension.mp3'] === 192827, sizes);
  await ctx.close();
}
ok('0 erreur console / page / réseau', R.errors.length === 0, R.errors.slice(0, 8));
await b.close();
const fails = Object.entries(R.checks).filter(([, v]) => v !== 'PASS');
console.log(JSON.stringify({ checks: R.checks, tiers: R.tiers, seed42: R.seed42, audio: R.audio, simResults: R.simResults }, null, 1));
console.log(fails.length ? `ÉCHEC : ${fails.length}/${Object.keys(R.checks).length} vérification(s)` : `PASS : ${Object.keys(R.checks).length} vérifications`);
process.exit(fails.length ? 1 : 0);
