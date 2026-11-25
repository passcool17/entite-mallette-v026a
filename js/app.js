// app.js : La mallette de l'Entité v0.2.5 : une seule vue, la mallette ouverte (couvercle intérieur + base).
// Tout est à l'intérieur de la valise. Deux leviers à capot : bleu (armement) et rouge (TRANSMIT, la fin).
// KY-040 : on tourne le bouton lui-même (20 crans = anneau de 20 lettres A-V, JAMAIS de chiffres ; chiffres = clavier 4x4).
// Baie banane 5x5 : n'importe quel câble dans n'importe quelle prise (glisser ou toucher). CYD 2 : n° de série + bouton RÉÉCOUTER (labyrinthe aux étapes 5 et 9).
// Règle de Pascal : aucun code ni réponse calculée écrit à l'écran (sauf ?debug=1). L'Entité dicte (voix), puis presse et ment (œil rouge)
// pendant que tu choisis. À l'étape 10 le bandeau reprend la consigne de câblage dictée, visible jusqu'à la réussite.
// Paliers cachés ~50/50 (moyen / difficile), ?seed=N reproductible, ?debug=1 expose window.__entiteDebug.
// v0.2.4 : voix PAR-DESSUS la musique (−8 dB sous la voix), jauge de batterie 3S sur le CYD 2, variantes d'énigmes
// tirées par étape (deux parties de suite ne se ressemblent pas : signature de la partie précédente dans localStorage).
import { createEye } from './eye.js?v=0.2.6a';
import { EYE, deepMerge } from './eye-config.js?v=0.2.6a';
import { makeRun, sigDiff, TIME_S, NSTEPS, STEPS, canMove, DIRS, RING, DETENTS } from './game.js?v=0.2.6a';
import { openBattery, LOW as BATT_LOW, PACK } from './battery.js?v=0.2.6a';
import { setVoiceFast, initAudio, speak, stopVoice, voiceLevel, setMuted, isMuted, setVolume, getVolume, audioGraph, DUCK, setCaptionHandler, startMusic, setMusicIntensity, stopMusic, voiceLog, voiceStats, musicStats, ttsAvailable } from './audio.js?v=0.2.6a';
import { sfx } from './sfx.js?v=0.2.6a';
import { preloadAll } from './preload.js?v=0.2.6a';
import { OBJECTIVE, MODULES, HINT_COST, AUTO_HINT_MS, hintCues, hintStrip, objectiveIds } from './guide.js?v=0.2.6a';
import { cue, loadManifest, sentence } from './voice-manifest.js?v=0.2.6a';

const VERSION = '0.2.6a';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SEED_Q = q.has('seed') && /^\d+$/.test(q.get('seed')) ? Number(q.get('seed')) >>> 0 : null;
const DEBUG = q.get('debug') === '1';
const newSeed = () => (SEED_Q ?? (crypto.getRandomValues?.(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 2 ** 32))) >>> 0;
const canVibrate = typeof navigator.vibrate === 'function';
const buzz = (p) => { if (canVibrate) { try { navigator.vibrate(p); } catch { /* rien */ } } };
const fmtPct = (v) => v.toFixed(1).replace('.', ',') + ' %';
const LED = { rouge: '#ff3b30', vert: '#36f08a', bleu: '#3d8bff', ambre: '#ffb020', cyan: '#62d6ff', off: null };
const WIRE = { rouge: '#e53935', noir: '#1b1d22', jaune: '#f5c518', vert: '#22c55e', bleu: '#2b7cff' }; // kit Keadic : 5 couleurs, une de chaque
const ORD = ['1er', '2e', '3e', '4e', '5e'];

// ================= état =================
let run = null;
const g = {};
// deux parties de suite : au moins 3 étapes à règle différente (sauf ?seed=N, toujours reproductible)
const SIG_KEY = 'entite-derniere-partie', MIN_DIFF = 3;
const lastSig = () => { try { return localStorage.getItem(SIG_KEY) || ''; } catch { return ''; } };
function drawRun() {
  if (SEED_Q != null) return makeRun(SEED_Q);
  const prev = lastSig(); let r = makeRun(newSeed());
  for (let k = 0; k < 40 && sigDiff(r.sig, prev) < MIN_DIFF; k++) r = makeRun(newSeed());
  return r;
}
function resetState(remember = false) {
  run = drawRun();
  if (remember) { try { localStorage.setItem(SIG_KEY, run.sig); } catch { /* privé */ } }
  Object.assign(g, {
    phase: 'idle',               // idle → arm-toggle (capot bleu) → play → win | boom
    step: 0, running: false, ended: false, result: null,
    endAt: 0, remaining: TIME_S, rate: 1, lastTick: 0, lastSec: null,
    prob: 99.7, errors: 0, lieUntil: 0, lies: 0,
    coverArm: false, coverTx: false, armed: false, txOn: false,
    enc: [0, 0, 0, 0], encRaw: [0, 0, 0, 0], encMode: 'alpha', trapOpen: [false, false, false], seqShow: null,
    cables: run.wires.map((color, i) => ({ color, socket: i })), sel: null, patchTok: 0, // câble c (port c de la base) → prise 0..4 ou null
    pos: null, code: '', keysTurned: [], hesitating: false, lastInput: 0,
    sabotage: false, sabT: 0, said30: false, said10: false,
    lastClue: null, lastGoodAt: 0, pressure: [], decoy: null, startT: 0,
    hint: 0, progressT: 0, hintsUsed: 0,
  });
}

// ================= voix : file d'attente, mensonges (œil rouge) =================
// v0.2.4 : vraie file d'attente. Une réplique « now » (mensonge, erreur, indice) coupe la voix en cours, mais une
// CONSIGNE (clue) n'est jamais perdue : coupée ou en attente, elle est redite juste après. (Avant, un mensonge arrivé
// pendant depart.mp3 pouvait effacer la consigne de l'étape 1 : on restait bloqué sans savoir quoi faire.)
const vqItems = []; let vqBusy = false, vqCur = null, voiceGen = 0;
// ids : un id ou une suite d'ids du manifeste. lie : œil rouge pendant la réplique.
function voice(ids, { lie = false, now = false, clue = false } = {}) {
  ids = Array.isArray(ids) ? ids : [ids];
  if (clue) { g.lastClue = ids; $('#btnReplay').disabled = false; }
  return new Promise((resolve) => {
    const it = { ids, lie, clue, resolve, requeued: false };
    if (now) {
      for (let i = vqItems.length - 1; i >= 0; i--) if (!vqItems[i].clue) { vqItems[i].resolve(false); vqItems.splice(i, 1); }
      vqItems.unshift(it);
      const c = vqCur;
      if (c) { if (c.clue && c.ids.join() !== ids.join()) { c.requeued = true; vqItems.splice(1, 0, c); } stopVoice(); }
    } else vqItems.push(it);
    pumpVoice();
  });
}
async function pumpVoice() {
  if (vqBusy) return; vqBusy = true;
  try {
    while (vqItems.length) {
      const gen = voiceGen;
      const it = vqItems.shift(); vqCur = it; it.requeued = false;
      if (it.lie) flagLie(true);
      await speak(it.ids, { lie: it.lie });
      if (it.lie) flagLie(false);
      const done = vqCur === it && !it.requeued && voiceGen === gen;
      if (vqCur === it) vqCur = null;
      if (done) it.resolve(true);
    }
  } finally {
    vqBusy = false;
    if (vqItems.length) pumpVoice();
  }
}
// Coupe la voix en cours ET vide la file, y compris les consignes : à la réussite d'une étape,
// l'ancienne réplique (et ses fragments / indices encore en attente) ne doit plus jouer.
// Les promesses en cours se résolvent à false, pour qu'un .then tardif (flashSeq, etc.) n'enchaîne pas.
function clearVoice() {
  voiceGen++;
  while (vqItems.length) vqItems.shift().resolve(false);
  if (vqCur) { vqCur.requeued = true; vqCur.resolve(false); vqCur = null; }
  stopVoice();
}
function flagLie(on) {
  if (on) { g.lies++; g.lieUntil = performance.now() + 2600; }
  const apply = () => {
    const live = performance.now() < g.lieUntil || on;
    $('#cyd1').classList.toggle('liar', live);
    document.body.classList.toggle('lying', live);
    eye?.setMood(live ? 'angry' : g.running ? 'watching' : 'idle');
  };
  apply();
  if (!on) setTimeout(() => { if (performance.now() >= g.lieUntil) { g.lieUntil = 0; apply(); } }, Math.max(0, g.lieUntil - performance.now()) + 20);
}
const digit = (d) => `chiffre_${d}`;
const color = (c) => `couleur_${c}`;
const letter = (ch) => `lettre_${ch.toLowerCase()}`;
const cableCue = (c) => `cable_${g.cables[c].color}`;
const prise = (s) => `prise_${s + 1}`;

// ================= vue unique : la mallette ouverte =================
const face = 'mallette';
function refreshView() { requestAnimationFrame(() => { eye?.resize?.(); drawCyd2(); drawCables(); }); }

