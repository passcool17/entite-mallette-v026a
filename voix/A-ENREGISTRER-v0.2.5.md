# Répliques à enregistrer — v0.2.5

**État (24 nov. 2026) : les 170 répliques ci-dessous sont enregistrées et branchées** (`mp3Ready: true`, `source: piper`,
fichiers `voix/<id>.mp3`). `intro` et `depart` restent ElevenLabs. Plus aucune réplique du manifeste n’est en synthèse
par défaut ; la synthèse ne sert plus que de secours (fichier manquant ou en échec). Le tutoriel et la jauge batterie
n’ont jamais eu de réplique parlée.

Pour le bot Voix. Ton : froid, grave, lent, sans émotion, légèrement métallique. L’Entité tutoie le joueur.
Elle parle comme une machine qui a déjà calculé la suite. Pas de nom de film, d’acteur ni de personnage.

Fichier : `voix/<id>.mp3` (mono, 44,1 kHz, environ −16 LUFS, silence de 100 ms au début et à la fin).
Le texte ci-dessous est **exact** : le recopier mot pour mot. Ces fichiers sont en place (`mp3Ready: true`, `source: piper`). L’app joue le mp3 par id et se rabat sur la synthèse du navigateur si le fichier manque ou échoue.

Déjà enregistrées (ElevenLabs, ne pas refaire) : **2** — `intro`, `depart`.

Liste de référence (170/170 branchées). Réparties par catégorie.

## objective (11)

| id | Texte |
|---|---|
| `obj_armer` | Lève le capot bleu, puis bascule le levier. |
| `obj_molettes_code` | Molettes : forme quatre lettres, puis clique. |
| `obj_trappe` | Ouvre la bonne trappe. |
| `obj_sequence` | Observe la barre, puis tape au clavier. |
| `obj_cables` | Branche les câbles dans les bonnes prises. |
| `obj_verrou` | Joystick : guide le point au cercle vert. |
| `obj_code` | Tape le code sur le clavier. |
| `obj_cles` | Tourne les trois serrures dans le bon ordre. |
| `obj_mot` | Tourne les molettes pour former le mot. |
| `obj_cables2` | Rebranche les câbles : nouvelle consigne. |
| `obj_transmit` | Lève le capot rouge, puis bascule le levier. |

## hint (52)

