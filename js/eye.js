// eye.js : rendu Canvas2D de l'œil de l'Entité.
// Tout est pré-rendu en sprites au redimensionnement (points, tirets, iris, collerette, halo, blocs),
// puis chaque image ne fait que des drawImage additifs : même logique que les sprites LovyanGFX du CYD.
import { EYE, MOODS } from './eye-config.js?v=0.2.6a';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function glowSprite(size, core, glow, sx = 1) {
  const c = mk(size * sx, size), g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.scale(sx, 1);
  const r = size / 2, gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
  gr.addColorStop(0, rgba(core, 1));
  gr.addColorStop(0.13, rgba(core, 0.95));
  gr.addColorStop(0.3, rgba(glow, 0.55));
  gr.addColorStop(0.58, rgba(glow, 0.13));
  gr.addColorStop(1, rgba(glow, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  return c;
}

export function createEye(canvas, opts = {}) {
  const C = opts.config || EYE;
  const P = C.palette;
  const fixed = opts.fixedSize || null;
  const fpsCap = opts.fpsCap || 0;
  const reduced = !!opts.reducedMotion;
  const ctx = canvas.getContext('2d', { alpha: false });

  let W = 0, H = 0, R = 0, cx = 0, cy = 0;
  let bg, vign, iris, irisBloom, coll, halo, dotS, dashS, emberS, emberDashS, disc;
  const blockS = [];
  let dAng, dR, dSize, dB, dRow, dTw, dKind, dotIdx, dashIdx, N = 0;
  let rowR, rowAngle, rowSpeed, rowBoost, ROWS = 0;
  let blocks = [];

  const mood = { ...MOODS.idle };
  let moodName = 'idle', target = MOODS.idle;
  let voice = 0, voiceS = 0;
  const look = { x: 0, y: 0 }, lookS = { x: 0, y: 0 };
  let irisAng = 0, beatAcc = 0, boomT = -1, trapT = -1, flash = 0, last = 0, lastDraw = 0, raf = 0;
  let waves = [];
  const stats = { fps: 0, frameMs: 0, dots: 0 };
  let fpsCount = 0, fpsT = 0, msAcc = 0;

  // ---------- pré-rendu ----------
  function bakeBackground() {
    bg = mk(W, H);
    const g = bg.getContext('2d'), r = rng(C.seed + 7);
    const gr = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(W, H) * 0.9);
    gr.addColorStop(0, P.bgCenter); gr.addColorStop(1, P.bgEdge);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // mur de données fixe : colonnes de petits blocs très sombres
    g.globalCompositeOperation = 'lighter';
    const col = R * 0.07;
    for (let i = 0; i < C.blocks.staticCount; i++) {
      const right = r() < C.blocks.rightBias;
      const x = Math.round((right ? W * (0.5 + r() * 0.55) : r() * W) / col) * col;
      const y = r() * H, w = col * (0.3 + r() * 1.6), h = Math.max(1, w * (0.15 + r() * 0.35));
      g.fillStyle = rgba(r() < 0.85 ? P.glow : P.core, 0.03 + r() * 0.12);
      g.fillRect(x, y, w, h);
    }
    vign = mk(W, H);
    const v = vign.getContext('2d');
    const vg = v.createRadialGradient(cx, cy, R * 1.2, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,2,6,${C.render.vignette})`);
    v.fillStyle = vg; v.fillRect(0, 0, W, H);
  }

  function bakeIris() {
    const S = Math.ceil(R * 2.3), o = S / 2, r = rng(C.seed + 1);
    iris = mk(S, S);
    const g = iris.getContext('2d');
    let gr = g.createRadialGradient(o, o, R * 0.35, o, o, R);
    gr.addColorStop(0, rgba(mix(P.iris, P.core, 0.25), 1));
    gr.addColorStop(0.5, rgba(P.iris, 1));
    gr.addColorStop(0.86, rgba(mix(P.iris, P.deep, 0.45), 1));
    gr.addColorStop(1, rgba(P.deep, 0.92));
    g.fillStyle = gr;
    g.beginPath(); g.arc(o, o, R, 0, TAU); g.fill();

    // creux sombres entre les pétales
    g.globalCompositeOperation = 'source-atop';
    g.lineCap = 'round';
    for (let i = 0; i < C.iris.petals * 1.6; i++) {
      const a = r() * TAU, r0 = R * (0.48 + r() * 0.1), r1 = R * (0.8 + r() * 0.25);
      g.strokeStyle = rgba(P.irisDark, 0.22 + r() * 0.3);
      g.lineWidth = R * (0.03 + r() * 0.05);
      g.beginPath();
      g.moveTo(o + Math.cos(a) * r0, o + Math.sin(a) * r0);
      const a2 = a + (r() - 0.5) * 0.12;
      g.quadraticCurveTo(o + Math.cos(a2) * (r0 + r1) / 2, o + Math.sin(a2) * (r0 + r1) / 2, o + Math.cos(a) * r1, o + Math.sin(a) * r1);
      g.stroke();
    }

    // fibres fines
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < C.iris.fibers; i++) {
      const a = r() * TAU, r0 = R * (0.4 + r() * 0.1), r1 = R * (0.62 + r() * 0.36);
      const k = 3 + r() * 6, ph = r() * TAU;
      g.strokeStyle = rgba(P.petal, 0.03 + r() * 0.11);
      g.lineWidth = Math.max(0.6, R * (0.003 + r() * 0.008));
      g.beginPath();
      for (let s = 0; s <= 6; s++) {
        const u = s / 6, rr = lerp(r0, r1, u), aa = a + Math.sin(u * k + ph) * 0.025 + u * 0.05;
        const x = o + Math.cos(aa) * rr, y = o + Math.sin(aa) * rr;
        s ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }

    // pétales : contours lumineux ondulés, comme des cellules étirées
    const petal = (a, rs, L, w, alpha, lw) => {
      const pts = 16, ph = r() * TAU, wob = 0.18 + r() * 0.3, fq = 3 + r() * 3;
      g.beginPath();
      for (let side = 0; side < 2; side++) {
        for (let s = 0; s <= pts; s++) {
          const u = side ? 1 - s / pts : s / pts;
          const rr = rs + L * u;
          const prof = Math.sqrt(Math.sin(Math.PI * u)) * (0.7 + 0.3 * u);
          const n = 1 + wob * Math.sin(u * fq * 2 + ph + side * 2.1);
          const aa = a + (side ? 1 : -1) * (w * prof * n) / rr + Math.sin(u * fq + ph) * 0.035;
          const x = o + Math.cos(aa) * rr, y = o + Math.sin(aa) * rr;
          side === 0 && s === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
      }
      g.closePath();
      g.fillStyle = rgba(P.petal, alpha * 0.12);
      g.fill();
      g.strokeStyle = rgba(P.petal, alpha);
      g.lineWidth = lw;
      g.stroke();
    };
    for (let p = 0; p < C.iris.petals; p++) {
      const a = (p / C.iris.petals) * TAU + (r() - 0.5) * 0.12;
      const rs = R * (0.42 + Math.pow(r(), 1.3) * 0.38), L = R * (0.12 + r() * 0.24), w = R * (0.035 + r() * 0.05);
      petal(a, rs, L, w, 0.4 + r() * 0.4, Math.max(0.8, R * 0.009));
      if (r() < 0.3) petal(a + (r() - 0.5) * 0.05, rs + L * 0.25, L * 0.5, w * 0.5, 0.45, Math.max(0.6, R * 0.007));
    }
    // boucles claires
    for (let i = 0; i < C.iris.wisps; i++) {
      const a = r() * TAU, rr = R * (0.5 + r() * 0.42), s = R * (0.02 + r() * 0.04);
      const x = o + Math.cos(a) * rr, y = o + Math.sin(a) * rr;
      g.strokeStyle = rgba(P.petal, 0.25 + r() * 0.45);
      g.lineWidth = Math.max(0.6, R * 0.007);
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + s * 2 * Math.cos(a + 1), y + s * 2 * Math.sin(a + 1), x + s * 2 * Math.cos(a - 1.4), y + s * 2 * Math.sin(a - 1.4), x + s * Math.cos(a), y + s * Math.sin(a));
      g.stroke();
    }
    // bord doux de l'iris
    g.globalCompositeOperation = 'destination-in';
    gr = g.createRadialGradient(o, o, R * 0.9, o, o, R * 1.01);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // limbe : cercle fin + second cercle pâle
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(P.petal, 0.75);
    g.lineWidth = Math.max(0.8, R * 0.009);
    g.beginPath(); g.arc(o, o, R * C.iris.limbus, 0, TAU); g.stroke();
    g.strokeStyle = rgba(P.glow, 0.4);
    g.lineWidth = Math.max(0.6, R * 0.005);
    g.beginPath(); g.arc(o, o, R * C.iris.limbusGap, 0, TAU); g.stroke();

    // halo flou = copie réduite de l'iris (agrandie au dessin)
    const small = mk(S / 6, S / 6);
    small.getContext('2d').drawImage(iris, 0, 0, small.width, small.height);
    irisBloom = mk(S / 12, S / 12);
    irisBloom.getContext('2d').drawImage(small, 0, 0, irisBloom.width, irisBloom.height);
  }

  function bakeCollarette() {
    const cr = R * C.pupil.collarette, S = Math.ceil(cr * 2.9), o = S / 2, r = rng(C.seed + 3);
    coll = mk(S, S);
    const g = coll.getContext('2d');
    const gr = g.createRadialGradient(o, o, 0, o, o, cr);
    gr.addColorStop(0, 'rgba(1,6,12,1)');
    gr.addColorStop(0.45, rgba(mix(P.irisDark, [1, 6, 12], 0.5), 0.95));
    gr.addColorStop(0.8, rgba(P.irisDark, 0.7));
    gr.addColorStop(1, rgba(P.irisDark, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(o, o, cr, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const pr = R * C.pupil.radius;
    for (let i = 0; i < C.pupil.streaks; i++) {
      const a = r() * TAU, r0 = pr * (1.1 + r() * 0.6), r1 = cr * (0.7 + r() * 0.55);
      const sw = C.pupil.swirl * (0.6 + r() * 0.8);
      g.strokeStyle = rgba(P.streak, 0.12 + r() * 0.5);
      g.lineWidth = Math.max(0.5, R * (0.0025 + r() * 0.005));
      g.beginPath();
      g.moveTo(o + Math.cos(a) * r0, o + Math.sin(a) * r0);
      const am = a + sw * 0.35, rm = (r0 + r1) * 0.5;
      g.quadraticCurveTo(o + Math.cos(am) * rm, o + Math.sin(am) * rm, o + Math.cos(a + sw * 0.5) * r1, o + Math.sin(a + sw * 0.5) * r1);
      g.stroke();
    }
  }

  function bakeDisc() {
    const T = C.trap, Rd = R * T.discRadius, S = Math.ceil(Rd * 2.2), o = S / 2, r = rng(C.seed + 21);
    disc = mk(S, S);
    const g = disc.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(o, o, Rd * 0.15, o, o, Rd);
    gr.addColorStop(0, rgba(P.glow, 0.5)); gr.addColorStop(0.3, rgba(P.deep, 0.35));
    gr.addColorStop(0.97, rgba(P.glow, 0.4)); gr.addColorStop(1, rgba(P.glow, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(o, o, Rd, 0, TAU); g.fill();
    for (let i = 0; i < T.grooves; i++) {
      const rr = Rd * (0.3 + 0.68 * (i / T.grooves));
      g.strokeStyle = rgba(r() < 0.2 ? P.core : P.glow, 0.08 + r() * 0.3);
      g.lineWidth = Math.max(0.6, Rd * 0.006);
      g.beginPath(); g.arc(o, o, rr, r() * TAU, r() * TAU + TAU * (0.6 + r() * 0.4)); g.stroke();
    }
    if (g.createConicGradient) {
      const cg = g.createConicGradient(0, o, o);
      cg.addColorStop(0, rgba(P.core, 0.55)); cg.addColorStop(0.08, rgba(P.core, 0));
      cg.addColorStop(0.5, rgba(P.core, 0)); cg.addColorStop(0.56, rgba(P.core, 0.4)); cg.addColorStop(0.62, rgba(P.core, 0));
      cg.addColorStop(1, rgba(P.core, 0.55));
      g.fillStyle = cg; g.beginPath(); g.arc(o, o, Rd * 0.98, 0, TAU); g.arc(o, o, Rd * 0.3, 0, TAU, true); g.fill();
    }
    g.strokeStyle = rgba(P.core, 0.9); g.lineWidth = Math.max(1, Rd * 0.012);
    g.beginPath(); g.arc(o, o, Rd * 0.99, 0, TAU); g.stroke();
    g.beginPath(); g.arc(o, o, Rd * 0.22, 0, TAU); g.stroke();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(o, o, Rd * 0.13, 0, TAU); g.fill();
  }

  function bakeSprites() {
    const ds = Math.max(16, Math.ceil(R * C.rings.dotSize[1] * 1.2));
    dotS = glowSprite(ds, P.core, P.glow);
    dashS = glowSprite(ds, P.core, P.glow, 2.2);
    emberS = glowSprite(ds, [255, 220, 200], P.ember);
    emberDashS = glowSprite(ds, [255, 220, 200], P.ember, 2.2);
    halo = mk(256, 256);
    const g = halo.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, rgba(P.glow, 1)); gr.addColorStop(0.42, rgba(P.glow, 0.42));
    gr.addColorStop(0.7, rgba(P.deep, 0.14)); gr.addColorStop(1, rgba(P.deep, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    blockS.length = 0;
    for (let l = 0; l < C.blocks.blurLevels; l++) {
      const pad = 6 + l * 16, bw = 64, bh = 24, c = mk(bw + pad * 2, bh + pad * 2), b = c.getContext('2d');
      b.shadowColor = rgba(P.glow, 1);
      b.shadowBlur = 4 + l * 14;
      b.fillStyle = rgba(l ? P.glow : mix(P.core, P.glow, 0.82), l ? 0.75 - l * 0.12 : 1);
      b.fillRect(pad, pad, bw, bh);
      blockS.push({ c, pad, bw, bh });
    }
  }

  function buildDots() {
    const RC = C.rings, r = rng(C.seed);
    ROWS = RC.rows + 1;
    rowR = new Float32Array(ROWS); rowAngle = new Float32Array(ROWS);
    rowSpeed = new Float32Array(ROWS); rowBoost = new Float32Array(ROWS);
    const list = [];
    for (let i = 0; i < RC.rows; i++) {
      const u = i / Math.max(1, RC.rows - 1);
      const rr = lerp(RC.inner, RC.outer, Math.pow(u, 0.92)) + (r() - 0.5) * RC.spacing * 0.4;
      rowR[i] = rr;
      const grp = Math.floor(i / RC.groupSize);
      if (i % RC.groupSize === 0) rowSpeed[i] = (grp % 2 ? -1 : 1) * lerp(RC.speed[0], RC.speed[1], r());
      else rowSpeed[i] = rowSpeed[i - 1] * (0.9 + r() * 0.2);
      rowAngle[i] = r() * TAU;
      const count = Math.floor((TAU * rr) / (RC.spacing * (0.85 + r() * 0.3)));
      const cov = lerp(RC.coverage[0], RC.coverage[1], r()) * (1 - u * 0.2);
      const step = TAU / count;
      let on = r() < cov, left = (0.15 + r() * 1.1);
      for (let j = 0; j < count; j++) {
        left -= step;
        if (left <= 0) { on = r() < cov; left = on ? 0.2 + r() * 1.4 : 0.08 + r() * 0.6; }
        if (!on) continue;
        const big = 1 - u * 0.45;
        list.push({
          a: j * step + (r() - 0.5) * step * 0.3, row: i, r: rr,
          s: lerp(RC.dotSize[0], RC.dotSize[1], Math.pow(r(), 1.6)) * big,
          b: (1 - RC.falloff * u) * (0.55 + 0.65 * Math.pow(r(), 0.6)),
          k: r() < RC.dashRatio ? 1 : 0, tw: r() * TAU,
        });
      }
    }
    const os = RC.outerSparse, last = RC.rows;
    rowR[last] = os.r; rowSpeed[last] = -RC.speed[0] * 0.7; rowAngle[last] = 0;
    for (let j = 0; j < os.count; j++) {
      list.push({ a: r() * TAU, row: last, r: os.r + (r() - 0.5) * 0.15, s: os.size * (0.6 + r() * 0.6), b: 0.18 + r() * 0.3, k: r() < 0.5 ? 1 : 0, tw: r() * TAU });
    }
    N = list.length;
    dAng = new Float32Array(N); dR = new Float32Array(N); dSize = new Float32Array(N);
    dB = new Float32Array(N); dRow = new Uint8Array(N); dTw = new Float32Array(N); dKind = new Uint8Array(N);
    const di = [], ka = [];
    list.forEach((d, i) => {
      dAng[i] = d.a; dR[i] = d.r; dSize[i] = d.s; dB[i] = d.b; dRow[i] = d.row; dTw[i] = d.tw; dKind[i] = d.k;
      (d.k ? ka : di).push(i);
    });
    dotIdx = Uint16Array.from(di); dashIdx = Uint16Array.from(ka);
    stats.dots = N;
  }

  function buildBlocks() {
    const B = C.blocks, r = rng(C.seed + 11);
    blocks = [];
    for (let i = 0; i < B.count; i++) {
      const depth = r();
      const lvl = Math.min(B.blurLevels - 1, Math.floor(Math.abs(depth - 0.35) * B.blurLevels * 1.6));
      const w = R * lerp(B.size[0], B.size[1], Math.pow(r(), 2)) * (0.5 + depth);
      const right = r() < B.rightBias;
      blocks.push({
        x: right ? W * (0.5 + r() * 0.6) : r() * W, y: r() * H, w, h: Math.max(1.5, w * lerp(B.aspect[0], B.aspect[1], r())),
        lvl, depth, b: (lvl ? 0.55 : 0.85) * (0.35 + r() * 0.65), tw: 0.3 + r() * 1.2, ph: r() * TAU,
      });
    }
  }

  function resize() {
    let dpr = 1;
    if (fixed) { W = fixed.w; H = fixed.h; }
    else {
      dpr = Math.min(window.devicePixelRatio || 1, C.render.maxDpr);
      W = Math.max(1, Math.round(canvas.clientWidth * dpr));
      H = Math.max(1, Math.round(canvas.clientHeight * dpr));
    }
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    R = Math.min(W * C.radiusOfMin, H * C.radiusOfHeight);
    cx = W * C.center.x; cy = H * C.center.y;
    bakeSprites(); bakeDisc(); bakeBackground(); bakeIris(); bakeCollarette(); buildDots(); buildBlocks();
  }

  // ---------- image ----------
  function draw(dt, t) {
    const k = 1 - Math.exp(-dt * 2.2);
    for (const key in target) mood[key] = lerp(mood[key], target[key], k);
    voiceS = lerp(voiceS, voice, 1 - Math.exp(-dt * 16));
    const lk = 1 - Math.exp(-dt * C.look.ease);
    lookS.x = lerp(lookS.x, look.x, lk); lookS.y = lerp(lookS.y, look.y, lk);
    const spinF = reduced ? 0.3 : 1;

    beatAcc += dt;
    if (boomT < 0 && beatAcc > C.heartbeat * mood.beat) { beatAcc = 0; waves.push(C.rings.inner - 0.4); }
    const wsp = C.wave.speed * (reduced ? 0.6 : 1);
    for (let i = waves.length - 1; i >= 0; i--) { waves[i] += dt * wsp; if (waves[i] > C.rings.outer + 0.8) waves.splice(i, 1); }
    for (let i = 0; i < ROWS; i++) {
      rowAngle[i] += rowSpeed[i] * mood.spin * spinF * dt;
      let bst = 0;
      for (const w of waves) bst += Math.max(0, 1 - Math.abs(rowR[i] - w) / C.wave.width);
      rowBoost[i] = 1 + bst * C.wave.amount * mood.pulse + voiceS * C.voice.glow * 0.6;
    }
    irisAng += C.iris.spin * mood.spin * spinF * dt;
    if (boomT >= 0) boomT += dt;
    let trapE = 0;
    if (trapT >= 0) {
      trapT += dt;
      const u = Math.min(1, trapT / C.trap.duration);
      trapE = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    }

    const jit = reduced ? 0 : mood.jitter * R;
    const ox = cx + (Math.random() - 0.5) * jit * 2, oy = cy + (Math.random() - 0.5) * jit * 2;
    const scale = (1 + voiceS * C.voice.scale + (boomT >= 0 ? Math.pow(boomT, 1.4) * 0.5 : 0)) * (1 - trapE * (1 - C.trap.shrink));
    const bright = mood.bright * (1 + voiceS * 0.25);
    const boomFade = boomT >= 0 ? clamp(1 - boomT / 1.6, 0, 1) : 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);

    // blocs de données
    ctx.globalCompositeOperation = 'lighter';
    const B = C.blocks, bsp = mood.blocks * (reduced ? 0.3 : 1);
    for (const b of blocks) {
      const sp = (0.35 + b.depth) * bsp * R;
      b.x += B.drift.x * sp * dt; b.y += B.drift.y * sp * dt;
      if (b.x < -b.w * 2) b.x = W + b.w; if (b.y < -b.h * 4) b.y = H + b.h * 2;
      const s = blockS[b.lvl], a = b.b * (0.55 + 0.45 * Math.sin(t * b.tw + b.ph)) * (boomT >= 0 ? boomFade : 1) * Math.min(1, bright + 0.1);
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      const sx = b.w / s.bw, sy = b.h / s.bh;
      ctx.drawImage(s.c, b.x - s.pad * sx, b.y - s.pad * sy, s.c.width * sx, s.c.height * sy);
    }

    // halo
    const hr = R * C.halo.radius * scale;
    ctx.globalAlpha = clamp(C.halo.alpha * bright * (1 + voiceS * C.voice.glow) * boomFade, 0, 1);
    ctx.drawImage(halo, ox - hr, oy - hr, hr * 2, hr * 2);

    // anneaux de points
    const lightA = C.rings.light.angle, lightK = C.rings.light.amount;
    const emberN = mood.ember;
    const boomPush = boomT >= 0 ? Math.pow(boomT, 1.25) * R * 1.6 : 0;
    const drawSet = (idx, dash) => {
      for (let n = 0; n < idx.length; n++) {
        const i = idx[n], row = dRow[i];
        const a = dAng[i] + rowAngle[row];
        const ca = Math.cos(a), sa = Math.sin(a);
        const lit = 1 - lightK + lightK * (0.5 + 0.5 * Math.cos(a - lightA));
        let al = dB[i] * rowBoost[row] * lit * bright * (0.78 + 0.22 * Math.sin(t * 2.3 + dTw[i]));
        const rad = (trapE ? lerp(dR[i], 0.35 + dR[i] * 0.28, trapE) : dR[i]) * R * scale + boomPush * (0.5 + (dTw[i] / TAU));
        if (boomT >= 0) al *= clamp(1 - boomT / 2.4, 0, 1);
        if (trapE) al *= 1 - trapE * 0.85;
        if (al < 0.015) continue;
        ctx.globalAlpha = al > 1 ? 1 : al;
        const x = ox + ca * rad, y = oy + sa * rad, s = dSize[i] * R;
        const ember = emberN > 0 && (dTw[i] / TAU) < emberN;
        if (dash) {
          ctx.setTransform(-sa, ca, -ca, -sa, x, y);
          ctx.drawImage(ember ? emberDashS : dashS, -s * 1.1, -s / 2, s * 2.2, s);
        } else {
          ctx.drawImage(ember ? emberS : dotS, x - s / 2, y - s / 2, s, s);
        }
      }
    };
    drawSet(dotIdx, false);
    drawSet(dashIdx, true);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // iris
    const lx = lookS.x * C.look.max * R, ly = lookS.y * C.look.max * R;
    const irisAlpha = clamp(Math.min(1, 0.35 + bright * 0.7) * boomFade * (1 - trapE), 0, 1);
    if (irisAlpha > 0.01) {
      const ix = ox + lx * 0.45, iy = oy + ly * 0.45, S = iris.width;
      const cI = Math.cos(irisAng) * scale, sI = Math.sin(irisAng) * scale;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = irisAlpha;
      ctx.setTransform(cI, sI, -sI, cI, ix, iy);
      ctx.drawImage(iris, -S / 2, -S / 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(C.iris.bloom * bright * (1 + voiceS * 0.9) * boomFade, 0, 1);
      const bs = S * 1.22 * scale;
      ctx.drawImage(irisBloom, ix - bs / 2, iy - bs / 2, bs, bs);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = irisAlpha;
      // collerette + pupille
      let pr = C.pupil.radius * mood.pupil + voiceS * C.voice.pupil + Math.sin(t * 0.9) * 0.004;
      pr = clamp(pr, C.pupil.min, C.pupil.max);
      const cs = scale * (0.82 + 0.18 * (pr / C.pupil.radius));
      const cc = Math.cos(-irisAng * 1.6) * cs, sc = Math.sin(-irisAng * 1.6) * cs;
      ctx.setTransform(cc, sc, -sc, cc, ox + lx, oy + ly);
      ctx.drawImage(coll, -coll.width / 2, -coll.height / 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const prp = pr * R * scale * 1.25;
      const pg = ctx.createRadialGradient(ox + lx, oy + ly, 0, ox + lx, oy + ly, prp);
      pg.addColorStop(0, 'rgba(0,0,0,1)'); pg.addColorStop(0.72, 'rgba(1,4,9,1)'); pg.addColorStop(1, 'rgba(1,4,9,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(ox + lx, oy + ly, prp, 0, TAU); ctx.fill();
    }

    if (trapE > 0) {
      const ds = disc.width * scale * (0.75 + 0.25 * trapE);
      const da = t * C.trap.discSpin, cd = Math.cos(da), sd = Math.sin(da);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = trapE * (0.85 + voiceS * 0.15);
      ctx.setTransform(cd, sd, -sd, cd, ox, oy);
      ctx.drawImage(disc, -ds / 2, -ds / 2, ds, ds);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(vign, 0, 0);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, flash);
      ctx.fillStyle = 'rgb(190,232,255)';
      ctx.fillRect(0, 0, W, H);
      flash -= dt * 1.6;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (fpsCap && now - lastDraw < 1000 / fpsCap - 2) return;
    const dt = last ? Math.min(0.06, (now - last) / 1000) : 0.016;
    last = now; lastDraw = now;
    const t0 = performance.now();
    draw(dt, now / 1000);
    msAcc += performance.now() - t0;
    fpsCount++;
    if (now - fpsT >= 1000) {
      stats.fps = Math.round((fpsCount * 1000) / (now - fpsT));
      stats.frameMs = +(msAcc / fpsCount).toFixed(2);
      fpsCount = 0; msAcc = 0; fpsT = now;
    }
  }

  resize();
  if (!fixed && 'ResizeObserver' in window) {
    let pend = 0;
    new ResizeObserver(() => { cancelAnimationFrame(pend); pend = requestAnimationFrame(resize); }).observe(canvas);
  }

  return {
    stats,
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    setMood(name) {
      if (!MOODS[name] || name === moodName) return;
      moodName = name; target = MOODS[name];
      if (name === 'boom') { boomT = 0; flash = reduced ? 0.35 : 1; }
      if (name !== 'boom') boomT = -1;
      trapT = name === 'defused' ? 0 : -1;
    },
    get mood() { return moodName; },
    setVoice(v) { voice = clamp(v, 0, 1); },
    lookAt(x, y) { look.x = clamp(x, -1, 1); look.y = clamp(y, -1, 1); },
    pulse() { waves.push(C.rings.inner - 0.4); },
    resize,
    get center() { return { x: cx, y: cy, r: R, w: W, h: H }; },
  };
}
