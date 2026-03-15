// ============== CONFIGURATION ==============
export const TILE_WIDTH = 256;  // = largeur image tuile
export const TILE_HEIGHT = 312; // TH_face = TH/2 = 156px (= hauteur image) ; row advance = TH/4 = 78px
export const GRID_WIDTH = 4;
export const GRID_HEIGHT = 22;

export const TOWER_TYPES = {
    archer: { cost: 50,  damage: 20, range: 3,   cooldown: 750,  speed: 42, color: 0x98D4BB, displayScale: 1.8 },
    mage:   { cost: 75,  damage: 55, range: 2.5, cooldown: 2200, speed: 20, color: 0xAA66FF, displayScale: 1.8, splash: 1.0 },
    light:  { cost: 40,  damage: 0,  range: 2.5, cooldown: 999999, speed: 0, color: 0xFFD700, displayScale: 1.8, illuminates: true },
};

export const ENEMY_TYPES = {
    basic: { hp: 120, speed: 2.2, reward: 3, color: 0xFFB5C5, size: 0.75, anchorY: 0.65 },
    fast: { hp: 70, speed: 3.4, reward: 4, color: 0xFFD93D, size: 0.85, anchorY: 0.65 },
    tank: { hp: 400, speed: 1.2, reward: 10, color: 0x9B59B6, size: 0.95, anchorY: 0.65 },
    boss: { hp: 1400, speed: 0.9, reward: 40, color: 0xC0392B, size: 1.3, anchorY: 0.85 },
    flying:  { hp: 90,   speed: 2.7, reward: 5,   color: 0xBB88FF, size: 0.70, anchorY: 0.5,  flying: true },
    tornado:      { hp: 600, speed: 1.5, reward: 20, color: 0x88DDFF, size: 2.2, anchorY: 0.85, darkness: true },
    tornado_boss: { hp: 3500, speed: 1.0, reward: 300, color: 0x3399FF, size: 3.2, anchorY: 0.85, darkness: true }
};

