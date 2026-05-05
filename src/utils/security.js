const IS_PRODUCTION_BUILD = import.meta.env.PROD === true || import.meta.env.MODE === 'production';
const ALLOW_LEGACY_ADMIN_PASS = import.meta.env.VITE_ALLOW_LEGACY_ADMIN_PASS === 'true';
const REQUIRE_SUPABASE_AUTH = import.meta.env.VITE_REQUIRE_SUPABASE_AUTH === 'true';
const LEGACY_ADMIN_PASS = IS_PRODUCTION_BUILD ? '' : (import.meta.env.VITE_LEGACY_ADMIN_PASS || '');

function canUseLegacyAdminPass() {
    return Boolean(LEGACY_ADMIN_PASS)
        && ALLOW_LEGACY_ADMIN_PASS
        && !REQUIRE_SUPABASE_AUTH
        && !IS_PRODUCTION_BUILD;
}

export function hasLegacyAdminPass() {
    return canUseLegacyAdminPass();
}

export function verifyLegacyAdminPass(pass) {
    return canUseLegacyAdminPass() && pass === LEGACY_ADMIN_PASS;
}

export function getLegacyAdminPassStatus() {
    if (!LEGACY_ADMIN_PASS) return '未設定';
    if (IS_PRODUCTION_BUILD) return '本番ビルドでは無効';
    if (REQUIRE_SUPABASE_AUTH) return 'Auth必須のため無効';
    if (!ALLOW_LEGACY_ADMIN_PASS) return '許可フラグなし';
    return 'ローカルのみ有効';
}
