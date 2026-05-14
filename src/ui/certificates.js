import { STAGE_ORDER, VISION_STAGES } from '../data/constants.js';
import { currentUser, getUserDisplayName, users } from '../api/user.js';
import { showCustomAlert } from './modal.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clampPercent(value, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.floor((Number(value || 0) / total) * 100)));
}

function getTextHighScore(user) {
    return Math.max(0, ...Object.values(user?.textRecords || {}).map(record => Number(record?.score || 0)));
}

function getWordClearCount(user) {
    return Object.values(user?.wordProgress || {})
        .filter(progress => progress === 'cleared' || progress?.status === 'cleared')
        .length;
}

function buildCertificateDefinitions(user) {
    const mouseLevel = Number(user?.mouseLevel || 0);
    const keyboardSequence = Number(user?.keyboardSequence || 0);
    const visionCount = Array.isArray(user?.visionCleared) ? user.visionCleared.length : 0;
    const textHighScore = getTextHighScore(user);
    const wordClearCount = getWordClearCount(user);
    const keyboardTotal = STAGE_ORDER.length;
    const visionTotal = VISION_STAGES.length * 3;

    return [
        {
            id: 'mouse-step-3',
            title: 'マウスれんしゅう がんばり賞',
            requirement: 'マウス Lv.3 までクリア',
            progressText: `Lv.${Math.min(mouseLevel, 3)} / 3`,
            percent: clampPercent(mouseLevel, 3),
            earned: mouseLevel >= 3,
            message: 'マウスをていねいに動かし、基本の操作をしっかり身につけました。'
        },
        {
            id: 'mouse-master',
            title: 'マウスれんしゅう 免許皆伝',
            requirement: 'マウス Lv.7 までクリア',
            progressText: `Lv.${Math.min(mouseLevel, 7)} / 7`,
            percent: clampPercent(mouseLevel, 7),
            earned: mouseLevel >= 7,
            message: 'クリック、ドラッグ、細かな操作まで、最後までよくがんばりました。'
        },
        {
            id: 'keyboard-25',
            title: 'キーボード 努力賞',
            requirement: 'キーボード全体の 25% クリア',
            progressText: `${Math.min(keyboardSequence, keyboardTotal)} / ${keyboardTotal}`,
            percent: clampPercent(keyboardSequence, keyboardTotal),
            earned: keyboardSequence >= Math.ceil(keyboardTotal * 0.25),
            message: 'ホームポジションを意識して、練習を積み重ねる力が育っています。'
        },
        {
            id: 'keyboard-50',
            title: 'キーボード 上達賞',
            requirement: 'キーボード全体の 50% クリア',
            progressText: `${Math.min(keyboardSequence, keyboardTotal)} / ${keyboardTotal}`,
            percent: clampPercent(keyboardSequence, keyboardTotal),
            earned: keyboardSequence >= Math.ceil(keyboardTotal * 0.5),
            message: '指の使い方が安定し、入力の正確さと速さが伸びてきました。'
        },
        {
            id: 'keyboard-master',
            title: 'キーボード 達成賞',
            requirement: 'キーボード全ステージ クリア',
            progressText: `${Math.min(keyboardSequence, keyboardTotal)} / ${keyboardTotal}`,
            percent: clampPercent(keyboardSequence, keyboardTotal),
            earned: keyboardSequence >= keyboardTotal,
            message: 'たくさんのキー練習を最後までやりきりました。すばらしい達成です。'
        },
        {
            id: 'vision-basic',
            title: 'ビジョントレーニング チャレンジ賞',
            requirement: 'ビジョン課題を 9 個以上クリア',
            progressText: `${Math.min(visionCount, visionTotal)} / ${visionTotal}`,
            percent: clampPercent(visionCount, visionTotal),
            earned: visionCount >= VISION_STAGES.length,
            message: '見る力、探す力、覚える力を使って、集中して取り組みました。'
        },
        {
            id: 'vision-master',
            title: 'ビジョントレーニング マスター賞',
            requirement: 'ビジョン課題をすべてクリア',
            progressText: `${Math.min(visionCount, visionTotal)} / ${visionTotal}`,
            percent: clampPercent(visionCount, visionTotal),
            earned: visionCount >= visionTotal,
            message: 'むずかしい課題にも挑戦し、最後までやり抜く力を見せてくれました。'
        },
        {
            id: 'text-100',
            title: '文章入力 チャレンジ賞',
            requirement: '文章入力の純字数 100 文字以上',
            progressText: `${Math.min(textHighScore, 100)} / 100`,
            percent: clampPercent(textHighScore, 100),
            earned: textHighScore >= 100,
            message: 'お手本をよく見ながら、文章を正確に入力する練習に取り組みました。'
        },
        {
            id: 'text-500',
            title: '文章入力 上達賞',
            requirement: '文章入力の純字数 500 文字以上',
            progressText: `${Math.min(textHighScore, 500)} / 500`,
            percent: clampPercent(textHighScore, 500),
            earned: textHighScore >= 500,
            message: '長い文章にも集中して向き合い、入力する力を大きく伸ばしました。'
        },
        {
            id: 'word-basic',
            title: 'Wordれんしゅう 完成賞',
            requirement: 'Word課題を 3 個以上クリア',
            progressText: `${wordClearCount} 個`,
            percent: clampPercent(wordClearCount, 3),
            earned: wordClearCount >= 3,
            message: '作品づくりに取り組み、文書作成の力を伸ばしました。'
        },
        {
            id: 'd-lesson-total',
            title: 'Dレッスン 総合がんばり賞',
            requirement: 'マウスLv.7 と キーボード50%以上を達成',
            progressText: `マウス Lv.${Math.min(mouseLevel, 7)} / キーボード ${clampPercent(keyboardSequence, keyboardTotal)}%`,
            percent: Math.min(100, Math.floor((clampPercent(mouseLevel, 7) + clampPercent(keyboardSequence, keyboardTotal)) / 2)),
            earned: mouseLevel >= 7 && keyboardSequence >= Math.ceil(keyboardTotal * 0.5),
            message: 'いろいろな練習にこつこつ取り組み、自分の力を伸ばし続けました。'
        }
    ];
}

