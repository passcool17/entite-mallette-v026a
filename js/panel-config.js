// panel-config.js : dimensions réelles de la mallette et des pièces (simulateur ET futur panneau imprimé en 3D).
// Toutes les valeurs sont en millimètres. Fiche officielle Lykus HC-3010 (v0.2.3, 23 nov. 2026).
// Rien n'est percé dans les parois étanches : les flancs restent vides, tout est sur les panneaux intérieurs.

export const CASE = {
  model: 'Lykus HC-3010',
  exterior: { width: 335, height: 260, depth: 130 },
  interior: { width: 300, height: 200, depth: 120 },
  baseDepth: 83,                        // profondeur utile de la base (électronique sous le panneau)
  lidDepth: 32,                         // profondeur du couvercle (corrigé : n'est pas 17 mm)
  // Panneau de la base : zone utile 273 x 169, coupé en deux moitiés pour le lit 256 mm de la Bambu P1S
  panel: { width: 273, height: 169, halves: [{ width: 136.5, height: 169 }, { width: 136.5, height: 169 }] },
  servos: { available: 5, used: 3 },    // SG90 : 3 trappes, 2 en réserve
};

// Pièces que Pascal a déjà (zéro achat de plus). w x h = encombrement vu de face.
// v0.2.1 : TOUT est à l'intérieur de la valise ouverte. Coque (dessus, flancs) : aucun composant, aucun perçage.
// v0.2.2 : 5 câbles banane qui partent de la base et montent se brancher dans les douilles du couvercle ; KY-040 sans boutons + / −.
// v0.2.3 : vraie baie banane 5x5 (n'importe quel câble dans n'importe quelle prise, matrice GPIO), 5 couleurs Keadic
//          distinctes (rouge, noir, jaune, vert, bleu : une de chaque), KY-040 = lettres seulement, CYD 2 = n° de série + bouton tactile RÉÉCOUTER (labyrinthe aux étapes 5 et 9).
//          Toujours 0 pièce à l'extérieur de la valise.
export const PARTS = {
  // Couvercle intérieur (32 mm)
  cyd1:      { w: 86, h: 50, screen: { w: 57.6, h: 43.2 }, note: 'CYD 1 ESP32-2432S028 2,8 po ILI9341 240x320 : œil de l’Entité, au centre du couvercle' },
  speaker:   { d: 40, count: 2, power: '3 W', impedance: '8 Ω', note: 'deux haut-parleurs 3 W 8 Ω (SPK-L, SPK-R) de chaque côté de l’œil (DFPlayer SPK1/SPK2)' },
  ledBar:    { w: 220, h: 10, leds: 32, positions: 8, sticks: 4, stick: 'CANADUINO WS2812B 8 LED ~55×10 mm (5050)', note: 'quatre barrettes en chaîne DIN→DOUT, ~220 mm, allumées par groupes de 4' },
  pocket:    { w: 90, h: 60, depth: 6, note: 'pochette à fiche (note tactique), sous la barre LED' },
  jacks:     { count: 5, hole: 8, pitch: 18, note: 'prises femelles banane Keadic 4 mm (1..5) au bas du couvercle ; n\'importe quel câble dans n\'importe quelle prise' },
  cables:    { count: 5, length: 300, from: 'base.cablePorts', to: 'lid.jacks', colors: ['rouge', 'noir', 'jaune', 'vert', 'bleu'], hex: { rouge: '#e53935', noir: '#1b1d22', jaune: '#f5c518', vert: '#22c55e', bleu: '#2b7cff' }, note: 'câbles silicone souples Keadic, 5 couleurs distinctes (une de chaque, jamais deux bleus), fiche banane 4 mm mâle côté couvercle, ancrés à demeure sur la base ; assez longs pour aller dans n\'importe quelle prise ; débranché, le câble repose sur la base' },
  cablePort: { hole: 6, count: 5, note: 'passe-câble encastré (ancrage) en haut de la base, un par couleur' },
  patchbay:  { matrix: '5x5', detect: 'GPIO : chaque fiche de câble = sortie (pilotée à tour de rôle), chaque prise = entrée pull-up ; scan 5x5 toutes les 20 ms → quel câble est dans quelle prise (1 câble max par prise)', pins: { cables: 5, sockets: 5 }, note: 'routage couleur → prise aux étapes 4 et 10 ; aucun composant extérieur' },
  // Base (83 mm)
  tm1637:    { w: 42, h: 24, note: 'afficheur 4 chiffres 0,56 po' },
  oled:      { w: 27, h: 27, screen: { w: 22, h: 11 }, note: 'OLED 0,96 po I2C 128x64' },
  encoder:   { w: 26, h: 19, shaft: 6, count: 4, detents: 20, modes: { cryptex: 'ABCDEFGHIJLMNOPRSTUV' }, note: 'KY-040 encodeur rotatif 20 crans/tour + poussoir ; aucun bouton + / − : on tourne le bouton ; LETTRES SEULEMENT (anneau de 20 lettres, sans K Q W X Y Z), affichées sur l’OLED ; les chiffres se tapent au clavier 4x4' },
  cyd2:      { w: 86, h: 50, screen: { w: 57.6, h: 43.2 }, touch: true, note: 'CYD 2 ESP32-2432S028 2,8 po, écran tactile : affiche le n° de série (LCLC-LCLC, par graine) et le bouton RÉÉCOUTER (≥ 44 px) ; aux étapes 5 et 9 le labyrinthe prend l’écran, n° + bouton restent visibles en petit dans un coin ; jauge batterie en haut à droite. Plus de moniteur ECG. Pas de bouton Réécouter physique supplémentaire.' },
  joystick:  { w: 35, h: 35, note: 'joystick compact 2 axes + poussoir' },
  keySwitch: { hole: 12, w: 20.6, h: 26, count: 3, note: 'serrures Gebildet 12 mm métal, clés I, II, III, points rouge/vert' },
  keypad:    { w: 69, h: 77, note: 'clavier membrane 4x4 (clavier seul : pas de RFID, pas d’empreinte)' },
  trap:      { w: 32.3, h: 27, count: 3, note: 'trappes motorisées servo SG90 (A, B, C)' },
  guardedToggle: { w: 22, h: 46, count: 2, note: 'interrupteurs à levier sous capot de sécurité basculant (style DaierTek) : capot bleu ARM, capot rouge TRANSMIT ; DEL d’état' },
};

