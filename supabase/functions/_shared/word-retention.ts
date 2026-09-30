export const preparedLifetimeMs = 2 * 60 * 60 * 1000;
export const pendingLifetimeMs = 30 * 24 * 60 * 60 * 1000;
export const artifactLifetimeMs = 90 * 24 * 60 * 60 * 1000;
export function artifactDue(row: Record<string, unknown>, now: number) {
  if (row.artifact_deleted_at || row.status === 'pending' || row.status === 'prepared') return false;
  if (row.status === 'expired' && !row.submitted_at) return true;
  const at = Date.parse(String(row.reviewed_at || row.submitted_at || row.created_at));
  return Number.isFinite(at) && now - at >= artifactLifetimeMs;
}
