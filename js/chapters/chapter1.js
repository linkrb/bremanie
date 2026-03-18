// ── Chapitre I : La Fuite — Les Enfants du Roi ───────────────
// Inclut le Prologue (qui enchaîne directement sur le chapitre 1)

import { SaveManager } from '/bremanie/js/SaveManager.js';

export function setup({ audio, showTitle, showDialogue, showGame, hideGame,
                        showDefeatBadgeInteractive, showVictoryBadgeInteractive,
                        fadeToBlack, fadeFromBlack, onChapterEnd }) {

    // Preload des pistes du chapitre 1 (lancé une seule fois au démarrage du prologue)
    let _preloaded = false;
    function _preload() {
        if (_preloaded) return;
        _preloaded = true;
        audio.preload('prologue_siege', '/bremanie/audio/prologue_siege.mp3');
        audio.preload('wind',          '/bremanie/audio/wind.mp3');
        audio.preload('combat_theme',  '/bremanie/audio/combat_theme.mp3');
    }

    function startPrologue() {
        _preload();
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

    function wireCallbacks(game) {
        game.onScriptedDefeat = () => {
            audio.crossfadeTo('wind', 2000);
            showDefeatBadgeInteractive(() => {
                hideGame();
                showDialogue('chapter1/nathan_power', () => {
                    showDialogue('chapter1/towers_appear', () => {
                        showGame('tutorial');
                    });
                });
            });
        };

        game.onTutorialVictory = (next) => {
            showVictoryBadgeInteractive(next);
        };

        game.onTutorialWin = () => {
            onChapterEnd(1);
        };
    }

    return { startPrologue, startChapter1, wireCallbacks, _preload };
}
