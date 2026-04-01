import {
    GRID_WIDTH, GRID_HEIGHT,
    TOWER_TYPES, TOWER_DISPLAY, SHOP_ITEMS, LEVELS, ENEMY_TYPES,
    fromIso, toIso
} from './tdConfig.js';
import { TDRenderer } from './TDRenderer.js';
import { TDEngine } from './TDEngine.js';
import { DialogueEngine } from '/bremanie/js/DialogueEngine.js';

export class TowerDefenseGame {
    constructor() {
        this.renderer = new TDRenderer();
        this.engine = new TDEngine();
        this.container = null;
        this.selectedTower = 'archer';
        this.selectedPlacedTower = null;
        this.hoveredTile = null;
        this.shopOpen = false;
        this._continuing = false;
        this._availableTowers = new Set(['archer']);

        // Système de dialogues en jeu
        this.dialogueEngine = new DialogueEngine({
            basePath:     '/bremanie/images/',
            dialoguePath: '/bremanie/dialogues/',
            typeSpeed: 25,
        });
        // Triggers : clé = "level_wave" (ex: "0_1" = level 0 vague 1), valeur = nom du script
        this._dialogueTriggers = {};

        // Callbacks SPA — définis par main.js ou game.html
        this.onScriptedDefeat   = null;
        this.onTutorialVictory  = null;  // (next) — badge victoire interactif avant dialogue
        this.onTutorialWin      = null;  // () — après dialogue tutorial_win
        this.onWaveStarted      = null;  // (waveNumber) — badge, musique, etc.
        this.onWaveCompleted    = null;  // (waveNumber)
        this.onChapter2Win      = null;  // ()
        this.onChapter3Win      = null;  // ()
        this.onChateauWin       = null;  // ()
        this.onChateauBossWin   = null;  // ()
        this.onChateauFinalWin  = null;  // ()
        this.onTornadoSpawned   = null;  // ()
        this.onTowerPlaced      = null;  // () — son de pose
        this.onHeroPunch        = null;  // () — bruitage coup héros
    }

    // Affiche un dialogue en pausant le jeu, puis reprend à la fin
    showDialogue(scriptName, onEnd) {
        this.engine.paused = true;
        this.dialogueEngine.load(scriptName, () => {
            this.engine.paused = false;
            if (onEnd) onEnd();
        });
    }

    // Enregistre un dialogue à déclencher sur une vague précise d'un niveau
    // ex: game.onWaveDialogue(0, 1, 'chapter1/wave1_comment')
    onWaveDialogue(level, wave, scriptName) {
        this._dialogueTriggers[`${level}_${wave}`] = scriptName;
    }

    async init(container) {
        this.container = container || document.getElementById('game-container');

        await this.renderer.init(this.container);
        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);

        this.wireCallbacks();
        this.setupInteraction();
        this.setupTowerButtons();
        this.setupWaveButton();
        this.setupSellButton();
        this.setupSpeedButton();
        this.setupShop();
        this.setupLevelSelector();
        this.setupDevMode();
        this.setupSpawnButtons();

        window.addEventListener('resize', () => this.renderer.handleResize(this.container));

        // Game loop
        this.renderer.app.ticker.add((ticker) => {
            const now = performance.now();
            this.engine.update(ticker.deltaTime, now);
            this.renderer.updateParticles((ticker.deltaTime / 60) * this.engine.gameSpeed);
            this.renderer.updateGraspEffects(now);
            this.renderer.updateWindAnimation(now);
            this.renderer.animateWindTowers(this.engine.towers, now);
            if (this.engine.hero) this.renderer.updateHeroCharge(this.engine.hero.charge, this.engine.hero.maxCharge, now);
            this.renderer.sortEntities();
            this.updateEnemyCount();
        });

