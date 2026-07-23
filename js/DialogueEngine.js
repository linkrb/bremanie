// DialogueEngine.js — Fire Emblem style dialogue system
// Mobile-first: tap to advance, touch-friendly sizing

const CHAR_NAMES = {
    romain:       'Romain',
    romain_possede: 'Romain',
    nathan:         'Nathan',
    anna:           'Anna',
    nathan_enfant:  'Nathan',
    anna_enfant:    'Anna',
    suzanne:      'Suzanne',
    garde:        'Garde',
    david:        'David',
    adeline:      'Adeline',
    lucas:        'Lucas',
    necromancien: 'Le Nécromancien',
    seraphelle:   'Séraphelle',
    skeleton:     'Squelette',
    martin:       'Martin',
};

// Scale override par personnage (1 = taille par défaut)
const CHAR_SCALE = {
    david:      1.2,
    seraphelle: 1.25,
};

const CHAR_COLORS = {
    romain:       { bg: '#2d4f8a', border: '#7aa3d4' },
    romain_possede: { bg: '#2d4f8a', border: '#7aa3d4' },
    nathan:         { bg: '#6b4a12', border: '#c8952a' },
    anna:           { bg: '#7a1f1f', border: '#c85050' },
    nathan_enfant:  { bg: '#6b4a12', border: '#c8952a' },
    anna_enfant:    { bg: '#7a1f1f', border: '#c85050' },
    suzanne:      { bg: '#2d6e35', border: '#72b87e' },
    garde:        { bg: '#3a4455', border: '#8a9ab0' },
    david:        { bg: '#2e5a3e', border: '#6aaa7e' },
    adeline:      { bg: '#5a3060', border: '#b07ac8' },
    lucas:        { bg: '#4a5a2e', border: '#9ab07a' },
    necromancien: { bg: '#1a0a2e', border: '#6633aa' },
    seraphelle:   { bg: '#1a1a2a', border: '#4455aa' },
    skeleton:     { bg: '#1c1c1c', border: '#4ab8c8' },
    martin:       { bg: '#5a3a1a', border: '#b07840' },
};