// ================= construction des pièces =================
function buildParts() {
  // encodeurs KY-040
  const er = $('#encRow'); er.textContent = '';
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div'); el.className = 'enc'; el.dataset.i = i;
    el.innerHTML = `<button class="knob" type="button" role="slider" aria-valuemin="0" aria-valuemax="19" aria-valuenow="0" aria-label="Encodeur E${i + 1} : tourner le bouton (glisser, molette, bords), toucher le centre pour cliquer"><span class="knob-ring"></span><span class="knob-cap"><span class="knob-mark"></span></span></button><span class="silk">E${i + 1}</span>`;
    er.append(el);
  }
  // clavier 4x4
  const kp = $('#keypad');
  $$('.kp-key', kp).forEach((k) => k.remove());
  for (const k of ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D']) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'kp-key' + (/[A-D*#]/.test(k) ? ' fn' : ''); b.dataset.k = k; b.textContent = k;
    b.setAttribute('aria-label', `Touche ${k}`); kp.append(b);
  }
  // trappes SG90
  const tr = $('#traps'); tr.textContent = '';
  run.trapColors.forEach((c, i) => {
    const t = document.createElement('div'); t.className = 'trap'; t.dataset.i = i; t.style.setProperty('--rim', WIRE[c] === WIRE.noir ? '#555' : LED[c]);
    t.innerHTML = `<div class="trap-well"></div><button class="trap-door" type="button" aria-label="Trappe ${"ABC"[i]}, liseré ${c}"><span class="trap-screw"></span><span class="trap-screw"></span><span class="trap-n">${"ABC"[i]}</span></button>`;
    tr.append(t);
  });
  // fiches banane
  buildJacks();
  $('#serial').textContent = run.serial;
  $('#lot').textContent = `LOT ${run.lot}`;
}
// ================= baie banane 5x5 =================
// 5 câbles ancrés sur la base (ports 0..4, une couleur chacun). Chaque câble se branche dans N'IMPORTE LAQUELLE des
// 5 prises femelles du couvercle (1..5) ; une prise = un câble au plus ; les câbles se croisent librement.
// Gestes : glisser-déposer (fiche → prise ; sur une prise occupée = échange ; à côté = débrancher) OU toucher-choisir
// puis toucher la prise (2e toucher sur la même prise, ou sur le port, = débrancher).
const cableOf = (s) => g.cables.findIndex((k) => k.socket === s);
function buildJacks() {
  const j = $('#jacks'); j.textContent = '';
  for (let s = 0; s < 5; s++) {
    const el = document.createElement('div'); el.className = 'jack'; el.dataset.s = s;
    el.innerHTML = `<button class="plug" type="button"><span class="jack-socket"></span></button><span class="silk">${s + 1}</span>`;
    j.append(el);
  }
  const pt = $('#ports'); pt.textContent = '';
  g.cables.forEach((k, c) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'port-btn'; b.dataset.c = c; b.dataset.color = k.color;
    b.style.setProperty('--w', WIRE[k.color]); b.style.setProperty('--c', c);
    b.innerHTML = '<span class="port-hole"></span>';
    pt.append(b);
  });
  $('#cables').dataset.sig = '';
  syncPatchDom(); drawCables(true);
}
function syncPatchDom() {
  $$('#jacks .jack').forEach((el) => {
    const s = +el.dataset.s, c = cableOf(s);
    el.classList.toggle('empty', c < 0); el.classList.toggle('picked', g.sel != null && c === g.sel);
    el.dataset.c = c < 0 ? '' : g.cables[c].color;
    $('.plug', el).setAttribute('aria-label', c < 0 ? `Prise ${s + 1} vide` + (g.sel != null ? ` : y brancher le câble ${g.cables[g.sel].color}` : '') : `Prise ${s + 1} : câble ${g.cables[c].color} branché`);
  });
  $$('#ports .port-btn').forEach((b) => {
    const c = +b.dataset.c, k = g.cables[c];
    b.classList.toggle('sel', g.sel === c); b.classList.toggle('dropped', k.socket == null); b.setAttribute('aria-pressed', String(g.sel === c));
    b.setAttribute('aria-label', `Câble ${k.color} (port ${c + 1} de la base) : ${k.socket == null ? 'débranché, posé sur la base' : `branché dans la prise ${k.socket + 1}`}`);
  });
  $('#face-mallette').classList.toggle('patch-sel', g.sel != null);
}

// ---- dessin (SVG au-dessus des panneaux, aucun toucher intercepté)
let cableGeom = [], pose = [], tweens = [], lastLayout = null, rafOn = false, drag = null;
const SVGNS = 'http://www.w3.org/2000/svg';
const f1 = (n) => n.toFixed(1);
function svgEl(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.append(e); return e; }
function patchLayout() {
  const fm = $('#face-mallette'), F = fm.getBoundingClientRect();
  const lidR = $('.lid', fm).getBoundingClientRect(), baseR = $('.base', fm).getBoundingClientRect();
  const stacked = lidR.bottom <= baseR.top + 2;
  const rel = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2 - F.left, y: r.top + r.height / 2 - F.top, w: r.width, h: r.height }; };
  const sockets = $$('#jacks .jack-socket').map(rel), holes = $$('#ports .port-hole').map(rel), btns = $$('#ports .port-btn').map(rel);
  const d = sockets[0]?.w || 22;
  return { F, stacked, hinge: stacked ? lidR.bottom - F.top : lidR.right - F.left, sockets, holes, btns, d, L: Math.round(d * 0.95), w: Math.max(9, Math.round(d * 0.5)) };
}
function restPose(P, c) {
  const h = P.holes[c];
  if (P.stacked) return { x: h.x + 12 + P.L, y: h.y + 13, rot: 90 };     // couchée à droite de son port, pointe vers la droite
  const b = P.btns[c]; return { x: b.x + 8, y: b.y - P.L / 2 + 2, rot: 0 }; // debout dans sa case de la goulotte
}
function targetPose(P, c) {
  const s = g.cables[c].socket; if (s == null) return restPose(P, c);
  const lift = g.sel === c ? P.L * 0.3 : 0;                               // choisie : la fiche sort un peu de la prise
  return { x: P.sockets[s].x, y: P.sockets[s].y + lift, rot: 0 };
}
const tailOf = (p, L) => { const a = p.rot * Math.PI / 180; return { x: p.x - Math.sin(a) * L, y: p.y + Math.cos(a) * L }; };
function cablePath(P, c, p) {
  const a = P.holes[c], t = tailOf(p, P.L), ang = p.rot * Math.PI / 180, ux = Math.sin(ang), uy = -Math.cos(ang);
  const dist = Math.hypot(t.x - a.x, t.y - a.y);
  const k1 = Math.min(120, Math.max(10, dist * 0.45)); let k2 = k1, c1;
  if (P.stacked) c1 = { x: a.x, y: a.y + Math.sign(t.y - a.y || 1) * k1 };
  else if (t.x < a.x - 20) { c1 = { x: a.x - k1, y: a.y }; k2 = Math.min(k2, Math.max(8, a.y - t.y + 6)); }
  else c1 = { x: a.x + Math.min(k1, 14), y: a.y };
  const c2 = { x: t.x - ux * k2, y: t.y - uy * k2 };
  return `M ${f1(a.x)} ${f1(a.y)} C ${f1(c1.x)} ${f1(c1.y)} ${f1(c2.x)} ${f1(c2.y)} ${f1(t.x)} ${f1(t.y)}`;
}
function drawCables(instant) {
  const svg = $('#cables'), fm = $('#face-mallette');
  if (!svg || !fm || $('#app').hidden || !g.cables) return;
  if ($$('#jacks .jack-socket').length !== 5 || $$('#ports .port-hole').length !== 5) return;
  const P = patchLayout(); if (!P.F.width) return;
  lastLayout = P;
  const sig = g.cables.map((k) => k.color).join();
  if (svg.dataset.sig !== sig) {
    svg.textContent = ''; svg.dataset.sig = sig; pose = []; tweens = [];
    g.cables.forEach((k, c) => {
      const gr = svgEl('g', { class: 'cable', 'data-c': c, 'data-color': k.color }, svg); gr.style.setProperty('--w', WIRE[k.color]);
      for (const cl of ['c-shadow', 'c-rim', 'c-core', 'c-hi']) svgEl('path', { class: cl }, gr);
      const pl = svgEl('g', { class: 'cplug' }, gr);
      for (const cl of ['pt', 'pc', 'pb', 'pg']) svgEl('rect', { class: cl }, pl);
    });
    instant = true;
  }
  svg.setAttribute('viewBox', `0 0 ${f1(P.F.width)} ${f1(P.F.height)}`);
  for (const pl of svg.querySelectorAll('.cplug')) {
    const [pt, pc, pb, pg] = pl.children, { d, L, w } = P;
    const at = (e, o) => { for (const k in o) e.setAttribute(k, f1(o[k])); };
    at(pt, { x: -w * 0.16, y: -d * 0.42, width: w * 0.32, height: d * 0.3, rx: 1 });          // pointe dorée
    at(pc, { x: -w * 0.34, y: -d * 0.2, width: w * 0.68, height: d * 0.26, rx: 1.5 });        // collier métal
    at(pb, { x: -w / 2, y: d * 0.04, width: w, height: L, rx: 3 });                          // manchon moulé (couleur du câble)
    at(pg, { x: -w / 2 + 2, y: d * 0.14, width: 2, height: L * 0.72, rx: 1 });               // reflet
  }
  const now = performance.now();
  g.cables.forEach((k, c) => {
    const tg = targetPose(P, c), cur = pose[c];
    if (instant || !cur) { pose[c] = tg; tweens[c] = null; }
    else if (Math.abs(cur.x - tg.x) + Math.abs(cur.y - tg.y) + Math.abs(cur.rot - tg.rot) > 0.5) tweens[c] = { from: { ...cur }, to: tg, t0: now };
  });
  cableGeom = g.cables.map((k, c) => {
    const tg = targetPose(P, c), t = tailOf(tg, P.L);
    return { c, color: k.color, socket: k.socket, stacked: P.stacked, hinge: +f1(P.hinge), anchor: [+f1(P.holes[c].x), +f1(P.holes[c].y)], plug: [+f1(tg.x), +f1(tg.y), tg.rot], tail: [+f1(t.x), +f1(t.y)], sockets: P.sockets.map((s) => [+f1(s.x), +f1(s.y)]) };
  });
  renderCables(); kick();
}
function renderCables() {
  const svg = $('#cables'), P = lastLayout; if (!P || !svg.children.length) return;
  g.cables.forEach((k, c) => {
    const gr = svg.querySelector(`.cable[data-c="${c}"]`); if (!gr) return;
    const dragging = drag?.on && drag.c === c, p = dragging ? drag.pose : pose[c];
    const d = cablePath(P, c, p);
    for (const path of gr.querySelectorAll('path')) path.setAttribute('d', d);
    gr.querySelector('.cplug').setAttribute('transform', `translate(${f1(p.x)} ${f1(p.y)}) rotate(${f1(p.rot)})`);
    gr.classList.toggle('sel', g.sel === c); gr.classList.toggle('drag', !!dragging); gr.classList.toggle('off', k.socket == null && !dragging);
  });
  const top = drag?.on ? drag.c : g.sel;
  if (top != null && top >= 0) { const gr = svg.querySelector(`.cable[data-c="${top}"]`); if (gr && gr !== svg.lastElementChild) svg.append(gr); }
}
function kick() { if (!rafOn) { rafOn = true; requestAnimationFrame(animCables); } }
function animCables(now) {
  let busy = false;
  tweens.forEach((tw, c) => {
    if (!tw) return;
    const u = Math.min(1, (now - tw.t0) / 280), e = 1 - Math.pow(1 - u, 3);
    pose[c] = { x: tw.from.x + (tw.to.x - tw.from.x) * e, y: tw.from.y + (tw.to.y - tw.from.y) * e, rot: tw.from.rot + (tw.to.rot - tw.from.rot) * e };
    if (u < 1) busy = true; else tweens[c] = null;
  });
  renderCables();
  if (busy || drag?.on) requestAnimationFrame(animCables); else rafOn = false;
}

