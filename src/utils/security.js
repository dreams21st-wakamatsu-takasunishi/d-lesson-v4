const env = import.meta.env || {};

const LEGACY_ADMIN_PASS = env.VITE_LEGACY_ADMIN_PASS || '';

export function verifyLegacyAdminPass(pass) {
    return Boolean(LEGACY_ADMIN_PASS) && pass === LEGACY_ADMIN_PASS;
}
