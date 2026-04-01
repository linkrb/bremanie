// ── Chapitre III : Le Fort de l'Est ──────────────────────────

import { SaveManager } from '/js/SaveManager.js';

export function setup({ audio, showTitle, showDialogue, showGame, hideGame,
                        showVictoryBadgeInteractive, onChapterEnd }) {

    // Dialogues déclenchés après chaque vague (clés = numéro de vague 1-based)
    const waveDialogues = {};

    let _preloaded = false;
    function _preload() {
        if (_preloaded) return;
        _preloaded = true;
        audio.preload('chapter3_theme', '/audio/calme.mp3');
        audio.preload('night',          '/audio/night_sound.mp3');
        audio.preload('door',          '/audio/door.mp3');
        audio.preload('tactics',       '/audio/tactics.mp3');
        audio.preload('explosion',          '/audio/explosion.mp3');
        audio.preload('strategy',          '/audio/strategy.mp3');
        audio.preload('tornado_spawn',     '/audio/tornado_spawn.mp3');
    }

    function startChapter3() {
        _preload();
        showTitle({
            label: 'Chapitre III',
            title: 'Le Fort',
            sub:   "de l'Est",
        }, () => {
            audio.crossfadeTo('calme', 2000);
            showDialogue('chapter3/intro', () => {
                showGame('chateau');
            });
        });
    }

    function wireCallbacks(game) {
        const _prevWaveCompleted = game.onWaveCompleted;
        game.onWaveCompleted = (waveNumber) => {
            _prevWaveCompleted?.(waveNumber);
            if (game._chateauMode) {
                const script = waveDialogues[waveNumber];
                if (script) {
                    game.engine.paused = true;
                    showDialogue(script, () => { game.engine.paused = false; });
                }
            }
        };

        game.onChateauWin = () => {
            // Phase 1 terminée : dialogue de transition puis boss tornado
            const savedTowers = game.getTowersState();
            const savedGold   = game.engine.gold;
            const savedHealth = game.engine.health;
            hideGame();
            showDialogue('chapter3/post_combat', () => {
                showGame('chateau_boss');
                game.applySaveState({ wave: 0, gold: savedGold, health: 15, towers: savedTowers });
            });
        };

        game.engine.onTornadoWarning = () => {
            audio.playSfx('tornado_spawn');
        };

        game.onChateauBossWin = () => {
            hideGame();
            showDialogue('chapter3/post_tornado', () => {
                showGame('chateau_final');
            });
        };

        game.onChateauFinalWin = () => {
            hideGame();
            showDialogue('chapter3/victory', () => {
                onChapterEnd(3);
            });
        };
    }

    return { startChapter3, wireCallbacks, _preload };
}
