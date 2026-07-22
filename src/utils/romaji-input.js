const BASE_ROMAJI = Object.freeze({
    'あ':['A'], 'い':['I','YI'], 'う':['U','WU','WHU'], 'え':['E'], 'お':['O'],
    'か':['KA','CA'], 'き':['KI'], 'く':['KU','CU','QU'], 'け':['KE'], 'こ':['KO','CO'],
    'さ':['SA'], 'し':['SI','SHI','CI'], 'す':['SU'], 'せ':['SE','CE'], 'そ':['SO'],
    'た':['TA'], 'ち':['TI','CHI'], 'つ':['TU','TSU'], 'て':['TE'], 'と':['TO'],
    'な':['NA'], 'に':['NI'], 'ぬ':['NU'], 'ね':['NE'], 'の':['NO'],
    'は':['HA'], 'ひ':['HI'], 'ふ':['HU','FU'], 'へ':['HE'], 'ほ':['HO'],
    'ま':['MA'], 'み':['MI'], 'む':['MU'], 'め':['ME'], 'も':['MO'],
    'や':['YA'], 'ゆ':['YU'], 'よ':['YO'],
    'ら':['RA'], 'り':['RI'], 'る':['RU'], 'れ':['RE'], 'ろ':['RO'],
    'わ':['WA'], 'を':['WO'],
    'が':['GA'], 'ぎ':['GI'], 'ぐ':['GU'], 'げ':['GE'], 'ご':['GO'],
    'ざ':['ZA'], 'じ':['ZI','JI'], 'ず':['ZU'], 'ぜ':['ZE'], 'ぞ':['ZO'],
    'だ':['DA'], 'ぢ':['DI','JI'], 'づ':['DU','ZU'], 'で':['DE'], 'ど':['DO'],
    'ば':['BA'], 'び':['BI'], 'ぶ':['BU'], 'べ':['BE'], 'ぼ':['BO'],
    'ぱ':['PA'], 'ぴ':['PI'], 'ぷ':['PU'], 'ぺ':['PE'], 'ぽ':['PO'],
    'ぁ':['LA','XA'], 'ぃ':['LI','XI','LYI','XYI'], 'ぅ':['LU','XU'], 'ぇ':['LE','XE','LYE','XYE'], 'ぉ':['LO','XO'],
    'ゃ':['LYA','XYA'], 'ゅ':['LYU','XYU'], 'ょ':['LYO','XYO'], 'ゎ':['LWA','XWA'],
    'きゃ':['KYA'], 'きぃ':['KYI'], 'きゅ':['KYU'], 'きぇ':['KYE'], 'きょ':['KYO'],
    'ぎゃ':['GYA'], 'ぎぃ':['GYI'], 'ぎゅ':['GYU'], 'ぎぇ':['GYE'], 'ぎょ':['GYO'],
    'しゃ':['SYA','SHA'], 'しぃ':['SYI'], 'しゅ':['SYU','SHU'], 'しぇ':['SYE','SHE'], 'しょ':['SYO','SHO'],
    'じゃ':['ZYA','JYA','JA'], 'じぃ':['ZYI','JYI'], 'じゅ':['ZYU','JYU','JU'], 'じぇ':['ZYE','JYE','JE'], 'じょ':['ZYO','JYO','JO'],
    'ちゃ':['TYA','CYA','CHA'], 'ちぃ':['TYI','CYI'], 'ちゅ':['TYU','CYU','CHU'], 'ちぇ':['TYE','CYE','CHE'], 'ちょ':['TYO','CYO','CHO'],
    'ぢゃ':['DYA'], 'ぢぃ':['DYI'], 'ぢゅ':['DYU'], 'ぢぇ':['DYE'], 'ぢょ':['DYO'],
    'にゃ':['NYA'], 'にぃ':['NYI'], 'にゅ':['NYU'], 'にぇ':['NYE'], 'にょ':['NYO'],
    'ひゃ':['HYA'], 'ひぃ':['HYI'], 'ひゅ':['HYU'], 'ひぇ':['HYE'], 'ひょ':['HYO'],
    'びゃ':['BYA'], 'びぃ':['BYI'], 'びゅ':['BYU'], 'びぇ':['BYE'], 'びょ':['BYO'],
    'ぴゃ':['PYA'], 'ぴぃ':['PYI'], 'ぴゅ':['PYU'], 'ぴぇ':['PYE'], 'ぴょ':['PYO'],
    'みゃ':['MYA'], 'みぃ':['MYI'], 'みゅ':['MYU'], 'みぇ':['MYE'], 'みょ':['MYO'],
    'りゃ':['RYA'], 'りぃ':['RYI'], 'りゅ':['RYU'], 'りぇ':['RYE'], 'りょ':['RYO'],
    'いぇ':['YE'], 'うぁ':['WHA'], 'うぃ':['WI','WHI'], 'うぇ':['WE','WHE'], 'うぉ':['WHO'],
    'くぁ':['QA','KWA'], 'くぃ':['QI','KWI'], 'くぇ':['QE','KWE'], 'くぉ':['QO','KWO'], 'くゃ':['QYA'], 'くゅ':['QYU'], 'くょ':['QYO'],
    'ぐぁ':['GWA'], 'ぐぃ':['GWI'], 'ぐぇ':['GWE'], 'ぐぉ':['GWO'],
    'すぃ':['SWI'], 'ずぃ':['ZWI'], 'つぁ':['TSA'], 'つぃ':['TSI'], 'つぇ':['TSE'], 'つぉ':['TSO'],
    'てゃ':['THA'], 'てぃ':['THI'], 'てゅ':['THU'], 'てぇ':['THE'], 'てょ':['THO'],
    'でゃ':['DHA'], 'でぃ':['DHI'], 'でゅ':['DHU'], 'でぇ':['DHE'], 'でょ':['DHO'],
    'とぁ':['TWA'], 'とぃ':['TWI'], 'とぅ':['TWU'], 'とぇ':['TWE'], 'とぉ':['TWO'],
    'どぁ':['DWA'], 'どぃ':['DWI'], 'どぅ':['DWU'], 'どぇ':['DWE'], 'どぉ':['DWO'],
    'ふぁ':['FA'], 'ふぃ':['FI'], 'ふぇ':['FE'], 'ふぉ':['FO'], 'ふゃ':['FYA'], 'ふゅ':['FYU'], 'ふょ':['FYO'],
    'ゔ':['VU'], 'ゔぁ':['VA'], 'ゔぃ':['VI','VYI'], 'ゔぇ':['VE','VYE'], 'ゔぉ':['VO'], 'ゔゃ':['VYA'], 'ゔゅ':['VYU'], 'ゔょ':['VYO']
});

