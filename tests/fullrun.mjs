// tests/fullrun.mjs
// Contrôle qualité avant chaque push (et avant d'assembler la valise).
// Joue des parties complètes (étapes 0 à 12, dans l'ordre) jusqu'à ce que
// TOUTES les variantes de chaque étape et les DEUX paliers (moyen + difficile)
// soient couverts. ?debug=1 sert UNIQUEMENT à lire les réponses générées :
// la saisie se fait par de vrais taps/clics, comme un joueur.
//
// Chaque partie vérifie aussi :
//   - Réécouter à l'étape 3 : même séquence de DEL que la première fois
//   - un indice (étape 3, niveaux 1–2) rejoue aussi les DEL (une fois par variante de séquence)
//   - un indice sur une autre étape n'empêche pas d'avancer
//   - à chaque étape code (3, 6, 11) : un faux code puis le bon, et l'étape n'avance qu'après le bon
//   - à chaque réussite : l'index d'étape avance et l'id de voix passe à la réussite + l'objectif suivant
//
// Usage :
//   node tests/fullrun.mjs
//   node tests/fullrun.mjs http://127.0.0.1:8794/
//   node tests/fullrun.mjs https://passcool17.github.io/entite-mallette/
//   node tests/fullrun.mjs --base-url URL
//   node tests/fullrun.mjs --seeds 0,26,28
//   node tests/fullrun.mjs --seeds 3,42,77,501,1234          # ad hoc : couverture = WARN, pas FAIL
//   node tests/fullrun.mjs --seeds 3,42,77 --require-coverage
//   npm run qa
//   node tests/fullrun.mjs --qa
//   node tests/fullrun.mjs --qa --base-url https://passcool17.github.io/entite-mallette/
//   FULLRUN_BASE=... node tests/fullrun.mjs
// Graines optionnelles (débogage seulement ; la couverture complète n'est exigée
// que pour le jeu par défaut et pour --qa / npm run qa) :
//   node tests/fullrun.mjs http://127.0.0.1:8794/ 0 26 28 142 9
// Viewport : 412×915 (Galaxy S20 FE, portrait).
// --qa / CI : 20 graines fixes par palier + quelques aléatoires journalisées ;
//   audio court-circuité (voiceLog + --mute-audio), serveur local auto si pas de --base-url.

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { makeRun, RING, DETENTS, POOLS, SLOTS, TIERS } from '../js/game.js?v=0.2.6a';
import { OBJECTIVE, hintCues } from '../js/guide.js?v=0.2.6a';

const require = createRequire(import.meta.url);
function loadChromium() {
  const candidates = [
    'playwright',
    'playwright-core',
    '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.js',
    '/home/box/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs',
  ];
  for (const id of candidates) {
    try { return require(id).chromium; } catch { /* next */ }
  }
  throw new Error('playwright introuvable : lancer npm ci (devDependency playwright)');
}
const chromium = loadChromium();

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEW = { width: 412, height: 915 };

// 20 moyen + 20 difficile, jeu couvrant inclus (0, 9, 28 / 26, 142). Liste fixe pour CI reproductible.
const QA_FIXED = {
  moyen:     [0, 7, 8, 9, 12, 14, 15, 18, 19, 21, 23, 24, 27, 28, 29, 32, 35, 39, 45, 46],
  difficile: [1, 2, 3, 4, 5, 6, 10, 11, 13, 16, 17, 20, 22, 25, 26, 30, 31, 33, 34, 142],
};
const QA_RANDOM_PER_TIER = 2;

function parseArgv(argv) {
  const envCi = process.env.CI === 'true' || process.env.CI === '1';
  const out = {
    base: process.env.FULLRUN_BASE || '',
    seeds: null,
    qa: envCi || process.env.FULLRUN_QA === '1',
    stubAudio: null,
    autoServe: false,
    explicitSeeds: false,
    requireCoverage: process.env.FULLRUN_REQUIRE_COVERAGE === '1',
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--qa') out.qa = true;
    else if (a === '--base-url' || a === '--base') out.base = argv[++i] || '';
    else if (a.startsWith('--base-url=')) out.base = a.slice('--base-url='.length);
    else if (a === '--seeds') {
      out.seeds = String(argv[++i] || '').split(/[,\s]+/).filter(Boolean).map(Number);
      out.explicitSeeds = true;
    } else if (a.startsWith('--seeds=')) {
      out.seeds = a.slice('--seeds='.length).split(/[,\s]+/).filter(Boolean).map(Number);
      out.explicitSeeds = true;
    } else if (a === '--stub-audio') out.stubAudio = true;
    else if (a === '--no-stub-audio') out.stubAudio = false;
    else if (a === '--serve') out.autoServe = true;
    else if (a === '--require-coverage') out.requireCoverage = true;
    else if (a === '--no-require-coverage') out.requireCoverage = false;
    else if (a.startsWith('-')) {
      console.error('option inconnue :', a);
      process.exit(2);
    } else rest.push(a);
  }
  for (const r of rest) {
    if (/^https?:\/\//i.test(r)) {
      if (!out.base) out.base = r;
    } else if (/^\d+$/.test(r)) {
      if (!out.seeds) out.seeds = [];
      out.seeds.push(Number(r));
      out.explicitSeeds = true;
    } else if (!out.base) out.base = r;
  }
  if (out.stubAudio == null) out.stubAudio = !!out.qa;
  if (out.qa && !out.base) out.autoServe = true;
  if (!out.base && !out.autoServe) out.base = 'http://127.0.0.1:8794/';
  if (out.base) out.base = out.base.replace(/\/?$/, '/');
  return out;
}

const ARGS = parseArgv(process.argv.slice(2));

function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  if (process.env.CI === 'true' || process.env.CI === '1') return undefined;
  if (existsSync('/opt/google/chrome/chrome')) return '/opt/google/chrome/chrome';
  return undefined;
}

function launchOptions() {
  const opts = {
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--disable-dev-shm-usage',
    ],
  };
  const exe = chromePath();
  if (exe) opts.executablePath = exe;
  return opts;
}

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port }, () => { s.end(); resolve(true); });
    s.on('error', () => resolve(false));
  });
}

