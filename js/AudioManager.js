export class AudioManager {
    constructor({ targetVolume = 0.7, fadeInMs = 3000, fadeOutSec = 6 } = {}) {
        this._tracks     = {};
        this._current    = null; // nom de la piste active (ou en train de démarrer)
        this._target     = targetVolume;
        this._fadeInMs   = fadeInMs;
        this._fadeOutSec = fadeOutSec;
        this._loopTimers = new Map(); // name → { watchId, onEnded, track }
        this._fadeTimers = new Map(); // name → intervalId  (un seul fade actif par piste)
        this._startTimer = null;      // setTimeout du prochain fade-in (crossfade en attente)
        this._sfxLoops   = {};
    }

    preload(name, src) {
        if (this._tracks[name]) return;
        const audio = new Audio(src);
        audio.preload = 'auto';
        this._tracks[name] = audio;
    }

    play(name) {
        const track = this._tracks[name];
        if (!track || this._current === name) return;
        this._stopCurrent(500);
        this._current = name;
        track.volume = 0;
        track.currentTime = 0;
        track.play().catch(() => {});
        this._fadeIn(track, name, this._fadeInMs);
        this._setupLoop(track, name);
    }

    crossfadeTo(name, ms = 2000) {
        const newTrack = this._tracks[name];
        if (!newTrack || name === this._current) return;

        // Annuler tout démarrage en attente
        if (this._startTimer) { clearTimeout(this._startTimer); this._startTimer = null; }

        // Fade-out de la piste active
        this._stopCurrent(ms);
        this._current = name;

        // Démarrer la nouvelle à mi-parcours du fondu
        this._startTimer = setTimeout(() => {
            this._startTimer = null;
            newTrack.volume = 0;
            newTrack.currentTime = 0;
            newTrack.play().catch(() => {});
            this._fadeIn(newTrack, name, ms);
            this._setupLoop(newTrack, name);
        }, ms / 2);
    }

    stop(ms = 1500) {
        if (this._startTimer) { clearTimeout(this._startTimer); this._startTimer = null; }
        this._stopCurrent(ms);
        this._current = null;
    }

    // ── SFX ────────────────────────────────────────────────────

    playSfx(name) {
        const track = this._tracks[name];
        if (!track) return;
        const sfx = track.cloneNode();
        sfx.volume = this._target;
        sfx.play().catch(() => {});
    }

    playSfxLoop(name) {
        if (this._sfxLoops[name]) return;
        const track = this._tracks[name];
        if (!track) return;
        const sfx = track.cloneNode();
        sfx.loop = true;
        sfx.volume = this._target;
        sfx.play().catch(() => {});
        this._sfxLoops[name] = sfx;
    }

    stopSfx(name, ms = 1000) {
        const sfx = this._sfxLoops[name];
        if (!sfx) return;
        delete this._sfxLoops[name];
        this._fadeOut(sfx, `sfx_${name}`, ms, () => sfx.pause());
    }

    // ── Privé ──────────────────────────────────────────────────

    // Fade-out + pause de la piste actuellement active (identifiée par this._current au moment de l'appel)
    _stopCurrent(ms) {
        const name  = this._current;
        const track = name ? this._tracks[name] : null;
        if (!track || track.paused) return;
        this._clearLoop(name);
        this._fadeOut(track, name, ms, () => {
            track.pause();
            track.currentTime = 0;
        });
    }

    _fadeIn(track, name, ms = this._fadeInMs) {
        this._cancelFade(name);
        const steps = Math.max(1, ms / 50);
        const step  = this._target / steps;
        const id = setInterval(() => {
            track.volume = Math.min(track.volume + step, this._target);
            if (track.volume >= this._target) {
                track.volume = this._target;
                clearInterval(id);
                this._fadeTimers.delete(name);
            }
        }, 50);
        this._fadeTimers.set(name, id);
    }

    _fadeOut(track, name, ms, cb) {
        this._cancelFade(name);
        const startVol = track.volume;
        if (startVol <= 0) { cb?.(); return; } // déjà muet
        const steps = Math.max(1, ms / 50);
        const step  = startVol / steps;
        const id = setInterval(() => {
            track.volume = Math.max(track.volume - step, 0);
            if (track.volume <= 0) {
                track.volume = 0;
                clearInterval(id);
                this._fadeTimers.delete(name);
                cb?.();
            }
        }, 50);
        this._fadeTimers.set(name, id);
    }

    _cancelFade(name) {
        const id = this._fadeTimers.get(name);
        if (id != null) { clearInterval(id); this._fadeTimers.delete(name); }
    }

    _setupLoop(track, name) {
        this._clearLoop(name);
        let fading = false;
        const watchId = setInterval(() => {
            if (!track.duration || track.paused) return;
            const remaining = track.duration - track.currentTime;
            if (remaining <= this._fadeOutSec && !fading) fading = true;
            if (fading) track.volume = Math.max(0, this._target * (remaining / this._fadeOutSec));
        }, 100);

        const onEnded = () => {
            fading = false;
            track.currentTime = 0;
            track.volume = 0;
            track.play().catch(() => {});
            this._fadeIn(track, name, this._fadeInMs);
        };

        track.addEventListener('ended', onEnded);
        this._loopTimers.set(name, { watchId, onEnded, track });
    }

    _clearLoop(name) {
        const entry = this._loopTimers.get(name);
        if (!entry) return;
        clearInterval(entry.watchId);
        entry.track.removeEventListener('ended', entry.onEnded);
        this._loopTimers.delete(name);
    }
}
