// ── Chapitre VI : [Titre à définir] ───────────────────────────
// Personnage principal : Anna

import { SaveManager } from '/js/SaveManager.js';

export function setup({ audio, showTitle, showDialogue, showGame, hideGame,
                        showVictoryBadgeInteractive, onChapterEnd, preloadTheme, dlg }) {

    const waveDialogues = {
        3: 'chapter6/wave3_clear',
        4: 'chapter6/wave4_clear',
        7: 'chapter6/wave7_clear',
    };

    let _preloaded = false;
    function _preload() {
        if (_preloaded) return;
        _preloaded = true;
        audio.preload('strategy',           '/audio/strategy.mp3');
        audio.preload('night_battle_theme', '/audio/night_battle_theme.mp3');
        audio.preload('punch_1', '/audio/punch_1.mp3');
        audio.preload('punch_2', '/audio/punch_2.mp3');
        audio.preload('punch_3', '/audio/punch_3.mp3');
        audio.preload('fire_trap',     '/audio/fire_trap.mp3');
        audio.preload('crow_warning',   '/audio/crow_warning.mp3');
        audio.preload('banshee_scream', '/audio/banshee_scream.mp3');
        dlg.preload([
            'chapter6/intro',
            'chapter6/martin_tuto',
            'chapter6/wave3_clear',
            'chapter6/wave4_clear',
            'chapter6/wave7_clear',
            'chapter6/victory',
        ]);
    }

    function startChapter6() {
        _preload();
        preloadTheme('Forêt de la Vive-Eau');
        showTitle({
            label: 'Chapitre VI',
            title: "L'Autre Rive",
            sub:   'La fuite vers Vive-Eau',
        }, () => {
            showDialogue('chapter6/intro', () => {
                showGame('chapter6');
            });
        });
    }

    function wireCallbacks(game) {
        game.onHeroPunch    = () => audio.playSfx(`punch_${Math.ceil(Math.random() * 3)}`);
        game.engine.onTrapApproach  = () => audio.playSfx('fire_trap');
        const _prevTowerStunned = game.engine.onTowerStunned;
        game.engine.onTowerStunned = (tower, enemy) => {
            _prevTowerStunned?.(tower, enemy);
            audio.playSfx('banshee_scream');
        };

        const _prevWaveStarted = game.onWaveStarted;
        game.onWaveStarted = (waveNumber) => {
            _prevWaveStarted?.(waveNumber);
            if (!game._chapter6Mode) return;
            if (waveNumber === 1) {
                game.engine.paused = true;
                showDialogue('chapter6/martin_tuto', () => { game.engine.paused = false; });
            }
        };

        const _prevWaveCompleted = game.onWaveCompleted;
        game.onWaveCompleted = (waveNumber) => {
            _prevWaveCompleted?.(waveNumber);
            if (!game._chapter6Mode) return;

            if (waveNumber === 1) audio.playSfx('crow_warning');

            const script = waveDialogues[waveNumber];
            if (script) {
                game.engine.paused = true;
                showDialogue(script, () => {
                    if (waveNumber === 4 || waveNumber === 7) {
                        game._chapter6Traps += 2;
                        game.updateTrapUI();
                    }
                    game.engine.paused = false;
                });
            }
        };

        game.onChapter6Win = () => {
            hideGame();
            showDialogue('chapter6/victory', () => {
                onChapterEnd(6);
            });
        };
    }

    return { startChapter6, wireCallbacks, _preload };
}
