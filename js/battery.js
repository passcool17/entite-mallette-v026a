// battery.js : jauge de la vraie batterie de la mallette (logique pure + persistance, sans DOM).
// Batterie réelle : Mspalocell 12 V 5600 mAh Li-ion 3S (3 cellules en série) : 12,6 V pleine, ~9,0 V vide, 67,2 Wh.
// La tension affichée vient d'une courbe de décharge réaliste d'une cellule Li-ion (OCV, tension à vide) x 3.
//
// Modèle du simulateur (accéléré pour qu'on le voie, documenté dans le README) :
//  - partie en cours : -0,5 %/min (≈ -4 % sur une partie de 8 min) ; mallette ouverte hors partie : -0,1 %/min ;
//  - petites chutes sur les gros consommateurs : servo SG90 / trappe -0,3 %, sabotage de l'Entité -0,5 %, explosion -1 % ;
//  - sous 15 % : alerte batterie faible (icône rouge qui clignote + un bip discret, une fois) ; aucune pénalité de jeu ;
//  - niveau gardé dans localStorage (clé entite-batterie) : il continue de baisser d'une session à l'autre ;
//  - recharge : à l'ouverture, si le niveau est ≤ 5 % → rechargée à 100 % ; si c'est un nouveau jour → rechargée,
//    à un niveau plausible au hasard entre 62 et 100 % (première visite aussi).
export const PACK = { name: 'Mspalocell 12 V 5600 mAh Li-ion 3S', cells: 3, mAh: 5600, Wh: 67.2, vFull: 12.6, vEmpty: 9.0 };
export const LOW = 15, RECHARGE_AT = 5;
export const DRAIN = { play: 0.5, idle: 0.1, servo: 0.3, trap: 0.3, sabotage: 0.5, boom: 1 }; // % par minute ou par évènement
const KEY = 'entite-batterie';
// OCV d'une cellule Li-ion (NMC) : [% de charge, volts]
const OCV = [[0, 3.0], [5, 3.3], [10, 3.45], [15, 3.55], [20, 3.62], [30, 3.7], [40, 3.75], [50, 3.79], [60, 3.84], [70, 3.91], [80, 3.98], [90, 4.08], [100, 4.2]];
export function packVolts(pct) {
  const p = Math.max(0, Math.min(100, pct));
  for (let i = 1; i < OCV.length; i++) {
    const [p1, v1] = OCV[i], [p0, v0] = OCV[i - 1];
    if (p <= p1) return PACK.cells * (v0 + (v1 - v0) * (p - p0) / (p1 - p0));
  }
  return PACK.vFull;
}
export const levelOf = (pct) => (pct < LOW ? 'low' : pct < 40 ? 'mid' : 'ok');
const today = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* privé */ } } };

// rnd : générateur 0..1 (Math.random par défaut). force : niveau imposé (?debug=1&batt=N).
export function openBattery({ rnd = Math.random, force = null, now = new Date() } = {}) {
  const saved = store.get(), day = today(now);
  let pct, why;
  if (force != null && Number.isFinite(force)) { pct = Math.max(0, Math.min(100, force)); why = 'force'; }
  else if (!saved || typeof saved.pct !== 'number') { pct = 62 + rnd() * 38; why = 'neuve'; }
  else if (saved.pct <= RECHARGE_AT) { pct = 100; why = 'rechargee'; }
  else if (saved.day !== day) { pct = Math.max(saved.pct, 62 + rnd() * 38); why = 'nouveau-jour'; }
  else { pct = saved.pct; why = 'suite'; }
  const b = { pct, why, warned: false, lastSave: 0 };
  const save = () => store.set({ pct: +b.pct.toFixed(3), day });
  save();
  return {
    get pct() { return b.pct; }, get why() { return b.why; },
    get volts() { return packVolts(b.pct); }, get level() { return levelOf(b.pct); }, get low() { return b.pct < LOW; },
    // dt en secondes ; playing = partie en cours
    tick(dt, playing) { b.pct = Math.max(0, b.pct - (playing ? DRAIN.play : DRAIN.idle) * dt / 60); this.persist(); },
    dip(kind) { b.pct = Math.max(0, b.pct - (DRAIN[kind] ?? 0.2)); this.persist(true); },
    set(p) { b.pct = Math.max(0, Math.min(100, p)); b.warned = false; this.persist(true); },
    // vrai une seule fois, au premier passage sous 15 %
    takeWarning() { if (b.pct < LOW && !b.warned) { b.warned = true; return true; } return false; },
    persist(now = false) { const t = performance.now(); if (now || t - b.lastSave > 5000) { b.lastSave = t; save(); } },
  };
}
