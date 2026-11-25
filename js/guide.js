// guide.js (v0.2.5) : clarté du jeu (retour de Pascal : « on reste bloqué sans savoir quoi faire »).
// Pour chaque étape : un OBJECTIF court (dit par l'Entité ET écrit dans le bandeau), le ou les MODULES à utiliser
// (contour qui pulse), et 3 niveaux d'INDICES. Règle de Pascal : le bandeau dit QUOI faire et OÙ, jamais une réponse
// calculée (aucun code, sauf ?debug=1). À l'étape 10 le bandeau reprend la consigne dictée (couleur / prise). Seul l'indice 3 DIT (à voix haute) un morceau de la réponse.
// Logique pure (sans DOM) : testable avec node.
import { RING, DIRS, canMove } from './game.js?v=0.2.6a';

// objectif : id de réplique (voix/manifest.json) ; le texte du bandeau = le texte de la réplique (même phrase)
export const OBJECTIVE = {
  0: 'obj_armer', 1: 'obj_molettes_code', 2: 'obj_trappe', 3: 'obj_sequence', 4: 'obj_cables', 5: 'obj_verrou', 6: 'obj_code',
  7: 'obj_cles', 8: 'obj_mot', 9: 'obj_verrou', 10: 'obj_cables2', 11: 'obj_code', 12: 'obj_transmit',
};
// Étape 10 : le bandeau reprend la consigne dictée (couleur / prise, ou rang d'une lettre), pas le résumé vague
// « Rebranche les câbles : nouvelle consigne. ». Ce n'est pas une réponse calculée : c'est le même indice que la voix.
export function objectiveIds(run, step) {
  if (step === 10 && run?.cues?.[10]) return run.cues[10];
  return OBJECTIVE[step] ? [OBJECTIVE[step]] : [];
}
// modules à faire briller (sélecteurs) ; jamais un leurre
export const MODULES = {
  0: ['#gtArm'], 1: ['#encRow', '#oled'], 2: ['#traps'], 3: ['#bar', '#keypad'], 4: ['#jacks', '#ports'], 5: ['.cyd2', '#joy'],
  6: ['#keypad'], 7: ['#keyRow'], 8: ['#encRow', '#oled'], 9: ['.cyd2', '#joy'], 10: ['#jacks', '#ports'], 11: ['#keypad'], 12: ['#gtTx'],
};
export const HINT_COST = { 1: 0, 2: 15, 3: 30 };   // secondes retirées du chrono
export const AUTO_HINT_MS = 45000;                  // indice 1 automatique après 45 s sans progrès

const H1 = { 1: 'hint1_plaque', 2: 'hint1_barre', 3: 'hint1_sequence', 4: 'hint1_cables', 5: 'hint1_verrou', 6: 'hint1_code', 7: 'hint1_cles', 8: 'hint1_mot', 9: 'hint1_verrou', 10: 'hint1_cables', 11: 'hint1_code', 12: 'hint1_transmit' };
// bandeau des indices : la SOURCE d'information ou la méthode, jamais la valeur
const RULE = 'Indice : écoute la règle, pas à pas';
const STRIP = {
  0: ['Indice : capot bleu, puis levier', 'Indice : deux gestes, capot puis levier', 'Indice : deux gestes, capot puis levier'],
  1: ['Indice : regarde le n° de série, sur l’écran du bas', RULE, 'Indice : la première molette est dite'],
  2: ['Indice : compte les couleurs de la barre', RULE, 'Indice : la bonne trappe est dite'],
  3: ['Indice : Réécouter, sur l’écran du bas, puis la barre', RULE, 'Indice : le premier chiffre est dit'],
  4: ['Indice : écoute la couleur et la prise', RULE, 'Indice : le premier geste est dit'],
  5: ['Indice : contourne les murs', 'Indice : essaie vers la droite et le haut', 'Indice : la première direction est dite'],
  6: ['Indice : reprends les fragments dictés (œil bleu)', 'Indice : écoute la règle et les fragments', 'Indice : le premier chiffre est dit'],
  7: ['Indice : regarde les chiffres du n° de série, sur l’écran du bas', RULE, 'Indice : la première serrure est dite'],
  8: ['Indice : Réécouter, sur l’écran du bas, puis lis l’OLED', RULE, 'Indice : la première molette est dite'],
  12: ['Indice : capot rouge, puis levier', 'Indice : deux gestes, capot puis levier', 'Indice : deux gestes, capot puis levier'],
};
STRIP[9] = STRIP[5]; STRIP[10] = STRIP[4]; STRIP[11] = STRIP[6];
export const hintStrip = (step, level) => STRIP[step]?.[level - 1] ?? 'Indice';

