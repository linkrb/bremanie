// ── Chapitre II : La Forêt Enchantée ─────────────────────────

import { SaveManager } from '/js/SaveManager.js';

export function setup({ audio, showTitle, showDialogue, showGame, hideGame,
                        showVictoryBadgeInteractive, onChapterEnd }) {

    const waveDialogues = {
        1: 'chapter2/wave1_clear',
        2: 'chapter2/wave2_clear',
    };

    // Preload des pistes du chapitre 2
    let _preloaded = false;
    function _preload() {
        if (_preloaded) return;
        _preloaded = true;
        audio.preload('combat_theme', '/audio/combat_theme.mp3');
        audio.preload('boss_entry',  '/audio/boss_entry.mp3');
        audio.preload('wind',        '/audio/wind.mp3');
    }

    function startChapter2() {
        _preload();
        showTitle({
            label: 'Chapitre II',
            title: 'La Forêt',
            sub:   'Enchantée',
        }, () => {
            showDialogue('chapter2/intro', () => {
                showGame('chapter2');
            });
        });
    }

    function wireCallbacks(game) {
        game.onWaveCompleted = (waveNumber) => {
            const script = waveDialogues[waveNumber];
            if (!script || !game._chapter2Mode) return;
            game.engine.paused = true;
            showDialogue(script, () => { game.engine.paused = false; });
        };

        game.onChapter2Win = () => {
            showVictoryBadgeInteractive(() => {
                showDialogue('chapter2/outro', () => {
                    onChapterEnd(2);
                });
            });
        };

        game.onChapter3Win = () => {
            showVictoryBadgeInteractive(() => {
                hideGame();
                showDialogue('chapter2/final', () => {
                    onChapterEnd('2b');
                });
            });
        };
    }

    return { startChapter2, wireCallbacks, _preload };
}
