// ── Chapitre IV : Évasion sous la lune ───────────────────────

import { SaveManager } from '/bremanie/js/SaveManager.js';

export function setup({ audio, showTitle, showDialogue, showGame, hideGame,
                        showVictoryBadgeInteractive, onChapterEnd }) {

    const waveDialogues = {
        4: 'chapter4/wave4_clear',
        5: 'chapter4/wave5_clear',
        8: 'chapter4/wave8_clear',
    };

    let _preloaded = false;
    function _preload() {
        if (_preloaded) return;
        _preloaded = true;
        audio.preload('seraphelle_theme',   '/bremanie/audio/seraphelle_theme.mp3');
        audio.preload('night_battle_theme', '/bremanie/audio/night_battle_theme.mp3');
        audio.preload('punch_1', '/bremanie/audio/punch_1.mp3');
        audio.preload('punch_2', '/bremanie/audio/punch_2.mp3');
        audio.preload('punch_3', '/bremanie/audio/punch_3.mp3');
        audio.preload('night',              '/bremanie/audio/night_sound.mp3');
        audio.preload('wind',               '/bremanie/audio/wind.mp3');
        audio.preload('boss_entry',               '/bremanie/audio/boss_entry.mp3');
    }

    function startChapter4() {
        _preload();
        showTitle({
            label: 'Chapitre IV',
            title: 'Évasion',
            sub:   'sous la lune',
        }, () => {
            showDialogue('chapter4/intro', () => {
                showGame('chapter4');
            });
        });
    }

    function wireCallbacks(game) {
        game.onHeroPunch = () => audio.playSfx(`punch_${Math.ceil(Math.random() * 3)}`);

        const _prevWaveCompleted = game.onWaveCompleted;
        game.onWaveCompleted = (waveNumber) => {
            _prevWaveCompleted?.(waveNumber);
            if (game._chapter4Mode) {
                const script = waveDialogues[waveNumber];
                if (script) {
                    game.engine.paused = true;
                    showDialogue(script, () => { game.engine.paused = false; });
                }
            }
        };

        game.onChapter4Win = () => {
            hideGame();
            showDialogue('chapter4/victory', () => {
                onChapterEnd(4);
            });
        };
    }

    return { startChapter4, wireCallbacks, _preload };
}