const cab = (run, c) => `cable_${run.wires[c]}`;
const pr = (s) => `prise_${s + 1}`;
const dig = (d) => `chiffre_${d}`;
const let_ = (ch) => `lettre_${ch.toLowerCase()}`;
const DIR_CUE = { up: 'dir_haut', down: 'dir_bas', left: 'dir_gauche', right: 'dir_droite' };
// premier pas du plus court chemin depuis pos (BFS) ; c'est le déplacement du point, pas le geste du joystick
export function firstMove(maze, pos) {
  const key = (p) => p.join(','), prev = new Map([[key(pos), null]]), q = [pos];
  while (q.length) {
    const c = q.shift();
    if (c[0] === maze.goal[0] && c[1] === maze.goal[1]) { let k = key(c), d = null; while (prev.get(k)) { [k, d] = [prev.get(k)[0], prev.get(k)[1]]; } return d; }
    for (const d of Object.keys(DIRS)) { if (!canMove(maze, c, d)) continue; const n = [c[0] + DIRS[d][0], c[1] + DIRS[d][1]]; if (!prev.has(key(n))) { prev.set(key(n), [key(c), d]); q.push(n); } }
  }
  return null;
}

// répliques d'un indice : niveau 1 = où regarder ; 2 = la règle expliquée (+ rappel des fragments aux codes) ;
// 3 = un morceau de la réponse, dit à voix haute (jamais écrit). ctx = { pos, sabotage, frags (fragments vrais déjà dits) }
export function hintCues(run, step, level, ctx = {}) {
  if (step === 0) return [level === 1 ? 'hint1_armer' : 'hint2_armer'];
  if (level === 1) return [H1[step]];
  const v = run.v;
  if (level === 2) {
    switch (step) {
      case 1: return [`hint2_enc1_${v.enc1}`];
      case 2: return [`hint2_trappe_${v.trap}`];
      case 3: return [`hint2_sequence_${v.seq}`];
      case 4: return [`hint2_patch_${run.patch1.kind}`];
      case 10: return [`hint2_patch_${run.patch2.kind}`];
      case 5: case 9: return ['hint2_verrou'];
      case 6: case 11: {
        const rule = step === 6 ? `hint2_code1_${v.code1}` : `hint2_code2_${v.code2}`;
        return [rule, 'hint_rappel_fragments', ...run.frags.map(dig)];
      }
      case 7: return [`hint2_cles_${v.keys}`];
      case 8: return [`hint2_mot_${v.word}`];
      case 12: return ['hint2_transmit'];
    }
  }
  switch (step) {
    case 1: return ['hint3_molette1', let_(RING[run.enc1[0]])];
    case 8: return ['hint3_molette1', let_(RING[run.enc2[0]])];
    case 2: return ['hint3_trappe', `couleur_${run.trapColors[run.trap]}`];
    case 3: return ['hint3_premier_chiffre', dig(run.seqCode[0])];
    case 6: return ['hint3_premier_chiffre', dig(run.code1[0])];
    case 11: return ['hint3_premier_chiffre', dig(run.code2[0])];
    case 4: case 10: {
      const p = step === 4 ? run.patch1 : run.patch2;
      const ent = Object.entries(p.req).map(([c, s]) => [+c, s]).sort((a, b) => (a[1] == null ? -1 : 1) - (b[1] == null ? -1 : 1));
      const [c, s] = ent[0];
      return s == null ? ['hint3_debranche', cab(run, c)] : ['hint3_geste', cab(run, c), pr(s)];
    }
    case 5: case 9: {
      const maze = step === 5 ? run.maze1 : run.maze2, d = firstMove(maze, ctx.pos || maze.start);
      return d ? ['hint3_direction', DIR_CUE[d]] : ['hint2_verrou'];
    }
    case 7: return ['hint3_serrure', dig(run.keyOrder[0] + 1)];
    case 12: return ['hint2_transmit'];
  }
  return [H1[step]];
}
// toutes les répliques que le guide peut dire (pour vérifier le manifeste)
export const GUIDE_CUES = [
  ...new Set(Object.values(OBJECTIVE)), ...new Set(Object.values(H1)), 'hint1_armer', 'hint2_armer', 'hint2_verrou', 'hint2_transmit', 'hint_rappel_fragments',
  ...['ordre', 'envers', 'suivante', 'paires'].map((k) => `hint2_enc1_${k}`), ...['frequente', 'rare', 'moyenne', 'gauche'].map((k) => `hint2_trappe_${k}`),
  ...['ordre', 'envers', 'plus1'].map((k) => `hint2_sequence_${k}`), ...['route', 'echange', 'debranche', 'serie', 'double'].map((k) => `hint2_patch_${k}`),
  ...['ordre', 'envers', 'plus1'].map((k) => `hint2_code1_${k}`), ...['envers', 'rotation', 'decale'].map((k) => `hint2_code2_${k}`),
  'hint2_cles_legere', 'hint2_cles_lourde', ...['ordre', 'envers', 'suivante'].map((k) => `hint2_mot_${k}`),
  'hint3_molette1', 'hint3_trappe', 'hint3_premier_chiffre', 'hint3_geste', 'hint3_debranche', 'hint3_direction', 'hint3_serrure', ...Object.values(DIR_CUE),
];