const CSS = `
#dlg-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
}

#dlg-scene {
    position: absolute;
    inset: 0;
}

/* ── Background (double couche pour fondu) ── */
.dlg-bg-layer {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    transition: opacity 0.6s ease;
}
.dlg-bg-layer::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
        linear-gradient(to bottom,
            rgba(0,0,0,0.1) 0%,
            rgba(0,0,0,0.05) 40%,
            rgba(5,10,35,0.6) 65%,
            rgba(5,10,35,0.0) 100%);
    transition: opacity 0.5s ease;
}
.dlg-bg-layer.hidden { opacity: 0; }

/* ── Character portraits ── */
/* bottom = hauteur réelle du cadre, mise à jour par JS au pixel près */
.dlg-char {
    position: absolute;
    bottom: var(--char-bottom, 38vh);
    transition: filter 0.35s ease, transform 0.45s cubic-bezier(.22,.68,0,1.2), opacity 0.4s ease;
    transform-origin: bottom center;
}

.dlg-char img {
    display: block;
    height: clamp(240px, 58vw, 460px);
    width: auto;
    filter: drop-shadow(0 8px 24px rgba(0,0,0,0.95));
}

/* Gauche : portrait face gauche → miroir → regarde vers la droite (vers le centre) */
.dlg-char.dlg-left  { left: -1%; }

/* Droite : portrait face gauche → pas de miroir → regarde déjà vers la gauche (vers le centre) */
.dlg-char.dlg-right { right: -1%; }

/* ── Hidden (avant apparition) ── */
.dlg-char.hidden {
    opacity: 0;
    pointer-events: none;
}
.dlg-char.dlg-left.hidden  { transform: translateX(-50px) scaleX(-1); }
.dlg-char.dlg-right.hidden { transform: translateX(50px); }

/* ── Active (locuteur) ── */
.dlg-char.active {
    filter: brightness(1) saturate(1);
    z-index: 2;
}
.dlg-char.dlg-left.active  { transform: scale(1.05) scaleX(-1); }
.dlg-char.dlg-right.active { transform: scale(1.05); }

/* ── Inactive (écoute) ── */
.dlg-char.inactive {
    filter: brightness(0.42) saturate(0.2);
    z-index: 1;
}
.dlg-char.dlg-left.inactive  { transform: scale(0.96) scaleX(-1); }
.dlg-char.dlg-right.inactive { transform: scale(0.96); }

/* ── Dialogue box ── */
.dlg-box {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    height: 38vh;
    min-height: 170px;
    max-height: 250px;
    background: linear-gradient(
        to bottom,
        rgba(4,8,28,0.88) 0%,
        rgba(6,12,40,0.97) 60%,
        rgba(4,8,28,0.99) 100%
    );
    border-top: 1.5px solid rgba(160,130,60,0.5);
    box-shadow: 0 -4px 40px rgba(0,0,0,0.7);
    overflow: visible;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 18px 6% 22px;
    gap: 0;
}

/* Thin gold line */
.dlg-box::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(to right,
        transparent 0%, rgba(201,168,76,0.6) 20%,
        rgba(201,168,76,0.9) 50%,
        rgba(201,168,76,0.6) 80%, transparent 100%);
}

/* ── Name badge ── */
.dlg-namebox {
    position: absolute;
    top: -22px;
    left: 5%;
    z-index: 11;
    padding: 3px 22px 3px 14px;
    font-family: 'Cinzel', serif;
    font-size: clamp(0.72rem, 2.5vw, 0.9rem);
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0,0,0,0.7);
    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 100%, 0 100%);
    border-top: 1.5px solid rgba(255,255,255,0.25);
    border-left: 1.5px solid rgba(255,255,255,0.15);
    transition: background 0.25s ease;
}

/* ── Text ── */
.dlg-text {
    font-family: 'Cinzel', serif;
    font-size: clamp(0.82rem, 2.4vw, 1.05rem);
    color: #ede8d8;
    line-height: 1.75;
    text-shadow: 0 1px 4px rgba(0,0,0,0.95);
    min-height: 3.5em;
    padding-top: 8px;
}

/* ── Advance arrow ── */
.dlg-arrow {
    position: absolute;
    bottom: 12px;
    right: 5%;
    color: rgba(201,168,76,0.85);
    font-size: 0.75rem;
    animation: dlgArrow 0.7s ease-in-out infinite alternate;
}
.dlg-arrow.hidden { opacity: 0; }

@keyframes dlgArrow {
    from { transform: translateY(0);   opacity: 0.5; }
    to   { transform: translateY(5px); opacity: 1;   }
}

/* ── Tap hint (mobile) ── */
.dlg-tap-hint {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Cinzel', serif;
    font-size: 0.58rem;
    color: rgba(180,160,100,0.45);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    pointer-events: none;
}

/* ── Mode cinématique (@scene) ── */
/* Cache les portraits, fond plein écran sans dégradé parasite */
#dlg-overlay.cinematic .dlg-char {
    opacity: 0 !important;
    pointer-events: none;
    transition: opacity 0.5s ease;
}
#dlg-overlay.cinematic .dlg-bg-layer::after {
    opacity: 0; /* supprime le dégradé intermédiaire */
}

/* ── Scene pause : cache la boîte de dialogue ── */
.dlg-box {
    transition: opacity 0.3s ease;
}
#dlg-overlay.scene-pause .dlg-box {
    opacity: 0;
    pointer-events: none;
}

/* Indicateur "tap to continue" pendant scene-pause */
.dlg-scene-hint {
    position: absolute;
    bottom: 28px;
    left: 50%;
    font-family: 'Cinzel', serif;
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(201, 168, 76, 0.85);
    pointer-events: none;
    opacity: 0;
    white-space: nowrap;
    transition: opacity 0.4s ease;
    animation: dlgSceneHint 0.8s ease-in-out infinite alternate;
}
#dlg-overlay.scene-pause .dlg-scene-hint {
    opacity: 1;
    transition: opacity 0.5s ease 1s;
}

@keyframes dlgSceneHint {
    from { transform: translateX(-50%) translateY(0);   opacity: 1; }
    to   { transform: translateX(-50%) translateY(5px); opacity: 0.45; }
}

/* Texte de narration : centré, italique, plus grand, sans namebox */
.dlg-narration {
    font-style: italic;
    font-size: clamp(0.9rem, 2.6vw, 1.15rem);
    color: #f0e8d0;
    text-align: center;
    line-height: 1.9;
    letter-spacing: 0.04em;
}

/* ── Overlay vidéo plein écran ── */
#dlg-video-wrap {
    position: fixed;
    inset: 0;
    z-index: 9500;
    background: #000;
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

#dlg-video-wrap video {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

#dlg-video-hint {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Cinzel', serif;
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(201, 168, 76, 0.85);
    pointer-events: none;
    opacity: 0;
    white-space: nowrap;
    transition: opacity 0.5s ease 0.4s;
    animation: dlgSceneHint 0.8s ease-in-out infinite alternate;
}

#dlg-video-hint.visible { opacity: 1; }

/* ── Choix interactifs (@choice) ── */
.dlg-choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    justify-content: center;
}
.dlg-choice-btn {
    font-family: 'Cinzel', serif;
    font-size: clamp(0.7rem, 2vw, 0.88rem);
    letter-spacing: 0.06em;
    color: #ede8d8;
    background: rgba(4, 8, 28, 0.8);
    border: 1px solid rgba(201, 168, 76, 0.55);
    border-radius: 4px;
    padding: 8px 18px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    text-shadow: 0 1px 3px rgba(0,0,0,0.9);
    user-select: none;
}
.dlg-choice-btn:hover, .dlg-choice-btn:active {
    background: rgba(201, 168, 76, 0.2);
    border-color: rgba(201, 168, 76, 0.85);
    color: #fff;
}
#dlg-overlay.has-choices .dlg-box {
    max-height: none;
}

/* ── Bouton skip (hold 1s) ── */
.dlg-skip-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    padding: 6px 14px;
    font-family: 'Cinzel', serif;
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(201, 168, 76, 0.95);
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(201, 168, 76, 0.6);
    border-radius: 4px;
    cursor: pointer;
    overflow: hidden;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    z-index: 10;
    touch-action: none;
}
.dlg-skip-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(201, 168, 76, 0.2);
    transform: scaleX(0);
    transform-origin: left;
    transition: none;
}
.dlg-skip-btn.holding::after {
    transform: scaleX(1);
    transition: transform 1s linear;
}

/* ── Diaporama (@slide) : images plein écran, fondu croisé + Ken Burns, auto ── */
#dlg-overlay.slideshow .dlg-box        { opacity: 0; pointer-events: none; }
#dlg-overlay.slideshow .dlg-scene-hint { opacity: 0 !important; }

/* Photos paysage : crop centré (cover, centré, jamais de répétition) */
#dlg-overlay.slideshow .dlg-bg-layer,
#dlg-overlay.slideshow .dlg-glitch-fx {
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    background-color: #000;
}

.dlg-bg-layer.kb-in  { animation: dlgKenBurnsIn  var(--kb-duration, 4000ms) ease-out forwards; }
.dlg-bg-layer.kb-out { animation: dlgKenBurnsOut var(--kb-duration, 4000ms) ease-out forwards; }

/* ── Effet glitch (@glitch) : RGB split + slices + jitter sur l'image active ── */
.dlg-glitch-fx {
    position: absolute; inset: 0;
    background-size: cover; background-position: center;
    opacity: 0; pointer-events: none; z-index: 3;
}
.dlg-glitch-fx.active {
    animation: dlgGlitchBase var(--glitch-duration, 600ms) steps(2, end);
    box-shadow: inset 0 0 110px 25px rgba(120, 20, 190, 0.5); /* aura pourpre du Nécro */
}
.dlg-glitch-fx.active::before,
.dlg-glitch-fx.active::after {
    content: ''; position: absolute; inset: 0;
    background-image: inherit; background-size: cover; background-position: center;
    mix-blend-mode: screen;
}
/* canal magenta-violet décalé à gauche */
.dlg-glitch-fx.active::before {
    filter: sepia(1) saturate(8) hue-rotate(240deg) brightness(1.15);
    animation: dlgGlitchR var(--glitch-duration, 600ms) steps(3, end);
}
/* canal bleu-violet décalé à droite */
.dlg-glitch-fx.active::after {
    filter: sepia(1) saturate(8) hue-rotate(285deg) brightness(1.15);
    animation: dlgGlitchB var(--glitch-duration, 600ms) steps(3, end);
}
@keyframes dlgGlitchBase {
    0%, 100% { opacity: 0; }
    4%   { opacity: 1;  filter: sepia(.7) saturate(6) hue-rotate(250deg) contrast(1.5) brightness(1.1); transform: translate(3px, -2px); }
    22%  { opacity: .9; filter: sepia(.7) saturate(7) hue-rotate(230deg) contrast(1.4);                transform: translate(-4px, 1px); }
    45%  { opacity: 1;  filter: sepia(.8) saturate(8) hue-rotate(265deg) contrast(1.6);                transform: translate(2px, 2px); }
    68%  { opacity: .85; filter: sepia(.6) saturate(6) hue-rotate(245deg) contrast(1.4);               transform: translate(-2px, -1px); }
    88%  { opacity: .6; filter: sepia(.6) saturate(5) hue-rotate(250deg);                              transform: translate(1px, 0); }
}
@keyframes dlgGlitchR {
    0%   { transform: translate(-6px, 0);  clip-path: inset(8%  0 78% 0); }
    20%  { transform: translate(7px, 0);   clip-path: inset(38% 0 42% 0); }
    40%  { transform: translate(-9px, 0);  clip-path: inset(66% 0 12% 0); }
    60%  { transform: translate(5px, 0);   clip-path: inset(18% 0 62% 0); }
    80%  { transform: translate(-4px, 0);  clip-path: inset(82% 0 4%  0); }
    100% { transform: translate(0, 0);     clip-path: inset(0 0 0 0); }
}
@keyframes dlgGlitchB {
    0%   { transform: translate(6px, 0);   clip-path: inset(30% 0 55% 0); }
    20%  { transform: translate(-7px, 0);  clip-path: inset(60% 0 20% 0); }
    40%  { transform: translate(9px, 0);   clip-path: inset(5%  0 80% 0); }
    60%  { transform: translate(-5px, 0);  clip-path: inset(72% 0 8%  0); }
    80%  { transform: translate(4px, 0);   clip-path: inset(45% 0 40% 0); }
    100% { transform: translate(0, 0);     clip-path: inset(0 0 0 0); }
}

/* ── Flash d'impact (@flash) : éclat bref plein écran ── */
.dlg-flash-fx {
    position: absolute; inset: 0; z-index: 5;
    opacity: 0; pointer-events: none;
    background: var(--flash-color, rgba(170, 60, 255, 0.92));
    mix-blend-mode: screen;
}
.dlg-flash-fx.active { animation: dlgFlash var(--flash-duration, 150ms) ease-out; }
@keyframes dlgFlash {
    0%   { opacity: 0; }
    12%  { opacity: 1; }
    100% { opacity: 0; }
}

/* ── Yeux du Nécromancien (@eyes) : vignette plein écran, fond noir, sprite animée ── */
.dlg-eyes-fx {
    position: absolute; inset: 0; z-index: 4;
    background: #000; opacity: 0; pointer-events: none;
    display: flex; align-items: center; justify-content: center;
    transition: opacity 1s ease;         /* fondu à l'entrée ET à la sortie */
}
.dlg-eyes-fx.active { opacity: 1; }
.dlg-eyes-fx .eyes-sprite {
    position: relative;
    width: min(82vw, 760px);
    aspect-ratio: 256 / 120;
    overflow: hidden;                    /* ne montre qu'une frame */
}
.dlg-eyes-fx .eyes-strip {
    position: absolute; top: 0; left: 0;
    height: 100%; width: 800%;           /* bande de 8 frames */
    background-repeat: no-repeat;
    background-size: 100% 100%;          /* la spritesheet remplit la bande */
}
.dlg-eyes-fx.active .eyes-strip {
    animation: dlgEyesPlay 4s steps(8) infinite;
}
/* Maintien "yeux ouverts" (0→60%) puis clignement rapide sur les 8 frames (60→100%).
   Plus d'espace entre clignements. Augmenter la durée = clignements plus espacés. */
@keyframes dlgEyesPlay {
    0%, 60% { transform: translateX(0);     }
    100%    { transform: translateX(-100%); }
}

/* Glitch appliqué directement aux yeux (le calque yeux est au-dessus du calque glitch) */
.dlg-eyes-fx.glitching .eyes-sprite {
    animation: dlgEyesGlitch var(--glitch-duration, 600ms) steps(2, end);
}
@keyframes dlgEyesGlitch {
    0%   { transform: translateX(0);    filter: none; clip-path: inset(0 0 0 0); }
    12%  { transform: translateX(-9px); filter: contrast(1.6) brightness(1.3) drop-shadow(4px 0 rgba(200,60,255,.85)) drop-shadow(-4px 0 rgba(90,0,200,.85)); clip-path: inset(15% 0 55% 0); }
    28%  { transform: translateX(11px); filter: invert(.2) hue-rotate(270deg) drop-shadow(-6px 0 rgba(200,60,255,.85)); clip-path: inset(55% 0 15% 0); }
    45%  { transform: translateX(-6px); filter: contrast(1.8) drop-shadow(5px 0 rgba(160,40,255,.9)) drop-shadow(-5px 0 rgba(120,0,220,.9)); clip-path: inset(35% 0 30% 0); }
    62%  { transform: translateX(8px);  filter: brightness(1.4) hue-rotate(300deg); clip-path: inset(70% 0 5% 0); }
    80%  { transform: translateX(-3px); filter: contrast(1.5) drop-shadow(3px 0 rgba(200,60,255,.7)); clip-path: inset(5% 0 80% 0); }
    100% { transform: translateX(0);    filter: none; clip-path: inset(0 0 0 0); }
}

/* On ne descend jamais sous scale(1) → l'image couvre toujours, pas de bord noir */
@keyframes dlgKenBurnsIn {
    from { transform: scale(1.0)  translate(0, 0); }
    to   { transform: scale(1.14) translate(-1.5%, -1%); }
}
@keyframes dlgKenBurnsOut {
    from { transform: scale(1.14) translate(1.5%, 1%); }
    to   { transform: scale(1.0)  translate(0, 0); }
}
`;

