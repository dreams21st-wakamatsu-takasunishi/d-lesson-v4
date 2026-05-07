#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    mapping: '',
    output: '',
    domain: '',
    prefix: 'dlesson-student-',
    pad: 3,
    start: 1,
    passcodeLength: 6,
    force: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mapping' || arg === '-m') args.mapping = argv[++i] || '';
    else if (arg === '--output' || arg === '-o') args.output = argv[++i] || '';
    else if (arg === '--domain' || arg === '-d') args.domain = (argv[++i] || '').replace(/^@/, '');
    else if (arg === '--prefix') args.prefix = argv[++i] || '';
    else if (arg === '--pad') args.pad = parseInteger(argv[++i], 3, 1, 8);
    else if (arg === '--start') args.start = parseInteger(argv[++i], 1, 1, 999);
    else if (arg === '--passcode-length') args.passcodeLength = parseInteger(argv[++i], 6, 6, 16);
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  npm.cmd run build:student-login-csv -- --mapping .\\migration\\legacy-user-map.csv --domain example.com --output .\\migration\\student-login-accounts.csv',
    '',
    'Options:',
    '  --mapping, -m          legacy-user-map.csv from convert:legacy-users',
    '  --domain, -d           Email domain used for hidden student auth accounts',
    '  --output, -o           CSV output path inside migration/',
    '  --prefix              Email local-part prefix. Default: dlesson-student-',
    '  --pad                 Zero padding for student number. Default: 3',
    '  --start               First student number. Default: 1',
    '  --passcode-length     Numeric passcode length. Default: 6',
    '  --force               Overwrite an existing output file',
    '  --help, -h             Show this help',
    '',
    'Output columns:',
    '  student_number,display_name,new_user_data_id,email,password,auth_user_id'
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
  if (['group'].includes(value)) return 'group';
  if (['birthdate', 'birth'].includes(value)) return 'birthdate';
  if (['status'].includes(value)) return 'status';
  return value;
}

function parseCsv(text) {
  const lines = stripBom(text).split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map(normalizeKey);
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] || '').trim();
    });
    return row;
  });
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
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
      displayName: row.display_name || row.old_id || row.new_user_data_id,
      group: row.group || '',
      birthdate: row.birthdate || ''
    }));
}

function generateNumericPasscode(length) {
  for (let attempts = 0; attempts < 100; attempts += 1) {
    const value = Array.from({ length }, () => crypto.randomInt(0, 10)).join('');
    if (/^(\d)\1+$/.test(value)) continue;
    if ('01234567890123456789'.includes(value)) continue;
    if ('98765432109876543210'.includes(value)) continue;
    return value;
  }
  return Array.from({ length }, () => crypto.randomInt(0, 10)).join('');
}

function buildEmail({ number, domain, prefix, pad }) {
  return `${prefix}${String(number).padStart(pad, '0')}@${domain}`;
}

function buildLoginCsv(mappings, args) {
  const header = [
    'student_number',
    'display_name',
    'new_user_data_id',
    'email',
    'password',
    'auth_user_id'
  ];

  const rows = mappings.map((mapping, index) => {
    const number = args.start + index;
    return [
      number,
      mapping.displayName,
      mapping.userDataId,
      buildEmail({ number, domain: args.domain, prefix: args.prefix, pad: args.pad }),
      generateNumericPasscode(args.passcodeLength),
      ''
    ];
  });

  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
}

async function writeFile(filePath, content, force) {
  const resolved = path.resolve(filePath);
  if (!force && fs.existsSync(resolved)) {
    throw new Error(`Output already exists. Use --force to overwrite: ${resolved}`);
  }
  await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
  await fs.promises.writeFile(resolved, content, 'utf8');
  return resolved;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.mapping) throw new Error('Missing --mapping.');
  if (!args.domain) throw new Error('Missing --domain.');
  if (!args.output) throw new Error('Missing --output.');

  const mappingRows = parseCsv(await fs.promises.readFile(path.resolve(args.mapping), 'utf8'));
  const mappings = getStudentMappings(mappingRows);
  if (mappings.length === 0) throw new Error('No student mappings found.');

  const csv = buildLoginCsv(mappings, args);
  const outputPath = await writeFile(args.output, `\uFEFF${csv}\n`, args.force);

  console.log(`Wrote student login CSV: ${outputPath}`);
  console.log(`Student rows: ${mappings.length}`);
  console.log(`Student number range: ${args.start}-${args.start + mappings.length - 1}`);
  console.log('');
  console.log('Keep this CSV out of Git. It contains student login passcodes.');
  console.log('After creating Supabase Auth users, fill auth_user_id and run build:student-access-sql.');
}

main().catch(err => {
  console.error(err.message);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