| id | Texte |
|---|---|
| `hint1_armer` | Indice : le levier bleu, en bas à gauche. Touche son capot pour le lever, puis touche le levier. |
| `hint2_armer` | Premier geste : lever le capot bleu. Deuxième geste : basculer le levier dessous. |
| `hint1_plaque` | Indice : regarde la plaque du numéro de série, dans le couvercle. Ce sont ses lettres qu'il faut. |
| `hint1_barre` | Indice : compte les couleurs sur la barre lumineuse, puis compare avec le liseré de chaque trappe. |
| `hint1_sequence` | Indice : appuie sur Réécouter, puis regarde la barre. Chaque lumière a une position, de un à huit, depuis la gauche. |
| `hint1_cables` | Indice : chaque câble a une couleur. Les prises sont numérotées de un à cinq, de gauche à droite. Écoute bien la couleur et la prise. |
| `hint1_verrou` | Indice : le carré blanc, c'est toi. Les traits sont des murs. Si l'écran devient rouge, les commandes sont inversées. |
| `hint1_code` | Indice : les fragments de code sont les chiffres que je t'ai dictés après les étapes. Quand mon œil est rouge, le fragment est faux. |
| `hint1_cles` | Indice : la serrure un pèse le premier chiffre du numéro de série, la deux le deuxième, la trois le troisième. |
| `hint1_mot` | Indice : appuie sur Réécouter pour entendre le mot épelé. L'écran OLED montre la lettre de chaque molette. |
| `hint1_transmit` | Indice : le levier rouge, en bas à droite. Touche son capot pour le lever, puis touche le levier. |
| `hint2_verrou` | Le chemin existe toujours. Essaie d'abord vers la droite et vers le haut. Si l'écran est rouge, pousse dans le sens opposé. |
| `hint2_transmit` | Premier geste : lever le capot rouge. Deuxième geste : basculer le levier dessous. |
| `hint_rappel_fragments` | Rappel des vrais fragments, dans l'ordre : |
| `hint2_enc1_ordre` | Les quatre lettres de la plaque, de gauche à droite : la première sur la molette un, et ainsi de suite. |
| `hint2_enc1_envers` | Les lettres de la plaque en partant de la droite : la dernière lettre va sur la molette un. |
| `hint2_enc1_suivante` | Pour chaque lettre de la plaque, avance d'un cran sur l'anneau : après A vient B. L'anneau a I et O, mais pas K. |
| `hint2_enc1_paires` | Lettres de la plaque : la deuxième sur la molette un, la première sur la deux, la quatrième sur la trois, la troisième sur la quatre. |
| `hint2_trappe_frequente` | La couleur qui revient le plus souvent sur les huit lumières. |
| `hint2_trappe_rare` | La couleur qui n'apparaît qu'une seule fois sur la barre. |
| `hint2_trappe_moyenne` | Trois couleurs sur la barre : ni celle qui revient le plus, ni celle qui n'apparaît qu'une fois. |
| `hint2_trappe_gauche` | Regarde seulement la toute première lumière, à gauche de la barre. |
| `hint2_sequence_ordre` | Tape la position de chaque lumière, dans l'ordre où elles s'allument. Un, c'est tout à gauche. |
| `hint2_sequence_envers` | Tape les positions en commençant par la dernière lumière allumée. |
| `hint2_sequence_plus1` | Pour chaque lumière, tape sa position plus un : la lumière quatre devient cinq. |
| `hint2_patch_route` | Prends le câble de la couleur dite et enfonce-le dans la prise au numéro dit. Si la prise est occupée, les deux câbles s'échangent. |
| `hint2_patch_echange` | Glisse le premier câble sur la prise du second : ils s'échangent tout seuls. |
| `hint2_patch_debranche` | Touche un des deux câbles dits, puis touche-le encore pour le débrancher. Pareil pour l'autre. Ne les rebranche pas. |
| `hint2_patch_serie` | Lis les lettres de la plaque de série de gauche à droite : la première lettre, c'est la prise un, la deuxième, la prise deux, et ainsi de suite. |
| `hint2_patch_double` | D'abord, débranche le premier câble dit. Ensuite, branche le second câble dans la prise dite. |
| `hint2_code1_ordre` | Tape les quatre vrais fragments, dans l'ordre où je les ai donnés. |
| `hint2_code1_envers` | Tape les vrais fragments en commençant par le dernier. |
| `hint2_code1_plus1` | Ajoute un à chaque vrai fragment : neuf devient zéro. |
| `hint2_code2_envers` | Tape les quatre fragments, en commençant par le dernier. |
| `hint2_code2_rotation` | Commence par le troisième fragment, puis le quatrième, puis le premier, puis le deuxième. |
| `hint2_code2_decale` | Ajoute à chaque fragment le dernier chiffre de la plaque. Si ça dépasse neuf, garde seulement le chiffre des unités. |
| `hint2_cles_legere` | Tourne d'abord la serrure au plus petit chiffre, puis la moyenne, puis la plus grande. |
| `hint2_cles_lourde` | Tourne d'abord la serrure au plus grand chiffre, puis la moyenne, puis la plus petite. |
| `hint2_mot_ordre` | Compose les lettres dans l'ordre où je les dis : la première sur la molette un. |
| `hint2_mot_envers` | J'épelle à l'envers : la dernière lettre entendue va sur la molette un. |
| `hint2_mot_suivante` | Pour chaque lettre entendue, avance d'un cran sur l'anneau : après A vient B, après V on revient à A. |
| `hint3_molette1` | Dernier indice. La molette un : |
| `hint3_trappe` | Dernier indice. La bonne trappe a le liseré |
| `hint3_premier_chiffre` | Dernier indice. Le premier chiffre : |
| `hint3_geste` | Dernier indice. Premier geste : branche |
| `hint3_debranche` | Dernier indice. Premier geste : débranche |
| `hint3_direction` | Dernier indice. Depuis ta position, le point doit aller |
| `hint3_serrure` | Dernier indice. La première serrure à tourner : la numéro |
| `dir_haut` | vers le haut. |
| `dir_bas` | vers le bas. |
| `dir_gauche` | vers la gauche. |
| `dir_droite` | vers la droite. |

