// ── SaveManager — sauvegarde locale La Brémanie ───────────────
// Un seul slot, localStorage, format JSON versionné.

const KEY = 'bremanie_save_v1';

// Extraire le numéro de chapitre depuis un stage "chapterN_start"
function chapterNumOf(stage) {
    if (!stage) return 0;
    if (stage === 'complete') return Infinity;
    const m = stage.match(/^chapter(\d+)_start$/);
    return m ? parseInt(m[1]) : 0;
}

function progressOf(s) {
    if (!s) return -1;
    return chapterNumOf(s.stage);
}

export class SaveManager {

    static save(data) {
        const current = SaveManager.load();
        if (progressOf(current) >= progressOf(data)) return; // pas de régression
        localStorage.setItem(KEY, JSON.stringify({ ...data, v: 1, ts: Date.now() }));
    }

    static load() {
        try { return JSON.parse(localStorage.getItem(KEY)); }
        catch { return null; }
    }

    static has() { return !!localStorage.getItem(KEY); }

    static clear() { localStorage.removeItem(KEY); }

    // Numéro max de chapitre débloqué (terminés + le suivant en cours)
    static maxUnlocked(save) {
        if (!save) return 1;
        if (save.stage === 'complete') return Infinity;
        const n = chapterNumOf(save.stage);
        return n > 0 ? n : 1;
    }

    // Description courte pour l'UI
    static describe(save) {
        if (!save) return '';
        if (save.stage === 'complete') return 'Aventure terminée ✓';
        const n = chapterNumOf(save.stage);
        return n > 0 ? `Chapitre ${n}` : '';
    }
}
