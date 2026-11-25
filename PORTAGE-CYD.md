# Portage de l'œil vers le CYD 2,8 po (ILI9341 240x320, LovyanGFX)

Tous les paramètres sont dans `js/eye-config.js` : `EYE` (base), `MOODS` (humeurs), `CYD` (surcharges 240x320).
L'aperçu `?cyd=1` rend exactement la version CYD : 240x320 natif, 20 i/s maximum, 572 points, 18 blocs.

## Principe : tout est sprite

Le rendu web ne fait déjà que des `drawImage` de sprites pré-calculés au redimensionnement. Sur l'ESP32 :

| Web (`js/eye.js`) | LovyanGFX |
|---|---|
| `bakeBackground()` fond + mur de données fixe | `LGFX_Sprite bg(240x320, 16 bits)` dessiné une fois, ou image RGB565 en flash (150 Ko) |
| `glowSprite()` point lumineux (cœur blanc-cyan, halo bleu) | 3 à 4 petits sprites 8x8 à 16x16 en RGB565 + couleur transparente, `pushSprite(&canvas, x, y, TRANSP)` |
| tirets tangentiels (`dashRatio`) | sprite 16x6 pré-tourné en 8 angles (table), choisir l'angle le plus proche |
| `bakeIris()` iris (pétales, fibres, limbe) | sprite 140x140 pré-rendu ; rotation lente avec `pushRotateZoom()` à 1 image sur 2 |
| `bakeCollarette()` + pupille | sprite 70x70 ; la dilatation = `pushRotateZoom(zoom)` ; pupille = `fillCircle` noir |
| halo, bloom | dégradé radial pré-rendu 64x64 agrandi (`pushRotateZoom` zoom 3-4) ou omis si trop lent |
| composition additive (`lighter`) | pas d'addition matérielle : pré-mélanger les couleurs claires dans les sprites ; ordre fond > blocs > points > iris |
| blocs de données | `fillRect` de couleurs bleues fixes, 18 blocs |

## Paramètres → firmware

- `seed` + `mulberry32` : même graine, mêmes positions de points. Porter `rng()` en C (10 lignes) ou exporter la table des points
  (angle, rayon, taille, luminosité, rang) en `const` dans un `.h`.
- `rings.rows`, `rings.spacing`, `rings.coverage`, `rings.speed` : génèrent la table des points. 7 rangs pour le CYD.
- `rowSpeed[i]` : un angle par rang ; chaque image, `angle += vitesse * dt`. Calcul avec une table de sinus 1024 entrées.
- `wave` + `heartbeat` : luminosité par rang (`rowBoost`), un `uint8_t` par rang : choisir parmi 4 sprites de luminosité.
- `MOODS` : mêmes multiplicateurs (`spin`, `bright`, `pupil`, `pulse`, `beat`, `jitter`, `ember`), interpolés à chaque image.
  `ember` = part de points dessinés avec le sprite rouge. `defused` = repli en disque (`trap`), `boom` = poussée radiale.
- `voice` : niveau 0..1 d'un I2S/ADC (enveloppe RMS) remplace l'`AnalyserNode`.
- `look` : décalage de la pupille et de l'iris, ±7 % de R.

## Budget

- Mémoire : un sprite plein écran 240x320x16 bits = 150 Ko. Sur ESP32 sans PSRAM, utiliser deux demi-écrans (240x160)
  poussés en DMA (`startWrite()` + `pushSprite` double tampon), ou réduire la zone de l'œil à 240x240 (113 Ko).
- Cadence : viser 20 i/s (50 ms). 572 `pushSprite` de 12x12 environ 15-20 ms, iris tourné 10-15 ms, transfert SPI 40 MHz
  d'un écran entier environ 30 ms : c'est le transfert qui limite. Ne redessiner que la zone de l'œil si besoin.
- Si la cadence ne suit pas : passer `rings.rows` à 6, `outerSparse.count` à 20, tourner l'iris 1 image sur 3.
