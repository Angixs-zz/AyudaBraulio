const KEY = 'braulio-network-lab-v1';
export const emptyProgress = () => ({ lessons: [], steps: {}, bestQuiz: 0, quizzes: 0, lastLesson: null, saved: [] });

export function loadProgress(storage) {
  try {
    storage ??= globalThis.localStorage;
    const data = JSON.parse(storage.getItem(KEY));
    if (!data || typeof data !== 'object') return emptyProgress();
    const strings = value => Array.isArray(value) ? [...new Set(value.filter(v => typeof v === 'string'))] : [];
    return {
      lessons: strings(data.lessons), saved: strings(data.saved),
      steps: Object.fromEntries(Object.entries(data.steps && typeof data.steps === 'object' ? data.steps : {}).filter(([key, value]) => key.length < 100 && Array.isArray(value)).map(([key, value]) => [key, [...new Set(value.filter(n => Number.isInteger(n) && n >= 0 && n < 30))]])),
      bestQuiz: Number.isFinite(data.bestQuiz) ? Math.max(0, Math.min(100, data.bestQuiz)) : 0,
      quizzes: Number.isInteger(data.quizzes) && data.quizzes >= 0 ? data.quizzes : 0,
      lastLesson: typeof data.lastLesson === 'string' ? data.lastLesson : null,
    };
  } catch { return emptyProgress(); }
}

export function saveProgress(progress, storage) {
  try { storage ??= globalThis.localStorage; storage.setItem(KEY, JSON.stringify(progress)); return true; }
  catch { return false; }
}
