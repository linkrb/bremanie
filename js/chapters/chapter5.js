// ── Chapitre V : [Titre à définir] ───────────────────────────────

import { SaveManager } from '/js/SaveManager.js';
import { TOWER_TYPES } from '/js/tdConfig.js';

function setup({ audio, showTitle, showDialogue, showGame, hideGame,
                        showVictoryBadgeInteractive, onChapterEnd, preloadTheme }) {

    // Dialogues déclenchés entre les vagues — à compléter
    const waveDialogues = {
        // ex: 3: 'chapter5/wave3_clear',
    };

    let _preloaded = false;
    function _preload() {
        if (_preloaded) return;
        _preloaded = true;
        audio.preload('cozy_family_theme',  '/audio/cozy_family_theme.mp3');
        audio.preload('chessmatch_theme',   '/audio/chessmatch_theme.mp3');
    }

    function startChapter5() {
        _preload();
        preloadTheme('Plateau de Bois');
        showTitle({
            label: 'Chapitre V',
            title: '[Titre]',
            sub:   '[Sous-titre]',
            // bg: '/images/scenes/xxx.jpg',
        }, () => {
            showDialogue('chapter5/intro', () => {
                showGame('chapter5');
            });
        });
    }

    function wireCallbacks(game) {
        const _ch5TowerOverrides = {
            archer: {  vignette: '/images/td/towers/archer/tower_archer_preview_ch5.png' },
            mage:   {   anchorY: 0.85,             vignette: '/images/td/towers/mage/tower_mage_preview_ch5.png'    },
        };

        // Restaure sprites, anchorY et vignettes quand on quitte le ch5
        const _origResetForMode = game._resetForMode.bind(game);
        game._resetForMode = () => {
            if (game._chapter5Mode) {
                for (const [type, overrides] of Object.entries(_ch5TowerOverrides)) {
                    const origFrames = game.renderer.assets[`_orig_tower_${type}_side_idle_frames`];
                    if (origFrames) {
                        game.renderer.assets[`tower_${type}_side_idle_frames`] = origFrames;
                        delete game.renderer.assets[`_orig_tower_${type}_side_idle_frames`];
                    }
                    if (overrides.anchorY !== undefined) {
                        TOWER_TYPES[type].anchorY = game.renderer.assets[`_orig_tower_${type}_anchorY`];
                        delete game.renderer.assets[`_orig_tower_${type}_anchorY`];
                    }
                    const img = document.querySelector(`[data-tower="${type}"] .tower-preview img`);
                    if (img) img.src = game.renderer.assets[`_orig_tower_${type}_vignette`] || img.src;
                }
            }
            _origResetForMode();
        };

        // Surcharge setChapter5Mode : applique les overrides APRÈS _resetForMode (appelé à l'intérieur)
        const _origSetChapter5Mode = game.setChapter5Mode.bind(game);
        game.setChapter5Mode = () => {
            _origSetChapter5Mode();
            for (const [type, overrides] of Object.entries(_ch5TowerOverrides)) {
                const ch5Frames = game.renderer.assets[`tower_${type}_side_idle_ch5_frames`];
                if (ch5Frames) {
                    game.renderer.assets[`_orig_tower_${type}_side_idle_frames`] = game.renderer.assets[`tower_${type}_side_idle_frames`];
                    game.renderer.assets[`tower_${type}_side_idle_frames`] = ch5Frames;
                }
                if (overrides.anchorY !== undefined) {
                    game.renderer.assets[`_orig_tower_${type}_anchorY`] = TOWER_TYPES[type].anchorY;
                    TOWER_TYPES[type].anchorY = overrides.anchorY;
                }
                const img = document.querySelector(`[data-tower="${type}"] .tower-preview img`);
                if (img) {
                    game.renderer.assets[`_orig_tower_${type}_vignette`] = img.src;
                    img.src = overrides.vignette;
                }
            }
        };

        const _prevWaveCompleted = game.onWaveCompleted;
        game.onWaveCompleted = (waveNumber) => {
            _prevWaveCompleted?.(waveNumber);
            if (game._chapter5Mode) {
                const script = waveDialogues[waveNumber];
                if (script) {
                    game.engine.paused = true;
                    showDialogue(script, () => { game.engine.paused = false; });
                }
            }
        };

        game.onChapter5Win = () => {
            hideGame();
            showDialogue('chapter5/victory', () => {
                onChapterEnd(5);
            });
        };
    }

    return { startChapter5, wireCallbacks, _preload };
}

export default setup;
