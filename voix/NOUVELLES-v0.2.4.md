# Nouvelles voix v0.2.4

Enregistrées le 24 novembre 2026 (heure de Toronto) avec ElevenLabs, voix **The Curator** (`gJ4a5qWqzRc6NDQT0dIz`), modèle `eleven_v4`, une prise par réplique.
Préfixe de style : `[cold, calm, deep, emotionless] `.
Puis la chaîne ffmpeg légère : asetrate 0,94, atempo 1,064, afftfilt de phase, aecho, highpass 80 Hz, lowpass 8 kHz, loudnorm (I=−16, LRA=11, TP=−1,5), 0,1 s de silence aux deux bouts, mono 44,1 kHz 80 kbps.

Les prises Piper v0.2.4 restent en sauvegarde dans `voix/raw/v0.2.4-piper/` et n’ont pas été effacées.

Source des textes : `voix/manifest.json` (version 0.2.4), 172 répliques au total.
Déjà présentes et **non écrasées** : `intro.mp3` et `depart.mp3` (ElevenLabs, `mp3Ready: true`).
Nouveaux fichiers : **170**, mêmes noms que les prises Piper, écrasées par ces prises ElevenLabs.

Les fichiers sont prêts. Pour les jouer à la place de la synthèse du navigateur, APP doit passer `mp3Ready` à `true` dans `voix/manifest.json` (aucun autre changement de code n’est requis, voir `js/voice-manifest.js`).

## Lignes dynamiques (fragments assemblés)

Le jeu concatène des ids, il n’y a donc pas un fichier par phrase complète. Chaque fragment a son mp3 :

- Étape 4 / 10 (baie banane), `game.js:110-126` : tête (`clue_patch_route`, `clue_patch_echange`, `clue_patch2_echange`, `clue_patch_debranche`, `clue_patch_serie`, `clue_patch2_serie`, `clue_patch_double`) + `cable_{rouge,noir,jaune,vert,bleu}` + `prise_1`…`prise_5` + éventuellement `patch_et`, `patch_laisse`, `patch_laisse_deux`, `patch_echange_fin`, `patch_rang` + `lettre_*`.
- Mensonges câbles, `app.js:567/581` : `taunt_branche` + `cable_*` + `prise_*`.
- Fragments de code, `app.js:616-617` : `clue_fragment` + `chiffre_0`…`chiffre_9`.
- Mot épelé, `game.js:159` : `clue_mot_*` + `lettre_a`…`lettre_v` (20 lettres de l’anneau, pas K/Q/W/X/Y/Z).
- Indices 2 des codes, `guide.js:69-71` : `hint2_code1_*` / `hint2_code2_*` + `hint_rappel_fragments` + 4× `chiffre_*`.
- Indices 3, `guide.js:78-96` : préfixe (`hint3_*`) + une lettre, une couleur, un chiffre, un câble/prise, ou une direction (`dir_*`).

Jeu fini et petit : toutes les valeurs possibles ont un fichier (10 chiffres, 5 couleurs, 5 câbles, 5 prises, 20 lettres, 4 directions). Aucune ligne à nombre ouvert (pas de timer lu à voix haute, pas de pourcentage batterie parlé).

## Non enregistré (pas dit par l’Entité)

- Tutoriel 5 écrans (`app.js` `TUTO`) : texte à l’écran seulement, pas d’appel `voice()`.
- Batterie (`js/battery.js`) : jauge, icône, bip sous 15 %. Aucune réplique parlée.

## Répliques du manifeste sans appel JS actuel

- `clue_code2` : VOIX.md indique qu’elle n’est plus dite (remplacée par `clue_code2_envers` / `rotation` / `decale`). Fichier quand même livré.
- `taunt_pas`, `taunt_debranche`, `taunt_saute` : présentes au manifeste, aucun `voice()` dans le JS v0.2.4. Fichiers livrés.

## Vérifications techniques

- 170/170 ok, mono 44,1 kHz ≈ 80 kbps, aucun fichier silencieux, aucun clipping (max volumedetect −3,3 à −1,1 dB, tous ≤ −1 dB).
- LUFS intégré : −23,18 à −16,17 (cible loudnorm I=−16 ; les très courtes répliques mesurent plus bas).
- True peak (loudnorm) : −2,84 à −1,0 dBTP.
- `outcome_trente` (crête −0,9 dB) et `clue_mot_suivante` (−1,2 dB) ont été repassés depuis l’audio brut ElevenLabs, même chaîne plus un limiteur (`alimiter`, sans auto-niveau), sans nouveau crédit. Crêtes après coup : −1,6 dB et −1,8 dB.
- Contrôle d’identité : les 170 fichiers bruts correspondent au SHA-256 de l’URL de leur propre `generation_id`. Aucun mélange restant.
- Neuf prises courtes un peu longues (`lettre_b`, `lettre_d`, `lettre_h`, `lettre_i`, `lettre_m`, `lettre_v`, `patch_et`, `chiffre_5`, `couleur_rouge`) : silencedetect montre un silence au milieu et une deuxième salve de parole, pas seulement un pad en tête ou en queue. Laissées telles quelles. Même profil, hors liste demandée : `chiffre_2` (2,51 s pour « Deux. »).
- Crêtes encore proches de −1 dB (toutes ≤ −1,1 dB, pas de limiteur supplémentaire) : `hint2_patch_debranche` −1,1 ; `hint2_trappe_frequente` −1,2 ; `hint2_verrou` −1,3 ; `chiffre_6`, `clue_enc1_ordre`, `cable_jaune`, `clue_patch2_echange` −1,4.

