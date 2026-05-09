import { showCustomAlert } from './modal.js';

const DEFAULT_TITLE = 'Dレッスン ログインカード';
const cardState = {
    rows: [],
    fileName: ''
};

function stripBom(text) {
    return String(text || '').replace(/^\uFEFF/, '');
}

function parseCsvLine(line) {
    const cells = [];
    let value = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];
        if (char === '"' && inQuote && next === '"') {
            value += '"';
            i += 1;
        } else if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            cells.push(value);
            value = '';
        } else {
            value += char;
        }
    }

    cells.push(value);
    return cells;
}

function normalizeKey(key) {
    const value = String(key || '').trim().toLowerCase();
    if (['student_number', 'number', 'no', '児童番号'].includes(value)) return 'student_number';
    if (['display_name', 'displayname', 'name', 'student_name', '児童名', '名前'].includes(value)) return 'display_name';
    if (['password', 'passcode', 'あいことば', '合言葉'].includes(value)) return 'password';
    return value;
}

function parseCsv(text) {
    const lines = stripBom(text).split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    const headers = parseCsvLine(lines[0]).map(normalizeKey);
    return lines.slice(1).map((line, index) => {
        const cells = parseCsvLine(line);
        const row = { __line: index + 2 };
        headers.forEach((header, cellIndex) => {
            row[header] = (cells[cellIndex] || '').trim();
        });
        return row;
    });
}

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

