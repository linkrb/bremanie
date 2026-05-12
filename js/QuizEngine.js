// QuizEngine — quiz narratif multi-axes, réutilisable entre chapitres
//
// Chaque question détermine un axe indépendant de la tour résultante.
//
// Usage :
//   import { runQuiz } from '/js/QuizEngine.js';
//   runQuiz(showDialogue, dlg, questions, onComplete);
//
// Format questions :
//   [
//     { axis: 'type',     script: 'chapter5/quiz_q1', answers: ['ice', 'cannon', 'fire'] },
//     { axis: 'cadence',  script: 'chapter5/quiz_q2', answers: ['fast', 'balanced', 'slow'] },
//     { axis: 'priority', script: 'chapter5/quiz_q3', answers: ['first', 'fast', 'tough'] },
//   ]
//
// onComplete({ type, cadence, priority }) est appelé avec une valeur par axe.

export function runQuiz(showDialogue, dlg, questions, onComplete) {
    const result = {};
    let i = 0;
    dlg.skipDisabled = true;

    function next() {
        if (i >= questions.length) {
            dlg.skipDisabled = false;
            onComplete(result);
            return;
        }
        const q = questions[i++];
        dlg.onChoice = (answerIdx) => {
            result[q.axis] = q.answers[answerIdx];
            dlg.onChoice = null;
        };
        showDialogue(q.script, next);
    }

    next();
}
