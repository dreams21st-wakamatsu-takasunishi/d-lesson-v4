#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sanitizeGlobalMistakes } from '../src/utils/weak-mistakes.js';

const SYSTEM_USER_IDS = new Set([
  '__GLOBAL_SETTINGS__',
  'Master_Debug',
  '__admin__',
  '__teacher__'
]);

function parseArgs(argv) {
  const args = {
    input: '',
    output: '',
    mapping: '',
    keepMasterRows: false,
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' || arg === '-i') args.input = argv[++i] || '';
    else if (arg === '--output' || arg === '-o') args.output = argv[++i] || '';
    else if (arg === '--mapping' || arg === '-m') args.mapping = argv[++i] || '';
    else if (arg === '--keep-master-rows') args.keepMasterRows = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  npm.cmd run convert:legacy-users -- --input legacy-users.json --output converted-users.json --mapping legacy-user-map.csv',
    '',
    'Options:',
    '  --input, -i              Legacy D Lesson JSON backup or users object',
    '  --output, -o             Converted JSON output path',
    '  --mapping, -m            CSV path for old ID to new user_data_id mapping',
    '  --keep-master-rows       Keep old isMaster rows instead of skipping them',
    '  --dry-run                Print summary without writing files',
    '  --help, -h               Show this help'
  ].join('\n');
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function createUserDataId() {
  return `student_${randomUUID()}`;
}

function getUsersObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Input JSON must be an object.');
  }
  const users = input.users || input;
  if (!users || typeof users !== 'object' || Array.isArray(users)) {
    throw new Error('Input JSON must contain a users object or be a users object.');
  }
  return users;
}

function isInternalStudentId(id) {
  return /^student_[0-9a-f-]{10,}$/i.test(id);
}

function normalizeStudentData(oldId, newId, source) {
  const data = { ...toObject(source) };
  const displayName = String(data.displayName || data.name || data.studentName || oldId).trim() || oldId;

  delete data.isMaster;
  delete data.name;
  delete data.studentName;

  return {
    ...data,
    displayName,
    userDataId: newId,
    mouseLevel: toNumber(data.mouseLevel),
    keyboardSequence: toNumber(data.keyboardSequence),
    birthdate: data.birthdate || data.birth || '',
    theme: data.theme || 'default',
    examRecords: toObject(data.examRecords),
    globalMistakes: sanitizeGlobalMistakes(data.globalMistakes),
    loginStamps: toArray(data.loginStamps),
    minigameHighscore: toNumber(data.minigameHighscore),
    coins: toNumber(data.coins),
    items: toArray(data.items),
    tickets: toArray(data.tickets),
    activeEffect: data.activeEffect || 'default',
    activeBGM: data.activeBGM || 'default',
    textRecords: toObject(data.textRecords),
    textTasks: toArray(data.textTasks),
    group: data.group || '',
    visionCleared: toArray(data.visionCleared),
    dChallengeHighscore: toNumber(data.dChallengeHighscore),
    ticketHistory: toArray(data.ticketHistory),
    currentWeakKeys: toArray(data.currentWeakKeys),
    wordProgress: toObject(data.wordProgress),
    practiceLogs: toArray(data.practiceLogs)
  };
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildMappingCsv(rows) {
  const header = [
    'old_id',
    'new_user_data_id',
    'display_name',
    'group',
    'birthdate',
    'status',
    'note'
  ];
  return [
    header.map(csvCell).join(','),
    ...rows.map(row => header.map(key => csvCell(row[key])).join(','))
  ].join('\n');
}

export function convertLegacyUsers(input, options = {}) {
  const sourceUsers = getUsersObject(input);
  const convertedUsers = {};
  const mappingRows = [];
  const warnings = [];
  const summary = {
    convertedStudents: 0,
    keptSystemRows: 0,
    skippedMasterRows: 0,
    skippedInvalidRows: 0
  };

  Object.entries(sourceUsers).forEach(([oldId, source]) => {
    if (!oldId) return;

    if (SYSTEM_USER_IDS.has(oldId)) {
      convertedUsers[oldId] = source;
      summary.keptSystemRows += 1;
      mappingRows.push({
        old_id: oldId,
        new_user_data_id: oldId,
        display_name: oldId,
        group: '',
        birthdate: '',
        status: 'kept_system',
        note: ''
      });
      return;
    }

    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      summary.skippedInvalidRows += 1;
      mappingRows.push({
        old_id: oldId,
        new_user_data_id: '',
        display_name: oldId,
        group: '',
        birthdate: '',
        status: 'skipped_invalid',
        note: 'row data was not an object'
      });
      return;
    }

    if (source.isMaster && !options.keepMasterRows) {
      summary.skippedMasterRows += 1;
      mappingRows.push({
        old_id: oldId,
        new_user_data_id: '',
        display_name: oldId,
        group: source.group || '',
        birthdate: source.birthdate || source.birth || '',
        status: 'skipped_master',
        note: 'legacy master row is replaced by Supabase Auth admin role'
      });
      return;
    }

    const newId = isInternalStudentId(oldId) ? oldId : createUserDataId();
    const data = normalizeStudentData(oldId, newId, source);
    convertedUsers[newId] = data;
    summary.convertedStudents += 1;
    mappingRows.push({
      old_id: oldId,
      new_user_data_id: newId,
      display_name: data.displayName,
      group: data.group,
      birthdate: data.birthdate,
      status: newId === oldId ? 'kept_internal_id' : 'converted',
      note: ''
    });
  });

  const seenNames = new Map();
  mappingRows
    .filter(row => row.status === 'converted' || row.status === 'kept_internal_id')
    .forEach(row => {
      const previous = seenNames.get(row.display_name);
      if (previous) {
        warnings.push(`Duplicate display name: "${row.display_name}" (${previous} / ${row.new_user_data_id})`);
      } else {
        seenNames.set(row.display_name, row.new_user_data_id);
      }
    });

  return {
    users: convertedUsers,
    mappingRows,
    mappingCsv: buildMappingCsv(mappingRows),
    warnings,
    summary
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.input) throw new Error('Missing --input.');
  if (!args.dryRun && !args.output) throw new Error('Missing --output.');

  const inputPath = path.resolve(args.input);
  const raw = await fs.promises.readFile(inputPath, 'utf8');
  let parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed);
  }
  const result = convertLegacyUsers(parsed, { keepMasterRows: args.keepMasterRows });

  console.log(`Converted students: ${result.summary.convertedStudents}`);
  console.log(`Kept system rows: ${result.summary.keptSystemRows}`);
  console.log(`Skipped master rows: ${result.summary.skippedMasterRows}`);
  console.log(`Skipped invalid rows: ${result.summary.skippedInvalidRows}`);
  result.warnings.forEach(warning => console.warn(`Warning: ${warning}`));

  if (args.dryRun) return;

  const outputPath = path.resolve(args.output);
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, JSON.stringify({
    app: 'd-lesson',
    version: 4,
    migratedFrom: 'legacy-d-lesson',
    exportedAt: new Date().toISOString(),
    users: result.users
  }, null, 2), 'utf8');
  console.log(`Wrote converted backup: ${outputPath}`);

  if (args.mapping) {
    const mappingPath = path.resolve(args.mapping);
    await fs.promises.mkdir(path.dirname(mappingPath), { recursive: true });
    await fs.promises.writeFile(mappingPath, `\uFEFF${result.mappingCsv}\n`, 'utf8');
    console.log(`Wrote mapping CSV: ${mappingPath}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(err => {
    console.error(err.message);
    console.error('');
    console.error(usage());
    process.exitCode = 1;
  });
}
