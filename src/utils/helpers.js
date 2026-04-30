import { GRADE_ORDER } from '../data/constants.js';

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
