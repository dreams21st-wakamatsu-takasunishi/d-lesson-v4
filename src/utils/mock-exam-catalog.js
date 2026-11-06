import officialProblems from '../data/mock-exam-problems.json' with { type: 'json' };

export function validateExamProblem(value) {
    const round = Number(value.round);
    const reference = String(value.reference || '').replace(/\r\n?/g, '\n');
    if (!Number.isInteger(round) || round < 1 || round > 999) throw new Error('回数を1〜999で入力してください。');
    if (!reference.trim() || reference.length > 6000) throw new Error('正解本文を1〜6000文字で入力してください。');
    if (value.permissionConfirmed !== true) throw new Error('本文のデータ化・端末への登録の許諾を確認してください。');
    return { id: `round-${round}`, round, title: `第${round}回過去問題`, reference, permissionConfirmed: true };
}

const catalogKey = campusId => `dlesson.mock-exam.catalog.v1:${campusId}`;

export function loadExamCatalog(storage, campusId) {
    try {
        const parsed = JSON.parse(storage.getItem(catalogKey(campusId)) || '[]');
        const local = Array.isArray(parsed) ? parsed.map(validateExamProblem) : [];
        const entries = new Map(officialProblems.map(problem => [problem.id, problem]));
        local.forEach(problem => entries.set(problem.id, problem));
        return [...entries.values()].sort((a, b) => a.round - b.round);
    } catch { return [...officialProblems]; }
}

export function saveExamProblem(storage, campusId, value) {
    const problem = validateExamProblem(value);
    const entries = JSON.parse(storage.getItem(catalogKey(campusId)) || '[]').filter(entry => entry.id !== problem.id);
    storage.setItem(catalogKey(campusId), JSON.stringify([...entries, problem]));
    return problem;
}

export function deleteExamProblem(storage, campusId, id) {
    const entries = JSON.parse(storage.getItem(catalogKey(campusId)) || '[]').filter(entry => entry.id !== id);
    storage.setItem(catalogKey(campusId), JSON.stringify(entries));
}