// ---- gestes
function socketAt(x, y) {
  const els = $$('#jacks .plug');
  for (let s = 0; s < els.length; s++) { const r = els[s].getBoundingClientRect(); if (x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8) return s; }
  return null;
}
function setHover(s) { $$('#jacks .jack').forEach((el) => el.classList.toggle('hover', +el.dataset.s === s)); }
function patchApply(c, s) {
  const before = g.cables.map((k) => k.socket), from = g.cables[c].socket;
  if (s != null) { const o = cableOf(s); if (o >= 0 && o !== c) g.cables[o].socket = from; g.cables[c].socket = s; } // prise occupée : échange (ou l'ancien retombe)
  else g.cables[c].socket = null;
  return before;
}
function plugCable(c, s) { input(); const before = patchApply(c, s); g.sel = null; sfx.plugIn(); buzz(12); afterPatch({ type: 'plug', c, s }, before); }
function unplugCable(c) { input(); const before = patchApply(c, null); g.sel = null; sfx.plugPull(); afterPatch({ type: 'unplug', c }, before); }
function tapPort(c) {
  input();
  if (g.sel === c) { if (g.cables[c].socket != null) unplugCable(c); else { g.sel = null; syncPatchDom(); drawCables(); } return; }
  g.sel = c; sfx.push(); syncPatchDom(); drawCables();
}
function tapSocket(s) {
  input(); const o = cableOf(s);
  if (g.sel == null) { if (o >= 0) { g.sel = o; sfx.push(); syncPatchDom(); drawCables(); } return; }
  const c = g.sel;
  if (g.cables[c].socket === s) unplugCable(c); else plugCable(c, s);
}
// règle : on peut débrancher et déplacer librement pendant les étapes 4 et 10 ; seule une fiche branchée en violation
// de la consigne (câble visé dans une autre prise, câble à laisser débranché rebranché, ou autre câble dans la prise
// visée) est fautive. Hors de ces étapes, toucher aux câbles coûte du temps et l'Entité les remet en place.
// v0.2.4 : consigne générique run.patchN.req = { câble: prise | null } (route, échange, débranche, rang de lettre, double).
const patchDone = (req) => Object.entries(req).every(([c, s]) => g.cables[+c].socket === s);
function patchWrong(req, ev) {
  if (ev.type !== 'plug') return false;
  if (ev.c in req && req[ev.c] !== ev.s) return true;
  return Object.entries(req).some(([c, s]) => +c !== ev.c && s === ev.s);
}
function afterPatch(ev, before) {
  syncPatchDom(); drawCables();
  const tok = ++g.patchTok;
  const revert = (ms) => setTimeout(() => { if (g.patchTok !== tok) return; g.cables.forEach((k, i) => { k.socket = before[i]; }); g.sel = null; sfx.servo(); batt?.dip('servo'); syncPatchDom(); drawCables(); }, ms);
  if (g.phase !== 'play') { revert(700); return; }
  if (g.step === 4 || g.step === 10) {
    const p = g.step === 4 ? run.patch1 : run.patch2;
    if (patchDone(p.req)) { g.step === 4 ? good(5, 2) : good(11); return; }
    if (patchWrong(p.req, ev)) { bad(8); revert(900); }
    return;
  }
  bad(5); revert(900);
}
function straightCables() { g.cables.forEach((k, i) => { k.socket = i; }); g.sel = null; syncPatchDom(); drawCables(); }
function wirePatchbay() {
  const fm = $('#face-mallette');
  fm.addEventListener('pointerdown', (e) => {
    const jack = e.target.closest('#jacks .jack'), port = e.target.closest('#ports .port-btn');
    if (!jack && !port) return;
    e.preventDefault();
    const s = jack ? +jack.dataset.s : null, c = port ? +port.dataset.c : cableOf(s);
    drag = { c, s, from: port ? 'port' : 'socket', x0: e.clientX, y0: e.clientY, id: e.pointerId, on: false, pose: null, hover: null };
  });
  addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) {
      if (drag.c < 0 || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 10) return;
      drag.on = true; input(); if (g.cables[drag.c].socket != null) sfx.plugPull();
      g.sel = null; syncPatchDom();
    }
    e.preventDefault();
    const P = lastLayout || patchLayout(), F = $('#face-mallette').getBoundingClientRect();
    drag.pose = { x: e.clientX - F.left, y: e.clientY - F.top - P.L * 0.5, rot: 0 };
    const h = socketAt(e.clientX, e.clientY); if (h !== drag.hover) { drag.hover = h; setHover(h); }
    kick();
  }, { passive: false });
  const end = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; setHover(null);
    if (cancel) { drawCables(); return; }
    if (!d.on) { if (d.from === 'port') tapPort(d.c); else tapSocket(d.s); return; }
    // pose = position actuelle du doigt (le câble part de là vers sa destination)
    pose[d.c] = { ...d.pose };
    const s = socketAt(e.clientX, e.clientY);
    if (s != null) { if (g.cables[d.c].socket === s) drawCables(); else plugCable(d.c, s); }
    else if (g.cables[d.c].socket != null) unplugCable(d.c);
    else drawCables();
  };
  addEventListener('pointerup', (e) => end(e, false));
  addEventListener('pointercancel', (e) => end(e, true));
  // clavier (Entrée / Espace) : même logique que le toucher
  fm.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    const jack = e.target.closest('#jacks .jack'), port = e.target.closest('#ports .port-btn');
    if (jack) tapSocket(+jack.dataset.s); else if (port) tapPort(+port.dataset.c);
  });
}

// ================= affichages =================
// 32 LED physiques (4 barrettes de 8 en chaîne), 8 positions de jeu : la position p
// allume le groupe LED 4p−3 à 4p. `cols` reste un tableau de 8 couleurs (une par position).
function setBar(cols) {
  const b = $('#bar');
  let leds = b.querySelectorAll('i');
  if (leds.length !== 32) {
    b.textContent = '';
    for (let p = 0; p < 8; p++) {
      const group = document.createElement('span');
      group.className = 'ws-group';
      group.dataset.p = String(p + 1);
      for (let k = 0; k < 4; k++) group.append(document.createElement('i'));
      b.append(group);
    }
    leds = b.querySelectorAll('i');
  }
  for (let p = 0; p < 8; p++) {
    const c = cols[p];
    for (let k = 0; k < 4; k++) {
      const el = leds[4 * p + k];
      el.style.setProperty('--c', c || 'transparent');
      el.classList.toggle('on', !!c);
    }
  }
}
function showTime(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  const txt = `${m}:${String(sec).padStart(2, '0')}`;
  $('#timer').textContent = txt; $('#tm2').textContent = txt;
  $('.tm[role="timer"]').setAttribute('aria-label', `Temps restant ${m} min ${sec} s`);
}
function showProb() { $('#prob').textContent = fmtPct(g.prob); }
function showStep() { $('#stepNo').textContent = g.phase === 'play' ? `${String(g.step).padStart(2, '0')}/${NSTEPS}` : g.phase.startsWith('arm') ? 'ARM' : '—'; }

// OLED 0,96 po : positions des encodeurs (ce que montrent les boutons, pas la réponse), ou saisie du code masquée
const oledCtx = () => $('#oledCanvas').getContext('2d');
function drawOled() {
  const c = oledCtx(), W = 128, H = 64; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#9fe8ff'; c.font = '500 9px "JetBrains Mono", monospace'; c.textBaseline = 'top';
  const codeStep = g.step === 3 || g.step === 6 || g.step === 11;
  if (g.phase !== 'play') { c.fillText('PC17  ENTITE', 4, 4); c.fillRect(4, 18, 120 * Math.min(1, (performance.now() % 2000) / 2000), 1); $('#oledText').textContent = ''; return; }
  if (codeStep) {
    c.fillText('SAISIE', 4, 4);
    for (let i = 0; i < 4; i++) { const x = 14 + i * 26; c.fillRect(x, 46, 16, 2); if (i < g.code.length) { c.beginPath(); c.arc(x + 8, 34, 5, 0, 7); c.fill(); } }
    $('#oledText').textContent = `${g.code.length} sur 4`;
    return;
  }
  const lie = performance.now() < g.lieUntil && (g.step === 1 || g.step === 8);
  // v0.2.3 : les rotatifs ne portent QUE des lettres (anneau A-V) ; les chiffres se tapent au clavier 4x4
  c.fillText('E1  E2  E3  E4', 10, 4);
  c.fillText('A-V', 106, 4);
  c.font = '500 22px "JetBrains Mono", monospace';
  const sym = (v) => RING[v];
  for (let i = 0; i < 4; i++) {
    const v = lie && g.decoy?.enc ? g.decoy.enc[i] : g.enc[i];
    c.fillText(sym(v), 12 + i * 30, 22);
  }
  for (let i = 0; i < 4; i++) c.fillRect(12 + i * 30, 49, 14, 1);
  // mensonge : grésillement rouge volontaire, mais seulement dans le cadre (bord + bandeau du haut), jamais sur les caractères
  if (lie) {
    const a = 0.25 + Math.random() * 0.25; c.strokeStyle = `rgba(255,60,60,${a.toFixed(2)})`; c.lineWidth = 1; c.strokeRect(0.5, 0.5, W - 1, H - 1);
    c.fillStyle = `rgba(255,60,60,${(a * 0.6).toFixed(2)})`;
    for (let k = 0; k < 3; k++) { const y = Math.random() < 0.5 ? 1 + Math.random() * 1.2 : H - 2.4 + Math.random() * 1.2; c.fillRect(Math.random() * (W - 30), y, 10 + Math.random() * 24, 1); }
  }
  $('#oledText').textContent = `Encodeurs ${g.enc.map(sym).join(' ')}`;
}
function setEncVisual() {
  $$('.enc').forEach((el, i) => {
    $('.knob-cap', el).style.transform = `rotate(${g.encRaw[i] * (360 / DETENTS)}deg)`; // 18° par cran : 20 crans = 1 tour
    const k = $('.knob', el); k.setAttribute('aria-valuemax', String(DETENTS - 1)); k.setAttribute('aria-valuenow', g.enc[i]);
    k.setAttribute('aria-valuetext', `lettre ${RING[g.enc[i]]}`);
  });
}

