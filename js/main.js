import { AudioManager }    from './AudioManager.js';
import { DialogueEngine }  from './DialogueEngine.js';
import { TowerDefenseGame } from '/bremanie/js/TowerDefenseGame.js';
import { setup as setupChapter1 } from './chapters/chapter1.js';
import { setup as setupChapter2 } from './chapters/chapter2.js';
import { setup as setupChapter3 } from './chapters/chapter3.js';
import { SaveManager }     from './SaveManager.js';

// ── Instances globales ────────────────────────────────────────
const audio = new AudioManager({ targetVolume: 0.7, fadeInMs: 3000, fadeOutSec: 6 });
const dlg   = new DialogueEngine({
    basePath:     '/bremanie/images/',
    dialoguePath: '/bremanie/dialogues/',
    typeSpeed: 25,
});

let game            = null;
let gameInitPromise = null;

// Sons UI globaux — chargés dès le départ (nécessaires dès le premier écran)
audio.preload('main_theme',   '/bremanie/audio/main_theme.mp3');
audio.preload('title_sting',  '/bremanie/audio/title_sting.mp3');
audio.preload('combat_sting', '/bremanie/audio/combat_sting.mp3');
audio.preload('tower_place',  '/bremanie/audio/tower_place.mp3');
// Les pistes par chapitre sont preloadées dans chaque chapter*.js au démarrage du chapitre

dlg.onMusic     = (track) => audio.crossfadeTo(track, 1500);
dlg.onMusicStop = ()      => audio.stop(1500);
dlg.onSfx       = (track) => audio.playSfx(track);
dlg.onSfxLoop   = (track) => audio.playSfxLoop(track);
dlg.onSfxStop   = (track) => audio.stopSfx(track);

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

function hideGame() {
    screenGame.classList.remove('active');
}

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

// ── Badges ────────────────────────────────────────────────────

const screenGame  = document.getElementById('screen-game');
const combatBadge = document.getElementById('combat-badge');
const victoryBadge = document.getElementById('victory-badge');
const defeatBadge  = document.getElementById('defeat-badge');
let combatMusicStarted = false;
let skipEntryWaveBadge = false;

function showBadge(el, duration = 3100) {
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
}

function showCombatBadge()  { audio.playSfx('combat_sting'); showBadge(combatBadge, 1900); }

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

function setCombatMode(on, chapter = null) {
    screenGame.classList.toggle('combat-mode', on);
    screenGame.classList.toggle('chapter2-mode', on && chapter === 2);
    combatMusicStarted = false;
}

// ── Chapitres ─────────────────────────────────────────────────

function showChapterEnd(label, next) {
    const chapterEnd = document.getElementById('chapter-end');
    document.getElementById('chapter-end-title').textContent = label;
    audio.stop(2000);
    fadeToBlack(2000).then(() => {
        chapterEnd.style.opacity = '1';
        setTimeout(() => {
            chapterEnd.style.opacity = '0';
            setTimeout(() => {
                fadeFromBlack(1500);
                next?.();
            }, 1200);
        }, 3000);
    });
}

function onChapterEnd(chapterNumber) {
    if (chapterNumber === 1)    showChapterEnd('Chapitre I',   () => chapter2.startChapter2());
    if (chapterNumber === 2)    showGame('chapter2b');
    if (chapterNumber === '2b') showChapterEnd('Chapitre II',  () => chapter3.startChapter3());
    if (chapterNumber === 3)    showChapterEnd('Chapitre III', () => { /* chapitre IV à venir */ });
}

// ── Reprise depuis une sauvegarde ─────────────────────────────

async function resumeFromSave(save) {
    chapter1._preload();
    chapter2._preload();
    chapter3._preload();
    // S'assurer que le jeu est initialisé avant d'appeler showGame (pour rester synchrone)
    await ensureGameInit();

    if (save.stage === 'chapter2_start') {
        chapter2.startChapter2();
        return;
    }

    if (save.stage === 'chapter2_wave') {
        showGame('chapter2');
        game.applySaveState({ wave: save.wave, gold: save.gold, health: save.health, towers: save.towers });
        return;
    }

    if (save.stage === 'chapter3_start') {
        chapter3.startChapter3();
        return;
    }

    if (save.stage === 'complete') {
        // Chapitre 3 terminé — afficher l'écran de fin en attendant le chapitre 4
        showChapterEnd('Chapitre III', () => { /* Chapitre IV à venir */ });
        return;
    }

    if (save.stage === 'chapter3_wave') {
        // Appel avec skipDefaultTower=true pour ne pas poser la mage par défaut
        game.setChateauMode(true);
        showScreen('screen-game');
        setCombatMode(true, 2);
        startCombatMusic();
        skipEntryWaveBadge = true;
        game.applySaveState({ wave: save.wave, gold: save.gold, health: save.health, towers: save.towers });
    }
}

const ctx = {
    audio, showTitle, showDialogue, showGame, hideGame,
    showDefeatBadgeInteractive, showVictoryBadgeInteractive,
    fadeToBlack, fadeFromBlack,
    onChapterEnd, resumeFromSave,
};

const chapter1 = setupChapter1(ctx);
const chapter2 = setupChapter2(ctx);
const chapter3 = setupChapter3(ctx);

// ── Lazy init + callbacks ─────────────────────────────────────

function wireGameCallbacks() {
    game.onTowerPlaced = () => audio.playSfx('tower_place');

    game.onWaveStarted = () => {
        if (skipEntryWaveBadge) {
            skipEntryWaveBadge = false;
            startCombatMusic();
            return;
        }
        showCombatBadge();
        startCombatMusic();
        game.engine.paused = true;
        setTimeout(() => { game.engine.paused = false; }, 1900);
    };

    chapter1.wireCallbacks(game);
    chapter2.wireCallbacks(game);
    chapter3.wireCallbacks(game);
}

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