export class DialogueEngine {
    constructor(options = {}) {
        this.basePath     = options.basePath     || '/images/';
        this.dialoguePath = options.dialoguePath || '/dialogues/';
        this.videoPath    = options.videoPath     || '/videos/';
        this.typeSpeed    = options.typeSpeed     ?? 28; // ms per char

        this.overlay  = null;
        this.els      = {};
        this.script   = [];
        this.index    = 0;
        this.typing   = false;
        this.typeTimer = null;
        this._currentText = '';
        this.onComplete = null;
        this.onMusic     = null; // callback(trackName) déclenché par @music
        this.onMusicStop = null; // callback() déclenché par @musicstop
        this.onSfx       = null; // callback(trackName) déclenché par @sfx (one-shot)
        this.onSfxLoop         = null; // callback(trackName) déclenché par @sfxloop
        this.onSfxStop         = null; // callback(trackName) déclenché par @sfxstop
        this.onSfxLoopStopAll  = null; // callback() — appelé au démarrage de chaque dialogue
        this.onChoice    = null; // callback(answerIndex) déclenché par @choice
        this._inChoice   = false;
        this.skipDisabled = false;
        this._imgCache = new Map();
        this._slideTimer = null;   // minuterie du diaporama @slide
        this._autoSlide  = false;  // true pendant qu'une slide s'affiche (avance auto, tap ignoré)
        this._fxCues   = [];       // effets programmés (@glitch/@flash…) calés sur départ musique/diaporama
        this._fxTimers = [];       // setTimeout des cues armées
        this._fxArmed  = false;
        this._glitchHideTimer = null;
        this._flashHideTimer  = null;

        // Track what's displayed on each side
        this.sides = {
            left:  { char: null, emotion: null, visible: false },
            right: { char: null, emotion: null, visible: false },
        };

        this._injectCSS();
        this._buildDOM();
        this._bindEvents();
    }

