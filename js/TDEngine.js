import {
    GRID_WIDTH, GRID_HEIGHT,
    TOWER_TYPES, ENEMY_TYPES, SHOP_ITEMS,
    LEVELS, GLOBAL_WAVES, resolvePaths
} from './tdConfig.js';

export class TDEngine {
    constructor() {
        this.gold = 150;
        this.health = 15;
        this.maxHealth = 15;
        this.level = 0;
        this.wave = 0;
        this.globalWave = 0;
        this.waveInProgress = false;
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.spawnQueue = [];
        this.lastSpawn = 0;
        this.enemyId = 0;
        this.towerId = 0;
        this.gameSpeed = 1;
        this.unlockedTowers = new Set();
        this.devMode = false;
        this.buffs = { damage: false, slow: false };
        this.routes = [];
        this.initLevel();

        // Callbacks - wired by the orchestrator
        this.onEnemySpawned = null;      // (enemy)
        this.onEnemyDied = null;         // (enemy, index)
        this.onEnemyReachedBase = null;  // (enemy, index)
        this.onEnemyMoved = null;        // (enemy, now)
        this.onTowerFired = null;        // (tower, target, projectile)
        this.onProjectileHit = null;     // (proj, target, damage)
        this.onProjectileMissed = null;  // (proj, index)
        this.onProjectileMoved = null;   // (proj)
        this.onWaveStarted = null;       // (waveNumber)
        this.onWaveCompleted = null;     // (waveNumber)
        this.onHealthChanged = null;     // (health)
        this.onGoldChanged = null;       // (gold)
        this.onGameOver = null;          // ()
        this.onVictory = null;           // ()
        this.onLevelComplete = null;     // (level)
        this.onNuke = null;              // ()
        this.onSplashKill = null;        // (enemy, index)
        this.onBuffsChanged = null;      // (buffs)
        this.onTowerLevelUp = null;      // (tower)
        this.onWindPulse = null;         // (tower, targets)
        this.onCemeteryGrasp = null;     // (tower, enemy, duration)
        this.onFireBurn = null;          // (enemy, duration)
        this.onEnemyDamaged = null;      // (enemy, damage)
        this.onLevelChanged = null;      // (levelData)
    }

    initLevel() {
        const levelData = LEVELS[this.level];
        const resolved = resolvePaths(levelData.path);
        this.routes = resolved.routes;
        this.grid = this.createGrid(resolved.allTiles);
    }

    get currentLevelData() {
        return LEVELS[this.level];
    }

    get currentWaves() {
        return LEVELS[this.level].waves;
    }

