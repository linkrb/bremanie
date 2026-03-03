import { AudioManager }    from './AudioManager.js';
import { DialogueEngine }  from './DialogueEngine.js';
import { TowerDefenseGame } from '/bremanie/js/TowerDefenseGame.js';

// ── Instances globales ────────────────────────────────────────
const audio = new AudioManager({ targetVolume: 0.7, fadeInMs: 3000, fadeOutSec: 6 });
const dlg   = new DialogueEngine({
    basePath:     '/bremanie/images/',
    dialoguePath: '/bremanie/dialogues/',
    typeSpeed: 25,
});

// Jeu TD : lazy-init (chargé seulement au premier combat)
let game            = null;
let gameInitPromise = null;

audio.preload('main_theme',      '/bremanie/audio/main_theme.mp3');
audio.preload('prologue_siege',  '/bremanie/audio/prologue_siege.mp3');
audio.preload('wind',            '/bremanie/audio/wind.mp3');
audio.preload('title_sting',     '/bremanie/audio/title_sting.mp3');
audio.preload('combat_theme',    '/bremanie/audio/combat_theme.mp3');
audio.preload('combat_sting',    '/bremanie/audio/combat_sting.mp3');
audio.preload('tower_place',     '/bremanie/audio/tower_place.mp3');

dlg.onMusic = (track) => audio.crossfadeTo(track, 1500);
dlg.onSfx     = (track) => audio.playSfx(track);
dlg.onSfxLoop = (track) => audio.playSfxLoop(track);
dlg.onSfxStop = (track) => audio.stopSfx(track);

// ── Navigation ────────────────────────────────────────────────

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
        if (s.id !== id) s.classList.remove('active');
    });
    document.getElementById(id).classList.add('active');
}

function showTitle({ label, title, sub, bg, bgPosition = 'center' }, onTap) {
    document.getElementById('title-label').textContent = label;
    document.getElementById('title-main').textContent  = title;
    document.getElementById('title-sub').textContent   = sub;

    const bgEl = document.getElementById('title-bg');
    bgEl.style.backgroundImage    = `url('${bg}')`;
    bgEl.style.backgroundPosition = bgPosition;

    showScreen('screen-title');
    audio.playSfx('title_sting');

    let ready = false;
    setTimeout(() => { ready = true; }, 1500);

    function onInteract() {
        if (!ready) return;
        document.getElementById('screen-title').removeEventListener('pointerup', onInteract);
        document.removeEventListener('keydown', onKey);
        // Fade out immédiatement — évite le flash si screen-title reste actif sous un dialogue
        document.getElementById('screen-title').classList.remove('active');
        onTap();
    }

    function onKey(e) {
        if (['Space', 'Enter', 'ArrowRight'].includes(e.code)) onInteract();
    }

    document.getElementById('screen-title').addEventListener('pointerup', onInteract);
    document.addEventListener('keydown', onKey);
}

function showDialogue(script, onEnd) {
    dlg.load(script, onEnd);
}

const screenGame  = document.getElementById('screen-game');
const combatBadge = document.getElementById('combat-badge');
const victoryBadge = document.getElementById('victory-badge');
const defeatBadge  = document.getElementById('defeat-badge');
let combatMusicStarted = false;
let skipEntryWaveBadge = false; // évite le double badge au démarrage d'un combat

function showBadge(el, duration = 3100) {
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
}

function showCombatBadge()  { audio.playSfx('combat_sting'); showBadge(combatBadge, 1900); }
function showVictoryBadge() { showBadge(victoryBadge, 3100); }
function showDefeatBadge()  { showBadge(defeatBadge,  3100); }

// Badge interactif générique : entre en scène (classe .hold), attend le clic, puis appelle next()
function showBadgeInteractive(el, next) {
    el.classList.remove('show', 'hold');
    void el.offsetWidth;
    el.classList.add('hold');

    let ready = false;
    setTimeout(() => { ready = true; }, 900);

    function advance() {
        if (!ready) return;
        document.removeEventListener('pointerup', advance);
        document.removeEventListener('keydown', onKey);
        el.style.transition = 'opacity 0.6s ease';
        el.style.opacity = '0';
        setTimeout(() => {
            el.classList.remove('hold');
            el.style.transition = '';
            el.style.opacity = '';
            next();
        }, 600);
    }
    function onKey(e) {
        if (['Space', 'Enter', 'ArrowRight'].includes(e.code)) advance();
    }
    document.addEventListener('pointerup', advance);
    document.addEventListener('keydown', onKey);
}

