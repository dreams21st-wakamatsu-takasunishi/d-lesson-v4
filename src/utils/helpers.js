import { GRADE_ORDER, KANA_MAP } from '../data/constants.js';

export function calculateGrade(birthdateStr) {
    if (!birthdateStr) return "学年未設定";
    const birthDate = new Date(birthdateStr);
    if (isNaN(birthDate.getTime())) return "学年未設定";

    const today = new Date();
    let currentYear = today.getFullYear();
    if (today.getMonth() + 1 < 4 || (today.getMonth() + 1 === 4 && today.getDate() === 1)) currentYear--;

    let bYear = birthDate.getFullYear();
    if (birthDate.getMonth() + 1 < 4 || (birthDate.getMonth() + 1 === 4 && birthDate.getDate() === 1)) bYear--;

    const diff = currentYear - bYear;
    if (diff < 7) return "未就学";
    if (diff >= 7 && diff <= 12) return `小学${diff - 6}年`;
    if (diff >= 13 && diff <= 15) return `中学${diff - 12}年`;
    if (diff >= 16 && diff <= 18) return `高校${diff - 15}年`;
    return "おとな";
}

export function sortGrades(grades) {
    return grades.sort((a, b) => {
        let indexA = GRADE_ORDER.indexOf(a);
        let indexB = GRADE_ORDER.indexOf(b);
        if(indexA === -1) indexA = 999;
        if(indexB === -1) indexB = 999;
        return indexA - indexB;
    });
}

export function convertNameToRomaji(name) {
    if (!name) return 'NAME';
    let hira = name.replace(/[\u30a1-\u30f6]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60));
    let romaji = '';
    for (let i = 0; i < hira.length; i++) {
        let char2 = hira.substring(i, i+2);
        let char1 = hira.substring(i, i+1);
        let nextChar = i + 1 < hira.length ? hira.substring(i+1, i+2) : '';

        if (char1 === ' ' || char1 === '　') {
            romaji += ' ';
        } else if (char1 === 'ん') {
            const requireNN =['あ','い','う','え','お','な','に','ぬ','ね','の','や','ゆ','よ'].includes(nextChar) || nextChar === '';
            romaji += requireNN ? 'NN' : 'N';
        } else if (KANA_MAP[char2]) {
            romaji += KANA_MAP[char2];
            i++;
        } else if (char1 === 'っ' && nextChar) {
            let next2 = hira.substring(i+1, i+3);
            let next1 = hira.substring(i+1, i+2);
            let nextRomaji = KANA_MAP[next2] || KANA_MAP[next1];
            if (nextRomaji && /[A-Z]/.test(nextRomaji[0]) && !/^[AEIOU]/.test(nextRomaji[0])) {
                romaji += nextRomaji[0];
            } else {
                romaji += 'LTU';
            }
        } else if (KANA_MAP[char1]) {
            romaji += KANA_MAP[char1];
        } else {
            romaji += char1.toUpperCase();
        }
    }
    return romaji || 'NAME';
}

export function shuffle(arr) {
    for (let i=arr.length-1; i>0; i--) {
        const j=Math.floor(Math.random()*(i+1));
        [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    for (let i=1; i<arr.length; i++) {
        let a=arr[i], b=arr[i-1], va=(a.key||a.h||a), vb=(b.key||b.h||b);
        if (va===vb) {
            for (let j=i+1; j<arr.length; j++) {
                let vc=(arr[j].key||arr[j].h||arr[j]);
                if (vc!==va) {
                    [arr[i],arr[j]]=[arr[j],arr[i]];
                    break;
                }
            }
        }
    }
    return arr;
}
