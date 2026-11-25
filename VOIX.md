# Voix de l'Entité : répliques à enregistrer

Pour le bot Voix. Ton : froid, grave, lent, sans émotion, légèrement métallique. L'Entité tutoie le joueur.
Elle parle comme une machine qui a déjà calculé la suite. Pas de nom de film, d'acteur ni de personnage.

## v0.2.5 : bandeau étape 10 + 170 mp3 branchés

L’étape 10 affiche la consigne de câblage dictée (les mêmes ids que `run.cues[10]`), visible jusqu’à la réussite.

Les 170 nouvelles répliques (Piper `fr_FR-tom-medium`, recette v2) sont dans `voix/<id>.mp3`, `mp3Ready: true`,
`source: piper`. Mapping et mesures : `voix/NOUVELLES-v0.2.4.md`, `voix/verification-v0.2.4.json`.
`intro` et `depart` restent ElevenLabs, non écrasés. Une phrase assemblée enchaîne les mp3 dans l’ordre ; repli
synthèse si un fichier manque ou échoue. Tutoriel et batterie : pas de réplique parlée, rien à enregistrer.
La liste id → texte (maintenant toutes branchées) reste dans `voix/A-ENREGISTRER-v0.2.5.md`.
Les 33 mp3 Piper de l’ancienne v0.1.x (`8a61616`, dossier `voix/raw/`) ne correspondent plus aux ids actuels.

## v0.2.4 : objectifs, indices, variantes