// CYD 2 : n° de série + RÉÉCOUTER en permanence (plus d'ECG / oscilloscope). Aux étapes 5 et 9, le labyrinthe
// prend l'écran ; le n° reste visible en petit dans un coin, avec le bouton, sous la grille. La jauge batterie (HTML, haut droit) ne doit pas les chevaucher.
function setCyd2Mode() {
  const mazeOn = !!(run && g.phase === 'play' && (g.step === 5 || g.step === 9));
  $('.cyd2')?.classList.toggle('maze', mazeOn);
  const cv = $('#cyd2'), sn = ($('#serial')?.textContent || '').trim();
  if (!cv) return;
  const al = mazeOn
    ? `Écran 2 : verrou de signal, numéro de série ${sn}`
    : `Écran 2 : numéro de série ${sn}`;
  if (cv.getAttribute('aria-label') !== al) cv.setAttribute('aria-label', al);
}
function drawCyd2Idle(c, W, H) {
  c.fillStyle = '#020a10'; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(82,214,255,.10)'; c.lineWidth = 1;
  for (let x = 0.5; x <= W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0.5; y <= H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
}

function drawCyd2() {
  const cv = $('#cyd2'); if (!cv) return;
  setCyd2Mode();
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, now = performance.now();
  c.fillStyle = '#020a10'; c.fillRect(0, 0, W, H);
  const maze = g.phase === 'play' && (g.step === 5 ? run.maze1 : g.step === 9 ? run.maze2 : null);
  const sab = g.sabotage;
  if (!maze) { drawCyd2Idle(c, W, H); g.mazeGridCss = null; return; }
  { const [ax, ay] = g.pos || maze.start, al = `Écran 2 : verrou de signal, point en colonne ${ax + 1}, ligne ${ay + 1}, numéro de série ${run.serial}${sab ? ', commandes inversées' : ''}`; if (cv.getAttribute('aria-label') !== al) cv.setAttribute('aria-label', al); }
  // réserve réelle (CSS après zoom) : jauge / n° en haut, RÉÉCOUTER en bas — pas de chevauchement avec la grille
  const screen = cv.closest('.screen') || cv;
  const s = screen.getBoundingClientRect();
  const toY = (css) => (s.height > 0 ? Math.ceil(css / s.height * H) : 0);
  const toX = (css) => (s.width > 0 ? Math.ceil(css / s.width * W) : 0);
  const gap = 3;
  let topPadCss = 4, botPadCss = 4;
  for (const el of [$('#batt'), $('#serial'), $('#serialReadout'), $('#btnReplay')]) {
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cy = (r.top + r.bottom) / 2, mid = (s.top + s.bottom) / 2;
    if (cy <= mid) topPadCss = Math.max(topPadCss, r.bottom - s.top + gap);
    if (cy >= mid) botPadCss = Math.max(botPadCss, s.bottom - r.top + gap);
  }
  const topPad = Math.max(8, toY(topPadCss)), botPad = Math.max(8, toY(botPadCss));
  const n = maze.n, cs = Math.floor(Math.min((W - 16) / n, (H - topPad - botPad) / n)), ox = Math.floor((W - cs * n) / 2), oy = topPad + Math.floor((H - topPad - botPad - cs * n) / 2);
  const ink = sab ? '#ff4b3e' : '#62d6ff';
  c.strokeStyle = sab ? 'rgba(255,75,62,.16)' : 'rgba(98,214,255,.14)'; c.lineWidth = 1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) c.strokeRect(ox + x * cs + 0.5, oy + y * cs + 0.5, cs, cs);
  c.strokeStyle = ink; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const w = maze.walls[y][x], X = ox + x * cs, Y = oy + y * cs;
    if (w & 1) { c.moveTo(X, Y); c.lineTo(X + cs, Y); }
    if (w & 8) { c.moveTo(X, Y); c.lineTo(X, Y + cs); }
    if (y === n - 1 && (w & 4)) { c.moveTo(X, Y + cs); c.lineTo(X + cs, Y + cs); }
    if (x === n - 1 && (w & 2)) { c.moveTo(X, Y); c.lineTo(X + cs, Y + cs); }
  }
  c.stroke();
  const [gx, gy] = maze.goal, pr = cs * 0.28 + Math.sin(now / 200) * 2;
  c.strokeStyle = '#36f08a'; c.lineWidth = 2; c.beginPath(); c.arc(ox + gx * cs + cs / 2, oy + gy * cs + cs / 2, pr, 0, 7); c.stroke();
  c.beginPath(); c.arc(ox + gx * cs + cs / 2, oy + gy * cs + cs / 2, 3, 0, 7); c.fillStyle = '#36f08a'; c.fill();
  const [px, py] = g.pos || maze.start;
  c.fillStyle = sab ? '#ff4b3e' : '#e9f8ff'; c.shadowColor = ink; c.shadowBlur = 10;
  c.fillRect(ox + px * cs + cs * 0.3, oy + py * cs + cs * 0.3, cs * 0.4, cs * 0.4); c.shadowBlur = 0;
  if (sab) { for (let k = 0; k < 8; k++) { c.fillStyle = `rgba(255,${40 + Math.random() * 80},60,${0.2 + Math.random() * 0.4})`; c.fillRect(0, Math.random() * H, W, 1 + Math.random() * 3); } }
  const scr = cv.getBoundingClientRect();
  g.mazeGridCss = scr.height > 0 && cs > 0 ? {
    left: scr.left + (ox / W) * scr.width,
    top: scr.top + (oy / H) * scr.height,
    right: scr.left + ((ox + cs * n) / W) * scr.width,
    bottom: scr.top + ((oy + cs * n) / H) * scr.height,
    cell: cs, n,
  } : null;
}

// ================= déroulé =================
function nextStep(n, { holdStrip = 0 } = {}) {
  g.step = n; g.pressure.forEach(clearTimeout); g.pressure = []; g.decoy = null; clearDecoys();
  cancelSeq();
  g.hint = 0; progress(); showStep();
  if (!holdStrip) showObjective();
  highlight(); hintUi();
  const O = OBJECTIVE[n], C = Object.fromEntries(Object.entries(run.cues).map(([k, v]) => [k, [O, ...v]]));
  switch (n) {
    case 1: setEncMode('alpha');
      voice(C[1], { clue: true }); pressureEnc(); break;
    case 2: voice(C[2], { clue: true });
      pressure(5500, () => { const w = (run.trap + 1) % 3; decoy('trap', w); voice(['taunt_trappe', color(run.trapColors[w])], { lie: true, now: true }); }); break;
    case 3: g.code = ''; g._seqPressureArmed = false;
      showSeqAfterVoice(voice(C[3], { clue: true })); break;
    case 4: voice(C[4], { clue: true });
      pressure(6000, () => { const w = run.decoys.wire1; decoy('wire', w); voice(['taunt_branche', cableCue(w.cable), prise(w.socket)], { lie: true, now: true }); }); break;
    case 5: g.pos = run.maze1.start.slice(); voice([O, 'clue_verrou'], { clue: true });
      pressure(9000, () => voice('taunt_lent', { now: true })); break;
    case 6: g.code = ''; voice(C[6], { clue: true });
      pressure(6000, () => { const i = Math.floor(Math.random() * 4); voice(['taunt_cetait', digit(run.decoys.frags[i]), 'taunt_depeche'], { lie: true, now: true }); }); break;
    case 7: $$('.lock.key .lock-btn').forEach((b) => { b.disabled = false; b.closest('.lock').classList.add('ready'); });
      voice(C[7], { clue: true });
      pressure(5000, () => voice(['taunt_cles', ...run.decoys.keys.map((k) => digit(k + 1))], { lie: true, now: true }));
      if (run.lies.keysTwice) pressure(14000, () => voice(['taunt_cles', ...run.decoys.keys.map((k) => digit(k + 1))], { lie: true, now: true })); break;
    case 8: setEncMode('alpha');
      voice(C[8], { clue: true }); pressureEnc(); break;
    case 9: g.pos = run.maze2.start.slice(); voice([O, 'clue_verrou'], { clue: true }); g.sabT = performance.now() + 5000; break;
    case 10: straightCables(); sfx.servo(); batt?.dip('servo');
      voice(C[10], { clue: true });
      if (run.lies.wire2False) pressure(6000, () => { const w = run.decoys.wire2; decoy('wire', w); voice(['taunt_branche', cableCue(w.cable), prise(w.socket)], { lie: true, now: true }); }); break;
    case 11: g.code = ''; voice(C[11], { clue: true });
      pressure(7000, () => { decoy('tx'); voice('taunt_rouge', { lie: true, now: true }); }); break;
    case 12: $('#gtTx').classList.add('armed'); voice([O, 'clue_transmit'], { clue: true }); voice('taunt_sceller', { lie: true }); break;
  }
  drawOled(); drawCyd2();
}
// pression pendant le choix : une réplique trompeuse après la consigne (si l'étape n'est pas finie)
function pressure(ms, fn) { const s = g.step; g.pressure.push(setTimeout(() => { if (g.running && g.step === s) fn(); }, ms)); }
function pressureEnc() {
  g._encTaunted = false;
  if (run.lies.encFalse && g.step === 1) pressure(4000, () => { const tgt = curEncTarget(); g.decoy = { enc: tgt.map((d) => (d + 3) % DETENTS) }; voice(['taunt_cetait', letter(RING[g.decoy.enc[0]]), 'taunt_depeche'], { lie: true, now: true }); });
  if (run.lies.encFalse && g.step === 8) pressure(5000, () => voice(['taunt_cetait', letter(run.decoys.word), 'taunt_depeche'], { lie: true, now: true }));
}
const curEncTarget = () => (g.step === 1 ? run.enc1 : run.enc2);
// KY-040 : toujours l'anneau cryptex de 20 lettres (A-V), jamais de chiffres ; position de départ au hasard
function setEncMode() {
  g.encMode = 'alpha'; const n = DETENTS;
  g.enc = [0, 0, 0, 0].map(() => Math.floor(Math.random() * n));
  g.encRaw = g.enc.slice();
  setEncVisual();
}
function decoy(kind, i) {
  clearDecoys();
  if (kind === 'trap') $(`.trap[data-i="${i}"]`)?.classList.add('decoy');
  if (kind === 'wire') { $(`#jacks .jack[data-s="${i.socket}"]`)?.classList.add('decoy'); $(`#cables .cable[data-c="${i.cable}"]`)?.classList.add('decoy'); }
  if (kind === 'tx') $('#gtTx').classList.add('decoy');
  setTimeout(clearDecoys, 3200);
}
function clearDecoys() { $$('.decoy').forEach((e) => e.classList.remove('decoy')); }