        this.updateUI();
    }

    _enterTutorialMode() {
        this._tutorialMode = true;

        // Une seule vague : 8 ennemis basiques
        this.engine.setScriptedBattle([
            [{ type: 'basic', count: 6 }]
        ]);

        // Or de départ après setScriptedBattle (qui remet gold=0)
        this.engine.gold = 150;
        this.engine.health = 15;
        this.engine.maxHealth = 15;

        // N'afficher que la tour Archer
        document.querySelectorAll('.tower-btn').forEach(btn => {
            if (btn.dataset.tower !== 'archer') btn.style.display = 'none';
        });
        const shopBtn = document.getElementById('shop-btn');
        if (shopBtn) shopBtn.style.display = 'none';

        this.updateUI();
    }

    _setupScriptedMode() {
        // Masquer toute l'UI interactive
        const hide = (sel) => document.querySelector(sel)?.style.setProperty('display', 'none');
        hide('.tower-bar');
        hide('#shop-btn');
        hide('#speed-btn');
        hide('#wave-btn');
        hide('#dev-panel');
        hide('#level-selector');

        // Auto-lancer la vague (sauf en mode dev)
        if (!new URLSearchParams(location.search).get('dev')) {
            setTimeout(() => this.engine.startWave(), 2500);
        }
    }

    wireCallbacks() {
        this.engine.onEnemySpawned = (type) => {
            const { sprite, body, hpBar, baseScaleX, baseScaleY } = this.renderer.createEnemySprite(type);
            const enemy = this.engine.spawnEnemy(type, sprite, body, hpBar, baseScaleX, baseScaleY);
            // Pré-calcul des positions screen de chaque waypoint pour interpolation lisse
            enemy._screenRoute = enemy.route.map(p => toIso(p.x, p.y));
            this.renderer.addEnemyToStage(enemy);
            if (ENEMY_TYPES[type]?.darkness) {
                this.engine.litTiles = new Set();
                // Illuminer toutes les tours lumière déjà posées, puis appliquer le tinting
                for (const t of this.engine.towers) {
                    if (TOWER_TYPES[t.type]?.illuminates) this._applyTowerLight(t);
                }
                this.renderer.setTileLighting(this.engine.litTiles);
                this.onTornadoSpawned?.();
            }
        };

        this.engine.onEnemyMoved = (enemy, now, isSlow) => {
            this.renderer.updateEnemyTint(enemy, isSlow);
            this.renderer.updateEnemyAnimation(enemy, now);
            this.renderer.updateEnemyPosition(enemy);
        };

        this.engine.onEnemyDied = (enemy) => {
            this.renderer.createDeathEffect(enemy.x, enemy.y);
            this.renderer.showFloatingGold(enemy.x, enemy.y, enemy.reward, this.container);
            this.renderer.removeEnemyFromStage(enemy);
            // enemy déjà retiré de engine.enemies avant ce callback
            if (ENEMY_TYPES[enemy.type]?.darkness && !this.engine.enemies.some(e => ENEMY_TYPES[e.type]?.darkness)) {
                this.engine.litTiles = null;
                this.renderer.setTileLighting(null);
            }
            this.updateUI();
        };

        this.engine.onEnemyReachedBase = (enemy) => {
            this.renderer.removeEnemyFromStage(enemy);
            this.renderer.createDamageEffect();
            if (ENEMY_TYPES[enemy.type]?.darkness && !this.engine.enemies.some(e => ENEMY_TYPES[e.type]?.darkness)) {
                this.engine.litTiles = null;
                this.renderer.setTileLighting(null);
            }
            this.updateUI();
        };

        this.engine.onSplashKill = (enemy) => {
            this.renderer.createDeathEffect(enemy.x, enemy.y);
            this.renderer.removeEnemyFromStage(enemy);
        };

        this.engine.onTowerFired = (tower, target, projectile) => {
            this.renderer.animateTowerShot(tower);
            this.renderer.createMuzzleFlash(tower, target);
            projectile.sprite = this.renderer.createProjectileSprite(tower.type);
            this.renderer.addProjectileToStage(projectile, tower.x, tower.y);
        };

        this.engine.onProjectileHit = (proj, target, damage) => {
            this.renderer.removeProjectileFromStage(proj);
            this.renderer.updateEnemyHpBar(target);
            this.renderer.showFloatingDamage(target.x, target.y, damage, this.container);
            this.renderer.createHitEffect(target.x, target.y, proj.type);
            if (proj.pushback) this.renderer.createPushbackEffect(target);
            const sourceTower = this.engine.towers.find(t => t.id === proj.towerId);
            if (sourceTower) this.renderer.updateTowerXpBar(sourceTower);
        };

        this.engine.onEnemyDamaged = (enemy, damage) => {
            if (enemy.sprite) this.renderer.updateEnemyHpBar(enemy);
            this.renderer.showFloatingDamage(enemy.x, enemy.y, damage, this.container);
        };

        this.engine.onProjectileMissed = (proj) => {
            this.renderer.removeProjectileFromStage(proj);
        };

        this.engine.onProjectileMoved = (proj, dt, target) => {
            this.renderer.updateProjectilePosition(proj);
            // Rotate sprite toward target
            if (target && proj.sprite) {
                const targetIso = this.renderer.toIso(target.x, target.y);
                const projIso = this.renderer.toIso(proj.x, proj.y);
                proj.sprite.rotation = Math.atan2(targetIso.y - projIso.y, targetIso.x - projIso.x);
            }
        };

        this.engine.onWaveStarted = (waveNumber) => {
            this.onWaveStarted?.(waveNumber);
            this.updateUI();

            // Dialogue trigger sur cette vague ?
            const key = `${this.engine.level}_${waveNumber}`;
            if (this._dialogueTriggers[key]) {
                this.showDialogue(this._dialogueTriggers[key]);
            }
        };

        this.engine.onWaveCompleted = (waveNumber) => {
            this.updateUI();
            this.onWaveCompleted?.(waveNumber);
        };

        this.engine.onBuffsChanged = () => {
            this.updateBuffsUI();
        };

        this.engine.onGameOver = () => {
            this.showGameOver();
        };

        this.engine.onLevelComplete = (level) => {
            this.showLevelTransition(level);
        };

        this.engine.onVictory = () => {
            this.showVictory();
        };

        this.engine.onNuke = () => {
            this.renderer.createNukeFlash();
        };

        this.engine.onTowerLevelUp = (tower) => {
            this.renderer.updateTowerSprite(tower);
            this.renderer.createLevelUpEffect(tower);
            this.renderer.updateTowerXpBar(tower);
            // Refresh info panel if this tower is selected
            if (this.selectedPlacedTower === tower) {
                this.showTowerInfo(tower);
            }
        };


        this.engine.onCemeteryGrasp = (tower, enemy, duration) => {
            this.renderer.animateTowerShot(tower);
            this.renderer.createHandEffect(enemy, duration);
        };

        this.engine.onFireBurn = (enemy) => {
            this.renderer.showFloatingDamage(enemy.x, enemy.y, '🔥', this.container);
        };

        this.engine.onLevelChanged = (levelData) => {
            this.renderer.setTheme(levelData);
        };
    }

    // ===== INTERACTION =====

    setupInteraction() {
        const app = this.renderer.app;

        app.stage.eventMode = 'static';
        app.stage.hitArea = app.screen;
        app.stage.cursor = 'default';

        app.stage.on('pointermove', (e) => {
            const pos = e.global;
            const grid = fromIso(pos.x, pos.y, this.renderer.offsetX, this.renderer.offsetY, this.renderer.mapScale);

            // Clear previous hover
            if (this.hoveredTile) {
                this.renderer.clearTileHoverTint(this.hoveredTile);
                this.hoveredTile = null;
                this.renderer.hideRangePreview();
                this.renderer.hideGhostTower();
                app.stage.cursor = 'default';
            }

            if (grid.x < 0 || grid.x >= GRID_WIDTH || grid.y < 0 || grid.y >= GRID_HEIGHT) return;

            const tile = this.renderer.tileMap[`${grid.x},${grid.y}`];
            if (!tile) return;

            const cell = this.engine.grid[grid.y][grid.x];
            if (cell.type === 'grass') {
                app.stage.cursor = 'pointer';
                if (!cell.tower) {
                    const canPlace = this.engine.canPlaceTower(grid.x, grid.y, this.selectedTower);
                    this.renderer.setTileHoverTint(tile, canPlace);
                    this.renderer.showRangePreview(grid.x, grid.y, this.selectedTower);
                    if (canPlace) {
                        const orientation = this.engine.getTowerOrientation(grid.x, grid.y);
                        this.renderer.showGhostTower(grid.x, grid.y, this.selectedTower, orientation);
                    }
                }
            }
            this.hoveredTile = tile;
        });

        app.stage.on('pointerdown', (e) => {
            const pos = e.global;
            const grid = fromIso(pos.x, pos.y, this.renderer.offsetX, this.renderer.offsetY, this.renderer.mapScale);

            if (grid.x < 0 || grid.x >= GRID_WIDTH || grid.y < 0 || grid.y >= GRID_HEIGHT) {
                this.hideTowerInfo();
                return;
            }
            this.handleTileClick(grid.x, grid.y);
        });

        app.stage.on('pointerleave', () => {
            if (this.hoveredTile) {
                this.renderer.clearTileHoverTint(this.hoveredTile);
                this.hoveredTile = null;
                this.renderer.hideRangePreview();
                this.renderer.hideGhostTower();
                app.stage.cursor = 'default';
            }
        });
    }

    handleTileClick(x, y) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;

        const cell = this.engine.grid[y][x];

        // Click on existing tower -> show info panel
        if (cell.tower) {
            this.showTowerInfo(cell.tower);
            return;
        }

        this.hideTowerInfo();

        if (!this.engine.canPlaceTower(x, y, this.selectedTower)) return;

        const orientation = this.engine.getTowerOrientation(x, y);
        const { sprite, baseScaleX, baseScaleY } = this.renderer.createTowerSprite(this.selectedTower, orientation);
        const tower = this.engine.placeTower(x, y, this.selectedTower, sprite, baseScaleX, baseScaleY);
        this.renderer.addTowerToStage(tower);
        this.renderer.drawTowerXpBar(tower);
        this.onTowerPlaced?.();

        // Si obscurité active et tour lumière, illuminer immédiatement
        if (TOWER_TYPES[tower.type]?.illuminates && this.engine.litTiles) {
            this._applyTowerLight(tower);
            this.renderer.setTileLighting(this.engine.litTiles);
        }

        this.renderer.hideRangePreview();
        this.renderer.hideGhostTower();
        this.updateUI();
    }

    // ===== TOWER INFO PANEL =====

    showTowerInfo(tower) {
        if (this.selectedPlacedTower && this.selectedPlacedTower !== tower) {
            this.hideTowerInfo();
        }

        this.selectedPlacedTower = tower;
        const config = TOWER_TYPES[tower.type];
        const sellValue = Math.floor(config.cost * 0.6);

        const display = TOWER_DISPLAY[tower.type] || {};
        const lvlSuffix = tower.level > 1 ? ` Nv.${tower.level}` : '';
        document.getElementById('tower-info-name').textContent = `${display.icon} ${display.name}${lvlSuffix}`;
        document.getElementById('ti-dmg').textContent = tower.damage;
        document.getElementById('ti-range').textContent = tower.range.toFixed(1);
        document.getElementById('ti-cd').textContent = (tower.cooldown / 1000).toFixed(1) + 's';

        // XP display
        const xpEl = document.getElementById('ti-xp');
        if (xpEl) {
            if (tower.level >= 3) {
                xpEl.textContent = 'MAX';
            } else {
                xpEl.textContent = `${tower.xp}/${tower.xpToLevel}`;
            }
        }
        // XP progress bar in panel
        const xpBarEl = document.getElementById('ti-xp-bar');
        if (xpBarEl) {
            const ratio = tower.level >= 3 ? 100 : Math.floor((tower.xp / tower.xpToLevel) * 100);
            xpBarEl.style.width = `${ratio}%`;
            xpBarEl.style.background = tower.level >= 3 ? '#f1c40f' : '#9b59b6';
        }

        document.getElementById('tower-info').classList.add('visible');

        this.renderer.showTowerRangePreview(tower);
        this.renderer.highlightTowerSprite(tower);
    }

    hideTowerInfo() {
        if (this.selectedPlacedTower) {
            this.renderer.unhighlightTowerSprite(this.selectedPlacedTower);
        }
        this.selectedPlacedTower = null;
        document.getElementById('tower-info').classList.remove('visible');
        this.renderer.hideRangePreview();
    }

    sellSelectedTower() {
        const tower = this.selectedPlacedTower;
        if (!tower) return;

        const sellValue = this.engine.sellTower(tower);
        this.renderer.removeTowerFromStage(tower);
        this.renderer.showFloatingGold(tower.x, tower.y, sellValue, this.container);

        this.hideTowerInfo();
        this.updateUI();
    }

    // ===== DOM SETUP =====

    setupTowerButtons() {
        document.querySelectorAll('.tower-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.tower;

                this.hideTowerInfo();
                document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedTower = type;

                const info = document.getElementById('selection-info');
                const config = TOWER_TYPES[this.selectedTower];
                const name = TOWER_DISPLAY[this.selectedTower]?.name || this.selectedTower;
                info.textContent = `${name} - Dégâts: ${config.damage} | Portée: ${config.range}`;
                info.classList.add('visible');
                setTimeout(() => info.classList.remove('visible'), 2000);
            });
        });
    }

    setupWaveButton() {
        document.getElementById('wave-btn').addEventListener('click', () => {
            if (!this.engine.waveInProgress && this.engine.wave < this.engine.currentWaves.length) {
                this.engine.startWave();
            }
        });
    }

    setupSpeedButton() {
        const btn = document.getElementById('speed-btn');
        btn.addEventListener('click', () => {
            const speed = this.engine.toggleSpeed();
            btn.textContent = `x${speed}`;
            btn.classList.toggle('fast', speed >= 2);
            btn.classList.toggle('turbo', speed === 3);
        });
    }

    setupSellButton() { /* vente supprimée */ }

    setupShop() { /* shop supprimé */ }

    // ===== DEBUG LEVEL SELECTOR =====

    setupLevelSelector() { /* worldmap supprimée */ }

    setupDevMode() {
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const btn = document.getElementById('devmode-btn');
        if (!isLocal || !btn) {
            if (btn) btn.style.display = 'none';
            return;
        }

        btn.addEventListener('click', () => this.toggleDevMode());

        // Keyboard shortcut: D to toggle devmode, G to toggle debug grid
        document.addEventListener('keydown', (e) => {
            if (e.key === 'd' || e.key === 'D') {
                this.toggleDevMode();
            }
            if (e.key === 'g' || e.key === 'G') {
                const path = this.engine.currentLevelData?.path || [];
                this.renderer.toggleDebugGrid(path);
            }
            if (e.key === 'h' || e.key === 'H') {
                this.renderer.toggleCleanView();
            }
        });
    }

    toggleDevMode() {
        const engine = this.engine;
        engine.devMode = !engine.devMode;

        const btn = document.getElementById('devmode-btn');
        const badge = document.getElementById('devmode-badge');
        const spawnPanel = document.getElementById('dev-spawn-panel');

        if (engine.devMode) {
            this._savedGold = engine.gold;
            if (btn) { btn.textContent = 'DEV ✓'; btn.classList.add('active'); }
            if (badge) badge.style.display = '';
            if (spawnPanel) spawnPanel.style.display = '';
        } else {
            // Restore real gold
            engine.gold = this._savedGold ?? engine.gold;
            if (btn) { btn.textContent = 'DEV'; btn.classList.remove('active'); }
            if (badge) badge.style.display = 'none';
            if (spawnPanel) spawnPanel.style.display = 'none';
        }

        this.updateUI();
    }

    setupSpawnButtons() {
        document.querySelectorAll('.dev-spawn-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.enemy;
                if (type) this.engine.spawnQueue.push(type);
            });
        });
    }

    jumpToLevel(levelIndex) {
        if (levelIndex < 0 || levelIndex >= LEVELS.length) return;

        const continuing = this._continuing;
        this._continuing = false;

        if (continuing) {
            this.engine.resetGameState(levelIndex, false);
        } else {
            this.engine.resetGameState(levelIndex, true);
            this.engine.gold = 150;
            this.engine.health = 15;
        }

        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);
        this.renderer.calculateOffset();

        this.selectedPlacedTower = null;
        this.hoveredTile = null;
        this.hideTowerInfo();

        // Reset game over / transition overlays
        document.getElementById('game-over').classList.remove('visible');
        const transition = document.getElementById('level-transition');
        if (transition) transition.classList.remove('visible');

        this.updateUI();
    }

    // ===== UI UPDATES =====

    updateUI() {
        document.getElementById('gold').textContent = this.engine.devMode ? '∞' : this.engine.gold;
        document.getElementById('health').textContent = this.engine.health;
        document.getElementById('wave').textContent = this.engine.wave;
        this.updateEnemyCount();

        const levelEl = document.getElementById('level');
        if (levelEl) levelEl.textContent = `${this.engine.level + 1}`;

        const waves = this.engine.currentWaves;
        const waveBtn = document.getElementById('wave-btn');
        if (this.engine.wave >= waves.length) {
            waveBtn.textContent = 'Terminé ✓';
            waveBtn.disabled = true;
        } else if (this.engine.waveInProgress) {
            waveBtn.textContent = `Vague ${this.engine.wave} en cours...`;
            waveBtn.disabled = true;
        } else {
            waveBtn.textContent = `Vague ${this.engine.wave + 1} ▶`;
            waveBtn.disabled = false;
        }

        if (this._chapter4Mode && (this.engine.wave >= 6 || (this.engine.wave === 5 && !this.engine.waveInProgress)))
            this._availableTowers.add('fauconnier');

        document.querySelectorAll('.tower-btn').forEach(btn => {
            const type = btn.dataset.tower;
            const config = TOWER_TYPES[type];
            if (!config) return;
            const visible = this._availableTowers.has(type);
            btn.style.display = visible ? '' : 'none';
            if (visible) btn.classList.toggle('disabled', this.engine.gold < config.cost);
        });
    }

    updateEnemyCount() {
        document.getElementById('enemies').textContent = this.engine.getEnemyCount();
    }

    updateShopItems() {
        document.querySelectorAll('.shop-item').forEach(item => {
            const type = item.dataset.item;
            const cost = SHOP_ITEMS[type].cost;
            const canAfford = this.engine.gold >= cost;
            const alreadyActive = (type === 'damage' && this.engine.buffs.damage) || (type === 'slow' && this.engine.buffs.slow);
            item.classList.toggle('disabled', !canAfford || alreadyActive);
        });
    }

    updateBuffsUI() {
        const container = document.getElementById('buffs');
        container.innerHTML = '';
        if (this.engine.buffs.damage) {
            const badge = document.createElement('div');
            badge.className = 'buff-badge damage';
            badge.textContent = '⚔️ Rage x1.5';
            container.appendChild(badge);
        }
        if (this.engine.buffs.slow) {
            const badge = document.createElement('div');
            badge.className = 'buff-badge slow';
            badge.textContent = '🧊 Blizzard';
            container.appendChild(badge);
        }
    }

    // ===== GAME OVER / VICTORY =====

    showGameOver() {
        if (this._scriptedMode) {
            // Fondu au noir puis callback SPA → cutscène Nathan
            const screenGame = document.getElementById('screen-game');
            if (screenGame) {
                screenGame.style.transition = 'opacity 1.5s ease';
                screenGame.style.opacity = '0';
            }
            setTimeout(() => {
                if (screenGame) { screenGame.style.opacity = ''; screenGame.style.transition = ''; }
                this.onScriptedDefeat?.();
            }, 1500);
            return;
        }
        document.getElementById('game-over-title').textContent = '💀 Défaite';
        document.getElementById('final-wave').textContent = this.engine.wave;
        document.getElementById('game-over').classList.add('visible');
    }

    showVictory() {
        if (this._chateauFinalMode) { this.onChateauFinalWin?.(); return; }
        if (this._chateauBossMode)  { this.onChateauBossWin?.();  return; }
        if (this._chateauMode)     { this.onChateauWin?.();     return; }
        if (this._fortMode) { this.onChapter3Win?.(); return; }
        if (this._tutorialMode) {
            // Badge victoire interactif → clic → dialogue → fin
            const doDialogue = () => {
                this.showDialogue('chapter1/tutorial_win', () => {
                    this.onTutorialWin?.();
                });
            };
            if (this.onTutorialVictory) {
                this.onTutorialVictory(doDialogue);
            } else {
                doDialogue();
            }
            return;
        }
        document.getElementById('game-over-title').textContent = '🏆 Victoire !';
        document.getElementById('final-wave').textContent = `${this.engine.globalWave}/${this.engine.globalWave}`;
        document.getElementById('game-over').classList.add('visible');
    }

    showLevelTransition(completedLevel) {
        if (this._chapter2Mode)    { this.onChapter2Win?.();     return; }
        if (this._fortMode)        { this.onChapter3Win?.();     return; }
        if (this._chateauMode)     { this.onChateauWin?.();      return; }
        if (this._chateauFinalMode){ this.onChateauFinalWin?.(); return; }
        if (this._chapter4Mode)    { this.onChapter4Win?.();     return; }
        this._continuing = true;
    }

    // ===== MODES SPA =====

    setScriptedMode() {
        this._scriptedMode = true;
        this._tutorialMode = false;
        this._resetForMode();
        this.engine.setScriptedBattle([
            [{ type: 'basic', count: 20 }],
            [{ type: 'basic', count: 35 }],
            [{ type: 'basic', count: 50 }],
        ]);
        this._setupScriptedMode(); // cache l'UI + auto-start
    }

    setTutorialMode() {
        this._scriptedMode = false;
        this._tutorialMode = false;
        this._resetForMode();
        this._enterTutorialMode();
    }

    _triggerHeroAbility() {
        const hero = this.engine.hero;
        if (!hero || hero.charge < hero.maxCharge) return;

        this.engine.paused = true;
        hero.charge = 0;

        // Suzanne disparaît de sa tuile
        if (this.renderer._suzanneSprite) this.renderer._suzanneSprite.visible = false;
        if (this.renderer._heroChargeBar)  this.renderer._heroChargeBar.visible  = false;

        const overlay = document.getElementById('hero-ability-overlay');
        if (overlay) { overlay.dataset.hero = 'suzanne'; overlay.classList.add('active'); }

        // Sélection des cibles : jusqu'à 3 ennemis répartis sur le chemin
        const allEnemies = [...this.engine.enemies].sort((a, b) => a.pathIndex - b.pathIndex);
        const targets = [];
        if (allEnemies.length > 0) {
            const count = Math.min(6, allEnemies.length);
            if (allEnemies.length <= count) {
                targets.push(...allEnemies);
            } else {
                const step = (allEnemies.length - 1) / (count - 1);
                for (let i = 0; i < count; i++) targets.push(allEnemies[Math.round(i * step)]);
            }
        }

        // Attaques démarrent quand l'overlay commence à se refermer (~1.8s)
        const attackStart    = 1900;
        const attackInterval = 300;
        let   pendingAttacks = targets.length;

        const onAllDone = () => {
            pendingAttacks--;
            if (pendingAttacks <= 0) this._endHeroAbility();
        };

        if (targets.length === 0) {
            // Pas d'ennemi — fin après l'overlay
            setTimeout(() => this._endHeroAbility(), 2800);
        } else {
            targets.forEach((enemy, i) => {
                setTimeout(() => {
                    // L'ennemi a peut-être déjà été tué
                    if (!this.engine.enemies.includes(enemy)) { onAllDone(); return; }

                    // Direction selon le sens de déplacement sur le chemin
                    const curr = enemy.route?.[enemy.pathIndex]     || { x: enemy.x };
                    const next = enemy.route?.[enemy.pathIndex + 1] || curr;
                    const facingRight = next.x >= curr.x;

                    this.renderer.heroTeleportAttack(
                        enemy.x, enemy.y,
                        facingRight,
                        this.renderer.assets['suzanne_attack_frames'],
                        () => this.onHeroPunch?.(),
                        () => {
                            // Impact : dégâts sur cet ennemi
                            if (!this.engine.enemies.includes(enemy)) return;
                            enemy.hp -= 150;
                            if (this.engine.onEnemyDamaged) this.engine.onEnemyDamaged(enemy, 80);
                            if (enemy.hp <= 0) {
                                this.engine.gold += enemy.reward;
                                const idx = this.engine.enemies.indexOf(enemy);
                                if (idx > -1) {
                                    this.engine.enemies.splice(idx, 1);
                                    if (this.engine.onEnemyDied)   this.engine.onEnemyDied(enemy, idx);
                                    if (this.engine.onGoldChanged) this.engine.onGoldChanged(this.engine.gold);
                                }
                            }
                            this.updateUI();
                        },
                        onAllDone
                    );
                }, attackStart + i * attackInterval);
            });
        }

        // Ferme l'overlay à la fin naturelle de l'animation CSS (2.8s)
        setTimeout(() => { if (overlay) { overlay.classList.remove('active'); delete overlay.dataset.hero; } }, 2800);
    }

    _endHeroAbility() {
        // Suzanne réapparaît sur sa tuile
        if (this.renderer._suzanneSprite) this.renderer._suzanneSprite.visible = true;
        if (this.renderer._heroChargeBar)  this.renderer._heroChargeBar.visible  = true;
        this.engine.paused = false;
        this.updateUI();
    }

    setNormalMode() {
        this._scriptedMode = false;
        this._tutorialMode = false;
        this._resetForMode();
    }

    replay() {
        if (this._chapter2Mode) { this.setChapter2Mode(); return; }
        if (this._fortMode) { this.setFortMode(); return; }
        if (this._chapter4Mode) { this.setChapter4Mode(); return; }
        if (this._chateauFinalMode) { this.setChateauFinalMode(); return; }
        if (this._chateauBossMode)  { this.setChateauBossMode();  return; }
        if (this._chateauMode)     { this.setChateauMode();     return; }
        this.setNormalMode();
    }

    // Chapitre 2b : Fort de l'Est (archer + mage)
    // skipDefaultTower=true lors d'une restauration de sauvegarde
    setFortMode(skipDefaultTower = false) {
        this._scriptedMode = false;
        this._tutorialMode = false;
        this._resetForMode();
        this._fortMode        = true;
        this._availableTowers = new Set(['archer', 'mage']);

        const idx = LEVELS.findIndex(l => l.name === "Fort de l'Est");
        if (idx < 0) { console.error("[Brémanie] Niveau Fort de l'Est introuvable"); return; }
        this.engine.resetGameState(idx, true);
        this.engine.gold = 150;
        this.engine.health = 15;
        this.engine.maxHealth = 15;
        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);
        this.renderer.calculateOffset();
        this.selectedPlacedTower = null;
        this.hoveredTower = null;
        this.hideTowerInfo();

        // Tour mage offerte au départ (cellule {2,2} adjacente au chemin)
        // Ignorée si on restaure une sauvegarde (les tours seront posées via applySaveState)
        const fx = 2, fy = 2;
        // drawGround peut avoir posé un deco aléatoire ici (hasTree) — on le force à false
        // pour garantir le placement. Le sprite deco reste visible mais caché sous la tour.
        this.engine.grid[fy][fx].hasTree = false;
        if (!skipDefaultTower && this.engine.canPlaceTower(fx, fy, 'mage')) {
            this.engine.gold += TOWER_TYPES['mage'].cost; // crédité puis déduit par placeTower → net = 0
            const orientation = this.engine.getTowerOrientation(fx, fy);
            const { sprite, baseScaleX, baseScaleY } = this.renderer.createTowerSprite('mage', orientation);
            const tower = this.engine.placeTower(fx, fy, 'mage', sprite, baseScaleX, baseScaleY);
            this.renderer.addTowerToStage(tower);
            this.renderer.drawTowerXpBar(tower);
        }

        this.updateUI();
    }

    // Chapitre 3 : Château (niveau Château, archer + mage)
    // skipDefaultTower=true lors d'une restauration de sauvegarde
    setChateauMode(skipDefaultTower = false) {
        this._scriptedMode = false;
        this._tutorialMode = false;
        this._resetForMode();
        this._chateauMode     = true;
        this._availableTowers = new Set(['archer', 'mage']);

        const idx = LEVELS.findIndex(l => l.name === 'Château');
        if (idx < 0) { console.error('[Brémanie] Niveau Château introuvable'); return; }
        this.engine.resetGameState(idx, true);
        this.engine.gold = 150;
        this.engine.health = 15;
        this.engine.maxHealth = 15;
        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);
        this.renderer.calculateOffset();
        this.selectedPlacedTower = null;
        this.hoveredTower = null;
        this.hideTowerInfo();

        // Tour mage offerte au départ
        const fx = 2, fy = 2;
        this.engine.grid[fy][fx].hasTree = false;
        if (!skipDefaultTower && this.engine.canPlaceTower(fx, fy, 'mage')) {
            this.engine.gold += TOWER_TYPES['mage'].cost;
            const orientation = this.engine.getTowerOrientation(fx, fy);
            const { sprite, baseScaleX, baseScaleY } = this.renderer.createTowerSprite('mage', orientation);
            const tower = this.engine.placeTower(fx, fy, 'mage', sprite, baseScaleX, baseScaleY);
            this.renderer.addTowerToStage(tower);
            this.renderer.drawTowerXpBar(tower);
        }

        this.updateUI();
    }

    // Chapitre 3 : Boss final (1 tornado, même carte que Château, tours préservées via applySaveState)
    setChateauBossMode() {
        this._scriptedMode = false;
        this._tutorialMode = false;
        this._resetForMode();
        this._chateauBossMode = true;
        this._availableTowers = new Set(['archer', 'mage']);

        const idx = LEVELS.findIndex(l => l.name === 'Château Boss');
        if (idx < 0) { console.error('[Brémanie] Niveau Château Boss introuvable'); return; }
        this.engine.resetGameState(idx, true);
        this.engine.health    = 15;
        this.engine.maxHealth = 15;
        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);
        this.renderer.calculateOffset();
        this.selectedPlacedTower = null;
        this.hoveredTower = null;
        this.hideTowerInfo();

        // Tour archer offerte en milieu de parcours
        const fx = 3, fy = 11;
        if (this.engine.canPlaceTower(fx, fy, 'archer')) {
            this.engine.gold += TOWER_TYPES['archer'].cost;
            const orientation = this.engine.getTowerOrientation(fx, fy);
            const { sprite, baseScaleX, baseScaleY } = this.renderer.createTowerSprite('archer', orientation);
            const tower = this.engine.placeTower(fx, fy, 'archer', sprite, baseScaleX, baseScaleY);
            this.renderer.addTowerToStage(tower);
            this.renderer.drawTowerXpBar(tower);
        }

        this.updateUI();
    }

    // Chapitre 3 : Combat Final (après dialogue post_tornado, tour lumière offerte, 14 coeurs)
    setChateauFinalMode() {
        this._scriptedMode = false;
        this._tutorialMode = false;
        this._resetForMode();
        this._chateauFinalMode = true;
        this._availableTowers  = new Set(['archer', 'mage', 'light']);

        const idx = LEVELS.findIndex(l => l.name === 'Château Final');
        this.engine.resetGameState(idx, true);
        this.engine.health    = 14;
        this.engine.maxHealth = 14;
        // litTiles reste null — l'obscurité ne s'active que quand la tornade arrive

        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);
        this.renderer.calculateOffset();

        this.selectedPlacedTower = null;
        this.hoveredTower = null;
        this.hideTowerInfo();

        // Tour lumière offerte — éclaire les cases adjacentes au milieu du parcours
        const fx = 3, fy = 10;
        if (this.engine.canPlaceTower(fx, fy, 'light')) {
            const orientation = this.engine.getTowerOrientation(fx, fy);
            const { sprite, baseScaleX, baseScaleY } = this.renderer.createTowerSprite('light', orientation);
            const prevDevMode = this.engine.devMode;
            this.engine.devMode = true; // placement gratuit
            const tower = this.engine.placeTower(fx, fy, 'light', sprite, baseScaleX, baseScaleY);
            this.engine.devMode = prevDevMode;
            this.renderer.addTowerToStage(tower);
            this.renderer.drawTowerXpBar(tower);
            // Note : l'illumination est activée à l'arrivée de la tornade (wireCallbacks)
        }

        this.updateUI();
    }

    // Illumine les cases dans le rayon d'une tour lumière (logique + visuel)
    _applyTowerLight(tower) {
        if (!this.engine.litTiles) return;
        const range = TOWER_TYPES[tower.type]?.range ?? 2.5;
        const cx = tower.x, cy = tower.y;
        for (let dx = -Math.ceil(range); dx <= Math.ceil(range); dx++) {
            for (let dy = -Math.ceil(range); dy <= Math.ceil(range); dy++) {
                if (Math.sqrt(dx * dx + dy * dy) <= range) {
                    this.engine.litTiles.add(`${Math.floor(cx) + dx},${Math.floor(cy) + dy}`);
                }
            }
        }
        // setTileLighting appelé par l'appelant après avoir peuplé toutes les tours
    }

    // Chapitre 2 : combat de la Forêt (niveau index 3, archer uniquement)
    setChapter2Mode() {
        this._scriptedMode = false;
        this._tutorialMode = false;
        this._resetForMode();
        this._chapter2Mode    = true;
        this._availableTowers = new Set(['archer']);

        // Saute au niveau Forêt (index 4)
        const forestIndex = LEVELS.findIndex(l => l.name === 'Forêt');
        if (forestIndex < 0) { console.error('[Brémanie] Niveau Forêt introuvable'); return; }
        this.engine.resetGameState(forestIndex, true);
        this.engine.gold = 150;
        this.engine.health = 15;
        this.engine.maxHealth = 15;
        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);
        this.renderer.calculateOffset();
        this.selectedPlacedTower = null;
        this.hoveredTower = null;
        this.hideTowerInfo();
        this.updateUI();
    }

    // Chapitre 4 : Évasion sous la lune — TODO: configurer le niveau dédié
    setChapter4Mode() {
        this._scriptedMode = false;
        this._tutorialMode = false;
        this._resetForMode();
        this._chapter4Mode    = true;
        this._availableTowers = new Set(['archer', 'mage']);

        const _ch4WaveStarted = this.onWaveStarted;
        this.onWaveStarted = (waveNumber) => {
            _ch4WaveStarted?.(waveNumber);
            if (waveNumber >= 6 && !this._availableTowers.has('fauconnier')) {
                this._availableTowers.add('fauconnier');
                this.updateUI();
            }
        };

        const _ch4WaveCompleted = this.onWaveCompleted;
        this.onWaveCompleted = (waveNumber) => {
            _ch4WaveCompleted?.(waveNumber);
            if (waveNumber === 8) {
                // Supprimer la tour en bas à droite si elle existe
                const tx = GRID_WIDTH - 1, ty = GRID_HEIGHT - 1;
                const towerAtTile = this.engine.towers.find(t => t.x === tx && t.y === ty);
                if (towerAtTile) {
                    // Suppression silencieuse (pas de remboursement)
                    this.engine.grid[ty][tx].tower = null;
                    const idx = this.engine.towers.indexOf(towerAtTile);
                    if (idx > -1) this.engine.towers.splice(idx, 1);
                    this.renderer.removeTowerFromStage(towerAtTile);
                }
                // Bloquer la tuile + placer Suzanne
                this.engine.grid[ty][tx].blockedByHero = true;
                this.renderer.placeSuzanneOnTile(tx, ty);
                this.engine.initHero();
                this.engine.hero.charge = this.engine.hero.maxCharge; // Suzanne arrive chargée
                this.renderer.onHeroClick = () => this._triggerHeroAbility();
            }
        };

        const levelIndex = LEVELS.findIndex(l => l.name === 'Forêt de Nuit');
        if (levelIndex < 0) { console.error('[Brémanie] Niveau Forêt de Nuit introuvable'); return; }
        this.engine.resetGameState(levelIndex, true);
        this.engine.gold = 150;
        this.engine.health = 15;
        this.engine.maxHealth = 15;
        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);
        this.renderer.calculateOffset();
        this.selectedPlacedTower = null;
        this.hoveredTower = null;
        this.hideTowerInfo();
        this.updateUI();
    }

    _resetForMode() {
        this._chapter2Mode = false;
        this._fortMode     = false;
        this._chateauMode      = false;
        this._chateauBossMode  = false;
        this._chateauFinalMode = false;
        this._chapter4Mode     = false;
        this._availableTowers  = new Set(['archer']);
        // Restaure l'UI
        const show = (sel) => document.querySelector(sel)?.style.removeProperty('display');
        show('.tower-bar');
        show('#shop-btn');
        show('#speed-btn');
        show('#wave-btn');
        document.getElementById('game-over')?.classList.remove('visible');
        document.getElementById('level-selector')?.classList.remove('visible');

        // Reset état jeu
        this.engine.resetGameState(0, true);
        this.engine.gold = 150;
        this.engine.health = 15;
        this.engine.maxHealth = 15;

        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);
        this.renderer.calculateOffset();
        this.selectedPlacedTower = null;
        this.hoveredTile = null;
        this.hideTowerInfo();
        this.updateUI();
    }

    // ── Sauvegarde / restauration ─────────────────────────────

    // Sérialise les tours placées pour la sauvegarde
    getTowersState() {
        return this.engine.towers.map(t => ({
            x: t.x, y: t.y, type: t.type,
            level: t.level || 1, xp: t.xp || 0,
        }));
    }

    // Applique un état sauvegardé après setChapter2Mode / setFortMode(true)
    applySaveState({ wave = 0, gold = 150, health = 15, towers = [] }) {
        this.engine.gold       = gold;
        this.engine.health     = health;
        this.engine.wave       = wave;
        this.engine.globalWave = wave;

        for (const t of towers) {
            if (!this.engine.canPlaceTower(t.x, t.y, t.type)) continue;
            const orientation = this.engine.getTowerOrientation(t.x, t.y);
            const { sprite, baseScaleX, baseScaleY } = this.renderer.createTowerSprite(t.type, orientation);
            const tower = this.engine.placeTower(t.x, t.y, t.type, sprite, baseScaleX, baseScaleY);
            if (tower) {
                tower.xp = t.xp || 0;
                this.renderer.addTowerToStage(tower);
                this.renderer.drawTowerXpBar(tower);
            }
        }
        this.updateUI();
    }

    startNextLevel() {
        this.engine.nextLevel();

        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid, this.engine.currentLevelData?.path || []);
        this.renderer.calculateOffset();

        this.selectedPlacedTower = null;
        this.hoveredTile = null;
        this.updateUI();
    }
}
