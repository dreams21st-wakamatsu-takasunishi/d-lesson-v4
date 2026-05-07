#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SYSTEM_USER_IDS = new Set([
  '__GLOBAL_SETTINGS__',
  'Master_Debug',
  '__admin__',
  '__teacher__'
]);

function parseArgs(argv) {
  const args = {
    input: '',
    allowLegacyIds: false,
    showDetails: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input' || arg === '-i') args.input = argv[++i] || '';
    else if (arg === '--allow-legacy-ids') args.allowLegacyIds = true;
    else if (arg === '--show-details') args.showDetails = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  npm.cmd run check:converted-users -- --input .\\migration\\converted-users.json',
    '',
    'Options:',
    '  --input, -i          Converted D Lesson JSON backup or users object',
    '  --allow-legacy-ids   Do not fail on non-student_ IDs',
    '  --show-details       Print affected internal IDs. Display names are not printed.',
    '  --help, -h           Show this help'
  ].join('\n');
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

function isSystemUserId(userId) {
  return SYSTEM_USER_IDS.has(userId);
}

function getDisplayName(data, userId) {
  return String(data?.displayName || data?.name || data?.studentName || userId || '').trim();
}

function inspectUsers(users) {
  const ids = Object.keys(users);
  const studentIds = ids.filter(userId => !isSystemUserId(userId));
  const invalidRows = studentIds.filter(userId => {
    const row = users[userId];
    return !row || typeof row !== 'object' || Array.isArray(row);
  });

  const validStudentIds = studentIds.filter(userId => !invalidRows.includes(userId));
  const legacyStudentIds = validStudentIds.filter(userId => !userId.startsWith('student_'));
  const missingDisplayName = validStudentIds.filter(userId => !getDisplayName(users[userId], ''));
  const mismatchedUserDataId = validStudentIds.filter(userId => users[userId]?.userDataId !== userId);

  const displayNameToIds = new Map();
  validStudentIds.forEach(userId => {
    const displayName = getDisplayName(users[userId], userId);
    if (!displayNameToIds.has(displayName)) displayNameToIds.set(displayName, []);
    displayNameToIds.get(displayName).push(userId);
  });
  const duplicateDisplayNames = Array.from(displayNameToIds.values())
    .filter(userIds => userIds.length > 1)
    .flat();

  return {
    totalRows: ids.length,
    studentRows: studentIds.length,
    systemRows: ids.length - studentIds.length,
    invalidRows,
    legacyStudentIds,
    missingDisplayName,
    mismatchedUserDataId,
    duplicateDisplayNames
  };
}

function formatList(label, values, showDetails) {
  if (values.length === 0) return `- ${label}: 0`;
  const detail = showDetails ? ` (${values.join(', ')})` : '';
  return `- ${label}: ${values.length}${detail}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.input) throw new Error('Missing --input.');

  const inputPath = path.resolve(args.input);
  let parsed = JSON.parse((await fs.promises.readFile(inputPath, 'utf8')).replace(/^\uFEFF/, ''));
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);

  const users = getUsersObject(parsed);
  const report = inspectUsers(users);
  const failures = [];

  if (report.invalidRows.length > 0) failures.push('invalid rows');
  if (!args.allowLegacyIds && report.legacyStudentIds.length > 0) failures.push('legacy student IDs');
  if (report.missingDisplayName.length > 0) failures.push('missing displayName');
  if (report.mismatchedUserDataId.length > 0) failures.push('mismatched userDataId');
  if (report.duplicateDisplayNames.length > 0) failures.push('duplicate display names');

  const lines = [
    `Total rows: ${report.totalRows}`,
    `Student rows: ${report.studentRows}`,
    `System rows: ${report.systemRows}`,
    formatList('Invalid rows', report.invalidRows, args.showDetails),
    formatList('Legacy student IDs', report.legacyStudentIds, args.showDetails),
    formatList('Missing displayName', report.missingDisplayName, args.showDetails),
    formatList('Mismatched userDataId', report.mismatchedUserDataId, args.showDetails),
    formatList('Duplicate display names', report.duplicateDisplayNames, args.showDetails)
  ];

  if (failures.length > 0) {
    console.error('Converted user backup check failed:');
    lines.forEach(line => console.error(line));
    process.exitCode = 1;
    return;
  }

  console.log('Converted user backup check passed:');
  lines.forEach(line => console.log(line));
}

main().catch(err => {
  console.error(err.message);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
