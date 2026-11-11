export function normalizeOfficialAnswer(values) {
    return values.join('').replace(/\r\n?/g, '\n').replace(/　{5}/g, '　');
}

export function attachOfficialExamFrame(frame, handlers) {
    let documentInFrame = null, windowInFrame = null, observer = null, poll = null;
    let abort = null, editable = false, composing = false, committed = [], state = '', destroyed = false;
    const read = () => [...(documentInFrame?.querySelectorAll('.userinput') || [])].map(area => area.value);
    const areas = () => documentInFrame?.querySelectorAll('.userinput') || [];
    const visible = element => Boolean(element?.getClientRects().length && element.closest('.ui-dialog')?.style.display !== 'none');

    function highlight(element) {
        if (typeof element === 'string') element = documentInFrame?.querySelector(element);
        documentInFrame?.querySelectorAll('.dlesson-guide-target').forEach(node => { if (node !== element) node.classList.remove('dlesson-guide-target'); });
        element?.classList.add('dlesson-guide-target');
    }
    function setEditable(value) {
        editable = value;
        areas().forEach(area => { area.readOnly = !value; });
    }
    function restore() {
        areas().forEach((area, index) => { area.value = committed[index] || ''; });
        windowInFrame?.DispLetterCount?.(areas());
    }
    function capture() {
        if (!documentInFrame || !areas().length || composing) return;
        if (editable && !handlers.canEdit()) { setEditable(false); restore(); return; }
        if (editable) { committed = read(); handlers.onAnswer(normalizeOfficialAnswer(committed)); }
    }
    function inspect() {
        if (destroyed || !documentInFrame) return;
        areas().forEach(area => { if (area.readOnly === editable) area.readOnly = !editable; });
        if (!documentInFrame.querySelector('#start')) return;
        const form = documentInFrame.getElementById('isInsertData');
        if (visible(form)) {
            if (state !== 'dialog') { state = 'dialog'; handlers.onRegistrationDialog(); highlight('#受験番号'); }
            return;
        }
        const number = documentInFrame.getElementById('受験番号')?.value.trim();
        const name = documentInFrame.getElementById('受験者名')?.value.trim();
        if (number && name && documentInFrame.getElementById('stuNo')?.textContent) {
            const key = `${number}\n${name}`;
            if (state !== key) { state = key; handlers.onRegistered(number, name); highlight('#startExam'); }
        }
    }
    function detachDocument() {
        observer?.disconnect(); observer = null;
        clearInterval(poll); poll = null;
        abort?.abort(); abort = null;
    }
    function load() {
        if (destroyed || frame.src === 'about:blank') return;
        detachDocument();
        documentInFrame = frame.contentDocument;
        windowInFrame = frame.contentWindow;
        if (!documentInFrame?.querySelector('#start, .userinput')) return handlers.onError('公式アプリを読み込めませんでした。');
        const style = documentInFrame.createElement('style');
        style.textContent = '.dlesson-guide-target {outline:4px solid #f39915 !important;outline-offset:4px;box-shadow:0 0 0 8px #fff3bf !important;}';
        if (documentInFrame.getElementById('start')) {
            style.textContent += '@media (max-width:600px), (max-height:700px) {#footer,#leftFooter {position:static;width:auto;margin:8px 0;text-align:center;}}';
        }
        documentInFrame.head.append(style);
        abort = new windowInFrame.AbortController();
        const listen = (event, callback, capture = false) => documentInFrame.addEventListener(event, callback, { capture, signal: abort.signal });
        ['pointerdown', 'keydown', 'touchstart'].forEach(type => listen(type, event => {
            if (event.isTrusted) handlers.onActivity?.();
        }, true));
        windowInFrame.open = (url) => {
            if (!url) return { close() {}, opener: null };
            const target = new URL(url, frame.contentWindow.location.href);
            if (target.origin !== window.location.origin || !/\/editor-jp\/cert-editor-jp_(CR|EL|SF|IE)\.html$/.test(target.pathname)) return null;
            // Keep identity out of the HTTP request; the copied HTML restores the query client-side.
            const identity = target.search.slice(1);
            target.search = '';
            target.hash = `identity=${encodeURIComponent(identity)}`;
            frame.style.visibility = 'hidden';
            handlers.onLoading?.();
            frame.src = target.href;
            return { close() {}, opener: null };
        };
        windowInFrame.download = () => handlers.onSave();
        listen('beforeinput', event => {
            if (event.target.matches('.userinput') && (!editable || !handlers.canEdit())) {
                event.preventDefault(); event.stopImmediatePropagation(); setEditable(false); restore();
            }
        }, true);
        listen('keydown', event => {
            if (!event.target.matches('.userinput')) return;
            if (!editable || !handlers.canEdit()) {
                if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown','Home','End','Shift','Control','Alt','Meta'].includes(event.key)) {
                    event.preventDefault(); event.stopImmediatePropagation();
                }
            } else queueMicrotask(capture);
        }, true);
        listen('compositionstart', event => { if (event.target.matches('.userinput')) composing = true; }, true);
        listen('compositionend', event => {
            if (!event.target.matches('.userinput')) return;
            composing = false;
            if (!editable || !handlers.canEdit()) { event.stopImmediatePropagation(); restore(); }
            else queueMicrotask(capture);
        }, true);
        listen('input', event => {
            if (event.target.matches('.userinput') && !event.isComposing && !composing) queueMicrotask(capture);
            if (event.target.id === '受験番号' && event.target.value) highlight('#受験者名');
            if (event.target.id === '受験者名' && event.target.value) highlight(documentInFrame.querySelector('#isInsertData')?.closest('.ui-dialog')?.querySelector('.ui-dialog-buttonset button'));
        }, true);
        listen('click', event => {
            const button = event.target.closest('button');
            if (!button) return;
            const dialog = button.closest('.ui-dialog');
            if (dialog?.querySelector('#Reset') && button.textContent.trim() === 'OK') queueMicrotask(() => {
                committed = read();
                handlers.onReset?.(normalizeOfficialAnswer(committed));
            });
            if (button.matches('.btnReset, .reset button')) queueMicrotask(() => highlight(documentInFrame.querySelector('#isReset')?.closest('.ui-dialog')?.querySelector('.ui-dialog-buttonset button')));
            if (dialog?.querySelector('#isReset') && button.textContent.trim() === 'OK') queueMicrotask(() => highlight(documentInFrame.querySelector('#Reset')?.closest('.ui-dialog')?.querySelector('.ui-dialog-buttonset button')));
            if (button.matches('.profile button')) queueMicrotask(() => {
                const form = [...documentInFrame.querySelectorAll('#popupwindow, #savewindow')].find(visible);
                highlight(form?.closest('.ui-dialog')?.querySelector('.ui-dialog-buttonset button'));
            });
        });
        observer = new windowInFrame.MutationObserver(inspect);
        observer.observe(documentInFrame.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
        state = ''; composing = false; committed = read(); setEditable(false);
        frame.style.visibility = 'visible';
        poll = setInterval(capture, 200);
        if (documentInFrame.querySelector('#start')) { handlers.onStart(); highlight('#start'); }
        else handlers.onEditor();
    }
    frame.addEventListener('load', load);
    return {
        highlight, setEditable,
        getAnswer: () => normalizeOfficialAnswer(committed),
        focus() {
            const area = areas()[0];
            if (!area) return;
            area.focus({ preventScroll: true });
            const { top } = area.getBoundingClientRect();
            // Reveal the first typing line without scrolling the lesson controls.
            if (top < 0 || top + 48 > windowInFrame.innerHeight) windowInFrame.scrollBy(0, top - 8);
        },
        clear() { windowInFrame?.textClear?.(); committed = read(); composing = false; },
        lock() { capture(); editable = false; composing = false; setEditable(false); restore(); },
        destroy() {
            // The parent has already confirmed leaving; suppress the embedded app's second prompt.
            windowInFrame?.__dlessonReleaseUnload?.();
            destroyed = true; detachDocument(); frame.removeEventListener('load', load); documentInFrame = null; windowInFrame = null;
        }
    };
}