// ============== LEVELS ==============
// All paths: x+y never decreases → path ALWAYS goes downward on screen (mirrored iso)
export const LEVELS = [
    {
        name: 'Prairie',
        theme: {
            id: 'prairie',
            tiles: { grass: 'tile_grass', corner: 'tile_corner', straight: 'tile_path_straight' },
            grassVariants: ['tile_grass', 'tile_grass', 'tile_rock', 'tile_rock', 'tile_rock2', 'tile_rock2'],
            decoTiles: [
                'deco/deco1', 'deco/deco1', 'deco/deco1',
                'deco/deco2', 'deco/deco2', 'deco/deco2',
                'deco/deco3', 'deco/deco3', 'deco/deco3',
            ],
            decoRate: 0.22,
            decorations: [],
            noCastle: true,
            enemyFolder: 'enemies/skeleton',
            enemies: {
                basic: ['enemy_basic_1','enemy_basic_2','enemy_basic_3','enemy_basic_4',
                        'enemy_basic_5','enemy_basic_6','enemy_basic_7',
                        'enemy_basic_9','enemy_basic_10','enemy_basic_12'],
                fast: 'enemy_fast',
                tank: 'enemy_tank',
                flying: 'enemy_flying',
                boss: 'enemy_boss'
            }
        },
        path: [
            // Règles staggered : pair→(col,y+1)ou(col-1,y+1) / impair→(col,y+1)ou(col+1,y+1)
            // Entrée haut-droite — 3 diagonales pures, 1 virage par inversion
            // Diagonale gauche col 3→0 (y 0→6)
            {x:3,y:0}, {x:2,y:1}, {x:2,y:2}, {x:1,y:3}, {x:1,y:4}, {x:0,y:5}, {x:0,y:6},
            // Virage → diagonale droite col 0→3 (y 6→12)
            {x:0,y:7}, {x:1,y:8}, {x:1,y:9}, {x:2,y:10}, {x:2,y:11}, {x:3,y:12},
            // Virage → diagonale gauche col 3→0 (y 12→18)
            {x:2,y:13}, {x:2,y:14}, {x:1,y:15}, {x:1,y:16}, {x:0,y:17}, {x:0,y:18},
            // Virage → descente finale (y 18→21)
            {x:0,y:19}, {x:1,y:20}, {x:1,y:21},
        ],
        waves: [
            [{ type: 'basic', count: 5 }],
            [{ type: 'basic', count: 9 }],
            [{ type: 'basic', count: 13 }],
            [{ type: 'basic', count: 18 }],
            [{ type: 'basic', count: 22 }],
            [{ type: 'basic', count: 28 }],
            [{ type: 'basic', count: 34 }],
            [{ type: 'basic', count: 40 }],
            [{ type: 'basic', count: 50 }],
            [{ type: 'basic', count: 65 }],
        ]
    },
    {
        name: 'Cimetière',
        theme: {
            id: 'cemetery',
            castleScale: 2.0,
            tileScale: 0.68,
            towerScale: 0.85,
            enemyScale: 0.85,
            enemyScales: { tank: 1.3, boss: 1.4 },
            tiles: { grass: 'tile_grass', corner: 'tile_corner', straight: 'tile_path_straight' },
            decorations: [
                { name: 'tombstone', scale: 0.6, anchorY: 0.9 },
                { name: 'dead_tree', scale: 1.2, anchorY: 0.9 },
                { name: 'lamppost', scale: 0.95, anchorY: 0.9 }
            ],
            decoRate: 0.20,
            enemies: {
                basic: 'enemy_basic',
                fast: 'enemy_fast',
                tank: 'enemy_tank',
                flying: 'enemy_flying',
                boss: 'enemy_boss'
            }
        },
        path: [
            {x:6,y:0},
            {x:6,y:1}, {x:6,y:2},
            {x:5,y:2}, {x:4,y:2}, {x:3,y:2}, {x:2,y:2}, {x:1,y:2}, {x:0,y:2},
            {x:0,y:3}, {x:0,y:4}, {x:0,y:5},
            {x:1,y:5}, {x:2,y:5}, {x:3,y:5}, {x:4,y:5}, {x:5,y:5}, {x:6,y:5},
            {x:6,y:6}, {x:6,y:7}, {x:6,y:8},
            {x:5,y:8}, {x:4,y:8}, {x:3,y:8}, {x:2,y:8}, {x:1,y:8}, {x:0,y:8},
            {x:0,y:9}, {x:0,y:10}, {x:0,y:11}
        ],
        waves: [
            [{ type: 'basic', count: 6 }, { type: 'fast', count: 3 }],
            [{ type: 'basic', count: 9 }, { type: 'fast', count: 4 }],
            [{ type: 'basic', count: 12 }, { type: 'fast', count: 5 }],
            [{ type: 'tank', count: 3 }, { type: 'fast', count: 5 }],
            [{ type: 'basic', count: 10 }, { type: 'fast', count: 7 }, { type: 'tank', count: 3 }],
            [{ type: 'flying', count: 8 }, { type: 'fast', count: 10 }, { type: 'tank', count: 4 }],
            [{ type: 'basic', count: 14 }, { type: 'tank', count: 7 }, { type: 'flying', count: 6 }],
            [{ type: 'fast', count: 20 }, { type: 'flying', count: 12 }, { type: 'tank', count: 5 }],
            [{ type: 'tank', count: 10 }, { type: 'fast', count: 18 }, { type: 'flying', count: 8 }],
            [{ type: 'boss', count: 2 }, { type: 'tank', count: 8 }, { type: 'fast', count: 16 }, { type: 'flying', count: 10 }],
        ]
    },
    {
        name: 'Volcan',
        theme: {
            id: 'volcano',
            castleScale: 2.0,
            tileScale: 0.75,
            towerScale: 0.85,
            enemyScale: 0.85,
            enemyScales: { tank: 1.3, boss: 1.4 },
            tiles: { grass: 'tile_grass', corner: 'tile_corner', straight: 'tile_path_straight' },
            decorations: [
                { name: 'geyser', scale: 0.7, anchorY: 0.9 },
                { name: 'fire_tree', scale: 0.75, anchorY: 0.9 },
                { name: 'lamppost', scale: 0.95, anchorY: 0.9 }
            ],
            decoRate: 0.20,
            enemies: {
                basic: 'enemy_basic',
                fast: 'enemy_fast',
                tank: 'enemy_tank',
                flying: 'enemy_flying',
                boss: 'enemy_boss'
            }
        },
        path: [
            {x:3,y:0}, {x:3,y:1}, {x:3,y:2},
            { fork: [
                [{x:3,y:3},{x:2,y:3},{x:1,y:3},{x:0,y:3},{x:0,y:4},{x:0,y:5},{x:0,y:6},{x:0,y:7},{x:1,y:7},{x:2,y:7},{x:3,y:7}],
                [{x:3,y:3},{x:4,y:3},{x:5,y:3},{x:6,y:3},{x:6,y:4},{x:6,y:5},{x:6,y:6},{x:6,y:7},{x:5,y:7},{x:4,y:7},{x:3,y:7}]
            ]},
            {x:3,y:8}, {x:3,y:9}, {x:3,y:10}, {x:3,y:11}
        ],
        waves: [
            [{ type: 'basic', count: 8 }, { type: 'fast', count: 4 }],
            [{ type: 'fast', count: 10 }, { type: 'basic', count: 8 }],
            [{ type: 'tank', count: 3 }, { type: 'basic', count: 10 }, { type: 'fast', count: 3 }],
            [{ type: 'tank', count: 5 }, { type: 'fast', count: 8 }],
            [{ type: 'basic', count: 12 }, { type: 'fast', count: 10 }, { type: 'tank', count: 5 }],
            [{ type: 'flying', count: 10 }, { type: 'tank', count: 7 }, { type: 'fast', count: 10 }],
            [{ type: 'basic', count: 18 }, { type: 'fast', count: 14 }, { type: 'flying', count: 8 }, { type: 'tank', count: 5 }],
            [{ type: 'fast', count: 22 }, { type: 'flying', count: 14 }, { type: 'tank', count: 7 }],
            [{ type: 'tank', count: 13 }, { type: 'fast', count: 20 }, { type: 'flying', count: 11 }],
            [{ type: 'boss', count: 3 }, { type: 'tank', count: 11 }, { type: 'fast', count: 18 }, { type: 'flying', count: 13 }],
        ]
    },
    {
        name: 'Forêt',
        theme: {
            id: 'forest',
            noCastle: true,
            enemyScale: 1.4,
            enemyScales: { basic: 0.75, fast: 0.8, tank: 1.2, boss: 2.0 },
            spriteScales: { enemy_fox: 0.7, enemy_boar: 1.0 },
            enemyAnchors: { basic: 0.88, fast: 0.88, tank: 0.88, boss: 0.88 },
            tiles: { grass: 'tile_grass', corner: 'tile_corner', straight: 'tile_path_straight' },
            decoTiles: [
                // Buissons (priorité × 3)
                'deco/bush_01', 'deco/bush_01', 'deco/bush_01',
                'deco/bush_02', 'deco/bush_02', 'deco/bush_02',
                'deco/bush_03', 'deco/bush_03',
                'deco/bush_04', 'deco/bush_04',
                'deco/bush_05', 'deco/bush_05',
                'deco/bush_06',
                'deco/bush_07',
                // Décos basses (fichiers à ajouter dans forest/deco/)
                // 'deco/stump_fern', 'deco/stump', 'deco/mushroom', 'deco/flowers',
                // Arbres (rare — 1 entrée chacun)
                'deco/arbre01',
                'deco/arbre02',
            ],
            grassVariants: [
                // Herbe simple (poids ×4)
                'tile_grass_01', 'tile_grass_01', 'tile_grass_01', 'tile_grass_01',
                'tile_grass_02', 'tile_grass_02', 'tile_grass_02',
                'tile_grass_03', 'tile_grass_03', 'tile_grass_03',
                'tile_grass_04', 'tile_grass_04',
                'tile_grass_05', 'tile_grass_05',
                'tile_grass_06', 'tile_grass_06',
                // Patchs sol / vignes (rare)
                'tile_patch_01', 'tile_vines_01',
                // Fleurs (très rare)
                'tile_flower_01', 'tile_flower_03',
                // Champignons
                'tile_fungi_01',
            ],
            decorations: [],
            decoRate: 0.22,
            enemies: {
                basic: ['enemy_fox', 'enemy_boar'],
                fast:  'enemy_wolf',
                tank:  'enemy_bear',
                flying:'enemy_flying',
                boss:  'enemy_bear'
            }
        },
        path: [
            // Règles d'adjacence staggered : paire→(col,y+1)ou(col-1,y+1) / impaire→(col,y+1)ou(col+1,y+1)
            // Diagonale droite col 0 → col 3 (y 0→6)
            {x:0,y:0},  // pair  → (0,1)
            {x:0,y:1},  // impair → (1,2)
            {x:1,y:2},  // pair  → (1,3)
            {x:1,y:3},  // impair → (2,4)
            {x:2,y:4},  // pair  → (2,5)
            {x:2,y:5},  // impair → (3,6)
            {x:3,y:6},  // bord droit — pair → (2,7)
            // Diagonale gauche col 3 → col 0 (y 6→12)
            {x:2,y:7},  // impair → (2,8)
            {x:2,y:8},  // pair  → (1,9)
            {x:1,y:9},  // impair → (1,10)
            {x:1,y:10}, // pair  → (0,11)
            {x:0,y:11}, // impair → (0,12)
            {x:0,y:12}, // bord gauche — pair → (0,13)
            // Diagonale droite col 0 → col 3 (y 12→18)
            {x:0,y:13}, // impair → (1,14)
            {x:1,y:14}, // pair  → (1,15)
            {x:1,y:15}, // impair → (2,16)
            {x:2,y:16}, // pair  → (2,17)
            {x:2,y:17}, // impair → (3,18)
            {x:3,y:18}, // bord droit — pair → (2,19)
            // Diagonale gauche → fort (y 18→21)
            {x:2,y:19}, // impair → (2,20)
            {x:2,y:20}, // pair  → (1,21)
            {x:1,y:21}, // fort
        ],
        waves: [
            [{ type: 'basic', count: 8 }],
            [{ type: 'basic', count: 10 }, { type: 'fast', count: 6 }],
            [{ type: 'basic', count: 12 }, { type: 'fast', count: 8 }],
            [{ type: 'basic', count: 8 }, { type: 'fast', count: 6 }, { type: 'tank', count: 1 }],
        ]
    },
    {
        name: 'Glacier',
        theme: {
            id: 'ice',
            castleScale: 2.0,
            castleAnchorY: 0.75,
            tileScale: 0.85,
            towerScale: 0.85,
            enemyScale: 1.2,
            enemyScales: { tank: 1.2, boss: 1.0 },
            tiles: { grass: 'tile_grass', corner: 'tile_corner', straight: 'tile_path_straight' },
            decorations: [
                { name: 'snowy_tree', scale: 1.5, anchorY: 0.75 },
                { name: 'snowy_tree', scale: 1.3, anchorY: 0.75 },
                { name: 'ice_portal', scale: 1.0, anchorY: 0.75 }
            ],
            decoRate: 0.20,
            enemies: {
                basic:  'enemy_basic',
                fast:   'enemy_fast',
                tank:   'enemy_tank',
                flying: 'enemy_flying',
                boss:   'enemy_boss'
            }
        },
        path: [
            {x:0, y:0}, {x:0, y:1}, {x:0, y:2},
            {x:1, y:2}, {x:2, y:2}, {x:3, y:2}, {x:4, y:2}, {x:5, y:2}, {x:6, y:2},
            {x:6, y:3}, {x:6, y:4}, {x:6, y:5},
            {x:5, y:5}, {x:4, y:5}, {x:3, y:5}, {x:2, y:5}, {x:1, y:5}, {x:0, y:5},
            {x:0, y:6}, {x:0, y:7}, {x:0, y:8},
            {x:1, y:8}, {x:2, y:8}, {x:3, y:8}, {x:4, y:8}, {x:5, y:8}, {x:6, y:8},
            {x:6, y:9}, {x:6, y:10}, {x:6, y:11}
        ],
        waves: [
            [{ type: 'basic', count: 10 }, { type: 'fast', count: 5 }],
            [{ type: 'fast', count: 12 }, { type: 'basic', count: 10 }],
            [{ type: 'tank', count: 4 }, { type: 'basic', count: 10 }, { type: 'fast', count: 4 }],
            [{ type: 'flying', count: 8 }, { type: 'fast', count: 10 }],
            [{ type: 'basic', count: 14 }, { type: 'tank', count: 6 }, { type: 'fast', count: 9 }],
            [{ type: 'flying', count: 12 }, { type: 'fast', count: 12 }, { type: 'tank', count: 5 }],
            [{ type: 'tank', count: 10 }, { type: 'flying', count: 11 }, { type: 'fast', count: 13 }],
            [{ type: 'fast', count: 24 }, { type: 'flying', count: 15 }, { type: 'tank', count: 7 }],
            [{ type: 'tank', count: 14 }, { type: 'fast', count: 20 }, { type: 'flying', count: 12 }],
            [{ type: 'boss', count: 3 }, { type: 'tank', count: 12 }, { type: 'flying', count: 15 }, { type: 'fast', count: 18 }],
        ]
    },
    // ── Chapitre III : Fort de l'Est (index 5) — archer + mage débloquée ──
    {
        name: "Fort de l'Est",
        theme: {
            id: 'forest',
            noCastle: true,
            enemyScale: 1.4,
            enemyScales: { basic: 0.75, fast: 0.8, tank: 1.2, boss: 2.0 },
            spriteScales: { enemy_fox: 0.7, enemy_boar: 1.0 },
            enemyAnchors: { basic: 0.88, fast: 0.88, tank: 0.88, boss: 0.88 },
            tiles: { grass: 'tile_grass', corner: 'tile_corner', straight: 'tile_path_straight' },
            decoTiles: [
                'deco/bush_01', 'deco/bush_01', 'deco/bush_01',
                'deco/bush_02', 'deco/bush_02', 'deco/bush_02',
                'deco/bush_03', 'deco/bush_03',
                'deco/bush_04', 'deco/bush_04',
                'deco/bush_05', 'deco/bush_05',
                'deco/bush_06', 'deco/bush_07',
                'deco/arbre01', 'deco/arbre02',
            ],
            grassVariants: [
                'tile_grass_01', 'tile_grass_01', 'tile_grass_01', 'tile_grass_01',
                'tile_grass_02', 'tile_grass_02', 'tile_grass_03', 'tile_grass_03',
                'tile_grass_04', 'tile_grass_05', 'tile_grass_06',
                'tile_patch_01', 'tile_vines_01', 'tile_flower_01', 'tile_fungi_01',
            ],
            decorations: [],
            decoRate: 0.22,
            enemies: {
                basic: ['enemy_fox', 'enemy_boar'],
                fast:  'enemy_wolf',
                tank:  'enemy_bear',
                flying:'enemy_flying',
                boss:  'enemy_bear'
            }
        },
        path: [
            {x:0,y:0},  {x:0,y:1},  {x:1,y:2},  {x:1,y:3},  {x:2,y:4},  {x:2,y:5},  {x:3,y:6},
            {x:2,y:7},  {x:2,y:8},  {x:1,y:9},  {x:1,y:10}, {x:0,y:11}, {x:0,y:12},
            {x:0,y:13}, {x:1,y:14}, {x:1,y:15}, {x:2,y:16}, {x:2,y:17}, {x:3,y:18},
            {x:2,y:19}, {x:2,y:20}, {x:1,y:21},
        ],
        waves: [
            [{ type: 'basic', count: 10 }],
            [{ type: 'basic', count: 14 }, { type: 'fast', count: 8 }],
            [{ type: 'basic', count: 16 }, { type: 'fast', count: 12 }],
            [{ type: 'basic', count: 18 }, { type: 'fast', count: 14 }, { type: 'tank', count: 2 }],
            [{ type: 'basic', count: 20 }, { type: 'fast', count: 16 }, { type: 'tank', count: 3 }],
            [{ type: 'basic', count: 12 }, { type: 'fast', count: 10 }, { type: 'tank', count: 3 }, { type: 'boss', count: 1 }],
        ]
    },
    // ── Chapitre III : Château (index 6) — combat final, archer + mage ──
    {
        name: 'Château',
        theme: {
            id: 'castle',
            bgColor: 0x000000,
            castleScale: 1.8,
            castleAnchorY: 0.75,
            enemyFolder: 'enemies/skeleton',
            enemies: {
                basic:   ['enemy_basic_1','enemy_basic_2','enemy_basic_3','enemy_basic_4',
                          'enemy_basic_5','enemy_basic_6','enemy_basic_7',
                          'enemy_basic_9','enemy_basic_10','enemy_basic_12'],
                fast:    'enemy_basic_3',
                tank:    'enemy_basic_9',
                boss:    'enemy_basic_12',
                tornado:      'enemy_tornado',
                tornado_boss: 'enemy_tornado',
            },
            tiles: { grass: 'tile_path', corner: 'tile_corner', straight: 'tile_path_straight' },
            decoTiles: [
                'deco/ball',    'deco/ball',    'deco/ball',    'deco/ball',
                'deco/item',    'deco/item',    'deco/item',
                'deco/armor',   'deco/armor',   'deco/armor',
                'deco/castle',  'deco/castle',
            ],
            decorations: [],
            decoRate: 0.35,
        },
        path: [
            // Diagonale gauche : col 3→0 (y 0→6)
            {x:3,y:0}, {x:2,y:1}, {x:2,y:2}, {x:1,y:3}, {x:1,y:4}, {x:0,y:5}, {x:0,y:6},
            // Virage → diagonale droite (y 6→12)
            {x:0,y:7}, {x:1,y:8}, {x:1,y:9}, {x:2,y:10}, {x:2,y:11}, {x:3,y:12},
            // Virage → diagonale gauche (y 12→18)
            {x:2,y:13}, {x:2,y:14}, {x:1,y:15}, {x:1,y:16}, {x:0,y:17}, {x:0,y:18},
            // Descente finale (y 18→21)
            {x:0,y:19}, {x:1,y:20}, {x:1,y:21},
        ],
        waves: [
            // Vague 1 : éclaireurs squelettes
            [{ type: 'basic', count: 8 }],
            // Vague 2 : squelettes + archers rapides
            [{ type: 'basic', count: 12 }, { type: 'fast', count: 6 }],
            // Vague 3 : gardes armés (tank) entrent en jeu
            [{ type: 'basic', count: 14 }, { type: 'fast', count: 8 }, { type: 'tank', count: 3 }],
            // Vague 4 : assaut massif
            [{ type: 'basic', count: 16 }, { type: 'fast', count: 12 }, { type: 'tank', count: 5 }],
            // Vague 5 : boss squelette + gardes lourds
            [{ type: 'boss', count: 1 }, { type: 'tank', count: 6 }, { type: 'basic', count: 10 }, { type: 'fast', count: 8 }],
        ]
    },
    // ── Chapitre III : Château Final (après dialogue post_tornado) ──
    {
        name: 'Château Final',
        theme: {
            id: 'castle',
            bgColor: 0x000000,
            enemyFolder: 'enemies/skeleton',
            enemies: {
                basic:   ['enemy_basic_1','enemy_basic_2','enemy_basic_3','enemy_basic_4',
                          'enemy_basic_5','enemy_basic_6','enemy_basic_7',
                          'enemy_basic_9','enemy_basic_10','enemy_basic_12'],
                fast:    'enemy_basic_3',
                tank:    'enemy_basic_9',
                boss:    'enemy_basic_12',
                tornado:      'enemy_tornado',
                tornado_boss: 'enemy_tornado',
            },
            tiles: { grass: 'tile_path', corner: 'tile_corner', straight: 'tile_path_straight' },
            decoTiles: [
                'deco/ball',    'deco/ball',    'deco/ball',    'deco/ball',
                'deco/item',    'deco/item',    'deco/item',
                'deco/armor',   'deco/armor',   'deco/armor',
                'deco/castle',  'deco/castle',
            ],
            decorations: [],
            decoRate: 0.35,
        },
        path: [
            {x:3,y:0}, {x:2,y:1}, {x:2,y:2}, {x:1,y:3}, {x:1,y:4}, {x:0,y:5}, {x:0,y:6},
            {x:0,y:7}, {x:1,y:8}, {x:1,y:9}, {x:2,y:10}, {x:2,y:11}, {x:3,y:12},
            {x:2,y:13}, {x:2,y:14}, {x:1,y:15}, {x:1,y:16}, {x:0,y:17}, {x:0,y:18},
            {x:0,y:19}, {x:1,y:20}, {x:1,y:21},
        ],
        waves: [
            [{ type: 'tornado', count: 1 }, { type: 'basic', count: 6 }, { type: 'fast', count: 3 }, { type: 'tank', count: 1 }],
            [{ type: 'tornado', count: 1 }, { type: 'basic', count: 8 }, { type: 'fast', count: 4 }, { type: 'tank', count: 2 }],
            [{ type: 'tornado', count: 1 }, { type: 'basic', count: 10 }, { type: 'fast', count: 5 }, { type: 'tank', count: 2 }],
            [{ type: 'tornado', count: 1, position: 'start' }, { type: 'basic', count: 12 }, { type: 'fast', count: 6 }, { type: 'tank', count: 3 }, { type: 'tornado', count: 1 }],
            [{ type: 'tornado', count: 2, position: 'start' }, { type: 'basic', count: 15 }, { type: 'fast', count: 8 }, { type: 'tank', count: 4 }, { type: 'tornado', count: 1 }],
            [{ type: 'tornado', count: 1, position: 'start' }, { type: 'basic', count: 20 }, { type: 'fast', count: 12 }, { type: 'tank', count: 6 }, { type: 'tornado_boss', count: 1 }],
        ]
    },
    // ── Chapitre III : Château Boss (1 tornado, même carte que Château) ──
    {
        name: 'Château Boss',
        theme: {
            id: 'castle',  // partage les assets du niveau Château
            bgColor: 0x000000,
            enemyFolder: 'enemies/skeleton',
            enemies: {
                basic:   ['enemy_basic_1','enemy_basic_2','enemy_basic_3','enemy_basic_4',
                          'enemy_basic_5','enemy_basic_6','enemy_basic_7',
                          'enemy_basic_9','enemy_basic_10','enemy_basic_12'],
                fast:    'enemy_basic_3',
                tank:    'enemy_basic_9',
                boss:    'enemy_basic_12',
                tornado:      'enemy_tornado',
                tornado_boss: 'enemy_tornado',
            },
            tiles: { grass: 'tile_path', corner: 'tile_corner', straight: 'tile_path_straight' },
            decoTiles: [
                'deco/ball',    'deco/ball',    'deco/ball',    'deco/ball',
                'deco/item',    'deco/item',    'deco/item',
                'deco/armor',   'deco/armor',   'deco/armor',
                'deco/castle',  'deco/castle',
            ],
            decorations: [],
            decoRate: 0.35,
        },
        path: [
            {x:3,y:0}, {x:2,y:1}, {x:2,y:2}, {x:1,y:3}, {x:1,y:4}, {x:0,y:5}, {x:0,y:6},
            {x:0,y:7}, {x:1,y:8}, {x:1,y:9}, {x:2,y:10}, {x:2,y:11}, {x:3,y:12},
            {x:2,y:13}, {x:2,y:14}, {x:1,y:15}, {x:1,y:16}, {x:0,y:17}, {x:0,y:18},
            {x:0,y:19}, {x:1,y:20}, {x:1,y:21},
        ],
        waves: [
            [{ type: 'tornado', count: 1 }, { type: 'basic', count: 4 }, { type: 'fast', count: 2 }],
        ]
    },
];

