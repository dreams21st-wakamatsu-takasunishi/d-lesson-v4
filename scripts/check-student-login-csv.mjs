#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseArgs(argv) {
  const args = {
    mapping: '',
    input: '',
    domain: '',
    prefix: 'dlesson-student-',
    pad: 3,
    passcodeLength: 6,
    requireAuthUserId: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mapping' || arg === '-m') args.mapping = argv[++i] || '';
    else if (arg === '--input' || arg === '-i') args.input = argv[++i] || '';
    else if (arg === '--domain' || arg === '-d') args.domain = (argv[++i] || '').replace(/^@/, '');
    else if (arg === '--prefix') args.prefix = argv[++i] || '';
    else if (arg === '--pad') args.pad = parseInteger(argv[++i], 3, 1, 8);
    else if (arg === '--passcode-length') args.passcodeLength = parseInteger(argv[++i], 6, 6, 16);
    else if (arg === '--require-auth-user-id') args.requireAuthUserId = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  npm.cmd run check:student-login-csv -- --mapping .\\migration\\legacy-user-map.csv --input .\\migration\\student-login-accounts.csv --domain example.com',
    '  npm.cmd run check:student-login-csv -- --mapping .\\migration\\legacy-user-map.csv --input .\\migration\\student-login-accounts.csv --domain example.com --require-auth-user-id',
    '',
    'Options:',
    '  --mapping, -m             legacy-user-map.csv from convert:legacy-users',
    '  --input, -i               student-login-accounts.csv from build:student-login-csv',
    '  --domain, -d              Expected hidden student auth email domain',
    '  --prefix                 Expected email local-part prefix. Default: dlesson-student-',
    '  --pad                    Expected zero padding for student number. Default: 3',
    '  --passcode-length        Minimum numeric passcode length. Default: 6',
    '  --require-auth-user-id   Require every row to have a valid Auth User ID',
    '  --help, -h                Show this help'
  ].join('\n');
}

