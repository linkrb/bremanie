export class AudioManager {
    constructor({ targetVolume = 0.7, fadeInMs = 3000, fadeOutSec = 6 } = {}) {
        this._tracks     = {};   // name → HTMLAudioElement
        this._current    = null; // nom de la piste active
        this._target     = targetVolume;
        this._fadeInMs   = fadeInMs;
        this._fadeOutSec = fadeOutSec;
        this._loopTimers = new Map(); // name → intervalId
    }

    preload(name, src) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        this._tracks[name] = audio;
    }

    play(name) {
        const track = this._tracks[name];
        if (!track) return;
        if (this._current === name) return;
        this._current = name;
        track.volume = 0;
        track.currentTime = 0;
        track.play().catch(() => {});
        this._fadeIn(track);
        this._setupLoop(track, name);
    }

    crossfadeTo(name, ms = 2000) {
        const oldName  = this._current;
        const oldTrack = oldName ? this._tracks[oldName] : null;
        const newTrack = this._tracks[name];
        if (!newTrack || name === oldName) return;

        // Stopper la boucle de l'ancienne piste
        if (oldName) this._clearLoop(oldName);

        // Fade-out de l'ancienne
        if (oldTrack) {
            this._fadeOut(oldTrack, ms, () => {
                oldTrack.pause();
                oldTrack.currentTime = 0;
            });
        }

        // Fade-in de la nouvelle à mi-chemin
        this._current = name;
        setTimeout(() => {
            newTrack.volume = 0;
            newTrack.currentTime = 0;
            newTrack.play().catch(() => {});
            this._fadeIn(newTrack, ms);
            this._setupLoop(newTrack, name);
        }, ms / 2);
    }

    stop(ms = 1500) {
        const track = this._current ? this._tracks[this._current] : null;
        if (!track) return;
        this._clearLoop(this._current);
        this._fadeOut(track, ms, () => {
            track.pause();
            track.currentTime = 0;
        });
        this._current = null;
    }

    // ── Privé ────────────────────────────────────────────────

    _fadeIn(track, ms) {
        ms = ms ?? this._fadeInMs;
        const steps = ms / 50;
        const step  = this._target / steps;
        const id = setInterval(() => {
            track.volume = Math.min(track.volume + step, this._target);
            if (track.volume >= this._target) {
                track.volume = this._target;
                clearInterval(id);
            }
        }, 50);
    }

    _fadeOut(track, ms, cb) {
        const startVol = track.volume;
        const steps    = ms / 50;
        const step     = startVol / steps;
        const id = setInterval(() => {
            track.volume = Math.max(track.volume - step, 0);
            if (track.volume <= 0) {
                track.volume = 0;
                clearInterval(id);
                cb?.();
            }
        }, 50);
    }

    _setupLoop(track, name) {
        this._clearLoop(name);

        // Surveillance du fade-out en fin de piste
        let fading = false;
        const watchId = setInterval(() => {
            if (!track.duration || track.paused) return;
            const remaining = track.duration - track.currentTime;
            if (remaining <= this._fadeOutSec && !fading) {
                fading = true;
            }
            if (fading) {
                track.volume = Math.max(0, this._target * (remaining / this._fadeOutSec));
            }
        }, 100);

        // Relance avec fade-in quand la piste se termine
        const onEnded = () => {
            fading = false;
            track.currentTime = 0;
            track.volume = 0;
            track.play().catch(() => {});
            this._fadeIn(track);
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