function getCardOptions() {
    return {
        title: document.getElementById('student-card-title')?.value?.trim() || DEFAULT_TITLE,
        loginUrl: document.getElementById('student-card-url')?.value?.trim() || getDefaultLoginUrl(),
        hideName: Boolean(document.getElementById('student-card-hide-name')?.checked),
        cardsPerPage: Number.parseInt(document.getElementById('student-card-per-page')?.value || '6', 10) || 6
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

function renderPreview() {
    const preview = document.getElementById('student-card-preview');
    const status = document.getElementById('student-card-status');
    if (!preview || !status) return;

    if (cardState.rows.length === 0) {
        status.innerText = 'CSVを選ぶと、ここにカードのプレビューが表示されます。';
        preview.innerHTML = '';
        return;
    }

    const options = getCardOptions();
    const sampleRows = cardState.rows.slice(0, 4);
    status.innerText = `${cardState.fileName} から ${cardState.rows.length}人分を読み込みました。下は先頭${sampleRows.length}人のプレビューです。`;
    preview.innerHTML = sampleRows.map(row => `
        <div style="border:1px solid #94a3b8; border-radius:8px; background:#f8fafc; padding:10px; min-width:180px;">
            <div style="font-weight:800; text-align:center; color:#0f172a;">${escapeHtml(options.title)}</div>
            ${options.hideName ? '' : `<div style="font-size:13px; text-align:center; color:#334155; overflow-wrap:anywhere;">${escapeHtml(row.display_name || '')}</div>`}
            <div style="display:grid; grid-template-columns:70px 1fr; gap:6px; align-items:center; margin-top:8px;">
                <span style="font-size:12px; font-weight:800;">児童番号</span>
                <strong style="border:1px solid #cbd5e1; border-radius:6px; background:#fff; padding:5px; text-align:center;">${escapeHtml(row.student_number)}</strong>
                <span style="font-size:12px; font-weight:800;">あいことば</span>
                <strong style="border:1px solid #cbd5e1; border-radius:6px; background:#fff; padding:5px; text-align:center; overflow-wrap:anywhere;">${escapeHtml(row.password)}</strong>
            </div>
        </div>
    `).join('');
}

async function handleCsvInput(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    try {
        const rows = parseCsv(await file.text());
        validateRows(rows);
        cardState.rows = rows;
        cardState.fileName = file.name;
        renderPreview();
    } catch (error) {
        cardState.rows = [];
        cardState.fileName = '';
        renderPreview();
        showCustomAlert(`児童ログインカードCSVを読み込めませんでした。\n${error.message}`);
    }
}

function openPrintWindow() {
    if (cardState.rows.length === 0) {
        showCustomAlert('先に student-login-accounts.csv を選んでください。');
        return;
    }

    const popup = window.open('', '_blank');
    if (!popup) {
        showCustomAlert('印刷画面を開けませんでした。ブラウザのポップアップ許可を確認してください。');
        return;
    }

    popup.document.open();
    popup.document.write(buildPrintableHtml(cardState.rows, getCardOptions()));
    popup.document.close();
}

export function renderStudentLoginCardBuilder() {
    const section = document.getElementById('admin-sec-auth-link');
    if (!section) return;

    let container = document.getElementById('student-login-card-builder');
    if (!container) {
        container = document.createElement('div');
        container.id = 'student-login-card-builder';
        section.appendChild(container);
    }

    container.style.cssText = 'width:100%; margin-top:16px;';
    container.innerHTML = `
        <div style="background:#fff7ed; border:1px solid #fdba74; border-radius:8px; padding:15px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
                <div>
                    <div style="font-weight:800; color:#9a3412; font-size:16px;">児童ログインカード作成</div>
                    <div style="font-size:13px; color:#7c2d12; line-height:1.5;">student-login-accounts.csv をこの画面で読み込み、印刷用カードを作成します。CSVはアップロードされず、このブラウザ内だけで使われます。</div>
                </div>
                <button id="student-card-print-btn" class="btn-primary" type="button" style="font-size:14px; padding:8px 12px; background:#ea580c;">印刷画面を開く</button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; align-items:end;">
                <label style="font-size:13px; font-weight:bold; color:#7c2d12;">CSVファイル
                    <input id="student-card-csv-input" type="file" accept=".csv,text/csv" style="display:block; margin-top:6px; width:100%; font-size:13px;">
                </label>
                <label style="font-size:13px; font-weight:bold; color:#7c2d12;">カードタイトル
                    <input id="student-card-title" type="text" value="${escapeHtml(DEFAULT_TITLE)}" style="box-sizing:border-box; display:block; margin-top:6px; width:100%; padding:8px; border:1px solid #fdba74; border-radius:6px;">
                </label>
                <label style="font-size:13px; font-weight:bold; color:#7c2d12;">カードに載せるURL
                    <input id="student-card-url" type="text" value="${escapeHtml(getDefaultLoginUrl())}" style="box-sizing:border-box; display:block; margin-top:6px; width:100%; padding:8px; border:1px solid #fdba74; border-radius:6px;">
                </label>
                <label style="font-size:13px; font-weight:bold; color:#7c2d12;">A4 1ページの枚数
                    <select id="student-card-per-page" style="box-sizing:border-box; display:block; margin-top:6px; width:100%; padding:8px; border:1px solid #fdba74; border-radius:6px;">
                        <option value="4">4枚</option>
                        <option value="6" selected>6枚</option>
                        <option value="8">8枚</option>
                    </select>
                </label>
                <label style="display:flex; gap:8px; align-items:center; font-size:13px; font-weight:bold; color:#7c2d12; padding-bottom:8px;">
                    <input id="student-card-hide-name" type="checkbox">
                    名前を印刷しない
                </label>
            </div>
            <div id="student-card-status" style="margin-top:10px; font-size:13px; color:#7c2d12;">CSVを選ぶと、ここにカードのプレビューが表示されます。</div>
            <div id="student-card-preview" style="margin-top:10px; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;"></div>
        </div>
    `;

    document.getElementById('student-card-csv-input')?.addEventListener('change', handleCsvInput);
    document.getElementById('student-card-print-btn')?.addEventListener('click', openPrintWindow);
    ['student-card-title', 'student-card-url', 'student-card-per-page', 'student-card-hide-name'].forEach(id => {
        const input = document.getElementById(id);
        input?.addEventListener('input', renderPreview);
        input?.addEventListener('change', renderPreview);
    });

    renderPreview();
}
