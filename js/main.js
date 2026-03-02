import { AudioManager }    from './AudioManager.js';
import { DialogueEngine }  from './DialogueEngine.js';
import { TowerDefenseGame } from '/js/games/td/TowerDefenseGame.js';

// ── Instances globales ────────────────────────────────────────
const audio = new AudioManager({ targetVolume: 0.7, fadeInMs: 3000, fadeOutSec: 6 });
const dlg   = new DialogueEngine({
    basePath:     '/bremanie/images/',
    dialoguePath: '/bremanie/dialogues/',
    typeSpeed: 25,
});
const game = new TowerDefenseGame();

audio.preload('main_theme',      '/bremanie/audio/main_theme.mp3');
audio.preload('prologue_siege',  '/bremanie/audio/prologue_siege.mp3');

dlg.onMusic = (track) => audio.crossfadeTo(track, 1500);

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

    let ready = false;
    setTimeout(() => { ready = true; }, 1500);

    function onInteract() {
        if (!ready) return;
        document.getElementById('screen-title').removeEventListener('pointerup', onInteract);
        document.removeEventListener('keydown', onKey);
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

function showGame(mode) {
    showScreen('screen-game');
    if (mode === 'scripted')  game.setScriptedMode();
    else if (mode === 'tutorial') game.setTutorialMode();
    else                      game.setNormalMode();
}

// ── Callbacks du jeu ─────────────────────────────────────────

game.onScriptedDefeat = () => {
    showDialogue('chapter1/nathan_power', () => {
        showDialogue('chapter1/towers_appear', () => {
            showGame('tutorial');
        });
    });
};

game.onTutorialWin = () => {
    audio.crossfadeTo('main_theme', 2000);
    showGame('normal');
};

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
document.getElementById('btn-start').addEventListener('click', () => {
    audio.stop(2000);

    showTitle({
        label: 'Prologue',
        title: "L'Ombre",
        sub:   'du Nécromancien',
        bg:    '/images/td/splash_bremanie.jpg',
    }, () => {
        showDialogue('prologue/siege', () => {
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
        });
    });
});

// ── Init jeu (une seule fois au démarrage) ────────────────────
await game.init(document.getElementById('game-container'));
window.game = game; // accès dev console

document.getElementById('loader').classList.add('hidden');
setTimeout(() => document.getElementById('loader').remove(), 600);
