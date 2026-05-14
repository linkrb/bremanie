// ── Chapitre V : [Titre à définir] ───────────────────────────────

import { SaveManager } from '/js/SaveManager.js';
import { TOWER_TYPES } from '/js/tdConfig.js';
import { runQuiz }     from '/js/QuizEngine.js';

// Stats de base des tours quiz (avant modificateurs cadence)
const QUIZ_TOWER_BASE = {
    ice:    { cooldown: 1000, damage: 25 },
    cannon: { cooldown: 3000, damage: 90 },
    fire:   { cooldown: 1200, damage: 35 },
};

// Multiplicateurs selon la cadence choisie en Q2
const CADENCE_MULTS = {
    fast:     { cd: 0.6,  dmg: 0.65 },  // tirs fréquents, légers
    balanced: { cd: 1.0,  dmg: 1.0  },  // stats de base
    slow:     { cd: 1.7,  dmg: 1.8  },  // tirs rares, dévastateurs
};

const QUIZ_DEF = [
    {
        axis: 'type',
        script: 'chapter5/quiz_q1',
        answers: ['ice', 'cannon', 'fire'],
    },
    {
        axis: 'cadence',
        script: 'chapter5/quiz_q2',
        answers: ['fast', 'balanced', 'slow'],
    },
    {
        axis: 'priority',
        script: 'chapter5/quiz_q3',
        answers: ['fast', 'tough', 'close'],
    },
];

function setup({ audio, showTitle, showDialogue, showGame, hideGame,
                        showVictoryBadgeInteractive, onChapterEnd, preloadTheme, dlg }) {

    const waveEvents = {
        1: 'chapter5/wave1_clear',
        2: 'chapter5/wave2_clear',
        4: 'chapter5/wave4_clear',
        5: { type: 'quiz', def: QUIZ_DEF },
    };

    let _preloaded = false;
    function _preload() {
        if (_preloaded) return;
        _preloaded = true;
        audio.preload('cozy_family_theme',  '/audio/cozy_family_theme.mp3');
        audio.preload('chessmatch_theme',   '/audio/chessmatch_theme.mp3');
        audio.preload('oboe_march_theme',   '/audio/oboe_march_theme.mp3');
        dlg.preload([
            'chapter5/intro', 'chapter5/wave1_clear', 'chapter5/wave2_clear',
            'chapter5/wave4_clear', 'chapter5/victory',
            'chapter5/quiz_q1', 'chapter5/quiz_q2', 'chapter5/quiz_q3',
            'chapter5/quiz_result_ice', 'chapter5/quiz_result_cannon', 'chapter5/quiz_result_fire',
        ]);
    }

    function startChapter5() {
        _preload();
        preloadTheme('Plateau de Bois');
        showTitle({
            label: 'Chapitre V',
            title: 'La Leçon ',
            sub:   'du Roi',
        }, () => {
            showDialogue('chapter5/intro', () => {
                showGame('chapter5');
            });
        });
    }

    function wireCallbacks(game) {
        const _ch5TowerOverrides = {
            archer: { vignette: '/images/td/towers/archer/tower_archer_preview_ch5.png' },
            mage:   { anchorY: 0.85, vignette: '/images/td/towers/mage/tower_mage_preview_ch5.png' },
            ice:    { anchorY: 0.85, vignette: '/images/td/towers/ice/tower_ice_preview_ch5.png' },
            fire:   { anchorY: 0.85, vignette: '/images/td/towers/fire/tower_fire_preview_ch5.png' },
            cannon: { anchorY: 0.85, vignette: '/images/td/towers/cannon/tower_cannon_preview_ch5.png' },
        };

        let _quizDone = false;

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
                // Restaurer les stats de base des tours quiz
                for (const [type, base] of Object.entries(QUIZ_TOWER_BASE)) {
                    TOWER_TYPES[type].cooldown = base.cooldown;
                    TOWER_TYPES[type].damage   = base.damage;
                    delete TOWER_TYPES[type].priority;
                }
            }
            _origResetForMode();
        };

        const _origSetChapter5Mode = game.setChapter5Mode.bind(game);
        game.setChapter5Mode = () => {
            _quizDone = false;
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
            if (!game._chapter5Mode) return;

            const event = waveEvents[waveNumber];
            if (!event) return;

            game.engine.paused = true;

            if (typeof event === 'string') {
                showDialogue(event, () => { game.engine.paused = false; });

            } else if (event.type === 'quiz' && !_quizDone) {
                _quizDone = true;
                runQuiz(showDialogue, dlg, event.def, (result) => {
                    const base  = QUIZ_TOWER_BASE[result.type];
                    const mults = CADENCE_MULTS[result.cadence] || CADENCE_MULTS.balanced;
                    TOWER_TYPES[result.type].cooldown = Math.round(base.cooldown * mults.cd);
                    TOWER_TYPES[result.type].damage   = Math.round(base.damage   * mults.dmg);
                    TOWER_TYPES[result.type].priority = result.priority;
                    TOWER_TYPES[result.type].cadence  = result.cadence;
                    showDialogue(`chapter5/quiz_result_${result.type}`, () => {
                        game._availableTowers.add(result.type);
                        const cost = TOWER_TYPES[result.type].cost;
                        if (game.engine.gold < cost) game.engine.gold = cost;
                        game.updateUI();
                        game.engine.paused = false;
                    });
                });
            } else {
                game.engine.paused = false;
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
