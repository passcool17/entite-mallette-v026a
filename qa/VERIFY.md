# Vérification — La mallette de l'Entité

Liste exacte pour Testeur QA · jeux & apps, et pour un contrôle local avant chaque push.
Dépôt : `passcool17/entite-mallette`. En ligne : https://passcool17.github.io/entite-mallette/

## Règle du test léger (Testeur QA)

Retester **seulement** ce qui a changé et ce qui n’a jamais été testé.

- 2 ou 3 captures, pas plus.
- Mobile Samsung Galaxy S20 FE, **412×915** (portrait).
- **915×412** (paysage) seulement si la mise en page a changé.
- Pas de Lighthouse. Un seul retest par correction.
- Ne pas refaire les contrôles déjà réussis (mise en page, batterie, numéros 1–8 de la barre, fichiers des voix) sauf si le changement les touche.

Le test automatique de partie complète (ci-dessous) tourne **avant chaque push** et dans GitHub Actions. Il est bon marché du point de vue de Testeur QA : ne pas le répéter à la main, sauf pour confirmer un échec signalé.

## Commandes

À la racine du dépôt (`/workspace/apps/entite-mallette`).

```
npm ci
npx playwright install --with-deps chromium   # une fois, ou dans le CI
```

Jeu couvrant minimal (toutes les variantes, les deux paliers, ~5 graines) — le serveur doit déjà écouter, ou en lancer un :

```
python3 -m http.server 8794 --bind 127.0.0.1
node tests/fullrun.mjs
# ou : node tests/fullrun.mjs http://127.0.0.1:8794/
```

Contrôle « avant chaque push » / CI : **au moins 20 graines moyen et 20 graines difficile** (liste fixe + quelques graines aléatoires journalisées). Le script sert le dépôt tout seul s’il n’y a pas d’URL :

```
npm run qa
# équivalent : node tests/fullrun.mjs --qa
```

Contre le site en ligne (après déploiement) :

```
npm run qa -- --base-url https://passcool17.github.io/entite-mallette/
# ou : node tests/fullrun.mjs --qa --base-url https://passcool17.github.io/entite-mallette/
```

Options utiles :

```
node tests/fullrun.mjs --base-url URL
node tests/fullrun.mjs --seeds 0,26,28          # débogage : pas d’exigence de couverture complète
node tests/fullrun.mjs --qa --no-stub-audio     # mp3 réels (plus lent)
node tests/fullrun.mjs --seeds 3,42,77,501,1234 # ad hoc : couverture incomplète = WARN
node tests/fullrun.mjs --seeds 3,42,77 --require-coverage
```

`?debug=1` ne sert qu’à **lire** les réponses. La saisie se fait par de vrais taps, comme un joueur. Aucun code ni aucune réponse ne doit apparaître à l’écran sans `?debug=1`.

En `--qa` et dans le CI, le son est court-circuité (drapeaux `--mute-audio`, tampons audio courts). Le test s’appuie sur `voiceLog`, pas sur une oreille. La qualité des voix se juge à l’écoute, pas ici.

Succès = dernière ligne `FULLRUN PASS` et code de sortie 0. Tout échec = `FULLRUN FAIL` et code ≠ 0.

## Couverture des variantes (union du run)

La couverture se calcule sur **l’ensemble des parties du run**, pas graine par graine. 29 variantes au total (tous les bassins moyen + difficile).

- `npm run qa` / CI (`--qa`, ≥ 20 graines par palier) : **29/29 exigé**. La liste fixe de graines est choisie pour garantir ces 29 variantes. Au départ, le journal indique **quelle graine couvre chaque variante**. Si la liste fixe devenait incomplète, le test échoue tout de suite (coche rouge).
- Run ad hoc (`--seeds 3,42,77,501,1234`, ou une poignée de graines en argument) : si des parties réussissent mais que l’union n’atteint pas 29/29, c’est un **WARN**, pas un `FULLRUN FAIL`. Exemple vécu en v0.2.5i : ces 5 graines donnaient 23/29 (il manquait `enc1:paires`, `trap:frequente`, `patch1:debranche`, `word:ordre`, `patch2:echange`, `code2:rotation`) alors que chaque partie était bonne. Pour exiger 29/29 sur un run court : `--require-coverage`.

## Lire le CI

- Dépôt GitHub → onglet **Actions** → flux **QA** (fichier `.github/workflows/qa.yml`).
- Déclenché à chaque `push` et à chaque `pull_request`.
- Tâche `full-run 0–12` : Node 20, `npm ci`, Chromium Playwright, `npm run qa`.
- Coche verte = `FULLRUN PASS`. Coche rouge = au moins un échec (le flux s’arrête avec un code ≠ 0).
- Le journal complet est joint en artefact `fullrun-log` (`qa-out/fullrun.log`), y compris si la tâche échoue.
- En local : `gh run list --workflow qa.yml` puis `gh run view <id> --log`, ou ouvrir l’URL `https://github.com/passcool17/entite-mallette/actions/runs/<id>`.

## Interdits

