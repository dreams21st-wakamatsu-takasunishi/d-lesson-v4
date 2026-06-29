import {
    users,
    saveUsers,
    GLOBAL_SETTINGS_ID,
    DEFAULT_CAMPUS_ID,
    getCampusList,
    getCampusName,
    getUserCampusId,
    isSystemUserId
} from '../api/user.js';
import {
    STANDARD_ROUTE_MODE_CAMPUS_GROUP,
    STANDARD_ROUTE_MODE_STANDARD,
    STANDARD_ROUTE_SETTING_KEY,
    STANDARD_ROUTE_STEP_IDS,
    STANDARD_ROUTE_STEP_LABELS,
    normalizeStandardRouteOrder,
    normalizeStandardRouteSettings
} from '../utils/standard-route.js';
import { showCustomAlert, showCustomConfirm } from './modal.js';
import { recordAdminAudit } from './admin-audit.js';

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function escapeJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

function ensureGlobalSettings() {
    if (!users[GLOBAL_SETTINGS_ID] || typeof users[GLOBAL_SETTINGS_ID] !== 'object') {
        users[GLOBAL_SETTINGS_ID] = { isMaster: true };
    }
    users[GLOBAL_SETTINGS_ID].isMaster = true;
    return users[GLOBAL_SETTINGS_ID];
}

function getRouteSettings() {
    return normalizeStandardRouteSettings(users[GLOBAL_SETTINGS_ID] || {});
}

function setRouteSettings(settings) {
    ensureGlobalSettings()[STANDARD_ROUTE_SETTING_KEY] = normalizeStandardRouteSettings({
        [STANDARD_ROUTE_SETTING_KEY]: settings
    });
}

function getStudentGroups() {
    return Array.from(new Set(Object.keys(users)
        .filter(userId => !isSystemUserId(userId) && users[userId] && !users[userId].isMaster)
        .map(userId => String(users[userId]?.group || '').trim())
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'ja'));
}

function getRuleLabel(rule) {
    const campusLabel = rule.campusId ? getCampusName(rule.campusId) : '全校舎';
    const groupLabel = rule.group || '校舎全体';
    return `${campusLabel} / ${groupLabel}`;
}

function renderModeLabel(mode) {
    return mode === STANDARD_ROUTE_MODE_CAMPUS_GROUP
        ? '教室・グループ別おすすめ順'
        : '標準ルート';
}

function renderOrderText(order) {
    return normalizeStandardRouteOrder(order)
        .map(stepId => STANDARD_ROUTE_STEP_LABELS[stepId] || stepId)
        .join(' → ');
}

function renderCampusOptions(selectedValue) {
    return getCampusList().map(campus => `
        <option value="${escapeHtml(campus.id)}"${campus.id === selectedValue ? ' selected' : ''}>
            ${escapeHtml(campus.name)}
        </option>
    `).join('');
}

function renderGroupOptions(selectedValue) {
    const groups = getStudentGroups();
    return `
        <option value="">校舎全体</option>
        ${groups.map(group => `
            <option value="${escapeHtml(group)}"${group === selectedValue ? ' selected' : ''}>
                ${escapeHtml(group)}
            </option>
        `).join('')}
    `;
}

function renderOrderSelect(index, selectedStep) {
    return `
        <label>
            ${index + 1}
            <select id="route-rule-order-${index}">
                ${STANDARD_ROUTE_STEP_IDS.map(stepId => `
                    <option value="${escapeHtml(stepId)}"${stepId === selectedStep ? ' selected' : ''}>
                        ${escapeHtml(STANDARD_ROUTE_STEP_LABELS[stepId] || stepId)}
                    </option>
                `).join('')}
            </select>
        </label>
    `;
}

function readOrderFromForm() {
    return normalizeStandardRouteOrder(STANDARD_ROUTE_STEP_IDS.map((_, index) => (
        document.getElementById(`route-rule-order-${index}`)?.value || ''
    )));
}

function refreshRouteDependentViews() {
    window.renderDashboardTable?.();
    window.updateAdminUserTable?.();
}