function showGame(mode) {
    if (!game) {
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
        skipEntryWaveBadge = true;
        game.setScriptedMode();
    } else if (mode === 'tutorial') {
        setCombatMode(true);
        startCombatMusic();
        showCombatBadge();
        skipEntryWaveBadge = true;
        game.setTutorialMode();
    } else if (mode === 'chapter2') {
        setCombatMode(true, 2);
        startCombatMusic();
        showCombatBadge();
        skipEntryWaveBadge = true;
        game.setChapter2Mode();
    } else if (mode === 'chapter2b') {
        setCombatMode(true, 2);
        startCombatMusic();
        showCombatBadge();
        skipEntryWaveBadge = true;
        game.setFortMode();
    } else if (mode === 'chateau') {
        setCombatMode(true, 2);
        audio.crossfadeTo('tactics', 2000);
        combatMusicStarted = true;
        showCombatBadge();
        skipEntryWaveBadge = true;
        game.setChateauMode();
    } else if (mode === 'chateau_boss') {
        setCombatMode(true, 2);
        showCombatBadge();
        skipEntryWaveBadge = true;
        game.setChateauBossMode();
    } else if (mode === 'chateau_final') {
        setCombatMode(true, 2);
        showCombatBadge();
        skipEntryWaveBadge = true;
        game.setChateauFinalMode();
    } else {
        skipEntryWaveBadge = false;
        setCombatMode(false);
        game.setNormalMode();
    }
}

// ── Bouton "Rejouer" ──────────────────────────────────────────
document.getElementById('game-over-restart').addEventListener('click', () => {
    document.getElementById('game-over').classList.remove('visible');
    game.replay();
});

// ── Press-Start ───────────────────────────────────────────────
const ps = document.getElementById('press-start');
ps.addEventListener('pointerdown', () => {
    audio.play('main_theme');
    ps.classList.add('fade-out');
    setTimeout(() => ps.remove(), 1500);
});

// ── Bouton "Commencer l'Aventure" ─────────────────────────────
document.getElementById('btn-start').addEventListener('click', () => {
    audio.stop(2000);
    fadeToBlack(2000).then(() => {
        chapter1.startPrologue();
        fadeFromBlack(1000);
    });
});

// ── Loader ────────────────────────────────────────────────────
document.getElementById('loader').classList.add('hidden');

// ── Exposition globale pour le script inline du bouton Reprendre ──
window._bremanieAudio  = audio;
window._bremanieResume = resumeFromSave;

// ── Dev / debug URL params ────────────────────────────────────
// ?chapter=prologue   → titre Prologue
// ?chapter=1          → titre Chapitre I → dialogue intro → combat scripté
// ?chapter=1b         → dialogue nathan_power → tutorial
// ?chapter=1c         → tutorial directement
// ?chapter=2          → titre Chapitre II
// ?scene=xxx/yyy      → dialogue précis
// ?dev=combat         → TD mode scripté direct
// ?dev=tutorial       → TD mode tutorial direct
// ?dev=normal         → TD worldmap direct
// ?dev=chapter2       → TD mode forêt direct
// ?dev=end_ch1        → écran fin Chapitre I → début ch2
// ?dev=end_ch2        → dialogue final ch2 → écran fin Chapitre II → début ch3
// ?dev=end_ch3        → dialogue victoire ch3 → écran fin Chapitre III
// ?dev=victory        → alias end_ch3 (rétro-compat)
const params  = new URLSearchParams(location.search);
const chapter = params.get('chapter');
const scene   = params.get('scene');
const dev     = params.get('dev');

if (chapter === 'prologue') { audio.play('main_theme'); chapter1.startPrologue(); }
if (chapter === '1')        { audio.play('main_theme'); chapter1.startChapter1(); }
if (chapter === '1b')       {
    chapter1._preload();
    audio.crossfadeTo('wind', 0);
    showDialogue('chapter1/nathan_power', () => {
        showDialogue('chapter1/towers_appear', () => { showGame('tutorial'); });
    });
}
if (chapter === '1c')       { chapter1._preload(); showGame('tutorial'); }
if (chapter === '2')        { audio.play('main_theme'); chapter2.startChapter2(); }
if (scene)                  { showDialogue(scene, () => {}); }
if (dev === 'combat')       { chapter1._preload(); showGame('scripted'); }
if (dev === 'tutorial')     { chapter1._preload(); showGame('tutorial'); }
if (dev === 'normal')       { showGame('normal'); }
if (dev === 'chapter2')     { chapter1._preload(); chapter2._preload(); showGame('chapter2'); }
if (dev === 'chapter2b')    { chapter1._preload(); chapter2._preload(); chapter3._preload(); showGame('chapter2b'); }
if (dev === 'chapter3')     { chapter1._preload(); chapter2._preload(); chapter3._preload(); chapter3.startChapter3(); }
if (dev === 'chateau')      { chapter3._preload(); showGame('chateau'); }
if (dev === 'chateau_boss')   { chapter3._preload(); showGame('chateau_boss'); }
if (dev === 'chateau_final')  { chapter3._preload(); showGame('chateau_final'); }
if (dev === 'end_ch1')        { chapter1._preload(); chapter2._preload(); onChapterEnd(1); }
if (dev === 'end_ch2')        { chapter2._preload(); chapter3._preload(); showDialogue('chapter2/final', () => { onChapterEnd('2b'); }); }
if (dev === 'end_ch3' || dev === 'victory') { chapter3._preload(); showDialogue('chapter3/victory', () => { onChapterEnd(3); }); }