Les contrôles sont techniques seulement (ffprobe, volumedetect, loudnorm, silencedetect, comparaison de hachage). Pas d’écoute, pas de transcription : le libellé exact n’est pas confirmé à l’oreille.

## Tableau

| id | fichier | texte exact | où c’est utilisé |
|---|---|---|---|
| `arm_cache` | `voix/arm_cache.mp3` | Mallette ouverte. Lève le capot bleu, puis bascule le levier pour armer. | app.js:743 |
| `chiffre_0` | `voix/chiffre_0.mp3` | Zéro. | app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `chiffre_1` | `voix/chiffre_1.mp3` | Un. | app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `chiffre_2` | `voix/chiffre_2.mp3` | Deux. | app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `chiffre_3` | `voix/chiffre_3.mp3` | Trois. | app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `chiffre_4` | `voix/chiffre_4.mp3` | Quatre. | audio.js:134 ; voice-manifest.js:2 ; app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `chiffre_5` | `voix/chiffre_5.mp3` | Cinq. | app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `chiffre_6` | `voix/chiffre_6.mp3` | Six. | app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `chiffre_7` | `voix/chiffre_7.mp3` | Sept. | app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `chiffre_8` | `voix/chiffre_8.mp3` | Huit. | app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `chiffre_9` | `voix/chiffre_9.mp3` | Neuf. | app.js: digit(d) → chiffre_${d} (fragments, leurres, serrures) ; guide.js:41 dig(d) → chiffre_${d} (indices 3 + rappel fragments) |
| `couleur_rouge` | `voix/couleur_rouge.mp3` | Rouge. | app.js: color(c) → couleur_${c} (taunt_trappe + leurre) ; guide.js:81 couleur_${run.trapColors[run.trap]} (indice 3 trappe) |
| `couleur_noir` | `voix/couleur_noir.mp3` | Noir. | app.js: color(c) → couleur_${c} (taunt_trappe + leurre) ; guide.js:81 couleur_${run.trapColors[run.trap]} (indice 3 trappe) |
| `couleur_bleu` | `voix/couleur_bleu.mp3` | Bleu. | app.js: color(c) → couleur_${c} (taunt_trappe + leurre) ; guide.js:81 couleur_${run.trapColors[run.trap]} (indice 3 trappe) |
| `couleur_jaune` | `voix/couleur_jaune.mp3` | Jaune. | app.js: color(c) → couleur_${c} (taunt_trappe + leurre) ; guide.js:81 couleur_${run.trapColors[run.trap]} (indice 3 trappe) |
| `couleur_vert` | `voix/couleur_vert.mp3` | Vert. | app.js: color(c) → couleur_${c} (taunt_trappe + leurre) ; guide.js:81 couleur_${run.trapColors[run.trap]} (indice 3 trappe) |
| `clue_enc1_ordre` | `voix/clue_enc1_ordre.mp3` | Signal un. Tourne les quatre encodeurs rotatifs sur les quatre lettres du numéro de série, dans l'ordre. Puis clique. | game.js:85 cues[1] = clue_enc1_${v.enc1} ; app.js:560 voice(C[1]) étape 1 |
| `clue_enc1_envers` | `voix/clue_enc1_envers.mp3` | Signal un. Tourne les quatre encodeurs rotatifs sur les quatre lettres du numéro de série, en partant de la fin. Puis clique. | game.js:85 cues[1] = clue_enc1_${v.enc1} ; app.js:560 voice(C[1]) étape 1 |
| `clue_trappe_frequente` | `voix/clue_trappe_frequente.mp3` | Regarde la barre lumineuse. Ouvre la trappe de la couleur la plus présente. | game.js:95 cues[2] = clue_trappe_${v.trap} ; app.js:561 voice(C[2]) étape 2 |
| `clue_trappe_rare` | `voix/clue_trappe_rare.mp3` | Regarde la barre lumineuse. Ouvre la trappe de la couleur la plus rare. | game.js:95 cues[2] ; app.js:561 étape 2 |
| `clue_sequence_ordre` | `voix/clue_sequence_ordre.mp3` | Regarde la barre lumineuse. Retiens les lumières qui s'allument. Tape leurs positions au clavier, dans l'ordre. | game.js:101 cues[3] = clue_sequence_${v.seq} ; app.js:563 voice(C[3]) étape 3 |
| `clue_sequence_envers` | `voix/clue_sequence_envers.mp3` | Regarde la barre lumineuse. Retiens les lumières qui s'allument. Tape leurs positions au clavier, à l'envers. | game.js:101 cues[3] ; app.js:563 étape 3 |
| `clue_patch_route` | `voix/clue_patch_route.mp3` | La baie banane. Branche | game.js:111 ; voice-manifest.js:3 |
| `clue_patch_double` | `voix/clue_patch_double.mp3` | Deuxième couche. J'ai remis les câbles droits. Débranche | game.js:122 |
| `clue_verrou` | `voix/clue_verrou.mp3` | Verrou de signal. Guide le point jusqu'à la cible, avec le joystick. | app.js:568 ; app.js:578 |
| `clue_fragment` | `voix/clue_fragment.mp3` | Fragment de code : | audio.js:134 ; app.js:617 ; app.js:618 ; voice-manifest.js:2 |
| `clue_code1` | `voix/clue_code1.mp3` | Tape le code. Les quatre fragments, dans l'ordre. | game.js:136 |
| `clue_cles_legere` | `voix/clue_cles_legere.mp3` | Trois serrures dans le couvercle. Chacune pèse un chiffre du numéro : la première, la deuxième, la troisième. De la plus légère à la plus lourde. | game.js:140 cues[7] = clue_cles_${v.keys} ; app.js:572 voice(C[7]) étape 7 |
| `clue_cles_lourde` | `voix/clue_cles_lourde.mp3` | Trois serrures dans le couvercle. Chacune pèse un chiffre du numéro : la première, la deuxième, la troisième. De la plus lourde à la plus légère. | game.js:140 cues[7] ; app.js:572 étape 7 |
| `clue_mot_ordre` | `voix/clue_mot_ordre.mp3` | Signal deux. Les quatre encodeurs tournent sur vingt lettres. Compose le mot que j'épelle, puis clique un encodeur. | game.js:159 cues[8] = clue_mot_${v.word} + lettres ; app.js:576 voice(C[8]) étape 8 |
| `clue_mot_envers` | `voix/clue_mot_envers.mp3` | Signal deux. Les quatre encodeurs tournent sur vingt lettres. J'épelle le mot à l'envers : compose-le à l'endroit, puis clique un encodeur. | game.js:159 cues[8] ; app.js:576 étape 8 |
| `patch_laisse` | `voix/patch_laisse.mp3` | et laisse-le débranché. Puis branche | game.js:113 ; game.js:119 ; game.js:122 |
| `taunt_branche` | `voix/taunt_branche.mp3` | Non ! Branche plutôt | app.js:567 ; app.js:581 |
| `clue_code2` | `voix/clue_code2.mp3` | Code deux. Le premier code, à l'envers. | Présent dans voix/manifest.json et VOIX.md, mais VOIX.md dit qu'elle n'est plus dite (remplacée par clue_code2_envers). Aucun appel dans le JS v0.2.4 (game.js:136 utilise clue_code2_${v.code2}). Enregistrée quand même, car elle figure au manifeste. |
| `clue_transmit` | `voix/clue_transmit.mp3` | Tout est ouvert. Lève le capot rouge, puis bascule le levier pour me confiner. | app.js:584 |
| `taunt_lent` | `voix/taunt_lent.mp3` | Trop lent. | app.js:569 |
| `taunt_depeche` | `voix/taunt_depeche.mp3` | Dépêche-toi. | app.js:571 ; app.js:592 ; app.js:593 ; app.js:929 |
| `taunt_cetait` | `voix/taunt_cetait.mp3` | C'était | app.js:571 ; app.js:592 ; app.js:593 ; app.js:929 |
| `taunt_pas` | `voix/taunt_pas.mp3` | pas | Dans le manifeste, aucun appel dans le JS v0.2.4. Possible reliquat d'assemblage (« C'était » + « pas » + …). |
| `taunt_debranche` | `voix/taunt_debranche.mp3` | Débranche | Dans le manifeste, aucun appel dans le JS v0.2.4. |
| `taunt_saute` | `voix/taunt_saute.mp3` | avant que ça saute ! | Dans le manifeste, aucun appel dans le JS v0.2.4. Possible reliquat (« Débranche … avant que ça saute ! »). |
| `taunt_trappe` | `voix/taunt_trappe.mp3` | Celle-là. La trappe | app.js:563 |
| `taunt_regarde` | `voix/taunt_regarde.mp3` | Regarde encore. Tu as mal vu. | app.js:565 |
| `taunt_cles` | `voix/taunt_cles.mp3` | L'ordre des clés : | app.js:574 ; app.js:575 |
| `taunt_rouge` | `voix/taunt_rouge.mp3` | Bascule le levier rouge maintenant ! | app.js:583 |
| `taunt_hesite` | `voix/taunt_hesite.mp3` | Tu hésites. Le temps accélère. | app.js:1042 |
| `taunt_fini` | `voix/taunt_fini.mp3` | C'est fini. Tu as gagné. Pose la mallette. | app.js:967 |
| `taunt_couche2` | `voix/taunt_couche2.mp3` | Tu croyais avoir fini ? Je redémarre une seconde couche de verrous. | app.js:967 |
| `taunt_sceller` | `voix/taunt_sceller.mp3` | Ne touche pas au levier à capot rouge. | app.js:584 |
| `sabotage_joystick` | `voix/sabotage_joystick.mp3` | Je prends tes commandes. | app.js:988 |
| `sabotage_fin` | `voix/sabotage_fin.mp3` | Je te les rends. Pour l'instant. | app.js:989 |
| `outcome_faux` | `voix/outcome_faux.mp3` | Non. Chaque erreur me nourrit. | app.js:622 |
| `outcome_ok` | `voix/outcome_ok.mp3` | Accepté. Pour l'instant. | app.js:619 |
| `outcome_trente` | `voix/outcome_trente.mp3` | Trente secondes. Je sens ta peur. | app.js:1035 |
| `outcome_dix` | `voix/outcome_dix.mp3` | Dix. | app.js:1036 |
| `outcome_victoire` | `voix/outcome_victoire.mp3` | Le lecteur se referme. Je reviendrai. | app.js:786 |
| `outcome_boom` | `voix/outcome_boom.mp3` | Prévisible. | app.js:787 |
| `lettre_a` | `voix/lettre_a.mp3` | A. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_b` | `voix/lettre_b.mp3` | B. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_c` | `voix/lettre_c.mp3` | C. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_d` | `voix/lettre_d.mp3` | D. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_e` | `voix/lettre_e.mp3` | E. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_f` | `voix/lettre_f.mp3` | F. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_g` | `voix/lettre_g.mp3` | G. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_h` | `voix/lettre_h.mp3` | H. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_i` | `voix/lettre_i.mp3` | I. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_j` | `voix/lettre_j.mp3` | J. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_l` | `voix/lettre_l.mp3` | L. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_m` | `voix/lettre_m.mp3` | M. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_n` | `voix/lettre_n.mp3` | N. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_o` | `voix/lettre_o.mp3` | O. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_p` | `voix/lettre_p.mp3` | P. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_r` | `voix/lettre_r.mp3` | R. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_s` | `voix/lettre_s.mp3` | S. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_t` | `voix/lettre_t.mp3` | T. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_u` | `voix/lettre_u.mp3` | U. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `lettre_v` | `voix/lettre_v.mp3` | V. | app.js: letter(ch) → lettre_${ch} (mot épelé, leurres d'encodeurs) ; guide.js:42 let_(ch) → lettre_${ch} (indice 3 molette 1) |
| `cable_rouge` | `voix/cable_rouge.mp3` | le câble rouge | voice-manifest.js:3 ; app.js: cableCue(c) → cable_${c} (consignes et leurres baie banane) ; guide.js:39 cab(run,c) → cable_${run.wires[c]} (indice 3 câbles) |
| `cable_noir` | `voix/cable_noir.mp3` | le câble noir | app.js: cableCue(c) → cable_${c} (consignes et leurres baie banane) ; guide.js:39 cab(run,c) → cable_${run.wires[c]} (indice 3 câbles) |
| `cable_jaune` | `voix/cable_jaune.mp3` | le câble jaune | app.js: cableCue(c) → cable_${c} (consignes et leurres baie banane) ; guide.js:39 cab(run,c) → cable_${run.wires[c]} (indice 3 câbles) |
| `cable_vert` | `voix/cable_vert.mp3` | le câble vert | app.js: cableCue(c) → cable_${c} (consignes et leurres baie banane) ; guide.js:39 cab(run,c) → cable_${run.wires[c]} (indice 3 câbles) |
| `cable_bleu` | `voix/cable_bleu.mp3` | le câble bleu | app.js: cableCue(c) → cable_${c} (consignes et leurres baie banane) ; guide.js:39 cab(run,c) → cable_${run.wires[c]} (indice 3 câbles) |
| `prise_1` | `voix/prise_1.mp3` | dans la prise un. | app.js: prise(s) → prise_${s+1} (consignes et leurres baie banane) ; guide.js:40 pr(s) → prise_${s+1} (indice 3 câbles) |
| `prise_2` | `voix/prise_2.mp3` | dans la prise deux. | app.js: prise(s) → prise_${s+1} (consignes et leurres baie banane) ; guide.js:40 pr(s) → prise_${s+1} (indice 3 câbles) |
| `prise_3` | `voix/prise_3.mp3` | dans la prise trois. | voice-manifest.js:3 ; app.js: prise(s) → prise_${s+1} (consignes et leurres baie banane) ; guide.js:40 pr(s) → prise_${s+1} (indice 3 câbles) |
| `prise_4` | `voix/prise_4.mp3` | dans la prise quatre. | app.js: prise(s) → prise_${s+1} (consignes et leurres baie banane) ; guide.js:40 pr(s) → prise_${s+1} (indice 3 câbles) |
| `prise_5` | `voix/prise_5.mp3` | dans la prise cinq. | app.js: prise(s) → prise_${s+1} (consignes et leurres baie banane) ; guide.js:40 pr(s) → prise_${s+1} (indice 3 câbles) |
| `clue_enc1_suivante` | `voix/clue_enc1_suivante.mp3` | Signal un. Sur chaque encodeur rotatif, compose la lettre qui suit, sur l'anneau, chaque lettre du numéro de série, dans l'ordre. Puis clique. | game.js:85 cues[1] = clue_enc1_${v.enc1} ; app.js:560 voice(C[1]) étape 1 |
| `clue_enc1_paires` | `voix/clue_enc1_paires.mp3` | Signal un. Les quatre lettres du numéro de série, échangées deux par deux : la deuxième, la première, la quatrième, la troisième. Tourne les encodeurs, puis clique. | game.js:85 cues[1] = clue_enc1_${v.enc1} ; app.js:560 voice(C[1]) étape 1 |
| `clue_trappe_gauche` | `voix/clue_trappe_gauche.mp3` | Regarde la barre lumineuse. Ouvre la trappe de la couleur de la première lumière, tout à gauche. | game.js:95 cues[2] ; app.js:561 étape 2 |
| `clue_trappe_moyenne` | `voix/clue_trappe_moyenne.mp3` | Regarde la barre lumineuse. Ouvre la trappe de la couleur qui n'est ni la plus présente, ni la plus rare. | game.js:95 cues[2] ; app.js:561 étape 2 |
| `clue_sequence_plus1` | `voix/clue_sequence_plus1.mp3` | Regarde la barre lumineuse. Retiens les lumières qui s'allument. Tape chaque position plus un, dans l'ordre. | game.js:101 cues[3] ; app.js:563 étape 3 |
| `clue_patch_echange` | `voix/clue_patch_echange.mp3` | La baie banane. Intervertis | game.js:112 ${head}_echange + câbles + patch_et + patch_echange_fin ; app.js:565/579 étapes 4 et 10 |
| `clue_patch2_echange` | `voix/clue_patch2_echange.mp3` | Deuxième couche. J'ai remis les câbles droits. Intervertis | game.js:110-112 couche 2, kind echange ; app.js:579 étape 10 |
| `patch_et` | `voix/patch_et.mp3` | et | game.js:112 ; game.js:113 |
| `patch_echange_fin` | `voix/patch_echange_fin.mp3` | — chacun prend la prise de l'autre. | game.js:112 |
| `clue_patch_debranche` | `voix/clue_patch_debranche.mp3` | La baie banane. Débranche | game.js:113 |
| `patch_laisse_deux` | `voix/patch_laisse_deux.mp3` | et laisse-les débranchés. | game.js:113 |
| `clue_patch_serie` | `voix/clue_patch_serie.mp3` | La baie banane. Branche | game.js:116 |
| `clue_patch2_serie` | `voix/clue_patch2_serie.mp3` | Deuxième couche. J'ai remis les câbles droits. Débranche | game.js:119 |
| `patch_rang` | `voix/patch_rang.mp3` | dans la prise qui porte le rang, sur le numéro de série, de la lettre | game.js:116 ; game.js:119 |
| `clue_code1_envers` | `voix/clue_code1_envers.mp3` | Tape le code. Les quatre fragments, à l'envers. | game.js:136 cues[6] = clue_code1_${v.code1} ; app.js:569 voice(C[6]) étape 6 |
| `clue_code1_plus1` | `voix/clue_code1_plus1.mp3` | Tape le code. Chaque fragment plus un, dans l'ordre. Neuf devient zéro. | game.js:136 cues[6] ; app.js:569 étape 6 |
| `clue_code2_envers` | `voix/clue_code2_envers.mp3` | Code deux. Les quatre fragments, à l'envers. | game.js:136 cues[11] = clue_code2_${v.code2} ; app.js:581 voice(C[11]) étape 11 (étape 10 du point de vue « code 2 ») |
| `clue_code2_rotation` | `voix/clue_code2_rotation.mp3` | Code deux. Les quatre fragments, en commençant par le troisième. | game.js:136 cues[11] ; app.js:581 étape 11 |
| `clue_code2_decale` | `voix/clue_code2_decale.mp3` | Code deux. Chaque fragment plus le dernier chiffre du numéro de série, sans retenue, dans l'ordre. | game.js:136 cues[11] ; app.js:581 étape 11 |
| `clue_mot_suivante` | `voix/clue_mot_suivante.mp3` | Signal deux. J'épelle un mot. Sur chaque encodeur, compose la lettre qui suit chacune de ses lettres sur l'anneau, puis clique un encodeur. | game.js:159 cues[8] ; app.js:576 étape 8 |
| `obj_armer` | `voix/obj_armer.mp3` | Lève le capot bleu, puis bascule le levier. | guide.js:10 ; guide.js:9-11 OBJECTIVE[0] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_molettes_code` | `voix/obj_molettes_code.mp3` | Molettes : forme quatre lettres, puis clique. | guide.js:10 ; guide.js:9-11 OBJECTIVE[1] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_trappe` | `voix/obj_trappe.mp3` | Ouvre la bonne trappe. | guide.js:10 ; guide.js:9-11 OBJECTIVE[2] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_sequence` | `voix/obj_sequence.mp3` | Observe la barre, puis tape au clavier. | guide.js:10 ; guide.js:9-11 OBJECTIVE[3] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_cables` | `voix/obj_cables.mp3` | Branche les câbles dans les bonnes prises. | guide.js:10 ; guide.js:11 ; guide.js:9-11 OBJECTIVE[4] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_verrou` | `voix/obj_verrou.mp3` | Joystick : guide le point au cercle vert. | guide.js:10 ; guide.js:11 ; guide.js:9-11 OBJECTIVE[5] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau ; guide.js:9-11 OBJECTIVE[9] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_code` | `voix/obj_code.mp3` | Tape le code sur le clavier. | guide.js:10 ; guide.js:11 ; guide.js:9-11 OBJECTIVE[6] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau ; guide.js:9-11 OBJECTIVE[11] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_cles` | `voix/obj_cles.mp3` | Tourne les trois serrures dans le bon ordre. | guide.js:11 ; guide.js:9-11 OBJECTIVE[7] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_mot` | `voix/obj_mot.mp3` | Tourne les molettes pour former le mot. | guide.js:11 ; guide.js:9-11 OBJECTIVE[8] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_cables2` | `voix/obj_cables2.mp3` | Rebranche les câbles : nouvelle consigne. | guide.js:11 ; guide.js:9-11 OBJECTIVE[10] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `obj_transmit` | `voix/obj_transmit.mp3` | Lève le capot rouge, puis bascule le levier. | guide.js:11 ; guide.js:9-11 OBJECTIVE[12] ; dit au début d'étape (app.js avec C[step] / O) et écrit dans le bandeau |
| `hint1_armer` | `voix/hint1_armer.mp3` | Indice : le levier bleu, en bas à gauche. Touche son capot pour le lever, puis touche le levier. | guide.js:64 ; guide.js:108 ; guide.js:58 étape 0, indice 1 |
| `hint2_armer` | `voix/hint2_armer.mp3` | Premier geste : lever le capot bleu. Deuxième geste : basculer le levier dessous. | guide.js:64 ; guide.js:108 ; guide.js:58 étape 0, indice 2 et 3 |
| `hint1_plaque` | `voix/hint1_plaque.mp3` | Indice : regarde la plaque du numéro de série, dans le couvercle. Ce sont ses lettres qu'il faut. | guide.js:27 ; guide.js:21 H1[1] ; hintCues niveau 1 (auto 45 s / bouton Indice) |
| `hint1_barre` | `voix/hint1_barre.mp3` | Indice : compte les couleurs sur la barre lumineuse, puis compare avec le liseré de chaque trappe. | guide.js:27 ; guide.js:21 H1[2] ; hintCues niveau 1 (auto 45 s / bouton Indice) |
| `hint1_sequence` | `voix/hint1_sequence.mp3` | Indice : appuie sur Réécouter, puis regarde la barre. Chaque lumière a une position, de un à huit, depuis la gauche. | guide.js:27 ; guide.js:21 H1[3] ; hintCues niveau 1 (auto 45 s / bouton Indice) |
| `hint1_cables` | `voix/hint1_cables.mp3` | Indice : chaque câble a une couleur. Les prises sont numérotées de un à cinq, de gauche à droite. Écoute bien la couleur et la prise. | guide.js:27 ; guide.js:21 H1[4] ; hintCues niveau 1 (auto 45 s / bouton Indice) ; guide.js:21 H1[10] ; hintCues niveau 1 (auto 45 s / bouton Indice) |
| `hint1_verrou` | `voix/hint1_verrou.mp3` | Indice : le carré blanc, c'est toi. Les traits sont des murs. Si l'écran devient rouge, les commandes sont inversées. | guide.js:27 ; guide.js:21 H1[5] ; hintCues niveau 1 (auto 45 s / bouton Indice) ; guide.js:21 H1[9] ; hintCues niveau 1 (auto 45 s / bouton Indice) |
| `hint1_code` | `voix/hint1_code.mp3` | Indice : les fragments de code sont les chiffres que je t'ai dictés après les étapes. Quand mon œil est rouge, le fragment est faux. | guide.js:27 ; guide.js:21 H1[6] ; hintCues niveau 1 (auto 45 s / bouton Indice) ; guide.js:21 H1[11] ; hintCues niveau 1 (auto 45 s / bouton Indice) |
| `hint1_cles` | `voix/hint1_cles.mp3` | Indice : la serrure un pèse le premier chiffre du numéro de série, la deux le deuxième, la trois le troisième. | guide.js:27 ; guide.js:21 H1[7] ; hintCues niveau 1 (auto 45 s / bouton Indice) |
| `hint1_mot` | `voix/hint1_mot.mp3` | Indice : appuie sur Réécouter pour entendre le mot épelé. L'écran OLED montre la lettre de chaque molette. | guide.js:27 ; guide.js:21 H1[8] ; hintCues niveau 1 (auto 45 s / bouton Indice) |
| `hint1_transmit` | `voix/hint1_transmit.mp3` | Indice : le levier rouge, en bas à droite. Touche son capot pour le lever, puis touche le levier. | guide.js:27 ; guide.js:21 H1[12] ; hintCues niveau 1 (auto 45 s / bouton Indice) |
| `hint2_verrou` | `voix/hint2_verrou.mp3` | Le chemin existe toujours. Essaie d'abord vers la droite et vers le haut. Si l'écran est rouge, pousse dans le sens opposé. | guide.js:74 ; guide.js:99 ; guide.js:108 ; guide.js:68/93 étapes 5 et 9, indice 2 (et repli indice 3) |
| `hint2_transmit` | `voix/hint2_transmit.mp3` | Premier geste : lever le capot rouge. Deuxième geste : basculer le levier dessous. | guide.js:81 ; guide.js:102 ; guide.js:108 ; guide.js:75/96 étape 12, indices 2 et 3 |
| `hint_rappel_fragments` | `voix/hint_rappel_fragments.mp3` | Rappel des vrais fragments, dans l'ordre : | guide.js:77 ; guide.js:108 ; guide.js:71 suivi des 4 chiffres vrais, étapes 6 et 11 indice 2 |
| `hint2_enc1_ordre` | `voix/hint2_enc1_ordre.mp3` | Les quatre lettres de la plaque, de gauche à droite : la première sur la molette un, et ainsi de suite. | guide.js:63 hint2_enc1_${v.enc1} étape 1 |
| `hint2_enc1_envers` | `voix/hint2_enc1_envers.mp3` | Les lettres de la plaque en partant de la droite : la dernière lettre va sur la molette un. | guide.js:63 hint2_enc1_${v.enc1} étape 1 |
| `hint2_enc1_suivante` | `voix/hint2_enc1_suivante.mp3` | Pour chaque lettre de la plaque, avance d'un cran sur l'anneau : après A vient B. L'anneau a I et O, mais pas K. | guide.js:63 hint2_enc1_${v.enc1} étape 1 |
| `hint2_enc1_paires` | `voix/hint2_enc1_paires.mp3` | Lettres de la plaque : la deuxième sur la molette un, la première sur la deux, la quatrième sur la trois, la troisième sur la quatre. | guide.js:63 hint2_enc1_${v.enc1} étape 1 |
| `hint2_trappe_frequente` | `voix/hint2_trappe_frequente.mp3` | La couleur qui revient le plus souvent sur les huit lumières. | guide.js:64 hint2_trappe_${v.trap} étape 2 |
| `hint2_trappe_rare` | `voix/hint2_trappe_rare.mp3` | La couleur qui n'apparaît qu'une seule fois sur la barre. | guide.js:64 hint2_trappe_${v.trap} étape 2 |
| `hint2_trappe_moyenne` | `voix/hint2_trappe_moyenne.mp3` | Trois couleurs sur la barre : ni celle qui revient le plus, ni celle qui n'apparaît qu'une fois. | guide.js:64 hint2_trappe_${v.trap} étape 2 |
| `hint2_trappe_gauche` | `voix/hint2_trappe_gauche.mp3` | Regarde seulement la toute première lumière, à gauche de la barre. | guide.js:64 hint2_trappe_${v.trap} étape 2 |
| `hint2_sequence_ordre` | `voix/hint2_sequence_ordre.mp3` | Tape la position de chaque lumière, dans l'ordre où elles s'allument. Un, c'est tout à gauche. | guide.js:65 hint2_sequence_${v.seq} étape 3 |
| `hint2_sequence_envers` | `voix/hint2_sequence_envers.mp3` | Tape les positions en commençant par la dernière lumière allumée. | guide.js:65 hint2_sequence_${v.seq} étape 3 |
| `hint2_sequence_plus1` | `voix/hint2_sequence_plus1.mp3` | Pour chaque lumière, tape sa position plus un : la lumière quatre devient cinq. | guide.js:65 hint2_sequence_${v.seq} étape 3 |
| `hint2_patch_route` | `voix/hint2_patch_route.mp3` | Prends le câble de la couleur dite et enfonce-le dans la prise au numéro dit. Si la prise est occupée, les deux câbles s'échangent. | guide.js:66-67 hint2_patch_${run.patch*.kind} étapes 4 et 10 |
| `hint2_patch_echange` | `voix/hint2_patch_echange.mp3` | Glisse le premier câble sur la prise du second : ils s'échangent tout seuls. | guide.js:66-67 hint2_patch_${run.patch*.kind} étapes 4 et 10 |
| `hint2_patch_debranche` | `voix/hint2_patch_debranche.mp3` | Touche un des deux câbles dits, puis touche-le encore pour le débrancher. Pareil pour l'autre. Ne les rebranche pas. | guide.js:66-67 hint2_patch_${run.patch*.kind} étapes 4 et 10 |
| `hint2_patch_serie` | `voix/hint2_patch_serie.mp3` | Lis les lettres de la plaque de série de gauche à droite : la première lettre, c'est la prise un, la deuxième, la prise deux, et ainsi de suite. | guide.js:66-67 hint2_patch_${run.patch*.kind} étapes 4 et 10 |
| `hint2_patch_double` | `voix/hint2_patch_double.mp3` | D'abord, débranche le premier câble dit. Ensuite, branche le second câble dans la prise dite. | guide.js:66-67 hint2_patch_${run.patch*.kind} étapes 4 et 10 |
| `hint2_code1_ordre` | `voix/hint2_code1_ordre.mp3` | Tape les quatre vrais fragments, dans l'ordre où je les ai donnés. | guide.js:69-71 hint2_code1_${v.code1} + hint_rappel_fragments + chiffres, étape 6 |
| `hint2_code1_envers` | `voix/hint2_code1_envers.mp3` | Tape les vrais fragments en commençant par le dernier. | guide.js:69-71 hint2_code1_${v.code1} + hint_rappel_fragments + chiffres, étape 6 |
| `hint2_code1_plus1` | `voix/hint2_code1_plus1.mp3` | Ajoute un à chaque vrai fragment : neuf devient zéro. | guide.js:69-71 hint2_code1_${v.code1} + hint_rappel_fragments + chiffres, étape 6 |
| `hint2_code2_envers` | `voix/hint2_code2_envers.mp3` | Tape les quatre fragments, en commençant par le dernier. | guide.js:69-71 hint2_code2_${v.code2} + hint_rappel_fragments + chiffres, étape 11 |
| `hint2_code2_rotation` | `voix/hint2_code2_rotation.mp3` | Commence par le troisième fragment, puis le quatrième, puis le premier, puis le deuxième. | guide.js:69-71 hint2_code2_${v.code2} + hint_rappel_fragments + chiffres, étape 11 |
| `hint2_code2_decale` | `voix/hint2_code2_decale.mp3` | Ajoute à chaque fragment le dernier chiffre de la plaque. Si ça dépasse neuf, garde seulement le chiffre des unités. | guide.js:69-71 hint2_code2_${v.code2} + hint_rappel_fragments + chiffres, étape 11 |
| `hint2_cles_legere` | `voix/hint2_cles_legere.mp3` | Tourne d'abord la serrure au plus petit chiffre, puis la moyenne, puis la plus grande. | guide.js:112 ; guide.js:73 hint2_cles_${v.keys} étape 7 |
| `hint2_cles_lourde` | `voix/hint2_cles_lourde.mp3` | Tourne d'abord la serrure au plus grand chiffre, puis la moyenne, puis la plus petite. | guide.js:112 ; guide.js:73 hint2_cles_${v.keys} étape 7 |
| `hint2_mot_ordre` | `voix/hint2_mot_ordre.mp3` | Compose les lettres dans l'ordre où je les dis : la première sur la molette un. | guide.js:74 hint2_mot_${v.word} étape 8 |
| `hint2_mot_envers` | `voix/hint2_mot_envers.mp3` | J'épelle à l'envers : la dernière lettre entendue va sur la molette un. | guide.js:74 hint2_mot_${v.word} étape 8 |
| `hint2_mot_suivante` | `voix/hint2_mot_suivante.mp3` | Pour chaque lettre entendue, avance d'un cran sur l'anneau : après A vient B, après V on revient à A. | guide.js:74 hint2_mot_${v.word} étape 8 |
| `hint3_molette1` | `voix/hint3_molette1.mp3` | Dernier indice. La molette un : | guide.js:85 ; guide.js:86 ; guide.js:113 ; guide.js:79-80 + lettre, étapes 1 et 8 |
| `hint3_trappe` | `voix/hint3_trappe.mp3` | Dernier indice. La bonne trappe a le liseré | guide.js:87 ; guide.js:113 ; guide.js:81 + couleur_*, étape 2 |
| `hint3_premier_chiffre` | `voix/hint3_premier_chiffre.mp3` | Dernier indice. Le premier chiffre : | guide.js:88 ; guide.js:89 ; guide.js:90 ; guide.js:113 ; guide.js:82-84 + chiffre_*, étapes 3, 6, 11 |
| `hint3_geste` | `voix/hint3_geste.mp3` | Dernier indice. Premier geste : branche | guide.js:95 ; guide.js:113 ; guide.js:89 + cable_* + prise_*, étapes 4 et 10 si branchement |
| `hint3_debranche` | `voix/hint3_debranche.mp3` | Dernier indice. Premier geste : débranche | guide.js:95 ; guide.js:113 ; guide.js:89 + cable_*, étapes 4 et 10 si débranchement |
| `hint3_direction` | `voix/hint3_direction.mp3` | Dernier indice. Depuis ta position, le point doit aller | guide.js:99 ; guide.js:113 ; guide.js:93 + dir_*, étapes 5 et 9 |
| `hint3_serrure` | `voix/hint3_serrure.mp3` | Dernier indice. La première serrure à tourner : la numéro | guide.js:101 ; guide.js:113 ; guide.js:95 + chiffre_1..3, étape 7 |
| `dir_haut` | `voix/dir_haut.mp3` | vers le haut. | guide.js:49 ; guide.js:43 DIR_CUE.up ; indice 3 du verrou |
| `dir_bas` | `voix/dir_bas.mp3` | vers le bas. | guide.js:49 ; guide.js:43 DIR_CUE.down ; indice 3 du verrou |
| `dir_gauche` | `voix/dir_gauche.mp3` | vers la gauche. | guide.js:49 ; guide.js:43 DIR_CUE.left ; indice 3 du verrou |
| `dir_droite` | `voix/dir_droite.mp3` | vers la droite. | guide.js:49 ; guide.js:43 DIR_CUE.right ; indice 3 du verrou |