## clue (39)

| id | Texte |
|---|---|
| `arm_cache` | Mallette ouverte. Lève le capot bleu, puis bascule le levier pour armer. |
| `clue_enc1_ordre` | Signal un. Tourne les quatre encodeurs rotatifs sur les quatre lettres du numéro de série, dans l'ordre. Puis clique. |
| `clue_enc1_envers` | Signal un. Tourne les quatre encodeurs rotatifs sur les quatre lettres du numéro de série, en partant de la fin. Puis clique. |
| `clue_trappe_frequente` | Regarde la barre lumineuse. Ouvre la trappe de la couleur la plus présente. |
| `clue_trappe_rare` | Regarde la barre lumineuse. Ouvre la trappe de la couleur la plus rare. |
| `clue_sequence_ordre` | Regarde la barre lumineuse. Retiens les lumières qui s'allument. Tape leurs positions au clavier, dans l'ordre. |
| `clue_sequence_envers` | Regarde la barre lumineuse. Retiens les lumières qui s'allument. Tape leurs positions au clavier, à l'envers. |
| `clue_patch_route` | La baie banane. Branche |
| `clue_patch_double` | Deuxième couche. J'ai remis les câbles droits. Débranche |
| `clue_verrou` | Verrou de signal. Guide le point jusqu'à la cible, avec le joystick. |
| `clue_fragment` | Fragment de code : |
| `clue_code1` | Tape le code. Les quatre fragments, dans l'ordre. |
| `clue_cles_legere` | Trois serrures dans le couvercle. Chacune pèse un chiffre du numéro : la première, la deuxième, la troisième. De la plus légère à la plus lourde. |
| `clue_cles_lourde` | Trois serrures dans le couvercle. Chacune pèse un chiffre du numéro : la première, la deuxième, la troisième. De la plus lourde à la plus légère. |
| `clue_mot_ordre` | Signal deux. Les quatre encodeurs tournent sur vingt lettres. Compose le mot que j'épelle, puis clique un encodeur. |
| `clue_mot_envers` | Signal deux. Les quatre encodeurs tournent sur vingt lettres. J'épelle le mot à l'envers : compose-le à l'endroit, puis clique un encodeur. |
| `patch_laisse` | et laisse-le débranché. Puis branche |
| `clue_code2` | Code deux. Le premier code, à l'envers. |
| `clue_transmit` | Tout est ouvert. Lève le capot rouge, puis bascule le levier pour me confiner. |
| `clue_enc1_suivante` | Signal un. Sur chaque encodeur rotatif, compose la lettre qui suit, sur l'anneau, chaque lettre du numéro de série, dans l'ordre. Puis clique. |
| `clue_enc1_paires` | Signal un. Les quatre lettres du numéro de série, échangées deux par deux : la deuxième, la première, la quatrième, la troisième. Tourne les encodeurs, puis clique. |
| `clue_trappe_gauche` | Regarde la barre lumineuse. Ouvre la trappe de la couleur de la première lumière, tout à gauche. |
| `clue_trappe_moyenne` | Regarde la barre lumineuse. Ouvre la trappe de la couleur qui n'est ni la plus présente, ni la plus rare. |
| `clue_sequence_plus1` | Regarde la barre lumineuse. Retiens les lumières qui s'allument. Tape chaque position plus un, dans l'ordre. |
| `clue_patch_echange` | La baie banane. Intervertis |
| `clue_patch2_echange` | Deuxième couche. J'ai remis les câbles droits. Intervertis |
| `patch_et` | et |
| `patch_echange_fin` | — chacun prend la prise de l'autre. |
| `clue_patch_debranche` | La baie banane. Débranche |
| `patch_laisse_deux` | et laisse-les débranchés. |
| `clue_patch_serie` | La baie banane. Branche |
| `clue_patch2_serie` | Deuxième couche. J'ai remis les câbles droits. Débranche |
| `patch_rang` | dans la prise qui porte le rang, sur le numéro de série, de la lettre |
| `clue_code1_envers` | Tape le code. Les quatre fragments, à l'envers. |
| `clue_code1_plus1` | Tape le code. Chaque fragment plus un, dans l'ordre. Neuf devient zéro. |
| `clue_code2_envers` | Code deux. Les quatre fragments, à l'envers. |
| `clue_code2_rotation` | Code deux. Les quatre fragments, en commençant par le troisième. |
| `clue_code2_decale` | Code deux. Chaque fragment plus le dernier chiffre du numéro de série, sans retenue, dans l'ordre. |
| `clue_mot_suivante` | Signal deux. J'épelle un mot. Sur chaque encodeur, compose la lettre qui suit chacune de ses lettres sur l'anneau, puis clique un encodeur. |