// Resolve a path with potential forks into concrete routes and flat tile list
export function resolvePaths(path) {
    // Separate segments into: prefix points, fork object, suffix points
    const points = [];    // simple {x,y} before any fork
    const forks = [];     // fork objects in order
    const segments = [];  // ordered list: { type:'points', data:[...] } | { type:'fork', data:[[...],[...]] }

    for (const seg of path) {
        if (seg.fork) {
            if (points.length > 0) {
                segments.push({ type: 'points', data: [...points] });
                points.length = 0;
            }
            segments.push({ type: 'fork', data: seg.fork });
        } else {
            points.push(seg);
        }
    }
    if (points.length > 0) {
        segments.push({ type: 'points', data: points });
    }

    // Build routes by expanding forks (cartesian product of all fork branches)
    let routes = [[]];
    for (const seg of segments) {
        if (seg.type === 'points') {
            routes = routes.map(r => [...r, ...seg.data]);
        } else {
            const newRoutes = [];
            for (const route of routes) {
                for (const branch of seg.data) {
                    newRoutes.push([...route, ...branch]);
                }
            }
            routes = newRoutes;
        }
    }

    // allTiles: flatten all segments (all branches included)
    const allTiles = [];
    const seen = new Set();
    for (const seg of segments) {
        const lists = seg.type === 'points' ? [seg.data] : seg.data;
        for (const list of lists) {
            for (const p of list) {
                const key = `${p.x},${p.y}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    allTiles.push(p);
                }
            }
        }
    }

    return { routes, allTiles };
}

// Backward-compatible aliases (level 0)
export const PATH = LEVELS[0].path;
export const WAVES = LEVELS[0].waves;

// ============== GLOBAL WAVE PROGRESSION ==============
// 40 waves total across 4 levels (10 per level).
// Difficulty is continuous: globalWave never resets between levels.
// Each tier starts easier than the previous tier ended ("gear shift")
// so the player can rebuild towers after the level transition.
//
// Tier 1 (waves 0-9):  easy intro → moderate
// Tier 2 (waves 10-19): gear shift down → ramps to hard
// Tier 3 (waves 20-29): gear shift down → ramps to very hard
// Tier 4 (waves 30-39): gear shift down → brutal finale
export const GLOBAL_WAVES = [
    // === TIER 1 (waves 1-10) ===
    /* 00 */ [{ type: 'basic', count: 5 }],
    /* 01 */ [{ type: 'basic', count: 8 }],
    /* 02 */ [{ type: 'basic', count: 5 }, { type: 'fast', count: 4 }],
    /* 03 */ [{ type: 'basic', count: 8 }, { type: 'tank', count: 2 }],
    /* 04 */ [{ type: 'basic', count: 6 }, { type: 'fast', count: 5 }, { type: 'tank', count: 2 }],
    /* 05 */ [{ type: 'fast', count: 12 }, { type: 'flying', count: 4 }, { type: 'tank', count: 3 }],
    /* 06 */ [{ type: 'basic', count: 15 }, { type: 'fast', count: 8 }, { type: 'flying', count: 5 }, { type: 'tank', count: 3 }],
    /* 07 */ [{ type: 'fast', count: 18 }, { type: 'flying', count: 10 }, { type: 'tank', count: 4 }],
    /* 08 */ [{ type: 'tank', count: 8 }, { type: 'fast', count: 15 }, { type: 'flying', count: 6 }],
    /* 09 */ [{ type: 'boss', count: 2 }, { type: 'tank', count: 6 }, { type: 'fast', count: 12 }, { type: 'flying', count: 8 }],

    // === TIER 2 (waves 11-20) — gear shift: starts ~wave 3 difficulty ===
    /* 10 */ [{ type: 'basic', count: 5 }, { type: 'fast', count: 3 }],
    /* 11 */ [{ type: 'basic', count: 8 }, { type: 'fast', count: 4 }],
    /* 12 */ [{ type: 'basic', count: 7 }, { type: 'fast', count: 5 }, { type: 'tank', count: 2 }],
    /* 13 */ [{ type: 'tank', count: 3 }, { type: 'fast', count: 6 }, { type: 'basic', count: 5 }],
    /* 14 */ [{ type: 'basic', count: 12 }, { type: 'fast', count: 10 }, { type: 'tank', count: 5 }],
    /* 15 */ [{ type: 'flying', count: 10 }, { type: 'fast', count: 12 }, { type: 'tank', count: 6 }],
    /* 16 */ [{ type: 'basic', count: 18 }, { type: 'fast', count: 14 }, { type: 'flying', count: 8 }, { type: 'tank', count: 6 }],
    /* 17 */ [{ type: 'fast', count: 22 }, { type: 'flying', count: 14 }, { type: 'tank', count: 8 }],
    /* 18 */ [{ type: 'tank', count: 13 }, { type: 'fast', count: 20 }, { type: 'flying', count: 10 }],
    /* 19 */ [{ type: 'boss', count: 2 }, { type: 'tank', count: 11 }, { type: 'fast', count: 18 }, { type: 'flying', count: 12 }],

    // === TIER 3 (waves 21-30) — gear shift: starts ~wave 4 difficulty ===
    /* 20 */ [{ type: 'basic', count: 8 }, { type: 'fast', count: 6 }, { type: 'tank', count: 2 }],
    /* 21 */ [{ type: 'basic', count: 12 }, { type: 'fast', count: 8 }, { type: 'tank', count: 3 }],
    /* 22 */ [{ type: 'tank', count: 5 }, { type: 'fast', count: 10 }, { type: 'basic', count: 10 }],
    /* 23 */ [{ type: 'tank', count: 7 }, { type: 'fast', count: 12 }, { type: 'flying', count: 6 }],
    /* 24 */ [{ type: 'basic', count: 15 }, { type: 'fast', count: 15 }, { type: 'tank', count: 8 }],
    /* 25 */ [{ type: 'flying', count: 14 }, { type: 'tank', count: 11 }, { type: 'fast', count: 14 }],
    /* 26 */ [{ type: 'basic', count: 22 }, { type: 'fast', count: 18 }, { type: 'flying', count: 12 }, { type: 'tank', count: 8 }],
    /* 27 */ [{ type: 'fast', count: 28 }, { type: 'flying', count: 18 }, { type: 'tank', count: 11 }],
    /* 28 */ [{ type: 'tank', count: 16 }, { type: 'fast', count: 24 }, { type: 'flying', count: 14 }],
    /* 29 */ [{ type: 'boss', count: 3 }, { type: 'tank', count: 13 }, { type: 'fast', count: 22 }, { type: 'flying', count: 16 }],

    // === TIER 4 (waves 31-40) — gear shift: starts ~wave 5 difficulty ===
    /* 30 */ [{ type: 'basic', count: 10 }, { type: 'fast', count: 8 }, { type: 'tank', count: 3 }],
    /* 31 */ [{ type: 'basic', count: 14 }, { type: 'fast', count: 12 }, { type: 'tank', count: 5 }],
    /* 32 */ [{ type: 'tank', count: 8 }, { type: 'fast', count: 14 }, { type: 'flying', count: 8 }, { type: 'basic', count: 8 }],
    /* 33 */ [{ type: 'tank', count: 10 }, { type: 'fast', count: 16 }, { type: 'flying', count: 10 }],
    /* 34 */ [{ type: 'basic', count: 20 }, { type: 'fast', count: 20 }, { type: 'tank', count: 11 }],
    /* 35 */ [{ type: 'flying', count: 18 }, { type: 'tank', count: 13 }, { type: 'fast', count: 18 }],
    /* 36 */ [{ type: 'basic', count: 26 }, { type: 'fast', count: 24 }, { type: 'flying', count: 16 }, { type: 'tank', count: 12 }],
    /* 37 */ [{ type: 'fast', count: 32 }, { type: 'flying', count: 22 }, { type: 'tank', count: 15 }],
    /* 38 */ [{ type: 'tank', count: 20 }, { type: 'fast', count: 28 }, { type: 'flying', count: 18 }],
    /* 39 */ [{ type: 'boss', count: 4 }, { type: 'tank', count: 16 }, { type: 'fast', count: 26 }, { type: 'flying', count: 20 }],
];

export const TOWER_DISPLAY = {
    archer:   { icon: '🏹', name: 'Archer',    unlockName: null },
    mage:     { icon: '🔮', name: 'Mage',      unlockName: null },
    light:    { icon: '💡', name: 'Lumière',   unlockName: null },
    cannon:   { icon: '💣', name: 'Canon',     unlockName: null },
    ice:      { icon: '❄️', name: 'Glace',     unlockName: 'Tour de Glace' },
    sniper:   { icon: '🎯', name: 'Sniper',    unlockName: null },
    cemetery: { icon: '👻', name: 'Fantôme',   unlockName: 'Tour Fantôme' },
    wind:     { icon: '🌀', name: 'Eolienne',  unlockName: 'Tour Éolienne' },
    fire:     { icon: '🔥', name: 'Feu',       unlockName: 'Tour de Feu' },
};

export const SHOP_ITEMS = {
    heart: { cost: 50, name: '+1 Vie' },
    repair: { cost: 150, name: 'Repair +5' },
    nuke: { cost: 250, name: 'Nuke' },
    damage: { cost: 100, name: 'Rage' },
    slow: { cost: 80, name: 'Blizzard' }
};

// ============== STAGGERED ISO HELPERS ==============
// Projection staggered iso avec emboîtement : row advance = TH/4 = TH_face/2
// Les losanges s'emboîtent parfaitement (la moitié basse d'une rangée recouvre la moitié haute de la suivante).
// Convention renderer : sprite.x = iso.x, sprite.y = iso.y + TILE_HEIGHT/2 = row * TILE_HEIGHT/4
export function toIso(col, row) {
    // Stagger interpolé : pour les positions fractionnaires (ennemis en mouvement),
    // on interpole linéairement entre le décalage de la rangée courante et suivante.
    // Pour les entiers, comportement identique à (row & 1) * TW/2.
    const floorRow = Math.floor(row);
    const frac     = row - floorRow;
    const stagger  = (floorRow % 2 === 0 ? frac : 1 - frac) * (TILE_WIDTH / 2);
    return {
        x: col * TILE_WIDTH + stagger + TILE_WIDTH / 2,
        y: row * (TILE_HEIGHT / 4) - TILE_HEIGHT / 2,
    };
}

// Inverse : (screenX,screenY) → cellule grille (x=col, y=row)
// ly = sprite.y dans le layer = row * TH/4
export function fromIso(screenX, screenY, offsetX, offsetY, scale = 1) {
    const lx = (screenX - offsetX) / scale;
    const ly = (screenY - offsetY) / scale;
    const row = Math.round(ly * 4 / TILE_HEIGHT);
    const col = Math.round((lx - TILE_WIDTH / 2 - (row & 1) * (TILE_WIDTH / 2)) / TILE_WIDTH);
    return { x: col, y: row };
}
