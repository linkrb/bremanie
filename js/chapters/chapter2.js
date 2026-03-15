// ── Chapitre II : La Forêt Enchantée ─────────────────────────

import { SaveManager } from '/bremanie/js/SaveManager.js';

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
        audio.preload('boss_entry', '/bremanie/audio/boss_entry.mp3');
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
            if (!game._chapter2Mode) return;
            SaveManager.save({
                stage:  'chapter2_wave',
                wave:   waveNumber,
                gold:   game.engine.gold,
                health: game.engine.health,
                towers: game.getTowersState(),
            });
            const script = waveDialogues[waveNumber];
            if (!script) return;
            game.engine.paused = true;
            showDialogue(script, () => { game.engine.paused = false; });
        };

        game.onChapter2Win = () => {
            SaveManager.save({ stage: 'chapter3_start' });
            showVictoryBadgeInteractive(() => {
                hideGame();
                showDialogue('chapter2/outro', () => {
                    onChapterEnd(2);
                });
            });
        };
    }

    return { startChapter2, wireCallbacks, _preload };
}