export function renderStandardRouteSettingsAdmin() {
    const root = document.getElementById('admin-route-settings-root');
    if (!root) return;

    const settings = getRouteSettings();
    const selectedCampus = document.getElementById('route-rule-campus')?.value || DEFAULT_CAMPUS_ID;
    const selectedGroup = document.getElementById('route-rule-group')?.value || '';
    const selectedOrder = readOrderFromForm();
    const order = selectedOrder.length ? selectedOrder : STANDARD_ROUTE_STEP_IDS;

    root.innerHTML = `
        <div class="admin-route-settings-grid">
            <section class="admin-route-settings-card">
                <h4>表示モード</h4>
                <p>先生・管理者の進捗一覧で、児童の次に取り組む目安として使います。</p>
                <div class="admin-route-mode-row">
                    <select id="standard-route-mode">
                        <option value="${STANDARD_ROUTE_MODE_STANDARD}"${settings.mode === STANDARD_ROUTE_MODE_STANDARD ? ' selected' : ''}>標準ルート</option>
                        <option value="${STANDARD_ROUTE_MODE_CAMPUS_GROUP}"${settings.mode === STANDARD_ROUTE_MODE_CAMPUS_GROUP ? ' selected' : ''}>教室・グループ別おすすめ順</option>
                    </select>
                    <button type="button" class="btn-primary" onclick="saveStandardRouteMode()">保存</button>
                </div>
                <div class="admin-route-current-mode">
                    現在: <strong>${escapeHtml(renderModeLabel(settings.mode))}</strong>
                </div>
            </section>

            <section class="admin-route-settings-card">
                <h4>校舎・グループ別ルート</h4>
                <p>グループを空欄にすると、その校舎全体のおすすめ順として使います。</p>
                <div class="admin-route-rule-form">
                    <label>校舎
                        <select id="route-rule-campus">${renderCampusOptions(selectedCampus)}</select>
                    </label>
                    <label>グループ
                        <select id="route-rule-group">${renderGroupOptions(selectedGroup)}</select>
                    </label>
                    <input id="route-rule-group-custom" type="text" placeholder="新しいグループ名も可" aria-label="グループ名の直接入力">
                    <div class="admin-route-order-editor">
                        ${STANDARD_ROUTE_STEP_IDS.map((_, index) => renderOrderSelect(index, order[index] || STANDARD_ROUTE_STEP_IDS[index])).join('')}
                    </div>
                    <button type="button" class="btn-primary" onclick="saveStandardRouteRule()">この条件で保存</button>
                </div>
            </section>
        </div>

        <section class="admin-route-settings-card admin-route-rules-card">
            <h4>登録済みルート</h4>
            ${settings.rules.length ? `
                <div class="admin-route-rules-table-wrap">
                    <table class="admin-route-rules-table">
                        <thead>
                            <tr>
                                <th>対象</th>
                                <th>おすすめ順</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${settings.rules.map(rule => `
                                <tr>
                                    <td>${escapeHtml(getRuleLabel(rule))}</td>
                                    <td>${escapeHtml(renderOrderText(rule.order))}</td>
                                    <td>
                                        <button type="button" class="btn-secondary" onclick="deleteStandardRouteRule('${escapeJsString(rule.id)}')">削除</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<div class="admin-route-empty">登録済みの校舎・グループ別ルートはありません。</div>'}
        </section>
    `;
}

export async function saveStandardRouteMode() {
    const mode = document.getElementById('standard-route-mode')?.value === STANDARD_ROUTE_MODE_CAMPUS_GROUP
        ? STANDARD_ROUTE_MODE_CAMPUS_GROUP
        : STANDARD_ROUTE_MODE_STANDARD;
    const before = getRouteSettings();
    setRouteSettings({ ...before, mode });

    recordAdminAudit('標準ルート表示モード変更', {
        before: renderModeLabel(before.mode),
        after: renderModeLabel(mode)
    });

    const saved = await saveUsers(true);
    renderStandardRouteSettingsAdmin();
    refreshRouteDependentViews();

    showCustomAlert(saved
        ? '標準ルートの表示モードを保存しました。'
        : '設定は画面上で更新しましたが、クラウド保存が完了していません。通信状態を確認してください。'
    );
}

export async function saveStandardRouteRule() {
    const campusId = document.getElementById('route-rule-campus')?.value || DEFAULT_CAMPUS_ID;
    const customGroup = String(document.getElementById('route-rule-group-custom')?.value || '').trim();
    const group = customGroup || String(document.getElementById('route-rule-group')?.value || '').trim();
    const order = readOrderFromForm();
    const before = getRouteSettings();
    const id = `${campusId || 'all'}::${group || '*'}`;
    const nextRules = before.rules.filter(rule => !(rule.campusId === campusId && rule.group === group));
    nextRules.push({ id, campusId, group, order });
    nextRules.sort((a, b) => getRuleLabel(a).localeCompare(getRuleLabel(b), 'ja'));

    setRouteSettings({
        ...before,
        mode: STANDARD_ROUTE_MODE_CAMPUS_GROUP,
        rules: nextRules
    });

    recordAdminAudit('校舎・グループ別ルート保存', {
        target: getRuleLabel({ campusId, group }),
        order: renderOrderText(order)
    });

    const saved = await saveUsers(true);
    renderStandardRouteSettingsAdmin();
    refreshRouteDependentViews();

    showCustomAlert(saved
        ? '校舎・グループ別ルートを保存しました。'
        : '設定は画面上で更新しましたが、クラウド保存が完了していません。通信状態を確認してください。'
    );
}

export function deleteStandardRouteRule(ruleId) {
    const before = getRouteSettings();
    const target = before.rules.find(rule => rule.id === ruleId);
    if (!target) return;

    showCustomConfirm(`${getRuleLabel(target)} のルート設定を削除しますか？`, async () => {
        setRouteSettings({
            ...before,
            rules: before.rules.filter(rule => rule.id !== ruleId)
        });

        recordAdminAudit('校舎・グループ別ルート削除', {
            target: getRuleLabel(target),
            order: renderOrderText(target.order)
        });

        const saved = await saveUsers(true);
        renderStandardRouteSettingsAdmin();
        refreshRouteDependentViews();

        showCustomAlert(saved
            ? 'ルート設定を削除しました。'
            : '画面上では削除しましたが、クラウド保存が完了していません。通信状態を確認してください。'
        );
    });
}