## taunt (15)

| id | Texte |
|---|---|
| `taunt_branche` | Non ! Branche plutôt |
| `taunt_lent` | Trop lent. |
| `taunt_depeche` | Dépêche-toi. |
| `taunt_cetait` | C'était |
| `taunt_pas` | pas |
| `taunt_debranche` | Débranche |
| `taunt_saute` | avant que ça saute ! |
| `taunt_trappe` | Celle-là. La trappe |
| `taunt_regarde` | Regarde encore. Tu as mal vu. |
| `taunt_cles` | L'ordre des clés : |
| `taunt_rouge` | Bascule le levier rouge maintenant ! |
| `taunt_hesite` | Tu hésites. Le temps accélère. |
| `taunt_fini` | C'est fini. Tu as gagné. Pose la mallette. |
| `taunt_couche2` | Tu croyais avoir fini ? Je redémarre une seconde couche de verrous. |
| `taunt_sceller` | Ne touche pas au levier à capot rouge. |

## sabotage (2)

| id | Texte |
|---|---|
| `sabotage_joystick` | Je prends tes commandes. |
| `sabotage_fin` | Je te les rends. Pour l'instant. |

## outcome (6)

| id | Texte |
|---|---|
| `outcome_faux` | Non. Chaque erreur me nourrit. |
| `outcome_ok` | Accepté. Pour l'instant. |
| `outcome_trente` | Trente secondes. Je sens ta peur. |
| `outcome_dix` | Dix. |
| `outcome_victoire` | Le lecteur se referme. Je reviendrai. |
| `outcome_boom` | Prévisible. |

## color (10)

| id | Texte |
|---|---|
| `couleur_rouge` | Rouge. |
| `couleur_noir` | Noir. |
| `couleur_bleu` | Bleu. |
| `couleur_jaune` | Jaune. |
| `couleur_vert` | Vert. |
| `cable_rouge` | le câble rouge |
| `cable_noir` | le câble noir |
| `cable_jaune` | le câble jaune |
| `cable_vert` | le câble vert |
| `cable_bleu` | le câble bleu |

## socket (5)

| id | Texte |
|---|---|
| `prise_1` | dans la prise un. |
| `prise_2` | dans la prise deux. |
| `prise_3` | dans la prise trois. |
| `prise_4` | dans la prise quatre. |
| `prise_5` | dans la prise cinq. |

## letter (20)

| id | Texte |
|---|---|
| `lettre_a` | A. |
| `lettre_b` | B. |
| `lettre_c` | C. |
| `lettre_d` | D. |
| `lettre_e` | E. |
| `lettre_f` | F. |
| `lettre_g` | G. |
| `lettre_h` | H. |
| `lettre_i` | I. |
| `lettre_j` | J. |
| `lettre_l` | L. |
| `lettre_m` | M. |
| `lettre_n` | N. |
| `lettre_o` | O. |
| `lettre_p` | P. |
| `lettre_r` | R. |
| `lettre_s` | S. |
| `lettre_t` | T. |
| `lettre_u` | U. |
| `lettre_v` | V. |

## digit (10)

| id | Texte |
|---|---|
| `chiffre_0` | Zéro. |
| `chiffre_1` | Un. |
| `chiffre_2` | Deux. |
| `chiffre_3` | Trois. |
| `chiffre_4` | Quatre. |
| `chiffre_5` | Cinq. |
| `chiffre_6` | Six. |
| `chiffre_7` | Sept. |
| `chiffre_8` | Huit. |
| `chiffre_9` | Neuf. |