async function startStaticServer() {
  const preferred = Number(process.env.FULLRUN_PORT) || 8794;
  if (await portOpen(preferred)) {
    const base = `http://127.0.0.1:${preferred}/`;
    console.log(`serveur déjà ouvert  ${base}`);
    return { base, stop: async () => {} };
  }
  const port = preferred;
  const child = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  child.stderr.on('data', (d) => { err += d.toString(); });
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    if (child.exitCode != null) throw new Error(`serveur http arrêté (code ${child.exitCode}) ${err}`);
    if (await portOpen(port)) {
      const base = `http://127.0.0.1:${port}/`;
      console.log(`serveur local        ${base}`);
      return {
        base,
        stop: () => new Promise((resolve) => {
          child.once('exit', () => resolve());
          child.kill('SIGTERM');
          setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 1500);
        }),
      };
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  try { child.kill('SIGTERM'); } catch {}
  throw new Error('serveur http : délai dépassé');
}

function qaSeeds() {
  const moyen = QA_FIXED.moyen.slice();
  const difficile = QA_FIXED.difficile.slice();
  if (moyen.length < 20 || difficile.length < 20) {
    throw new Error(`QA_FIXED incomplet : moyen ${moyen.length}, difficile ${difficile.length}`);
  }
  const used = new Set([...moyen, ...difficile]);
  const random = [];
  for (const tier of TIERS) {
    let n = 0, guard = 0;
    while (n < QA_RANDOM_PER_TIER && guard++ < 200000) {
      const s = Math.floor(Math.random() * 100000);
      if (used.has(s)) continue;
      if (makeRun(s).tier !== tier) continue;
      used.add(s);
      random.push(s);
      n++;
    }
  }
  console.log(`graines fixes         moyen ${moyen.length} [${moyen.join(', ')}]`);
  console.log(`graines fixes         difficile ${difficile.length} [${difficile.join(', ')}]`);
  console.log(`graines aléatoires    ${random.map((s) => `${s}(${makeRun(s).tier})`).join(', ') || '—'}`);
  return { seeds: [...moyen, ...difficile, ...random], random };
}

const neededVariants = () => {
  const need = new Set();
  for (const k of SLOTS) for (const v of new Set([...POOLS[k].moyen, ...POOLS[k].difficile])) need.add(`${k}:${v}`);
  return need;
};

// Ensemble minimal de graines qui couvre chaque variante et les deux paliers (glouton déterministe).
function plannedCoverage(seedList) {
  const by = new Map();
  for (const s of seedList) {
    const r = makeRun(s);
    for (const k of SLOTS) {
      const key = `${k}:${r.v[k]}`;
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(s);
    }
  }
  return by;
}