function good(nextN, fragIdx) {
  // réussite : l'étape avance tout de suite, et la voix aussi — plus de consigne / indice / fragment de l'étape d'avant
  cancelSeq();
  clearVoice();
  g.lastGoodAt = performance.now();
  sfx.confirm(); buzz(30); progress();
  flashModules('ok'); setStrip(`Étape ${g.step}/${NSTEPS} franchie`, 'Bien.', 'ok', 900);
  g.prob = Math.max(0.3, g.prob - 7.9); showProb();
  if (fragIdx != null) {
    if (run.lies.fragLies.includes(fragIdx)) voice(['clue_fragment', digit(run.decoys.frags[fragIdx])], { lie: true, now: true });
    voice(['clue_fragment', digit(run.frags[fragIdx])], { clue: true, now: !run.lies.fragLies.includes(fragIdx) });
  } else voice('outcome_ok', { now: true });
  if (nextN) nextStep(nextN, { holdStrip: 900 });
}
function bad(sec = 5, line = 'outcome_faux') {
  sfx.strike(); buzz(70);
  flashModules('ko'); setStrip('Faux', `−${sec} s`, 'ko', 2000);
  g.errors++; g.remaining -= sec; g.prob = Math.min(99.9, g.prob + 3.2); showProb();
  document.body.classList.remove('hit'); void document.body.offsetWidth; document.body.classList.add('hit');
  eye?.setMood('angry'); setTimeout(() => !g.lieUntil && g.running && eye?.setMood('watching'), 900);
  if (line) voice(line, { now: true });
}
function input() {
  g.lastInput = performance.now();
  if (g.hesitating) { g.hesitating = false; g.rate = 1; document.body.classList.remove('hesitate'); }
}

// ================= clarté (v0.2.4 / v0.2.5) : objectif, module actif, indices, retours =================
// Bandeau « Objectif » : la même phrase que dit l'Entité (quoi faire, quel module). À l'étape 10 : la consigne de
// câblage complète (couleur / prise), pas « nouvelle consigne ». Jamais une réponse calculée (codes, sauf ?debug=1).
const cueText = (id) => cue(id)?.text ?? '';
let stripTimer = 0;
function objectiveText() {
  if (g.phase === 'idle') return 'Ouvre la mallette.';
  if (g.phase === 'win') return 'Mallette désamorcée.';
  if (g.phase === 'boom') return 'Détonation.';
  const step = g.phase === 'play' ? g.step : 0;
  return sentence(objectiveIds(run, step)) || cueText(OBJECTIVE[step]);
}
// Portrait : si le bandeau long (étape 10) ferait défiler, la mallette est légèrement zoomée
// pour tenir sous le HUD. La consigne reste entière ; le zoom est remis à 1 dès que ça tient.
let fitLock = false;
function fitPlayfield() {
  const fm = $('#face-mallette'), hud = $('.hud'), app = $('#app');
  if (!fm || !hud || fitLock) return;
  fitLock = true;
  const prev = fm.style.zoom;
  fm.style.zoom = '';
  let next = '';
  // toute orientation : si le document déborde, on réduit un peu la mallette (sans tronquer le bandeau)
  if (!app?.hidden) {
    const se = document.scrollingElement || document.documentElement;
    const over = se.scrollHeight - se.clientHeight;
    if (over > 0) {
      const nat = fm.getBoundingClientRect().height;
      const avail = nat - over - 2;
      if (nat > 0 && avail > 200) next = Math.min(1, Math.max(0.82, avail / nat)).toFixed(3);
      if (next === '1.000') next = '';
    }
  }
  fm.style.zoom = next;
  const z = parseFloat(next || '1') || 1;
  fm.style.setProperty('--fit-zoom', String(z));
  // cible tactile ≥ 44 px *après* zoom (QA v0.2.6 : 44 CSS devenait 43,38 / 42,98)
  fm.style.setProperty('--hit-min', `${(44.25 / z).toFixed(3)}px`);
  requestAnimationFrame(() => {
    fitLock = false;
    if (next !== prev) {
      drawCables(true);
      if (g.phase === 'play' && (g.step === 5 || g.step === 9)) drawCyd2();
    }
  });
}
function showObjective() {
  clearTimeout(stripTimer);
  const o = $('#objective'); o.classList.remove('ok', 'ko', 'hint');
  const text = objectiveText();
  const long = g.phase === 'play' && g.step === 10;
  o.classList.toggle('long', long);
  document.body.classList.toggle('obj-long', long);
  $('#objLabel').textContent = g.phase === 'play' ? `Étape ${g.step}/${NSTEPS}` : 'Objectif';
  $('#objText').textContent = text;
  fitPlayfield();
}
// message temporaire dans le bandeau (retour Bien / Faux, indice), puis retour à l'objectif
function setStrip(label, text, kind, ms = 2200) {
  clearTimeout(stripTimer);
  const o = $('#objective'); o.classList.remove('ok', 'ko', 'hint', 'long');
  document.body.classList.remove('obj-long');
  if (kind) o.classList.add(kind);
  $('#objLabel').textContent = g.phase === 'play' && !/^Étape/.test(label) ? `Étape ${g.step}/${NSTEPS} · ${label}` : label; $('#objText').textContent = text;
  fitPlayfield();
  stripTimer = setTimeout(showObjective, ms);
}
// module(s) de l'étape : contour qui pulse (statique si mouvement réduit) ; un leurre ne brille jamais
function highlight() {
  $$('.active-mod').forEach((e) => e.classList.remove('active-mod'));
  const k = g.phase === 'play' ? g.step : g.phase === 'arm-toggle' ? 0 : null;
  if (k == null) return;
  for (const sel of MODULES[k] || []) $(sel)?.classList.add('active-mod');
}
function flashModules(kind) {
  const els = $$('.active-mod'); const cls = kind === 'ok' ? 'fx-ok' : 'fx-ko';
  els.forEach((e) => { e.classList.remove('fx-ok', 'fx-ko'); void e.offsetWidth; e.classList.add(cls); });
  setTimeout(() => els.forEach((e) => e.classList.remove(cls)), 650);
}
function progress() { g.progressT = performance.now(); }
// indices : 1 = où regarder (gratuit, automatique après 45 s sans progrès) ; 2 = la règle (−15 s) ; 3 = un morceau de la réponse dit à voix haute (−30 s)
function hintStep() { return g.phase === 'play' ? g.step : g.phase === 'arm-toggle' ? 0 : null; }
function hintUi() {
  const b = $('#btnHint'), k = hintStep(), next = g.hint + 1;
  const can = k != null && next <= 3;
  b.disabled = !can;
  const cost = !can ? '—' : (k === 0 || HINT_COST[next] === 0) ? 'gratuit' : `−${HINT_COST[next]} s`;
  $('#hintCost').textContent = cost;
  b.setAttribute('aria-label', can ? `Indice niveau ${next}, ${cost === 'gratuit' ? 'gratuit' : `coûte ${HINT_COST[next]} secondes`}` : 'Plus d’indice pour cette étape');
}
function giveHint(level, auto = false) {
  const k = hintStep(); if (k == null || level > 3 || level <= g.hint) return;
  g.hint = level; g.hintsUsed++;
  const cost = k === 0 ? 0 : HINT_COST[level];
  if (cost) { g.remaining -= cost; showTime(g.remaining); }
  const ids = hintCues(run, k, level, { pos: g.pos, sabotage: g.sabotage });
  sfx.push();
  const spoken = voice(ids, { now: true });
  // indices 1 et 2 de l'étape 3 parlent de la barre : rejouer la séquence, comme Réécouter
  if (k === 3 && level <= 2) showSeqAfterVoice(spoken);
  setStrip(cost ? `Indice ${level} · −${cost} s` : `Indice ${level}${auto ? ' · automatique' : ''}`, hintStrip(k, level).replace(/^Indice : /, ''), 'hint', 7000);
  hintUi();
}
// tutoriel (première partie, ou bouton « Comment jouer ») : 5 écrans, « Passer » à tout moment
const TUTO = [
  ['Écoute l’Entité', 'Elle dicte chaque consigne à voix haute : monte le son. « Réécouter » répète l’objectif et la consigne.'],
  ['Le module qui brille', 'Le bandeau en haut dit quoi faire. Le module à utiliser pulse en bleu : c’est lui qu’il faut toucher.'],
  ['Œil rouge = mensonge', 'Quand son œil vire au rouge, ce qu’elle dit est faux. Ignore-le et garde la consigne de l’œil bleu.'],
  ['Bloqué ?', 'Un indice arrive tout seul après 45 secondes sans progrès. Le bouton « Indice » en donne plus, contre du temps sur le chrono.'],
  ['Armer, puis TRANSMIT', 'Pour commencer : lève le capot bleu et bascule le levier. À la fin : capot rouge, puis levier TRANSMIT. Chaque erreur coûte du temps.'],
];
const TUTO_KEY = 'entite-tuto-vu';
const tutoSeen = () => { try { return localStorage.getItem(TUTO_KEY) === '1'; } catch { return true; } };
let tutoI = 0, tutoDone = null;
function showTuto(then) {
  tutoI = 0; tutoDone = then || null; $('#tuto').hidden = false; tutoPaint(); $('#tutoNext').focus({ preventScroll: true });
}
function tutoPaint() {
  const [t, body] = TUTO[tutoI];
  $('#tutoNo').textContent = tutoI + 1; $('#tutoTitle').textContent = t; $('#tutoBody').textContent = body;
  $$('.tuto-dots i').forEach((d, i) => d.classList.toggle('on', i === tutoI));
  $('#tutoNext').textContent = tutoI === TUTO.length - 1 ? 'Jouer' : 'Suivant';
}
function closeTuto() {
  try { localStorage.setItem(TUTO_KEY, '1'); } catch { /* privé */ }
  $('#tuto').hidden = true; const f = tutoDone; tutoDone = null; f?.();
}