- Ne jamais indexer ni pousser `voix/raw/` ni `voix/_test/`.
- Pousser normalement, compte `passcool17`. Pas de force-push, pas de réécriture d’historique, ne jamais supprimer le dépôt.
- Ne pas toucher au Portail PassCool (`/workspace/apps/passcool17.github.io`, dépôt `29124d1`) ni aux archives `entite-mallette-v015` (`30d0146`) et `entite-mallette-v016` (`46d483a`), sans un go explicite de Pascal.
- Le cache du service worker doit continuer d’épargner `entite-mallette-v015-*` et `entite-mallette-v016-*`.
- `package.json` / `package-lock.json` sont des outils de test. Ils ne doivent pas entrer dans le cache du jeu ni changer le comportement du site servi.

## Ce que chaque étape doit faire (0 à 12)

À la réussite de **n’importe quelle** étape : le jeu passe **tout de suite** à la suivante ; la voix coupe la réplique en cours (et les fragments / indices encore en file), dit la réussite, puis donne l’objectif suivant. Pas d’état coincé, pas de voix de l’étape d’avant. Le test automatique vérifie l’index d’étape et le changement d’id de voix (~1,5 s).

| Étape | Module | Attendu |
|------:|--------|---------|
| 0 | Armement | Ouvrir le capot (`#coverArm`) puis basculer le levier ARM (`#leverArm`). La partie passe à l’étape 1, voix `depart`. |
| 1 | Encodeurs (KY-040) | Régler les 4 anneaux sur les lettres dictées (A–V seulement, jamais de chiffres ici) et valider au centre de l’encodeur. |
| 2 | Trappes A / B / C | Ouvrir la bonne trappe. |
| 3 | Barre `#bar` + clavier 4×4 | 32 LED groupées en 8 paquets de 4 (chiffres 1–8 centrés au-dessus de chaque groupe). Observer la séquence : la position *p* allume **exactement** les 4 LED du groupe (`4p−3` à `4p`), aucune autre. Saisir le code au clavier (chiffres seulement). **Réécouter** est un bouton tactile **sur le CYD 2** (écran du bas, libellé RÉÉCOUTER, cible ≥ 44 px *à l’écran après zoom* (`getBoundingClientRect`)), à côté du n° de série — plus sur le couvercle. Il rejoue la **même** séquence de groupes sur `#bar`, après la voix, comme la première fois. Un indice 1 ou 2 qui redit la séquence la rejoue aussi. Un faux code est refusé ; le bon fait avancer. Double appui : pas d’animations en double, pas de DEL coincées. Détail matériel : [`HARDWARE.md`](../HARDWARE.md). |
| 4 | Baie banane (1re couche) | Vraie baie 5×5. Brancher selon la consigne dictée (pas de réponse écrite à l’écran). |
| 5 | Labyrinthe, CYD 2 + joystick | Rejoindre le but. Le labyrinthe prend l’écran ; le n° de série reste visible en petit dans un coin (≥ 11 px en paysage), avec RÉÉCOUTER (≥ 44 px réels), sans chevaucher ni la jauge batterie ni la grille du labyrinthe (412×915 et 915×412). Le bouton reste utilisable. Pas de plaque rivetée sur le couvercle, pas d’ECG. |
| 6 | Code 1, clavier 4×4 | Saisir le code. Faux code refusé ; le bon avance tout de suite (voix `taunt_fini` / suite). |
| 7 | Clés I, II, III | Les presser dans l’ordre dicté. |
| 8 | Encodeurs, mot (cryptex) | Mot de 4 lettres sur les anneaux (A–V), validation au centre. |
| 9 | Labyrinthe 2, CYD 2 | Rejoindre le but. Le joystick peut être inversé (sabotage). Comme à l’étape 5 : n° + RÉÉCOUTER visibles, sans chevaucher la grille. |
| 10 | Baie banane (2e couche) | Même baie 5×5, deuxième consigne. Le bandeau reprend la consigne dictée. |
| 11 | Code 2, clavier 4×4 | Saisir le code. Faux code refusé ; le bon avance. |
| 12 | Levier TRANSMIT (rouge) | Basculer le levier rouge. Victoire : « Mallette désamorcée », voix `outcome_victoire`. |

Hors labyrinthe, le CYD 2 affiche le n° de série (grand, format `LCLC-LCLC`) et RÉÉCOUTER, avec la jauge batterie en haut à droite (sans chevauchement). Plus de plaque rivetée, plus d’ECG.

Règles permanentes : tout reste dans la mallette ; palier tiré au hasard entre moyen et difficile ; le joueur ne doit jamais rester coincé sans piste ; pas de codes à l’écran sans `?debug=1`.

## Captures

Dossier typique : `/workspace/qa/entite-mallette/` (rapports) et `/workspace/qa/entite-mallette/v0.2.6-live/` (captures). 2 ou 3 images, 412×915, plus 915×412 seulement si la mise en page a changé. Pour la v0.2.6a : `maze-412x915.png` et `maze-915x412.png` (étape 5, n° et RÉÉCOUTER hors de la grille).
