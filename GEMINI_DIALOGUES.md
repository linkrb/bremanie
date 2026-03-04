# Guide — Générer des dialogues pour La Brémanie avec Gemini

Ce document est le brief complet à donner à Gemini pour qu'il génère des scripts de dialogue
compatibles avec le moteur du jeu.

---

## Prompt à copier-coller dans Gemini

```
Tu vas écrire un script de dialogue pour le jeu La Brémanie.
C'est un jeu narratif style Fire Emblem : portraits de personnages, dialogues, narration.

### UNIVERS
Médiéval-fantastique français, ton grave mais accessible (public familial).
Romain est le roi/père, Nathan (8 ans) et Anna (12 ans) sont ses enfants.
Le nécromancien a corrompu Romain. Les enfants fuient vers l'Oncle David.

### PERSONNAGES DISPONIBLES
Chaque personnage a un portrait avec des émotions disponibles.
Tu dois utiliser UNIQUEMENT les clés exactes ci-dessous.

| Clé           | Nom affiché    | Émotions disponibles |
|---------------|----------------|----------------------|
| nathan        | Nathan         | neutral, determined, worried, angry, proud, laughing, sad, surprised |
| anna          | Anna           | neutral, determined, worried, angry, proud, laughing, sad, surprised |
| romain        | Romain         | neutral, determined, worried, angry, proud, laughing, sad, surprised |
| garde         | Garde          | neutral, determined, worried, angry, proud, laughing, sad, surprised |
| necromancien  | Nécromancien   | neutral, determined, worried, angry, proud, menacing, focused, disturbed |

⚠️ Le nécromancien n'a PAS : laughing, sad, surprised. Il a à la place : menacing, focused, disturbed.

### FONDS DISPONIBLES (images de scène)
Pour @scene ou @bg, utilise UNIQUEMENT ces chemins :

scenes/castle_bremanie.jpg        — château vu de l'extérieur, ciel dramatique
scenes/castle_hall.jpg            — grande salle du château, intacte
scenes/castle_hall_destroyed.jpg  — grande salle dévastée après le combat
scenes/castle_hall_empty.jpg      — grande salle vide, après la fuite
scenes/castle_siege.jpg           — château sous assaut, chaos extérieur
scenes/necromancer_castle.jpg     — le nécromancien dominant la salle du trône
scenes/family_embrace.jpg         — étreinte familiale, lumière dorée
scenes/chapter1_bg.jpg            — plaine nocturne, château en flammes au loin
scenes/chapter1_attack.jpg        — attaque de monstres dans la plaine
scenes/anna_bow.jpg               — Anna à l'arc dans la forêt
scenes/nathan_field.jpg           — Nathan seul dans la plaine
scenes/nathan_defend.jpg          — Nathan en posture de combat
scenes/nathan_awakening.jpg       — éveil des pouvoirs de Nathan (lumière bleue)
scenes/nathan_towers.jpg          — Nathan entouré de tours magiques
scenes/battle_aftermath.jpg       — après la bataille, ruines fumantes
scenes/forest.jpg                 — forêt enchantée, lumière verte tamisée

### FORMAT DU SCRIPT

Chaque ligne du fichier est soit :

1. Un commentaire (ignoré par le moteur) :
   # Ceci est un commentaire

2. Une directive (contrôle l'affichage) :
   @bg scenes/castle_hall.jpg          — change le fond, les portraits restent visibles
   @scene scenes/castle_siege.jpg      — cinématique : fond plein écran, portraits cachés
   @bgpos 30% top                      — position CSS du fond (ex: center, 50% 80%)
   @hide left                          — fait disparaître le portrait gauche
   @hide right                         — fait disparaître le portrait droit
   @music nom_de_piste                 — déclenche une musique (crossfade)
   @musicstop                          — arrête la musique progressivement
   @sfx nom_son                        — joue un son court (one-shot)
   @sfxloop nom_son                    — joue un son en boucle
   @sfxstop nom_son                    — arrête un son en boucle

3. Une narration (texte italique centré, sans portrait) :
   > Les ténèbres répondirent à l'appel du nécromancien.

4. Un dialogue de personnage :
   romain(left):worried Les éclaireurs n'ont renvoyé aucun signal.

   Format : personnage(côté):émotion Texte
   - côté = left ou right
   - Le côté est optionnel après la 1ère apparition du personnage (le moteur mémorise)
   - Pour changer un personnage de côté, reprécise-le : nathan(right):determined

### RÈGLES DE MISE EN SCÈNE

- Commence toujours par un @scene ou @bg pour poser le décor
- Utilise @scene pour les moments cinématiques (pas de dialogue dessus, que de la narration >)
- Utilise @bg quand les personnages parlent (portraits visibles)
- Alterne les émotions : ne mets jamais 3 lignes consécutives avec la même émotion
- Varie les côtés : en général 1 personnage à gauche, 1 à droite
- Les @hide servent à faire disparaître un personnage quand il quitte la scène
- Les lignes de narration > servent pour les ellipses temporelles ou les moments sans dialogue
- Ne dépasse pas 80 caractères par ligne de dialogue (public qui lit vite)
- Les enfants parlent simplement ; Romain parle avec autorité et émotion retenue

### SONS DISPONIBLES
Musiques (@music / @musicstop) :
  main_theme, prologue_siege, boss_entry, combat_theme, wind

Sons courts (@sfx) :
  title_sting, combat_sting, tower_place

Sons en boucle (@sfxloop / @sfxstop) :
  wind

### EXEMPLE DE SCRIPT BIEN FORMÉ

# Chapitre II — Après la forêt

@scene scenes/battle_aftermath.jpg
> La forêt était derrière eux.
> Mais le silence qui suivit le combat était plus lourd encore.

@bg scenes/forest.jpg

anna(right):worried Nathan... tu saignes.
nathan(left):proud Ce n'est rien. J'ai vu pire.
anna:angry Tu n'as jamais rien vu de pire, tu as huit ans.
nathan:laughing C'est vrai.

@hide right
@hide left
@scene scenes/forest.jpg
> Quelque part dans la forêt, un bruit de branches.
> Ils se figèrent.

anna(right):surprised Tu entends ça ?
nathan(left):determined Je suis prêt.

### CE QUE TU DOIS PRODUIRE

[Décris ici la scène que tu veux : personnages présents, moment dans l'histoire,
ce qui doit se passer émotionnellement, durée approximative (court = 6-8 lignes,
moyen = 12-16 lignes, long = 20+ lignes)]

Génère uniquement le contenu du fichier .txt, sans explication autour.
```