// ---------- armement ----------
function resetHardware() {
  $$('.lock.key').forEach((l) => { l.classList.remove('on', 'ready'); const b = $('.lock-btn', l); b.disabled = true; b.setAttribute('aria-pressed', 'false'); });
  for (const k of ['Arm', 'Tx']) {
    const t = $(`#gt${k}`); t.classList.remove('open', 'on', 'armed', 'decoy', 'snap');
    $(`#cover${k}`).setAttribute('aria-expanded', 'false'); const lv = $(`#lever${k}`); lv.disabled = true; lv.setAttribute('aria-checked', 'false');
  }
}
function startGame() {
  if (!tutoSeen() && !q.has('notuto')) { showTuto(startGame); return; }
  clearVoice(); resetState(true); buildParts(); setEncVisual(); resetHardware();
  $('#intro').hidden = true; $('#app').hidden = false; $('#end').hidden = true;
  initAudio();
  // la mallette s'ouvre tout de suite : tout est à l'intérieur ; on arme avec le levier à capot bleu
  g.phase = 'arm-toggle'; showStep(); refreshView(); showObjective(); highlight(); hintUi(); progress();
  $('#face-mallette').classList.remove('opening'); void $('#face-mallette').offsetWidth; $('#face-mallette').classList.add('opening'); sfx.lidOpen();
  $('#gtArm').classList.add('armed');
  setTimeout(() => drawCables(true), 760);
  voice('intro'); voice('arm_cache', { clue: true });
  showTime(TIME_S); showProb();
  if (DEBUG) $('#seedTag').textContent = ` · graine ${run.seed} · ${run.tier}`;
  if (DEBUG) console.info('[entite] partie', run.seed, run.sig);
}
// levier à capot : 1er geste lève le capot, 2e bascule le levier (le capot se rabat si on le touche encore)
function coverTap(k) {
  input(); const key = k === 'Arm' ? 'coverArm' : 'coverTx';
  if (k === 'Arm' && g.armed) return;
  if (k === 'Tx' && g.txOn) return;
  g[key] = !g[key]; $(`#gt${k}`).classList.toggle('open', g[key]);
  $(`#cover${k}`).setAttribute('aria-expanded', String(g[key])); $(`#lever${k}`).disabled = !g[key];
  g[key] ? sfx.coverUp() : sfx.coverDown();
}
function armToggle() {
  if (g.phase !== 'arm-toggle' || !g.coverArm) return;
  g.armed = true; $('#leverArm').setAttribute('aria-checked', 'true'); $('#gtArm').classList.remove('armed'); $('#gtArm').classList.add('on');
  sfx.toggleSnap(); sfx.arm(); buzz([40, 60, 40]);
  flashModules('ok');
  g.phase = 'play'; g.running = true; g.startT = performance.now(); g.lastTick = performance.now(); g.lastInput = performance.now();
  clearVoice();
  g.lastGoodAt = performance.now();
  voice('depart', { now: true });
  startMusic();
  nextStep(1);
}
// levier rouge TRANSMIT : avant l'étape 12, c'est le raccourci que pousse l'Entité (−8 s, une erreur) ; le levier retombe
function txFlip() {
  input(); if (!g.coverTx || g.txOn) return;
  const t = $('#gtTx'), lv = $('#leverTx');
  sfx.toggleSnap();
  if (g.phase !== 'play') { t.classList.add('snap'); setTimeout(() => t.classList.remove('snap'), 420); return; }
  if (g.step !== 12) { t.classList.add('snap'); setTimeout(() => t.classList.remove('snap'), 420); bad(8); return; }
  g.txOn = true; lv.setAttribute('aria-checked', 'true'); t.classList.remove('armed'); t.classList.add('on'); sfx.hold();
  g.lastGoodAt = performance.now();
  setTimeout(() => g.running && endGame(true), 450);
}

// ---------- fin ----------
function endGame(win) {
  if (g.ended) return;
  g.ended = true; g.running = false; g.result = win ? 'win' : 'boom'; g.phase = win ? 'win' : 'boom'; g.endT = performance.now();
  g.pressure.forEach(clearTimeout); clearDecoys(); g.sabotage = false; clearVoice();
  showObjective(); highlight(); hintUi();
  document.body.classList.remove('hesitate', 'lying');
  $('#cyd1').classList.remove('liar');
  if (win) { stopMusic('fade'); sfx.win(); eye?.setMood('defused'); buzz([90, 90, 90]); voice('outcome_victoire', { now: true }); }
  else { stopMusic('cut'); sfx.boom(); batt?.dip('boom'); eye?.setMood('boom'); buzz([500, 120, 300, 120, 700]); voice('outcome_boom', { now: true }); document.body.classList.add('boom'); }
  const used = TIME_S - Math.max(0, g.remaining), mm = Math.floor(used / 60), ss = Math.floor(used % 60);
  setTimeout(() => {
    $('#endKicker').textContent = win ? 'Entité confinée' : 'Détonation';
    $('#endTitle').textContent = win ? 'Mallette désamorcée' : 'Prévisible.';
    $('#endSub').textContent = `${mm} min ${String(ss).padStart(2, '0')} s · ${g.errors} erreur${g.errors > 1 ? 's' : ''} · graine ${run.seed}`;
    $('#end').hidden = false; $('#btnAgain').focus();
  }, win ? 2200 : 1600);
}