function parseInteger(value, fallback, min, max) {
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
  if (['new_user_data_id', 'user_data_id', 'userdataid', 'student_id'].includes(value)) return 'new_user_data_id';
  if (['display_name', 'displayname', 'name', 'student_name'].includes(value)) return 'display_name';
  if (['old_id', 'legacy_id', 'legacy_name'].includes(value)) return 'old_id';
  if (['student_number', 'number', 'no'].includes(value)) return 'student_number';
  if (['email', 'mail'].includes(value)) return 'email';
  if (['password', 'passcode'].includes(value)) return 'password';
  if (['auth_user_id', 'authuserid', 'auth_id', 'uuid'].includes(value)) return 'auth_user_id';
  if (['status'].includes(value)) return 'status';
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

function getStudentMappings(rows) {
  return rows
    .filter(row => {
      const id = row.new_user_data_id || '';
      const status = row.status || '';
      return id.startsWith('student_') && !/^skipped_/i.test(status);
    })
    .map(row => ({
      oldId: row.old_id || '',
      userDataId: row.new_user_data_id,
      displayName: row.display_name || row.old_id || row.new_user_data_id
    }));
}

function expectedEmail(row, args) {
  if (!args.domain) return '';
  const number = Number.parseInt(row.student_number, 10);
  if (!Number.isFinite(number)) return '';
  return `${args.prefix}${String(number).padStart(args.pad, '0')}@${args.domain}`;
}

function isWeakPasscode(value, minLength) {
  if (!new RegExp(`^\\d{${minLength},}$`).test(value)) return true;
  if (/^(\d)\1+$/.test(value)) return true;
  if ('01234567890123456789'.includes(value)) return true;
  if ('98765432109876543210'.includes(value)) return true;
  return false;
}

function addDuplicateErrors(rows, key, label, errors) {
  const seen = new Map();
  rows.forEach(row => {
    const value = row[key] || '';
    if (!value) return;
    if (!seen.has(value)) {
      seen.set(value, row.__line);
      return;
    }
    errors.push(`${label} is duplicated: "${value}" at lines ${seen.get(value)} and ${row.__line}.`);
  });
}

function validate(mappingRows, loginRows, args) {
  const errors = [];
  const warnings = [];
  const mappings = getStudentMappings(mappingRows);
  const mappingById = new Map(mappings.map(row => [row.userDataId, row]));

  if (mappings.length === 0) errors.push('No student mappings found.');
  if (loginRows.length === 0) errors.push('No login rows found.');
  if (mappings.length !== loginRows.length) {
    errors.push(`Row count mismatch: mapping has ${mappings.length}, login CSV has ${loginRows.length}.`);
  }

  addDuplicateErrors(loginRows, 'student_number', 'student_number', errors);
  addDuplicateErrors(loginRows, 'new_user_data_id', 'new_user_data_id', errors);
  addDuplicateErrors(loginRows, 'email', 'email', errors);
  addDuplicateErrors(loginRows, 'auth_user_id', 'auth_user_id', errors);

  loginRows.forEach(row => {
    const mapping = mappingById.get(row.new_user_data_id || '');
    const number = Number.parseInt(row.student_number, 10);

    if (!Number.isFinite(number) || number < 1) {
      errors.push(`Line ${row.__line}: student_number must be a positive number.`);
    }

    if (!row.new_user_data_id || !mapping) {
      errors.push(`Line ${row.__line}: new_user_data_id is not found in mapping: "${row.new_user_data_id || ''}".`);
    } else if (row.display_name && mapping.displayName && row.display_name !== mapping.displayName) {
      warnings.push(`Line ${row.__line}: display_name differs from mapping for ${row.new_user_data_id}.`);
    }

    if (!row.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) {
      errors.push(`Line ${row.__line}: email is missing or invalid.`);
    }

    const expected = expectedEmail(row, args);
    if (expected && row.email !== expected) {
      errors.push(`Line ${row.__line}: email should be "${expected}" for student_number ${row.student_number}.`);
    }

    if (isWeakPasscode(row.password || '', args.passcodeLength)) {
      errors.push(`Line ${row.__line}: password must be numeric, at least ${args.passcodeLength} digits, and not a simple repeated/sequential value.`);
    }

    if (args.requireAuthUserId && !row.auth_user_id) {
      errors.push(`Line ${row.__line}: auth_user_id is required.`);
    }
    if (row.auth_user_id && !UUID_PATTERN.test(row.auth_user_id)) {
      errors.push(`Line ${row.__line}: auth_user_id is not a valid UUID.`);
    }
  });

  const loginIds = new Set(loginRows.map(row => row.new_user_data_id).filter(Boolean));
  const missingIds = mappings.map(row => row.userDataId).filter(userDataId => !loginIds.has(userDataId));
  if (missingIds.length > 0) {
    errors.push(`Login CSV is missing mapped user_data_id rows: ${missingIds.slice(0, 8).join(', ')}${missingIds.length > 8 ? '...' : ''}`);
  }

  return { errors, warnings, mappings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.mapping) throw new Error('Missing --mapping.');
  if (!args.input) throw new Error('Missing --input.');

  const mappingRows = parseCsv(await fs.promises.readFile(path.resolve(args.mapping), 'utf8'));
  const loginRows = parseCsv(await fs.promises.readFile(path.resolve(args.input), 'utf8'));
  const { errors, warnings, mappings } = validate(mappingRows, loginRows, args);

  if (errors.length > 0) {
    console.error('Student login CSV check failed:');
    errors.forEach(error => console.error(`- ${error}`));
    if (warnings.length > 0) {
      console.error('');
      console.error('Warnings:');
      warnings.forEach(warning => console.error(`- ${warning}`));
    }
    process.exitCode = 1;
    return;
  }

  console.log('Student login CSV check passed.');
  console.log(`Student rows: ${loginRows.length}`);
  console.log(`Mapped students: ${mappings.length}`);
  if (args.requireAuthUserId) console.log('Auth User IDs: complete');
  if (warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    warnings.forEach(warning => console.log(`- ${warning}`));
  }
}

main().catch(err => {
  console.error(err.message);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