function showVictoryBadgeInteractive(next) { showBadgeInteractive(victoryBadge, next); }
function showDefeatBadgeInteractive(next)  { showBadgeInteractive(defeatBadge,  next); }

function startCombatMusic() {
    if (combatMusicStarted) return;
    combatMusicStarted = true;
    audio.crossfadeTo('combat_theme', 2000);
}

function setCombatMode(on) {
    screenGame.classList.toggle('combat-mode', on);
    combatMusicStarted = false;
}

// ── Callbacks du jeu (câblés après init) ─────────────────────

function wireGameCallbacks() {
    // Son de pose de tour
    game.onTowerPlaced = () => audio.playSfx('tower_place');

    // Pastille + musique à chaque début de vague (pause moteur pendant le logo)
    game.onWaveStarted = () => {
        if (skipEntryWaveBadge) {
            // Badge déjà affiché à l'entrée de l'écran — on saute badge + pause pour cette vague
            skipEntryWaveBadge = false;
            startCombatMusic(); // idempotent (combatMusicStarted guard)
            return;
        }
        showCombatBadge();
        startCombatMusic();
        game.engine.paused = true;
        setTimeout(() => { game.engine.paused = false; }, 1900);
    };

    game.onScriptedDefeat = () => {
        audio.crossfadeTo('wind', 2000);
        showDefeatBadgeInteractive(() => {
            showDialogue('chapter1/nathan_power', () => {
                showDialogue('chapter1/towers_appear', () => {
                    showGame('tutorial');
                });
            });
        });
    };

    // Badge victoire interactif (avant dialogue tutorial_win)
    game.onTutorialVictory = (next) => {
        showVictoryBadgeInteractive(next);
    };

    game.onTutorialWin = () => {
        // Après dialogue tutorial_win → fondu + "Fin du Chapitre I"
        audio.stop(2000);
        const chapterEnd = document.getElementById('chapter-end');
        fadeToBlack(2000).then(() => {
            chapterEnd.style.opacity = '1';
            setTimeout(() => {
                chapterEnd.style.opacity = '0';
                setTimeout(() => {
                    showGame('normal');
                    audio.crossfadeTo('main_theme', 2000);
                    fadeFromBlack(1500);
                }, 1200);
            }, 3000);
        });
    };
}

// ── Lazy init du jeu TD ───────────────────────────────────────

async function ensureGameInit() {
    if (game) return;
    if (!gameInitPromise) {
        const loader = document.getElementById('loader');
        loader?.classList.remove('hidden');

        const g = new TowerDefenseGame();
        gameInitPromise = g.init(document.getElementById('game-container')).then(() => {
            game = g;
            wireGameCallbacks();
            window.game = game;
            loader?.classList.add('hidden');
            setTimeout(() => loader?.remove(), 600);
        });
    }
    await gameInitPromise;
}

// ── showGame ──────────────────────────────────────────────────
// Synchrone côté appelant : si le jeu n'est pas encore init,
// lance l'init en arrière-plan et se rappelle automatiquement.

function showGame(mode) {
    if (!game) {
        // Passe à screen-game en premier : le loader (qui est à l'intérieur)
        // devient visible grâce à l'opacité du parent.
        showScreen('screen-game');
        ensureGameInit()
            .then(() => showGame(mode))
            .catch(err => console.error('[Brémanie] TD init failed:', err));
        return;
    }
    showScreen('screen-game');
    if (mode === 'scripted') {
        setCombatMode(true);
        startCombatMusic();
        showCombatBadge();
        skipEntryWaveBadge = true; // la première vague auto ne doit pas rejouer le badge
        game.setScriptedMode();
    } else if (mode === 'tutorial') {
        setCombatMode(true);
        startCombatMusic();
        showCombatBadge();
        skipEntryWaveBadge = true; // le clic sur "lancer la vague" ne doit pas rejouer le badge
        game.setTutorialMode();
    } else {
        skipEntryWaveBadge = false;
        setCombatMode(false);
        game.setNormalMode();
    }
}

// ── Bouton "Rejouer" (mode normal) ───────────────────────────
document.getElementById('game-over-restart').addEventListener('click', () => {
    document.getElementById('game-over').classList.remove('visible');
    game.setNormalMode();
});

