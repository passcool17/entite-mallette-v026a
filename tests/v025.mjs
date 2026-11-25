// Test léger v0.2.6a : voix ElevenLabs, jauge CYD 2 (y compris 915×412), overflow 0.
// Usage : node tests/v025.mjs [base]
import { chromium } from '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { makeRun } from '../js/game.js?v=0.2.6a';
import { OBJECTIVE, objectiveIds, hintCues, HINT_COST, AUTO_HINT_MS } from '../js/guide.js?v=0.2.6a';

const base = process.argv[2] || 'http://127.0.0.1:8794/';
const shots = process.env.SHOTS || '/workspace/qa/entite-mallette/v0.2.5-dev/';
mkdirSync(shots, { recursive: true });
const R = { checks: {}, errors: [] };
const ok = (k, v, extra) => { R.checks[k] = v ? 'PASS' : `FAIL${extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 700) : ''}`; if (!v) console.log('FAIL', k, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); };
const man = JSON.parse(readFileSync(new URL('../voix/manifest.json', import.meta.url)));
const TEXT = Object.fromEntries(man.cues.map((c) => [c.id, c.text]));
const sentence = (ids) => ids.map((id) => TEXT[id] ?? '').filter(Boolean).join(' ').replace(/\s+([:!?])/g, '\u202f$1');
const VAGUE = 'Rebranche les câbles : nouvelle consigne.';

// ================= 1. logique pure =================
{
  const ready = man.cues.filter((c) => c.mp3Ready); const el = ready.filter((c) => c.source === 'elevenlabs');
  ok('manifeste v0.2.6a : 172 répliques toutes prêtes, toutes ElevenLabs (intro/depart inclus)', man.version === '0.2.6a' && man.cues.length === 172 && ready.length === 172 && el.length === 172 && el.every((c) => c.mp3Ready && c.file === `voix/${c.id}.mp3`) && el.filter((c) => c.id === 'intro' || c.id === 'depart').length === 2);
  ok('coûts d’indice inchangés (0 / 15 / 30) et auto 45 s', HINT_COST[1] === 0 && HINT_COST[2] === 15 && HINT_COST[3] === 30 && AUTO_HINT_MS === 45000);
  const kinds = { double: 0, echange: 7, serie: 2 };
  const samples = {};
  for (const [kind, seed] of Object.entries(kinds)) {
    const r = makeRun(seed);
    const ids = objectiveIds(r, 10);
    const text = sentence(ids);
    samples[kind] = { seed, ids, text, cueKind: r.patch2.kind };
    ok(`étape 10 (${kind}, graine ${seed}) : bandeau = consigne dictée, pas « ${VAGUE} »`, r.patch2.kind === kind && ids.join() === r.cues[10].join() && text === sentence(r.cues[10]) && text !== VAGUE && text !== TEXT.obj_cables2 && text.length > 40, samples[kind]);
  }
  ok('double : le bandeau dit quel câble débrancher et quelle prise viser', /Débranche le câble \w+/.test(samples.double.text) && /dans la prise \w+/.test(samples.double.text), samples.double.text);
  ok('échange : le bandeau dit quels câbles intervertir', /Intervertis le câble \w+ et le câble \w+/.test(samples.echange.text), samples.echange.text);
  ok('série : le bandeau dit le rang d’une lettre, pas un numéro de prise calculé', /prise qui porte le rang/.test(samples.serie.text) && /lettre/.test(samples.serie.text) && !/prise [1-5]/.test(samples.serie.text), samples.serie.text);
  // autres étapes : toujours l’objectif court, pas une consigne aussi vague que l’ancienne étape 10
  const other = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12].map((st) => ({ st, ids: objectiveIds(makeRun(0), st), text: sentence(objectiveIds(makeRun(0), st)) }));
  ok('autres étapes : bandeau = objectif court (obj_*), pas « nouvelle consigne »', other.every((o) => o.ids.join() === OBJECTIVE[o.st] && o.text !== VAGUE && o.text.length <= 48), other);
  const r0 = makeRun(0);
  const h1 = hintCues(r0, 10, 1), h2 = hintCues(r0, 10, 2), h3 = hintCues(r0, 10, 3);
  ok('indices étape 10 : niveau 1 / 2 / 3 définis', h1[0] === 'hint1_cables' && h2[0] === `hint2_patch_${r0.patch2.kind}` && (h3[0] === 'hint3_geste' || h3[0] === 'hint3_debranche'), { h1, h2, h3 });
  R.samples = samples;
}

