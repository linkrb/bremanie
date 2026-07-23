import {
    TILE_WIDTH, TILE_HEIGHT, GRID_WIDTH, GRID_HEIGHT,
    TOWER_TYPES, ENEMY_TYPES, LEVELS, toIso
} from './tdConfig.js';

export class TDRenderer {
    constructor() {
        this.app = null;
        this.assets = {};
        this._loadedThemeIds = new Set();
        this.tileSprites = [];
        this.tileMap = {};
        this.groundLayer = null;
        this.rangeLayer = null;
        this.entityLayer = null;
        this.projectileLayer = null;
        this.effectLayer = null;
        this.offsetX = 0;
        this.offsetY = 0;
        this.mapScale = 1;
        this.particles = [];
        this.graspEffects = [];
        this.ghostSprite = null;
        this.ghostType = null;
        this.ghostOrientation = null;
        this.treeSprites = [];
        this.currentTheme = null;
        this._litTiles = null;        // null = pas d'obscurité ; Set "x,y" = cases éclairées
        this._lightingTweenFn = null; // tween de transition lumière/obscurité
        // Système héros
        this.onHeroClick = null;
        this.onAllyImpact = null;      // () — allié qui touche le sol (chute) ou décolle (départ)
        this._suzanneSprite = null;
        this._suzanneGridX = 0;
        this._suzanneGridY = 0;
        this._heroChargeBar = null;
        this._heroAura = null;
        this._suzanneBaseScaleX = 0;
        this._suzanneBaseScaleY = 0;
    }

