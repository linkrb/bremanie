// DialogueEngine.js — Fire Emblem style dialogue system
// Mobile-first: tap to advance, touch-friendly sizing

const CHAR_NAMES = {
    romain: 'Romain',
    nathan: 'Nathan',
    anna:   'Anna',
};

const CHAR_COLORS = {
    romain: { bg: '#2d4f8a', border: '#7aa3d4' },
    nathan: { bg: '#6b4a12', border: '#c8952a' },
    anna:   { bg: '#7a1f1f', border: '#c85050' },
};

const CSS = `
#dlg-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
}

#dlg-scene {
    position: absolute;
    inset: 0;
}

/* ── Background ── */
.dlg-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    transition: opacity 0.6s ease;
}
.dlg-bg::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
        linear-gradient(to bottom,
            rgba(0,0,0,0.1) 0%,
            rgba(0,0,0,0.05) 40%,
            rgba(5,10,35,0.6) 65%,
            rgba(5,10,35,0.0) 100%);
}

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

/* Gauche : miroir → regarde vers la droite (vers le centre) */
.dlg-char.dlg-left  { left: -1%; }

/* Droite : miroir aussi → regarde vers la gauche (vers le centre) */
.dlg-char.dlg-right { right: -1%; }

/* ── Hidden (avant apparition) ── */
.dlg-char.hidden {
    opacity: 0;
    pointer-events: none;
}
.dlg-char.dlg-left.hidden  { transform: translateX(-50px) scaleX(-1); }
.dlg-char.dlg-right.hidden { transform: translateX(50px)  scaleX(-1); }

/* ── Active (locuteur) ── */
.dlg-char.active {
    filter: brightness(1) saturate(1);
    z-index: 2;
}
.dlg-char.dlg-left.active  { transform: scale(1.05) scaleX(-1); }
.dlg-char.dlg-right.active { transform: scale(1.05) scaleX(-1); }

/* ── Inactive (écoute) ── */
.dlg-char.inactive {
    filter: brightness(0.42) saturate(0.2);
    z-index: 1;
}
.dlg-char.dlg-left.inactive  { transform: scale(0.96) scaleX(-1); }
.dlg-char.dlg-right.inactive { transform: scale(0.96) scaleX(-1); }

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
`;

export class DialogueEngine {
    constructor(options = {}) {
        this.basePath = options.basePath || '/bremanie/images/';
        this.typeSpeed = options.typeSpeed ?? 28; // ms per char

        this.overlay  = null;
        this.els      = {};
        this.script   = [];
        this.index    = 0;
        this.typing   = false;
        this.typeTimer = null;
        this._currentText = '';
        this.onComplete = null;

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
                <div class="dlg-bg" id="dlg-bg"></div>
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
                <div class="dlg-arrow"   id="dlg-arrow">▼</div>
                <div class="dlg-tap-hint">Toucher pour continuer</div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.overlay = overlay;

        this.els = {
            bg:       overlay.querySelector('#dlg-bg'),
            left:     overlay.querySelector('#dlg-left'),
            right:    overlay.querySelector('#dlg-right'),
            imgLeft:  overlay.querySelector('#dlg-img-left'),
            imgRight: overlay.querySelector('#dlg-img-right'),
            namebox:  overlay.querySelector('#dlg-namebox'),
            text:     overlay.querySelector('#dlg-text'),
            arrow:    overlay.querySelector('#dlg-arrow'),
        };
    }

    _bindEvents() {
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

    // ── Public API ──────────────────────────────────────────

    play(script, onComplete) {
        this.script = script;
        this.index  = 0;
        this.onComplete = onComplete || null;
        this.sides = {
            left:  { char: null, emotion: null, visible: false },
            right: { char: null, emotion: null, visible: false },
        };

        this.overlay.style.display = 'block';

        // Calcule la hauteur réelle du cadre et met à jour --char-bottom
        requestAnimationFrame(() => {
            const h = this.overlay.querySelector('.dlg-box').offsetHeight;
            this.overlay.style.setProperty('--char-bottom', h + 'px');
        });

        this._showLine(script[0]);
    }

    close() { this._end(); }

    // ── Internal ─────────────────────────────────────────────

    _isOpen() {
        return this.overlay && this.overlay.style.display !== 'none';
    }

    _advance() {
        if (this.typing) {
            // Skip typewriter → show full text instantly
            clearTimeout(this.typeTimer);
            this.els.text.textContent = this._currentText;
            this.typing = false;
            this.els.arrow.classList.remove('hidden');
            return;
        }

        this.index++;
        if (this.index >= this.script.length) {
            this._end();
            return;
        }
        this._showLine(this.script[this.index]);
    }

    _showLine(line) {
        // Background
        if (line.bg) {
            this.els.bg.style.backgroundImage =
                `url('${this.basePath}${line.bg}')`;
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
        const name   = CHAR_NAMES[line.char] || line.char;
        const colors = CHAR_COLORS[line.char] || { bg: '#333', border: '#888' };
        this.els.namebox.textContent = name;
        this.els.namebox.style.background   = colors.bg;
        this.els.namebox.style.borderRight  = `2px solid ${colors.border}`;

        // Typewriter
        this.els.arrow.classList.add('hidden');
        this._typeText(line.text);
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

    _end() {
        clearTimeout(this.typeTimer);
        this.typing = false;
        this.overlay.style.display = 'none';

        // Reset portraits for next use
        this.els.left.classList.add('hidden');
        this.els.left.classList.remove('active', 'inactive');
        this.els.right.classList.add('hidden');
        this.els.right.classList.remove('active', 'inactive');

        if (this.onComplete) this.onComplete();
    }
}