    createGrid(allTiles) {
        const grid = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                grid[y][x] = { type: 'grass', tower: null };
            }
        }
        // Use route[0] to determine spawn/base (first and last point of first route)
        const route0 = this.routes[0] || allTiles;
        const spawnKey = `${route0[0].x},${route0[0].y}`;
        const baseKey = `${route0[route0.length - 1].x},${route0[route0.length - 1].y}`;

        allTiles.forEach(p => {
            if (grid[p.y] && grid[p.y][p.x]) {
                const key = `${p.x},${p.y}`;
                if (key === spawnKey) {
                    grid[p.y][p.x].type = 'spawn';
                } else if (key === baseKey) {
                    grid[p.y][p.x].type = 'base';
                } else {
                    grid[p.y][p.x].type = 'path';
                }
            }
        });
        return grid;
    }

    isTowerAvailable(type) {
        const config = TOWER_TYPES[type];
        if (!config) return false;
        if (config.availableFromLevel !== undefined && this.level < config.availableFromLevel) return false;
        if (config.unlockedByWorld !== undefined && !this.unlockedTowers.has(type)) return false;
        return true;
    }

    isTowerLocked(type) {
        const config = TOWER_TYPES[type];
        if (!config) return true;
        if (config.availableFromLevel !== undefined && this.level < config.availableFromLevel) return false; // not visible yet
        return config.unlockedByWorld !== undefined && !this.unlockedTowers.has(type);
    }

    unlockTower(type) {
        const config = TOWER_TYPES[type];
        if (!config || config.unlockedByWorld === undefined) return false;
        if (this.unlockedTowers.has(type)) return false;
        this.unlockedTowers.add(type);
        return true;
    }

    canPlaceTower(x, y, towerType) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
        const cell = this.grid[y][x];
        if (cell.type !== 'grass' || cell.tower || cell.hasTree) return false;
        if (!this.devMode && !this.isTowerAvailable(towerType)) return false;
        if (this.devMode) return true;
        return this.gold >= TOWER_TYPES[towerType].cost;
    }

    getTowerOrientation(x, y) {
        const neighbors = [
            { dx: 1, dy: 0, dir: 'right' },
            { dx: -1, dy: 0, dir: 'left' },
            { dx: 0, dy: 1, dir: 'down' },
            { dx: 0, dy: -1, dir: 'up' },
        ];

        for (const n of neighbors) {
            const nx = x + n.dx, ny = y + n.dy;
            if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
                const cell = this.grid[ny][nx];
                if (cell.type === 'path' || cell.type === 'spawn' || cell.type === 'base') {
                    if (n.dir === 'up') return 'back';
                    if (n.dir === 'left') return 'side';
                    if (n.dir === 'right') return 'left';
                    if (n.dir === 'down') return 'front';
                }
            }
        }
        return 'front';
    }

    placeTower(x, y, towerType, sprite, baseScaleX, baseScaleY) {
        const config = TOWER_TYPES[towerType];
        if (!this.devMode) this.gold -= config.cost;

        const tower = {
            id: ++this.towerId,
            x, y,
            type: towerType,
            ...config,
            lastShot: 0,
            sprite,
            baseScaleX,
            baseScaleY,
            orientation: this.getTowerOrientation(x, y),
            angle: 0,
            level: 1,
            xp: 0,
            xpToLevel: 60
        };

        this.towers.push(tower);
        this.grid[y][x].tower = tower;
        return tower;
    }

    sellTower(tower) {
        const config = TOWER_TYPES[tower.type];
        const sellValue = Math.floor(config.cost * 0.6);
        this.gold += sellValue;

        this.grid[tower.y][tower.x].tower = null;

        const idx = this.towers.indexOf(tower);
        if (idx > -1) this.towers.splice(idx, 1);

        return sellValue;
    }

    startWave() {
        if (this.wave >= 10) return;

        const waveConfig = GLOBAL_WAVES[this.globalWave] || GLOBAL_WAVES[GLOBAL_WAVES.length - 1];
        this.spawnQueue = [];

        waveConfig.forEach(group => {
            for (let i = 0; i < group.count; i++) {
                this.spawnQueue.push(group.type);
            }
        });

        // Shuffle
        for (let i = this.spawnQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
        }

        this.wave++;
        this.globalWave++;
        this.waveInProgress = true;

        if (this.onWaveStarted) this.onWaveStarted(this.wave);
    }

    spawnEnemy(type, sprite, body, hpBar, baseScaleX, baseScaleY) {
        const config = ENEMY_TYPES[type];
        const id = ++this.enemyId;

        let route;
        if (config.flying) {
            // Flying enemies go in a straight line from spawn to base
            const baseRoute = this.routes[0];
            const spawn = baseRoute[0];
            const base = baseRoute[baseRoute.length - 1];
            route = [spawn, base];
        } else {
            route = this.routes[id % this.routes.length];
        }
        const spawn = route[0];

        // HP scales +8% per global wave (wave 1 = base, wave 40 = ~4x)
        const hpScale = 1 + (this.globalWave - 1) * 0.08;
        const scaledHp = Math.round(config.hp * hpScale);

        const enemy = {
            id,
            type,
            x: spawn.x,
            y: spawn.y,
            hp: scaledHp,
            maxHp: scaledHp,
            speed: config.speed,
            reward: config.reward,
            pathIndex: 0,
            route,
            flying: !!config.flying,
            slowUntil: 0,
            sprite,
            body,
            hpBar,
            baseScaleX,
            baseScaleY
        };

        this.enemies.push(enemy);
        return enemy;
    }

    update(delta, now) {
        const dt = (delta / 60) * this.gameSpeed;

        // Spawn
        const spawnInterval = 600 / this.gameSpeed;
        if (this.spawnQueue.length > 0 && now - this.lastSpawn > spawnInterval) {
            const type = this.spawnQueue.shift();
            this.lastSpawn = now;
            if (this.onEnemySpawned) this.onEnemySpawned(type);
        }

        // Check wave complete
        if (this.waveInProgress && this.spawnQueue.length === 0 && this.enemies.length === 0) {
            this.waveInProgress = false;
            this.gold += 5;

            if (this.buffs.damage || this.buffs.slow) {
                this.buffs.damage = false;
                this.buffs.slow = false;
                if (this.onBuffsChanged) this.onBuffsChanged(this.buffs);
            }

            if (this.onWaveCompleted) this.onWaveCompleted(this.wave);

            if (this.wave >= 10) {
                if (this.level >= LEVELS.length - 1) {
                    if (this.onVictory) this.onVictory();
                } else {
                    if (this.onLevelComplete) this.onLevelComplete(this.level);
                }
            }
        }

        this.updateEnemies(dt, now);
        this.updateTowers(now);
        this.updateProjectiles(dt, now);
    }

    updateEnemies(dt, now) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            let speed = enemy.speed;
            let isSlow = false;
            if (this.buffs.slow) {
                speed *= 0.5;
                isSlow = true;
            } else if (enemy.slowUntil > now) {
                speed *= 0.35;
                isSlow = true;
            }

            // Cemetery grasp: enemy is frozen + takes DoT
            if (enemy.graspUntil > now) {
                if (now >= enemy.graspDotNext) {
                    enemy.hp -= enemy.graspDotDmg;
                    enemy.graspDotNext = now + 500;
                    if (this.onEnemyDamaged) this.onEnemyDamaged(enemy, enemy.graspDotDmg);
                    if (enemy.hp <= 0) {
                        this.gold += enemy.reward;
                        this.enemies.splice(i, 1);
                        if (this.onEnemyDied) this.onEnemyDied(enemy, i);
                        if (this.onGoldChanged) this.onGoldChanged(this.gold);
                    }
                }
                if (this.onEnemyMoved) this.onEnemyMoved(enemy, now, true);
                continue;
            }

            // Fire burn: DoT sans freeze, l'ennemi continue à avancer
            if (enemy.burnUntil > now) {
                if (now >= enemy.burnDotNext) {
                    enemy.hp -= enemy.burnDotDmg;
                    enemy.burnDotNext = now + 500;
                    if (this.onEnemyDamaged) this.onEnemyDamaged(enemy, enemy.burnDotDmg);
                    if (enemy.hp <= 0) {
                        this.gold += enemy.reward;
                        this.enemies.splice(i, 1);
                        if (this.onEnemyDied) this.onEnemyDied(enemy, i);
                        if (this.onGoldChanged) this.onGoldChanged(this.gold);
                        continue;
                    }
                }
            }

            // Smooth pushback: slide toward pushback target before resuming path
            if (enemy._pushbackTarget) {
                const pbx = enemy._pushbackTarget.x - enemy.x;
                const pby = enemy._pushbackTarget.y - enemy.y;
                const pbDist = Math.sqrt(pbx * pbx + pby * pby);
                if (pbDist < 0.08) {
                    enemy._pushbackTarget = null;
                } else {
                    const move = speed * 2.5 * dt * 0.35;
                    enemy.x += (pbx / pbDist) * Math.min(move, pbDist);
                    enemy.y += (pby / pbDist) * Math.min(move, pbDist);
                    if (this.onEnemyMoved) this.onEnemyMoved(enemy, now, isSlow);
                    continue;
                }
            }

            const target = enemy.route[enemy.pathIndex + 1];
            if (!target) {
                this.health--;
                const idx = i;
                this.enemies.splice(idx, 1);
                if (this.onEnemyReachedBase) this.onEnemyReachedBase(enemy, idx);
                if (this.health <= 0) {
                    if (this.onGameOver) this.onGameOver();
                }
                continue;
            }

            const dx = target.x - enemy.x;
            const dy = target.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.08) {
                enemy.pathIndex++;
            } else {
                const move = speed * dt * 0.35;
                enemy.x += (dx / dist) * move;
                enemy.y += (dy / dist) * move;
            }

            if (this.onEnemyMoved) this.onEnemyMoved(enemy, now, isSlow);
        }
    }

    updateTowers(now) {
        for (const tower of this.towers) {
            if (now - tower.lastShot < tower.cooldown / this.gameSpeed) continue;

            // AoE pulse towers (wind) - hit all enemies in range, no projectile
            if (tower.aoe) {
                const targets = [];
                for (const enemy of this.enemies) {
                    const dx = enemy.x - tower.x;
                    const dy = enemy.y - tower.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= tower.range) targets.push(enemy);
                }
                if (targets.length > 0) {
                    tower.lastShot = now;
                    this.handleWindPulse(tower, targets, now);
                }
                continue;
            }

            let bestTarget = null;
            let bestProgress = -1;

            for (const enemy of this.enemies) {
                const dx = enemy.x - tower.x;
                const dy = enemy.y - tower.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= tower.range && enemy.pathIndex > bestProgress) {
                    if (tower.grasp && enemy.flying) continue; // cemetery can't grab flying
                    if (tower.burn && enemy.flying) continue;  // fire can't target flying
                    bestTarget = enemy;
                    bestProgress = enemy.pathIndex;
                }
            }

            if (bestTarget) {
                tower.lastShot = now;
                if (tower.grasp) {
                    this.handleGraspAttack(tower, bestTarget, now);
                } else {
                    this.fireProjectile(tower, bestTarget);
                }
            }
        }
    }

    handleGraspAttack(tower, target, now) {
        const dmgMult = this.buffs.damage ? 1.5 : 1;
        target.hp -= tower.damage * dmgMult;
        target.graspUntil = now + tower.graspDuration;
        target.graspDotDmg = Math.round(tower.graspDot * dmgMult);
        target.graspDotNext = now + 500;
        this.awardXp(tower, 1);
        if (this.onCemeteryGrasp) this.onCemeteryGrasp(tower, target, tower.graspDuration);
        if (target.hp <= 0) {
            this.gold += target.reward;
            const idx = this.enemies.indexOf(target);
            if (idx > -1) {
                this.enemies.splice(idx, 1);
                if (this.onEnemyDied) this.onEnemyDied(target, idx);
                if (this.onGoldChanged) this.onGoldChanged(this.gold);
            }
        }
    }

    handleWindPulse(tower, targets, now) {
        const dmgMult = this.buffs.damage ? 1.5 : 1;
        const damage = tower.damage * dmgMult;

        let xpGained = 0;
        for (let i = targets.length - 1; i >= 0; i--) {
            const enemy = targets[i];
            enemy.hp -= damage;

            // Pushback: flying enemies pushed 1.2x more, but respect per-enemy cooldown
            if (!enemy._lastPushback || now - enemy._lastPushback > 2500) {
                const pushAmount = tower.pushback * (enemy.flying ? 1.2 : 1);
                this.pushEnemyBack(enemy, pushAmount);
                enemy._lastPushback = now;
            }

            // Cap XP at 4 per pulse to prevent AoE farming
            if (xpGained < 4) {
                this.awardXp(tower, 1);
                xpGained++;
            }

            if (enemy.hp <= 0) {
                const idx = this.enemies.indexOf(enemy);
                if (idx > -1) {
                    this.gold += enemy.reward;
                    this.enemies.splice(idx, 1);
                    if (this.onEnemyDied) this.onEnemyDied(enemy, idx);
                }
            }
        }

        if (this.onWindPulse) this.onWindPulse(tower, targets);
    }

    pushEnemyBack(enemy, amount) {
        const steps = Math.round(amount);
        enemy.pathIndex = Math.max(0, enemy.pathIndex - steps);

        // Set smooth pushback target — position will be interpolated in updateEnemies
        const target = enemy.route[enemy.pathIndex];
        if (target) {
            enemy._pushbackTarget = { x: target.x, y: target.y };
        }
    }

    fireProjectile(tower, target) {
        const projectile = {
            x: tower.x,
            y: tower.y,
            targetId: target.id,
            towerId: tower.id,
            damage: tower.damage,
            speed: tower.speed,
            type: tower.type,
            splash: tower.splash || 0,
            slow: tower.slow || 0,
            pushback: tower.pushback || 0,
            burn: tower.burn || false,
            burnDuration: tower.burnDuration || 0,
            burnDot: tower.burnDot || 0,
            sprite: null
        };

        this.projectiles.push(projectile);
        if (this.onTowerFired) this.onTowerFired(tower, target, projectile);
    }

    updateProjectiles(dt, now) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const target = this.enemies.find(e => e.id === proj.targetId);

            if (!target) {
                // Retarget to nearest enemy instead of disappearing
                let nearest = null;
                let nearestDist = Infinity;
                for (const enemy of this.enemies) {
                    const d = Math.sqrt((enemy.x - proj.x) ** 2 + (enemy.y - proj.y) ** 2);
                    if (d < nearestDist) {
                        nearestDist = d;
                        nearest = enemy;
                    }
                }
                if (nearest) {
                    proj.targetId = nearest.id;
                } else {
                    this.projectiles.splice(i, 1);
                    if (this.onProjectileMissed) this.onProjectileMissed(proj, i);
                }
                continue;
            }

            const dx = target.x - proj.x;
            const dy = target.y - proj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.25) {
                this.handleHit(proj, target, now);
                this.projectiles.splice(i, 1);
                if (this.onProjectileMissed) this.onProjectileMissed(proj, i);
            } else {
                const move = proj.speed * dt * 0.025;
                proj.x += (dx / dist) * move;
                proj.y += (dy / dist) * move;
                if (this.onProjectileMoved) this.onProjectileMoved(proj, dt, target);
            }
        }
    }

    handleHit(proj, target, now) {
        const dmgMult = this.buffs.damage ? 1.5 : 1;
        const damage = proj.damage * dmgMult;
        target.hp -= damage;

        if (proj.slow) target.slowUntil = now + 2500;

        if (proj.pushback && (!target._lastPushback || now - target._lastPushback > 2500)) {
            const pushAmount = proj.pushback * (target.flying ? 1.2 : 1);
            this.pushEnemyBack(target, pushAmount);
            target._lastPushback = now;
        }

        const sourceTower = this.towers.find(t => t.id === proj.towerId);

        // Small XP on hit (1 per hit), kill XP is awarded separately below
        if (sourceTower) this.awardXp(sourceTower, 1);

        if (this.onProjectileHit) this.onProjectileHit(proj, target, damage);

        // Burn on main target
        if (proj.burn) {
            target.burnUntil = now + proj.burnDuration;
            target.burnDotDmg = proj.burnDot;
            target.burnDotNext = now + 500;
            if (this.onFireBurn) this.onFireBurn(target, proj.burnDuration);
        }

        // Splash damage
        if (proj.splash > 0) {
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                if (enemy.id === target.id) continue;
                const d = Math.sqrt((enemy.x - target.x) ** 2 + (enemy.y - target.y) ** 2);
                if (d <= proj.splash) {
                    enemy.hp -= damage * 0.4;
                    if (proj.burn) {
                        enemy.burnUntil = now + proj.burnDuration;
                        enemy.burnDotDmg = proj.burnDot;
                        enemy.burnDotNext = now + 500;
                        if (this.onFireBurn) this.onFireBurn(enemy, proj.burnDuration);
                    }
                    if (enemy.hp <= 0) {
                        this.gold += enemy.reward;
                        this.enemies.splice(j, 1);
                        if (this.onSplashKill) this.onSplashKill(enemy, j);
                    }
                }
            }
        }

        if (target.hp <= 0) {
            const idx = this.enemies.indexOf(target);
            if (idx > -1) {
                this.gold += target.reward;
                this.enemies.splice(idx, 1);
                if (this.onEnemyDied) this.onEnemyDied(target, idx);
            }
        }
    }

    awardXp(tower, amount) {
        if (!tower || tower.level >= 3) return;
        tower.xp += amount;
        if (tower.xp >= tower.xpToLevel) {
            tower.xp -= tower.xpToLevel;
            tower.level++;
            tower.damage = Math.round(tower.damage * 1.15);
            tower.cooldown = Math.round(tower.cooldown * 0.95);
            tower.range += 0.2;
            tower.xpToLevel = Math.round(tower.xpToLevel * 1.4);
            if (tower.level >= 3) tower.xp = tower.xpToLevel;
            if (this.onTowerLevelUp) this.onTowerLevelUp(tower);
        }
    }

    // Shop actions
    buyHeart() {
        if (!this.devMode && this.gold < SHOP_ITEMS.heart.cost) return false;
        if (!this.devMode) this.gold -= SHOP_ITEMS.heart.cost;
        this.health = Math.min(this.health + 1, this.maxHealth);
        return true;
    }

    buyRepair() {
        if (!this.devMode && this.gold < SHOP_ITEMS.repair.cost) return false;
        if (!this.devMode) this.gold -= SHOP_ITEMS.repair.cost;
        this.health = Math.min(this.health + 5, this.maxHealth);
        return true;
    }

    buyNuke() {
        if (!this.devMode && this.gold < SHOP_ITEMS.nuke.cost) return false;
        if (!this.devMode) this.gold -= SHOP_ITEMS.nuke.cost;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            this.gold += enemy.reward;
            this.enemies.splice(i, 1);
            if (this.onEnemyDied) this.onEnemyDied(enemy, i);
        }
        if (this.onNuke) this.onNuke();
        return true;
    }

    activateDamageBuff() {
        if (!this.devMode && this.gold < SHOP_ITEMS.damage.cost) return false;
        if (!this.devMode) this.gold -= SHOP_ITEMS.damage.cost;
        this.buffs.damage = true;
        if (this.onBuffsChanged) this.onBuffsChanged(this.buffs);
        return true;
    }

    activateSlowBuff() {
        if (!this.devMode && this.gold < SHOP_ITEMS.slow.cost) return false;
        if (!this.devMode) this.gold -= SHOP_ITEMS.slow.cost;
        this.buffs.slow = true;
        if (this.onBuffsChanged) this.onBuffsChanged(this.buffs);
        return true;
    }

    resetGameState(levelIndex, resetGlobalWave = false) {
        this.level = levelIndex;
        this.wave = 0;
        if (resetGlobalWave) this.globalWave = 0;
        this.waveInProgress = false;
        this.enemies = [];
        this.projectiles = [];
        this.spawnQueue = [];
        this.towers = [];
        this.buffs = { damage: false, slow: false };
        this.initLevel();
    }

    nextLevel() {
        this.resetGameState(this.level + 1);
        if (this.onLevelChanged) this.onLevelChanged(this.currentLevelData);
    }

    toggleSpeed() {
        this.gameSpeed = this.gameSpeed === 1 ? 2 : this.gameSpeed === 2 ? 3 : 1;
        return this.gameSpeed;
    }

    getEnemyCount() {
        return this.enemies.length + this.spawnQueue.length;
    }
}
