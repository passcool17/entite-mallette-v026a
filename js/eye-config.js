// eye-config.js : TOUS les paramètres de l'œil de l'Entité, au même endroit.
// Unité de longueur = R (rayon de l'iris). Les angles sont en radians, les vitesses en rad/s.
// Le même fichier sert au rendu web et au futur portage CYD (voir PORTAGE-CYD.md).

export const EYE = {
  seed: 1337,                 // graine du générateur (mulberry32) : même œil partout
  radiusOfMin: 0.24,          // R = min(largeur * 0.24, hauteur * radiusOfHeight)
  radiusOfHeight: 0.36,
  center: { x: 0.5, y: 0.5 }, // centre de l'œil dans la scène (fraction)

  palette: {
    bgCenter: '#0b2438', bgEdge: '#02070d',
    core: [235, 252, 255],    // cœur blanc-cyan des points
    glow: [50, 170, 255],     // halo bleu des points
    deep: [16, 74, 128],      // bleu profond
    iris: [58, 178, 232],     // fond de l'iris (mesuré sur la référence)
    irisDark: [10, 46, 82],
    petal: [205, 246, 255],   // contours lumineux des pétales
    streak: [190, 235, 255],  // stries autour de la pupille
    ember: [255, 70, 60],     // braises (colère / explosion)
  },

  pupil: { radius: 0.07, min: 0.05, max: 0.17, collarette: 0.34, streaks: 220, swirl: 0.35 },

  iris: {
    petals: 52,               // pétales rayonnants (contours clairs)
    fibers: 520,              // fibres fines
    wisps: 90,                // boucles lumineuses
    limbus: 1.03,             // anneau fin autour de l'iris
    limbusGap: 1.07,
    spin: 0.025,              // rotation lente de l'iris
    bloom: 0.32,              // halo flou (copie réduite de l'iris)
  },

  rings: {
    inner: 1.13,              // premier rang de points
    outer: 2.3,               // dernier rang
    rows: 16,                 // nombre de rangs
    groupSize: 3,             // rangs groupés (même vitesse)
    spacing: 0.078,           // distance entre deux points d'un rang (en R)
    coverage: [0.5, 0.95],   // part d'arc couverte par rang (min, max) : rangs troués
    dotSize: [0.09, 0.19],  // taille d'un point (diamètre du sprite, en R)
    dashRatio: 0.16,          // part de tirets tangentiels
    speed: [0.015, 0.075],    // vitesse de rotation par groupe (signe alterné)
    falloff: 0.42,            // baisse de luminosité vers l'extérieur
    light: { angle: Math.PI * 0.85, amount: 0.35 }, // éclairage fixe : plus clair à gauche-bas
    outerSparse: { r: 2.5, count: 90, size: 0.05 }, // rang extérieur clairsemé
  },

  halo: { radius: 2.8, alpha: 0.6 },

  blocks: {                   // blocs de données à la dérive
    count: 110,
    staticCount: 650,         // mur de données fixe, très sombre, cuit dans le fond
    size: [0.04, 0.34],       // largeur (en R)
    aspect: [0.18, 0.6],      // hauteur / largeur
    drift: { x: -0.035, y: -0.02 }, // dérive (R/s), vers le haut-gauche
    rightBias: 0.62,          // plus de blocs à droite, comme sur la référence
    blurLevels: 3,
  },

  heartbeat: 2.6,             // période d'une onde lumineuse (s)
  wave: { speed: 1.5, width: 0.22, amount: 0.65 },
  voice: { pupil: 0.035, glow: 0.6, scale: 0.03 }, // réaction à la voix (niveau 0..1)
  look: { max: 0.07, ease: 4 },                     // la pupille suit le regard

  render: { maxDpr: 1.5, vignette: 0.6 },

  // Victoire : l'Entité est piégée dans le lecteur optique 5D, l'œil se replie en disque lumineux.
  trap: { duration: 2.6, shrink: 0.42, discRadius: 1.15, discSpin: 0.9, grooves: 46 },
};

// Humeurs : multiplicateurs appliqués aux paramètres de base, interpolés en douceur.
export const MOODS = {
  idle:     { spin: 1,    bright: 0.9,  pupil: 1,    pulse: 1,   beat: 1,   jitter: 0,     ember: 0,    blocks: 1   },
  watching: { spin: 1.6,  bright: 1.05, pupil: 0.85, pulse: 1.2, beat: 0.8, jitter: 0,     ember: 0,    blocks: 1.4 },
  angry:    { spin: 4,    bright: 1.25, pupil: 0.62, pulse: 1.8, beat: 0.4, jitter: 0.012, ember: 0.22, blocks: 3   },
  defused:  { spin: 0.6,  bright: 0.8,  pupil: 1.9,  pulse: 0.3, beat: 2.5, jitter: 0,     ember: 0,    blocks: 0.3 }, // piégée : s'effondre en disque
  boom:     { spin: 0,    bright: 1,    pupil: 0.4,  pulse: 0,   beat: 9,   jitter: 0.03,  ember: 1,    blocks: 0   },
};

// Aperçu CYD 2,8 po (ILI9341 240x320, LovyanGFX) : rendu natif, cadence plafonnée, moins de particules.
export const CYD = {
  width: 240, height: 320, fps: 20,
  overrides: {
    radiusOfMin: 0.26, radiusOfHeight: 0.3,
    center: { x: 0.5, y: 0.42 },
    rings: { rows: 7, spacing: 0.11, outerSparse: { r: 2.5, count: 36, size: 0.07 }, dotSize: [0.06, 0.12] },
    iris: { petals: 22, fibers: 160, wisps: 30 },
    pupil: { streaks: 70 },
    blocks: { count: 18, staticCount: 90 },
    render: { maxDpr: 1, vignette: 0.6 },
  },
};

export function deepMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k in over) {
    const v = over[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] ? deepMerge(base[k], v) : v;
  }
  return out;
}
