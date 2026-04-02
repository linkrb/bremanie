# La Brémanie

Jeu narratif / tower defense en JavaScript vanilla, sans framework.

## Histoire

La Brémanie est un royaume en danger. Romain (le roi/père), Nathan (le fils/héros), Anna (l'archère), et Suzanne (la cousine) affrontent un nécromancien qui menace le royaume.

## Lancer le jeu

Ouvrir `prologue.html` dans un navigateur (serveur local recommandé).

**Paramètres de debug :**
```
?dev=chapter2      # sauter au chapitre 2
?dev=chapter2b     # chapitre 2b (Fort de l'Est)
?dev=chapter3      # chapitre 3
?dev=tutorial      # tutoriel combat
?dev=combat        # combat direct
```

## Structure

```
prologue.html        # point d'entrée
js/
  chapters/          # logique narrative par chapitre
  engine/            # TDEngine (tower defense)
dialogues/           # fichiers .txt des dialogues par chapitre
audio/               # musiques et effets sonores
images/              # sprites, tuiles, portraits
css/                 # styles
```

## Assets

- Portraits : 8 émotions par personnage, canvas 520×560, fond transparent
- Tuiles sol : 256×156 (vue top-down)
- Sprites ennemis/tours : 256×256
- Grands éléments décor : 256×352
