# Dialogues de La Brémanie — Guide d'écriture

## Structure des fichiers

```
dialogues/
├── prologue/
│   └── intro.txt
├── level1/
│   ├── intro.txt       ← avant le niveau
│   └── outro.txt       ← après victoire
├── level2/
│   ├── intro.txt
│   └── outro.txt
├── level3/ ...
└── level4/ ...
```

Chaque scène = un fichier `.txt`. Un fichier = une séquence de lignes jouées dans l'ordre.

---

## Format du script

### Commentaires
Les lignes commençant par `#` sont ignorées.
```
# Ceci est un commentaire
```

---

### Changer le fond (avec persos visibles)
```
@bg scenes/anna_bow.png
```
Le fond change mais les portraits restent affichés.

---

### Mode cinématique (sans persos)
```
@scene scenes/nathan_field.png
```
Les portraits disparaissent, le fond occupe tout l'écran. Parfait pour les **grands moments scénaristiques**.

---

### Narration (texte sans visage)
```
> Les ténèbres répondirent à l'appel du nécromancien.
> Pour la première fois en vingt ans, le Roi eut peur.
```
Texte italique centré, sans namebox. S'utilise après un `@scene` ou un `@bg`.

---

### Dialogue normal
```
romain(left):worried Les éclaireurs n'ont renvoyé aucun signal...
anna(right):determined J'ai vu des ombres vers la forêt de l'Est.
```

**Format :** `personnage(côté):émotion Texte du dialogue`

- Le **côté** (`left` ou `right`) est optionnel après la 1ère apparition.
  Le moteur le mémorise automatiquement.
- Si le personnage change de côté, précise-le à nouveau.

---

## Personnages disponibles

| Clé      | Nom affiché | Couleur namebox |
|----------|-------------|-----------------|
| `romain` | Romain      | Bleu royal      |
| `anna`   | Anna        | Rouge           |
| `nathan` | Nathan      | Or              |

---

## Émotions disponibles

| Clé          | Description                        |
|--------------|------------------------------------|
| `neutral`    | Expression par défaut, posée       |
| `determined` | Regard acéré, mâchoire serrée      |
| `worried`    | Sourcils froncés, tension visible  |
| `angry`      | Regard dur, posture tendue         |
| `proud`      | Léger sourire, poitrine en avant   |
| `laughing`   | Rire franc, yeux plissés           |
| `sad`        | Regard baissé, sourire douloureux  |
| `surprised`  | Yeux écarquillés, bouche ouverte   |

---

## Exemple complet

```
# Prologue — L'Ombre du Nécromancien

@bg scenes/anna_bow.png

romain(left):worried Les éclaireurs n'ont renvoyé aucun signal...
anna(right):determined J'ai vu des ombres. Ce n'étaient pas des animaux.
romain:angry Le nécromancien. Il ose approcher de nos frontières.
anna:worried Père... Nathan est parti seul inspecter le col de Cendre.
romain:surprised Quoi ?!
anna:sad Il voulait te protéger.
romain:determined Prépare les défenses. Je pars le chercher.
anna:laughing Cette fois tu ne peux pas me dire non !
romain:laughing Tu ressembles tellement à ta mère...

@scene scenes/nathan_field.png
> Quelque part dans les plaines de Brémanie, un jeune homme marchait seul.
> Il ne savait pas encore que son père était déjà en chemin.
> Et que les ténèbres, elles, n'attendraient pas.

romain(left):worried Nathan...
```

---

## Jouer une scène depuis le jeu

```js
// Joue la scène et appelle le callback quand c'est fini
await engine.load('prologue/intro', () => startGame());
await engine.load('level1/intro',   () => startLevel(1));
await engine.load('level2/outro',   () => showWorldmap());
```

---

## Touches / Gestes

| Action           | Effet                                      |
|------------------|--------------------------------------------|
| **Tap / Clic**   | Avance au dialogue suivant                 |
| **Tap / Clic**   | Si typewriter en cours → affiche tout      |
| **Espace / Entrée / →** | Idem (clavier)                    |
