// ── SaveManager — sauvegarde locale La Brémanie ───────────────
// Un seul slot, localStorage, format JSON versionné.

const KEY = 'bremanie_save_v1';

// Score de progression — ne jamais écraser une sauvegarde plus avancée
const PROGRESS = { chapter2_start: 10, chapter2_wave: 20, chapter3_start: 30, chapter3_wave: 40, complete: 100 };
function progressOf(s) { return s ? (PROGRESS[s.stage] || 0) + (s.wave || 0) : -1; }

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

    // Description courte pour l'UI : "Chapitre II — Vague 3"
    static describe(save) {
        if (!save) return '';
        switch (save.stage) {
            case 'chapter2_start': return 'Chapitre II — Début';
            case 'chapter2_wave':  return `Chapitre II — Vague ${save.wave + 1}`;
            case 'chapter3_start': return 'Chapitre III — Début';
            case 'chapter3_wave':  return `Chapitre III — Vague ${save.wave + 1}`;
            case 'complete':       return 'Aventure terminée ✓';
            default: return '';
        }
    }
}
