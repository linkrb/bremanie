# CLAUDE.md — La Brémanie

Règles et contexte pour travailler sur ce projet.

## Architecture

- Jeu JS vanilla, aucun framework, aucun build tool
- Entry point : `prologue.html`
- Vue top-down 90° (PAS isométrique — `toIso()` dans `tdConfig.js` est mal nommée, c'est juste une grille rectangulaire droite)
- `js/chapters/` : logique narrative chapitre par chapitre
- `js/engine/` : TDEngine (tower defense)
- `dialogues/` : fichiers `.txt` des dialogues

## Règles anti-régression chapitres

### wireCallbacks : toujours chaîner, jamais écraser

Quand plusieurs chapitres assignent le même callback, sauvegarder le précédent :

```js
const _prev = game.onWaveCompleted;
game.onWaveCompleted = (waveNumber) => {
    _prev?.(waveNumber);        // laisser les chapitres précédents traiter en premier
    if (game._monMode) { ... }  // puis logique du chapitre courant
};
```

### _preload() : autonome par chapitre

Chaque chapitre preloade TOUTES ses pistes audio, même si un chapitre précédent les charge déjà. Ne jamais supposer qu'un chapitre antérieur a été joué (`?dev=chapter3` doit fonctionner seul).

### showLevelTransition : couvrir tous les modes

`TDEngine.onLevelComplete` est appelé quand le niveau N'EST PAS le dernier de LEVELS. Chaque mode combat non-final doit être géré dans `showLevelTransition`. Vérifier l'index dans LEVELS à chaque nouveau mode.

## Modes combat (nomenclature)

| Flag | Nom | Index LEVELS |
|------|-----|-------------|
| `_chapter2Mode` | Forêt Enchantée | — |
| `_fortMode` | Fort de l'Est | — |
| `_chateauMode` | Château phase 1 | — |
| `_chateauBossMode` | Château boss tornado | 8 (dernier → showVictory) |
| `_chateauFinalMode` | Château combat final | — |

## Dimensions assets

| Type | Dimensions |
|------|-----------|
| Tuiles sol (`tile_grass`, `tile_path`…) | 256×156 |
| decoTiles buissons/objets | 256×~192–220 (ratio conservé) |
| decoTiles arbres/grands éléments | 256×352 |
| Sprites ennemis/tours | 256×256 |

Ne jamais écraser en 256×256 carré un asset originellement plus large que haut.

Structure thème niveau (prairie/forêt) : `decorations` = `[]`, `decoTiles` = images avec sol baked-in, pas de `castleScale`/`tileScale`.

## Portraits personnages

- 8 émotions : neutral, determined, worried, angry, proud, laughing, sad, surprised
- Canvas normalisé 520×560, ancrage bas, fond transparent (rembg)
- Miroir CSS `scaleX(-1)` sur les deux côtés (tous les persos regardent naturellement à gauche)
- Prompts Gemini détaillés dans `PROMPTS.md`

## Détourage sprites ennemis

- Fond uni contrasté → MCP `mcp__detoureur__remove_background`
- Objet sombre sur fond sombre → `rembg u2net` (Python)
- Formes fines + sombres (armes, hampes) → `rembg birefnet-general`
- Flip : regarder l'image d'abord. Objectif : tous les ennemis regardent à droite.