// ================= 2. navigateur =================
const b = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
async function page(vp, { query = '' } = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: vp.width < 1000 ? 2 : 1, isMobile: vp.width < 1000, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('entite-tuto-vu', '1'); } catch {} });
  const p = await ctx.newPage(); const errs = [], reqs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('page: ' + e.message));
  p.on('requestfailed', (r) => { if (!/\.mp3/.test(r.url()) || !/ERR_ABORTED/.test(r.failure()?.errorText || '')) errs.push('failed: ' + r.url() + ' ' + r.failure()?.errorText); });
  p.on('response', (r) => { reqs.push(r.url()); if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
  await p.goto(`${base}?debug=1${query}`);
  await p.waitForSelector('#btnStart:not([disabled])', { timeout: 30000 });
  await p.waitForSelector('#boot', { state: 'hidden' });
  return { ctx, p, errs, reqs, done: async () => { R.errors.push(...errs); await ctx.close(); } };
}
const W = (p, ms) => p.waitForTimeout(ms);
const D = (p, f, a) => p.evaluate(f, a);
async function openTo(p, step) {
  await p.tap('#btnStart'); await W(p, 300);
  await p.tap('#coverArm'); await W(p, 120);
  await p.tap('#leverArm'); await W(p, 300);
  await D(p, (n) => __entiteDebug.goto(n), step);
  await W(p, 120);
}

// ---------- étape 10, graine 0 (double) : texte, persistance, Indice, capture 412 ----------
{
  const want = sentence(makeRun(0).cues[10]);
  const { p, reqs, errs, done } = await page({ width: 412, height: 915 }, { query: '&seed=0&voix=rapide&notuto=1' });
  await openTo(p, 10);
  const a = await D(p, () => ({ ...__entiteDebug.objective(), step: __entiteDebug.state.step, hint: __entiteDebug.state.hint, dis: document.querySelector('#btnHint').disabled, cost: document.querySelector('#hintCost').textContent, long: document.querySelector('#objective').classList.contains('long'), act: __entiteDebug.active(), fits: (() => { const t = document.querySelector('#objText'); return t.scrollHeight <= t.clientHeight + 2; })() }));
  ok('étape 10 (412, double) : bandeau = consigne dictée, pas le résumé vague', a.step === 10 && a.text === want && a.text !== VAGUE && /câble jaune/.test(a.text) && /prise un/.test(a.text), { ...a, want });
  ok('étape 10 : bandeau entièrement lisible (pas tronqué), module baie en surbrillance', a.fits && a.long && a.act.join() === '#jacks,#ports', a);
  ok('étape 10 : bouton Indice disponible, prochain indice gratuit', !a.dis && a.cost === 'gratuit' && a.hint === 0, a);
  await W(p, 3000);
  const b2 = await D(p, () => ({ ...__entiteDebug.objective(), step: __entiteDebug.state.step }));
  ok('étape 10 : le bandeau reste visible (même consigne) après 3 s', b2.step === 10 && b2.text === want, b2);
  await p.screenshot({ path: shots + 'etape10-strip-412.png' });
  // Indice 1 gratuit (auto à 45 s simulées)
  const rem0 = await D(p, () => __entiteDebug.state.remaining);
  await D(p, () => __entiteDebug.ageStep(46000));
  await W(p, 400);
  const h1 = await D(p, () => ({ hint: __entiteDebug.state.hint, rem: __entiteDebug.state.remaining, cost: document.querySelector('#hintCost').textContent, label: document.querySelector('#objLabel').textContent, text: document.querySelector('#objText').textContent, heard: __entiteDebug.voiceLog.map((v) => v.ids[0]) }));
  ok('étape 10 : indice 1 auto à 45 s, gratuit, voix hint1_cables', h1.hint === 1 && h1.rem > rem0 - 2 && h1.heard.includes('hint1_cables') && /Indice 1/.test(h1.label), { ...h1, rem0 });
  // après l’affichage temporaire, retour à la consigne
  await W(p, 7200);
  const back = await D(p, () => ({ ...__entiteDebug.objective(), hint: __entiteDebug.state.hint }));
  ok('étape 10 : après l’indice, le bandeau reprend la consigne dictée', back.text === want && back.hint === 1, back);
  const rem1 = await D(p, () => __entiteDebug.state.remaining);
  await p.tap('#btnHint'); await W(p, 250);
  const h2 = await D(p, () => ({ hint: __entiteDebug.state.hint, rem: __entiteDebug.state.remaining, cost: document.querySelector('#hintCost').textContent, heard: __entiteDebug.voiceLog.map((v) => v.ids[0]), label: document.querySelector('#objLabel').textContent }));
  ok('étape 10 : Indice 2 coûte −15 s, explique la règle, coût suivant −30 s', h2.hint === 2 && rem1 - h2.rem > 14.5 && rem1 - h2.rem < 16.5 && h2.heard.includes('hint2_patch_double') && h2.cost === '−30 s' && /−15 s/.test(h2.label), { ...h2, rem1 });
  const rem2 = await D(p, () => __entiteDebug.state.remaining);
  await p.tap('#btnHint'); await W(p, 250);
  const h3 = await D(p, () => ({ hint: __entiteDebug.state.hint, rem: __entiteDebug.state.remaining, dis: document.querySelector('#btnHint').disabled, heard: __entiteDebug.voiceLog.map((v) => v.ids[0]), text: document.querySelector('#objText').textContent }));
  ok('étape 10 : Indice 3 coûte −30 s, dit le premier geste (voix seulement), bouton épuisé', h3.hint === 3 && rem2 - h3.rem > 29.5 && rem2 - h3.rem < 31.5 && (h3.heard.includes('hint3_geste') || h3.heard.includes('hint3_debranche')) && h3.dis, { ...h3, rem2 });
  ok('démarrage sans erreur, 0 404, imports ?v=0.2.6a, mp3 ElevenLabs demandés', errs.length === 0 && !errs.some((e) => /404/.test(e)) && reqs.filter((u) => /\/js\/\w[\w-]*\.js/.test(u)).every((u) => /\?v=0\.2\.6a$/.test(u)) && reqs.some((u) => /guide\.js\?v=0\.2\.6a/.test(u)) && reqs.some((u) => /voix\/clue_patch_double\.mp3/.test(u)), { errs: errs.slice(0, 6), js: reqs.filter((u) => /\.js/.test(u)).map((u) => u.split('/').pop()) });
  await done();
}

// ---------- étape 10, graine 7 (échange) paysage + capture indice ; série (graine 2) ----------
{
  const want = sentence(makeRun(7).cues[10]);
  const { p, errs, done } = await page({ width: 915, height: 412 }, { query: '&seed=7&voix=rapide&notuto=1' });
  await openTo(p, 10);
  const a = await D(p, () => ({ ...__entiteDebug.objective(), fits: (() => { const t = document.querySelector('#objText'); return t.scrollHeight <= t.clientHeight + 2; })() }));
  ok('étape 10 (915×412, échange) : bandeau = consigne d’interversion, lisible en entier', a.text === want && /Intervertis le câble noir et le câble rouge/.test(a.text) && a.fits, a);
  await p.tap('#btnHint'); await W(p, 300);
  await p.screenshot({ path: shots + 'etape10-indice-915x412.png' });
  const h = await D(p, () => ({ hint: __entiteDebug.state.hint, ...__entiteDebug.objective() }));
  ok('étape 10 paysage : Indice fonctionne (niveau 1)', h.hint === 1 && /Indice/.test(h.label), h);
  ok('paysage : 0 erreur console', errs.length === 0, errs);
  await done();
}
{
  const want = sentence(makeRun(2).cues[10]);
  const { p, done } = await page({ width: 412, height: 915 }, { query: '&seed=2&voix=rapide&notuto=1' });
  await openTo(p, 10);
  const a = await D(p, () => ({ ...__entiteDebug.objective(), fits: (() => { const t = document.querySelector('#objText'); return t.scrollHeight <= t.clientHeight + 2; })() }));
  ok('étape 10 (série) : consigne avec rang de lettre, lisible, pas de numéro de prise calculé', a.text === want && /câble noir/.test(a.text) && /lettre F/.test(a.text) && /porte le rang/.test(a.text) && a.fits, a);
  await p.screenshot({ path: shots + 'etape10-serie-412.png' });
  await done();
}

// ---------- overflow 412×915 (bandeau étape 10) + non-régression ----------
const measureOverflow = () => {
  const se = document.scrollingElement || document.documentElement;
  const t = document.querySelector('#objText');
  const pill = document.querySelector('#scrollPill');
  const bottoms = ['#gtArm', '#gtTx', '.mod-keypad', '.mod-toggles'].map((sel) => {
    const e = document.querySelector(sel);
    return e ? e.getBoundingClientRect().bottom : 0;
  });
  return {
    dx: se.scrollWidth - se.clientWidth,
    dy: se.scrollHeight - se.clientHeight,
    pill: pill ? !pill.hidden : null,
    fits: t ? t.scrollHeight <= t.clientHeight + 2 : false,
    text: t?.textContent || '',
    long: document.querySelector('#objective')?.classList.contains('long') || false,
    zoom: document.querySelector('#face-mallette')?.style.zoom || '1',
    hud: Math.round(document.querySelector('.hud')?.getBoundingClientRect().height || 0),
    bottom: Math.max(0, ...bottoms),
    vh: window.innerHeight,
  };
};

{
  const cases = [
    { seed: 0, kind: 'double', w: sentence(makeRun(0).cues[10]) },
    { seed: 7, kind: 'échange', w: sentence(makeRun(7).cues[10]) },
    { seed: 2, kind: 'série', w: sentence(makeRun(2).cues[10]) },
    { seed: 33, kind: 'série-longue', w: sentence(makeRun(33).cues[10]) },
  ];
  for (const c of cases) {
    const { p, errs, done } = await page({ width: 412, height: 915 }, { query: `&seed=${c.seed}&voix=rapide&notuto=1` });
    await openTo(p, 10);
    const m = await D(p, measureOverflow);
    ok(`étape 10 (412×915, graine ${c.seed}, ${c.kind}) : overflow 0×0, consigne entière, pastille masquée, bas de mallette visible`, m.dx <= 0 && m.dy <= 0 && m.fits && m.pill === false && m.bottom <= m.vh + 1 && m.text === c.w && m.long, m);
    ok(`étape 10 (412×915, graine ${c.seed}) : 0 erreur console`, errs.length === 0, errs);
    if (c.seed === 2) await p.screenshot({ path: shots + 'etape10-serie-overflow-412.png' });
    if (c.seed === 0) await p.screenshot({ path: shots + 'etape10-double-overflow-412.png' });
    await done();
  }
}
{
  const { p, errs, done } = await page({ width: 412, height: 915 }, { query: '&seed=0&voix=rapide&notuto=1' });
  await openTo(p, 1);
  const m = await D(p, measureOverflow);
  ok('étape 1 (412×915) : pas de régression overflow (0×0)', m.dx <= 0 && m.dy <= 0 && m.pill === false, m);
  ok('étape 1 (412×915) : 0 erreur console', errs.length === 0, errs);
  await done();
}
{
  const { p, errs, done } = await page({ width: 915, height: 412 }, { query: '&seed=2&voix=rapide&notuto=1' });
  await openTo(p, 10);
  const m = await D(p, measureOverflow);
  ok('étape 10 (915×412, série) : overflow 0×0, consigne entière, pastille masquée', m.dx <= 0 && m.dy <= 0 && m.fits && m.pill === false && m.bottom <= m.vh + 1, m);
  ok('étape 10 (915×412) : 0 erreur console', errs.length === 0, errs);
  await done();
}
{
  const { p, errs, done } = await page({ width: 1280, height: 800 }, { query: '&seed=2&voix=rapide&notuto=1' });
  await openTo(p, 10);
  const m = await D(p, measureOverflow);
  ok('étape 10 (1280×800, série) : overflow 0×0, consigne entière', m.dx <= 0 && m.dy <= 0 && m.fits && m.bottom <= m.vh + 1, m);
  ok('étape 10 (1280×800) : 0 erreur console', errs.length === 0, errs);
  await done();
}

// ---------- jauge batterie sur le CYD 2 (pas le CYD 1), sans chevauchement, overflow 0 ----------
const measureBatt = () => {
  const e = document.querySelector('#batt');
  const s = document.querySelector('.cyd2 .screen');
  if (!e || !s) return { missing: true };
  const er = e.getBoundingClientRect(), sr = s.getBoundingClientRect();
  const mid = { left: sr.left + sr.width * 0.12, right: sr.right - sr.width * 0.12, top: sr.top + sr.height * 0.4, bottom: sr.bottom - 6 };
  const overlapMid = !(er.right <= mid.left || er.left >= mid.right || er.bottom <= mid.top || er.top >= mid.bottom);
  const fs = parseFloat(getComputedStyle(e).fontSize) || 0;
  const txt = (e.innerText || '').replace(/\s+/g, ' ').trim();
  return {
    onCyd2: !!e.closest('.cyd2 .screen'),
    onCyd1: !!e.closest('#cyd1'),
    inside: er.left >= sr.left - 1 && er.right <= sr.right + 1 && er.top >= sr.top - 1 && er.bottom <= sr.bottom + 1,
    corner: er.left > sr.left + sr.width * 0.42 && er.bottom <= sr.top + sr.height * 0.4,
    overlapMid,
    txt,
    aria: e.getAttribute('aria-label') || '',
    hasPct: /\d+\s*%/.test(txt),
    hasV: /\d+,\d/.test(txt),
    readable: er.width >= 36 && er.height >= 8 && fs >= 7,
    w: +er.width.toFixed(1), h: +er.height.toFixed(1), fs,
    cls: e.className, lvl: e.dataset.level,
  };
};

{
  const { p, errs, done } = await page({ width: 412, height: 915 }, { query: '&seed=0&voix=rapide&notuto=1' });
  await openTo(p, 1);
  const b = await D(p, measureBatt);
  const ov = await D(p, measureOverflow);
  ok('batterie (412×915, ECG) : sur le CYD 2, coin haut droit, plus sur le CYD 1', b.onCyd2 && !b.onCyd1 && b.inside && b.corner, b);
  ok('batterie (ECG) : icône + % + tension lisibles, pas de chevauchement avec le tracé', b.hasPct && b.hasV && b.readable && !b.overlapMid && /Batterie \d+ %, \d+,\d volts/.test(b.aria), b);
  ok('batterie (ECG) : overflow 0×0', ov.dx <= 0 && ov.dy <= 0 && ov.pill === false, ov);
  await p.screenshot({ path: shots + 'cyd2-batterie-ecg-412.png' });
  await D(p, () => __entiteDebug.setBattery(12));
  await W(p, 700);
  const lowB = await D(p, measureBatt);
  const lowS = await D(p, () => ({ ...__entiteDebug.battery(), anim: getComputedStyle(document.querySelector('#batt .batt-ico')).animationName, aria: document.querySelector('#batt').getAttribute('aria-label') }));
  ok('batterie < 15 % : jauge toujours sur le CYD 2, icône rouge qui clignote + 1 seul bip, aucune pénalité', lowB.onCyd2 && lowS.low && /low/.test(lowB.cls) && lowB.lvl === 'low' && lowS.anim === 'batt-blink' && lowS.warnings === 1 && /faible/.test(lowS.aria), { ...lowB, ...lowS });
  ok('batterie (ECG) : 0 erreur console', errs.length === 0, errs);
  await done();
}
{
  const { p, errs, done } = await page({ width: 412, height: 915 }, { query: '&seed=0&voix=rapide&notuto=1' });
  await openTo(p, 5);
  const b = await D(p, measureBatt);
  const ov = await D(p, measureOverflow);
  const maze = await D(p, () => /verrou de signal/.test(document.querySelector('#cyd2')?.getAttribute('aria-label') || ''));
  ok('batterie (412×915, labyrinthe étape 5) : sur le CYD 2, coin haut droit, pas de chevauchement avec le labyrinthe', maze && b.onCyd2 && !b.onCyd1 && b.inside && b.corner && !b.overlapMid && b.hasPct && b.hasV, { ...b, maze });
  ok('batterie (labyrinthe étape 5) : overflow 0×0', ov.dx <= 0 && ov.dy <= 0 && ov.pill === false, ov);
  await p.screenshot({ path: shots + 'cyd2-batterie-labyrinthe-412.png' });
  ok('batterie (labyrinthe) : 0 erreur console', errs.length === 0, errs);
  await done();
}

// ---------- jauge 915×412 : le « V » n'est plus coupé ----------
{
  const { p, errs, done } = await page({ width: 915, height: 412 }, { query: '&seed=0&voix=rapide&notuto=1' });
  await openTo(p, 1);
  const b = await D(p, () => {
    const e = document.querySelector('#batt'), v = document.querySelector('#battV'), s = document.querySelector('.cyd2 .screen');
    const er = e.getBoundingClientRect(), vr = v.getBoundingClientRect(), sr = s.getBoundingClientRect();
    const mid = { left: sr.left + sr.width * 0.12, right: sr.right - sr.width * 0.12, top: sr.top + sr.height * 0.4, bottom: sr.bottom - 6 };
    const overlapMid = !(er.right <= mid.left || er.left >= mid.right || er.bottom <= mid.top || er.top >= mid.bottom);
    return {
      onCyd2: !!e.closest('.cyd2 .screen'),
      txt: (e.innerText || '').replace(/\s+/g, ' ').trim(),
      hasV: /V/.test(v.textContent || '') && /V/.test(e.innerText || ''),
      vFits: vr.right <= sr.right + 0.5 && vr.left >= sr.left - 0.5 && vr.bottom <= sr.bottom + 0.5,
      eFits: er.right <= sr.right + 0.5 && er.left >= sr.left - 0.5,
      overlapMid,
      sw: +sr.width.toFixed(1), ew: +er.width.toFixed(1), vRight: +vr.right.toFixed(1), sRight: +sr.right.toFixed(1),
    };
  });
  const ov = await D(p, measureOverflow);
  ok('batterie (915×412, ECG) : « V » entier dans l’écran, pas de chevauchement avec l’ECG', b.onCyd2 && b.hasV && b.vFits && b.eFits && !b.overlapMid, b);
  ok('batterie (915×412) : overflow 0×0', ov.dx <= 0 && ov.dy <= 0, ov);
  await p.screenshot({ path: shots + 'cyd2-batterie-ecg-915x412.png' });
  ok('batterie (915×412) : 0 erreur console', errs.length === 0, errs);
  await done();
}

// ---------- repli mp3 / synthèse ----------
{
  const { p, reqs, errs, done } = await page({ width: 412, height: 915 }, { query: '&seed=0&voix=rapide&notuto=1' });
  await p.tap('#btnStart'); await W(p, 300); await p.tap('#coverArm'); await W(p, 120); await p.tap('#leverArm'); await W(p, 500);
  const log1 = await D(p, () => __entiteDebug.voiceLog.map((v) => ({ ids: v.ids, mode: v.mode })));
  ok('intro et depart joués en mp3 (ElevenLabs)', log1.some((v) => v.ids[0] === 'intro' && v.mode === 'mp3') && log1.some((v) => v.ids[0] === 'depart' && v.mode === 'mp3'), log1.slice(0, 8));
  const ids10 = ['obj_cables2', ...makeRun(0).cues[10]];
  await D(p, (ids) => __entiteDebug.speak(ids), ids10);
  await W(p, 300);
  const chain = await D(p, (ids) => __entiteDebug.voiceLog.findLast((v) => v.ids.join() === ids.join()), ids10);
  ok('étape 10 : consigne jouée en mp3, fragments enchaînés (tête + câble + prise)', !!chain && chain.mode === 'mp3' && chain.ids[0] === 'obj_cables2' && chain.ids.includes('cable_jaune') && chain.ids.includes('prise_1'), chain);
  const st = await D(p, () => __entiteDebug.voiceStats);
  ok('voix : des fichiers mp3 ont vraiment été décodés (pas seulement la synthèse)', st.fichier >= 2, st);
  // repli : un id absent du manifeste n'est pas demandé en fichier
  await D(p, () => __entiteDebug.speak('ligne_absente_xyz'));
  await W(p, 250);
  const tts = await D(p, () => __entiteDebug.voiceLog.findLast((v) => v.ids[0] === 'ligne_absente_xyz'));
  ok('id inconnu : repli synthèse (tts ou texte), aucun fetch du fichier', !!tts && (tts.mode === 'tts' || tts.mode === 'texte') && !reqs.some((u) => /voix\/ligne_absente_xyz\.mp3/.test(u)), tts);
  // suite mixte : intro (mp3 prêt) + id inconnu (synthèse)
  await D(p, () => __entiteDebug.speak(['intro', 'ligne_absente_xyz']));
  await W(p, 250);
  const mix = await D(p, () => __entiteDebug.voiceLog.findLast((v) => v.ids.join() === 'intro,ligne_absente_xyz'));
  ok('suite mixte intro + id inconnu : mode mix (mp3 puis synthèse)', !!mix && mix.mode === 'mix', mix);
  ok('repli voix : 0 erreur 404', errs.filter((e) => /404/.test(e)).length === 0, errs);
  await done();
}


// ---------- étape 3 : Réécouter rejoue la séquence lumineuse (même ordre, pas de double anim) ----------
{
  const { p, errs, done } = await page({ width: 412, height: 915 }, { query: '&seed=0&voix=rapide&notuto=1' });
  await p.tap('#btnStart'); await W(p, 300);
  await p.tap('#coverArm'); await W(p, 120);
  await p.tap('#leverArm'); await W(p, 300);
  // coupe intro / consigne d'étape 1 encore en file, sinon la première séquence part trop tard
  await D(p, () => __entiteDebug.clearVoice());
  await D(p, () => __entiteDebug.goto(3));
  await W(p, 120);
  const want = await D(p, () => __entiteDebug.run.seq.slice());
  const readLit = () => D(p, () => {
    const lit = [...document.querySelectorAll('#bar i')].map((e, i) => (e.classList.contains('on') && e.style.getPropertyValue('--c').trim() === '#62d6ff' ? i : -1)).filter((i) => i >= 0);
    return [...new Set(lit.map((i) => Math.floor(i / 4) + 1))];
  });
  const overflow = () => D(p, () => { const se = document.scrollingElement || document.documentElement; return { dx: se.scrollWidth - se.clientWidth, dy: se.scrollHeight - se.clientHeight }; });
  async function recordSeq(ms = 18000) {
    const ev = [];
    let last = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const on = await readLit();
      const cur = on[0] || 0;
      if (cur && cur !== last) ev.push({ led: cur, t: Date.now() - t0, css: 'on #62d6ff' });
      last = cur;
      if (ev.length >= want.length) {
        // attendre l'extinction de la dernière pour figer le motif
        const end = Date.now();
        while (Date.now() - end < 900) {
          const still = await readLit();
          if (!still.length) break;
          await W(p, 40);
        }
        break;
      }
      await W(p, 40);
    }
    return ev;
  }
  const first = await recordSeq();
  const dt = first.length > 1 ? first.slice(1).map((e, i) => e.t - first[i].t) : [];
  ok('étape 3 : première lecture, 4 DEL cyan dans l’ordre de run.seq', first.length === 4 && first.map((e) => e.led).join() === want.join(), { want, first });
  const ov1 = await overflow();
  ok('étape 3 après 1re séquence : overflow 0×0', ov1.dx <= 0 && ov1.dy <= 0, ov1);

  await p.tap('#btnReplay');
  const replay = await recordSeq();
  const dtR = replay.length > 1 ? replay.slice(1).map((e, i) => e.t - replay[i].t) : [];
  const sameOrder = replay.map((e) => e.led).join() === first.map((e) => e.led).join();
  const samePace = dt.length === dtR.length && dt.every((d, i) => Math.abs(d - dtR[i]) < 200);
  ok('Réécouter : même ordre de DEL que la première fois', sameOrder && replay.length === 4, { want, first: first.map((e) => e.led), replay: replay.map((e) => e.led) });
  ok('Réécouter : même cadence (520 ms allumées + 260 ms d’écart, ±200 ms)', samePace, { dt, dtR });
  const after = await readLit();
  ok('après la réécoute, la barre revient à l’état d’attente (aucune DEL allumée)', after.length === 0, after);

  // double appui : annule la 1re réécoute et n’en joue qu’une
  await p.tap('#btnReplay');
  await W(p, 400);
  await p.tap('#btnReplay');
  const twice = await recordSeq();
  ok('double Réécouter : une seule séquence, même ordre, pas de DEL coincée', twice.length === 4 && twice.map((e) => e.led).join() === want.join() && (await readLit()).length === 0, { want, twice: twice.map((e) => e.led) });

  // saisie clavier pendant une réécoute : le code est pris, la séquence finit, pas d’erreur
  await p.tap('#btnReplay');
  const tWait = Date.now();
  let saw = false;
  while (Date.now() - tWait < 18000 && !saw) { saw = (await readLit()).length > 0; if (!saw) await W(p, 80); }
  await D(p, () => __entiteDebug.press('1'));
  const mid = await D(p, () => ({ code: __entiteDebug.state.code, step: __entiteDebug.state.step }));
  const rest = [];
  let last = 0, t2 = Date.now();
  while (Date.now() - t2 < 5000 && rest.length < 4) {
    const on = await readLit();
    const cur = on[0] || 0;
    if (cur && cur !== last) rest.push(cur);
    last = cur;
    await W(p, 40);
  }
  ok('clavier pendant la réécoute : le chiffre est retenu, l’étape 3 continue, pas d’erreur', mid.code === '1' && mid.step === 3 && rest.length >= 1, { mid, rest });
  ok('étape 3 Réécouter : 0 erreur console', errs.length === 0, errs);
  R.seqLog = { want, first, replay, twice, dt, dtR };
  await p.screenshot({ path: shots + 'replay-seq-412.png' });
  await done();
}

await b.close();
const fail = Object.entries(R.checks).filter(([, v]) => v !== 'PASS');
console.log(JSON.stringify({ pass: fail.length === 0, ok: Object.keys(R.checks).length - fail.length, fail: fail.length, checks: R.checks, errors: R.errors, samples: Object.fromEntries(Object.entries(R.samples || {}).map(([k, v]) => [k, v.text])) }, null, 2));
if (fail.length) process.exit(1);
