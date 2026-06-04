import { showCustomAlert } from './modal.js';

const DEFAULT_TITLE = 'Dレッスン ログインカード';
const LOGIN_CARD_PRINT_WINDOW_FEATURES = 'popup=yes,width=1180,height=840,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes';

function validateRows(rows) {
    const failures = [];
    const seenNumbers = new Set();

    rows.forEach(row => {
        if (!row.student_number) failures.push(`${row.__line}行目: 児童番号がありません`);
        if (!row.password) failures.push(`${row.__line}行目: あいことばがありません`);
        if (row.student_number && seenNumbers.has(row.student_number)) {
            failures.push(`${row.__line}行目: 児童番号 ${row.student_number} が重複しています`);
        }
        if (row.student_number) seenNumbers.add(row.student_number);
    });

    if (failures.length > 0) {
        throw new Error(failures.join('\n'));
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function chunkRows(rows, size) {
    const chunks = [];
    for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
    return chunks;
}

function getDefaultLoginUrl() {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    return url.toString();
}

function normalizeCardOptions(options = {}) {
    return {
        title: options.title || DEFAULT_TITLE,
        loginUrl: options.loginUrl ?? getDefaultLoginUrl(),
        hideName: Boolean(options.hideName),
        cardsPerPage: Number.parseInt(options.cardsPerPage || '6', 10) || 6
    };
}

function buildCard(row, options) {
    const nameHtml = options.hideName
        ? ''
        : `<div class="student-name">${escapeHtml(row.display_name || '')}</div>`;
    const urlHtml = options.loginUrl
        ? `<div class="login-url">${escapeHtml(options.loginUrl)}</div>`
        : '';

    return `
        <section class="login-card">
            <div class="card-title">${escapeHtml(options.title)}</div>
            ${nameHtml}
            <div class="credential-row">
                <span class="credential-label">児童番号</span>
                <span class="credential-value">${escapeHtml(row.student_number)}</span>
            </div>
            <div class="credential-row">
                <span class="credential-label">あいことば</span>
                <span class="credential-value passcode">${escapeHtml(row.password)}</span>
            </div>
            ${urlHtml}
            <ol class="steps">
                <li>Dレッスンをひらく</li>
                <li>児童番号とあいことばを入れる</li>
                <li>ログインを押す</li>
            </ol>
            <div class="notice">ほかの人に見せないでください</div>
        </section>
    `;
}

function buildPrintableHtml(rows, options) {
    const generatedAt = new Date().toLocaleString('ja-JP');
    const cardsPerPage = Math.max(4, Math.min(10, options.cardsPerPage));
    const rowsPerPage = Math.ceil(cardsPerPage / 2);
    const pages = chunkRows(rows, cardsPerPage).map(pageRows => `
        <div class="page" style="--rows-per-page:${rowsPerPage};">
            ${pageRows.map(row => buildCard(row, options)).join('\n')}
        </div>
    `).join('\n');

    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(options.title)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #eef2f7;
      color: #102033;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      letter-spacing: 0;
    }
    .toolbar {
      max-width: 210mm;
      margin: 14px auto;
      padding: 12px 14px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.6;
    }
    .toolbar button {
      margin-right: 8px;
      padding: 9px 16px;
      border: 0;
      border-radius: 6px;
      background: #2563eb;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    .page {
      width: 210mm;
      height: 297mm;
      margin: 0 auto 16px;
      padding: 10mm;
      background: #ffffff;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(var(--rows-per-page), minmax(0, 1fr));
      gap: 8mm;
      page-break-after: always;
      overflow: hidden;
    }
    .login-card {
      border: 2px solid #164e63;
      border-radius: 8px;
      padding: 5.5mm;
      display: flex;
      flex-direction: column;
      gap: 2.5mm;
      break-inside: avoid;
      background: #f8fafc;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .card-title {
      text-align: center;
      font-size: 15px;
      line-height: 1.2;
      font-weight: 800;
      color: #0f172a;
    }
    .student-name {
      text-align: center;
      font-size: 13px;
      line-height: 1.25;
      font-weight: 700;
      color: #334155;
      min-height: 17px;
      overflow-wrap: anywhere;
    }
    .credential-row {
      display: grid;
      grid-template-columns: 78px minmax(0, 1fr);
      align-items: center;
      gap: 6px;
    }
    .credential-label {
      font-size: 12px;
      font-weight: 800;
      color: #475569;
    }
    .credential-value {
      display: block;
      min-height: 34px;
      border: 1px solid #94a3b8;
      border-radius: 6px;
      background: #ffffff;
      font-size: 22px;
      font-weight: 900;
      line-height: 32px;
      text-align: center;
      color: #0f172a;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .credential-value.passcode { letter-spacing: 1px; }
    .login-url {
      padding: 4px 6px;
      border-radius: 6px;
      background: #e0f2fe;
      color: #075985;
      font-size: 9.5px;
      line-height: 1.25;
      font-weight: 700;
      text-align: center;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .steps {
      margin: 0;
      padding-left: 16px;
      color: #334155;
      font-size: 10px;
      line-height: 1.35;
    }
    .notice {
      margin-top: auto;
      padding-top: 4px;
      border-top: 1px dashed #94a3b8;
      color: #b91c1c;
      font-size: 10px;
      line-height: 1.25;
      font-weight: 800;
      text-align: center;
    }
    @media print {
      body { background: #ffffff; }
      .toolbar { display: none; }
      .page { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">印刷</button>
    <strong>${escapeHtml(options.title)}</strong>
    <span>作成日時: ${escapeHtml(generatedAt)} / ${rows.length}枚</span>
    <div>この画面には児童のあいことばが含まれます。印刷後の保管と破棄に注意してください。</div>
  </div>
  ${pages}
</body>
</html>`;
}

export function openStudentLoginCardsPrintWindow(rows, options = {}, targetWindow = null) {
    const safeRows = Array.isArray(rows)
        ? rows.map((row, index) => ({
            __line: row.__line || index + 1,
            student_number: String(row.student_number || '').trim(),
            display_name: String(row.display_name || '').trim(),
            password: String(row.password || '').trim()
        }))
        : [];

    try {
        validateRows(safeRows);
    } catch (error) {
        if (targetWindow) targetWindow.close();
        showCustomAlert(`ログインカードを作成できません。\n${error.message}`);
        return;
    }

    const popup = targetWindow || window.open('', '_blank', LOGIN_CARD_PRINT_WINDOW_FEATURES);
    if (!popup) {
        showCustomAlert('印刷画面を開けませんでした。ブラウザのポップアップ許可を確認してください。');
        return;
    }

    popup.document.open();
    popup.document.write(buildPrintableHtml(safeRows, normalizeCardOptions(options)));
    popup.document.close();
}

export function openBlankStudentLoginCardPrintWindow() {
    return window.open('', '_blank', LOGIN_CARD_PRINT_WINDOW_FEATURES);
}
