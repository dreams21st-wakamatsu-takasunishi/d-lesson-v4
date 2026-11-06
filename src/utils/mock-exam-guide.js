export function parseMockGuide(text) {
    const tokens = [];
    let offset = 0;
    for (const match of text.matchAll(/\{([^{}|]+)\|([^{}|]+)\}/g)) {
        if (match.index > offset) tokens.push({ text: text.slice(offset, match.index) });
        tokens.push({ text: match[1], reading: match[2] });
        offset = match.index + match[0].length;
    }
    if (offset < text.length) tokens.push({ text: text.slice(offset) });
    return tokens;
}

export function mockGuidePlainText(text) {
    return parseMockGuide(text).map(token => token.text).join('');
}

export function renderMockGuide(element, text) {
    element.replaceChildren();
    for (const token of parseMockGuide(text)) {
        if (!token.reading) { element.append(document.createTextNode(token.text)); continue; }
        const ruby = document.createElement('ruby');
        const reading = document.createElement('rt');
        reading.textContent = token.reading;
        ruby.append(document.createTextNode(token.text), reading);
        element.append(ruby);
    }
    element.setAttribute('aria-label', mockGuidePlainText(text));
}