// Échec immédiat si la liste fixe --qa / CI ne garantit pas les 29 variantes (union).
function assertFixedListCovers() {
  const fixed = [...QA_FIXED.moyen, ...QA_FIXED.difficile];
  const need = neededVariants();
  const by = plannedCoverage(fixed);
  const missing = [...need].filter((k) => !by.has(k));
  console.log('=== couverture prévue (liste fixe, union sur tout le run) ===');
  for (const key of [...need].sort()) {
    const ss = by.get(key) || [];
    console.log(`  ${key.padEnd(20)}${ss.length ? 'graines ' + ss.join(', ') : 'MANQUE'}`);
  }
  if (missing.length) {
    console.error(`FULLRUN FAIL  QA_FIXED ne couvre pas 29/29 : ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`liste fixe          ${need.size}/${need.size} variantes garanties`);
}

function coveringSeeds() {
  const need = neededVariants();
  const seeds = [];
  const cover = new Set();
  const tiers = { moyen: 0, difficile: 0 };
  const used = new Set();
  while (cover.size < need.size || !tiers.moyen || !tiers.difficile) {
    let best = null, bestScore = -1;
    for (let s = 0; s < 20000; s++) {
      if (used.has(s)) continue;
      const r = makeRun(s);
      const add = SLOTS.map((k) => `${k}:${r.v[k]}`).filter((x) => !cover.has(x)).length;
      const tierBonus = ((tiers.moyen === 0 && r.tier === 'moyen') || (tiers.difficile === 0 && r.tier === 'difficile')) ? 10 : 0;
      const score = add + tierBonus;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (best == null || bestScore <= 0) break;
    used.add(best);
    seeds.push(best);
    const r = makeRun(best);
    for (const k of SLOTS) cover.add(`${k}:${r.v[k]}`);
    tiers[r.tier]++;
  }
  return seeds;
}

function pickSeeds(args) {
  if (args.explicitSeeds && args.seeds?.length) return args.seeds;
  if (args.qa) return qaSeeds().seeds;
  return coveringSeeds();
}

const W = (p, ms) => p.waitForTimeout(ms);
const D = (p, f, a) => p.evaluate(f, a);
const snap = (p) => D(p, () => {
  const g = __entiteDebug.state, end = document.querySelector('#end');
  return {
    phase: g.phase, step: g.step, running: g.running, code: g.code,
    label: document.querySelector('#objLabel')?.textContent,
    text: document.querySelector('#objText')?.textContent,
    endVisible: !!(end && !end.hidden),
    endTitle: document.querySelector('#endTitle')?.textContent,
    errors: g.errors,
    hint: g.hint,
  };
});

async function waitAdvance(p, from, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await snap(p);
    if (s.phase === 'win' || s.endVisible) return s;
    if (from === 0 && s.phase === 'play' && s.step === 1) return s;
    if (s.step !== from && s.phase === 'play') return s;
    await W(p, 50);
  }
  return snap(p);
}


const SUCCESS_HEADS = new Set(['outcome_ok', 'clue_fragment', 'taunt_fini', 'taunt_couche2', 'outcome_victoire', 'depart']);

function stepHeads(run, step) {
  const ids = new Set();
  if (OBJECTIVE[step]) ids.add(OBJECTIVE[step]);
  for (const id of run.cues?.[step] || []) ids.add(id);
  for (let l = 1; l <= 3; l++) {
    try { for (const id of hintCues(run, step, l, { pos: [0, 0], sabotage: false }) || []) ids.add(id); } catch { /* ignore */ }
  }
  if (step === 0) ['obj_armer', 'arm_cache', 'intro', 'hint1_armer', 'hint2_armer'].forEach((id) => ids.add(id));
  return ids;
}

async function assertVoiceMoved(p, run, from, to, t0) {
  const prev = stepHeads(run, from);
  const next = new Set(stepHeads(run, to === 'fin' || to == null ? 12 : to));
  if (to === 'fin') next.add('outcome_victoire');
  const stamp = Date.now();
  const remain = () => 1500 - (Date.now() - stamp);
  let entries = [];
  while (remain() > 0) {
    entries = await D(p, (t) => __entiteDebug.voiceLog.filter((v) => v.t >= t).map((v) => ({ ids: v.ids, t: v.t, lie: !!v.lie })), t0);
    await W(p, 40);
  }
  const head = (v) => v.ids[0];
  const stale = entries.filter((v) => {
    const h = head(v);
    if (SUCCESS_HEADS.has(h) || next.has(h)) return false;
    return prev.has(h);
  });
  const moved = entries.some((v) => SUCCESS_HEADS.has(head(v)) || next.has(head(v)));
  if (!moved) return { ok: false, why: `pas de voix réussite/prochaine étape en 1,5 s : ${JSON.stringify(entries)}` };
  if (stale.length) return { ok: false, why: `voix de l'étape ${from} encore jouée après la réussite : ${JSON.stringify(stale)}` };
  return { ok: true, heads: entries.map((v) => v.ids[0]).join(',') };
}

async function rotateTo(p, letters) {
  for (let i = 0; i < 4; i++) {
    for (let guard = 0; guard < 28; guard++) {
      const cur = await D(p, (k) => {
        const t = document.querySelectorAll('.enc .knob')[k]?.getAttribute('aria-valuetext') || '';
        return /lettre (\w)/.exec(t)?.[1] || '';
      }, i);
      if (cur === letters[i]) break;
      const d = (RING.indexOf(letters[i]) - RING.indexOf(cur) + DETENTS) % DETENTS;
      const box = await p.locator(`.enc[data-i="${i}"] .knob`).boundingBox();
      if (!box) throw new Error(`encodeur ${i} invisible`);
      const x = (d <= 10 ? box.x + box.width * 0.84 : box.x + box.width * 0.16);
      await p.touchscreen.tap(x, box.y + box.height / 2);
      await W(p, 28);
    }
  }
  const kb = await p.locator('.enc[data-i="0"] .knob').boundingBox();
  await p.touchscreen.tap(kb.x + kb.width / 2, kb.y + kb.height / 2);
}

async function keys(p, code) {
  for (const k of String(code)) {
    const loc = p.locator(`.kp-key[data-k="${k}"]`);
    await loc.waitFor({ state: 'visible', timeout: 4000 });
    await loc.tap({ timeout: 4000 });
    await W(p, 40);
  }
}

function wrongCode(want) {
  const w = String(want);
  let bad = w.replace(/\d/g, (d) => String((+d + 1) % 10));
  if (bad === w) bad = w === '0000' ? '1111' : '0000';
  return bad;
}

async function doPatch(p, req) {
  const entries = Object.entries(req).map(([c, s]) => [+c, s]);
  const unplugs = entries.filter(([, s]) => s == null);
  const plugs = entries.filter(([, s]) => s != null);
  const apply = async (c, s) => {
    const cur = await D(p, (i) => __entiteDebug.state.cables[i].socket, c);
    if (cur === s) return;
    await p.tap(`#ports .port-btn[data-c="${c}"]`);
    await W(p, 80);
    if (s == null) await p.tap(`#ports .port-btn[data-c="${c}"]`);
    else await p.tap(`#jacks .jack[data-s="${s}"]`);
    await W(p, 160);
  };
  for (const [c, s] of unplugs) await apply(c, s);
  for (const [c, s] of plugs) await apply(c, s);
}

function firstMove(walls, n, pos, goal) {
  const key = (q) => q.join(',');
  const prev = new Map([[key(pos), null]]);
  const Q = [pos];
  const DIRS = { up: [0, -1, 1], right: [1, 0, 2], down: [0, 1, 4], left: [-1, 0, 8] };
  while (Q.length) {
    const u = Q.shift();
    if (u[0] === goal[0] && u[1] === goal[1]) {
      let kk = key(u), d = null;
      while (prev.get(kk)) { [kk, d] = prev.get(kk); }
      return d;
    }
    for (const [d, [dx, dy, bit]] of Object.entries(DIRS)) {
      const v = [u[0] + dx, u[1] + dy];
      if (v[0] < 0 || v[1] < 0 || v[0] >= n || v[1] >= n) continue;
      if (walls[u[1]][u[0]] & bit) continue;
      if (prev.has(key(v))) continue;
      prev.set(key(v), [key(u), d]);
      Q.push(v);
    }
  }
  return null;
}

async function doMaze(p, { waitSab = false } = {}) {
  const inv = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const startStep = (await snap(p)).step;
  if (waitSab && startStep === 9) {
    const t0 = Date.now();
    while (Date.now() - t0 < 6500) {
      if (await D(p, () => __entiteDebug.state.sabotage || __entiteDebug.state.step !== 9)) break;
      await W(p, 80);
    }
  }
  for (let k = 0; k < 160; k++) {
    const info = await D(p, () => {
      const g = __entiteDebug.state;
      if (g.phase === 'win' || (g.step !== 5 && g.step !== 9)) return { done: true, step: g.step, phase: g.phase };
      const maze = g.step === 5 ? __entiteDebug.run.maze1 : __entiteDebug.run.maze2;
      return { done: false, pos: g.pos.slice(), goal: maze.goal, walls: maze.walls, n: maze.n, sab: !!g.sabotage, step: g.step };
    });
    if (info.done || info.step !== startStep) return true;
    if (info.pos[0] === info.goal[0] && info.pos[1] === info.goal[1]) return true;
    const dir = firstMove(info.walls, info.n, info.pos, info.goal);
    if (!dir) return false;
    const tap = info.sab ? inv[dir] : dir;
    await p.tap(`.joy-dir.${tap}`);
    await W(p, 70);
  }
  return false;
}

async function recordCyanSeq(p, msOrOpts = 22000) {
  const opts = typeof msOrOpts === 'number' ? { ms: msOrOpts } : (msOrOpts || {});
  const ms = opts.ms ?? 22000;
  const since = opts.since ?? 0;
  const tWait = Date.now();
  let show = null;
  while (Date.now() - tWait < ms) {
    show = await D(p, (since) => {
      const pack = (s, live) => s && !s.fake && s.t0 > since
        ? { seq: s.seq.slice(), t0: s.t0, on: s.on, gap: s.gap, now: performance.now(), live } : null;
      const live = pack(typeof __entiteDebug !== 'undefined' ? __entiteDebug.seqShow : null, true);
      if (live) return live;
      return pack(window.__lastRealSeq, false);
    }, since);
    if (show) break;
    await W(p, 30);
  }
  if (!show) return [];
  const endAt = show.t0 + show.seq.length * (show.on + show.gap) + 40;
  const tEnd = Date.now();
  while (Date.now() - tEnd < 8000) {
    const now = await D(p, () => performance.now());
    if (now >= endAt) break;
    await W(p, Math.min(50, Math.max(10, endAt - now)));
  }
  // Journal rempli dans la page (rAF). On compacte les doublons consécutifs
  // (un frame « off » pendant l'allumage ne doit pas recréer la même DEL).
  const ev = await D(p, ({ t0, endAt }) => (window.__cyanSeqLog || [])
    .filter((e) => e.t >= t0 - 16 && e.t < endAt)
    .map((e) => ({ t: Math.round(e.t - t0), led: e.led, leds: e.leds, groupOk: e.groupOk !== false })), { t0: show.t0, endAt });
  const compact = [];
  for (const e of ev) {
    if (!compact.length || compact[compact.length - 1].led !== e.led) compact.push(e);
    else if (!e.groupOk) compact[compact.length - 1].groupOk = false;
  }
  return compact;
}

async function waitSeqIdle(p, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const show = await D(p, () => __entiteDebug.seqShow);
    if (!show) return true;
    await W(p, 60);
  }
  return false;
}

async function readCyd2Hud(p) {
  return D(p, () => {
    const plate = document.querySelector('#serialPlate');
    const serialEl = document.querySelector('#serial');
    const readout = document.querySelector('#serialReadout');
    const btn = document.querySelector('#btnReplay');
    const cyd = document.querySelector('.cyd2');
    const screen = cyd?.querySelector('.screen');
    const batt = document.querySelector('#batt');
    const want = window.__entiteDebug?.run?.serial;
    const r = (el) => el ? el.getBoundingClientRect() : null;
    const overlap = (a, b) => !!(a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
    const visibleIn = (el, box) => {
      const q = r(el);
      if (!q || q.width < 1 || q.height < 1) return false;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return false;
      if (!box) return true;
      const interW = Math.max(0, Math.min(q.right, box.right) - Math.max(q.left, box.left));
      const interH = Math.max(0, Math.min(q.bottom, box.bottom) - Math.max(q.top, box.top));
      return interW * interH > 0.6 * q.width * q.height;
    };
    const br = r(btn), sr = r(serialEl), scr = r(screen), btr = r(batt), rr = r(readout);
    const zoom = parseFloat(document.getElementById('face-mallette')?.style.zoom || '1') || 1;
    const grid = window.__entiteDebug?.mazeGrid?.() || null;
    const inter = (a, b) => {
      if (!a || !b) return 0;
      const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return w * h;
    };
    const se = document.scrollingElement || document.documentElement;
    const fontCss = serialEl ? parseFloat(getComputedStyle(serialEl).fontSize) || 0 : 0;
    return {
      plate: !!plate,
      lidReplay: !!document.querySelector('.lid #btnReplay, .lid-ctrls #btnReplay'),
      serialText: (serialEl?.textContent || '').trim(),
      want,
      inCyd: !!(cyd && serialEl && btn && cyd.contains(serialEl) && cyd.contains(btn)),
      mazeClass: !!cyd?.classList.contains('maze'),
      view: `${window.innerWidth}×${window.innerHeight}`,
      zoom: Math.round(zoom * 1000) / 1000,
      btnW: br ? Math.round(br.width * 100) / 100 : 0,
      btnH: br ? Math.round(br.height * 100) / 100 : 0,
      btnLabel: (btn?.textContent || '').replace(/\s+/g, ' ').trim(),
      serialVisible: visibleIn(serialEl, scr),
      btnVisible: visibleIn(btn, scr),
      battVisible: visibleIn(batt, scr),
      serialFontCss: Math.round(fontCss * 100) / 100,
      serialVisual: Math.round(fontCss * zoom * 100) / 100,
      serialH: sr ? Math.round(sr.height * 100) / 100 : 0,
      battPct: (document.querySelector('#battPct')?.textContent || '').trim(),
      overlapBattSerial: overlap(btr, sr),
      overlapBattBtn: overlap(btr, br),
      overlapMazeSerial: !!(grid && inter(grid, sr) > 0.25),
      overlapMazeBtn: !!(grid && inter(grid, br) > 0.25),
      mazeGrid: grid ? { w: Math.round(grid.right - grid.left), h: Math.round(grid.bottom - grid.top), n: grid.n } : null,
      mazeVisible: !!(grid && scr && grid.left >= scr.left - 1 && grid.right <= scr.right + 1 && grid.top >= scr.top - 1 && grid.bottom <= scr.bottom + 1 && (grid.right - grid.left) > 8 && (grid.bottom - grid.top) > 8),
      overflowY: Math.max(0, se.scrollHeight - se.clientHeight),
      overflowX: Math.max(0, se.scrollWidth - se.clientWidth),
    };
  });
}

async function playOne(b, seed, opts) {
  const runInfo = makeRun(seed);
  const log = [];
  const rec = (ok, from, to, extra) => {
    const line = `${ok ? 'PASS' : 'FAIL'}  graine ${seed} (${runInfo.tier})  étape ${from} → ${to}${extra ? '  ' + extra : ''}`;
    log.push({ ok, from, to, extra, line });
    console.log('  ' + line);
    return ok;
  };

  const ctx = await b.newContext({
    viewport: VIEW, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('entite-tuto-vu', '1'); } catch {} });
  // Journal des DEL cyan côté page : résiste à un evaluate occupé pendant une fenêtre d'allumage.
  await ctx.addInitScript(() => {
    window.__cyanSeqLog = [];
    window.__lastRealSeq = null;
    const tick = () => {
      try {
        const s = window.__entiteDebug?.seqShow;
        if (s && !s.fake && (!window.__lastRealSeq || window.__lastRealSeq.t0 !== s.t0)) {
          window.__lastRealSeq = { seq: s.seq.slice(), t0: s.t0, on: s.on, gap: s.gap };
        }
        const bar = document.querySelector('#bar');
        if (bar) {
          const all = [...bar.querySelectorAll('i')];
          const lit = all.map((e, i) => (e.classList.contains('on') && e.style.getPropertyValue('--c').trim() === '#62d6ff' ? i : -1)).filter((i) => i >= 0);
          const positions = [...new Set(lit.map((i) => Math.floor(i / 4) + 1))];
          const log = window.__cyanSeqLog;
          const last = log[log.length - 1];
          if (positions.length === 1) {
            const pos = positions[0], a = (pos - 1) * 4;
            const want = [a, a + 1, a + 2, a + 3];
            const groupOk = want.every((i) => lit.includes(i)) && lit.length === 4;
            const leds = want.map((i) => i + 1);
            if (!last || last.led !== pos || last.off) log.push({ t: performance.now(), led: pos, leds, groupOk, off: false });
            else if (!groupOk) last.groupOk = false;
          } else if (lit.length === 0 && last && !last.off) last.off = true;
          else if (positions.length > 1 && last && !last.off) last.groupOk = false;
        }
      } catch { /* debug pas encore prêt */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // CI / --qa : pas de périphérique audio. On décode chaque mp3 en tampon silencieux très court
  // pour que playBuffer se termine tout de suite. voiceLog reste complet (mode mp3).
  if (ARGS.stubAudio) {
    await ctx.addInitScript(() => {
      const Orig = window.AudioContext || window.webkitAudioContext;
      if (!Orig) return;
      const Wrapped = function (...args) {
        const ac = new Orig(...args);
        ac.decodeAudioData = (data, success, error) => {
          try {
            const n = Math.max(8, Math.floor(ac.sampleRate * 0.04));
            const buf = ac.createBuffer(1, n, ac.sampleRate);
            if (typeof success === 'function') success(buf);
            return Promise.resolve(buf);
          } catch (e) {
            if (typeof error === 'function') error(e);
            return Promise.reject(e);
          }
        };
        return ac;
      };
      Wrapped.prototype = Orig.prototype;
      window.AudioContext = Wrapped;
      window.webkitAudioContext = Wrapped;
    });
  }
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });
  p.on('pageerror', (e) => errs.push('page:' + e.message));

  const url = `${base}?debug=1&seed=${seed}&voix=rapide&notuto=1`;
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#btnStart:not([disabled])', { timeout: 45000 });
  await p.waitForSelector('#boot', { state: 'hidden' });

  const ver = await D(p, () => document.querySelector('#ver')?.textContent);
  const liveRun = await D(p, () => ({ seed: __entiteDebug.run.seed, tier: __entiteDebug.run.tier, sig: __entiteDebug.run.sig, v: { ...__entiteDebug.run.v } }));
  console.log(`  version ${ver}  sig ${liveRun.sig}`);
  if (liveRun.seed !== seed || liveRun.tier !== runInfo.tier) {
    rec(false, '—', '—', `graine/palier mismatch local=${seed}/${runInfo.tier} live=${liveRun.seed}/${liveRun.tier}`);
    await ctx.close();
    return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs };
  }

  const extras = { replay: null, hintSeq: null, hintOther: null, wrong: [], voice: 0, hud: 0 };

  const LANDSCAPE = { width: 915, height: 412 };
  const setView = async (size) => {
    await p.setViewportSize(size);
    await D(p, () => { window.dispatchEvent(new Event('resize')); });
    await W(p, 220);
  };

  const checkHudOnce = async (step, maze, label) => {
    const info = await readCyd2Hud(p);
    const land = (info.view || '').startsWith('915');
    let ok = !info.plate && !info.lidReplay && info.inCyd
      && info.serialText === info.want && /^[A-Z][0-9][A-Z][0-9]-[A-Z][0-9][A-Z][0-9]$/.test(info.serialText)
      && info.serialVisible && info.btnVisible && info.battVisible
      && info.btnW >= 44 && info.btnH >= 44
      && /RÉÉCOUTER|RÉECOUTER/i.test(info.btnLabel)
      && info.mazeClass === maze
      && !info.overlapBattSerial && !info.overlapBattBtn
      && /%/.test(info.battPct)
      && info.overflowY === 0 && info.overflowX === 0;
    if (maze) {
      ok = ok && !!info.mazeGrid && info.mazeVisible && !info.overlapMazeSerial && !info.overlapMazeBtn;
      if (land) ok = ok && info.serialVisual >= 11 && info.serialH >= 11;
    }
    rec(ok, step, step, ok
      ? `CYD 2 ${label} n° ${info.serialText} + RÉÉCOUTER ${info.btnW}×${info.btnH} px réel${maze ? `, grille ${info.mazeGrid?.w}×${info.mazeGrid?.h}, n° ${info.serialVisual} px` : ''}, batterie ${info.battPct}`
      : `CYD 2 HUD ${label} ${JSON.stringify(info)}`);
    if (ok) extras.hud = (extras.hud || 0) + 1;
    return ok;
  };

  const hud = async (step, maze = false) => {
    if (!(await checkHudOnce(step, maze, '412×915'))) return false;
    if (maze || step === 3) {
      await setView(LANDSCAPE);
      const okL = await checkHudOnce(step, maze, '915×412');
      await setView(VIEW);
      if (!okL) return false;
      if (!(await checkHudOnce(step, maze, '412×915-retour'))) return false;
    }
    return true;
  };

  const fail = async (from, to, why) => {
    const now = await snap(p);
    rec(false, from, to, `${why}  état=${JSON.stringify(now)}`);
    return false;
  };

  const tNow = () => D(p, () => Math.round(performance.now()));
  const expectAdvance = async (from, to, why, t0) => {
    const s = await waitAdvance(p, from);
    const ok = (to === 'fin') ? (s.phase === 'win' || s.endVisible) : (s.step === to || (to === 1 && s.phase === 'play' && s.step === 1));
    if (!ok) { await fail(from, to, why); return null; }
    const tGood = await D(p, () => Math.round(__entiteDebug.state.lastGoodAt || 0));
    const tSuccess = tGood || t0 || await tNow();
    const v = await assertVoiceMoved(p, runInfo, from, to, tSuccess);
    if (!v.ok) { rec(false, from, to, `${why || s.label}  ${v.why}`); return null; }
    rec(true, from, to, `${why || s.label}  voix ${v.heads}`);
    extras.voice = (extras.voice || 0) + 1;
    return s;
  };

  // ---- étape 0 : armement
  await p.tap('#btnStart'); await W(p, 300);
  let s = await snap(p);
  if (s.phase !== 'arm-toggle') {
    rec(false, 0, 1, `attendu arm-toggle, obtenu ${JSON.stringify(s)}`);
    await ctx.close();
    return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, s };
  }
  if (!(await hud(0, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  await p.tap('#coverArm'); await W(p, 120);
  const tArm = await tNow();
  await p.tap('#leverArm');
  if (!(await expectAdvance(0, 1, 'armement', tArm))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs }; }
  if (!(await hud(1, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  const answers = await D(p, () => {
    const r = __entiteDebug.run, RING = __entiteDebug.RING;
    return {
      enc1: r.enc1.map((i) => RING[i]),
      enc2: r.enc2.map((i) => RING[i]),
      trap: r.trap,
      seq: r.seq.slice(),
      seqCode: r.seqCode,
      code1: r.code1,
      code2: r.code2,
      patch1: r.patch1.req,
      patch2: r.patch2.req,
      keyOrder: r.keyOrder,
      v: { ...r.v },
    };
  });


  // ---- 1 encodeurs (+ indice sur une partie sur deux)
  if (opts.hintOther) {
    await p.tap('#btnHint'); await W(p, 200);
    s = await snap(p);
    const hok = s.step === 1 && s.hint >= 1;
    rec(hok, 1, 1, hok ? 'indice 1 (encodeurs)' : `indice 1 n'a pas pris ${JSON.stringify(s)}`);
    extras.hintOther = { step: 1, ok: hok };
    if (!hok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }
  const t1 = await tNow();
  await rotateTo(p, answers.enc1);
  if (!(await expectAdvance(1, 2, `lettres ${answers.enc1.join('')}`, t1))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(2, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 2 trappe
  // Journal rAF dans la page : on ne lit la 1re séquence qu'après l'assertion de voix,
  // pour ne pas concurrencer les evaluate (sinon la 1re DEL peut être lue à 0).
  const t2 = await tNow();
  const tBeforeSeq = await D(p, () => performance.now());
  await p.tap(`.trap[data-i="${answers.trap}"] .trap-door`);
  if (!(await expectAdvance(2, 3, `trappe ${answers.trap + 1}`, t2))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(3, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 3 barre + clavier : 1re séquence, Réécouter, éventuellement indice, faux code puis bon
  const wantSeq = answers.seq;
  const first = await recordCyanSeq(p, { since: tBeforeSeq, ms: 22000 });
  const firstLeds = first.map((e) => e.led);
  const firstGroups = first.length > 0 && first.every((e) => e.groupOk && Array.isArray(e.leds) && e.leds.length === 4 && e.leds[0] === 4 * e.led - 3 && e.leds[3] === 4 * e.led);
  const firstOk = firstLeds.join() === wantSeq.join() && firstGroups;
  rec(firstOk, 3, 3, firstOk ? `1re séquence ${firstLeds.join('-')} (groupes 32 LED)` : `1re séquence ${firstLeds.join('-') || '∅'} ≠ ${wantSeq.join('-')}  groupes=${JSON.stringify(first.map((e) => ({ pos: e.led, leds: e.leds, ok: e.groupOk })))}`);
  if (!firstOk) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  await waitSeqIdle(p, 4000);

  const tBeforeReplay = await D(p, () => performance.now());
  await p.locator('#btnReplay').click({ force: true });
  const replay = await recordCyanSeq(p, { since: tBeforeReplay, ms: 22000 });
  const replayLeds = replay.map((e) => e.led);
  const replayGroups = replay.length > 0 && replay.every((e) => e.groupOk && Array.isArray(e.leds) && e.leds.length === 4 && e.leds[0] === 4 * e.led - 3 && e.leds[3] === 4 * e.led);
  const replayOk = replayLeds.join() === wantSeq.join() && replayGroups;
  const replayInfo = replayOk ? `Réécouter ${replayLeds.join('-')}` : `Réécouter ${replayLeds.join('-') || '∅'} ≠ ${wantSeq.join('-')}  ${JSON.stringify(await D(p, () => ({ lastClue: __entiteDebug.state.lastClue, seqShow: __entiteDebug.seqShow, log: __entiteDebug.voiceLog.slice(-5).map((v) => v.ids[0]), replayDis: document.querySelector('#btnReplay')?.disabled })))}`;
  rec(replayOk, 3, 3, replayInfo);
  extras.replay = { ok: replayOk, first: firstLeds, replay: replayLeds, want: wantSeq };
  if (!replayOk) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  await waitSeqIdle(p, 4000);

  if (opts.hintSeq) {
    await p.tap('#btnHint');
    await W(p, 300);
    const still = await snap(p);
    const hOk = still.step === 3 && still.hint >= 1;
    rec(hOk, 3, 3, hOk ? 'indice en cours, réussite pendant la voix' : `indice pas pris ${JSON.stringify(still)}`);
    extras.hintSeq = { ok: hOk, midPlay: true };
    if (!hOk) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  }

  const w3 = await wrongThenRight(p, answers.seqCode, 3);
  extras.wrong.push({ step: 3, ...w3 });
  rec(w3.ok, 3, 3, w3.ok ? `faux ${w3.bad} puis bon ${w3.want}` : w3.why);
  if (!w3.ok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t3 = w3.tRight ?? await tNow();
  if (!(await expectAdvance(3, 4, `code ${answers.seqCode}`, t3))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(4, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 4 baie
  const t4 = await tNow();
  await doPatch(p, answers.patch1);
  if (!(await expectAdvance(4, 5, `patch ${JSON.stringify(answers.patch1)}`, t4))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 5 labyrinthe : n° + RÉÉCOUTER restent dans le coin, bouton utilisable
  if (!(await hud(5, true))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  await p.waitForFunction(() => !document.querySelector('#btnReplay')?.disabled, { timeout: 8000 }).catch(() => {});
  const nVoix5 = await D(p, () => (__entiteDebug.voiceLog || []).length);
  await p.locator('#btnReplay').click({ force: true });
  await W(p, 250);
  const mazeReplay5 = await D(p, (n) => {
    const log = (__entiteDebug.voiceLog || []).slice(n);
    return log.some((v) => (v.ids || []).some((id) => /verrou|clue_|obj_/.test(id)));
  }, nVoix5);
  rec(!!mazeReplay5, 5, 5, mazeReplay5 ? 'Réécouter pendant le labyrinthe' : `Réécouter labyrinthe muet  log=${JSON.stringify(await D(p, (n) => (__entiteDebug.voiceLog || []).slice(n).map((v) => v.ids), nVoix5))}`);
  if (!mazeReplay5) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(5, true))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t5 = await tNow();
  if (!(await doMaze(p))) { await fail(5, 6, 'labyrinthe bloqué'); await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await expectAdvance(5, 6, 'labyrinthe', t5))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(6, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 6 code 1
  const w6 = await wrongThenRight(p, answers.code1, 6);
  extras.wrong.push({ step: 6, ...w6 });
  rec(w6.ok, 6, 6, w6.ok ? `faux ${w6.bad} puis bon ${w6.want}` : w6.why);
  if (!w6.ok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t6 = w6.tRight ?? await tNow();
  if (!(await expectAdvance(6, 7, `code ${answers.code1}`, t6))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(7, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 7 clés
  const t7 = await tNow();
  for (const k of answers.keyOrder) {
    await p.tap(`.lock.key[data-key="${k}"] .lock-btn`);
    await W(p, 70);
  }
  if (!(await expectAdvance(7, 8, `ordre ${answers.keyOrder.join(',')}`, t7))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(8, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 8 encodeurs (mot)
  const t8 = await tNow();
  await rotateTo(p, answers.enc2);
  if (!(await expectAdvance(8, 9, `lettres ${answers.enc2.join('')}`, t8))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 9 labyrinthe (éventuellement attendre le sabotage)
  if (!(await hud(9, true))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t9 = await tNow();
  if (!(await doMaze(p, { waitSab: opts.waitSab }))) { await fail(9, 10, 'labyrinthe 2 bloqué'); await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await expectAdvance(9, 10, 'labyrinthe 2', t9))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(10, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 10 baie 2
  const t10 = await tNow();
  await doPatch(p, answers.patch2);
  if (!(await expectAdvance(10, 11, `patch ${JSON.stringify(answers.patch2)}`, t10))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(11, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 11 code 2
  const w11 = await wrongThenRight(p, answers.code2, 11);
  extras.wrong.push({ step: 11, ...w11 });
  rec(w11.ok, 11, 11, w11.ok ? `faux ${w11.bad} puis bon ${w11.want}` : w11.why);
  if (!w11.ok) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  const t11 = w11.tRight ?? await tNow();
  if (!(await expectAdvance(11, 12, `code ${answers.code2}`, t11))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }
  if (!(await hud(12, false))) { await ctx.close(); return { seed, tier: runInfo.tier, v: runInfo.v, ver, ok: false, log, errs, extras }; }

  // ---- 12 levier rouge
  await p.tap('#coverTx'); await W(p, 120);
  const t12 = await tNow();
  await p.tap('#leverTx');
  const tWin = Date.now();
  let end = await snap(p);
  while (Date.now() - tWin < 6000 && !(end.phase === 'win' && end.endVisible)) {
    await W(p, 80);
    end = await snap(p);
  }
  const win = end.phase === 'win' && end.endVisible && /désamorcée/i.test(end.endTitle || '');
  if (!win) rec(false, 12, 'fin', JSON.stringify(end));
  else {
    const tGood = await D(p, () => Math.round(__entiteDebug.state.lastGoodAt || 0));
    const v = await assertVoiceMoved(p, runInfo, 12, 'fin', tGood || t12);
    rec(v.ok, 12, 'fin', v.ok ? `${end.endTitle}  voix ${v.heads}` : v.why);
    if (v.ok) extras.voice = (extras.voice || 0) + 1;
  }

  const consoleOk = errs.length === 0;
  if (!consoleOk) { rec(false, '—', '—', 'erreurs console ' + JSON.stringify(errs)); console.log('  FAIL  erreurs console', errs); }
  await ctx.close();
  const ok = win && consoleOk && log.every((x) => x.ok);
  return { seed, tier: runInfo.tier, v: answers.v, ver, ok, log, errs, extras, end };
}

async function wrongThenRight(p, want, step) {
  const bad = wrongCode(want);
  const before = await snap(p);
  await keys(p, bad);
  await W(p, 350);
  const mid = await snap(p);
  if (mid.step !== step || mid.phase !== 'play') return { ok: false, why: `le faux code ${bad} a fait quitter l'étape ${step} : ${JSON.stringify(mid)}`, bad, want };
  if (!(mid.errors > before.errors) && !/Faux|−/.test(mid.label + mid.text)) {
    return { ok: false, why: `le faux code ${bad} n'a pas été refusé : ${JSON.stringify(mid)}`, bad, want };
  }
  await W(p, 80);
  const tRight = await D(p, () => Math.round(performance.now()));
  await keys(p, want);
  return { ok: true, bad, want, tRight };
}

const seeds = pickSeeds(ARGS);
const need = neededVariants();
let base = ARGS.base;
let stopServer = async () => {};
if (ARGS.autoServe) {
  const srv = await startStaticServer();
  base = srv.base;
  stopServer = srv.stop;
}
console.log(`fullrun  base=${base}  qa=${ARGS.qa ? 'oui' : 'non'}  audio=${ARGS.stubAudio ? 'court-circuité (voiceLog)' : 'réel'}  graines=${ARGS.explicitSeeds ? 'explicites' : (ARGS.qa ? 'qa 20+20+aléatoires' : 'couverture minimale')}`);
console.log(`graines (${seeds.length}) : ${seeds.map((s) => `${s}(${makeRun(s).tier})`).join(', ')}`);
const seedTiers = { moyen: seeds.filter((s) => makeRun(s).tier === 'moyen').length, difficile: seeds.filter((s) => makeRun(s).tier === 'difficile').length };
console.log(`par palier           moyen ${seedTiers.moyen}  difficile ${seedTiers.difficile}`);
if (ARGS.qa && !ARGS.explicitSeeds) assertFixedListCovers();
if (ARGS.qa && !ARGS.explicitSeeds && (seedTiers.moyen < 20 || seedTiers.difficile < 20)) {
  console.error(`FULLRUN FAIL  --qa exige ≥ 20 graines par palier (moyen ${seedTiers.moyen}, difficile ${seedTiers.difficile})`);
  await stopServer();
  process.exit(1);
}
console.log(`variantes à couvrir : ${need.size}  paliers : ${TIERS.join(', ')}`);

const b = await chromium.launch(launchOptions());
const results = [];
const cover = new Map(); // variant -> [seeds]
const tierHits = { moyen: 0, difficile: 0 };
const seqHinted = new Set();
let allOk = true;
try {
  for (const [i, seed] of seeds.entries()) {
    const info = makeRun(seed);
    const hintSeq = !seqHinted.has(info.v.seq);
    const hintOther = i % 2 === 0;
    const waitSab = info.tier === 'difficile' && !results.some((r) => r.extras && r.tier === 'difficile');
    console.log(`\n=== graine ${seed} (${info.tier})  sig=${info.sig}  Réécouter=oui  indice-séq=${hintSeq ? 'oui' : 'non'}  indice-autre=${hintOther ? 'oui' : 'non'}  sab=${waitSab ? 'attendre' : 'si arrive'} ===`);
    const r = await playOne(b, seed, { hintSeq, hintOther, waitSab });
    results.push(r);
    if (r.ok) {
      for (const k of SLOTS) {
        const key = `${k}:${r.v[k]}`;
        if (!cover.has(key)) cover.set(key, []);
        cover.get(key).push(seed);
      }
      tierHits[r.tier]++;
      if (r.extras?.hintSeq?.ok) seqHinted.add(r.v.seq);
    } else allOk = false;
  }
} finally {
  await b.close();
  await stopServer();
}

const missing = [...need].filter((k) => !cover.has(k));
const tiersOk = tierHits.moyen > 0 && tierHits.difficile > 0;
const coverOk = missing.length === 0 && tiersOk;

console.log('\n=== couverture des variantes ===');
console.log('slot           variante      paliers              graines              statut');
for (const key of [...need].sort()) {
  const [slot, variant] = key.split(':');
  const ss = cover.get(key) || [];
  const tiersFor = [...new Set(ss.map((s) => makeRun(s).tier))].join('+') || '—';
  const st = ss.length ? 'OK' : 'MANQUE';
  console.log(`${slot.padEnd(15)}${variant.padEnd(14)}${tiersFor.padEnd(21)}${String(ss.join(',') || '—').padEnd(21)}${st}`);
}
console.log(`paliers        moyen ${tierHits.moyen} partie(s), difficile ${tierHits.difficile} partie(s)   ${tiersOk ? 'OK' : 'MANQUE'}`);
console.log(`variantes      ${cover.size}/${need.size} couvertes${missing.length ? '  manquent : ' + missing.join(', ') : ''}`);

const nPass = results.filter((r) => r.ok).length;
const nReplay = results.filter((r) => r.extras?.replay?.ok).length;
const nHintSeq = results.filter((r) => r.extras?.hintSeq?.ok).length;
const nHintOther = results.filter((r) => r.extras?.hintOther?.ok).length;
const nWrong = results.reduce((n, r) => n + (r.extras?.wrong?.filter((w) => w.ok).length || 0), 0);
const nWrongWant = results.length * 3;
const nAdv = results.reduce((n, r) => n + (r.log?.filter((x) => x.ok && String(x.from) !== String(x.to) || (x.ok && x.to === 'fin')).length || 0), 0);

console.log('\n=== résumé ===');
for (const r of results) {
  const n = r.log?.filter((x) => x.ok).length ?? 0;
  const tot = r.log?.length ?? 0;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  graine ${r.seed} (${r.tier})  ${n}/${tot} vérifs  version ${r.ver}  console ${r.errs.length}`);
}
console.log(`parties              ${nPass}/${results.length} réussies`);
console.log(`Réécouter (DEL)      ${nReplay}/${results.length}`);
const nHud = results.reduce((n, r) => n + (r.extras?.hud || 0), 0);
console.log(`CYD 2 n° + RÉÉCOUTER ${nHud} vérifs (plaque absente, ≥ 44 px, visible y compris labyrinthe)`);
console.log(`indices étape 3      ${nHintSeq} (cible : une fois par variante de séquence)`);
console.log(`indices autre étape  ${nHintOther}`);
console.log(`faux puis bon code   ${nWrong}/${nWrongWant} (étapes 3, 6, 11)`);
console.log(`voix après réussite  ${results.reduce((n, r) => n + (r.extras?.voice || 0), 0)} (étape + id de voix en ≤ 1,5 s, sans voix de l'étape d'avant)`);
console.log(`couverture           ${coverOk ? 'COMPLETE' : 'INCOMPLETE'}  (${cover.size}/${need.size} variantes, paliers moyen=${tierHits.moyen} difficile=${tierHits.difficile})`);

// Couverture = union de toutes les parties du run, pas de chaque graine isolée.
// --qa / jeu couvrant par défaut / --require-coverage : 29/29 exigé (FAIL sinon).
// Run ad hoc (--seeds …) : WARN seulement, sauf si --require-coverage.
const requireCover = ARGS.requireCoverage || !ARGS.explicitSeeds;
if (!allOk || (requireCover && !coverOk)) {
  if (!allOk) console.log('FULLRUN FAIL  au moins une partie a échoué');
  if (requireCover && !coverOk) console.log('FULLRUN FAIL  couverture incomplète (union du run)');
  process.exit(1);
}
if (!requireCover && !coverOk) {
  console.log(`WARN  couverture ${cover.size}/${need.size} (union du run) — incomplet, pas un échec. Exiger 29/29 avec --require-coverage.`);
  if (missing.length) console.log(`WARN  manquent : ${missing.join(', ')}`);
}
console.log('FULLRUN PASS');
