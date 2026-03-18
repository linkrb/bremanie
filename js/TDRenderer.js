import {
    TILE_WIDTH, TILE_HEIGHT, GRID_WIDTH, GRID_HEIGHT,
    TOWER_TYPES, ENEMY_TYPES, LEVELS, toIso
} from './tdConfig.js';

export class TDRenderer {
    constructor() {
        this.app = null;
        this.assets = {};
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
    }

    async init(container) {
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.app = new PIXI.Application();
        await this.app.init({
            width,
            height,
            backgroundColor: 0x1a1a2e,
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
        // Hauteur : GRID_HEIGHT rangées × TH/4 (advance) + TH/2 (marge : demi-losange haut+bas)
        const mapWidth  = GRID_WIDTH * TILE_WIDTH + TILE_WIDTH / 2;
        const mapHeight = GRID_HEIGHT * (TILE_HEIGHT / 4) + TILE_HEIGHT / 2;

        const pad = this.app.screen.width < 600 ? 4 : 10;
        const scaleX = (this.app.screen.width  - pad * 2) / mapWidth;
        const scaleY = (this.app.screen.height - pad * 2) / mapHeight;
        this.mapScale = Math.min(scaleX, scaleY, 1.5);

        // Centrage horizontal simple (pas de décalage isoOriginX)
        this.offsetX = (this.app.screen.width  - mapWidth  * this.mapScale) / 2;

        // Centrage vertical : la grille va de sprite.y=0 (row 0) à sprite.y=(GH-1)*TH/4 (last row)
        const gridCenterY = ((GRID_HEIGHT - 1) / 2) * (TILE_HEIGHT / 4);
        this.offsetY = this.app.screen.height / 2 - gridCenterY * this.mapScale;

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
        // Tower sprites (4 orientations × 3 niveaux)
        for (const type of ['archer', 'mage', 'light']) {
            const base = `/bremanie/images/td/towers/${type}`;
            for (const variant of ['front', 'side', 'left', 'back']) {
                try {
                    const tex = await PIXI.Assets.load(`${base}/tower_${type}_${variant}.png`);
                    this.assets[`tower_${type}_${variant}`] = tex;
                } catch (e) { }
            }
            for (const lvl of [2, 3]) {
                for (const variant of ['front', 'side', 'left', 'back']) {
                    try {
                        const tex = await PIXI.Assets.load(`${base}/tower_${type}_lvl${lvl}_${variant}.png`);
                        this.assets[`tower_${type}_lvl${lvl}_${variant}`] = tex;
                    } catch (e) { }
                }
            }
        }

        // Fallbacks globaux (tuiles/décors/château/ennemis pour niveaux sans dossier thématique)
        for (const name of ['tile_grass', 'castle', 'tree', 'tree_pine',
                            'enemy_basic', 'enemy_fast', 'enemy_tank', 'enemy_boss', 'enemy_flying',
                            'coin', 'heart', 'proj_archer']) {
            try {
                const texture = await PIXI.Assets.load(`/bremanie/images/td/${name}.png`);
                this.assets[name] = texture;
            } catch (e) { }
        }

        // Load themed assets for each level
        for (const level of LEVELS) {
            if (!level.theme) continue;
            const themeId = level.theme.id;
            const basePath = `/bremanie/images/td/levels/${themeId}`;

            // Themed tiles
            for (const tileKey of Object.values(level.theme.tiles)) {
                const assetKey = `${tileKey}_${themeId}`;
                try {
                    const tex = await PIXI.Assets.load(`${basePath}/${tileKey}.png`);
                    this.assets[assetKey] = tex;
                } catch (e) { }
            }

            // Themed decorations
            for (const deco of level.theme.decorations) {
                const decoName = typeof deco === 'string' ? deco : deco.name;
                const assetKey = `${decoName}_${themeId}`;
                try {
                    const tex = await PIXI.Assets.load(`${basePath}/${decoName}.png`);
                    this.assets[assetKey] = tex;
                } catch (e) { }
            }

            // Themed enemies — static + spritesheet animé (_walk_right.png) si disponible
            // Si le thème a enemyFolder, les sprites ennemis viennent d'un dossier partagé
            const enemyBasePath = level.theme.enemyFolder
                ? `/bremanie/images/td/${level.theme.enemyFolder}`
                : basePath;
            for (const [type, enemyAsset] of Object.entries(level.theme.enemies)) {
                const assets = Array.isArray(enemyAsset) ? enemyAsset : [enemyAsset];
                for (const name of assets) {
                    const assetKey = `${name}_${themeId}`;
                    // Texture statique
                    try {
                        const tex = await PIXI.Assets.load(`${enemyBasePath}/${name}.png`);
                        this.assets[assetKey] = tex;
                    } catch (e) { }
                    // Spritesheet animé (convention : {name}_walk_right.png)
                    const animKey = `${assetKey}_anim_frames`;
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

            // Themed castle
            try {
                const tex = await PIXI.Assets.load(`${basePath}/castle.png`);
                this.assets[`castle_${themeId}`] = tex;
            } catch (e) { }

            // Scene background image (full map sprite)
            if (level.theme.sceneBg) {
                try {
                    const tex = await PIXI.Assets.load(`${basePath}/${level.theme.sceneBg}.png`);
                    this.assets[`sceneBg_${themeId}`] = tex;
                } catch (e) { }
            }

            // Deco tiles (tuiles avec base iso baked-in)
            if (level.theme.decoTiles) {
                const unique = [...new Set(level.theme.decoTiles.map(d => typeof d === 'string' ? d : d.name))];
                for (const tileName of unique) {
                    const assetKey = `${tileName}_${themeId}`;
                    if (this.assets[assetKey]) continue;
                    try {
                        const tex = await PIXI.Assets.load(`${basePath}/${tileName}.png`);
                        this.assets[assetKey] = tex;
                    } catch(e) {}
                }
            }

            // Grass variants (dédoublonnés)
            if (level.theme.grassVariants) {
                const unique = [...new Set(level.theme.grassVariants)];
                for (const variantKey of unique) {
                    const assetKey = `${variantKey}_${themeId}`;
                    if (this.assets[assetKey]) continue;
                    try {
                        const tex = await PIXI.Assets.load(`${basePath}/grass/${variantKey}.png`);
                        this.assets[assetKey] = tex;
                    } catch (e) { }
                }
            }
        }
    }

    setTheme(levelData) {
        this.currentTheme = levelData.theme || null;
        const bg = this.currentTheme?.bgColor;
        if (bg !== undefined) {
            this.app.renderer.background.color = bg;
            this.app.renderer.background.alpha = 1;
        } else {
            this.app.renderer.background.alpha = 0;
        }
    }

    clearStage() {
        // Remove all children from layers
        this.groundLayer.removeChildren();
        this.entityLayer.removeChildren();
        this.projectileLayer.removeChildren();
        this.effectLayer.removeChildren();
        this.rangeLayer.removeChildren();

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

        for (let y = 1; y < GRID_HEIGHT - 1; y++) {
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
        for (let y = 0; y < GRID_HEIGHT; y++) {
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
                    if (cell.type === 'grass') {
                        // Deco tiles (base iso baked-in) — remplacent la tuile herbe
                        const _onBorder = x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1;
                        const decoTileList = theme?.decoTiles;
                        if (!_onBorder && !sceneBgTex && decoTileList?.length > 0) {
                            if (Math.random() < decoRate) {
                                const entry = decoTileList[Math.floor(Math.random() * decoTileList.length)];
                                const tileName = typeof entry === 'string' ? entry : entry.name;
                                const decoTex = this.assets[`${tileName}_${theme?.id}`];
                                if (decoTex) { texture = decoTex; isDecoTile = true; }
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

                    tile = new PIXI.Sprite(texture);
                    const tileScale = (this.currentTheme && this.currentTheme.tileScale) || 1.0;
                    if (isDecoTile) {
                        tile.anchor.set(0.5, 1.0);
                        tile.width  = TILE_WIDTH * tileScale;
                        tile.scale.y = tile.scale.x; // ratio conservé
                    } else {
                        tile.anchor.set(0.5, 0.5);
                        tile.width  = TILE_WIDTH        * 1.00 * tileScale;
                        tile.height = (TILE_HEIGHT / 2) * 1.00 * tileScale;
                        if (cornerFlip !== 0) tile.scale.x = cornerFlip * Math.abs(tile.scale.x);
                    }

                    if (cell.type === 'spawn') {
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
                tile.gridX = x;
                tile.gridY = y;
                tile.eventMode = 'none';
                // Tuile invisible si un fond scène remplace la grille
                tile.alpha = sceneBgTex ? 0 : 1;
                tile.originalTint = tile.tint || 0xffffff;

                this.groundLayer.addChild(tile);
                this.tileSprites.push(tile);

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
                    const onBorder = x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1;
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

        if (fireFrames.length > 0) {
            sprite = new PIXI.AnimatedSprite(fireFrames);
            sprite.anchor.set(0.5, 0.85);
            const tRef = TILE_WIDTH;
            const tScale = (this.currentTheme && this.currentTheme.towerScale) || 1.0;
            sprite.width = tRef * 1.1 * tScale;
            sprite.height = tRef * 1.1 * tScale;
            sprite.animationSpeed = 0.08; // ~8fps
            sprite.play();
            sprite.scale.x *= -1;
            baseScaleX = sprite.scale.x;
            baseScaleY = sprite.scale.y;
        } else if (texture) {
            sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5, 0.85);
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
        const assetKey = `proj_${towerType}`;
        if (this.assets[assetKey]) {
            const sprite = new PIXI.Sprite(this.assets[assetKey]);
            sprite.anchor.set(0.5, 0.5);
            const base = TILE_WIDTH * 0.22;
            const size = towerType === 'cannon' ? base * 1.3 : towerType === 'fire' ? base * 1.4 : base;
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

    clearTileHoverTint(tile) {
        if (this._litTiles) {
            const key = `${tile.gridX},${tile.gridY}`;
            tile.tint = this._litTiles.has(key) ? (tile.originalTint || 0xffffff) : 0x334477;
        } else {
            tile.tint = tile.originalTint || 0xffffff;
        }
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
            return a.y - b.y;
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