    _injectCSS() {
        if (document.getElementById('dlg-css')) return;
        const style = document.createElement('style');
        style.id = 'dlg-css';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    _buildDOM() {
        const overlay = document.createElement('div');
        overlay.id = 'dlg-overlay';
        overlay.style.display = 'none';
        overlay.innerHTML = `
            <div id="dlg-scene">
                <div class="dlg-bg-layer" id="dlg-bg-a"></div>
                <div class="dlg-bg-layer hidden" id="dlg-bg-b"></div>
                <div class="dlg-glitch-fx" id="dlg-glitch"></div>
                <div class="dlg-flash-fx" id="dlg-flash"></div>
                <div class="dlg-eyes-fx" id="dlg-eyes"><div class="eyes-sprite"><div class="eyes-strip"></div></div></div>
                <div class="dlg-char dlg-left hidden" id="dlg-left">
                    <img id="dlg-img-left" src="" alt="">
                </div>
                <div class="dlg-char dlg-right hidden" id="dlg-right">
                    <img id="dlg-img-right" src="" alt="">
                </div>
            </div>
            <div class="dlg-box">
                <div class="dlg-namebox" id="dlg-namebox"></div>
                <div class="dlg-text"    id="dlg-text"></div>
                <div class="dlg-choices" id="dlg-choices" style="display:none"></div>
                <div class="dlg-arrow"   id="dlg-arrow">▼</div>
                <div class="dlg-tap-hint">Toucher pour continuer</div>
            </div>
            <div class="dlg-scene-hint">▼ Toucher pour continuer</div>
            <button class="dlg-skip-btn">Passer</button>
        `;
        document.body.appendChild(overlay);
        this.overlay = overlay;

        // Overlay vidéo (au-dessus du dialogue)
        const videoWrap = document.createElement('div');
        videoWrap.id = 'dlg-video-wrap';
        videoWrap.innerHTML = `
            <video id="dlg-video" playsinline></video>
            <div id="dlg-video-hint">▼ Toucher pour continuer</div>
        `;
        document.body.appendChild(videoWrap);
        this._videoWrap = videoWrap;
        this._videoEl   = videoWrap.querySelector('#dlg-video');
        this._videoHint = videoWrap.querySelector('#dlg-video-hint');

        this._bgActive = 'a'; // 'a' ou 'b'
        this._scriptCache = new Map();
        this.els = {
            bgA:      overlay.querySelector('#dlg-bg-a'),
            bgB:      overlay.querySelector('#dlg-bg-b'),
            glitch:     overlay.querySelector('#dlg-glitch'),
            flash:      overlay.querySelector('#dlg-flash'),
            eyes:       overlay.querySelector('#dlg-eyes'),
            eyesSprite: overlay.querySelector('#dlg-eyes .eyes-strip'),
            left:     overlay.querySelector('#dlg-left'),
            right:    overlay.querySelector('#dlg-right'),
            imgLeft:  overlay.querySelector('#dlg-img-left'),
            imgRight: overlay.querySelector('#dlg-img-right'),
            namebox:  overlay.querySelector('#dlg-namebox'),
            text:     overlay.querySelector('#dlg-text'),
            choices:  overlay.querySelector('#dlg-choices'),
            arrow:    overlay.querySelector('#dlg-arrow'),
        };
    }

    _bindEvents() {
        // Skip button (hold 1s)
        const skipBtn = this.overlay.querySelector('.dlg-skip-btn');
        let skipTimer = null;
        const cancelSkip = (e) => {
            e.stopPropagation();
            clearTimeout(skipTimer);
            skipTimer = null;
            skipBtn.classList.remove('holding');
        };
        skipBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            if (this._inChoice || this.skipDisabled) return;
            skipBtn.classList.add('holding');
            skipTimer = setTimeout(() => { this._end(); }, 1000);
        });
        skipBtn.addEventListener('pointerup',     cancelSkip);
        skipBtn.addEventListener('pointercancel', cancelSkip);
        skipBtn.addEventListener('pointerleave',  cancelSkip);

