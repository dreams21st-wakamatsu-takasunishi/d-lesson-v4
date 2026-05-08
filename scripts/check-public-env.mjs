import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const fileArg = args.find(arg => arg.startsWith('--file='));
const envPath = resolve(fileArg ? fileArg.slice('--file='.length) : '.env.local');
const allowTestTable = args.includes('--allow-test-table');

function parseEnvFile(path) {
    const values = {};
    const content = readFileSync(path, 'utf8');

    content.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) {
            values[`__invalid_line_${index + 1}`] = trimmed;
            return;
        }

        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        values[match[1]] = value;
    });

    return values;
}

function loadEnvValues() {
    if (existsSync(envPath)) {
        return {
            source: envPath,
            values: parseEnvFile(envPath)
        };
    }

    if (fileArg) {
        console.error(`Public env check failed: ${envPath} was not found.`);
        process.exit(1);
    }

    return {
        source: 'process.env',
        values: process.env
    };
}

function isTrue(value) {
    return value === 'true';
}

function isFalseOrEmpty(value) {
    return value === undefined || value === '' || value === 'false';
}

function isIntegerInRange(value, min, max) {
    if (value === undefined || value === '') return true;
    if (!/^\d+$/.test(value)) return false;
    const parsed = Number.parseInt(value, 10);
    return parsed >= min && parsed <= max;
}

function addRequiredSettingChecks(env, failures) {
    if (!env.VITE_SUPABASE_URL) {
        failures.push('VITE_SUPABASE_URL must be set.');
    } else if (!env.VITE_SUPABASE_URL.startsWith('https://')) {
        failures.push('VITE_SUPABASE_URL must start with https://.');
    }

    if (!env.VITE_SUPABASE_PUBLISHABLE_KEY && !env.VITE_SUPABASE_ANON_KEY) {
        failures.push('VITE_SUPABASE_PUBLISHABLE_KEY must be set. VITE_SUPABASE_ANON_KEY is accepted only as a legacy fallback.');
    }

    if (!isTrue(env.VITE_REQUIRE_SUPABASE_AUTH)) {
        failures.push('VITE_REQUIRE_SUPABASE_AUTH must be true on public URLs.');
    }

    if (!isTrue(env.VITE_ENABLE_RLS_CLOUD_SYNC)) {
        failures.push('VITE_ENABLE_RLS_CLOUD_SYNC must be true after RLS verification and before public release.');
    }

    if (!isFalseOrEmpty(env.VITE_ENABLE_LEGACY_SUPABASE_SYNC)) {
        failures.push('VITE_ENABLE_LEGACY_SUPABASE_SYNC must be false on public URLs.');
    }

    if (!isFalseOrEmpty(env.VITE_ALLOW_LEGACY_ADMIN_PASS)) {
        failures.push('VITE_ALLOW_LEGACY_ADMIN_PASS must be false on public URLs.');
    }

    if (env.VITE_LEGACY_ADMIN_PASS) {
        failures.push('VITE_LEGACY_ADMIN_PASS must not be set on public URLs.');
    }

    if (!env.VITE_STUDENT_LOGIN_EMAIL_DOMAIN) {
        failures.push('VITE_STUDENT_LOGIN_EMAIL_DOMAIN must be set so public URLs show the student number login form.');
    } else if (/@|\s/.test(env.VITE_STUDENT_LOGIN_EMAIL_DOMAIN)) {
        failures.push('VITE_STUDENT_LOGIN_EMAIL_DOMAIN must be a domain only, without @ or spaces.');
    }

    if (!isIntegerInRange(env.VITE_STUDENT_IDLE_LOGOUT_MINUTES, 1, 240)) {
        failures.push('VITE_STUDENT_IDLE_LOGOUT_MINUTES must be empty or a number from 1 to 240 on public URLs.');
    }
}

function addTestTableChecks(env, failures, warnings) {
    const tableName = env.VITE_SUPABASE_TABLE || '';
    const usesTestTable = isTrue(env.VITE_SUPABASE_USE_TEST_TABLE) || tableName === 'test_user_data';

    if (!usesTestTable) return;

    const message = 'This environment still points at test_user_data. That is OK for public test verification, but switch to user_data before real student data.';
    if (allowTestTable) warnings.push(message);
    else failures.push(`${message} Use --allow-test-table only for test publication checks.`);
}

function main() {
    const failures = [];
    const warnings = [];

    const { source, values: env } = loadEnvValues();
    const invalidLines = Object.keys(env).filter(key => key.startsWith('__invalid_line_'));
    invalidLines.forEach(key => failures.push(`Invalid env line: ${key.replace('__invalid_line_', '')}`));

    addRequiredSettingChecks(env, failures);
    addTestTableChecks(env, failures, warnings);

    if (warnings.length > 0) {
        console.warn('Public env warnings:');
        warnings.forEach(warning => console.warn(`- ${warning}`));
    }

    if (failures.length > 0) {
        console.error('Public env check failed:');
        failures.forEach(failure => console.error(`- ${failure}`));
        process.exit(1);
    }

    console.log(`Public env check passed: ${source}`);
}

main();
