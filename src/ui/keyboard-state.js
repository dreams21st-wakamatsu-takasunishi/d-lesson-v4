let currentKeyboardChapter = null;

export function getCurrentKeyboardChapter() {
    return currentKeyboardChapter;
}

export function setCurrentKeyboardChapter(chapter) {
    currentKeyboardChapter = chapter || null;
}
