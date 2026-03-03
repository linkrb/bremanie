# La Brémanie — Prompts Gemini

## Portraits de personnage (Fire Emblem style)

**Méthode** : uploader l'image de référence du personnage dans Gemini, puis utiliser ce prompt en changeant l'émotion.

```
Portrait de personnage style Fire Emblem, cadrage buste sur fond blanc uni,
même personnage que l'image de référence : [description courte du perso].
Expression : [ÉMOTION]. Même style graphique, même éclairage, même cadrage.
```

**8 émotions à générer par personnage :**
- `neutral`    — expression de base, calme
- `determined` — regard intense, résolu
- `worried`    — sourcils froncés, inquiet
- `angry`      — en colère, sourcils baissés
- `proud`      — satisfait, légèrement relevé
- `laughing`   — sourire franc, yeux plissés
- `sad`        — triste, regard baissé
- `surprised`  — yeux écarquillés, recul

**Après génération :**
1. Déposer les 8 PNG dans `temp/`
2. Traitement : `rembg` (fond transparent) + normalisation canvas 520×560 ancrage bas
3. Déposer dans `public/bremanie/images/[nom_perso]/neutral.png` etc.

---

## Personnages existants

| Clé | Nom | Description pour le prompt |
|-----|-----|---------------------------|
| `romain` | Romain | roi d'âge moyen, armure royale bleue et or, couronne, regard noble |
| `nathan` | Nathan | jeune garçon ~12 ans, tunique brune, cape bleue, épée, cheveux bruns |
| `anna` | Anna | jeune fille ~10 ans, tenue d'archère verte, carquois, cheveux attachés |
| `necromancien` | Le Nécromancien | robe violette déchirée avec runes, capuche noire, yeux violets incandescents, bâton torsadé cristal violet, orbe de foudre sombre |
| `suzanne` | Suzanne | cousine, amoureuse des animaux — à définir |

---

## Scènes / illustrations plein écran

```
Illustration plein écran style Fire Emblem / JRPG, format paysage 16:9,
[description de la scène]. Ambiance [mood]. Pas de texte ni d'interface.
```

Déposer dans `public/bremanie/images/scenes/`.
