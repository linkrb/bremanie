import {
    GRID_WIDTH, GRID_HEIGHT,
    TOWER_TYPES, TOWER_DISPLAY, SHOP_ITEMS, LEVELS,
    fromIso, getTowerUnlockedByWorld
} from './tdConfig.js';
import { TDRenderer } from './TDRenderer.js';
import { TDEngine } from './TDEngine.js';

export class TowerDefenseGame {
    constructor() {
        this.renderer = new TDRenderer();
        this.engine = new TDEngine();
        this.container = null;
        this.selectedTower = 'archer';
        this.selectedPlacedTower = null;
        this.hoveredTile = null;
        this.shopOpen = false;
        this._continuing = false; // true = on continue la campagne (garde or/santé/unlocks)
        this.completedLevels = new Set();
    }

    async init(container) {
        this.container = container || document.getElementById('game-container');

        this.loadUnlockedTowers();
        await this.renderer.init(this.container);
        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.drawGround(this.engine.grid);

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
            this.renderer.sortEntities();
            this.updateEnemyCount();
        });

        this.updateUI();
    }

    wireCallbacks() {
        this.engine.onEnemySpawned = (type) => {
            const { sprite, body, hpBar, baseScaleX, baseScaleY } = this.renderer.createEnemySprite(type);
            const enemy = this.engine.spawnEnemy(type, sprite, body, hpBar, baseScaleX, baseScaleY);
            this.renderer.addEnemyToStage(enemy);
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
            this.updateUI();
        };

        this.engine.onEnemyReachedBase = (enemy) => {
            this.renderer.removeEnemyFromStage(enemy);
            this.renderer.createDamageEffect();
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
            const announce = document.getElementById('wave-announce');
            announce.textContent = `🌊 Vague ${waveNumber}`;
            announce.classList.add('visible');
            setTimeout(() => announce.classList.remove('visible'), 1500);
            this.updateUI();
        };

        this.engine.onWaveCompleted = () => {
            this.updateUI();
        };

        this.engine.onBuffsChanged = () => {
            this.updateBuffsUI();
        };

        this.engine.onGameOver = () => {
            this.showGameOver();
        };

        this.engine.onLevelComplete = (level) => {
            this.completedLevels.add(level);
            this.checkWorldUnlock(level);
            this.showLevelTransition(level);
        };

        this.engine.onVictory = () => {
            this.checkWorldUnlock(this.engine.level);
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

        document.getElementById('sell-btn').textContent = `Vendre ${sellValue}💰`;
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

                // If tower is locked by world, show shake feedback (no gold unlock)
                if (this.engine.isTowerLocked(type)) {
                    btn.classList.add('shake');
                    setTimeout(() => btn.classList.remove('shake'), 300);
                    return;
                }

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

    setupSellButton() {
        document.getElementById('sell-btn').addEventListener('click', () => {
            this.sellSelectedTower();
        });
    }

    setupShop() {
        document.getElementById('shop-btn').addEventListener('click', () => {
            this.shopOpen = !this.shopOpen;
            document.getElementById('shop-overlay').classList.toggle('visible', this.shopOpen);
            if (this.shopOpen) this.updateShopItems();
        });

        document.getElementById('shop-close').addEventListener('click', () => {
            this.shopOpen = false;
            document.getElementById('shop-overlay').classList.remove('visible');
        });

        document.querySelectorAll('.shop-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.item;
                let success = false;

                switch (type) {
                    case 'heart': success = this.engine.buyHeart(); break;
                    case 'repair': success = this.engine.buyRepair(); break;
                    case 'nuke': success = this.engine.buyNuke(); break;
                    case 'damage': success = this.engine.activateDamageBuff(); break;
                    case 'slow': success = this.engine.activateSlowBuff(); break;
                }

                if (success) {
                    this.updateUI();
                    this.updateShopItems();

                    item.style.background = 'rgba(78,205,196,0.3)';
                    setTimeout(() => item.style.background = '', 300);
                }
            });
        });
    }

    // ===== DEBUG LEVEL SELECTOR =====

    // ===== WORLD UNLOCK SYSTEM =====

    loadUnlockedTowers() { /* localStorage disabled */ }
    saveUnlockedTowers() { /* localStorage disabled */ }

    checkWorldUnlock(levelIndex) {
        const towerType = getTowerUnlockedByWorld(levelIndex);
        if (!towerType) return;
        const wasNew = this.engine.unlockTower(towerType);
        if (wasNew) {
            this.saveUnlockedTowers();
            this.updateUI();
            this.showUnlockNotification(towerType);
        }
    }

    showUnlockNotification(type) {
        const display = TOWER_DISPLAY[type] || {};
        const name = display.unlockName || display.name || type;
        const icon = display.icon || '🏆';

        const notif = document.createElement('div');
        notif.className = 'unlock-notif';
        notif.textContent = `${icon} ${name} débloquée !`;

        const container = this.container || document.getElementById('game-container');
        container.appendChild(notif);

        setTimeout(() => notif.remove(), 3100);
    }

    setupLevelSelector() {
        const overlay = document.getElementById('level-selector');
        if (!overlay) return;

        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const devBtn = document.getElementById('dev-btn');

        // Dev-btn toggles worldmap on localhost (quick level switch)
        if (isLocal && devBtn) {
            devBtn.addEventListener('click', () => {
                overlay.classList.toggle('visible');
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'l' || e.key === 'L') overlay.classList.toggle('visible');
            });
        } else if (devBtn) {
            devBtn.style.display = 'none';
        }

        document.querySelectorAll('.level-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const levelIndex = parseInt(btn.dataset.level, 10);
                this.jumpToLevel(levelIndex);
                overlay.classList.remove('visible');
            });
        });

        document.querySelectorAll('.zone-poly').forEach(poly => {
            poly.addEventListener('click', () => {
                const levelIndex = parseInt(poly.dataset.level, 10);
                this.jumpToLevel(levelIndex);
                overlay.classList.remove('visible');
            });
        });

        // Show worldmap on startup
        overlay.classList.add('visible');
    }

    setupDevMode() {
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const btn = document.getElementById('devmode-btn');
        if (!isLocal || !btn) {
            if (btn) btn.style.display = 'none';
            return;
        }

        btn.addEventListener('click', () => this.toggleDevMode());

        // Keyboard shortcut: D to toggle
        document.addEventListener('keydown', (e) => {
            if (e.key === 'd' || e.key === 'D') {
                this.toggleDevMode();
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
            // Save real gold, set display to infinity
            this._savedGold = engine.gold;
            // Unlock all world-locked towers
            for (const [type, config] of Object.entries(TOWER_TYPES)) {
                if (config.unlockedByWorld !== undefined) engine.unlockedTowers.add(type);
            }
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
            // Continuation : garde or, santé, tours débloquées — remet juste la vague locale à 0
            this.engine.resetGameState(levelIndex, false);
        } else {
            // Nouveau jeu : reset complet
            this.engine.resetGameState(levelIndex, true);
            this.engine.gold = 150;
            this.engine.health = 15;
            this.engine.unlockedTowers.clear();
            this.completedLevels.clear();
            this.updateWorldmapZones();
        }

        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid);
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

        document.querySelectorAll('.tower-btn').forEach(btn => {
            const type = btn.dataset.tower;
            const config = TOWER_TYPES[type];

            // Hide if level requirement not met
            if (config.availableFromLevel !== undefined && this.engine.level < config.availableFromLevel) {
                btn.classList.add('hidden-tower');
                return;
            }
            btn.classList.remove('hidden-tower');

            const lockOverlay = btn.querySelector('.lock-overlay');
            if (this.engine.isTowerLocked(type)) {
                // Show locked state (unlockable by completing a world, not by gold)
                btn.classList.add('locked');
                btn.classList.remove('disabled');
                if (lockOverlay) {
                    lockOverlay.style.display = '';
                    const costEl = lockOverlay.querySelector('.unlock-cost');
                    if (costEl) {
                        const worldNames = ['Prairie', 'Cimetière', 'Volcan', 'Glacier', 'Nuages'];
                        costEl.textContent = worldNames[config.unlockedByWorld] || '?';
                    }
                }
            } else {
                btn.classList.remove('locked');
                if (lockOverlay) lockOverlay.style.display = 'none';
                btn.classList.toggle('disabled', this.engine.gold < config.cost);
            }
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
        document.getElementById('game-over-title').textContent = '💀 Défaite';
        document.getElementById('final-wave').textContent = this.engine.wave;
        document.getElementById('game-over').classList.add('visible');
    }

    showVictory() {
        document.getElementById('game-over-title').textContent = '🏆 Victoire !';
        document.getElementById('final-wave').textContent = `${this.engine.globalWave}/${this.engine.globalWave}`;
        document.getElementById('game-over').classList.add('visible');
    }

    showLevelTransition(completedLevel) {
        // Retour à la worldmap pour choisir le prochain niveau
        this._continuing = true;
        this.updateWorldmapZones();
        const selector = document.getElementById('level-selector');
        if (selector) selector.classList.add('visible');
    }

    updateWorldmapZones() {
        document.querySelectorAll('.zone-poly, .level-select-btn').forEach(el => {
            const levelIndex = parseInt(el.dataset.level, 10);
            if (this.completedLevels.has(levelIndex)) {
                el.classList.add('completed');
            } else {
                el.classList.remove('completed');
            }
        });
    }

    startNextLevel() {
        this.engine.nextLevel();

        this.renderer.setTheme(this.engine.currentLevelData);
        this.renderer.clearStage();
        this.renderer.drawGround(this.engine.grid);
        this.renderer.calculateOffset();

        this.selectedPlacedTower = null;
        this.hoveredTile = null;
        this.updateUI();
    }
}
