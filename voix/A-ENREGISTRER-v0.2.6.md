# Voix à réenregistrer — v0.2.6

Le n° de série n’est plus sur une plaque rivetée dans le couvercle : il s’affiche sur **l’écran du bas** (CYD 2), avec le bouton tactile **RÉÉCOUTER**. Les fichiers mp3 actuels ne sont **pas** régénérés ici ; cette liste est pour Voix.

Les textes à l’écran (bandeau d’indice, note de la pochette) disent déjà « l’écran du bas ».

## À réenregistrer (la réplique parle encore de la plaque ou du couvercle)

| Id | Texte actuel | Texte proposé |
|----|--------------|---------------|
| `hint1_plaque` | Indice : regarde la plaque du numéro de série, dans le couvercle. Ce sont ses lettres qu'il faut. | Indice : regarde le numéro de série, sur l'écran du bas. Ce sont ses lettres qu'il faut. |
| `hint2_enc1_ordre` | Les quatre lettres de la plaque, de gauche à droite : la première sur la molette un, et ainsi de suite. | Les quatre lettres du numéro de série, de gauche à droite : la première sur la molette un, et ainsi de suite. |
| `hint2_enc1_envers` | Les lettres de la plaque en partant de la droite : la dernière lettre va sur la molette un. | Les lettres du numéro de série en partant de la droite : la dernière lettre va sur la molette un. |
| `hint2_enc1_suivante` | Pour chaque lettre de la plaque, avance d'un cran sur l'anneau : après A vient B. L'anneau a I et O, mais pas K. | Pour chaque lettre du numéro de série, avance d'un cran sur l'anneau : après A vient B. L'anneau a I et O, mais pas K. |
| `hint2_enc1_paires` | Lettres de la plaque : la deuxième sur la molette un, la première sur la deux, la quatrième sur la trois, la troisième sur la quatre. | Lettres du numéro de série : la deuxième sur la molette un, la première sur la deux, la quatrième sur la trois, la troisième sur la quatre. |
| `hint2_patch_serie` | Lis les lettres de la plaque de série de gauche à droite : la première lettre, c'est la prise un, la deuxième, la prise deux, et ainsi de suite. | Lis les lettres du numéro de série, sur l'écran du bas, de gauche à droite : la première lettre, c'est la prise un, la deuxième, la prise deux, et ainsi de suite. |
| `hint2_code2_decale` | Ajoute à chaque fragment le dernier chiffre de la plaque. Si ça dépasse neuf, garde seulement le chiffre des unités. | Ajoute à chaque fragment le dernier chiffre du numéro de série. Si ça dépasse neuf, garde seulement le chiffre des unités. |

L’id `hint1_plaque` peut rester (fichier `voix/hint1_plaque.mp3`) ; seul le texte change.

## Répliques qui citent Réécouter, sans dire où est le bouton (facultatif)

Le geste reste juste. On peut préciser « sur l'écran du bas » si on réenregistre déjà.

| Id | Texte actuel | Texte proposé (facultatif) |
|----|--------------|----------------------------|
| `hint1_sequence` | Indice : appuie sur Réécouter, puis regarde la barre. Chaque lumière a une position, de un à huit, depuis la gauche. | Indice : appuie sur Réécouter, sur l'écran du bas, puis regarde la barre. Chaque lumière a une position, de un à huit, depuis la gauche. |
| `hint1_mot` | Indice : appuie sur Réécouter pour entendre le mot épelé. L'écran OLED montre la lettre de chaque molette. | Indice : appuie sur Réécouter, sur l'écran du bas, pour entendre le mot épelé. L'écran OLED montre la lettre de chaque molette. |

## Inchangées (parlent du numéro de série, sans plaque ni lieu)

`clue_enc1_ordre`, `clue_enc1_envers`, `clue_enc1_suivante`, `clue_enc1_paires`, `patch_rang`, `clue_code2_decale`, `hint1_cles`.

## Hors sujet pour ce changement

`clue_cles_legere` et `clue_cles_lourde` disent « Trois serrures dans le couvercle ». Ça désigne les serrures, pas la plaque. Les serrures sont sur la base ; on ne les a pas réécrites ici.

Il n’y a plus de réplique `caches` (« As-tu lu mon numéro de série ? ») dans `voix/manifest.json`. Aucune réplique ne parle d’ECG, de rythme cardiaque ni d’oscilloscope.