// ================= gestes =================
function wire() {
  $('#btnStart').addEventListener('click', startGame);
  $('#btnAgain').addEventListener('click', () => { document.body.classList.remove('boom'); stopVoice(); startGame(); });
  $('#btnReplay').addEventListener('click', () => {
    if (!g.lastClue) return;
    const p = voice(g.lastClue, { now: true });
    if (g.step === 3) showSeqAfterVoice(p);
  });
  $('#btnHint').addEventListener('click', () => { input(); giveHint(g.hint + 1); });
  $('#btnHelp').addEventListener('click', () => showTuto(null));
  $('#tutoSkip').addEventListener('click', closeTuto);
  $('#tutoNext').addEventListener('click', () => { if (tutoI < TUTO.length - 1) { tutoI++; tutoPaint(); } else closeTuto(); });
  $('#btnPocket').addEventListener('click', () => { sfx.push(); $('#pocketDlg').showModal(); });
  const sonUi = () => { const m = isMuted(); $('#btnSon').setAttribute('aria-pressed', String(m)); $('#btnSon').setAttribute('aria-label', m ? 'Rétablir le son' : 'Couper le son'); };
  $('#btnSon').addEventListener('click', () => { setMuted(!isMuted()); sonUi(); });
  sonUi(); // état du bouton son gardé d'une session à l'autre (localStorage entite-son)

  // serrures Gebildet I, II, III (couvercle intérieur)
  $$('.lock.key').forEach((l) => $('.lock-btn', l).addEventListener('click', (e) => {
    input(); if (g.step !== 7) return;
    const k = +l.dataset.key; if (g.keysTurned.includes(k)) return;
    sfx.keyTurn();
    const expect = run.keyOrder[g.keysTurned.length];
    if (k !== expect) {
      bad(5); g.keysTurned = []; $$('.lock.key').forEach((x) => { x.classList.remove('on'); $('.lock-btn', x).setAttribute('aria-pressed', 'false'); }); return;
    }
    g.keysTurned.push(k); l.classList.add('on'); e.currentTarget.setAttribute('aria-pressed', 'true'); progress();
    if (g.keysTurned.length === 3) good(8);
  }));

  // leviers à capot (base) : bleu = armement, rouge = TRANSMIT
  $('#coverArm').addEventListener('click', () => coverTap('Arm'));
  $('#leverArm').addEventListener('click', () => { input(); armToggle(); });
  $('#coverTx').addEventListener('click', () => coverTap('Tx'));
  $('#leverTx').addEventListener('click', txFlip);
  // baie banane 5x5 (couvercle ↔ base)
  wirePatchbay();

  // encodeurs KY-040 : on tourne le bouton lui-même (aucun bouton + / −)
  //  - glisser : torsion autour du centre (18° = 1 cran) ou glissé horizontal (20 px = 1 cran), choisi aux 8 premiers px
  //  - molette : haut = +1, bas = −1
  //  - toucher sans glisser : tiers gauche = −1, tiers droit = +1, centre = clic du poussoir (valider)
  //  - clavier : ←/↓ = −1, →/↑ = +1, Entrée/Espace = clic
  // délégation sur #encRow : les boutons sont reconstruits à chaque partie (buildParts)
  const er = $('#encRow');
  let kn = null, ki = 0, sx = 0, sy = 0, cx = 0, cy = 0, aAcc = 0, aPrev = 0, done = 0, mode = null;
  const angle = (x, y) => Math.atan2(y - cy, x - cx) * 180 / Math.PI;
  er.addEventListener('pointerdown', (e) => {
    kn = e.target.closest('.knob'); if (!kn) return;
    e.preventDefault();
    const r = kn.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    ki = +kn.closest('.enc').dataset.i; sx = e.clientX; sy = e.clientY; aPrev = angle(sx, sy); aAcc = 0; done = 0; mode = null;
    kn.setPointerCapture?.(e.pointerId); kn.classList.add('held');
  });
  er.addEventListener('pointermove', (e) => {
    if (!kn) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    const a = angle(e.clientX, e.clientY); let da = a - aPrev; if (da > 180) da -= 360; if (da < -180) da += 360; aPrev = a; aAcc += da;
    if (!mode) {
      if (Math.hypot(dx, dy) < 8) return;
      // départ sur le bord + geste tangent (le long du cercle) = torsion ; départ près du centre = glissé horizontal
      const rx = sx - cx, ry = sy - cy, rr = Math.hypot(rx, ry) || 1, half = kn.getBoundingClientRect().width / 2;
      const radial = Math.abs((dx * rx + dy * ry) / rr), tang = Math.abs((dx * -ry + dy * rx) / rr);
      mode = rr > half * 0.45 && tang > radial ? 'twist' : 'h';
    }
    const want = mode === 'h' ? Math.trunc(dx / 20) : Math.trunc(aAcc / (360 / DETENTS));
    while (done < want) { done++; turn(ki, 1); }
    while (done > want) { done--; turn(ki, -1); }
  });
  const endKnob = (e, cancel) => {
    if (!kn) return;
    const k = kn; kn = null; k.classList.remove('held');
    if (k.hasPointerCapture?.(e.pointerId)) k.releasePointerCapture(e.pointerId);
    if (cancel || mode) return;
    const r = k.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
    if (fx < 1 / 3) turn(ki, -1); else if (fx > 2 / 3) turn(ki, 1); else pushEnc(ki);
  };
  er.addEventListener('pointerup', (e) => endKnob(e, false));
  er.addEventListener('pointercancel', (e) => endKnob(e, true));
  er.addEventListener('click', (e) => { const k = e.target.closest('.knob'); if (e.detail === 0 && k) pushEnc(+k.closest('.enc').dataset.i); });
  er.addEventListener('wheel', (e) => { const k = e.target.closest('.knob'); if (!k) return; e.preventDefault(); turn(+k.closest('.enc').dataset.i, e.deltaY < 0 ? 1 : -1); }, { passive: false });
  er.addEventListener('keydown', (e) => {
    const k = e.target.closest('.knob'); if (!k) return; const i = +k.closest('.enc').dataset.i;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); turn(i, 1); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); turn(i, -1); }
  });

  // trappes SG90
  $('#traps').addEventListener('click', (e) => {
    const door = e.target.closest('.trap-door'); if (!door) return;
    input();
    const t = door.closest('.trap'), i = +t.dataset.i;
    const shake = () => { t.classList.add('wiggle'); setTimeout(() => t.classList.remove('wiggle'), 400); };
    if (g.step !== 2 || g.trapOpen[i]) { sfx.wall(); shake(); return; }
    if (i === run.trap) { openTrap(i, 'ok'); good(3); }
    else { shake(); sfx.servo(); batt?.dip('servo'); bad(5); }
  });

  // clavier 4x4 (clavier pur)
  $('#keypad').addEventListener('pointerdown', (e) => { const k = e.target.closest('.kp-key'); if (!k) return; input(); press(k.dataset.k); });
  $('#keypad').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.kp-key')) { e.preventDefault(); input(); press(e.target.dataset.k); } });

  // joystick : glisser le chapeau, ou toucher une direction
  const joy = $('#joy'), cap = $('#joyCap');
  let jx = 0, jy = 0, jfired = false;
  $('.joy-well', joy).addEventListener('pointerdown', (e) => { jx = e.clientX; jy = e.clientY; jfired = false; e.currentTarget.setPointerCapture(e.pointerId); });
  $('.joy-well', joy).addEventListener('pointermove', (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - jx, dy = e.clientY - jy, r = Math.min(18, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    cap.style.transform = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`;
    if (!jfired && Math.hypot(dx, dy) > 22) { jfired = true; stick(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }
  });
  const release = () => { cap.style.transform = ''; };
  $('.joy-well', joy).addEventListener('pointerup', release); $('.joy-well', joy).addEventListener('pointercancel', release);
  $$('.joy-dir', joy).forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset.dir, v = DIRS[d]; cap.style.transform = `translate(${v[0] * 14}px, ${v[1] * 14}px)`; setTimeout(release, 140); stick(d);
  }));

  // clavier physique : flèches/WASD = joystick (face mallette), chiffres = clavier 4x4
  addEventListener('keydown', (e) => {
    if (!g.running || e.target.closest?.('.knob, .faces, dialog')) return;
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    if (map[e.key] && face === 'mallette' && (g.step === 5 || g.step === 9)) { e.preventDefault(); input(); stick(map[e.key]); }
    else if (/^[0-9]$/.test(e.key) && face === 'mallette') { input(); press(e.key); }
  });
}

function turn(i, s) {
  input(); if (g.phase !== 'play') return;
  const n = DETENTS;
  g.encRaw[i] += s; g.enc[i] = (g.enc[i] + s + n) % n; sfx.detent(); setEncVisual(); drawOled();
  // pression : quand un encodeur tombe juste, l'Entité affirme le contraire (une fois par étape)
  if ((g.step === 1 || g.step === 8) && !g._encTaunted && g.enc[i] === curEncTarget()[i] && g.enc.filter((v, k) => v === curEncTarget()[k]).length >= 2) {
    g._encTaunted = true;
    const right = curEncTarget()[i], wrong = (right + 3 + Math.floor(Math.random() * 5)) % n, stepAt = g.step;
    setTimeout(() => g.running && g.step === stepAt && voice(['taunt_cetait', letter(RING[wrong]), 'taunt_depeche'], { lie: true, now: true }), 300);
  }
}
function pushEnc(i) {
  input(); sfx.push();
  const kn = i != null ? $(`.enc[data-i="${i}"] .knob`) : null;
  if (kn) { kn.classList.remove('press'); void kn.offsetWidth; kn.classList.add('press'); setTimeout(() => kn.classList.remove('press'), 180); }
  if (g.step !== 1 && g.step !== 8) return;
  const ok = g.enc.every((v, k) => v === curEncTarget()[k]);
  if (ok) { $$('.enc').forEach((e) => e.classList.add('locked')); setTimeout(() => $$('.enc').forEach((e) => e.classList.remove('locked')), 900); good(g.step === 1 ? 2 : 9, g.step === 1 ? 0 : null); }
  else bad(5);
}
function openTrap(i, what) {
  g.trapOpen[i] = true; sfx.servo(); batt?.dip('trap');
  const t = $(`.trap[data-i="${i}"]`); t.classList.add('open');
  const well = $('.trap-well', t);
  well.innerHTML = what === 'keys' ? '<span class="keyset" role="img" aria-label="Clés I, II, III"><i></i><i></i><i></i></span>' : '<span class="trap-led" role="img" aria-label="Trappe ouverte"></span>';
}
// séquence lumineuse sur la barre WS2812B (étape 3) ; fake = fausse séquence de l'Entité (œil rouge).
// Un nouveau flashSeq / showSeqAfterVoice / cancelSeq invalide les timeouts encore en attente (pas de double anim, pas de DEL coincée).
let seqGen = 0;
function cancelSeq() { seqGen++; g.seqShow = null; }
function flashSeq(seq, fake = false) {
  const gen = ++seqGen, t0 = performance.now(), on = 520, gap = 260;
  g.seqShow = { seq, t0, on, gap, fake };
  seq.forEach((d, k) => setTimeout(() => { if (seqGen !== gen) return; sfx.simon(fake ? 'rouge' : ['bleu', 'vert', 'ambre', 'rouge'][k % 4]); }, k * (on + gap)));
  setTimeout(() => {
    if (seqGen !== gen) return;
    g.seqShow = null;
    // le leurre « 9 s après la consigne » part après la *première* vraie séquence : les mp3 ElevenLabs durent ~10 s, plus longs que l'ancien délai depuis le début d'étape
    if (!fake && g.running && g.step === 3 && !g._seqPressureArmed) {
      g._seqPressureArmed = true;
      pressure(9000, () => {
        if (!g.running || g.step !== 3) return;
        voice('taunt_regarde', { lie: true, now: true });
        flashSeq(run.seq.map((d) => (d % 8) + 1), true);
      });
    }
  }, seq.length * (on + gap) + 50);
}
// Après une voix (première consigne, Réécouter, indice 1 ou 2) : même flashSeq. Une nouvelle passe annule la précédente.
function showSeqAfterVoice(p) {
  const gen = ++seqGen;
  g.seqShow = null;
  // Réécouter / indice : annuler le leurre « 9 s » pour qu'il ne coupe pas la vraie séquence
  g.pressure.forEach(clearTimeout); g.pressure = [];
  return Promise.resolve(p).then(() => {
    if (seqGen !== gen || !g.running || g.phase !== 'play' || g.step !== 3) return false;
    flashSeq(run.seq);
    return true;
  });
}
function press(k) {
  sfx.keypad();
  const kp = $(`.kp-key[data-k="${k}"]`); kp?.classList.add('down'); setTimeout(() => kp?.classList.remove('down'), 110);
  if (g.step !== 3 && g.step !== 6 && g.step !== 11) return;
  if (!/^[0-9]$/.test(k)) { if (k === '*') { g.code = ''; drawOled(); } return; }
  g.code += k; drawOled();
  if (g.code.length < 4) return;
  const want = g.step === 3 ? run.seqCode : g.step === 6 ? run.code1 : run.code2, step = g.step;
  if (g.code === want) {
    g.code = ''; drawOled();
    if (step === 3) good(4, 1);
    else if (step === 6) {
      cancelSeq();
      clearVoice();
      g.lastGoodAt = performance.now();
      sfx.confirm(); g.prob = Math.max(0.3, g.prob - 7.9); showProb(); flashModules('ok'); setStrip(`Étape 6/${NSTEPS} franchie`, 'Bien.', 'ok', 900);
      voice('taunt_fini', { lie: true, now: true }); voice('taunt_couche2');
      openTrap((run.trap + 1) % 3, 'keys');
      nextStep(7, { holdStrip: 900 });
    } else good(12);
  } else { g.code = ''; setTimeout(drawOled, 250); bad(8); }
}
function stick(dir) {
  input(); sfx.joy();
  if (g.step !== 5 && g.step !== 9) return;
  const inv = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const d = g.sabotage ? inv[dir] : dir;
  const maze = g.step === 5 ? run.maze1 : run.maze2;
  if (!canMove(maze, g.pos, d)) { sfx.wall(); $('.cyd2').classList.remove('bump'); void $('.cyd2').offsetWidth; $('.cyd2').classList.add('bump'); drawCyd2(); return; }
  g.pos = [g.pos[0] + DIRS[d][0], g.pos[1] + DIRS[d][1]];
  { const key = g.pos.join(','); g.seen = g.seen || new Set(); if (!g.seen.has(g.step + ':' + key)) { g.seen.add(g.step + ':' + key); progress(); } }
  drawCyd2();
  if (g.pos[0] === maze.goal[0] && g.pos[1] === maze.goal[1]) {
    if (g.sabotage) endSabotage();
    good(g.step === 5 ? 6 : 10, g.step === 5 ? 3 : null);
  }
}
function startSabotage() { g.sabotage = true; g.sabEnd = performance.now() + 5500; $('.cyd2').classList.add('sab'); voice('sabotage_joystick', { lie: true, now: true }); sfx.glitch(); batt?.dip('sabotage'); }
function endSabotage() { g.sabotage = false; $('.cyd2').classList.remove('sab'); g.sabT = performance.now() + 7000; if (g.running && g.step === 9) voice('sabotage_fin', { now: true }); }
// ================= batterie 3S (CYD 2, coin haut droit) =================
// Mspalocell 12 V 5600 mAh Li-ion 3S : % + tension (courbe de décharge réelle), vidange lente, alerte < 15 %.
let batt = null;
function battInit() {
  const f = DEBUG && q.has('batt') ? Number(q.get('batt')) : null;
  batt = openBattery({ force: Number.isFinite(f) ? f : null });
  battShow(true);
}
function battShow(force) {
  const el = $('#batt'); if (!el || !batt) return;
  const pct = Math.round(batt.pct), v = batt.volts.toFixed(1).replace('.', ',');
  if (!force && el.dataset.pct === String(pct) && el.dataset.v === v) return;
  el.dataset.pct = pct; el.dataset.v = v; el.dataset.level = batt.level;
  el.style.setProperty('--fill', `${Math.max(4, batt.pct)}%`);
  $('#battPct').textContent = `${pct} %`; $('#battV').textContent = `${v} V`;
  el.setAttribute('aria-label', `Batterie ${pct} %, ${v} volts${batt.low ? ', faible' : ''}`);
  el.classList.toggle('low', batt.low);
}
function battTick(now) {
  if (!batt) return;
  const dt = Math.min(1, (now - (battTick.t || now)) / 1000); battTick.t = now;
  if (!$('#app').hidden) batt.tick(dt, g.running);
  if (!$('#app').hidden && batt.takeWarning()) { sfx.lowBatt(); battTick.warnings = (battTick.warnings || 0) + 1; }
  if (now - (battTick.s || 0) > 500) { battTick.s = now; battShow(); }
}

// ================= boucle =================
let eye = null;
const spkEl = document.getElementById('face-mallette');
function loop(now) {
  requestAnimationFrame(loop);
  battTick(now);
  // CYD 2 : le labyrinthe (étapes 5 et 9) pulse à ~30 i/s ; hors labyrinthe le n° est en HTML, pas d'animation ECG
  if (now - (loop.cydT || 0) > 32 && g.phase === 'play' && (g.step === 5 || g.step === 9) && !$('#app').hidden) { loop.cydT = now; drawCyd2(); }
  const vl = voiceLevel(); if (vl !== loop.vl) { loop.vl = vl; spkEl.style.setProperty('--vl', vl.toFixed(3)); } // haut-parleurs du couvercle
  if (eye) { eye.setVoice(vl); eye.lookAt(Math.sin(now / 2300) * 0.5, Math.sin(now / 3100) * 0.35); }
  if (g.running) {
    const dt = (now - g.lastTick) / 1000; g.lastTick = now;
    g.remaining -= dt * g.rate;
    showTime(g.remaining);
    const sec = Math.ceil(g.remaining);
    if (sec !== g.lastSec) {
      g.lastSec = sec;
      if (sec > 0) sfx.tick(sec <= 10 || g.hesitating);
      if (g.hesitating) sfx.joy();
      if (sec <= 30 && !g.said30) { g.said30 = true; sfx.alarm(); voice('outcome_trente', { now: true }); }
      if (sec <= 10 && !g.said10) { g.said10 = true; voice('outcome_dix', { now: true }); }
    }
    if (g.remaining <= 0) { showTime(0); endGame(false); return; }
    // indice 1 automatique après 45 s sans progrès sur l'étape (gratuit)
    if (g.hint === 0 && now - g.progressT > AUTO_HINT_MS) giveHint(1, true);
    // hésitation : 15 s sans geste → le temps accélère jusqu'au prochain geste
    if (!g.hesitating && now - g.lastInput > 15000) { g.hesitating = true; g.rate = 1.6; document.body.classList.add('hesitate'); voice('taunt_hesite', { now: true }); }
    // sabotage du joystick (étape 9) : fenêtres de 5,5 s, axes inversés, œil rouge
    if (g.step === 9) {
      if (!g.sabotage && now > g.sabT) startSabotage();
      else if (g.sabotage && now > g.sabEnd) endSabotage();
    }
    if (!g.lieUntil && eye && !g.ended) eye.setMood(g.remaining <= 30 ? 'angry' : 'watching');
    setMusicIntensity(Math.pow(Math.min(1, Math.max(0, 1 - g.remaining / TIME_S)), 1.8));
  }
  // barre WS2812B : 32 LED / 8 groupes de 4. Avant l'étape 2, progression ; à partir de l'étape 2, 8 couleurs (indice de la trappe)
  if (now - (loop.t || 0) > 80) {
    loop.t = now;
    let cols;
    if (g.phase === 'play' && g.step === 2) cols = run.bar.map((c) => LED[c]);
    else if (g.phase === 'play' && g.step === 3) {
      cols = Array(8).fill(null);
      const sh = g.seqShow;
      if (sh) { const t = now - sh.t0, k = Math.floor(t / (sh.on + sh.gap)); if (k < sh.seq.length && t % (sh.on + sh.gap) < sh.on) cols[sh.seq[k] - 1] = sh.fake ? LED.rouge : LED.cyan; }
    }
    else if (g.phase === 'play') { const done = Math.round((g.step - 1) / NSTEPS * 8); cols = Array.from({ length: 8 }, (_, i) => (i < done ? LED.cyan : i === done && Math.floor(now / 300) % 2 ? LED.ambre : null)); }
    else if (g.phase === 'win') { const a = Math.floor(((Math.sin(now / 500) + 1) / 2) * 8); cols = Array.from({ length: 8 }, (_, i) => (i <= a ? LED.cyan : null)); }
    else if (g.phase === 'boom') cols = Array.from({ length: 8 }, () => (Math.floor(now / 90) % 2 ? LED.rouge : null));
    else { const p = Math.floor(now / 110) % 14, pos = p < 8 ? p : 14 - p; cols = Array.from({ length: 8 }, (_, i) => (i === pos ? '#3d8bff' : null)); }
    if (performance.now() < g.lieUntil) cols = cols.map((c, i) => (Math.random() < 0.35 ? LED.rouge : c));
    setBar(cols);
    if (face === 'mallette') { drawCyd2(); drawOled(); }
  }
}

// ================= démarrage =================
function bootDone() {
  const el = document.getElementById('boot'), b = window.__boot;
  if (b) { b.ready = true; b.code = 1; b.asset = 1; b.paint(); }
  if (!el || el.hidden) return;
  el.classList.add('gone'); setTimeout(() => { el.hidden = true; }, 380);
}
function runBoot(onReady) {
  const b = window.__boot || { paint() {}, problem() {} };
  b.ready = true; b.code = 1; b.paint();
  const $id = (id) => document.getElementById(id);
  let finished = false;
  const finish = () => { if (finished) return; finished = true; clearTimeout(slow); bootDone(); onReady(); };
  const start = () => {
    $id('bootErr').hidden = true; $id('bootActions').hidden = true; $id('bootSub').textContent = 'musique et voix';
    preloadAll((f, done, n) => { b.asset = f; b.paint(); $id('bootSub').textContent = `musique, voix et polices · ${done}/${n}`; })
      .then(({ failed }) => {
        if (finished) return;
        if (!failed.length) { finish(); return; }
        b.problem(`${failed.length} fichier(s) n’ont pas pu être chargés. Tu peux réessayer, ou jouer sans.`, true);
      });
  };
  $id('bootRetry').onclick = () => { b.asset = 0; start(); };
  $id('bootSkip').onclick = finish;
  const slow = setTimeout(() => { if (!finished && $id('bootActions').hidden) { $id('bootSkip').textContent = 'Ouvrir sans attendre'; b.problem('Réseau lent : le chargement continue.', true); $id('bootRetry').hidden = true; } }, 8000);
  start();
}
// indicateur « ↓ COMMANDES » : seulement si la page déborde (écrans très courts) et tant qu'on n'est pas en bas
function initScrollPill() {
  const pill = $('#scrollPill'), se = document.scrollingElement || document.documentElement;
  const check = () => {
    const over = se.scrollHeight > se.clientHeight + 8;
    const atEnd = se.scrollTop + se.clientHeight >= se.scrollHeight - 24;
    const hide = $('#app').hidden || !over || atEnd;
    if (pill.hidden !== hide) pill.hidden = hide; // n'écrire que si ça change (sinon boucle avec le MutationObserver)
  };
  pill.addEventListener('click', () => scrollBy({ top: se.clientHeight * 0.7, behavior: 'smooth' }));
  addEventListener('scroll', check, { passive: true }); addEventListener('resize', check);
  new ResizeObserver(check).observe(document.body);
  new MutationObserver(check).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  check();
}
function initFullscreen() {
  const ok = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled), btn = $('#btnFs');
  if (!ok) return;
  btn.hidden = false;
  const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  btn.addEventListener('click', async () => {
    try { if (active()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document); else await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); } catch { /* refusé */ }
  });
  document.addEventListener('fullscreenchange', () => btn.setAttribute('aria-pressed', String(active())));
}
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  const go = async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage('SKIP_WAITING'); }); });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || reloaded || g.running) return; reloaded = true; location.reload(); });
    } catch { /* hors ligne non disponible */ }
  };
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
}

function init() {
  $('#ver').textContent = VERSION;
  if (DEBUG && SEED_Q != null) { $('#seedTag').hidden = false; $('#seedTag').textContent = ` · graine ${SEED_Q}`; }
  resetState();
  battInit();
  if (DEBUG && q.get('voix') === 'rapide') setVoiceFast(true);
  loadManifest().then(showObjective);
  // secours silencieux : sous-titre seulement si la synthèse vocale manque (ou son coupé)
  setCaptionHandler((text, lie) => { const c = $('#caption'); c.textContent = text; c.classList.toggle('show', !!text); c.classList.toggle('lie', !!lie); });
  eye = createEye($('#eye'), { config: deepMerge(EYE, { radiusOfMin: 0.3, center: { x: 0.5, y: 0.5 } }), reducedMotion: reduced });
  eye.start();
  wire(); initFullscreen(); initScrollPill();
  new ResizeObserver(() => { fitPlayfield(); drawCables(true); drawCyd2(); }).observe($('#face-mallette'));
  new ResizeObserver(fitPlayfield).observe($('.hud'));
  addEventListener('resize', () => { fitPlayfield(); drawCables(true); drawCyd2(); });
  showTime(TIME_S); showProb();
  requestAnimationFrame(loop);
  runBoot(() => { $('#btnStart').disabled = false; $('#btnStart').focus({ preventScroll: true }); registerSW(); });
  if (DEBUG) {
    window.__entiteDebug = {
      version: VERSION,
      get run() { return run; }, get state() { return g; }, get face() { return face; },
      voiceLog, voiceStats, musicStats, ttsAvailable,
      forceSabotage(on) { if (on) startSabotage(); else endSabotage(); },
      idle(ms) { g.lastInput = performance.now() - ms; },
      turn(i, s) { turn(i, s); }, pushEnc(i) { pushEnc(i); }, press(k) { press(k); }, stick(d) { stick(d); },
      audio: () => audioGraph(), DUCK, setVolume, getVolume, speak: (ids) => voice(ids, { now: true }),
      battery: () => ({ warnings: battTick.warnings || 0, pct: +batt.pct.toFixed(2), volts: +batt.volts.toFixed(2), level: batt.level, low: batt.low, why: batt.why, pack: PACK.name }), setBattery(p) { batt.set(p); battShow(true); }, battDip(k) { batt.dip(k); battShow(true); },
      sigDiff, lastSig, hint(l) { giveHint(l ?? g.hint + 1); }, ageStep(ms) { g.progressT -= ms; }, objective: () => ({ label: $('#objLabel').textContent, text: $('#objText').textContent, kind: $('#objective').className }),
      active: () => { const k = hintStep(); return k == null ? [] : MODULES[k].filter((sel) => $(sel)?.classList.contains('active-mod')); }, showTuto() { showTuto(null); },
      goto(n) { if (g.phase === 'play') nextStep(n); },
      get seqShow() { return g.seqShow; }, cancelSeq, clearVoice,
      cables: () => cableGeom.map((c) => ({ ...c })), oled: () => drawOled(), mazeGrid: () => g.mazeGridCss, get drag() { return drag; }, RING, DETENTS,
    };
  }
}
init();