        // Touch / click
        this.overlay.addEventListener('pointerup', (e) => {
            e.preventDefault();
            this._advance();
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (!this._isOpen()) return;
            if (['Space', 'Enter', 'ArrowRight', 'KeyZ'].includes(e.code)) {
                e.preventDefault();
                this._advance();
            }
        });
    }

    // ── Background crossfade ──────────────────────────────────
    _setBg(url, position, size) {
        const next = this._bgActive === 'a' ? 'b' : 'a';
        const elNext = next === 'a' ? this.els.bgA : this.els.bgB;
        const elCurr = next === 'a' ? this.els.bgB : this.els.bgA;

        elNext.style.backgroundImage    = (url && url !== 'black') ? `url('${url}')` : '';
        elNext.style.backgroundColor   = url === 'black' ? '#000' : '';
        elNext.style.backgroundPosition = position || 'center';
        elNext.style.backgroundSize     = size || '';
        elNext.classList.remove('hidden', 'kb-in', 'kb-out');  // fade in next, coupe tout Ken Burns résiduel
        elCurr.classList.add('hidden');     // fade out current
        this._bgActive = next;
    }

    // ── Diaporama : fondu croisé + Ken Burns (zoom/pan lent) ──
    _setBgKenBurns(url, duration, alt) {
        const next  = this._bgActive === 'a' ? 'b' : 'a';
        const elNext = next === 'a' ? this.els.bgA : this.els.bgB;
        const elCurr = next === 'a' ? this.els.bgB : this.els.bgA;

        elNext.style.backgroundImage    = `url('${url}')`;
        elNext.style.backgroundColor    = '';
        elNext.style.backgroundPosition = 'center';
        elNext.style.backgroundSize     = '';  // → cover (CSS de base)
        elNext.style.setProperty('--kb-duration', duration + 'ms');

        // Redémarre l'animation : retire la classe, force un reflow, puis la remet.
        // Alterne zoom-in / zoom-out d'une slide à l'autre pour varier.
        elNext.classList.remove('kb-in', 'kb-out');
        void elNext.offsetWidth;
        elNext.classList.add(alt ? 'kb-out' : 'kb-in');

        elNext.classList.remove('hidden');
        elCurr.classList.add('hidden');
        this._bgActive = next;
    }

    _clearSlideTimer() {
        if (this._slideTimer) { clearTimeout(this._slideTimer); this._slideTimer = null; }
        this._autoSlide = false;
    }

    // Choisit la variante mobile d'une slide si dispo et écran étroit, sinon la desktop
    _slideScene(line) {
        if (line.sceneMobile && window.matchMedia?.('(max-width: 768px)').matches) {
            return line.sceneMobile;
        }
        return line.scene;
    }

    // ── Effets d'impact (@glitch/@flash…) : programmés une fois, calés sur le départ musique/diaporama ──
    _armFxCues() {
        if (this._fxArmed || !this._fxCues.length) return;
        this._fxArmed = true;
        for (const cue of this._fxCues) {
            const id = setTimeout(() => this._triggerFx(cue), cue.at);
            this._fxTimers.push(id);
        }
    }

    _triggerFx(cue) {
        if (cue.type === 'flash') this._triggerFlash(cue);
        else                      this._triggerGlitch(cue.dur);
    }

    _triggerGlitch(dur = 600) {
        // Pendant la vignette des yeux, on glitche directement ce calque (il est au-dessus)
        if (this.els.eyes?.classList.contains('active')) {
            const eye = this.els.eyes;
            eye.style.setProperty('--glitch-duration', dur + 'ms');
            eye.classList.remove('glitching');
            void eye.offsetWidth; // reflow → redémarre l'animation
            eye.classList.add('glitching');
            clearTimeout(this._glitchHideTimer);
            this._glitchHideTimer = setTimeout(() => eye.classList.remove('glitching'), dur);
            return;
        }
        const el = this.els.glitch;
        if (!el) return;
        const activeBg = this._bgActive === 'a' ? this.els.bgA : this.els.bgB;
        el.style.backgroundImage = activeBg.style.backgroundImage;
        el.style.setProperty('--glitch-duration', dur + 'ms');
        el.classList.remove('active');
        void el.offsetWidth; // reflow → redémarre l'animation
        el.classList.add('active');
        clearTimeout(this._glitchHideTimer);
        this._glitchHideTimer = setTimeout(() => el.classList.remove('active'), dur);
    }

    _triggerFlash(cue) {
        const el = this.els.flash;
        if (!el) return;
        const dur = cue.dur || 150;
        const colors = {
            violet: 'rgba(170, 60, 255, 0.92)',
            blanc:  'rgba(255, 255, 255, 0.95)',
            noir:   'rgba(0, 0, 0, 0.95)',
        };
        el.style.setProperty('--flash-color', colors[cue.color] || colors.violet);
        // le noir doit couvrir (normal), les couleurs claires éclatent (screen)
        el.style.mixBlendMode = cue.color === 'noir' ? 'normal' : 'screen';
        el.style.setProperty('--flash-duration', dur + 'ms');
        el.classList.remove('active');
        void el.offsetWidth; // reflow → redémarre l'animation
        el.classList.add('active');
        clearTimeout(this._flashHideTimer);
        this._flashHideTimer = setTimeout(() => el.classList.remove('active'), dur);
    }

    _clearFx() {
        this._fxTimers.forEach(clearTimeout);
        this._fxTimers = [];
        clearTimeout(this._glitchHideTimer);
        clearTimeout(this._flashHideTimer);
        this._glitchHideTimer = null;
        this._flashHideTimer  = null;
        this._fxArmed = false;
        if (this.els.glitch) this.els.glitch.classList.remove('active');
        if (this.els.flash)  this.els.flash.classList.remove('active');
        if (this.els.eyes)   this.els.eyes.classList.remove('glitching');
    }

    // ── Public API ──────────────────────────────────────────

    play(script, onComplete) {
        this.script = script;
        this.index  = 0;
        this.onComplete = onComplete || null;
        this.sides = {
            left:  { char: null, emotion: null, visible: false },
            right: { char: null, emotion: null, visible: false },
        };

        // Couper tous les sfxloop actifs au démarrage d'un nouveau dialogue
        this.onSfxLoopStopAll?.();

        // Réinitialiser l'état diaporama + glitch
        this._clearSlideTimer();
        this._clearFx();
        this._fxCues = script._fxCues || [];

        // Réinitialiser le fond — chaque dialogue commence sans bg hérité du précédent
        this.els.bgA.style.backgroundImage = '';
        this.els.bgA.style.backgroundColor = '';
        this.els.bgA.classList.add('hidden');
        this.els.bgA.classList.remove('kb-in', 'kb-out');
        this.els.bgB.style.backgroundImage = '';
        this.els.bgB.style.backgroundColor = '';
        this.els.bgB.classList.add('hidden');
        this.els.bgB.classList.remove('kb-in', 'kb-out');
        this.overlay.classList.remove('slideshow');
        this.els.eyes?.classList.remove('active');
        this._bgActive = 'a';

        // Réinitialiser les choix (onChoice est réinitialisé dans _end(), pas ici)
        this._inChoice = false;
        this.els.choices.style.display = 'none';
        this.els.choices.innerHTML = '';
        this.overlay.classList.remove('has-choices');

        this.overlay.style.display = 'block';

        // Calcule la hauteur réelle du cadre et met à jour --char-bottom
        requestAnimationFrame(() => {
            const h = this.overlay.querySelector('.dlg-box').offsetHeight;
            this.overlay.style.setProperty('--char-bottom', h + 'px');
        });

        this._showLine(script[0]);
    }

    close() { this._end(); }

    // ── Script loader ────────────────────────────────────────
    // Charge un fichier .txt depuis dialoguePath et joue la scène
    // Usage : await engine.load('prologue/intro', () => startGame())
    async load(scriptName, onComplete) {
        try {
            const script = await this._fetchScript(scriptName);
            if (script.length === 0) { onComplete?.(); return; }
            this.play(script, onComplete);
        } catch (e) {
            console.warn('[DialogueEngine] load() failed:', e.message);
            onComplete?.();
        }
    }

    async preload(scriptNames) {
        const scripts = await Promise.all(scriptNames.map(n => this._fetchScript(n).catch(() => [])));
        const urls = new Set();
        for (const script of scripts) {
            for (const line of script) {
                if (line.char && line.emotion) {
                    urls.add(`${this.basePath}${line.char}/${line.emotion}.png`);
                }
                // Spritesheet des yeux du Nécro (@eyes)
                if (line.type === 'eyes') { urls.add(`${this.basePath}effects/ch7_necro_eyes_sheet.png`); }
                // Images de fond plein écran (@slide / @scene) — préchargées pour un fondu net
                const sceneImg = line.type === 'slide' ? this._slideScene(line) : (line.scene || line.bg);
                if (sceneImg && sceneImg !== 'black') {
                    urls.add(`${this.basePath}${sceneImg}`);
                }
            }
        }
        await Promise.all([...urls].map(url => this._preloadImage(url)));
    }

    _preloadImage(url) {
        if (this._imgCache.has(url)) return this._imgCache.get(url);
        const p = new Promise(resolve => {
            const img = new Image();
            img.onload = img.onerror = resolve;
            img.src = url;
        });
        this._imgCache.set(url, p);
        return p;
    }

    async _fetchScript(scriptName) {
        if (this._scriptCache.has(scriptName)) return this._scriptCache.get(scriptName);
        const url = `${this.dialoguePath}${scriptName}.txt`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Script introuvable : ${url}`);
        const script = DialogueEngine.parse(await resp.text());
        this._scriptCache.set(scriptName, script);
        return script;
    }

    // ── Parser de script texte ───────────────────────────────
    // Format :
    //   # Commentaire
    //   @bg scenes/anna_bow.png    ← change le fond (une seule fois)
    //   romain(left):worried Texte...
    //   anna:laughing Texte...
    static parse(rawText) {
        const lines  = rawText.split('\n');
        const script = [];
        const fxCues = []; // effets @glitch/@flash… { type, at:ms, dur:ms, … } calés sur le départ musique
        let pendingBg    = null;
        let pendingBgPos = null;
        let pendingBgSize = null;
        let pendingMusic = null;
        let pendingMusicNoLoop = false;
        let pendingMusicStop = false;
        let pendingSfx     = null;
        let pendingSfxLoop = null;
        let pendingSfxStop = null;

        for (const raw of lines) {
            const line = raw.trim();

            // Commentaires et lignes vides
            if (!line || line.startsWith('#')) continue;

            // ── Directives ──────────────────────────────────────
            if (line.startsWith('@')) {
                const [cmd, ...args] = line.slice(1).split(/\s+/);
                const val = args.join(' ');
                if (cmd === 'choice') {
                    const options = val.split('|').map(s => s.trim()).filter(Boolean);
                    script.push({ type: 'choice', options });
                    continue;
                }
                if (cmd === 'bg')    { pendingBg    = val; continue; }
                if (cmd === 'bgpos') {
                    const last = script[script.length - 1];
                    if (last?.type === 'scene_pause') last.bgPos = val;
                    else pendingBgPos = val;
                    continue;
                }
                if (cmd === 'bgsize') {
                    const last = script[script.length - 1];
                    if (last?.type === 'scene_pause') last.bgSize = val;
                    else pendingBgSize = val;
                    continue;
                }
                if (cmd === 'scene') {
                    // @scene crée une pause autonome : image plein écran, tap pour continuer
                    script.push({ type: 'scene_pause', scene: val, bgPos: pendingBgPos || 'center', bgSize: pendingBgSize || null });
                    pendingBgPos = null;
                    pendingBgSize = null;
                    continue;
                }
                if (cmd === 'slide') {
                    // @slide desktop.jpg [mobile.jpg] [duréeMs]  → diaporama auto en fondu croisé
                    // La 2e image (optionnelle) sert de variante mobile (écran étroit).
                    const parts = val.split(/\s+/);
                    let duration = 3500, imgs = parts;
                    const maybeDur = parts[parts.length - 1];
                    if (/^\d+$/.test(maybeDur) && parts.length > 1) {
                        duration = parseInt(maybeDur, 10);
                        imgs = parts.slice(0, -1);
                    }
                    const slideEntry = { type: 'slide', scene: imgs[0], sceneMobile: imgs[1] || null, duration };
                    // La musique / les sons en attente démarrent sur la 1re slide (départ diaporama)
                    if (pendingMusic)     { slideEntry.music     = pendingMusic;     slideEntry.musicNoLoop = pendingMusicNoLoop; pendingMusic = null; pendingMusicNoLoop = false; }
                    if (pendingMusicStop) { slideEntry.musicStop = true;             pendingMusicStop = false; }
                    if (pendingSfx)       { slideEntry.sfx       = pendingSfx;       pendingSfx       = null; }
                    if (pendingSfxLoop)   { slideEntry.sfxloop   = pendingSfxLoop;   pendingSfxLoop   = null; }
                    if (pendingSfxStop)   { slideEntry.sfxstop   = pendingSfxStop;   pendingSfxStop   = null; }
                    script.push(slideEntry);
                    continue;
                }
                if (cmd === 'pause') {
                    // @pause <ms>  → attente auto (écran noir), la musique en attente démarre ici
                    const pauseEntry = { type: 'pause', duration: parseInt(val, 10) || 0 };
                    if (pendingMusic)     { pauseEntry.music     = pendingMusic;     pauseEntry.musicNoLoop = pendingMusicNoLoop; pendingMusic = null; pendingMusicNoLoop = false; }
                    if (pendingMusicStop) { pauseEntry.musicStop = true;             pendingMusicStop = false; }
                    if (pendingSfx)       { pauseEntry.sfx       = pendingSfx;       pendingSfx       = null; }
                    if (pendingSfxLoop)   { pauseEntry.sfxloop   = pendingSfxLoop;   pendingSfxLoop   = null; }
                    if (pendingSfxStop)   { pauseEntry.sfxstop   = pendingSfxStop;   pendingSfxStop   = null; }
                    script.push(pauseEntry);
                    continue;
                }
                if (cmd === 'glitch') {
                    // @glitch <sec> [duréeSec]  → effet glitch calé sur le départ musique/diaporama
                    const parts = val.split(/\s+/);
                    const at  = parseFloat(parts[0]);
                    const dur = parts.length > 1 ? parseFloat(parts[1]) : 0.6;
                    if (!isNaN(at)) fxCues.push({ type: 'glitch', at: Math.round(at * 1000), dur: Math.round(dur * 1000) });
                    continue;
                }
                if (cmd === 'flash') {
                    // @flash <sec> [duréeSec] [couleur: violet|blanc|noir]  → flash d'impact
                    const parts = val.split(/\s+/);
                    const at  = parseFloat(parts[0]);
                    const dur = (parts[1] && /^[\d.]+$/.test(parts[1])) ? parseFloat(parts[1]) : 0.15;
                    const color = parts.find(p => /^(violet|blanc|noir)$/.test(p)) || 'violet';
                    if (!isNaN(at)) fxCues.push({ type: 'flash', at: Math.round(at * 1000), dur: Math.round(dur * 1000), color });
                    continue;
                }
                if (cmd === 'eyes') {
                    // @eyes [duréeMs]  → vignette yeux du Nécro animés, plein écran fond noir
                    const ms = parseInt(val, 10);
                    script.push({ type: 'eyes', duration: isNaN(ms) ? 4000 : ms });
                    continue;
                }
                if (cmd === 'hide')  { script.push({ type: 'hide', side: val }); continue; }
                if (cmd === 'video') { script.push({ type: 'video', src: val }); continue; }

                // Directives audio : si la dernière entrée est une scene_pause, on lui attache
                // (ex. @scene X\n@music Y → la musique démarre quand la scène apparaît)
                const last = script[script.length - 1];
                const attachToScene = last?.type === 'scene_pause';
                if (cmd === 'music')     {
                    // @music <track> [once]  → "once" = joue une seule fois (pas de boucle)
                    const mp = val.split(/\s+/);
                    const mtrack = mp[0];
                    const mNoLoop = mp.slice(1).includes('once');
                    if (attachToScene) { last.music = mtrack; last.musicNoLoop = mNoLoop; }
                    else { pendingMusic = mtrack; pendingMusicNoLoop = mNoLoop; }
                    continue;
                }
                if (cmd === 'musicstop') { if (attachToScene) last.musicStop = true; else pendingMusicStop = true; continue; }
                if (cmd === 'sfx')       { if (attachToScene) last.sfx       = val;  else pendingSfx       = val;  continue; }
                if (cmd === 'sfxloop')   { if (attachToScene) last.sfxloop   = val;  else pendingSfxLoop   = val;  continue; }
                if (cmd === 'sfxstop')   { if (attachToScene) last.sfxstop   = val;  else pendingSfxStop   = val;  continue; }
                continue;
            }

            // ── Narration : > Texte de narration ────────────────
            if (line.startsWith('>')) {
                const narText = line.slice(1).trim();
                const entry = { type: 'narration', text: narText };
                if (pendingBg) { entry.bg = pendingBg; entry.bgPos = pendingBgPos; pendingBg = null; pendingBgPos = null; }
                if (pendingMusic)     { entry.music     = pendingMusic;     entry.musicNoLoop = pendingMusicNoLoop; pendingMusic = null; pendingMusicNoLoop = false; }
                if (pendingMusicStop) { entry.musicStop = true;             pendingMusicStop = false; }
                if (pendingSfx)       { entry.sfx       = pendingSfx;       pendingSfx       = null; }
                if (pendingSfxLoop)   { entry.sfxloop   = pendingSfxLoop;   pendingSfxLoop   = null; }
                if (pendingSfxStop)   { entry.sfxstop   = pendingSfxStop;   pendingSfxStop   = null; }
                script.push(entry);
                continue;
            }

            // ── Dialogue : char(side)?(anonymous)?:emotion texte ─
            const match = line.match(/^(\w+)(?:\((\w+)\))?(?:\((\w+)\))?:(\w+)\s+(.+)$/);
            if (!match) continue;

            const [, char, mod1, mod2, emotion, dlgText] = match;
            const mods = [mod1, mod2].filter(Boolean);
            const side      = mods.find(m => m === 'left' || m === 'right');
            const anonymous = mods.includes('anonymous');
            const entry = { char, emotion, text: dlgText };
            if (side)      entry.side      = side;
            if (anonymous) entry.anonymous = true;
            if (pendingBg) { entry.bg = pendingBg; entry.bgPos = pendingBgPos; pendingBg = null; pendingBgPos = null; }
            if (pendingMusic)     { entry.music     = pendingMusic;     pendingMusic     = null; }
            if (pendingMusicStop) { entry.musicStop = true;             pendingMusicStop = false; }
            if (pendingSfx)       { entry.sfx       = pendingSfx;       pendingSfx       = null; }
            if (pendingSfxLoop)   { entry.sfxloop   = pendingSfxLoop;   pendingSfxLoop   = null; }
            if (pendingSfxStop)   { entry.sfxstop   = pendingSfxStop;   pendingSfxStop   = null; }
            script.push(entry);
        }

        script._fxCues = fxCues;
        return script;
    }

    // ── Internal ─────────────────────────────────────────────

    _isOpen() {
        return this.overlay && this.overlay.style.display !== 'none';
    }

    _advance() {
        if (this._inChoice) return;
        if (this._autoSlide) return; // le diaporama avance tout seul, le tap est ignoré
        if (this.typing) {
            // Skip typewriter → show full text instantly
            clearTimeout(this.typeTimer);
            this.els.text.textContent = this._currentText;
            this.typing = false;
            this.els.arrow.classList.remove('hidden');
            return;
        }
        this._next();
    }

    _next() {
        this.index++;
        if (this.index >= this.script.length) {
            this._end();
            return;
        }
        this._showLine(this.script[this.index]);
    }

    _showLine(line) {
        // ── Musique (@music / @musicstop) ────────────────────
        if (line.music)     this.onMusic?.(line.music, { loop: !line.musicNoLoop });
        if (line.musicStop) this.onMusicStop?.();

        // Les glitchs sont calés sur le départ musique (ou, à défaut, la 1re slide)
        if (line.music || line.type === 'slide') this._armFxCues();

        // ── Sons (@sfx / @sfxloop / @sfxstop) ───────────────
        if (line.sfx)     this.onSfx?.(line.sfx);
        if (line.sfxloop) {
            // @sfxloop <nom> [volume 0-1]
            const [lname, lvol] = String(line.sfxloop).split(/\s+/);
            this.onSfxLoop?.(lname, lvol !== undefined ? parseFloat(lvol) : undefined);
        }
        if (line.sfxstop) this.onSfxStop?.(line.sfxstop);

        // ── Choix interactifs (@choice) ──────────────────────────
        if (line.type === 'choice') {
            this._showChoices(line.options);
            return;
        }

        // ── @hide left/right ─────────────────────────────────
        if (line.type === 'hide') {
            const el = this.els[line.side];
            el.classList.add('hidden');
            el.classList.remove('active', 'inactive');
            this.sides[line.side].visible = false;
            this.sides[line.side].char    = null;
            this._advance(); // pas de tap requis
            return;
        }

        // ── Vidéo plein écran (@video) ───────────────────────
        if (line.type === 'video') {
            this._playVideo(this.videoPath + line.src, () => this._advance());
            return;
        }

        // ── Pré-roll (@pause) : écran noir + musique, avance auto après <ms> ──
        if (line.type === 'pause') {
            this._clearSlideTimer();
            this.overlay.classList.add('cinematic', 'slideshow');
            this.overlay.classList.remove('scene-pause');
            this.typing = false;
            this._autoSlide = true;
            this._slideTimer = setTimeout(() => {
                this._autoSlide  = false;
                this._slideTimer = null;
                this._next();
            }, line.duration);
            return;
        }

        // ── Vignette yeux du Nécro (@eyes) : sprite animée plein écran sur noir ──
        if (line.type === 'eyes') {
            this._clearSlideTimer();
            this.overlay.classList.add('cinematic', 'slideshow');
            this.overlay.classList.remove('scene-pause');
            if (this.els.eyesSprite) {
                this.els.eyesSprite.style.backgroundImage = `url('${this.basePath}effects/ch7_necro_eyes_sheet.png')`;
            }
            this.els.eyes?.classList.add('active');
            this.typing = false;
            this._autoSlide = true;
            this._slideTimer = setTimeout(() => {
                this._autoSlide  = false;
                this._slideTimer = null;
                this._next();
            }, line.duration);
            return;
        }

        // ── Diaporama (@slide) ───────────────────────────────
        // Image plein écran, fondu croisé + Ken Burns, avance automatiquement
        if (line.type === 'slide') {
            this._clearSlideTimer();
            this.overlay.classList.add('cinematic', 'slideshow');
            this.overlay.classList.remove('scene-pause');
            this._setBgKenBurns(`${this.basePath}${this._slideScene(line)}`, line.duration, this.index % 2 === 1);
            this.typing = false;
            this._autoSlide = true;
            this._slideTimer = setTimeout(() => {
                this._autoSlide  = false;
                this._slideTimer = null;
                this._next();
            }, line.duration);
            return;
        }

        // ── Scene pause (@scene) ─────────────────────────────
        // Image plein écran sans boîte de dialogue — tap pour continuer
        if (line.type === 'scene_pause') {
            this._setBg(line.scene === 'black' ? 'black' : `${this.basePath}${line.scene}`, line.bgPos || 'center', line.bgSize);
            this.overlay.classList.add('cinematic', 'scene-pause');
            this.typing = false;
            return;
        }

        // Pour tout autre type : sortir des modes scene-pause / cinématique / diaporama
        this._clearSlideTimer();
        this.overlay.classList.remove('scene-pause', 'cinematic', 'slideshow');
        this.els.eyes?.classList.remove('active');

        // ── Narration (>) ────────────────────────────────────
        if (line.type === 'narration') {
            if (line.bg) this._setBg(line.bg === 'black' ? 'black' : `${this.basePath}${line.bg}`, line.bgPos || 'center');
            this.els.namebox.style.display = 'none';
            this.els.text.className = 'dlg-text dlg-narration';
            this.els.arrow.classList.add('hidden');
            this._typeText(line.text);
            return;
        }

        // Reprise du mode normal (namebox visible)
        this.els.namebox.style.display = '';
        this.els.text.className = 'dlg-text';

        // Background classique
        if (line.bg) {
            this._setBg(line.bg === 'black' ? 'black' : `${this.basePath}${line.bg}`, line.bgPos || 'center');
        }

        // Determine side
        let side = line.side || this._findExistingSide(line.char);
        if (!side) side = this._pickFreeSide();

        const other = side === 'left' ? 'right' : 'left';
        const emotion = line.emotion || 'neutral';

        // Update state
        this.sides[side].char    = line.char;
        this.sides[side].emotion = emotion;
        this.sides[side].visible = true;

        // Swap portrait image
        const imgEl = side === 'left' ? this.els.imgLeft : this.els.imgRight;
        imgEl.src = `${this.basePath}${line.char}/${emotion}.png`;
        imgEl.style.transform = CHAR_SCALE[line.char] ? `scale(${CHAR_SCALE[line.char]})` : '';

        // Active / inactive classes
        const elActive = this.els[side];
        const elOther  = this.els[other];

        elActive.classList.remove('hidden', 'inactive');
        elActive.classList.add('active');

        if (this.sides[other].visible) {
            elOther.classList.remove('hidden', 'active');
            elOther.classList.add('inactive');
        }

        // Name box
        const name   = line.anonymous ? '???' : (CHAR_NAMES[line.char] || line.char);
        const colors = CHAR_COLORS[line.char] || { bg: '#333', border: '#888' };
        this.els.namebox.textContent = name;
        this.els.namebox.style.background   = colors.bg;
        this.els.namebox.style.borderRight  = `2px solid ${colors.border}`;

        // Typewriter
        this.els.arrow.classList.add('hidden');
        this._typeText(line.text);
    }

    _showChoices(options) {
        this._inChoice = true;
        this.overlay.classList.add('has-choices');
        this.els.arrow.classList.add('hidden');
        const container = this.els.choices;
        container.innerHTML = '';
        container.style.display = '';
        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'dlg-choice-btn';
            btn.textContent = opt;
            btn.addEventListener('pointerup', (e) => {
                e.stopPropagation();
                container.style.display = 'none';
                container.innerHTML = '';
                this.overlay.classList.remove('has-choices');
                this._inChoice = false;
                this.onChoice?.(i);
                this._advance();
            });
            container.appendChild(btn);
        });
    }

    _findExistingSide(char) {
        if (this.sides.left.char  === char) return 'left';
        if (this.sides.right.char === char) return 'right';
        return null;
    }

    _pickFreeSide() {
        if (!this.sides.left.visible)  return 'left';
        if (!this.sides.right.visible) return 'right';
        return 'left'; // fallback: replace left
    }

    _typeText(text) {
        this._currentText = text;
        this.els.text.textContent = '';
        this.typing = true;
        let i = 0;

        const tick = () => {
            if (i <= text.length) {
                this.els.text.textContent = text.slice(0, i);
                i++;
                this.typeTimer = setTimeout(tick, this.typeSpeed);
            } else {
                this.typing = false;
                this.els.arrow.classList.remove('hidden');
            }
        };
        tick();
    }

    _playVideo(src, onDone) {
        this._videoEl.src = src;
        this._videoHint.classList.remove('visible');
        this._videoWrap.style.display = 'flex';
        this._videoEl.play().catch(() => {});

        let ended = false;

        const onEnded = () => {
            ended = true;
            this._videoHint.classList.add('visible');
        };

        const onTap = (e) => {
            if (!ended) return;
            e.stopPropagation();
            this._videoWrap.removeEventListener('pointerup', onTap);
            this._videoEl.removeEventListener('ended', onEnded);
            this._videoWrap.style.display = 'none';
            this._videoHint.classList.remove('visible');
            this._videoEl.src = '';
            onDone();
        };

        const onKey = (e) => {
            if (!ended) return;
            if (!['Space', 'Enter', 'ArrowRight'].includes(e.code)) return;
            e.preventDefault();
            document.removeEventListener('keydown', onKey);
            this._videoWrap.removeEventListener('pointerup', onTap);
            this._videoEl.removeEventListener('ended', onEnded);
            this._videoWrap.style.display = 'none';
            this._videoHint.classList.remove('visible');
            this._videoEl.src = '';
            onDone();
        };

        this._videoEl.addEventListener('ended', onEnded, { once: true });
        this._videoWrap.addEventListener('pointerup', onTap);
        document.addEventListener('keydown', onKey);
    }

    _end() {
        clearTimeout(this.typeTimer);
        this._clearSlideTimer();
        this._clearFx();
        this.overlay.classList.remove('slideshow');
        this.els.eyes?.classList.remove('active');
        this.typing = false;
        // Fermer la vidéo si elle tourne encore (ex: skip pendant une vidéo)
        if (this._videoWrap.style.display !== 'none') {
            this._videoEl.pause();
            this._videoEl.src = '';
            this._videoWrap.style.display = 'none';
            this._videoHint.classList.remove('visible');
        }
        this.overlay.classList.remove('cinematic', 'has-choices');
        this._inChoice = false;
        this.onChoice  = null;
        this.els.choices.style.display = 'none';
        this.els.choices.innerHTML = '';
        this.overlay.style.display = 'none';

        // Reset portraits for next use
        this.els.left.classList.add('hidden');
        this.els.left.classList.remove('active', 'inactive');
        this.els.right.classList.add('hidden');
        this.els.right.classList.remove('active', 'inactive');

        if (this.onComplete) this.onComplete();
    }
}
