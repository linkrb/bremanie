// ── Chapitre VII : Salle du Trône ────────────────────────────────
// Personnage principal : Nathan. Il libère son père Romain, possédé par
// le Nécromancien, en épuisant l'emprise vague après vague.

import { SaveManager } from '/js/SaveManager.js';

export function setup({ audio, showTitle, showDialogue, showGame, hideGame,
                        showVictoryBadgeInteractive, onChapterEnd, preloadTheme, dlg,
                        showCombatBadge, startCombatMusic }) {

    // Dialogues joués après certaines vagues (à étoffer)
    const waveDialogues = {
        3: 'chapter7/wave3_clear',   // l'emprise vacille : dernière poussée avant la vague finale
    };

    let _preloaded = false;
    function _preload() {
        if (_preloaded) return;
        _preloaded = true;
        audio.preload('ch7_combat',   '/audio/ch7_combat.mp3');
        audio.preload('ambient_fire', '/audio/ambient_fire.mp3');
        audio.preload('claymore_1',   '/audio/claymore_1.mp3');
        audio.preload('claymore_2',   '/audio/claymore_2.mp3');
        audio.preload('claymore_3',   '/audio/claymore_3.mp3');
        audio.preload('dragon_roar',  '/audio/dragon_roar.mp3');
        audio.preload('boss_entry',   '/audio/boss_entry.mp3');
        audio.preload('ch7_dream',    '/audio/ch7_dream.mp3');
        dlg.preload([
            'chapter7/intro',
            'chapter7/arrival',
            'chapter7/wave3_clear',
            'chapter7/victory',
        ]);
    }

    function startChapter7() {
        _preload();
        preloadTheme('Salle du Trône');
        showTitle({
            label: 'Chapitre VII',
            title: 'La Salle du Trône',
            sub:   'Délivrer le Roi',
        }, () => {
            showDialogue('chapter7/intro', () => {
                showGame('chapter7');
            });
        });
    }

    function wireCallbacks(game) {
        // Impact des alliés (chute au sol / décollage) → même claquement que le jingle
        game.renderer.onAllyImpact = () => audio.playSfx('combat_sting');

        // Chaque vague : Romain invoque (geste → mains qui jaillissent au spawn)
        const _prevWaveStarted = game.onWaveStarted;
        game.onWaveStarted = (waveNumber) => {
            _prevWaveStarted?.(waveNumber);
            if (game._chapter7Mode) game.renderer.playBossSummon();
        };

        const _prevWaveCompleted = game.onWaveCompleted;
        game.onWaveCompleted = (waveNumber) => {
            _prevWaveCompleted?.(waveNumber);
            if (!game._chapter7Mode) return;

            // Le dragon entre en scène après la vague 2 (raids toutes les ~25s)
            // (intervalle départ, délai 1er raid, plancher, décroissance/raid) en secondes-jeu
            if (waveNumber === 2) game.startDragonRaids(40, 10, 25, 2);

            const script = waveDialogues[waveNumber];
            if (script) {
                game.engine.paused = true;
                showDialogue(script, () => { game.engine.paused = false; });
            }
        };

        // Nathan & David viennent d'atterrir → face-à-face avec Romain possédé
        game.onAlliesLanded = () => {
            if (!game._chapter7Mode) return;
            game.engine.paused = true;
            showDialogue('chapter7/arrival', () => {
                game.engine.paused = false;
                game.renderer.exitAlly('nathan');   // Nathan quitte le champ, David tient la position
                game.renderer.revealPossession();   // la jauge se révèle une fois la mécanique expliquée
                showCombatBadge();                  // jingle : le combat commence vraiment maintenant
                startCombatMusic();                 // la musique démarre pile avec le jingle
                // David devient héros jouable : sa jauge se charge, clic = pluie de claymores
                game.renderer.enableDavidHero();
                game.renderer.onHeroClick = () => game._triggerDavidAbility();
                // son : une claymore qui TOUCHE un squelette → un des 3 sons d'épée au hasard
                game.onClaymoreHit = () => {
                    audio.playSfx('claymore_' + (1 + Math.floor(Math.random() * 3)));
                };
                // rugissement du dragon au moment du télégraphe
                game.onDragonRoar = () => audio.playSfx('dragon_roar');
            });
        };

        // L'emprise est brisée : Romain est libéré → cinématique de fin de chapitre
        game.onPossessionBroken = () => {
            if (!game._chapter7Mode) return;
            hideGame();
            showDialogue('chapter7/victory', () => { onChapterEnd(7); });
        };

        game.onChapter7Win = () => {
            hideGame();
            showDialogue('chapter7/victory', () => {
                onChapterEnd(7);
            });
        };
    }

    return { startChapter7, wireCallbacks, _preload };
}

export default setup;
