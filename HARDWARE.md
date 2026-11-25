# Matériel — barre lumineuse

Quatre barrettes **CANADUINO WS2812B** de 8 LED chacune (boîtiers 5050, environ 55 × 10 mm), mises en chaîne, forment une barre d’environ **220 mm** et de **32 LED**.

Le jeu, lui, a toujours **8 positions**. Chaque position allume un **groupe de 4** LED voisines.

## Chaîne

```
5 V  ──► 5 V des quatre barrettes (idéalement aux deux bouts, voir Alimentation)
GND  ──► GND des quatre barrettes
DIN  ──► DIN de la 1re barrette  (positions 1–2, LED  1–8)
              DOUT ──► DIN de la 2e  (positions 3–4, LED  9–16)
                            DOUT ──► DIN de la 3e  (positions 5–6, LED 17–24)
                                          DOUT ──► DIN de la 4e  (positions 7–8, LED 25–32)
```

Données : DIN vers DOUT, dans cet ordre.

## Correspondance position → LED

| Position (chiffre au-dessus) | Barrettes     | LED          |
|-----------------------------:|---------------|-------------:|
| 1                            | 1re           | 1 à 4        |
| 2                            | 1re           | 5 à 8        |
| 3                            | 2e            | 9 à 12       |
| 4                            | 2e            | 13 à 16      |
| 5                            | 3e            | 17 à 20      |
| 6                            | 3e            | 21 à 24      |
| 7                            | 4e            | 25 à 28      |
| 8                            | 4e            | 29 à 32      |

Position *p* = LED `4p−3` à `4p`. Une position allumée allume **exactement** ces quatre LED, de la même couleur ; aucune autre ne s’allume pour cette position. Les séquences, Réécouter, les indices, la barre de progression et les leurres suivent la même règle.

Dans l’interface, les 32 LED sont groupées visuellement en 8 paquets de 4, avec un espace entre les groupes. Les chiffres 1 à 8 sont centrés au-dessus de chaque groupe.

## Alimentation (32 WS2812B)

Au blanc plein, une LED 5050 peut tirer jusqu’à environ **60 mA**. Pour 32 LED, le pire cas est d’environ **1,9 A**. Prévoir :

- une alimentation **5 V d’au moins 2 A** (mieux : 3 A, pour la marge) ;
- une résistance de **300 à 500 Ω** en série sur la ligne de données (DIN) ;
- un condensateur de **1000 µF** aux bornes 5 V / GND, près du début de la chaîne ;
- une **limite de luminosité** dans le micrologiciel (ne pas rester au blanc plein) ;
- si la tension baisse en bout de chaîne, **réinjecter le 5 V et la masse aux deux extrémités** (et, au besoin, au milieu).

Ne pas alimenter les 32 LED uniquement par le fil de données ou par un seul bout de la chaîne.


## CYD 2 (écran du bas)

Le second écran (ESP32-2432S028, 2,8 po, tactile) affiche le **numéro de série** de la partie (format `LCLC-LCLC`, ex. `F9R0-T8B2`, tiré de la graine) et le bouton tactile **RÉÉCOUTER** (cible ≥ 44 px). Il n’y a plus de plaque de série rivetée sur le couvercle, ni de bouton Réécouter physique à côté de l’œil : tout passe par cet écran.

- Hors labyrinthe : le n° est grand, en caractères monoespacés, avec la mention « N° SÉRIE ». RÉÉCOUTER est à côté (ou juste en dessous si l’écran est étroit).
- Étapes 5 et 9 : le labyrinthe prend l’écran ; le n° reste visible en petit dans un coin, avec RÉÉCOUTER (toujours ≥ 44 px). Après le labyrinthe, la vue grande revient.
- La jauge batterie reste en haut à droite et ne doit chevaucher ni le n° ni le bouton.
- Le bouton déclenche la même réécoute qu’avant, y compris la séquence lumineuse de l’étape 3 (groupes de 4 LED).