// ── Press-Start ───────────────────────────────────────────────
const ps = document.getElementById('press-start');

ps.addEventListener('pointerdown', () => {
    audio.play('main_theme');
    ps.classList.add('fade-out');
    setTimeout(() => ps.remove(), 1500);
});

// ── Bouton "Commencer l'Aventure" ─────────────────────────────
function fadeToBlack(ms) {
    return new Promise(resolve => {
        const el = document.getElementById('fade-black');
        el.style.transition = `opacity ${ms / 1000}s ease`;
        el.style.pointerEvents = 'all';
        el.style.opacity = '1';
        setTimeout(resolve, ms);
    });
}

function fadeFromBlack(ms) {
    const el = document.getElementById('fade-black');
    el.style.transition = `opacity ${ms / 1000}s ease`;
    el.style.opacity = '0';
    setTimeout(() => { el.style.pointerEvents = 'none'; }, ms);
}

// ── Flow Prologue → Chapitre I ────────────────────────────────

function startPrologue() {
    showTitle({
        label: 'Prologue',
        title: "L'Ombre",
        sub:   'du Nécromancien',
        bg:    '/bremanie/images/td/splash_bremanie.jpg',
    }, () => {
        showDialogue('prologue/siege', () => {
            audio.stop(1500);
            fadeToBlack(1500).then(() => {
                startChapter1();
                fadeFromBlack(1000);
            });
        });
    });
}

function startChapter1() {
    showTitle({
        label: 'Chapitre I',
        title: 'La Fuite',
        sub:   'Les Enfants du Roi',
        bg:    '/bremanie/images/scenes/chapter1_bg.jpg',
    }, () => {
        showDialogue('chapter1/intro', () => {
            showGame('scripted');
        });
    });
}

// Point d'entrée après la défaite scriptée (nathan_power déjà vu)
function startChapter1Tutorial() {
    showGame('tutorial');
}

// ── Flow Chapitre II ───────────────────────────────────────────

function startChapter2() {
    showTitle({
        label: 'Chapitre II',
        title: 'La Forêt',
        sub:   'Enchantée',
    }, () => {
        showDialogue('chapter2/intro', () => {
            // TODO: lancer le combat chapitre 2
        });
    });
}

document.getElementById('btn-start').addEventListener('click', () => {
    audio.stop(2000);
    fadeToBlack(2000).then(() => {
        startPrologue();
        fadeFromBlack(1000);
    });
});

// ── Loader : masqué immédiatement, réutilisé par ensureGameInit ──
const loaderEl = document.getElementById('loader');
loaderEl.classList.add('hidden');
// NB : on ne supprime pas le loader du DOM — ensureGameInit() en a besoin
//      lors du premier chargement du jeu TD (PixiJS + sprites).

// ── Dev / debug URL params ────────────────────────────────────
// ?chapter=prologue   → titre Prologue (sans press-start ni musique)
// ?chapter=1          → titre Chapitre I → dialogue intro → combat scripté
// ?chapter=1b         → dialogue nathan_power → tutorial
// ?chapter=1c         → tutorial directement
// ?chapter=2          → titre Chapitre II → dialogue intro (WIP)
// ?scene=xxx/yyy      → dialogue précis (ex: prologue/siege)
// ?dev=combat         → TD mode scripté direct
// ?dev=tutorial       → TD mode tutorial direct
// ?dev=normal         → TD worldmap direct
const params  = new URLSearchParams(location.search);
const chapter = params.get('chapter');
const scene   = params.get('scene');
const dev     = params.get('dev');

if (chapter === 'prologue') { audio.play('main_theme'); startPrologue(); }
if (chapter === '1')        { audio.play('main_theme'); startChapter1(); }
if (chapter === '1b')       {
    audio.crossfadeTo('wind', 0);
    showDialogue('chapter1/nathan_power', () => {
        showDialogue('chapter1/towers_appear', () => { showGame('tutorial'); });
    });
}
if (chapter === '1c')       { startChapter1Tutorial(); }
if (chapter === '2')        { audio.play('main_theme'); startChapter2(); }
if (scene)                  { showDialogue(scene, () => {}); }
if (dev === 'combat')       { showGame('scripted'); }
if (dev === 'tutorial')     { showGame('tutorial'); }
if (dev === 'normal')       { showGame('normal'); }