// Implantation (panneaux 273 x 169). Le joint des deux moitiés de la base est à x = 136,5 ; rien de fragile ne le chevauche.
// Pas de lecteur RFID (retiré le 23 nov. 2026 : peu d'intérêt, câblage compliqué). Pas de bouton TRANSMIT rond : remplacé par le levier à capot rouge.
export const LAYOUT = {
  lid: {
    width: 273, height: 169, depth: 32,
    spkL:   { x: 12,  y: 22,  w: 44, h: 44 },
    cyd1:   { x: 93.5, y: 18, w: 86, h: 50 },   // centré
    spkR:   { x: 217, y: 22,  w: 44, h: 44 },
    ledBar: { x: 26, y: 78,  w: 220, h: 10 },
    pocket: { x: 12,  y: 96,  w: 90, h: 44 },
    jacks:  { x: 110, y: 140, w: 90, h: 22 },   // 5 douilles femelles, pas de 18 mm, au bas du couvercle (côté charnière)
  },
  base: {
    width: 273, height: 169, seam: 136.5,
    cablePorts: { x: 110, y: 2, w: 90, h: 8 },     // 5 ancrages de câble, alignés sous les douilles du couvercle (côté charnière)
    tm1637:    { x: 6,   y: 12,  w: 42, h: 24 },
    oled:      { x: 54,  y: 11,  w: 27, h: 27 },
    encoders:  { x: 6,   y: 42,  w: 124, h: 24 },   // 4 x KY-040, pas de 31 mm, sans boutons + / −
    toggleArm: { x: 20,  y: 106, w: 30, h: 54 },    // capot bleu : armement
    toggleTx:  { x: 60,  y: 106, w: 30, h: 54 },    // capot rouge : TRANSMIT
    traps:     { x: 6,   y: 72,  w: 103, h: 27 },   // A, B, C
    cyd2:      { x: 143, y: 12,  w: 86, h: 50 },
    joystick:  { x: 234, y: 18,  w: 35, h: 35 },
    keySwitches: { x: 236, y: 68, w: 26, h: 90 },   // I, II, III
    keypad:    { x: 150, y: 68,  w: 69, h: 77 },
  },
  shell: { top: [], sides: [] },                    // coque : rien
};