    async init(container) {
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.app = new PIXI.Application();
        await this.app.init({
            width,
            height,
            backgroundColor: 0x000000, // neutre — jamais visible (alpha 0), évite tout voile teinté
            backgroundAlpha: 0,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        container.insertBefore(this.app.canvas, container.firstChild);

        await this.loadAssets();

        this.groundLayer = new PIXI.Container();
        this.rangeLayer = new PIXI.Container();
        this.entityLayer = new PIXI.Container();
        this.projectileLayer = new PIXI.Container();
        this.effectLayer = new PIXI.Container();
        this.debugLayer = new PIXI.Container();

        this.app.stage.addChild(this.groundLayer);
        this.app.stage.addChild(this.rangeLayer);
        this.app.stage.addChild(this.entityLayer);
        this.app.stage.addChild(this.projectileLayer);
        this.app.stage.addChild(this.effectLayer);
        this.app.stage.addChild(this.debugLayer);

        this.debugGrid = false; // activé via toggleDebugGrid()

        this.calculateOffset();
    }

    calculateOffset() {
        // Bounding box staggered iso avec emboîtement (row advance = TH/4 = TH_face/2)
        // Largeur : GRID_WIDTH tuiles + demi-tuile de décalage (rangées impaires)
        // Hauteur : gridH rangées × TH/4 (advance) + TH/2 (marge : demi-losange haut+bas)
        const gridH = this._gridHeight ?? GRID_HEIGHT;
        const mapWidth  = GRID_WIDTH * TILE_WIDTH + TILE_WIDTH / 2;
        const mapHeight = gridH * (TILE_HEIGHT / 4) + TILE_HEIGHT / 2;

        const pad = this.app.screen.width < 600 ? 4 : 10;
        const scaleX = (this.app.screen.width  - pad * 2) / mapWidth;
        const scaleY = (this.app.screen.height - pad * 2) / mapHeight;
        this.mapScale = Math.min(scaleX, scaleY, 1.5);

        // Centrage horizontal simple (pas de décalage isoOriginX)
        this.offsetX = (this.app.screen.width  - mapWidth  * this.mapScale) / 2;

        // Centrage vertical : la grille va de sprite.y=0 (row 0) à sprite.y=(GH-1)*TH/4 (last row)
        const gridCenterY = ((gridH - 1) / 2) * (TILE_HEIGHT / 4);
        // Les decoTiles de la rangée 0 montent jusqu'à ~180px au-dessus de l'origine du layer.
        // offsetY doit être suffisamment grand pour qu'ils restent dans le canvas.
        const DECO_TOP_PAD = 180;
        this.offsetY = this.currentTheme?.pinTop
            // pinTop : grille ancrée en haut du canvas (marge mini pour les décos de la rangée 0)
            ? DECO_TOP_PAD * this.mapScale
            : Math.max(
                this.app.screen.height / 2 - gridCenterY * this.mapScale,
                DECO_TOP_PAD * this.mapScale
            );

        [this.groundLayer, this.rangeLayer, this.entityLayer, this.projectileLayer, this.effectLayer, this.debugLayer].forEach(layer => {
            layer.x = this.offsetX;
            layer.y = this.offsetY;
            layer.scale.set(this.mapScale);
        });
    }

    toggleCleanView() {
        this._cleanView = !this._cleanView;
        const hide = this._cleanView;
        this.entityLayer.visible    = !hide;
        this.projectileLayer.visible = !hide;
        this.effectLayer.visible    = !hide;
        // Décos groundLayer (pas les tuiles)
        this.groundLayer.children.forEach(child => {
            if (child._isDecoration) child.visible = !hide;
        });
    }

    toggleDebugGrid(pathCells) {
        this.debugGrid = !this.debugGrid;
        this.debugLayer.removeChildren();
        if (!this.debugGrid) return;

        const g = new PIXI.Graphics();
        // Grille complète
        for (let x = 0; x <= GRID_WIDTH; x++) {
            g.moveTo(x * TILE_WIDTH, 0);
            g.lineTo(x * TILE_WIDTH, GRID_HEIGHT * TILE_HEIGHT);
        }
        for (let y = 0; y <= GRID_HEIGHT; y++) {
            g.moveTo(0, y * TILE_HEIGHT);
            g.lineTo(GRID_WIDTH * TILE_WIDTH, y * TILE_HEIGHT);
        }
        g.stroke({ width: 1, color: 0xff4444, alpha: 0.6 });

        // Numéros de colonnes / lignes
        for (let x = 0; x < GRID_WIDTH; x++) {
            for (let y = 0; y < GRID_HEIGHT; y++) {
                const lbl = new PIXI.Text({
                    text: `${x},${y}`,
                    style: { fontSize: 9, fill: 0xffffff, stroke: { color: 0x000000, width: 2 } }
                });
                lbl.x = x * TILE_WIDTH + 2;
                lbl.y = y * TILE_HEIGHT + 2;
                this.debugLayer.addChild(lbl);
            }
        }

        // Cellules du chemin en surbrillance
        if (pathCells) {
            for (const { x, y } of pathCells) {
                g.rect(x * TILE_WIDTH + 2, y * TILE_HEIGHT + 2, TILE_WIDTH - 4, TILE_HEIGHT - 4);
                g.fill({ color: 0x00ff88, alpha: 0.25 });
            }
        }

        this.debugLayer.addChild(g);
    }

    handleResize(container) {
        this.app.renderer.resize(container.clientWidth, container.clientHeight);
        this.calculateOffset();
        this.app.stage.hitArea = this.app.screen;
    }

    async loadAssets() {

        // Idle spritesheets pour tours animées — liste explicite des fichiers existants
        const towerIdleSheets = [
            ['archer',     'side'],
            ['mage',       'side'],
            ['light',      'left'],
            ['fauconnier', 'side'],
            ['archer',     'side', 'ch5'],
            ['mage',       'side', 'ch5'],
            // Tours quiz ch5+ — spritesheets chargées si le fichier existe
            ['ice',    'side', 'ch5'],
            ['cannon', 'side', 'ch5'],
            ['fire',   'side', 'ch5'],
        ];
        for (const [type, variant, suffix] of towerIdleSheets) {
            const filename = suffix
                ? `tower_${type}_${variant}_idle_${suffix}.png`
                : `tower_${type}_${variant}_idle.png`;
            const key = suffix
                ? `tower_${type}_${variant}_idle_${suffix}_frames`
                : `tower_${type}_${variant}_idle_frames`;
            try {
                const sheet = await PIXI.Assets.load(`/images/td/towers/${type}/${filename}`);
                const frameCount = Math.round(sheet.width / sheet.height);
                const fw = Math.floor(sheet.width / frameCount);
                this.assets[key] = Array.from({ length: frameCount }, (_, i) =>
                    new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                );
            } catch (e) { }
        }

        // Stun cloud (effet banshee — global)
        if (!this.assets['stun_cloud_frames']) {
            try {
                const sheet = await PIXI.Assets.load('/images/td/stun_cloud.png');
                const fw = sheet.width / 8;
                this.assets['stun_cloud_frames'] = Array.from({ length: 8 }, (_, i) =>
                    new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                );
            } catch (e) { }
        }

        // Fallbacks globaux
        for (const name of ['tile_grass', 'castle', 'tree', 'tree_pine',
                            'coin', 'heart', 'proj_archer', 'proj_fauconnier',
                            'proj_ice', 'proj_cannon', 'proj_fire',
                            'proj_fire_fast', 'proj_fire_balanced', 'proj_fire_slow',
                            'proj_ice_fast', 'proj_ice_balanced', 'proj_ice_slow',
                            'proj_cannon_fast', 'proj_cannon_balanced', 'proj_cannon_slow']) {
            try {
                const texture = await PIXI.Assets.load(`/images/td/${name}.png`);
                this.assets[name] = texture;
            } catch (e) { }
        }

        // Projectiles animés (convention : proj_{type}_anim.png, spritesheet carré)
        for (const type of ['fauconnier']) {
            try {
                const sheet = await PIXI.Assets.load(`/images/td/proj_${type}_anim.png`);
                const frameCount = Math.round(sheet.width / sheet.height);
                const fw = Math.floor(sheet.width / frameCount);
                this.assets[`proj_${type}_anim_frames`] = Array.from({ length: frameCount }, (_, i) =>
                    new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                );
            } catch (e) { }
        }

        // Personnage Suzanne + Martin
        for (const [key, file] of [
            ['suzanne_idle_frames',   'suzanne_idle.png'],
            ['suzanne_attack_frames', 'suzanne_attack_sheet.png'],
            ['trap_placing_frames',    'martin/martin_trap.png'],
        ]) {
            try {
                const sheet = await PIXI.Assets.load(`/images/td/characters/${file}`);
                const frameCount = Math.round(sheet.width / sheet.height);
                const fw = Math.floor(sheet.width / frameCount);
                this.assets[key] = Array.from({ length: frameCount }, (_, i) =>
                    new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                );
            } catch (e) { }
        }

    }

    async _ensureThemeLoaded(levelData) {
        const theme = levelData?.theme;
        if (!theme) return;
        const themeId = theme.id;
        if (this._loadedThemeIds.has(themeId)) return;
        this._loadedThemeIds.add(themeId);

        const basePath = `/images/td/levels/${themeId}`;

        // Tiles
        for (const tileKey of Object.values(theme.tiles || {})) {
            try {
                this.assets[`${tileKey}_${themeId}`] = await PIXI.Assets.load(`${basePath}/${tileKey}.png`);
            } catch (e) { }
        }

        // Decorations
        for (const deco of (theme.decorations || [])) {
            const name = typeof deco === 'string' ? deco : deco.name;
            try {
                this.assets[`${name}_${themeId}`] = await PIXI.Assets.load(`${basePath}/${name}.png`);
            } catch (e) { }
        }

        // Deco tiles
        for (const tileName of [...new Set((theme.decoTiles || []).map(d => typeof d === 'string' ? d : d.name))]) {
            const key = `${tileName}_${themeId}`;
            if (this.assets[key]) continue;
            try {
                this.assets[key] = await PIXI.Assets.load(`${basePath}/${tileName}.png`);
            } catch (e) { }
            // Variante animée : uniquement si listée dans theme.animatedDecoTiles (évite les 404)
            if (theme.animatedDecoTiles?.includes(tileName)) {
                try {
                    const sheet = await PIXI.Assets.load(`${basePath}/${tileName}_sheet.png`);
                    const n  = Math.round(sheet.width / sheet.height);
                    const fw = sheet.width / n;
                    this.assets[`${tileName}_frames_${themeId}`] = Array.from({ length: n }, (_, i) =>
                        new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                    );
                } catch (e) { }
            }
        }

        // Grass variants
        for (const v of [...new Set(theme.grassVariants || [])]) {
            const key = `${v}_${themeId}`;
            if (this.assets[key]) continue;
            try {
                this.assets[key] = await PIXI.Assets.load(`${basePath}/grass/${v}.png`);
            } catch (e) { }
        }

        // Castle
        if (!theme.noCastle) {
            try {
                this.assets[`castle_${themeId}`] = await PIXI.Assets.load(`${basePath}/castle.png`);
            } catch (e) { }
        }

        // Alliés décoratifs posés sur des tuiles (ex. Nathan/David ch7) + poussière d'impact
        for (const ally of (theme.allies || [])) {
            const key = `ally_${ally.name}_${themeId}`;
            if (this.assets[`${key}_frames`]) continue;
            try {
                const sheet = await PIXI.Assets.load(`${basePath}/hero_${ally.name}_sheet.png`);
                const n  = Math.round(sheet.width / sheet.height);
                const fw = sheet.width / n;
                this.assets[`${key}_frames`] = Array.from({ length: n }, (_, i) =>
                    new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                );
            } catch (e) { }
        }
        if (theme.allies?.length && !this.assets[`impact_dust_${themeId}`]) {
            try {
                this.assets[`impact_dust_${themeId}`] = await PIXI.Assets.load(`${basePath}/impact_dust.png`);
            } catch (e) { }
        }
        if (theme.allies?.length && !this.assets[`claymore_${themeId}`]) {
            try {
                this.assets[`claymore_${themeId}`] = await PIXI.Assets.load(`${basePath}/claymore.png`);
            } catch (e) { }
            // Dragon en vol (raid aérien) — spritesheet
            try {
                const ds = await PIXI.Assets.load(`${basePath}/dragon_fly_sheet.png`);
                const n = Math.round(ds.width / ds.height), fw = ds.width / n;
                this.assets[`dragon_fly_frames_${themeId}`] = Array.from({ length: n }, (_, i) =>
                    new PIXI.Texture({ source: ds.source, frame: new PIXI.Rectangle(i * fw, 0, fw, ds.height) })
                );
            } catch (e) { }
            // Nuage de poussière (tour détruite par le dragon) — spritesheet animée
            try {
                const dc = await PIXI.Assets.load(`${basePath}/dust_cloud_sheet.png`);
                const n = Math.round(dc.width / dc.height), fw = dc.width / n;
                this.assets[`dust_cloud_frames_${themeId}`] = Array.from({ length: n }, (_, i) =>
                    new PIXI.Texture({ source: dc.source, frame: new PIXI.Rectangle(i * fw, 0, fw, dc.height) })
                );
            } catch (e) { }
            // David de dos qui lève son épée (pouvoir) — spritesheet optionnelle
            try {
                const sh = await PIXI.Assets.load(`${basePath}/hero_david_raise_sheet.png`);
                const n  = Math.round(sh.width / sh.height), fw = sh.width / n;
                this.assets[`david_raise_frames_${themeId}`] = Array.from({ length: n }, (_, i) =>
                    new PIXI.Texture({ source: sh.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sh.height) })
                );
            } catch (e) { }
        }

        // Boss posé sur la première tuile de chemin (ex. Romain possédé ch7)
        if (theme.spawnBoss) {
            try {
                this.assets[`${theme.spawnBoss}_${themeId}`] = await PIXI.Assets.load(`${basePath}/${theme.spawnBoss}.png`);
            } catch (e) { }
            // Spritesheets du boss : idle (_sheet), invocation (_summon_sheet), + VFX mains (summon_hands)
            const _loadSheet = async (file, key) => {
                try {
                    const sheet = await PIXI.Assets.load(`${basePath}/${file}.png`);
                    const n  = Math.round(sheet.width / sheet.height);
                    const fw = sheet.width / n;
                    this.assets[key] = Array.from({ length: n }, (_, i) =>
                        new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                    );
                } catch (e) { }
            };
            await _loadSheet(`${theme.spawnBoss}_sheet`,        `${theme.spawnBoss}_frames_${themeId}`);
            await _loadSheet(`${theme.spawnBoss}_summon_sheet`, `${theme.spawnBoss}_summon_frames_${themeId}`);
            await _loadSheet('summon_hands_sheet',              `summon_hands_frames_${themeId}`);
        }

        // Scene background
        if (theme.sceneBg) {
            try {
                this.assets[`sceneBg_${themeId}`] = await PIXI.Assets.load(`${basePath}/${theme.sceneBg}.png`);
            } catch (e) { }
        }

        // Trap tile (piège Martin — ch6, night_forest uniquement)
        if (themeId === 'night_forest' && !this.assets['trap_tile_night_forest']) {
            try {
                this.assets['trap_tile_night_forest'] = await PIXI.Assets.load(`${basePath}/trap_tile.png`);
            } catch (e) { }
        }

        // Fire burst effect (déclenchement piège — ch6)
        if (themeId === 'night_forest' && !this.assets['fire_burst_frames']) {
            try {
                const sheet = await PIXI.Assets.load(`${basePath}/fire_burst.png`);
                const fw = sheet.width / 8;
                this.assets['fire_burst_frames'] = Array.from({ length: 8 }, (_, i) =>
                    new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                );
            } catch (e) { }
        }

        // Enemies — spritesheet animé (_walk_right.png) uniquement
        const enemyBasePath = theme.enemyFolder ? `/images/td/${theme.enemyFolder}` : basePath;
        for (const enemyAsset of Object.values(theme.enemies || {})) {
            for (const name of (Array.isArray(enemyAsset) ? enemyAsset : [enemyAsset])) {
                const key = `${name}_${themeId}`;
                const animKey = `${key}_anim_frames`;
                if (!this.assets[animKey]) {
                    try {
                        const sheet = await PIXI.Assets.load(`${enemyBasePath}/${name}_walk_right.png`);
                        const frameCount = Math.round(sheet.width / sheet.height);
                        const fw = Math.floor(sheet.width / frameCount);
                        this.assets[animKey] = Array.from({ length: frameCount }, (_, i) =>
                            new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                        );
                    } catch (e) { }
                }
            }
        }

        // Banshee scream — animation stun
        if (theme.enemies?.banshee && !this.assets['banshee_scream_frames']) {
            try {
                const sheet = await PIXI.Assets.load(`${enemyBasePath}/enemy_banshee_scream.png`);
                const fw = sheet.width / 8;
                this.assets['banshee_scream_frames'] = Array.from({ length: 8 }, (_, i) =>
                    new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(i * fw, 0, fw, sheet.height) })
                );
            } catch (e) { }
        }
    }

    async setTheme(levelData) {
        this.currentTheme = levelData?.theme || null;
        this._gridHeight  = levelData?.gridHeight ?? GRID_HEIGHT;
        const bg = this.currentTheme?.bgColor;
        if (bg !== undefined) {
            this.app.renderer.background.color = bg;
            this.app.renderer.background.alpha = 1;
        } else {
            this.app.renderer.background.alpha = 0;
        }
        await this._ensureThemeLoaded(levelData);
    }

    clearStage() {
        // Remove all children from layers
        this.groundLayer.removeChildren();
        this.entityLayer.removeChildren();
        this.projectileLayer.removeChildren();
        this.effectLayer.removeChildren();
        this.rangeLayer.removeChildren();

        // Reset héros
        this._suzanneSprite = null;
        this._heroChargeBar = null;
        this._heroAura      = null;

        // Reset pièges Martin
        this._trapSprites = {};

        // Remove fullscreen flash overlays added directly to app.stage
        const layers = new Set([this.groundLayer, this.rangeLayer, this.entityLayer,
                                 this.projectileLayer, this.effectLayer, this.debugLayer]);
        for (const child of [...this.app.stage.children]) {
            if (!layers.has(child)) this.app.stage.removeChild(child);
        }

        // Reset tracking arrays
        this.tileSprites = [];
        this.tileMap = {};
        this.particles = [];
        this.graspEffects = [];
        this.treeSprites = [];

        // Réinitialiser l'éclairage
        if (this._lightingTweenFn) {
            this.app.ticker.remove(this._lightingTweenFn);
            this._lightingTweenFn = null;
        }
        this._litTiles = null;

        // Clean up ghost tower
        if (this.ghostSprite) {
            this.ghostSprite.destroy({ children: true });
            this.ghostSprite = null;
            this.ghostType = null;
            this.ghostOrientation = null;
        }
    }

    // ── Lighting system ──────────────────────────────────────────
    // litTiles = null  → pas d'obscurité, toutes les tuiles à tint normal
    // litTiles = Set   → seules ces cases "x,y" sont éclairées ; les autres tintées sombre

    _lerpColor(a, b, t) {
        const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
        const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
        return (Math.round(ar + (br - ar) * t) << 16)
             | (Math.round(ag + (bg - ag) * t) << 8)
             |  Math.round(ab + (bb - ab) * t);
    }

    setTileLighting(litTiles, durationMs = 1200) {
        this._litTiles = litTiles;
        const DARK = 0x334477;

        // Collecter les transitions nécessaires (tuiles + décorations)
        const transitions = [];
        for (const [key, tile] of Object.entries(this.tileMap)) {
            const target = (!litTiles || litTiles.has(key)) ? (tile.originalTint ?? 0xffffff) : DARK;
            if (tile.tint !== target) transitions.push({ sprite: tile, from: tile.tint, to: target });
        }
        for (const child of this.groundLayer.children) {
            if (child._isDecoration) {
                const target = litTiles ? DARK : 0xffffff;
                if (child.tint !== target) transitions.push({ sprite: child, from: child.tint, to: target });
            }
        }
        if (!transitions.length) return;

        if (this._lightingTweenFn) this.app.ticker.remove(this._lightingTweenFn);

        const startTime = performance.now();
        this._lightingTweenFn = () => {
            const t = Math.min((performance.now() - startTime) / durationMs, 1);
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            for (const { sprite, from, to } of transitions) {
                sprite.tint = this._lerpColor(from, to, ease);
            }
            if (t >= 1) {
                this.app.ticker.remove(this._lightingTweenFn);
                this._lightingTweenFn = null;
            }
        };
        this.app.ticker.add(this._lightingTweenFn);
    }

    _getThemedAsset(baseName) {
        if (this.currentTheme) {
            const themed = this.assets[`${baseName}_${this.currentTheme.id}`];
            if (themed) return themed;
        }
        return this.assets[baseName] || null;
    }

    _getDecorationEntries() {
        if (this.currentTheme) {
            const entries = [];
            for (const deco of this.currentTheme.decorations) {
                const name = typeof deco === 'string' ? deco : deco.name;
                const scale = typeof deco === 'object' ? deco.scale : 1.0;
                const anchorY = typeof deco === 'object' ? deco.anchorY : 0.85;
                const noWind = typeof deco === 'object' ? !!deco.noWind : false;
                const isWindmill = name.includes('windmill');
                const tex = this._getThemedAsset(name) || this.assets[name];
                if (tex) entries.push({ tex, scale, anchorY, noWind, _isWindmill: isWindmill });
            }
            if (entries.length > 0) return entries;
            // decorations explicitement vide → pas de fallback
            if (this.currentTheme.decorations.length === 0) return [];
        }
        // Fallback: use base tree assets (pas de thème)
        const fallback = [];
        if (this.assets.tree) fallback.push({ tex: this.assets.tree, scale: 1.0, anchorY: 0.85 });
        if (this.assets.tree_pine) fallback.push({ tex: this.assets.tree_pine, scale: 1.0, anchorY: 0.85 });
        return fallback;
    }

    drawGround(grid, path) {
        const theme = this.currentTheme;
        const decoRate = theme ? theme.decoRate : 0.22;

        // Pré-sélection : case moulin garantie adjacente au chemin
        const windmillDecos = theme ? theme.decorations.filter(d => d.name && d.name.includes('windmill')) : [];
        const cartDecos     = theme ? theme.decorations.filter(d => d.name && d.name.includes('cart'))     : [];
        let windmillCell = null;
        let cartCell     = null;

        const isPath = (cell) => cell && (cell.type === 'path' || cell.type === 'spawn');

        for (let y = 1; y < grid.length - 1; y++) {
            for (let x = 1; x < GRID_WIDTH - 1; x++) {
                if (grid[y][x].type !== 'grass') continue;
                const up    = grid[y-1]?.[x];
                const down  = grid[y+1]?.[x];
                const left  = grid[y]?.[x-1];
                const right = grid[y]?.[x+1];
                const pathNeighbors = [up, down, left, right].filter(isPath).length;

                // Charrette : angle intérieur = 2 voisins chemin formant un L
                if (cartCell === null && cartDecos.length > 0 && pathNeighbors >= 2) {
                    const hasH = isPath(left) || isPath(right);
                    const hasV = isPath(up)   || isPath(down);
                    if (hasH && hasV) cartCell = { x, y };
                }
                // Moulin : au moins 1 voisin chemin
                if (windmillCell === null && windmillDecos.length > 0 && pathNeighbors >= 1
                    && !(cartCell && cartCell.x === x && cartCell.y === y)) {
                    windmillCell = { x, y };
                }
            }
        }

        // Fond scène unique : si le thème a un sceneBg, on l'affiche à la place des tuiles
        const sceneBgTex = theme ? this.assets[`sceneBg_${theme.id}`] : null;
        if (sceneBgTex) {
            const mapW = GRID_WIDTH  * TILE_WIDTH;
            const mapH = GRID_HEIGHT * TILE_HEIGHT;
            const bg = new PIXI.Sprite(sceneBgTex);
            bg.anchor.set(0, 0);
            bg.x = 0;
            bg.y = 0;
            bg.width  = mapW;
            bg.height = mapH;
            bg.eventMode = 'none';
            this.groundLayer.addChild(bg);
        }

        // Pré-calcul des virages : dir visuelle = R ou L selon parité de rangée
        const _dir = (a, b) => {
            const screenDx = (b.x - a.x) + ((b.y & 1) - (a.y & 1)) * 0.5;
            return screenDx > 0 ? 'R' : 'L';
        };
        const cornerMap = new Map(); // `x,y` → 'R2L' | 'L2R'
        const dirMap    = new Map(); // `x,y` → 'R' | 'L'
        if (path && path.length >= 2) {
            for (let i = 0; i < path.length; i++) {
                const p      = path[i];
                const inDir  = i > 0             ? _dir(path[i - 1], p)   : null;
                const outDir = i < path.length-1 ? _dir(p, path[i + 1]) : null;
                dirMap.set(`${p.x},${p.y}`, outDir || inDir);
                if (inDir && outDir && inDir !== outDir) {
                    cornerMap.set(`${p.x},${p.y}`, inDir === 'R' ? 'R2L' : 'L2R');
                }
            }
        }

        // Pré-calcul des variants herbe si le thème en a
        const grassVariantTextures = (theme && theme.grassVariants)
            ? theme.grassVariants.map(k => this.assets[`${k}_${theme.id}`] || this.assets[k]).filter(Boolean)
            : null;

        // Staggered iso : ordre rangée par rangée (haut → bas) = algorithme du peintre correct
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {

                const iso = toIso(x, y);
                const cell = grid[y][x];

                let tile;
                let isDecoTile = false;
                const grassTex = theme
                    ? (this._getThemedAsset(theme.tiles.grass) || this.assets.tile_grass)
                    : this.assets.tile_grass;
                const useSprites = !!grassTex;

                if (useSprites) {
                    let texture;
                    let cornerFlip = 0; // 0=normal, -1=miroir
                    let decoTileScale = 1.0;
                    let decoFrames = null; // frames si la déco a une variante animée (_sheet.png)
                    if (cell.type === 'grass') {
                        // Deco tiles (base iso baked-in) — remplacent la tuile herbe
                        const _onBorder = x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === grid.length - 1;
                        const decoTileList = theme?.decoTiles;
                        if (!_onBorder && !sceneBgTex && decoTileList?.length > 0) {
                            if (Math.random() < decoRate) {
                                const entry = decoTileList[Math.floor(Math.random() * decoTileList.length)];
                                const tileName = typeof entry === 'string' ? entry : entry.name;
                                const decoTex = this.assets[`${tileName}_${theme?.id}`];
                                if (decoTex) {
                                    texture = decoTex; isDecoTile = true; decoTileScale = entry.scale ?? 1.0;
                                    decoFrames = this.assets[`${tileName}_frames_${theme?.id}`] || null;
                                }
                            }
                        }
                        if (!isDecoTile) {
                            if (grassVariantTextures && grassVariantTextures.length > 0) {
                                const idx = (x * 7 + y * 13) % grassVariantTextures.length;
                                texture = grassVariantTextures[idx];
                            } else {
                                texture = grassTex;
                            }
                        }
                    } else if (cell.type === 'path' || cell.type === 'spawn' || cell.type === 'base') {
                        const cornerType = cornerMap.get(`${x},${y}`);
                        if (cornerType) {
                            texture = this._getThemedAsset('tile_corner') || grassTex;
                            cornerFlip = cornerType === 'L2R' ? -1 : 1;
                        } else {
                            texture = this._getThemedAsset('tile_path_straight') || grassTex;
                            const dir = dirMap.get(`${x},${y}`);
                            cornerFlip = dir === 'R' ? -1 : 1;
                        }
                    } else {
                        texture = grassTex;
                    }

                    if (isDecoTile && decoFrames) {
                        // Déco animée : même pattern que tours/Suzanne (AnimatedSprite ~8fps)
                        tile = new PIXI.AnimatedSprite(decoFrames);
                        tile.animationSpeed = 0.13;
                        tile.gotoAndPlay(Math.floor(Math.random() * decoFrames.length)); // désynchronise les instances
                    } else {
                        tile = new PIXI.Sprite(texture);
                    }
                    const tileScale = (this.currentTheme && this.currentTheme.tileScale) || 1.0;
                    if (isDecoTile) {
                        tile.anchor.set(0.5, 1.0);
                        tile.width  = TILE_WIDTH * tileScale * decoTileScale;
                        tile.scale.y = tile.scale.x; // ratio conservé
                    } else {
                        tile.anchor.set(0.5, 0.5);
                        tile.width  = TILE_WIDTH        * 1.00 * tileScale;
                        tile.height = (TILE_HEIGHT / 2) * 1.00 * tileScale;
                        if (cornerFlip !== 0) tile.scale.x = cornerFlip * Math.abs(tile.scale.x);
                    }

                    // Teinte rouge du spawn : inutile si un boss marque déjà le départ
                    if (cell.type === 'spawn' && !theme?.spawnBoss) {
                        tile.tint = 0xffaaaa;
                    }
                } else {
                    let color = 0x5a8f6a;
                    let strokeColor = 0x4a7c59;

                    if (cell.type === 'path') {
                        color = 0xd4b896;
                        strokeColor = 0xc4a77d;
                    } else if (cell.type === 'spawn') {
                        color = 0xe74c3c;
                        strokeColor = 0xc0392b;
                    } else if (cell.type === 'base') {
                        color = 0x3498db;
                        strokeColor = 0x2980b9;
                    }

                    tile = new PIXI.Graphics();
                    // Face staggered : losange TW × TH/2
                    const hw = TILE_WIDTH / 2 + 1, hh = TILE_HEIGHT / 4 + 1;
                    tile.poly([0, -hh, hw, 0, 0, hh, -hw, 0]);
                    tile.fill({ color });
                    tile.stroke({ width: 1, color: strokeColor, alpha: 0.15 });
                    tile.poly([0, -hh, hw * 0.5, -hh * 0.1, 0, hh * 0.2, -hw * 0.5, -hh * 0.1]);
                    tile.fill({ color: 0xffffff, alpha: 0.08 });
                }

                tile.x = iso.x;
                // Deco tile : ancre bas → bas de la face diamant ; normal : centre de la face
                tile.y = iso.y + TILE_HEIGHT / 2 + (isDecoTile ? TILE_HEIGHT / 4 : 0);
                // Clé de profondeur = position au SOL (le décalage d'ancrage ne doit pas fausser le tri)
                tile._sortY = iso.y + TILE_HEIGHT / 2;
                tile.gridX = x;
                tile.gridY = y;
                tile.eventMode = 'none';
                // Tuile invisible si un fond scène remplace la grille
                tile.alpha = sceneBgTex ? 0 : 1;
                tile.originalTint = tile.tint || 0xffffff;

                (isDecoTile ? this.entityLayer : this.groundLayer).addChild(tile);
                this.tileSprites.push(tile);

                if (cell.type === 'spawn' && theme?.spawnBoss) {
                    // Boss invocateur fixé sur la première tuile de chemin (Romain possédé ch7)
                    const bossFrames = this.assets[`${theme.spawnBoss}_frames_${theme.id}`];
                    const bossTex    = this.assets[`${theme.spawnBoss}_${theme.id}`];
                    if (bossFrames || bossTex) {
                        const boss = bossFrames ? new PIXI.AnimatedSprite(bossFrames) : new PIXI.Sprite(bossTex);
                        if (bossFrames) { boss.animationSpeed = 0.13; boss.play(); }
                        boss.anchor.set(0.5, theme.spawnBossAnchorY ?? 0.75);
                        const bScale = theme.spawnBossScale ?? 1.8;
                        boss.width  = TILE_WIDTH * bScale;
                        boss.height = TILE_WIDTH * bScale;
                        boss.x = iso.x + (theme.spawnBossOffsetX ?? 0);
                        boss.y = iso.y + TILE_HEIGHT * 0.6 + (theme.spawnBossOffsetY ?? 0);
                        this.entityLayer.addChild(boss);
                        this._bossSprite = boss;
                        this._bossIso    = { x: boss.x, y: iso.y };
                        this._bossIdleFrames   = bossFrames || null;
                        this._bossSummonFrames = this.assets[`${theme.spawnBoss}_summon_frames_${theme.id}`] || null;
                        this._bossSummoning    = false;
                        // VFX des mains : sur la tuile de CHEMIN devant Romain (là où les ennemis
                        // émergent), sinon elles restent cachées sous son grand sprite
                        let handTile = { x: iso.x, y: iso.y + TILE_HEIGHT / 2 };
                        const neighbours = [[x, y + 1], [x + 1, y], [x - 1, y], [x, y - 1]];
                        for (const [nx, ny] of neighbours) {
                            if (grid[ny]?.[nx]?.type === 'path') {
                                const ni = toIso(nx, ny);
                                handTile = { x: ni.x, y: ni.y + TILE_HEIGHT / 2 };
                                break;
                            }
                        }
                        this._spawnTileIso = handTile;
                        this._possessionBar = new PIXI.Graphics();
                        this._possessionBar.alpha = 0;   // révélée après le dialogue d'arrivée
                        this.effectLayer.addChild(this._possessionBar);
                        this.setPossession(1);
                    }
                }

                if (cell.type === 'base') {
                    // Pas de château sprite si le fond scène intègre déjà la forteresse, ou si désactivé
                    if (!sceneBgTex && !theme?.noCastle) {
                        const castleTex = this._getThemedAsset('castle');
                        if (castleTex) {
                            const castle = new PIXI.Sprite(castleTex);
                            castle.anchor.set(0.5, (theme && theme.castleAnchorY) || 0.75);
                            const cRef = TILE_WIDTH;
                            const cScale = (theme && theme.castleScale) || 1.8;
                            castle.width = cRef * cScale;
                            castle.height = cRef * cScale;
                            castle.x = iso.x;
                            castle.y = iso.y + TILE_HEIGHT * 0.6;
                            this.entityLayer.addChild(castle);
                        } else {
                            const icon = new PIXI.Text({ text: '🏠', style: { fontSize: 26 } });
                            icon.anchor.set(0.5);
                            icon.x = iso.x;
                            icon.y = iso.y + TILE_HEIGHT / 2;
                            this.groundLayer.addChild(icon);
                        }
                    }
                } else if (cell.type === 'grass') {
                    if (isDecoTile) {
                        // La tuile deco a sa propre base iso : pas de sprite supplémentaire
                        cell.hasTree = true;
                    } else {
                    const rand = Math.random();
                    const onBorder = x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === grid.length - 1;
                    const isWindmillCell = windmillCell && windmillCell.x === x && windmillCell.y === y;

                    // Case moulin garantie
                    if (isWindmillCell && windmillDecos.length > 0) {
                        const windmillTex = this._getThemedAsset(windmillDecos[0].name) || this.assets[windmillDecos[0].name];
                        if (windmillTex) {
                            const entry = windmillDecos[0];
                            const sprite = new PIXI.Sprite(windmillTex);
                            sprite.anchor.set(0.5, entry.anchorY);
                            const tRef = TILE_WIDTH;
                            sprite.width = tRef * entry.scale;
                            sprite.height = tRef * entry.scale;
                            sprite.x = iso.x;
                            sprite.y = iso.y + TILE_HEIGHT / 2;
                            sprite.eventMode = 'none';
                            this.entityLayer.addChild(sprite);
                            cell.hasTree = true;
                        }
                    }

                    // Autres décos normales (pas de moulin dans le pool)
                    const nonWindmillEntries = this._getDecorationEntries().filter(e => !e._isWindmill);
                    const decoEntries = (sceneBgTex || onBorder || isWindmillCell) ? [] : nonWindmillEntries;
                    if (rand < decoRate && decoEntries.length > 0) {
                        const entry = decoEntries[Math.floor(Math.random() * decoEntries.length)];
                        const tree = new PIXI.Sprite(entry.tex);
                        tree.anchor.set(0.5, entry.anchorY);
                        const tRef = TILE_WIDTH;
                        const baseSize = tRef * (0.9 + Math.random() * 0.4) * entry.scale;
                        tree.width = baseSize;
                        tree.height = baseSize;
                        tree.x = iso.x;
                        tree.y = iso.y + TILE_HEIGHT / 2;
                        tree.eventMode = 'none';
                        if (!entry.noWind) {
                            tree._windPhase = Math.random() * Math.PI * 2;
                            tree._windSpeed = 0.8 + Math.random() * 0.4;
                            tree._baseScaleX = tree.scale.x;
                            tree._baseSkew = 0;
                            this.treeSprites.push(tree);
                        }
                        this.entityLayer.addChild(tree);
                        // Mark cell so towers can't be placed here
                        cell.hasTree = true;
                    } else if (rand < decoRate + 0.03 && !useSprites) {
                        const flowers = ['🌸', '🌼', '🌺'][Math.floor(Math.random() * 3)];
                        const deco = new PIXI.Text({ text: flowers, style: { fontSize: 10 } });
                        deco.anchor.set(0.5);
                        deco.x = iso.x + (Math.random() - 0.5) * 20;
                        deco.y = iso.y + TILE_HEIGHT / 2 + (Math.random() - 0.5) * 8;
                        deco.alpha = 0.7;
                        deco._isDecoration = true;
                        this.groundLayer.addChild(deco);
                    }
                    } // end else (not isDecoTile)
                } else if (cell.type === 'path' && !useSprites) {
                    if (Math.random() < 0.3) {
                        const pebble = new PIXI.Graphics();
                        pebble.circle(0, 0, 2 + Math.random() * 2);
                        pebble.fill({ color: 0x9a8a7a, alpha: 0.4 });
                        pebble.x = iso.x + (Math.random() - 0.5) * 25;
                        pebble.y = iso.y + TILE_HEIGHT / 2 + (Math.random() - 0.5) * 10;
                        this.groundLayer.addChild(pebble);
                    }
                }
            }
        }

        // Build tile lookup map
        this.tileMap = {};
        this.tileSprites.forEach(tile => {
            this.tileMap[`${tile.gridX},${tile.gridY}`] = tile;
        });
    }

    createTowerSprite(towerType, orientation) {
        const config = TOWER_TYPES[towerType];
        const assetKey = `tower_${towerType}_${orientation}`;
        const fallbackKey = `tower_${towerType}`;
        const texture = this.assets[assetKey]
            || this.assets[`tower_${towerType}_side`]
            || this.assets[`tower_${towerType}_front`]
            || this.assets[fallbackKey];

        let sprite;
        let baseScaleX, baseScaleY;

        // Fire tower: AnimatedSprite avec les 16 frames d'animation (lvl1, 4 variants)
        const fireFrames = towerType === 'fire'
            ? this._getFireFrames('', orientation)
            : [];

        // Idle spritesheet (archer/mage/light) — fallback side puis left si l'orientation n'a pas de sheet
        const idleFrames = this.assets[`tower_${towerType}_${orientation}_idle_frames`]
            || this.assets[`tower_${towerType}_side_idle_frames`]
            || this.assets[`tower_${towerType}_left_idle_frames`]
            || [];

        const towerAnchorY = TOWER_TYPES[towerType]?.anchorY ?? 0.85;

        if (fireFrames.length > 0) {
            sprite = new PIXI.AnimatedSprite(fireFrames);
            sprite.anchor.set(0.5, towerAnchorY);
            const tRef = TILE_WIDTH;
            const tScale = (this.currentTheme && this.currentTheme.towerScale) || 1.0;
            sprite.width = tRef * 1.1 * tScale;
            sprite.height = tRef * 1.1 * tScale;
            sprite.animationSpeed = 0.08; // ~8fps
            sprite.play();
            sprite.scale.x *= -1;
            baseScaleX = sprite.scale.x;
            baseScaleY = sprite.scale.y;
        } else if (idleFrames.length > 0) {
            sprite = new PIXI.AnimatedSprite(idleFrames);
            sprite.anchor.set(0.5, towerAnchorY);
            const tRef = TILE_WIDTH;
            const tScale = (this.currentTheme && this.currentTheme.towerScale) || 1.0;
            const displayScale = TOWER_TYPES[towerType]?.displayScale || 1.0;
            sprite.width = tRef * 1.1 * tScale * displayScale;
            sprite.height = tRef * 1.1 * tScale * displayScale;
            sprite.animationSpeed = 0.13; // ~8fps à 60fps
            sprite.play();
            sprite.scale.x *= -1;
            baseScaleX = sprite.scale.x;
            baseScaleY = sprite.scale.y;
        } else if (texture) {
            sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5, towerAnchorY);
            const tRef = TILE_WIDTH;
            const tScale = (this.currentTheme && this.currentTheme.towerScale) || 1.0;
            const displayScale = TOWER_TYPES[towerType]?.displayScale || 1.0;
            sprite.width = tRef * 1.1 * tScale * displayScale;
            sprite.height = tRef * 1.1 * tScale * displayScale;
            // Flip horizontally to compensate for mirrored iso projection
            sprite.scale.x *= -1;
            baseScaleX = sprite.scale.x;
            baseScaleY = sprite.scale.y;
        } else {
            sprite = new PIXI.Container();

            const base = new PIXI.Graphics();
            base.roundRect(-20, -10, 40, 20, 5);
            base.fill({ color: 0x4a4a4a });
            sprite.addChild(base);

            const body = new PIXI.Graphics();
            body.circle(0, -25, 22);
            body.fill({ color: config.color });
            body.stroke({ width: 3, color: 0x333333 });
            sprite.addChild(body);

            const icons = { archer: '🏹', cannon: '💣', ice: '❄️', sniper: '🎯', wind: '🌀' };
            const icon = new PIXI.Text({ text: icons[towerType], style: { fontSize: 18 } });
            icon.anchor.set(0.5);
            icon.y = -25;
            sprite.addChild(icon);

            // Flip horizontally to compensate for mirrored iso projection
            sprite.scale.x *= -1;
            baseScaleX = sprite.scale.x;
            baseScaleY = sprite.scale.y;
        }

        return { sprite, baseScaleX, baseScaleY };
    }

    addTowerToStage(tower) {
        const iso = toIso(tower.x, tower.y);
        tower.sprite.x = iso.x;
        tower.sprite.y = iso.y + TILE_HEIGHT / 2;
        this.entityLayer.addChild(tower.sprite);
        this.sortEntities();
        this.createPlaceEffect(iso.x, iso.y + TILE_HEIGHT / 2);
    }

    removeTowerFromStage(tower) {
        this.entityLayer.removeChild(tower.sprite);
        this.removeTowerXpBar(tower);
        const iso = toIso(tower.x, tower.y);
        this.createPlaceEffect(iso.x, iso.y + TILE_HEIGHT / 2);
    }

    // ── Jauge de possession (ch7) : l'emprise du Nécro sur Romain ──
    // ratio 1 = emprise totale, 0 = libéré. L'aura du boss faiblit avec elle.
    setPossession(ratio) {
        const bar = this._possessionBar;
        if (!bar || !this._bossIso) return;
        const r = Math.max(0, Math.min(1, ratio));
        const W = TILE_WIDTH * 1.5, H = 16;
        const x = this._bossIso.x - W / 2;
        const y = this._bossIso.y - TILE_HEIGHT * 0.42;

        bar.clear();
        // socle sombre
        bar.roundRect(x - 2, y - 2, W + 4, H + 4, 5);
        bar.fill({ color: 0x0a0512, alpha: 0.85 });
        // remplissage violet, d'autant plus pâle que l'emprise faiblit
        bar.roundRect(x, y, W * r, H, 4);
        bar.fill({ color: 0x8c1ed6, alpha: 0.55 + 0.45 * r });
        // liseré
        bar.roundRect(x - 2, y - 2, W + 4, H + 4, 5);
        bar.stroke({ width: 2, color: 0xb266ff, alpha: 0.5 + 0.5 * r });
    }

    // Apparition en fondu de la jauge (après le dialogue, quand Nathan comprend la mécanique)
    revealPossession(duration = 900) {
        const bar = this._possessionBar;
        if (!bar) return;
        const t0 = performance.now();
        const fade = () => {
            const p = Math.min(1, (performance.now() - t0) / duration);
            bar.alpha = p;
            if (p >= 1) this.app.ticker.remove(fade);
        };
        this.app.ticker.add(fade);
    }

    clearPossession() {
        this._possessionBar?.destroy();
        this._possessionBar = null;
        this._bossSprite = null;
        this._bossIso = null;
        this._bossIdleFrames = this._bossSummonFrames = null;
        this._bossSummoning = false;
    }

    // Le boss invoque : geste one-shot, puis les mains jaillissent au spawn, retour à l'idle
    playBossSummon() {
        const boss = this._bossSprite;
        if (!boss || !this._bossSummonFrames || this._bossSummoning) return;
        this._bossSummoning = true;

        boss.textures = this._bossSummonFrames;
        boss.loop = false;
        boss.animationSpeed = 0.14;
        boss.gotoAndPlay(0);

        // Les mains jaillissent quand il projette la main (~frame 5, à ~8,4 fps)
        const frameMs = 1000 / (0.14 * 60);
        clearTimeout(this._handsTimer);
        this._handsTimer = setTimeout(() => this.playSummonHands(), 5 * frameMs);

        boss.onComplete = () => {
            boss.onComplete = null;
            if (this._bossIdleFrames) {
                boss.textures = this._bossIdleFrames;
                boss.loop = true;
                boss.animationSpeed = 0.13;
                boss.gotoAndPlay(0);
            }
            this._bossSummoning = false;
        };
    }

    playSummonHands() {
        const frames = this.assets[`summon_hands_frames_${this.currentTheme?.id}`];
        if (!frames || !this._spawnTileIso) return;
        const fx = new PIXI.AnimatedSprite(frames);
        fx.anchor.set(0.5, 0.7);
        fx.width  = TILE_WIDTH * 1.1;
        fx.height = TILE_WIDTH * 1.1;
        fx.x = this._spawnTileIso.x;
        fx.y = this._spawnTileIso.y;
        fx._sortY = fx.y + 500;   // toujours devant Romain
        fx.loop = false;
        fx.animationSpeed = 0.16;
        fx.onComplete = () => fx.destroy();
        this.entityLayer.addChild(fx);
        this.sortEntities();
        fx.play();
    }

    // ── Alliés décoratifs : chute du ciel + impact, puis idle en boucle ──
    // delay : décalage de départ (ms) pour désynchroniser plusieurs arrivées
    dropAllyOnTile(name, gridX, gridY, { scale = 1.15, delay = 0, flip = false } = {}) {
        const theme  = this.currentTheme;
        const frames = this.assets[`ally_${name}_${theme?.id}_frames`];
        if (!frames || frames.length === 0) return;

        const iso     = toIso(gridX, gridY);
        const groundY = iso.y + TILE_HEIGHT / 2;
        // Assez haut pour démarrer HORS champ (la carte est scalée, d'où le /mapScale)
        const FALL_H  = Math.max(620, (this.app.screen.height / (this.mapScale || 1)) * 0.85);
        const FALL_MS = 520;
        const ANTICIP = 280;   // l'ombre seule apparaît avant la chute → l'œil se prépare
        const SFX_LEAD = 500;  // le son part 0,5s avant le contact (peut démarrer pendant l'anticipation)
        let soundFired = false;

        // Ombre au sol : grandit et fonce à l'approche → c'est elle qui donne la profondeur
        const shadow = new PIXI.Graphics();
        shadow.x = iso.x; shadow.y = groundY;
        this.groundLayer.addChild(shadow);

        const sprite = new PIXI.AnimatedSprite(frames);
        sprite.anchor.set(0.5, 0.9);
        sprite.width  = TILE_WIDTH * scale;
        sprite.height = TILE_WIDTH * scale;
        if (flip) sprite.scale.x *= -1;
        const baseSX = sprite.scale.x, baseSY = sprite.scale.y;
        sprite.x = iso.x;
        sprite.y = groundY - FALL_H;
        sprite.alpha = 0;
        sprite.animationSpeed = 0.12;
        sprite.play();
        this.entityLayer.addChild(sprite);

        this._allies = this._allies || {};
        this._allies[name] = { sprite, shadow, groundY, baseSX, baseSY, fallH: FALL_H, gridX, gridY };

        const start     = performance.now() + delay;
        const fallStart = start + ANTICIP;
        const landAt    = fallStart + FALL_MS;   // instant du contact
        const tick = () => {
            const now = performance.now();
            if (now < start) return;

            // Son : lancé SFX_LEAD ms avant le contact, quelle que soit la phase en cours
            if (!soundFired && now >= landAt - SFX_LEAD) {
                soundFired = true;
                this.onAllyImpact?.();
            }

            // Phase 1 — anticipation : l'ombre seule, qui naît et grandit sur la tuile
            if (now < fallStart) {
                const a = (now - start) / ANTICIP;
                shadow.clear();
                shadow.ellipse(0, 0, TILE_WIDTH * 0.105 * a, TILE_HEIGHT * 0.046 * a);
                shadow.fill({ color: 0x000000, alpha: 0.12 * a });
                return;
            }

            const t = Math.min(1, (now - fallStart) / FALL_MS);
            const ease = t * t;                     // easeIn = accélération (gravité)
            sprite.y     = groundY - FALL_H * (1 - ease);
            sprite.alpha = 1;                       // pas de fondu : il entre par le haut du cadre
            // étirement proportionnel à la vitesse (squash & stretch) → sensation de poids
            const stretch = 1 + 0.38 * t;
            sprite.scale.y = baseSY * stretch;
            sprite.scale.x = baseSX / stretch;
            // ombre : petite/pâle en haut → large/dense à l'impact
            shadow.clear();
            shadow.ellipse(0, 0, TILE_WIDTH * 0.30 * (0.35 + 0.65 * ease), TILE_HEIGHT * 0.13 * (0.35 + 0.65 * ease));
            shadow.fill({ color: 0x000000, alpha: 0.12 + 0.33 * ease });

            if (t >= 1) {
                this.app.ticker.remove(tick);
                sprite.y = groundY;
                if (!soundFired) { this.onAllyImpact?.(); soundFired = true; } // filet de sécurité
                this.playImpactDust(gridX, gridY);
                this.shakeCamera(4, 140);
                // squash à l'atterrissage : compression puis retour
                const sq = performance.now();
                const squash = () => {
                    const p = Math.min(1, (performance.now() - sq) / 140);
                    const k = 1 - 0.09 * Math.sin(p * Math.PI); // 1 → 0.91 → 1
                    sprite.scale.y = baseSY * k;
                    sprite.scale.x = baseSX * (2 - k);
                    if (p >= 1) { sprite.scale.x = baseSX; sprite.scale.y = baseSY; this.app.ticker.remove(squash); }
                };
                this.app.ticker.add(squash);
            }
        };
        this.app.ticker.add(tick);
        return sprite;
    }

    // Un allié quitte le combat : accroupi d'élan puis bond hors champ (miroir de l'arrivée)
    exitAlly(name, { crouch = 200, rise = 420 } = {}) {
        const a = this._allies?.[name];
        if (!a) return;
        const { sprite, shadow, groundY, baseSX, baseSY, fallH, gridX, gridY } = a;
        delete this._allies[name];

        const t0 = performance.now();
        const step = () => {
            const now = performance.now();

            // Phase 1 — accroupissement : il prend son élan
            if (now < t0 + crouch) {
                const p = (now - t0) / crouch;
                const k = 1 - 0.16 * Math.sin(p * Math.PI * 0.5);
                sprite.scale.y = baseSY * k;
                sprite.scale.x = baseSX * (2 - k);
                return;
            }

            // Phase 2 — détente : il s'étire et accélère vers le haut
            const p = Math.min(1, (now - t0 - crouch) / rise);
            if (p === 0 || (p > 0 && !a._launched)) {
                a._launched = true;
                this.playImpactDust(gridX, gridY);   // poussière au décollage
                this.onAllyImpact?.();
            }
            const ease = p * p;                       // accélère en sortant du cadre
            sprite.y = groundY - fallH * ease;
            const stretch = 1 + 0.42 * p;
            sprite.scale.y = baseSY * stretch;
            sprite.scale.x = baseSX / stretch;
            // l'ombre rétrécit et s'efface à mesure qu'il s'élève
            shadow.clear();
            shadow.ellipse(0, 0, TILE_WIDTH * 0.30 * (1 - 0.8 * ease), TILE_HEIGHT * 0.13 * (1 - 0.8 * ease));
            shadow.fill({ color: 0x000000, alpha: 0.45 * (1 - ease) });

            if (p >= 1) {
                this.app.ticker.remove(step);
                sprite.destroy();
                shadow.destroy();
            }
        };
        this.app.ticker.add(step);
    }

    clearAllies() {
        for (const k of Object.keys(this._allies || {})) {
            this._allies[k].sprite?.destroy();
            this._allies[k].shadow?.destroy();
        }
        this._allies = {};
        // Réinitialise le héros David : sinon updateDavidCharge lit un sprite détruit au rejeu
        this._davidAura?.destroy();
        this._davidChargeBar?.destroy();
        this._davidSprite = null;
        this._davidAura = null;
        this._davidChargeBar = null;
        this._davidBaseFrames = null;
    }

    playImpactDust(gridX, gridY) {
        const tex = this.assets[`impact_dust_${this.currentTheme?.id}`];
        if (!tex) return;
        const iso = toIso(gridX, gridY);
        const dust = new PIXI.Sprite(tex);
        dust.anchor.set(0.5, 0.5);
        dust.x = iso.x;
        dust.y = iso.y + TILE_HEIGHT / 2;
        this.entityLayer.addChild(dust);
        const t0 = performance.now();
        const DUR = 340;
        const grow = () => {
            const p = Math.min(1, (performance.now() - t0) / DUR);
            const s = (0.25 + 0.65 * p) * (TILE_WIDTH * 0.9 / tex.width); // onde qui s'étend
            dust.scale.set(s, s * 0.55);   // aplati = raccord perspective iso
            dust.alpha = 0.75 * (1 - p * p);
            if (p >= 1) { this.app.ticker.remove(grow); dust.destroy(); }
        };
        this.app.ticker.add(grow);
    }

    // Gros nuage de poussière animé (tour pulvérisée par le dragon) — joué une fois
    playDustCloud(gridX, gridY) {
        const frames = this.assets[`dust_cloud_frames_${this.currentTheme?.id}`];
        if (!frames || frames.length === 0) { this.playImpactDust(gridX, gridY); return; }
        const iso = toIso(gridX, gridY);
        const cloud = new PIXI.AnimatedSprite(frames);
        cloud.anchor.set(0.5, 0.7);          // ancré bas : la poussière monte depuis le sol
        cloud.width  = TILE_WIDTH * 1.7;
        cloud.scale.y = cloud.scale.x;       // ratio conservé
        cloud.x = iso.x;
        cloud.y = iso.y + TILE_HEIGHT / 2;
        cloud._sortY = cloud.y + 999;        // toujours au premier plan de sa tuile
        cloud.loop = false;
        cloud.animationSpeed = 0.24;
        cloud.play();
        this.entityLayer.addChild(cloud);
        this.sortEntities();
        const t0 = performance.now(), DUR = frames.length / (0.24 * 60) * 1000;
        const fade = () => {
            const p = Math.min(1, (performance.now() - t0) / DUR);
            cloud.alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;   // s'estompe sur la fin
            if (p >= 1) { this.app.ticker.remove(fade); cloud.destroy(); }
        };
        this.app.ticker.add(fade);
    }

    shakeCamera(amplitude = 8, duration = 200) {
        const layers = [this.groundLayer, this.rangeLayer, this.entityLayer,
                        this.projectileLayer, this.effectLayer];
        const baseX = this.offsetX, baseY = this.offsetY;
        const t0 = performance.now();
        const shake = () => {
            const p = Math.min(1, (performance.now() - t0) / duration);
            const a = amplitude * (1 - p);   // décroissance linéaire
            const dx = (Math.random() * 2 - 1) * a;
            const dy = (Math.random() * 2 - 1) * a;
            layers.forEach(l => { l.x = baseX + dx; l.y = baseY + dy; });
            if (p >= 1) {
                layers.forEach(l => { l.x = baseX; l.y = baseY; });
                this.app.ticker.remove(shake);
            }
        };
        this.app.ticker.add(shake);
    }

    // ── David héros (ch7) : barre de charge + clic, sur son sprite d'allié posé ──
    enableDavidHero() {
        const a = this._allies?.['david'];
        if (!a) return;
        this._davidSprite = a.sprite;
        this._davidGridX  = a.gridX;
        this._davidGridY  = a.gridY;
        this._davidBaseFrames = a.sprite.textures;   // idle de dos (pour restaurer après le raise)
        a.sprite.eventMode = 'static';
        a.sprite.cursor = 'pointer';
        a.sprite.on('pointerdown', () => this.onHeroClick?.());
        this._davidAura = new PIXI.Graphics();
        this.groundLayer.addChild(this._davidAura);
        this._davidChargeBar = new PIXI.Graphics();
        this.effectLayer.addChild(this._davidChargeBar);
    }

    updateDavidCharge(charge, maxCharge, now) {
        const bar = this._davidChargeBar, sprite = this._davidSprite;
        if (!bar || !sprite || sprite.destroyed || !sprite.visible) return;
        const ratio = charge / maxCharge, charged = ratio >= 1;
        const iso = toIso(this._davidGridX, this._davidGridY);
        const cx = iso.x, baseY = iso.y + TILE_HEIGHT / 2;

        if (this._davidAura) {
            this._davidAura.clear();
            if (charged) {   // aura verte pulsée quand le pouvoir est prêt
                const aAlpha = 0.16 + Math.sin(now * 0.005) * 0.09;
                const aR = TILE_WIDTH * 0.60 + Math.sin(now * 0.003) * 8;
                this._davidAura.circle(cx, baseY, aR);
                this._davidAura.fill({ color: 0x44dd66, alpha: aAlpha });
                this._davidAura.circle(cx, baseY, aR * 1.2);
                this._davidAura.stroke({ color: 0x88ffaa, alpha: aAlpha * 0.8, width: 2.5 });
            }
        }

        bar.clear();
        const barW = 52, barH = 7, bx = cx - barW / 2, by = baseY - sprite.height * 0.95 - 14;
        bar.roundRect(bx - 1, by - 1, barW + 2, barH + 2, 3);
        bar.fill({ color: 0x111111, alpha: 0.75 });
        if (ratio > 0) {
            const fill = charged ? (Math.sin(now * 0.007) > 0 ? 0x66ee88 : 0x33bb55) : 0x44AAFF;
            bar.roundRect(bx, by, barW * Math.min(ratio, 1), barH, 2);
            bar.fill({ color: fill });
        }
    }

    // David lève son épée (wind-up), puis revient à l'idle
    playDavidRaise() {
        const s = this._davidSprite;
        const frames = this.assets[`david_raise_frames_${this.currentTheme?.id}`];
        if (!s || !frames) return;
        s.textures = frames;
        s.loop = false;
        s.animationSpeed = 0.14;
        s.gotoAndPlay(0);
        s.onComplete = () => {
            s.onComplete = null;
            if (this._davidBaseFrames) { s.textures = this._davidBaseFrames; s.loop = true; s.animationSpeed = 0.12; s.gotoAndPlay(0); }
        };
    }

    // Une claymore s'abat du ciel sur une tuile ; onImpact au contact (dégâts)
    dropClaymore(gridX, gridY, onImpact) {
        const tex = this.assets[`claymore_${this.currentTheme?.id}`];
        if (!tex) { onImpact?.(); return; }
        const iso = toIso(gridX, gridY);
        const groundY = iso.y + TILE_HEIGHT / 2;
        const FALL_H = 720, FALL_MS = 340;

        const shadow = new PIXI.Graphics();
        shadow.x = iso.x; shadow.y = groundY;
        this.groundLayer.addChild(shadow);

        const sword = new PIXI.Sprite(tex);
        sword.anchor.set(0.5, 1.0);          // pivot = pointe de la lame (en bas)
        sword.height = TILE_WIDTH * 1.55;
        sword.scale.x = sword.scale.y;       // ratio conservé
        sword.rotation = (Math.random() * 0.3 - 0.15);
        sword.x = iso.x;
        sword.y = groundY - FALL_H;
        this.entityLayer.addChild(sword);
        this.sortEntities();

        const t0 = performance.now();
        let hit = false;
        const tick = () => {
            const t = Math.min(1, (performance.now() - t0) / FALL_MS);
            const ease = t * t;              // accélération (gravité)
            sword.y = groundY - FALL_H * (1 - ease);
            shadow.clear();
            shadow.ellipse(0, 0, TILE_WIDTH * 0.15 * (0.3 + 0.7 * ease), TILE_HEIGHT * 0.065 * (0.3 + 0.7 * ease));
            shadow.fill({ color: 0x000000, alpha: 0.1 + 0.3 * ease });

            if (t >= 1 && !hit) {
                hit = true;
                this.app.ticker.remove(tick);
                sword.y = groundY;
                this.playImpactDust(gridX, gridY);
                this.shakeCamera(6, 150);
                onImpact?.();
                shadow.destroy();
                // la lame reste plantée un instant puis s'estompe
                const st = performance.now();
                const settle = () => {
                    const p = Math.min(1, (performance.now() - st) / 550);
                    if (p > 0.45) sword.alpha = 1 - (p - 0.45) / 0.55;
                    if (p >= 1) { sword.destroy(); this.app.ticker.remove(settle); }
                };
                this.app.ticker.add(settle);
            }
        };
        this.app.ticker.add(tick);
    }

    // ── Raid du dragon (ch7) : télégraphe puis piqué sur une tour ──
    showDragonWarning(gridX, gridY) {
        const iso = toIso(gridX, gridY);
        const g = new PIXI.Graphics();
        g.x = iso.x; g.y = iso.y + TILE_HEIGHT / 2;
        this.effectLayer.addChild(g);
        const t0 = performance.now();
        const anim = () => {
            const now = performance.now();
            const p = Math.min(1, (now - t0) / 1500);
            const pulse = 0.5 + 0.5 * Math.sin(now * 0.013);
            g.clear();
            g.ellipse(0, 0, TILE_WIDTH * 0.42 * p, TILE_HEIGHT * 0.2 * p);
            g.fill({ color: 0x000000, alpha: 0.2 + 0.3 * p });
            g.ellipse(0, 0, TILE_WIDTH * 0.44 * p, TILE_HEIGHT * 0.21 * p);
            g.stroke({ color: 0xcc2222, alpha: (0.35 + 0.45 * pulse) * p, width: 3 });
            if (g._stop) { this.app.ticker.remove(anim); g.destroy(); }
        };
        this.app.ticker.add(anim);
        this._dragonWarning = g;
    }

    clearDragonWarning() {
        if (this._dragonWarning) { this._dragonWarning._stop = true; this._dragonWarning = null; }
    }

    playDragonDive(gridX, gridY, onImpact) {
        const frames = this.assets[`dragon_fly_frames_${this.currentTheme?.id}`];
        const iso = toIso(gridX, gridY);
        const targetX = iso.x, targetY = iso.y + TILE_HEIGHT / 2;
        if (!frames) { onImpact?.(); return; }

        const dragon = new PIXI.AnimatedSprite(frames);
        dragon.anchor.set(0.5, 0.5);
        dragon.width  = TILE_WIDTH * 2.6;
        dragon.scale.y = dragon.scale.x;      // ratio conservé
        dragon.animationSpeed = 0.28;         // battement d'ailes rapide
        dragon.play();

        // Approche depuis le haut-gauche (il regarde à droite), piqué vers la tuile
        const offTop = (this.app.screen.height / (this.mapScale || 1)) * 0.85;
        const startX = targetX - TILE_WIDTH * 3.2, startY = targetY - offTop;
        dragon.x = startX; dragon.y = startY;
        this.entityLayer.addChild(dragon);
        this.sortEntities();

        const DIVE = 1000, RISE = 820;
        const t0 = performance.now();
        let impacted = false, impactStart = 0;
        const step = () => {
            const now = performance.now();
            if (!impacted) {
                const t = Math.min(1, (now - t0) / DIVE);
                const e = t * t;                 // accélère (piqué)
                dragon.x = startX + (targetX - startX) * e;
                dragon.y = startY + (targetY - startY) * e;
                dragon.rotation = 0.2 * t;        // tête qui plonge
                if (t >= 1) {
                    impacted = true; impactStart = now;
                    dragon.rotation = 0;
                    this.playImpactDust(gridX, gridY);
                    this.shakeCamera(9, 230);
                    onImpact?.();
                }
            } else {
                const t = Math.min(1, (now - impactStart) / RISE);
                const e = t * t;                 // remonte vers la droite en accélérant
                dragon.x = targetX + TILE_WIDTH * 3.6 * e;
                dragon.y = targetY - offTop * 0.9 * e;
                dragon.rotation = -0.15 * t;
                if (t > 0.5) dragon.alpha = 1 - (t - 0.5) * 2;
                if (t >= 1) { this.app.ticker.remove(step); dragon.destroy(); }
            }
        };
        this.app.ticker.add(step);
    }

    placeSuzanneOnTile(gridX, gridY) {
        const frames = this.assets['suzanne_idle_frames'];
        if (!frames || frames.length === 0) return;
        const sprite = new PIXI.AnimatedSprite(frames);
        sprite.anchor.set(0.5, 0.9);
        sprite.width  = TILE_WIDTH * 1.2;
        sprite.height = TILE_WIDTH * 1.2;
        sprite.scale.x *= -1;
        sprite.animationSpeed = 0.12;
        sprite.play();
        const iso = toIso(gridX, gridY);
        sprite.x = iso.x;
        sprite.y = iso.y + TILE_HEIGHT / 2;
        sprite.eventMode = 'static';
        sprite.on('pointerdown', () => this.onHeroClick?.());

        this._suzanneSprite = sprite;
        this._suzanneGridX  = gridX;
        this._suzanneGridY  = gridY;
        this._suzanneBaseScaleX = sprite.scale.x;
        this._suzanneBaseScaleY = sprite.scale.y;

        // Aura derrière tous les sprites (groundLayer)
        this._heroAura = new PIXI.Graphics();
        this.groundLayer.addChild(this._heroAura);

        // Barre de charge + indicateur clic (effectLayer — au-dessus des ennemis)
        this._heroChargeBar = new PIXI.Graphics();
        this.effectLayer.addChild(this._heroChargeBar);
        this.entityLayer.addChild(sprite);
        this.sortEntities();
    }

    // ── Pièges Martin (ch6) ──────────────────────────────────────

    playTrapPlacing(gridX, gridY, onDone) {
        const frames = this.assets['trap_placing_frames'];
        if (!frames || frames.length === 0) { onDone?.(); return; }
        const sprite = new PIXI.AnimatedSprite(frames);
        sprite.anchor.set(0.5, 0.9);
        sprite.width  = TILE_WIDTH * 1.1;
        sprite.height = TILE_WIDTH * 1.1;
        sprite.animationSpeed = 0.15;
        sprite.loop = false;
        const iso = toIso(gridX, gridY);
        sprite.x = iso.x;
        sprite.y = iso.y + TILE_HEIGHT / 2;
        this.entityLayer.addChild(sprite);
        sprite.play();
        sprite.onComplete = () => {
            sprite.destroy();
            onDone?.();
        };
    }

    placeTrapOnTile(gridX, gridY) {
        const tex = this.assets['trap_tile_night_forest'];
        if (!tex) return;
        const frameW = Math.floor(tex.width / 8);
        const frames = Array.from({ length: 8 }, (_, i) =>
            new PIXI.Texture({ source: tex.source, frame: new PIXI.Rectangle(i * frameW, 0, frameW, tex.height) })
        );
        const sprite = new PIXI.AnimatedSprite(frames);
        sprite.anchor.set(0.5, 1);
        sprite.width  = TILE_WIDTH;
        sprite.height = TILE_HEIGHT / 2;
        sprite.animationSpeed = 0.1;
        sprite.loop = true;
        const iso = toIso(gridX, gridY);
        sprite.x = iso.x;
        sprite.y = iso.y + TILE_HEIGHT / 2 + 45;
        sprite.play();
        this.entityLayer.addChild(sprite);
        if (!this._trapSprites) this._trapSprites = {};
        this._trapSprites[`${gridX},${gridY}`] = sprite;
    }

    removeTrapFromTile(gridX, gridY) {
        if (!this._trapSprites) return;
        const key = `${gridX},${gridY}`;
        const sprite = this._trapSprites[key];
        if (sprite) {
            sprite.destroy();
            delete this._trapSprites[key];
        }
    }

    playTrapBurstEffect(gridX, gridY) {
        const frames = this.assets['fire_burst_frames'];
        if (!frames) return;
        const iso = toIso(gridX, gridY);
        const sprite = new PIXI.AnimatedSprite(frames);
        sprite.anchor.set(0.5, 1);
        sprite.width  = TILE_WIDTH * 1.5;
        sprite.height = TILE_HEIGHT * 3;
        sprite.x = iso.x;
        sprite.y = iso.y + TILE_HEIGHT / 2 + 45;
        sprite.animationSpeed = 0.25;
        sprite.loop = false;
        sprite.onComplete = () => sprite.destroy();
        this.entityLayer.addChild(sprite);
        sprite.play();
    }

    clearTrapSprites() {
        if (!this._trapSprites) return;
        for (const s of Object.values(this._trapSprites)) s.destroy();
        this._trapSprites = {};
    }

    updateHeroCharge(charge, maxCharge, now) {
        const bar    = this._heroChargeBar;
        const sprite = this._suzanneSprite;
        if (!bar || !sprite) return;

        const ratio   = charge / maxCharge;
        const charged = ratio >= 1;
        const iso     = toIso(this._suzanneGridX, this._suzanneGridY);
        const cx      = iso.x;
        const baseY   = iso.y + TILE_HEIGHT / 2;

        // ── Aura dorée (groundLayer, derrière tout) ──────────────
        if (this._heroAura) {
            this._heroAura.clear();
            if (charged) {
                const aAlpha = 0.18 + Math.sin(now * 0.005) * 0.10;
                const aR     = TILE_WIDTH * 0.68 + Math.sin(now * 0.003) * 9;
                this._heroAura.circle(cx, baseY, aR);
                this._heroAura.fill({ color: 0xFFD700, alpha: aAlpha });
                this._heroAura.circle(cx, baseY, aR * 1.22);
                this._heroAura.stroke({ color: 0xFFAA00, alpha: aAlpha * 0.8, width: 2.5 });
            }
        }

        // ── Barre de charge ───────────────────────────────────────
        bar.clear();
        const barW = 52;
        const barH = 7;
        const bx   = cx - barW / 2;
        const by   = baseY - sprite.height * 0.9 - 14;

        bar.roundRect(bx - 1, by - 1, barW + 2, barH + 2, 3);
        bar.fill({ color: 0x111111, alpha: 0.75 });
        if (ratio > 0) {
            const fillColor = charged
                ? (Math.sin(now * 0.007) > 0 ? 0xFFD700 : 0xFFA500)
                : 0x44AAFF;
            bar.roundRect(bx, by, barW * Math.min(ratio, 1), barH, 2);
            bar.fill({ color: fillColor });
        }

        // ── Indicateur de clic (triangle clignotant au-dessus de la barre) ──
        const triY    = by - 12;
        const triSize = 5;
        const triA    = charged
            ? 0.7 + Math.sin(now * 0.006) * 0.3
            : 0.28 + Math.sin(now * 0.003) * 0.10;
        const triColor = charged ? 0xFFD700 : 0xCCCCCC;
        const bob = charged ? Math.sin(now * 0.004) * 3 : 0;

        bar.moveTo(cx,             triY - triSize + bob);
        bar.lineTo(cx + triSize,   triY + triSize + bob);
        bar.lineTo(cx - triSize,   triY + triSize + bob);
        bar.closePath();
        bar.fill({ color: triColor, alpha: triA });

        // ── Curseur + micro-pulse quand chargé ────────────────────
        sprite.cursor = charged ? 'pointer' : 'default';
        if (charged) {
            const pulse = 1 + Math.sin(now * 0.004) * 0.025;
            sprite.scale.x = this._suzanneBaseScaleX * pulse;
            sprite.scale.y = this._suzanneBaseScaleY * pulse;
        } else {
            sprite.scale.x = this._suzanneBaseScaleX;
            sprite.scale.y = this._suzanneBaseScaleY;
        }
    }

    createEnemySprite(type) {
        const config = ENEMY_TYPES[type];
        const container = new PIXI.Container();
        let body;
        let baseScaleX, baseScaleY;

        // Try themed enemy sprite first, then fallback to base
        // Supporte les variants (array) : choisit un skin aléatoire
        const themedEntry = this.currentTheme ? this.currentTheme.enemies[type] : null;
        let themedKey = themedEntry;
        if (Array.isArray(themedEntry)) {
            const pick = themedEntry[Math.floor(Math.random() * themedEntry.length)];
            themedKey = pick;
        }
        const themeId = this.currentTheme ? this.currentTheme.id : null;
        const enemyTex = (themedKey && themeId ? this.assets[`${themedKey}_${themeId}`] : null)
                      || (themedKey ? this._getThemedAsset(themedKey) : null)
                      || this.assets[`enemy_${type}`];

        // Spritesheet animé générique : {themedKey}_{themeId}_anim_frames
        const animFrames = (themedKey && themeId)
            ? this.assets[`${themedKey}_${themeId}_anim_frames`]
            : null;

        if (animFrames) {
            body = new PIXI.AnimatedSprite(animFrames);
            const anchorY = this.currentTheme?.enemyAnchors?.[type] ?? config.anchorY;
            body.anchor.set(0.5, anchorY);
            const eRef = TILE_WIDTH;
            const eScale = (this.currentTheme?.enemyScale) || 1.0;
            const eTypeScale = (this.currentTheme?.enemyScales?.[type]) || 1.0;
            const eSpriteScale = (this.currentTheme?.spriteScales?.[themedKey]) || 1.0;
            body.height = eRef * config.size * 0.9 * eScale * eTypeScale * eSpriteScale;
            body.scale.x = body.scale.y;
            baseScaleX = body.scale.x;
            baseScaleY = body.scale.y;
            body.animationSpeed = 0.15;
            body.play();
        } else if (enemyTex) {
            body = new PIXI.Sprite(enemyTex);
            const anchorY = this.currentTheme?.enemyAnchors?.[type] ?? config.anchorY;
            body.anchor.set(0.5, anchorY);
            const eRef = TILE_WIDTH;
            const eScale = (this.currentTheme && this.currentTheme.enemyScale) || 1.0;
            const eTypeScale = (this.currentTheme && this.currentTheme.enemyScales && this.currentTheme.enemyScales[type]) || 1.0;
            const eSpriteScale = (this.currentTheme?.spriteScales?.[themedKey]) || 1.0;
            body.height = eRef * config.size * 0.9 * eScale * eTypeScale * eSpriteScale;
            body.scale.x = body.scale.y; // ratio conservé
            baseScaleX = body.scale.x;
            baseScaleY = body.scale.y;
        } else {
            body = new PIXI.Graphics();
            const size = 18 * config.size;
            body.circle(0, -size * 0.6, size);
            body.fill({ color: config.color });
            body.stroke({ width: 3, color: 0x333333 });

            const eyeSize = size * 0.25;
            body.circle(-size * 0.35, -size * 0.8, eyeSize);
            body.circle(size * 0.35, -size * 0.8, eyeSize);
            body.fill({ color: 0xffffff });
            body.circle(-size * 0.35, -size * 0.75, eyeSize * 0.5);
            body.circle(size * 0.35, -size * 0.75, eyeSize * 0.5);
            body.fill({ color: 0x333333 });

            baseScaleX = 1;
            baseScaleY = 1;
        }
        container.addChild(body);

        // HP bar
        const hpBar = new PIXI.Graphics();
        hpBar.y = -(TILE_WIDTH * 0.62 * config.size);
        container.addChild(hpBar);

        return { sprite: container, body, hpBar, baseScaleX, baseScaleY };
    }

    addEnemyToStage(enemy) {
        const iso = toIso(enemy.x, enemy.y);
        enemy.sprite.x = iso.x;
        enemy.sprite.y = iso.y + TILE_HEIGHT / 2;
        if (enemy.flying) enemy.sprite._flying = true;
        this.entityLayer.addChild(enemy.sprite);
        this.updateEnemyHpBar(enemy);
        this.sortEntities();
    }

    removeEnemyFromStage(enemy) {
        this.entityLayer.removeChild(enemy.sprite);
    }

    updateEnemyPosition(enemy) {
        const cur    = enemy.route?.[enemy.pathIndex];
        const nxt    = enemy.route?.[enemy.pathIndex + 1];
        const scrCur = enemy._screenRoute?.[enemy.pathIndex];
        const scrNxt = enemy._screenRoute?.[enemy.pathIndex + 1];

        let screenX, screenY;

        if (cur && nxt && scrCur && scrNxt) {
            // Interpolation linéaire en espace screen entre les deux waypoints courants.
            // Évite le zigzag du stagger lors de segments à même colonne.
            const sdx     = nxt.x - cur.x;
            const sdy     = nxt.y - cur.y;
            const segLen2 = sdx * sdx + sdy * sdy;
            const ex      = enemy.x - cur.x;
            const ey      = enemy.y - cur.y;
            const t       = segLen2 > 0 ? Math.min(1, Math.max(0, (ex * sdx + ey * sdy) / segLen2)) : 0;

            screenX = scrCur.x + (scrNxt.x - scrCur.x) * t;
            screenY = scrCur.y + (scrNxt.y - scrCur.y) * t;

            // Direction depuis l'espace screen (plus précis que le dx grid)
            const faceDx = scrNxt.x - scrCur.x;
            if (Math.abs(faceDx) > 0.01) enemy._facingLeft = faceDx < 0;
        } else {
            const iso = toIso(enemy.x, enemy.y);
            screenX = iso.x;
            screenY = iso.y;
        }

        enemy.sprite.x = screenX;
        enemy.sprite.y = screenY + TILE_HEIGHT / 2;
    }

    updateEnemyAnimation(enemy, now) {
        const bsx = enemy.baseScaleX || 1;
        const bsy = enemy.baseScaleY || 1;
        const flipX = enemy._facingLeft ? -1 : 1;

        if (enemy.flying) {
            // Flying: higher hover + wing flap effect
            const hover = Math.sin(now * 0.008 + enemy.id) * 8 + 12;
            enemy.body.y = -hover;
            const wingFlap = 1 + Math.sin(now * 0.025 + enemy.id) * 0.12;
            enemy.body.scale.set(bsx * wingFlap * flipX, bsy / wingFlap);
            enemy.body.rotation = Math.sin(now * 0.004 + enemy.id) * 0.15;
        } else if (enemy.body instanceof PIXI.AnimatedSprite) {
            // Spritesheet animé : l'animation est gérée par les frames, juste le flip directionnel
            enemy.body.scale.set(bsx * flipX, bsy);
        } else if (enemy.type === 'boss') {
            // Boss: slow heavy walk, minimal bounce
            const bounce = Math.sin(now * 0.006 + enemy.id) * 0.3 + 0.3;
            enemy.body.y = bounce * -2;
            const stretch = 1 + Math.sin(now * 0.006 + enemy.id) * 0.03;
            enemy.body.scale.set((bsx / stretch) * flipX, bsy * stretch);
            enemy.body.rotation = Math.sin(now * 0.003 + enemy.id * 1.5) * 0.03;
        } else {
            // Ground: normal bounce
            const bounce = Math.sin(now * 0.012 + enemy.id) * 0.5 + 0.5;
            enemy.body.y = bounce * -4;
            const stretch = 1 + Math.sin(now * 0.012 + enemy.id) * 0.08;
            enemy.body.scale.set((bsx / stretch) * flipX, bsy * stretch);
            enemy.body.rotation = Math.sin(now * 0.006 + enemy.id * 1.5) * 0.1;
        }
    }

    updateEnemyTint(enemy, isSlow) {
        const DARK = 0x334477;
        if (this._litTiles) {
            const key = `${Math.floor(enemy.x)},${Math.floor(enemy.y)}`;
            if (!this._litTiles.has(key)) {
                enemy.body.tint = DARK;
                return;
            }
        }
        enemy.body.tint = isSlow ? 0x87CEEB : 0xffffff;
    }

    updateEnemyHpBar(enemy) {
        const bar = enemy.hpBar;
        bar.clear();
        const width = TILE_WIDTH * 0.45;
        const height = Math.max(5, TILE_WIDTH * 0.055);
        const ratio = Math.max(0, enemy.hp / enemy.maxHp);

        const r = Math.max(2, height * 0.4);
        bar.roundRect(-width/2 - 1, -1, width + 2, height + 2, r);
        bar.fill({ color: 0x222222 });
        bar.roundRect(-width/2, 0, width * ratio, height, r);
        bar.fill({ color: ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c });
    }

    createProjectileSprite(towerType) {
        const animFrames = this.assets[`proj_${towerType}_anim_frames`];
        if (animFrames) {
            const sprite = new PIXI.AnimatedSprite(animFrames);
            sprite.anchor.set(0.5, 0.5);
            const base = TILE_WIDTH * (towerType === 'fauconnier' ? 0.40 : 0.22);
            sprite.width = base;
            sprite.height = base;
            sprite.animationSpeed = 0.2;
            sprite.play();
            return sprite;
        }

        const QUIZ_TOWERS = ['fire', 'ice', 'cannon'];
        let assetKey = `proj_${towerType}`;
        let cadence = null;
        if (QUIZ_TOWERS.includes(towerType)) {
            cadence = TOWER_TYPES[towerType]?.cadence || 'balanced';
            const cadenceKey = `proj_${towerType}_${cadence}`;
            if (this.assets[cadenceKey]) assetKey = cadenceKey;
        }
        if (this.assets[assetKey]) {
            const sprite = new PIXI.Sprite(this.assets[assetKey]);
            sprite.anchor.set(0.5, 0.5);
            const base = TILE_WIDTH * 0.22;
            const cadenceScale = cadence === 'slow' ? 3.8 : cadence === 'fast' ? 0.75 : 1.4;
            const cannonFastScale = cadence === 'fast' ? 1.2 : cadenceScale;
            const fireFastScale   = cadence === 'fast' ? 1.0 : cadenceScale;
            const size = towerType === 'cannon' ? base * (cadence ? cannonFastScale : 1.3)
                       : towerType === 'fire'   ? base * (cadence ? fireFastScale   : cadenceScale)
                       : QUIZ_TOWERS.includes(towerType) ? base * cadenceScale
                       : base;
            sprite.width = size;
            sprite.height = size;
            return sprite;
        }

        // Fallback to graphics
        const colors = {
            archer: 0xFFD700,
            cannon: 0x333333,
            ice: 0x00FFFF,
            sniper: 0xFF4444,
            fire: 0xFF6B35
        };
        const sprite = new PIXI.Graphics();
        sprite.circle(0, 0, TILE_WIDTH * 0.05);
        sprite.fill({ color: colors[towerType] || 0xFFFFFF });
        return sprite;
    }

    addProjectileToStage(proj, towerX, towerY) {
        const iso = toIso(towerX, towerY);
        proj.sprite.x = iso.x;
        proj.sprite.y = iso.y - TILE_WIDTH * 0.08;
        this.projectileLayer.addChild(proj.sprite);
    }

    removeProjectileFromStage(proj) {
        this.projectileLayer.removeChild(proj.sprite);
    }

    updateProjectilePosition(proj) {
        const iso = toIso(proj.x, proj.y);
        proj.sprite.x = iso.x;
        proj.sprite.y = iso.y;
    }

    // Tower shooting bounce animation
    animateTowerShot(tower) {
        if (!tower.sprite) return;
        const bsx = tower.baseScaleX || tower.sprite.scale.x;
        const bsy = tower.baseScaleY || tower.sprite.scale.y;
        tower.sprite.scale.set(bsx * 1.15, bsy * 1.15);
        setTimeout(() => {
            if (tower.sprite) tower.sprite.scale.set(bsx, bsy);
        }, 100);
    }

    createMuzzleFlash(tower, target) {
        const iso = toIso(tower.x, tower.y);
        const targetIso = toIso(target.x, target.y);

        const dx = targetIso.x - iso.x;
        const dy = targetIso.y - iso.y;
        const angle = Math.atan2(dy, dx);

        const colors = {
            archer: 0xFFFF00,
            cannon: 0xFF6600,
            ice: 0x00FFFF,
            sniper: 0xFF0000,
            wind: 0xA8E6CF,
            cemetery: 0x4ECDC4
        };

        const flash = new PIXI.Graphics();

        if (tower.type === 'cannon') {
            flash.circle(0, 0, 12);
            flash.fill({ color: colors.cannon, alpha: 0.8 });
            flash.circle(0, 0, 8);
            flash.fill({ color: 0xFFFF00, alpha: 0.9 });
        } else if (tower.type === 'sniper') {
            flash.moveTo(0, 0);
            flash.lineTo(Math.cos(angle) * 25, Math.sin(angle) * 15);
            flash.stroke({ width: 4, color: colors.sniper, alpha: 0.8 });
        } else {
            flash.star(0, 0, 4, 10, 5);
            flash.fill({ color: colors[tower.type] || 0xFFFFFF, alpha: 0.8 });
        }

        flash.x = iso.x + Math.cos(angle) * 15;
        flash.y = iso.y - 20 + Math.sin(angle) * 8;
        flash.life = 0.3;
        flash.vx = 0;
        flash.vy = 0;
        flash.isMuzzleFlash = true;
        this.effectLayer.addChild(flash);
        this.particles.push(flash);
    }

    createHitEffect(x, y, type) {
        const iso = toIso(x, y);
        const colors = { archer: 0xFFD700, cannon: 0xFF6600, ice: 0x00FFFF, sniper: 0xFF0000, wind: 0xA8E6CF };

        for (let i = 0; i < 2; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 3);
            particle.fill({ color: colors[type] || 0xFFFFFF });
            particle.x = iso.x + (Math.random() - 0.5) * 20;
            particle.y = iso.y + (Math.random() - 0.5) * 20;
            particle.vx = (Math.random() - 0.5) * 4;
            particle.vy = (Math.random() - 0.5) * 4 - 2;
            particle.life = 1;
            this.effectLayer.addChild(particle);
            this.particles.push(particle);
        }
    }

    createDeathEffect(x, y) {
        const iso = toIso(x, y);

        for (let i = 0; i < 4; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 5);
            particle.fill({ color: 0xFFD700 });
            particle.x = iso.x;
            particle.y = iso.y;
            particle.vx = (Math.random() - 0.5) * 6;
            particle.vy = -Math.random() * 5 - 2;
            particle.life = 1;
            this.effectLayer.addChild(particle);
            this.particles.push(particle);
        }

        const poof = new PIXI.Graphics();
        poof.circle(0, 0, 12);
        poof.fill({ color: 0xffffff, alpha: 0.4 });
        poof.x = iso.x;
        poof.y = iso.y;
        poof.life = 0.25;
        poof.vx = 0;
        poof.vy = 0;
        poof.isPoof = true;
        this.effectLayer.addChild(poof);
        this.particles.push(poof);
    }

    createPlaceEffect(x, y) {
        for (let i = 0; i < 8; i++) {
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 4);
            particle.fill({ color: 0x4ECDC4 });
            particle.x = x;
            particle.y = y;
            const angle = (i / 8) * Math.PI * 2;
            particle.vx = Math.cos(angle) * 3;
            particle.vy = Math.sin(angle) * 3;
            particle.life = 1;
            this.effectLayer.addChild(particle);
            this.particles.push(particle);
        }
    }

    createDamageEffect() {
        const flash = new PIXI.Graphics();
        flash.rect(0, 0, this.app.screen.width, this.app.screen.height);
        flash.fill({ color: 0xff0000, alpha: 0.3 });
        flash.life = 0.3;
        flash.vx = 0;
        flash.vy = 0;
        flash.isFlash = true;
        this.app.stage.addChild(flash);
        this.particles.push(flash);
    }

    createNukeFlash() {
        const flash = new PIXI.Graphics();
        flash.rect(0, 0, this.app.screen.width, this.app.screen.height);
        flash.fill({ color: 0xffffff, alpha: 0.5 });
        flash.life = 0.4;
        flash.vx = 0;
        flash.vy = 0;
        flash.isFlash = true;
        this.app.stage.addChild(flash);
        this.particles.push(flash);
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (p.isWindPulse) {
                // Expanding ring effect
                const progress = 1 - (p.life / 1.2);
                const radius = p._startRadius + (p._maxRadius - p._startRadius) * progress;
                p.clear();
                p.circle(0, 0, radius);
                p.stroke({ width: 2 * p.life, color: 0xA8E6CF, alpha: p.life * 0.6 });
            } else if (p.isLevelUp) {
                p.y += p.vy;
                p.alpha = Math.min(1, p.life);
                p.scale.set(1 + (2 - p.life) * 0.1);
            } else if (p.isPoof) {
                p.scale.set(p.scale.x + dt * 0.15);
                p.alpha = p.life * 2;
            } else if (p.isFlash) {
                p.alpha = p.life;
            } else if (p.isMuzzleFlash) {
                p.alpha = p.life * 2;
                p.scale.set(p.life * 1.5);
            } else {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2;
                p.alpha = p.life;
                p.scale.set(p.life);
            }

            p.life -= dt * 0.04;

            if (p.life <= 0) {
                if (p.isFlash) {
                    this.app.stage.removeChild(p);
                } else {
                    this.effectLayer.removeChild(p);
                }
                this.particles.splice(i, 1);
            }
        }
    }

    createHandEffect(enemy, duration) {
        if (!this.assets['hands_cemetery']) return;
        const tex = this.assets['hands_cemetery'];
        const sprite = new PIXI.Sprite(tex);
        // Ancre en bas au centre : les mains montent depuis le sol
        sprite.anchor.set(0.5, 1.0);
        sprite._targetPx = TILE_HEIGHT * 0.55;
        sprite._texW = tex.width || 256;
        sprite.scale.x = sprite._targetPx / sprite._texW;
        sprite.scale.y = 0;
        // Position fixe sur la tuile (pas sur l'ennemi qui se déplace)
        const iso = toIso(Math.round(enemy.x), Math.round(enemy.y));
        sprite._isoX = iso.x;
        sprite._isoY = iso.y + TILE_HEIGHT / 2;
        sprite.x = sprite._isoX;
        sprite.y = sprite._isoY;

        // Masque fixe : cache tout ce qui est sous la surface de la tuile
        const mask = new PIXI.Graphics();
        mask.rect(sprite._isoX - TILE_WIDTH * 2, sprite._isoY - TILE_HEIGHT * 6, TILE_WIDTH * 4, TILE_HEIGHT * 6);
        mask.fill(0xFFFFFF);
        this.effectLayer.addChild(mask);
        sprite.mask = mask;
        sprite._graspMask = mask;

        sprite._duration = duration;
        sprite._born = performance.now();
        this.effectLayer.addChild(sprite);
        this.graspEffects.push(sprite);
    }

    updateGraspEffects(now) {
        for (let i = this.graspEffects.length - 1; i >= 0; i--) {
            const s = this.graspEffects[i];
            const elapsed = now - s._born;
            const progress = elapsed / s._duration;

            if (progress >= 1) {
                this.effectLayer.removeChild(s);
                if (s._graspMask) {
                    this.effectLayer.removeChild(s._graspMask);
                    s._graspMask.destroy();
                }
                s.destroy();
                this.graspEffects.splice(i, 1);
                continue;
            }

            // Emerge : monte en 20%, tient, redescend en 20%
            let env;
            if (progress < 0.2) env = progress / 0.2;
            else if (progress > 0.8) env = (1 - progress) / 0.2;
            else env = 1;

            const baseScale = s._targetPx / s._texW;
            s.scale.set(baseScale);
            s.alpha = Math.min(env * 2, 1);

            // Translation : les mains montent depuis sous le sol vers la surface
            // env=0 → sprite enterré (y = isoY + targetPx), env=1 → sorti (y = isoY)
            s.x = s._isoX;
            s.y = s._isoY + s._targetPx * (1 - env);
        }
    }

    updateWindAnimation(now) {
        for (const tree of this.treeSprites) {
            const wind = Math.sin(now * 0.001 * tree._windSpeed + tree._windPhase);
            const gust = Math.sin(now * 0.0025 + tree._windPhase * 2) * 0.3;
            tree.skew.x = (wind + gust) * 0.06;
            tree.scale.x = tree._baseScaleX * (1 + wind * 0.02);
        }
    }

    toIso(x, y) {
        return toIso(x, y);
    }

    showRangePreview(x, y, towerType) {
        this.hideRangePreview();

        const iso = toIso(x, y);
        const range = TOWER_TYPES[towerType].range;

        const preview = new PIXI.Graphics();
        preview.circle(iso.x, iso.y + TILE_HEIGHT / 2, range * (TILE_WIDTH + TILE_HEIGHT) / 2 * 0.7);
        preview.fill({ color: 0x00ff00, alpha: 0.15 });
        preview.stroke({ width: 2, color: 0x00ff00, alpha: 0.4 });

        preview.name = 'rangePreview';
        this.rangeLayer.addChild(preview);
    }

    showTowerRangePreview(tower) {
        this.hideRangePreview();
        const iso = toIso(tower.x, tower.y);
        const preview = new PIXI.Graphics();
        preview.circle(iso.x, iso.y + TILE_HEIGHT / 2, tower.range * (TILE_WIDTH + TILE_HEIGHT) / 2 * 0.7);
        preview.fill({ color: 0x4ECDC4, alpha: 0.12 });
        preview.stroke({ width: 2, color: 0x4ECDC4, alpha: 0.5 });
        preview.name = 'rangePreview';
        this.rangeLayer.addChild(preview);
    }

    hideRangePreview() {
        const preview = this.rangeLayer.getChildByName('rangePreview');
        if (preview) this.rangeLayer.removeChild(preview);
    }

    showGhostTower(x, y, towerType, orientation) {
        // Reuse existing ghost if same type+orientation, just reposition
        if (this.ghostSprite && this.ghostType === towerType && this.ghostOrientation === orientation) {
            const iso = toIso(x, y);
            this.ghostSprite.x = iso.x;
            this.ghostSprite.y = iso.y + TILE_HEIGHT / 2;
            this.ghostSprite.visible = true;
            return;
        }

        this.hideGhostTower();

        const { sprite } = this.createTowerSprite(towerType, orientation);
        sprite.alpha = 0.5;
        sprite.eventMode = 'none';

        const iso = toIso(x, y);
        sprite.x = iso.x;
        sprite.y = iso.y + TILE_HEIGHT / 2;

        this.entityLayer.addChild(sprite);
        this.ghostSprite = sprite;
        this.ghostType = towerType;
        this.ghostOrientation = orientation;
    }

    hideGhostTower() {
        if (this.ghostSprite) {
            this.entityLayer.removeChild(this.ghostSprite);
            this.ghostSprite.destroy({ children: true });
            this.ghostSprite = null;
            this.ghostType = null;
            this.ghostOrientation = null;
        }
    }

    setTileHoverTint(tile, canPlace) {
        tile.tint = canPlace ? 0x88ff88 : 0xff8888;
    }

    setTrapHoverTint(tile) {
        tile.tint = 0xffaa44;
    }

    clearTileHoverTint(tile) {
        if (this._litTiles) {
            const key = `${tile.gridX},${tile.gridY}`;
            tile.tint = this._litTiles.has(key) ? (tile.originalTint || 0xffffff) : 0x334477;
        } else {
            tile.tint = tile.originalTint || 0xffffff;
        }
    }

    applyStunTint(tower) {
        if (!tower.sprite) return;
        tower.sprite.tint = 0x88ccff;
        const check = () => {
            if (!tower.sprite) return;
            if (performance.now() < tower.stunnedUntil) {
                tower.sprite.tint = (Math.floor(performance.now() / 200) % 2 === 0) ? 0x88ccff : 0xaaddff;
                requestAnimationFrame(check);
            } else {
                tower.sprite.tint = 0xffffff;
            }
        };
        requestAnimationFrame(check);
    }

    showStunCloud(tower, duration) {
        const frames = this.assets['stun_cloud_frames'];
        if (!frames) return;
        const iso = toIso(tower.x, tower.y);
        const sprite = new PIXI.AnimatedSprite(frames);
        sprite.anchor.set(0.5, 1);
        sprite.width  = TILE_WIDTH * 1.1;
        sprite.height = TILE_HEIGHT * 2.0;
        sprite.x = iso.x;
        sprite.y = iso.y + TILE_HEIGHT / 2;
        sprite.animationSpeed = 0.15;
        sprite.loop = true;
        this.entityLayer.addChild(sprite);
        sprite.play();
        setTimeout(() => sprite.destroy(), duration);
    }

    playBansheeScream(enemy) {
        const screamFrames = this.assets['banshee_scream_frames'];
        if (!screamFrames || !enemy.body || !(enemy.body instanceof PIXI.AnimatedSprite)) return;
        const walkFrames = enemy.body.textures;
        enemy.body.textures = screamFrames;
        enemy.body.loop = false;
        enemy.body.onComplete = () => {
            if (!enemy.body) return;
            enemy.body.textures = walkFrames;
            enemy.body.loop = true;
            enemy.body.onComplete = null;
            enemy.body.play();
        };
        enemy.body.gotoAndPlay(0);
    }

    highlightTowerSprite(tower) {
        if (tower.sprite) tower.sprite.tint = 0xaaffaa;
    }

    unhighlightTowerSprite(tower) {
        if (tower.sprite) tower.sprite.tint = 0xffffff;
    }

    _getFireFrames(lvlKey, orientation) {
        // Variant préféré selon l'orientation
        const preferred = orientation === 'front' ? 'front'
            : orientation === 'back' ? 'back_front'
            : orientation === 'side' ? 'back_left'
            : 'left';
        // Fallback: back_front → front, back_left → left
        const fallback = preferred === 'back_front' ? 'front'
            : preferred === 'back_left' ? 'left'
            : preferred;
        const tryVariant = (v) =>
            Array.from({length: 16}, (_, i) => this.assets[`tower_fire_anim${lvlKey}_${v}_${i}`]).filter(Boolean);
        const frames = tryVariant(preferred);
        return frames.length === 16 ? frames : tryVariant(fallback);
    }

    updateTowerSprite(tower) {
        if (tower.level <= 1) return;
        if (!tower.sprite) return;

        const orientation = tower.orientation || 'front';

        // Fire tower lvl2+: AnimatedSprite avec fallback variant
        if (tower.type === 'fire' && tower.level >= 2) {
            const lvlKey = `_lvl${tower.level}`;
            const frames = this._getFireFrames(lvlKey, orientation);
            if (frames.length > 0) {
                if (tower.sprite instanceof PIXI.AnimatedSprite) tower.sprite.stop();
                const oldSprite = tower.sprite;
                const newSprite = new PIXI.AnimatedSprite(frames);
                newSprite.anchor.set(0.5, 0.85);
                const tRef = TILE_WIDTH;
                const tScale = (this.currentTheme && this.currentTheme.towerScale) || 1.0;
                const lvlScale = tower.level >= 3 ? 1.35 : 1.0;
                const targetSize = tRef * 1.1 * tScale * lvlScale;
                const texW = frames[0].width || 256;
                const texH = frames[0].height || 256;
                newSprite.scale.set(-(targetSize / texW), targetSize / texH);
                newSprite.x = oldSprite.x;
                newSprite.y = oldSprite.y;
                newSprite.animationSpeed = 0.08;
                newSprite.play();
                oldSprite.parent.addChild(newSprite);
                oldSprite.parent.removeChild(oldSprite);
                tower.sprite = newSprite;
                tower.baseScaleX = newSprite.scale.x;
                tower.baseScaleY = newSprite.scale.y;
                return;
            }
        }

        // Autres tours : sprite statique
        const dirKey = `tower_${tower.type}_lvl${tower.level}_${orientation}`;
        const lvlKey = `tower_${tower.type}_lvl${tower.level}`;
        const texture = this.assets[dirKey] || this.assets[lvlKey];
        if (!texture) return;

        if (tower.sprite instanceof PIXI.AnimatedSprite) {
            tower.sprite.stop();
        }
        tower.sprite.texture = texture;
    }

    createLevelUpEffect(tower) {
        const iso = toIso(tower.x, tower.y);
        const cx = iso.x;
        const cy = iso.y + TILE_HEIGHT / 2;

        // Golden particles burst
        for (let i = 0; i < 14; i++) {
            const particle = new PIXI.Graphics();
            particle.star(0, 0, 5, 6, 3);
            particle.fill({ color: 0xFFD700 });
            particle.x = cx;
            particle.y = cy - 20;
            const angle = (i / 14) * Math.PI * 2;
            particle.vx = Math.cos(angle) * 4;
            particle.vy = Math.sin(angle) * 4 - 2;
            particle.life = 1.5;
            this.effectLayer.addChild(particle);
            this.particles.push(particle);
        }

        // "LVL UP!" floating text
        const text = new PIXI.Text({
            text: `LVL ${tower.level}!`,
            style: {
                fontSize: 16,
                fontWeight: 'bold',
                fill: 0xFFD700,
                stroke: { color: 0x000000, width: 3 },
                dropShadow: { color: 0x000000, blur: 2, distance: 1 }
            }
        });
        text.anchor.set(0.5);
        text.x = cx;
        text.y = cy - 30;
        text.vx = 0;
        text.vy = -1.5;
        text.life = 2;
        text.isLevelUp = true;
        this.effectLayer.addChild(text);
        this.particles.push(text);
    }

    drawTowerXpBar(tower) {
        if (!tower.sprite) return;
        // Create XP bar graphics attached to tower
        if (!tower._xpBar) {
            tower._xpBar = new PIXI.Graphics();
            this.entityLayer.addChild(tower._xpBar);
        }
        this.updateTowerXpBar(tower);
    }

    updateTowerXpBar(tower) {
        if (!tower._xpBar) {
            tower._xpBar = new PIXI.Graphics();
            this.entityLayer.addChild(tower._xpBar);
        }
        const bar = tower._xpBar;
        bar.clear();

        // Hide bar if max level
        if (tower.level >= 3) {
            bar.visible = false;
            return;
        }
        bar.visible = true;

        const iso = toIso(tower.x, tower.y);
        const width = 24;
        const height = 4;
        const cx = iso.x;
        const cy = iso.y + TILE_HEIGHT / 2 + 8;
        const ratio = Math.min(1, tower.xp / tower.xpToLevel);

        bar.roundRect(cx - width / 2 - 1, cy - 1, width + 2, height + 2, 1);
        bar.fill({ color: 0x222222, alpha: 0.7 });
        if (ratio > 0) {
            bar.roundRect(cx - width / 2, cy, width * ratio, height, 1);
            bar.fill({ color: 0x9b59b6 });
        }
    }

    removeTowerXpBar(tower) {
        if (tower._xpBar) {
            this.entityLayer.removeChild(tower._xpBar);
            tower._xpBar = null;
        }
    }

    // worldX/Y = coordonnées grille de l'ennemi (peuvent être fractionnaires)
    // facingRight = true si l'ennemi se déplace vers la droite sur le chemin
    heroTeleportAttack(worldX, worldY, facingRight, frames, onSound, onHit, onDone) {
        if (!frames || frames.length === 0) { onDone?.(); return; }

        const iso = toIso(worldX, worldY);
        const px = iso.x;
        const py = iso.y + TILE_HEIGHT / 2;

        const sprite = new PIXI.AnimatedSprite(frames);
        sprite.anchor.set(0.5, 0.9);
        const size = TILE_WIDTH * 1.2;
        sprite.width  = size;
        sprite.height = size;
        if (!facingRight) sprite.scale.x *= -1;
        sprite.animationSpeed = 0.22;
        sprite.loop = false;
        sprite.alpha = 0;
        sprite.x = px;
        sprite.y = py + 55;

        const n = frames.length;
        const soundFrame   = Math.floor(n * 0.30); // son en avance sur l'impact
        const hitFrame     = Math.floor(n * 0.55);
        const fadeOutStart = n - 2;

        sprite.onFrameChange = (f) => {
            if (f <= 2) {
                sprite.alpha = f / 2;
                sprite.y = py + 55 * (1 - f / 2);
            } else {
                sprite.alpha = 1;
                sprite.y = py;
            }
            if (f === soundFrame) onSound?.();
            if (f === hitFrame)   onHit?.();
            if (f >= fadeOutStart) {
                sprite.alpha = Math.max(0, (n - f) / 2);
            }
        };

        sprite.onComplete = () => {
            this.entityLayer.removeChild(sprite);
            onDone?.();
        };

        this.entityLayer.addChild(sprite);
        sprite.play();
        this.sortEntities();
    }

    createHeroAttackFlash() {
        // Flash vert plein écran dans l'effectLayer
        const flash = new PIXI.Graphics();
        const w = (this.app.screen.width  + Math.abs(this.offsetX) * 2) / this.mapScale;
        const h = (this.app.screen.height + Math.abs(this.offsetY) * 2) / this.mapScale;
        flash.rect(-w / 2, -h / 2, w * 2, h * 2);
        flash.fill({ color: 0x55EE88, alpha: 0.55 });
        this.effectLayer.addChild(flash);

        let alpha = 0.55;
        const fade = () => {
            alpha -= 0.035;
            if (alpha <= 0) {
                this.effectLayer.removeChild(flash);
            } else {
                flash.alpha = alpha;
                requestAnimationFrame(fade);
            }
        };
        requestAnimationFrame(fade);
    }

    createWindPulseEffect(tower) {
        const iso = toIso(tower.x, tower.y);
        const cx = iso.x;
        const cy = iso.y + TILE_HEIGHT / 2;

        // Expanding ring
        const ring = new PIXI.Graphics();
        ring.circle(0, 0, 10);
        ring.stroke({ width: 3, color: 0xA8E6CF, alpha: 0.8 });
        ring.x = cx;
        ring.y = cy;
        ring.life = 1.2;
        ring.vx = 0;
        ring.vy = 0;
        ring.isWindPulse = true;
        ring._maxRadius = tower.range * (TILE_WIDTH + TILE_HEIGHT) / 2 * 0.7;
        ring._startRadius = 10;
        this.effectLayer.addChild(ring);
        this.particles.push(ring);

        // Spiral particles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const particle = new PIXI.Graphics();
            particle.circle(0, 0, 3);
            particle.fill({ color: 0xA8E6CF });
            particle.x = cx;
            particle.y = cy;
            particle.vx = Math.cos(angle) * 3;
            particle.vy = Math.sin(angle) * 2;
            particle.life = 0.8;
            this.effectLayer.addChild(particle);
            this.particles.push(particle);
        }
    }

    createPushbackEffect(enemy) {
        const iso = toIso(enemy.x, enemy.y);

        for (let i = 0; i < 4; i++) {
            const line = new PIXI.Graphics();
            const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
            const len = 8 + Math.random() * 6;
            line.moveTo(0, 0);
            line.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
            line.stroke({ width: 2, color: 0xA8E6CF, alpha: 0.9 });
            line.x = iso.x + (Math.random() - 0.5) * 12;
            line.y = iso.y + (Math.random() - 0.5) * 12;
            line.vx = Math.cos(angle) * 2;
            line.vy = Math.sin(angle) * 1.5;
            line.life = 0.6;
            this.effectLayer.addChild(line);
            this.particles.push(line);
        }
    }

    animateWindTowers(towers, now) {
        // No-op for now (wind tower uses standard sprite)
    }

    sortEntities() {
        this.entityLayer.children.sort((a, b) => {
            // Flying enemies always render on top of everything
            if (a._flying && !b._flying) return 1;
            if (!a._flying && b._flying) return -1;
            // _sortY : position au sol (les décos ont un décalage d'ancrage à ignorer)
            return (a._sortY ?? a.y) - (b._sortY ?? b.y);
        });
    }

    showFloatingDamage(x, y, amount, container) {
        const iso = toIso(x, y);
        const rect = this.app.canvas.getBoundingClientRect();
        const s = this.mapScale;

        const el = document.createElement('div');
        el.className = 'damage-number';
        el.textContent = `-${Math.floor(amount)}`;
        el.style.left = `${rect.left + this.offsetX + iso.x * s + (Math.random() - 0.5) * 30}px`;
        el.style.top = `${rect.top + this.offsetY + iso.y * s - 20}px`;

        container.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }

    showFloatingGold(x, y, amount, container) {
        const iso = toIso(x, y);
        const rect = this.app.canvas.getBoundingClientRect();
        const s = this.mapScale;

        const el = document.createElement('div');
        el.className = 'damage-number gold';
        el.textContent = `+${amount}💰`;
        el.style.left = `${rect.left + this.offsetX + iso.x * s}px`;
        el.style.top = `${rect.top + this.offsetY + iso.y * s - 30}px`;

        container.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
}