const ROMAJI_KEYS = Object.keys(BASE_ROMAJI).sort((a, b) => b.length - a.length);

function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function unique(values) {
    return [...new Set(values.filter(Boolean).map(value => String(value).toUpperCase()))];
}

function tokenize(text) {
    const normalized = normalizeText(text);
    const tokens = [];
    for (let index = 0; index < normalized.length;) {
        const match = ROMAJI_KEYS.find(key => normalized.startsWith(key, index));
        if (match) {
            tokens.push(match);
            index += match.length;
        } else {
            tokens.push(normalized[index]);
            index++;
        }
    }
    return tokens;
}

function literalAliases(token) {
    const punctuation = { '、':[','], '。':['.'], 'ー':['-'], '・':['/'], ' ':[' '] };
    if (punctuation[token]) return punctuation[token];
    return [token.toUpperCase()];
}

function combineAliases(groups) {
    return groups.reduce(
        (combined, group) => combined.flatMap(prefix => group.map(value => `${prefix}${value}`)),
        ['']
    );
}

function getTokenAliases(token) {
    const direct = BASE_ROMAJI[token] || literalAliases(token);
    if (token.length < 2) return unique(direct);

    const decomposedGroups = [...token].map(char => BASE_ROMAJI[char] || literalAliases(char));
    return unique([...direct, ...combineAliases(decomposedGroups)]);
}

function buildSegments(text) {
    const tokens = tokenize(text);
    const segments = tokens.map(getTokenAliases);
    return tokens.map((token, index) => {
        if (token === 'ん') {
            const nextInitials = segments[index + 1]?.map(value => value[0]) || [];
            const canUseSingleN = nextInitials.length === 0 || nextInitials.every(initial => !/[AEIOUY]/.test(initial));
            return unique(['NN', "N'", 'XN', ...(canUseSingleN ? ['N'] : [])]);
        }
        if (token === 'っ') {
            const nextInitials = segments[index + 1]?.map(value => value.match(/^[BCDFGHJKLMNPQRSTVWXYZ]/)?.[0]) || [];
            return unique(['LTU', 'XTU', 'LTSU', ...nextInitials]);
        }
        return unique(segments[index]);
    });
}

function appendDefaults(segments, startIndex) {
    return segments.slice(startIndex).map(options => options[0] || '').join('');
}

function analyzeSegments(segments, prefix) {
    const memo = new Map();
    function walk(segmentIndex, prefixIndex) {
        const memoKey = `${segmentIndex}:${prefixIndex}`;
        if (memo.has(memoKey)) return memo.get(memoKey);
        if (segmentIndex >= segments.length) {
            const result = prefixIndex === prefix.length
                ? { valid: true, complete: true, suggestion: prefix }
                : { valid: false, complete: false, suggestion: '' };
            memo.set(memoKey, result);
            return result;
        }

        for (const option of segments[segmentIndex]) {
            const remaining = prefix.slice(prefixIndex);
            const compareLength = Math.min(option.length, remaining.length);
            if (option.slice(0, compareLength) !== remaining.slice(0, compareLength)) continue;
            if (remaining.length < option.length) {
                const result = {
                    valid: true,
                    complete: false,
                    suggestion: prefix + option.slice(remaining.length) + appendDefaults(segments, segmentIndex + 1)
                };
                memo.set(memoKey, result);
                return result;
            }
            const child = walk(segmentIndex + 1, prefixIndex + option.length);
            if (child.valid) {
                memo.set(memoKey, child);
                return child;
            }
        }
        const result = { valid: false, complete: false, suggestion: '' };
        memo.set(memoKey, result);
        return result;
    }
    return walk(0, 0);
}

export function createRomajiInputMatcher(text, manualPatterns = []) {
    const segments = buildSegments(text);
    const manuals = unique(Array.isArray(manualPatterns) ? manualPatterns : [manualPatterns]);

    function analyze(value) {
        const prefix = String(value ?? '').toUpperCase();
        const manual = manuals.find(pattern => pattern.startsWith(prefix));
        const generated = analyzeSegments(segments, prefix);
        if (manual && (!generated.valid || manual.length < generated.suggestion.length)) {
            return { valid: true, complete: manual === prefix, suggestion: manual };
        }
        return generated;
    }

    return {
        acceptsPrefix(value) { return analyze(value).valid; },
        isComplete(value) { return analyze(value).complete; },
        getSuggestion(value = '') { return analyze(value).suggestion || ''; }
    };
}

export function getRomajiSuggestion(text, manualPatterns = []) {
    return createRomajiInputMatcher(text, manualPatterns).getSuggestion('');
}
