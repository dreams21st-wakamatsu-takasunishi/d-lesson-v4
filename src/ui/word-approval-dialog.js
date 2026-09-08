import { approveWordWithTeacher } from '../api/word-approval.js';
import { setLessonIcon } from './interface.js';

export function showWordApprovalDialog({ studentName, stageTitle, userDataId, stageId, page, onApproved, isCurrent }) {
    if (document.getElementById('word-approval-dialog')) return;
    const returnFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'word-approval-dialog';
    dialog.className = 'lesson-dialog';
    dialog.setAttribute('aria-labelledby', 'word-approval-heading');
    dialog.innerHTML = `
        <form class="word-approval-form" autocomplete="off">
            <header class="lesson-dialog-heading"><h2 id="word-approval-heading">先生のかくにん</h2>
                <button type="button" class="sys-btn" data-close aria-label="とじる" title="とじる">×</button></header>
            <dl class="word-approval-target"><dt>児童</dt><dd data-student></dd><dt>課題</dt><dd data-stage></dd><dt>ページ</dt><dd data-page></dd></dl>
            <label>先生のメールアドレス<input type="email" name="teacherEmail" required autocomplete="off" autocapitalize="none" spellcheck="false"></label>
            <label>先生のパスワード<input type="password" name="teacherPassword" required autocomplete="off"></label>
            <label class="word-approval-check"><input type="checkbox" name="reviewed" required>取り組んだ内容を確認しました</label>
            <p class="word-approval-error" role="alert" aria-live="polite"></p>
            <footer class="lesson-dialog-actions"><button type="button" class="btn-secondary" data-close>キャンセル</button>
                <button type="submit" class="btn-primary">承認してクリア</button></footer>
        </form>`;
    dialog.querySelector('[data-student]').textContent = studentName;
    dialog.querySelector('[data-stage]').textContent = stageTitle;
    dialog.querySelector('[data-page]').textContent = page ? `${page}ページまで` : '指定なし';
    document.body.appendChild(dialog);
    setLessonIcon(dialog.querySelector('.sys-btn'), 'x');
    const form = dialog.querySelector('form');
    const passwordInput = form.elements.namedItem('teacherPassword');
    let busy = false;
    let reloadOnClose = false;
    const close = () => { if (!busy) dialog.close(); };
    dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => {
        form.reset();
        dialog.remove();
        // After an uncertain server response, never let the old child snapshot overwrite a successful approval.
        if (reloadOnClose) { window.location.reload(); return; }
        if (returnFocus?.isConnected) returnFocus.focus();
    }, { once: true });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !form.reportValidity()) return;
        const errorElement = form.querySelector('[role="alert"]');
        if (!isCurrent()) { errorElement.textContent = '児童の画面が変わりました。とじて、もう一度確認してください。'; return; }
        busy = true;
        errorElement.textContent = '';
        const submit = form.querySelector('[type="submit"]');
        submit.textContent = '確認・保存中…';
        const email = form.elements.namedItem('teacherEmail').value;
        const password = passwordInput.value;
        passwordInput.value = '';
        form.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
        try {
            const result = await approveWordWithTeacher({ email, password, userDataId, stageId, page });
            busy = false;
            reloadOnClose = false;
            dialog.close();
            if (isCurrent()) onApproved(result);
        } catch (error) {
            reloadOnClose ||= Boolean(error.requiresReload);
            errorElement.textContent = error.message || '通信を確認して、もう一度お試しください。';
            if (reloadOnClose) {
                errorElement.textContent += ' この画面をとじると、保存結果を読み直します。';
                dialog.querySelector('.lesson-dialog-actions [data-close]').textContent = '画面を読み直す';
            }
        } finally {
            busy = false;
            if (dialog.isConnected) {
                form.querySelectorAll('input, button').forEach(control => { control.disabled = false; });
                submit.textContent = '承認してクリア';
                passwordInput.focus();
            }
        }
    });
    dialog.showModal();
}