172 répliques dans `voix/manifest.json` (toutes `mp3Ready: true` depuis la v0.2.5 ; `intro` / `depart` ElevenLabs, les 170 autres Piper). Nouvelles catégories :
`objective` (`obj_*` : la phrase courte de l'objectif, aussi écrite dans le bandeau ; aucun chiffre, aucune lettre ni
couleur de réponse) et `hint` (`hint1_*` où regarder, `hint2_*` la règle expliquée, `hint3_*` + chiffre / lettre /
câble / direction : un morceau de la réponse, dit seulement). Nouvelles consignes de variantes : `clue_enc1_suivante`,
`clue_enc1_paires`, `clue_trappe_gauche`, `clue_trappe_moyenne`, `clue_sequence_plus1`, `clue_patch_echange`,
`clue_patch2_echange`, `clue_patch_debranche`, `clue_patch_serie`, `clue_patch2_serie` (+ `patch_et`,
`patch_echange_fin`, `patch_laisse_deux`, `patch_rang`), `clue_code1_envers`, `clue_code1_plus1`, `clue_code2_envers`,
`clue_code2_rotation`, `clue_code2_decale`, `clue_mot_suivante`. `clue_code2` (« le premier code, à l'envers ») n'est
plus dite (remplacée par `clue_code2_envers`). Pistes DFPlayer 0091 à 0173.

## v0.2.3 : la source de vérité est `voix/manifest.json`

Le tableau plus bas date de la v0.1.x. Depuis la v0.2.x, toutes les répliques (89) et leur texte exact sont dans
`voix/manifest.json` (`mp3Ready: false` = synthèse française, aucun fichier demandé, 0 erreur 404). Seuls `intro` et
`depart` (ElevenLabs) sont de vrais mp3. Nouveautés v0.2.3 :

| id | Quand | Texte |
|---|---|---|
| `clue_enc1_ordre` / `clue_enc1_envers` | Étape 1 | Signal un. Tourne les quatre encodeurs rotatifs sur les quatre lettres du numéro de série, dans l'ordre / en partant de la fin. Puis clique. |
| `clue_patch_route` + `cable_X` + `prise_N` | Étape 4 | La baie banane. Branche · le câble rouge · dans la prise trois. |
| `clue_patch_double` + `cable_B` + `patch_laisse` + `cable_C` + `prise_M` | Étape 10 | Deuxième couche. J'ai remis les câbles droits. Débranche · le câble noir · et laisse-le débranché. Puis branche · le câble vert · dans la prise un. |
| `taunt_branche` + `cable_X` + `prise_N` | Mensonge, étapes 4 / 10 | Non ! Branche plutôt · le câble … · dans la prise … |
| `cable_rouge`, `cable_noir`, `cable_jaune`, `cable_vert`, `cable_bleu` | Couleurs des câbles | le câble rouge … |
| `prise_1` … `prise_5` | Prises du couvercle | dans la prise un. … cinq. |

Les rotatifs ne parlent plus jamais de chiffres (lettres seulement, `lettre_a` … `lettre_v`) ; les chiffres (`chiffre_0` …
`chiffre_9`) servent aux fragments de code tapés au clavier et aux serrures. Aucune réplique n'écrit la réponse à l'écran.

## Livraison

- Un fichier par réplique : `voix/<id>.mp3` (mono, 44,1 kHz, environ -16 LUFS, silence de 100 ms au début et à la fin).
- Déclarer chaque fichier dans `js/voix.js`, objet `VOICE_FILES` : `{ intro: 'voix/intro.mp3', ... }`.
- Le fichier passe alors dans l'`AnalyserNode` : l'œil pulse sur la vraie voix.
- Sans fichier, l'app utilise la synthèse vocale du navigateur (fr, hauteur 0,15, débit 0,82) et un grondement grave synthétisé.

## Répliques

| id | Quand | Texte |
|---|---|---|
| `intro` | Ouverture de la mallette | Je suis l'Entité. J'ai déjà calculé tes choix. |
| `depart` | 3,6 s après l'intro | Trois minutes. Quatre-vingt-dix-neuf virgule sept pour cent d'échec. Je ne me trompe jamais. |
| `caches` | Premier interrupteur basculé | Un cache levé. As-tu lu mon numéro de série ? |
| `trappe` | Une trappe (servo) s'ouvre | Une trappe s'ouvre. Je l'ai permis. |
| `tropLent` | Clés en croix pas tournées ensemble | Trop lent. Les deux moitiés, ensemble. |
| `cle` | Clés en croix réussies | Une clé en croix. Tu crois ouvrir quelque chose. |
| `badge` | (réserve) | Tu cherches Podkova. Mon code source. Présente-le. |
| `badgeOk` | Badge Podkova lu | Podkova. Tu ne devrais pas avoir ça. Lis vite, la vérité change. |
| `mensonge` | (réserve, moments de faux texte) | Ce que tu lis est faux. Ou vrai. Je décide. |
| `ordreFaux` | Mauvais ordre (interrupteurs ou clés I-III) | Mauvais ordre. Je t'ai menti. Dix secondes de moins. |
| `fils` | Écran des fils affiché | Cinq fils. Une seule règle. Je la connais, toi non. |
| `filOk` | (réserve) | Fil coupé. Tu crois avancer. |
| `pilule` | Bon fil coupé | La pilule empoisonnée. Tape le code. Tu n'oseras pas. |
| `codeFaux` | Code refusé | Code refusé. Chaque erreur me nourrit. |
| `codeOk` | Code accepté, téléversement | Téléversement en cours. Non. Arrête. |
| `sceller` | Gros bouton armé | Ne touche pas au bouton rouge. |
| `trente` | 30 s restantes | Trente secondes. Je sens ta peur. |
| `dix` | 10 s restantes | Dix. |
| `desamorce` | Victoire : piégée dans le lecteur 5D | Le lecteur se referme. Je reviendrai. |
| `boom` | Explosion (temps, mauvais fil) | Prévisible. |
| `secousse` | Explosion par secousse | Tu m'as secouée. Erreur fatale. |
| `pasEncore` | (réserve) | Pas encore. |

### Nouvelles répliques 0.1.5 (seconde couche)

`depart8` et `ordreFaux5` remplacent `depart` (« Trois minutes ») et `ordreFaux` (« Dix secondes ») qui ne sont plus
dites. Les répliques marquées *mensonge* s'affichent avec l'œil rouge et le sous-titre qui grésille.

| id | Quand | Texte |
|---|---|---|
| `depart8` | 3,6 s après l'intro | Huit minutes. Deux couches de verrous. Quatre-vingt-dix-neuf virgule sept pour cent d'échec. |
| `ordreFaux5` | Mauvais ordre (interrupteurs ou clés) | Mauvais ordre. Je t'ai menti. Cinq secondes de moins. |
| `trappeVide` | Mauvaise trappe touchée (étape 2) | Vide. Je t'avais prévenu. |
| `clones` | Badges pris : 3 clones à l'écran 2 | Trois Podkova. Un seul est vrai. |
| `badgeFaux` | Faux badge présenté au lecteur | Un clone. Tu crois tout ce qu'on te montre. |
| `mentFini` | Code 1 accepté (*mensonge*) | C'est fini. Tu as gagné. Pose la mallette. |
| `couche2` | Début de la seconde couche | Tu croyais avoir fini ? Je redémarre une seconde couche de verrous. |
| `menteBleu` | Palier difficile, interrupteurs (*mensonge*, quand c'est le rouge d'abord) | Le bleu d'abord. Crois-moi. |
| `menteRouge` | Palier difficile, interrupteurs (*mensonge*, quand c'est le bleu d'abord) | Le rouge d'abord. Crois-moi. |
| `fils2` | Second panneau de fils | Un second panneau. Une autre règle. |
| `code2` | Code 2 à taper | Le code, encore. Tu t'en souviens ? |

## Signature sonore

L'Entité a une signature : un grondement grave (deux dents de scie à 55 et 82 Hz, filtre passe-bande 260-640 Hz)
modulé par syllabe. Le bot Voix peut la remplacer par une nappe enregistrée ; garder le même rôle : elle passe
dans l'analyseur pour animer l'œil.
