// game.js : tirage d'une partie v0.2.4 (logique pure, sans DOM). Même graine = même partie.
// Paliers cachés ~50/50 : 'moyen' et 'difficile' (choix de Pascal : moyen à difficile, au hasard). Pas de mode facile.
// Tout se déduit de la mallette elle-même (plaque du n° de série, écrans, barre DEL) : aucun manuel externe.

export function mulberry32(a) {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const TIME_S = 480;          // 8 min, comme la v0.1.5
export const NSTEPS = 12;
export const WIRE_COLORS = ['rouge', 'noir', 'jaune', 'vert', 'bleu']; // kit Keadic : 5 couleurs, une de chaque (jamais deux pareilles)
export const TRAP_COLORS = ['rouge', 'vert', 'bleu'];
const SERIAL_LETTERS = 'ABCDEFGHJLMNPRSTUV';     // lettres de l'anneau sans I ni O (confondus avec 1 et 0)
// Anneau cryptex des KY-040 : 20 crans = 1 tour = 20 lettres (sans K, Q, W, X, Y, Z)
export const RING = 'ABCDEFGHIJLMNOPRSTUV';
export const DETENTS = 20;
// Mots de 4 lettres français, toutes leurs lettres sur l'anneau
export const WORDS = ['NORD', 'CODE', 'LUNE', 'STOP', 'MARS', 'PORT', 'VENT', 'NUIT', 'CAGE', 'BLEU', 'NOIR', 'SOIR', 'TOUR', 'FILS', 'GARE', 'ROUE', 'PILE', 'DOSE', 'LAME', 'MURS', 'SAPE', 'FOUR'];

// Étapes : face où elle se joue + titre court (bandeau d'état).
export const STEPS = [
  null,
  { face: 'base',   part: 'enc',    title: 'Signal 1 · encodeurs' },
  { face: 'base',   part: 'traps',  title: 'Trappe' },
  { face: 'base',   part: 'bar',    title: 'Séquence lumineuse' },
  { face: 'base',   part: 'wires',  title: 'Baie banane · brancher' },
  { face: 'base',   part: 'cyd2',   title: 'Verrou de signal' },
  { face: 'base',   part: 'keypad', title: 'Code 1' },
  { face: 'base',   part: 'keys',   title: 'Clés I · II · III' },
  { face: 'base',   part: 'enc',    title: 'Signal 2 · mot (cryptex)' },
  { face: 'base',   part: 'cyd2',   title: 'Verrou saboté' },
  { face: 'base',   part: 'wires',  title: 'Baie banane · 2e couche' },
  { face: 'base',   part: 'keypad', title: 'Code 2' },
  { face: 'base',   part: 'toggleTx', title: 'Levier rouge' },
];

// v0.2.4 : chaque étape tire une VARIANTE de règle dans le bassin de son palier. Deux parties de suite diffèrent
// (app.js compare la signature run.sig à celle de la partie précédente, gardée dans localStorage).
// Bassins de variantes par étape et par palier (moyen / difficile). Toutes se résolvent avec ce qui est sur la mallette
// (plaque, barre DEL, anneau des encodeurs) et ce que l'Entité dicte. Rien n'est jamais écrit à l'écran.
export const POOLS = {
  enc1:   { moyen: ['ordre', 'envers'],          difficile: ['envers', 'suivante', 'paires'] },
  trap:   { moyen: ['frequente', 'gauche'],      difficile: ['rare', 'moyenne'] },
  seq:    { moyen: ['ordre', 'envers'],          difficile: ['envers', 'plus1'] },
  patch1: { moyen: ['route', 'echange', 'debranche'], difficile: ['route', 'echange', 'serie'] },
  code1:  { moyen: ['ordre', 'envers'],          difficile: ['envers', 'plus1'] },
  keys:   { moyen: ['legere', 'lourde'],         difficile: ['lourde', 'legere'] },
  word:   { moyen: ['ordre', 'envers'],          difficile: ['envers', 'suivante'] },
  patch2: { moyen: ['double', 'echange'],        difficile: ['double', 'serie'] },
  code2:  { moyen: ['envers', 'rotation'],       difficile: ['envers', 'decale'] },
};
export const SLOTS = Object.keys(POOLS);
export const TIERS = ['moyen', 'difficile'];
// nombre d'étapes à règle différente entre deux signatures
export function sigDiff(a, b) {
  if (!a || !b) return SLOTS.length + 1;
  const A = a.split('|'), B = b.split('|');
  let n = A[0] !== B[0] ? 1 : 0;
  for (let i = 1; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) n++;
  return n;
}
const nextOnRing = (ch) => RING[(RING.indexOf(ch) + 1) % DETENTS];

export function makeRun(seed) {
  const r = mulberry32(seed >>> 0);
  const int = (n) => Math.floor(r() * n);
  const pick = (a) => a[int(a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const tier = r() < 0.5 ? 'moyen' : 'difficile';      // ~50/50, caché (?debug=1 l'affiche)
  const hard = tier === 'difficile';
  const v = {}; for (const k of SLOTS) v[k] = pick(POOLS[k][tier]);

  // ---- n° de série : L C L C - L C L C — 4 lettres de l'anneau (toutes différentes, sans I ni O) pour les
  // encodeurs, 4 chiffres tous différents. Les rotatifs ne servent QU'AUX lettres, le clavier aux chiffres.
  const digits = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
  const sLetters = shuffle(SERIAL_LETTERS.split('')).slice(0, 4);
  const serial = `${sLetters[0]}${digits[0]}${sLetters[1]}${digits[1]}-${sLetters[2]}${digits[2]}${sLetters[3]}${digits[3]}`;
  const lot = 100 + int(900); // leurre sur la plaque
  const cues = {};

  // ---- 1. encodeurs (anneau A-V) : lettres du n° — ordre / envers / lettre suivante sur l'anneau / échangées par paires
  const L = sLetters;
  const encLetters = { ordre: L.slice(), envers: L.slice().reverse(), suivante: L.map(nextOnRing), paires: [L[1], L[0], L[3], L[2]] }[v.enc1];
  const enc1 = encLetters.map((ch) => RING.indexOf(ch));
  cues[1] = [`clue_enc1_${v.enc1}`];

  // ---- 2. trappe : barre WS2812B de 8 DEL, comptes 4/3/1 ou 5/2/1 (3 couleurs, comptes toujours distincts)
  const counts = pick([[4, 3, 1], [5, 2, 1]]);
  const order = shuffle(TRAP_COLORS);                      // order[0] = la plus présente … order[2] = la plus rare
  let bar = []; order.forEach((c, i) => { for (let k = 0; k < counts[i]; k++) bar.push(c); });
  bar = shuffle(bar);
  const trapColors = shuffle(TRAP_COLORS);                 // couleur du liseré de T1, T2, T3
  const trapColor = { frequente: order[0], moyenne: order[1], rare: order[2], gauche: bar[0] }[v.trap];
  const trap = trapColors.indexOf(trapColor);              // index 0..2
  cues[2] = [`clue_trappe_${v.trap}`];

  // ---- 3. séquence lumineuse : 4 DEL (positions 1..8) s'allument ; on tape au clavier 4x4 leurs positions
  // dans l'ordre / à l'envers / chacune plus un (2..9). Rien n'est écrit : il faut regarder et retenir.
  const seq = shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4);
  const seqCode = (v.seq === 'envers' ? seq.slice().reverse() : v.seq === 'plus1' ? seq.map((d) => d + 1) : seq).join('');
  cues[3] = [`clue_sequence_${v.seq}`];

  // ---- 4 et 10. baie banane 5x5 : 5 câbles ancrés sur la base (ports 0..4, couleurs toutes différentes),
  // chacun se branche dans N'IMPORTE LAQUELLE des 5 prises (0..4 = prises 1..5). Départ : câble c → prise c.
  // Une consigne = req { câble: prise | null (débranché) } ; les autres câbles sont libres.
  const wires = shuffle(WIRE_COLORS);
  const cab = (c) => `cable_${wires[c]}`, pr = (s) => `prise_${s + 1}`;
  const two = () => { const a = int(5); let b = int(4); if (b >= a) b++; return [a, b]; };
  const patchOf = (kind, layer) => {
    const head = layer === 1 ? 'clue_patch' : 'clue_patch2';
    if (kind === 'route') { const [A, N] = two(); return { kind, req: { [A]: N }, cues: ['clue_patch_route', cab(A), pr(N)] }; }
    if (kind === 'echange') { const [X, Y] = two(); return { kind, req: { [X]: Y, [Y]: X }, cues: [`${head}_echange`, cab(X), 'patch_et', cab(Y), 'patch_echange_fin'] }; }
    if (kind === 'debranche') { const [X, Y] = two(); return { kind, req: { [X]: null, [Y]: null }, cues: ['clue_patch_debranche', cab(X), 'patch_et', cab(Y), 'patch_laisse_deux'] }; }
    // serie : prise = rang (1..4) d'une lettre parmi les 4 lettres du n° de série ; le câble ne part pas déjà de cette prise
    const rank = int(4); let A = int(4); if (A >= rank) A++;
    if (kind === 'serie' && layer === 1) return { kind, req: { [A]: rank }, cues: ['clue_patch_serie', cab(A), 'patch_rang', `lettre_${L[rank].toLowerCase()}`] };
    // couche 2 « serie » : débranche B, puis A dans la prise au rang de la lettre
    let B = int(4); if (B >= A) B++; if (B === rank) B = [0, 1, 2, 3, 4].find((c) => c !== A && c !== rank);
    if (kind === 'serie') return { kind, req: { [B]: null, [A]: rank }, cues: ['clue_patch2_serie', cab(B), 'patch_laisse', cab(A), 'patch_rang', `lettre_${L[rank].toLowerCase()}`] };
    // double (v0.2.3) : débranche B et laisse-le débranché, puis C dans la prise M
    const [Bd, C] = two(); let M = int(4); if (M >= C) M++; if (M === Bd) M = [0, 1, 2, 3, 4].find((s) => s !== C && s !== Bd);
    return { kind, req: { [Bd]: null, [C]: M }, cues: ['clue_patch_double', cab(Bd), 'patch_laisse', cab(C), pr(M)] };
  };
  const patch1 = patchOf(v.patch1, 1);
  const patch2 = patchOf(v.patch2, 2);
  cues[4] = patch1.cues; cues[10] = patch2.cues;

  // ---- 5 et 9. verrous de signal : labyrinthe 5x5 visible sur le CYD 2
  const maze1 = makeMaze(5, r), maze2 = makeMaze(5, r);

  // ---- fragments (dictés après les étapes 1, 3, 4, 5, jamais écrits) ; codes 1 et 2 = règles tirées
  const frags = Array.from({ length: 4 }, () => int(10));
  const code1 = (v.code1 === 'envers' ? frags.slice().reverse() : v.code1 === 'plus1' ? frags.map((f) => (f + 1) % 10) : frags).join('');
  const last = digits[3];                                   // dernier chiffre de la plaque
  const code2 = (v.code2 === 'rotation' ? [frags[2], frags[3], frags[0], frags[1]] : v.code2 === 'decale' ? frags.map((f) => (f + last) % 10) : frags.slice().reverse()).join('');
  cues[6] = [v.code1 === 'ordre' ? 'clue_code1' : `clue_code1_${v.code1}`]; cues[11] = [`clue_code2_${v.code2}`];

  // ---- 7. clés I, II, III : chacune « pèse » un chiffre (I = 1er, II = 2e, III = 3e) ; légère → lourde ou l'inverse
  const keyOrder = [0, 1, 2].sort((a, b) => (v.keys === 'lourde' ? digits[b] - digits[a] : digits[a] - digits[b]));
  cues[7] = [`clue_cles_${v.keys}`];

  // ---- mensonges (œil rouge) : faux fragments ; le reste de la pression est dans app.js (pendant chaque choix)
  const fragLies = shuffle([0, 1, 2, 3]).slice(0, hard ? 3 : 2).sort();
  const lies = { fragLies, encFalse: hard, wire2False: hard, keysTwice: hard };
  // leurre de branchement : un câble et une prise qui violent la consigne
  const wrongPlug = (p) => {
    const ent = Object.entries(p.req).map(([c, s]) => [+c, s]);
    const tgt = ent.find(([, s]) => s != null);
    if (tgt) { const others = [0, 1, 2, 3, 4].filter((c) => c !== tgt[0]); return { cable: others[int(4)], socket: tgt[1] }; }
    const c = ent[0][0]; let s = int(4); if (s >= c) s++; return { cable: c, socket: s };
  };
  const decoys = { wire1: wrongPlug(patch1), wire2: wrongPlug(patch2), seq: (seq[0] % 8) + 1, frags: frags.map((f) => (f + 1 + int(9)) % 10), keys: keyOrder.slice().reverse() };

  // ---- 8. cryptex : 4 encodeurs (anneau de 20) ; l'Entité épelle un mot (ordre / à l'envers / « lettre suivante »)
  const word = pick(WORDS);
  const encWord = v.word === 'suivante' ? word.split('').map(nextOnRing).join('') : word;
  const enc2 = encWord.split('').map((ch) => RING.indexOf(ch));
  const spell = v.word === 'envers' ? word.split('').reverse().join('') : word;
  cues[8] = [`clue_mot_${v.word}`, ...spell.split('').map((ch) => `lettre_${ch.toLowerCase()}`)];
  decoys.word = RING[(enc2[0] + 3 + int(15)) % DETENTS];
  const sig = [tier, ...SLOTS.map((k) => v[k])].join('|');
  return {
    seed: seed >>> 0, tier, v, sig, serial, lot, digits, letters: sLetters, encLetters,
    enc1, enc2, word, encWord, spell, bar, counts, order, trapColors, trap, seq, seqCode,
    wires, patch1, patch2, maze1, maze2, frags, code1, code2, keyOrder, lies, cues,
    decoys,
  };
}

// Labyrinthe parfait (DFS) n x n. walls[y][x] = bits N1 E2 S4 W8 (1 = mur). Départ en bas à gauche, cible en haut à droite.
export const DIRS = { up: [0, -1, 1, 4], right: [1, 0, 2, 8], down: [0, 1, 4, 1], left: [-1, 0, 8, 2] };
export function makeMaze(n, r) {
  const walls = Array.from({ length: n }, () => Array(n).fill(15));
  const seen = Array.from({ length: n }, () => Array(n).fill(false));
  const stack = [[0, n - 1]]; seen[n - 1][0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = Object.values(DIRS).filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny][nx]; });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy, b, ob] = opts[Math.floor(r() * opts.length)];
    walls[y][x] &= ~b; walls[y + dy][x + dx] &= ~ob; seen[y + dy][x + dx] = true; stack.push([x + dx, y + dy]);
  }
  return { n, walls, start: [0, n - 1], goal: [n - 1, 0], path: solveMaze(walls, n, [0, n - 1], [n - 1, 0]) };
}
export function canMove(maze, [x, y], dir) {
  const [dx, dy, b] = DIRS[dir]; const nx = x + dx, ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= maze.n || ny >= maze.n) return false;
  return !(maze.walls[y][x] & b);
}
// suite de directions la plus courte (BFS)
function solveMaze(walls, n, s, g) {
  const prev = new Map(), key = ([x, y]) => `${x},${y}`, q = [s]; prev.set(key(s), null);
  while (q.length) {
    const c = q.shift(); if (c[0] === g[0] && c[1] === g[1]) break;
    for (const [d, [dx, dy, b]] of Object.entries(DIRS)) {
      const nx = c[0] + dx, ny = c[1] + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || (walls[c[1]][c[0]] & b) || prev.has(`${nx},${ny}`)) continue;
      prev.set(`${nx},${ny}`, [c, d]); q.push([nx, ny]);
    }
  }
  const out = []; let k = key(g);
  while (prev.get(k)) { const [c, d] = prev.get(k); out.unshift(d); k = key(c); }
  return out;
}
