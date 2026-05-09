export function buildResetProgressPatch() {
    return {
        mouseLevel: 0,
        keyboardSequence: 0,
        examRecords: {},
        textRecords: {},
        globalMistakes: {},
        theme: 'default'
    };
}

export function buildForceProgressPatch(stageCount) {
    return {
        mouseLevel: 7,
        keyboardSequence: Number(stageCount || 0)
    };
}

export function getThemeCheckId(currentThemeId, themes) {
    const currentTheme = themes.find(theme => theme.id === currentThemeId);
    return currentTheme?.isCustom ? currentThemeId : `theme_${currentThemeId}`;
}

export function buildProgressEditPatch(values, currentUser, themes) {
    const items = Array.isArray(values.items) ? values.items : [];
    let theme = currentUser.theme || 'default';
    let activeEffect = currentUser.activeEffect || 'default';
    const currentThemeCheckId = getThemeCheckId(theme, themes);

    if (
        theme !== 'default'
        && !items.includes(currentThemeCheckId)
        && !items.includes(theme)
    ) {
        theme = 'default';
    }
    if (
        activeEffect !== 'default'
        && !items.includes(activeEffect)
    ) {
        activeEffect = 'default';
    }

    return {
        mouseLevel: Number.parseInt(values.mouseLevel, 10) || 0,
        keyboardSequence: Number.parseInt(values.keyboardSequence, 10) || 0,
        items,
        theme,
        activeEffect
    };
}