---

## Règles importantes à garder en tête

### Ne jamais inventer de clé inexistante
Si tu écris `romain:crying` ou `@bg scenes/prison.jpg`, le moteur affichera une image manquante
ou ignorera l'émotion. Utilise **uniquement** ce qui est listé ci-dessus.

### Le nécromancien a des émotions différentes
Il ne peut pas être `laughing`, `sad` ou `surprised`.
Ses émotions spéciales : `menacing` (menaçant), `focused` (concentré), `disturbed` (perturbé).

### Ordre des directives
Les directives s'appliquent à la ligne suivante. Mets toujours `@bg` ou `@scene` **avant**
la première ligne de dialogue ou de narration de ce décor.

### Positions du fond (@bgpos)
Quand le sujet d'une illustration n'est pas centré, ajuste avec `@bgpos` :
```
@bgpos 30% top       — sujet en haut à gauche
@bgpos center 40%    — sujet légèrement en haut au centre
@bgpos right center  — sujet à droite
```

---

## Structure des fichiers dans le projet

```
public/bremanie/dialogues/
├── prologue/
│   └── siege.txt
├── chapter1/
│   ├── intro.txt
│   ├── nathan_power.txt
│   ├── towers_appear.txt
│   └── tutorial_win.txt
└── chapter2/
    ├── intro.txt
    ├── wave1_clear.txt
    ├── wave2_clear.txt
    └── outro.txt
```

Nommage : `chapter{N}/nom_scene.txt` — tout en minuscules, underscores, pas d'espaces.

---

## Intégration dans le jeu

Une fois le fichier créé, il est appelé dans le code avec son chemin sans extension :

```javascript
showDialogue('chapter2/outro', () => { /* suite */ });
```

Le chemin est relatif à `public/bremanie/dialogues/`.
