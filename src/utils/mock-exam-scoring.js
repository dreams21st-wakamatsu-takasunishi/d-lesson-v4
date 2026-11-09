const normalize = value => String(value ?? '').replace(/\r\n?/g, '\n');
const comparable = value => value
    .replace(/[！-～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\uFF61-\uFF9F]+/g, chars => chars.normalize('NFKC'))
    .replace(/[ー－-]/g, '-').replace(/[、，,]/g, ',');
const isSpace = value => /^[ \u3000\t]+$/.test(value);

function tokens(text) {
    // Runs of surplus spaces cost one mistake, not one per space (rule 6).
    return text.match(/[ \u3000\t]+|[\uFF66-\uFF9D][\uFF9E\uFF9F]?|[^]/gu) || [];
}

function substitution(a, b) {
    if (a === b) return 0;
    if (isSpace(a) || isSpace(b)) return 1;
    return comparable(a) === comparable(b) ? 0 : 1;
}

export const EXAM_GRADES = [[2000, '特級'], [1500, '初段'], [1000, '1級'], [800, '準1級'], [600, '2級'], [450, '準2級'], [350, '3級'], [250, '4級'], [100, '5級'], [50, '6級']];

export function scoreMockExam(reference, answer, { fullText = false } = {}) {
    const ref = normalize(reference), raw = normalize(answer);
    if (!ref.trim() || ref.length > 6000 || raw.length > 10000) throw new Error('問題文は1〜6000文字、解答は10000文字以内にしてください。');
    // A second pass after a complete answer is excluded from the gross count (rule 9).
    let typed = raw;
    let ignoredRepeat = '';
    if (raw.length > ref.length && comparable(raw.slice(0, ref.length)) === comparable(ref)) {
        const tail = raw.slice(ref.length);
        if (comparable(ref).startsWith(comparable(tail)) || comparable(tail).startsWith(comparable(ref))) {
            typed = raw.slice(0, ref.length);
            ignoredRepeat = tail;
        }
    }
    const expected = tokens(ref), actual = tokens(typed);
    const refComparable = expected.map(comparable), typedComparable = actual.map(comparable);
    const refSpaces = expected.map(isSpace), typedSpaces = actual.map(isSpace);
    const width = actual.length + 1;
    // Same prefix alignment as text practice, using rolling rows and byte backtracking.
    const trace = new Uint8Array((expected.length + 1) * width);
    let previous = Uint16Array.from({ length: width }, (_, i) => i);
    let end = 0, minimum = actual.length;
    for (let j = 1; j < width; j++) trace[j] = 2;
    for (let i = 1; i <= expected.length; i++) {
        const row = new Uint16Array(width);
        row[0] = i;
        trace[i * width] = 1;
        for (let j = 1; j < width; j++) {
            const a = expected[i - 1], b = actual[j - 1];
            // Do not substitute a line break/indent for an unrelated character.
            const structural = (a === '\n') !== (b === '\n') || refSpaces[i - 1] !== typedSpaces[j - 1];
            const same = a === b || !refSpaces[i - 1] && refComparable[i - 1] === typedComparable[j - 1];
            const diagonal = previous[j - 1] + (structural ? 3 : same ? 0 : 1);
            const deletion = previous[j] + 1, insertion = row[j - 1] + 1;
            row[j] = Math.min(diagonal, deletion, insertion);
            trace[i * width + j] = row[j] === diagonal ? 0 : row[j] === deletion ? 1 : 2;
        }
        // Free untyped suffix: a timed-out answer is not a full-text omission.
        if (row[actual.length] < minimum || !end && actual.length && row[actual.length] === minimum) { minimum = row[actual.length]; end = i; }
        previous = row;
    }
    if (fullText) end = expected.length;
    const operations = [];
    let i = end, j = actual.length;
    while (i > 0 || j > 0) {
        const direction = trace[i * width + j];
        if (i && j && direction === 0) {
            const a = expected[--i], b = actual[--j];
            operations.push({ type: substitution(a, b) ? 'wrong' : 'correct', expected: a, typed: b });
        } else if (i && (direction === 1 || !j)) {
            operations.push({ type: 'omitted', expected: expected[--i], typed: '' });
        } else {
            operations.push({ type: 'extra', expected: '', typed: actual[--j] });
        }
    }
    operations.reverse();
    const halfWidth = /[!-~\uFF61-\uFF9F]/.test(typed);
    const commaMix = typed.includes('、') && /[，,]/.test(typed);
    const details = {
        wrong: operations.filter(op => op.type === 'wrong').length,
        omitted: operations.filter(op => op.type === 'omitted').length,
        extra: operations.filter(op => op.type === 'extra').length,
        halfWidth: halfWidth ? 1 : 0,
        commaMix: commaMix ? 1 : 0
    };
    // The official editor and printed cumulative counts include paragraph line breaks.
    const gross = [...typed].length;
    const mistakes = Object.values(details).reduce((a, b) => a + b, 0);
    const net = Math.max(0, gross - mistakes);
    return { gross, mistakes, net, details, operations, untypedSuffix: expected.slice(end).join(''), ignoredRepeat, grade: EXAM_GRADES.find(([minimum]) => net >= minimum)?.[1] || '6級未満', rulesVersion: 'japanese-2021-reference-v1' };
}

export function getMockExamReviewOperations(result, { fullText = false } = {}) {
    // Keep the scored alignment fixed; the untyped suffix must not realign entered text.
    return fullText && result.untypedSuffix
        ? [...result.operations, { type: 'untyped', expected: result.untypedSuffix, typed: '' }]
        : result.operations;
}
