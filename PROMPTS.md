# La Brémanie — Prompts Gemini

## Portraits de personnage (Fire Emblem style)

**Méthode** : uploader l'image de référence du personnage dans Gemini si disponible, sinon décrire directement.

### Template de base

```
Portrait de personnage style Fire Emblem, cadrage buste trois quarts,
[DESCRIPTION DU PERSONNAGE].
Illustration 2D style anime semi-réaliste, fond beige parchemin neutre,
trait net et propre, lumière dorée douce. Même personnage, même tenue,
seule l'expression change.

---
Les 8 variantes

[1 - neutre]     → regard posé et calme, légèrement de côté, expression sereine,
                   lèvres fermées, sourcils détendus

[2 - déterminé]  → mâchoire serrée, regard acéré vers l'horizon, sourcils
                   légèrement froncés vers le centre, posture droite et rigide

[3 - inquiet]    → sourcils relevés et froncés, regard fuyant vers le bas,
                   main portée légèrement vers la poitrine, tension visible

[4 - en colère]  → regard dur et fixe, sourcils baissés et serrés, lèvres
                   pincées, muscles de la mâchoire contractés, posture tendue

[5 - fier]       → léger sourire en coin, regard chaleureux vers la gauche,
                   poitrine légèrement en avant, posture détendue et ouverte

[6 - riant]      → rire franc, yeux plissés, bouche légèrement ouverte,
                   tête très légèrement inclinée, rides de rire aux yeux

[7 - triste]     → regard baissé, sourcils relevés, sourire douloureux et
                   retenu, légère tension dans les épaules

[8 - surpris]    → yeux écarquillés, sourcils très hauts, bouche entrouverte,
                   léger recul de la tête vers l'arrière
```

---

## Personnages existants

### Romain (père/roi)
```
Le Roi de Brémanie : cheveux bruns courts, courte barbe taillée,
armure royale bleue ornée d'or, cape rouge, tient une épée élégante.
```

### Nathan (fils)
```
Jeune garçon d'environ 12 ans, héros de Brémanie : cheveux bruns en bataille,
tunique brune et cuir, épaulières légères, cape bleue, épée courte au côté.
```

### Anna (fille/archère)
```
Jeune fille d'environ 10 ans, archère de Brémanie : cheveux châtains attachés,
tenue de voyage verte et marron, carquois dans le dos, arc à la main.
```

### Nécromancien (grand méchant)
```
Le Nécromancien de Brémanie : silhouette encapuchonnée en robe violette déchirée
ornée de runes sombres, visage invisible sous la capuche noire, yeux violets
incandescents, bâton torsadé surmonté d'un cristal violet, orbe de foudre sombre
dans l'autre main.
```

### Suzanne (cousine, à générer)
```
[À compléter selon les assets générés]
```

---

## Traitement après génération
1. Déposer les PNG dans `temp/`
2. `rembg` pour fond transparent
3. Normalisation canvas 520×560 ancrage bas (script Python)
4. Déposer dans `public/bremanie/images/[nom_perso]/neutral.png` etc.

---

## Scènes / illustrations plein écran

```
Illustration plein écran style Fire Emblem / JRPG, format paysage 16:9,
[description de la scène]. Ambiance [mood]. Pas de texte ni d'interface.
```

Déposer dans `public/bremanie/images/scenes/`.
