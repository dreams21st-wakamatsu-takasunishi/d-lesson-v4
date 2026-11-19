import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const severities = ['info', 'low', 'moderate', 'high', 'critical'];

export function classifyAudit(result, { monitor = false } = {}) {
  let report;
  try { report = JSON.parse(result.stdout); } catch { return { state: 'unavailable' }; }
  const counts = report?.metadata?.vulnerabilities;
  if (!counts || ![...severities, 'total'].every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)
    || severities.reduce((sum, key) => sum + counts[key], 0) !== counts.total) return { state: 'unavailable' };
  // A vulnerability report is never treated as a transient network failure.
  const summary = Object.fromEntries([...severities, 'total'].map(key => [key, counts[key]]));
  if (counts.high || counts.critical || (monitor && counts.total > 0)) return { state: 'vulnerable', counts: summary };
  if (result.status !== 0 || result.error) return { state: 'unavailable' };
  return { state: 'passed', counts: summary };
}

export async function auditDependencies(run, pause, log = console.log, { monitor = false } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const report = classifyAudit(run(), { monitor });
    if (report.state === 'vulnerable') {
      const label = monitor ? 'Dependency warnings require review' : 'Security audit found High/Critical vulnerabilities';
      throw Error(label + ': ' + JSON.stringify(report.counts));
    }
    if (report.state === 'passed') { log(JSON.stringify({ audit: 'passed', attempt, vulnerabilities: report.counts })); return report; }
    log('Security audit unavailable (attempt ' + attempt + '/3). No safety result has been assumed.');
    if (attempt < 3) await pause(3000);
  }
  throw Error('Security audit unavailable after 3 attempts. ' + (monitor ? 'Check could not be completed; retry from Actions.' : 'Release remains blocked.'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const monitor = process.argv.includes('--monitor');
  const args = ['audit', '--json', '--include=dev', '--audit-level=' + (monitor ? 'info' : 'high'), '--fetch-timeout=20000', '--fetch-retries=0'];
  if (monitor) args.push('--package-lock-only');
  const run = () => process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', '& npm.cmd ' + args.join(' ')], { encoding: 'utf8', timeout: 30000, maxBuffer: 8388608 })
    : spawnSync('npm', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 8388608 });
  try { await auditDependencies(run, ms => new Promise(resolve => setTimeout(resolve, ms)), console.log, { monitor }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