function buildCertificatePage(certificate, studentName, issuedAt) {
    return `
        <section class="certificate-page">
            <div class="corner corner-top-left"></div>
            <div class="corner corner-top-right"></div>
            <div class="corner corner-bottom-left"></div>
            <div class="corner corner-bottom-right"></div>
            <div class="certificate-kicker">Dレッスン</div>
            <h1>${escapeHtml(certificate.title)}</h1>
            <div class="student-name">${escapeHtml(studentName)} さん</div>
            <p class="message">${escapeHtml(certificate.message)}</p>
            <div class="requirement">${escapeHtml(certificate.requirement)}</div>
            <div class="date">${escapeHtml(issuedAt)}</div>
            <div class="signature">Dレッスン</div>
        </section>
    `;
}

function buildPrintableHtml(certificates, studentName) {
    const issuedAt = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>Dレッスン 賞状</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f1f5f9;
      color: #1f2937;
      font-family: "Yu Mincho", "Yu Gothic", "Meiryo", serif;
      letter-spacing: 0;
    }
    .toolbar {
      max-width: 297mm;
      margin: 12px auto;
      padding: 10px 14px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-family: "Yu Gothic", "Meiryo", sans-serif;
      font-size: 14px;
    }
    .toolbar button {
      margin-right: 10px;
      padding: 9px 18px;
      border: 0;
      border-radius: 6px;
      background: #b45309;
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }
    .certificate-page {
      position: relative;
      width: 273mm;
      height: 186mm;
      margin: 0 auto 16px;
      padding: 20mm 24mm;
      background:
        radial-gradient(circle at top left, rgba(251,191,36,0.18), transparent 34%),
        radial-gradient(circle at bottom right, rgba(20,184,166,0.14), transparent 34%),
        #fffdf7;
      border: 6px double #b45309;
      page-break-after: always;
      overflow: hidden;
      text-align: center;
    }
    .certificate-page::before {
      content: "";
      position: absolute;
      inset: 10mm;
      border: 2px solid #f59e0b;
      pointer-events: none;
    }
    .corner {
      position: absolute;
      width: 34mm;
      height: 34mm;
      border: 3px solid #d97706;
      opacity: 0.75;
    }
    .corner-top-left { top: 9mm; left: 9mm; border-right: 0; border-bottom: 0; }
    .corner-top-right { top: 9mm; right: 9mm; border-left: 0; border-bottom: 0; }
    .corner-bottom-left { bottom: 9mm; left: 9mm; border-right: 0; border-top: 0; }
    .corner-bottom-right { bottom: 9mm; right: 9mm; border-left: 0; border-top: 0; }
    .certificate-kicker {
      color: #0f766e;
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 8mm;
      font-family: "Yu Gothic", "Meiryo", sans-serif;
    }
    h1 {
      margin: 0;
      color: #92400e;
      font-size: 36px;
      line-height: 1.25;
      letter-spacing: 0;
    }
    .student-name {
      margin-top: 14mm;
      font-size: 30px;
      font-weight: 800;
      border-bottom: 2px solid #d6a03d;
      display: inline-block;
      min-width: 120mm;
      padding: 0 8mm 3mm;
    }
    .message {
      max-width: 190mm;
      margin: 12mm auto 0;
      color: #374151;
      font-size: 20px;
      line-height: 1.8;
      font-weight: 700;
    }
    .requirement {
      margin-top: 9mm;
      padding: 4mm 8mm;
      display: inline-block;
      background: #fef3c7;
      border: 1px solid #fbbf24;
      border-radius: 999px;
      color: #78350f;
      font-family: "Yu Gothic", "Meiryo", sans-serif;
      font-size: 15px;
      font-weight: 800;
    }
    .date {
      position: absolute;
      right: 28mm;
      bottom: 25mm;
      font-size: 16px;
      font-weight: 700;
    }
    .signature {
      position: absolute;
      right: 30mm;
      bottom: 15mm;
      min-width: 52mm;
      padding-top: 3mm;
      border-top: 1px solid #92400e;
      font-size: 18px;
      font-weight: 800;
      color: #92400e;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .certificate-page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">印刷</button>
    <strong>${escapeHtml(studentName)} さんの賞状</strong>
    <span>${certificates.length}枚</span>
  </div>
  ${certificates.map(certificate => buildCertificatePage(certificate, studentName, issuedAt)).join('\n')}
</body>
</html>`;
}

function openCertificatePrintWindow(certificates, studentName) {
    const popup = window.open('', '_blank');
    if (!popup) {
        showCustomAlert('印刷画面を開けませんでした。ブラウザのポップアップ許可を確認してください。');
        return;
    }
    popup.document.open();
    popup.document.write(buildPrintableHtml(certificates, studentName));
    popup.document.close();
}

export function printCertificate(certificateId) {
    const user = users[currentUser];
    if (!user) return;
    const certificate = buildCertificateDefinitions(user).find(item => item.id === certificateId);
    if (!certificate || !certificate.earned) {
        showCustomAlert('この賞状はまだ印刷できません。条件を達成してから印刷してください。');
        return;
    }
    openCertificatePrintWindow([certificate], getUserDisplayName(currentUser));
}

export function printEarnedCertificates() {
    const user = users[currentUser];
    if (!user) return;
    const certificates = buildCertificateDefinitions(user).filter(item => item.earned);
    if (certificates.length === 0) {
        showCustomAlert('まだ印刷できる賞状がありません。練習をクリアするとここに増えていきます。');
        return;
    }
    openCertificatePrintWindow(certificates, getUserDisplayName(currentUser));
}

export function renderCertificateSection(container, userId) {
    const user = users[userId];
    if (!container || !user) return;

    const certificates = buildCertificateDefinitions(user);
    const earnedCount = certificates.filter(item => item.earned).length;
    container.innerHTML = `
        <div style="background:#fff8e1; border:2px solid #fbc02d; border-radius:12px; padding:16px; margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                <div>
                    <h3 style="margin:0 0 4px; color:#8d5b00;">賞状印刷</h3>
                    <div style="font-size:14px; color:#6b4f00; font-weight:bold;">達成した段階に合わせて、A4横向きの賞状を印刷できます。</div>
                </div>
                <button class="btn-primary" onclick="printEarnedCertificates()" ${earnedCount ? '' : 'disabled'} style="font-size:15px; padding:9px 14px; background:#b45309; ${earnedCount ? '' : 'opacity:0.45; cursor:not-allowed;'}">達成済みをまとめて印刷</button>
            </div>
            <div style="margin-top:8px; font-size:13px; color:#795548;">達成済み: ${earnedCount} / ${certificates.length}</div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
            ${certificates.map(certificate => `
                <div style="background:#fff; border:2px solid ${certificate.earned ? '#f59e0b' : '#d7dee8'}; border-radius:10px; padding:13px; box-shadow:0 3px 0 ${certificate.earned ? '#fbbf24' : '#cbd5e1'};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                        <div>
                            <div style="font-size:17px; font-weight:900; color:${certificate.earned ? '#92400e' : '#475569'};">${escapeHtml(certificate.title)}</div>
                            <div style="font-size:12px; color:#64748b; margin-top:3px;">${escapeHtml(certificate.requirement)}</div>
                        </div>
                        <span style="font-size:12px; font-weight:900; color:#fff; background:${certificate.earned ? '#16a34a' : '#94a3b8'}; border-radius:999px; padding:4px 8px; white-space:nowrap;">${certificate.earned ? '達成' : '未達成'}</span>
                    </div>
                    <div style="margin-top:10px;">
                        <div style="display:flex; justify-content:space-between; font-size:12px; color:#475569; font-weight:bold;">
                            <span>進捗</span><span>${escapeHtml(certificate.progressText)}</span>
                        </div>
                        <div style="height:12px; background:#e2e8f0; border-radius:999px; overflow:hidden; margin-top:5px;">
                            <div style="height:100%; width:${certificate.percent}%; background:${certificate.earned ? '#f59e0b' : '#38bdf8'};"></div>
                        </div>
                    </div>
                    <button class="btn-secondary" onclick="printCertificate('${certificate.id}')" ${certificate.earned ? '' : 'disabled'} style="width:100%; margin-top:12px; font-size:14px; padding:8px 10px; ${certificate.earned ? 'background:#fff7ed; border-color:#fdba74; color:#9a3412;' : 'opacity:0.45; cursor:not-allowed;'}">この賞状を印刷</button>
                </div>
            `).join('')}
        </div>
    `;
}
