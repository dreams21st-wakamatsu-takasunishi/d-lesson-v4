#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    input: '',
    output: '',
    title: 'Dレッスン ログインカード',
    loginUrl: '',
    hideName: false,
    cardsPerPage: 6,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' || arg === '-i') args.input = argv[++i] || '';
    else if (arg === '--output' || arg === '-o') args.output = argv[++i] || '';
    else if (arg === '--title') args.title = argv[++i] || args.title;
    else if (arg === '--url') args.loginUrl = argv[++i] || '';
    else if (arg === '--hide-name') args.hideName = true;
    else if (arg === '--cards-per-page') args.cardsPerPage = clampInteger(argv[++i], 6, 4, 10);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  npm.cmd run build:student-login-cards -- --input .\\migration\\student-login-accounts.csv --output .\\migration\\student-login-cards.html',
    '',
    'Options:',
    '  --input, -i             student-login-accounts.csv',
    '  --output, -o            Printable HTML output path inside migration/',
    '  --title                 Card title. Default: Dレッスン ログインカード',
    '  --url                   Optional public D Lesson URL to print on each card',
    '  --hide-name             Do not print display_name on cards',
    '  --cards-per-page        Cards per A4 page. Default: 6',
    '  --help, -h              Show this help',
    '',
    'Input columns:',
    '  student_number, display_name, password'
  ].join('\n');
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, '');
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
  if (['student_number', 'number', 'no'].includes(value)) return 'student_number';
  if (['display_name', 'displayname', 'name', 'student_name'].includes(value)) return 'display_name';
  if (['password', 'passcode', 'あいことば'].includes(value)) return 'password';
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
    if (!row.student_number) failures.push(`line ${row.__line}: student_number is missing`);
    if (!row.password) failures.push(`line ${row.__line}: password is missing`);
    if (row.student_number && seenNumbers.has(row.student_number)) {
      failures.push(`line ${row.__line}: duplicated student_number "${row.student_number}"`);
    }
    seenNumbers.add(row.student_number);
  });

  if (failures.length > 0) {
    throw new Error(`Invalid student login CSV:\n- ${failures.join('\n- ')}`);
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

function buildCard(row, args) {
  const nameHtml = args.hideName
    ? ''
    : `<div class="student-name">${escapeHtml(row.display_name || '')}</div>`;
  const urlHtml = args.loginUrl
    ? `<div class="login-url">${escapeHtml(args.loginUrl)}</div>`
    : '';

  return `
    <section class="card">
      <div class="card-title">${escapeHtml(args.title)}</div>
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

function buildHtml(rows, args) {
  const generatedAt = new Date().toLocaleString('ja-JP');
  const rowsPerPage = Math.ceil(args.cardsPerPage / 2);
  const pages = chunkRows(rows, args.cardsPerPage).map(pageRows => `
    <div class="page" style="--rows-per-page:${rowsPerPage};">
      ${pageRows.map(row => buildCard(row, args)).join('\n')}
    </div>
  `).join('\n');

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(args.title)}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
    }

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

    .toolbar strong {
      color: #0f172a;
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

    .card {
      border: 2px solid #164e63;
      border-radius: 8px;
      padding: 5.5mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
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
      margin-top: 0;
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

    .credential-value.passcode {
      letter-spacing: 1px;
    }

    .login-url {
      margin-top: 0;
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
      body {
        background: #ffffff;
      }

      .toolbar {
        display: none;
      }

      .page {
        margin: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">印刷</button>
    <strong>${escapeHtml(args.title)}</strong>
    <span>生成日時: ${escapeHtml(generatedAt)} / ${rows.length}枚</span>
    <div>このHTMLには児童のあいことばが含まれます。印刷後の保管と破棄に注意してください。</div>
  </div>
  ${pages}
</body>
</html>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.input) throw new Error('Missing --input.');
  if (!args.output) throw new Error('Missing --output.');

  const rows = parseCsv(await fs.promises.readFile(path.resolve(args.input), 'utf8'));
  validateRows(rows);
  const html = buildHtml(rows, args);
  const outputPath = path.resolve(args.output);
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, html, 'utf8');

  console.log(`Wrote student login cards: ${outputPath}`);
  console.log(`Cards: ${rows.length}`);
  console.log('Keep this file out of Git. It contains student login passcodes.');
}

main().catch(err => {
  console.error(err.message);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
