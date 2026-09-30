export type LearningIdentity = {
  sourceProjectRef: string; dataTable: string; studentId: string;
  campusId: string; displayName: string; birthDate: string;
};
export const learningCategories = new Set(['mouse', 'keyboard', 'romaji', 'vision', 'alphabet', 'text', 'word', 'practice', 'rhythm', 'minigame', 'd-challenge', 'external-typing', 'free-time']);
const plain = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit) : '';

export function serviceDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10) : '';
}

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(new Date(value + 'T00:00:00Z').getTime())
    && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}

export function classroomIdentity(studentId: string, data: Record<string, unknown>, sourceProjectRef: string, dataTable: string): LearningIdentity | null {
  const campusId = typeof (data.campusId || data.campus || 'main') === 'string' ? String(data.campusId || data.campus || 'main').trim() : '';
  if (!/^student_[A-Za-z0-9_-]{1,140}$/.test(studentId) || data.isMaster === true || data.isMaster === 'true' || data.isGuest === true || data.isGuest === 'true'
    || data.publicRegistration === true || data.registrationSource === 'public' || data.registration_source === 'public'
    || data.accountType === 'public' || data.accountType === 'guest' || campusId === 'public' || !campusId || campusId.length > 80) return null;
  return { sourceProjectRef, dataTable, studentId, campusId,
    displayName: plain(data.displayName || data.name || data.studentName, 160),
    birthDate: plain(data.birthdate || data.birth, 10) };
}

export function practiceForDate(data: Record<string, unknown>, date: string) {
  const seen = new Set<string>();
  return (Array.isArray(data.practiceLogs) ? data.practiceLogs : [])
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry))
    .filter(entry => learningCategories.has(String(entry.category)) && serviceDate(entry.at) === date)
    .map(entry => ({ id: plain(entry.id, 200), at: plain(entry.at, 50), category: plain(entry.category, 40),
      title: plain(entry.title, 160), detail: plain(entry.detail, 240), amount: plain(entry.amount, 160) }))
    .filter(entry => !!entry.id && !seen.has(entry.id) && !!seen.add(entry.id))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 2000);
}

export async function secretMatches(actual: string, expected: string) {
  if (expected.length < 32) return false;
  const encoder = new TextEncoder();
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(actual)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(expected)));
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}
