#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseArgs(argv) {
  const args = {
    mapping: '',
    auth: '',
    output: '',
    templateOutput: ''
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mapping' || arg === '-m') args.mapping = argv[++i] || '';
    else if (arg === '--auth' || arg === '-a') args.auth = argv[++i] || '';
    else if (arg === '--output' || arg === '-o') args.output = argv[++i] || '';
    else if (arg === '--template-output' || arg === '-t') args.templateOutput = argv[++i] || '';
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  npm.cmd run build:student-access-sql -- --mapping .\\migration\\legacy-user-map.csv --template-output .\\migration\\student-auth-users-template.csv',
    '  npm.cmd run build:student-access-sql -- --mapping .\\migration\\legacy-user-map.csv --auth .\\migration\\student-auth-users.csv --output .\\migration\\student-access.sql',
    '',
    'Auth CSV columns:',
    '  display_name,auth_user_id,email',
    '  or new_user_data_id,auth_user_id,email',
    '  or old_id,auth_user_id,email',
    '',
    'Options:',
    '  --mapping, -m           legacy-user-map.csv from convert:legacy-users',
    '  --template-output, -t   Write a fill-in CSV template for Auth User IDs',
    '  --auth, -a              Filled CSV with Auth User IDs',
    '  --output, -o            SQL output path',
    '  --help, -h              Show this help'
  ].join('\n');
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

function normalizeKey(key) {
  const value = String(key || '').trim().toLowerCase();
  if (['new_user_data_id', 'user_data_id', 'userdataid', 'student_id'].includes(value)) return 'new_user_data_id';
  if (['display_name', 'displayname', 'name', 'student_name', '名前'].includes(value)) return 'display_name';
  if (['auth_user_id', 'authuserid', 'auth_id', 'uuid'].includes(value)) return 'auth_user_id';
  if (['old_id', 'legacy_id', 'legacy_name'].includes(value)) return 'old_id';
  if (['email', 'mail'].includes(value)) return 'email';
  if (['status'].includes(value)) return 'status';
  return value;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function sqlString(value) {
  return String(value || '').replace(/'/g, "''");
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

function buildAuthTemplateCsv(mappings) {
  const header = ['display_name', 'new_user_data_id', 'auth_user_id', 'email'];
  const rows = mappings.map(row => [
    row.displayName,
    row.userDataId,
    '',
    ''
  ]);
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
}

function createMappingIndexes(mappings) {
  const byUserDataId = new Map();
  const byOldId = new Map();
  const byDisplayName = new Map();
  mappings.forEach(row => {
    byUserDataId.set(row.userDataId, row);
    if (row.oldId) byOldId.set(row.oldId, row);
    if (row.displayName) byDisplayName.set(row.displayName, row);
  });
  return { byUserDataId, byOldId, byDisplayName };
}

function findMappingForAuthRow(authRow, indexes) {
  if (authRow.new_user_data_id && indexes.byUserDataId.has(authRow.new_user_data_id)) {
    return indexes.byUserDataId.get(authRow.new_user_data_id);
  }
  if (authRow.old_id && indexes.byOldId.has(authRow.old_id)) {
    return indexes.byOldId.get(authRow.old_id);
  }
  if (authRow.display_name && indexes.byDisplayName.has(authRow.display_name)) {
    return indexes.byDisplayName.get(authRow.display_name);
  }
  return null;
}

function buildStudentAccessSql(mappings, authRows) {
  const indexes = createMappingIndexes(mappings);
  const matchedRows = [];
  const unmatchedRows = [];
  const invalidAuthRows = [];
  const seenPairs = new Set();

  authRows.forEach((authRow, index) => {
    const authUserId = authRow.auth_user_id || '';
    const mapping = findMappingForAuthRow(authRow, indexes);
    if (!mapping) {
      unmatchedRows.push({ index: index + 2, authRow });
      return;
    }
    if (!UUID_PATTERN.test(authUserId)) {
      invalidAuthRows.push({ index: index + 2, authRow, mapping });
      return;
    }
    const pairKey = `${authUserId}:${mapping.userDataId}`;
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);
    matchedRows.push({
      authUserId,
      userDataId: mapping.userDataId,
      displayName: mapping.displayName,
      email: authRow.email || ''
    });
  });

  if (unmatchedRows.length > 0 || invalidAuthRows.length > 0) {
    const details = [];
    if (unmatchedRows.length > 0) details.push(`Unmatched auth rows: ${unmatchedRows.map(row => row.index).join(', ')}`);
    if (invalidAuthRows.length > 0) details.push(`Invalid Auth User IDs: ${invalidAuthRows.map(row => row.index).join(', ')}`);
    throw new Error(details.join('\n'));
  }
  if (matchedRows.length === 0) {
    throw new Error('No student access rows were generated.');
  }

  const values = matchedRows.map(row => (
    `  ('${sqlString(row.authUserId)}', '${sqlString(row.userDataId)}', 'student', 'all', '')`
  ));
  const userDataIdList = matchedRows.map(row => `  '${sqlString(row.userDataId)}'`).join(',\n');

  return [
    '-- Generated by npm.cmd run build:student-access-sql.',
    '-- Review the row count before running this in Supabase SQL Editor.',
    '',
    'begin;',
    '',
    'insert into public.lesson_user_access (auth_user_id, user_data_id, role, scope_type, scope_value)',
    'values',
    `${values.join(',\n')}`,
    'on conflict (auth_user_id, user_data_id) do update',
    'set role = excluded.role,',
    '    scope_type = excluded.scope_type,',
    '    scope_value = excluded.scope_value;',
    '',
    'select',
    '  access.auth_user_id,',
    '  auth_users.email,',
    '  access.user_data_id,',
    '  access.role,',
    '  access.scope_type,',
    '  access.scope_value',
    'from public.lesson_user_access access',
    'left join auth.users auth_users on auth_users.id = access.auth_user_id',
    'where access.user_data_id in (',
    userDataIdList,
    ')',
    'order by access.user_data_id;',
    '',
    'commit;',
    ''
  ].join('\n');
}

async function writeFile(filePath, content) {
  const resolved = path.resolve(filePath);
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
  if (!args.templateOutput && (!args.auth || !args.output)) {
    throw new Error('Provide --template-output, or provide both --auth and --output.');
  }

  const mappingRows = parseCsv(await fs.promises.readFile(path.resolve(args.mapping), 'utf8'));
  const mappings = getStudentMappings(mappingRows);
  if (mappings.length === 0) throw new Error('No student mappings found.');

  if (args.templateOutput) {
    const templatePath = await writeFile(args.templateOutput, `\uFEFF${buildAuthTemplateCsv(mappings)}\n`);
    console.log(`Wrote Auth User ID template: ${templatePath}`);
    console.log(`Template student rows: ${mappings.length}`);
  }

  if (args.auth && args.output) {
    const authRows = parseCsv(await fs.promises.readFile(path.resolve(args.auth), 'utf8'));
    const sql = buildStudentAccessSql(mappings, authRows);
    const outputPath = await writeFile(args.output, sql);
    console.log(`Wrote student access SQL: ${outputPath}`);
    console.log(`Generated access rows: ${(sql.match(/\('.*?', 'student_/g) || []).length}`);
  }
}

main().catch(err => {
  console.error(err.message);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
