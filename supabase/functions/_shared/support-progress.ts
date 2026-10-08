import { STAGE_ORDER, VISION_STAGES, WORD_STAGES } from '../../../src/data/constants.js';
import { getActiveKeyboardStageIds, getCompletedActiveKeyboardStageIds, getRecommendedKeyboardStage } from '../../../src/utils/keyboard-progression.js';
import { getStageName } from '../../../src/utils/stages.js';
import { classroomIdentity, learningCategories, practiceForDate, serviceDate } from './support-learning.ts';

type Data = Record<string, unknown>;
type Stage = { id: string; title: string; status: 'cleared' | 'current' | 'pending' | 'unknown'; bestSeconds: number | null };
const object = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const integer = (value: unknown, max: number): number | null => {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && number >= 0 && number <= max ? number : null;
};
const timestamp = (value: unknown) => typeof value === 'string' && value.length <= 50 && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const seconds = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 86400 ? value : null;

// Export only curriculum fields, never the original user JSON or Auth credentials.
export function projectProgress(data: Data) {
  const exams = object(data.examRecords);
  const mouse = integer(data.mouseLevel, 7);
  const sequence = integer(data.keyboardSequence, STAGE_ORDER.length);
  const completedKeyboard = new Set(sequence === null ? [] : getCompletedActiveKeyboardStageIds(sequence));
  const keyboardNext = sequence === null ? null : getRecommendedKeyboardStage({
    keyboardSequence: sequence, keyboardReviewRequirements: object(data.keyboardReviewRequirements),
  });
  const vision = Array.isArray(data.visionCleared) ? new Set(data.visionCleared.filter(id => typeof id === 'string')) : null;
  const word = data.wordProgress && typeof data.wordProgress === 'object' && !Array.isArray(data.wordProgress) ? object(data.wordProgress) : null;
  const course = (id: string, title: string, stages: Stage[], completed: number | null, nextId: string | null) => ({
    id, title, total: stages.length, completed, next: stages.find(stage => stage.id === nextId) || null, stages,
  });
  const mouseStages: Stage[] = Array.from({ length: 7 }, (_, index) => ({ id: String(index + 1), title: `M-${index + 1}`,
    status: mouse === null ? 'unknown' : index < mouse ? 'cleared' : index === mouse ? 'current' : 'pending', bestSeconds: seconds(exams[index + 1]) }));
  const keyboardStages: Stage[] = getActiveKeyboardStageIds().map((id: number) => ({ id: String(id), title: getStageName(id).replace(/^\[ID:\d+\]\s*/, ''),
    status: sequence === null ? 'unknown' : id === keyboardNext ? 'current' : completedKeyboard.has(id) ? 'cleared' : 'pending', bestSeconds: seconds(exams[id]) }));
  const visionStages: Stage[] = VISION_STAGES.flatMap((stage: { id: string; title: string }) => [['_easy', 'やさしい'], ['', 'ふつう'], ['_hard', 'むずかしい']].map(([suffix, label]) => ({
    id: stage.id + suffix, title: `${stage.title}（${label}）`, status: vision === null ? 'unknown' : vision.has(stage.id + suffix) ? 'cleared' : 'pending', bestSeconds: seconds(exams[stage.id + suffix]),
  }))) as Stage[];
  const wordStages: Stage[] = WORD_STAGES.map((stage: { id: string; title: string; sub: string }) => ({ id: stage.id, title: `${stage.title} ${stage.sub}`,
    status: word === null ? 'unknown' : (word[stage.id] === 'cleared' || object(word[stage.id]).status === 'cleared') ? 'cleared' : 'pending', bestSeconds: null }));
  const seen = new Set<string>();
  const recentLogs = (Array.isArray(data.practiceLogs) ? data.practiceLogs : []).map(object)
    .filter(entry => typeof entry.id === 'string' && !!entry.id && entry.id.length <= 200 && typeof entry.at === 'string'
      && entry.at.length <= 50 && !!serviceDate(entry.at) && learningCategories.has(String(entry.category)))
    .sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))
    .filter(entry => !seen.has(String(entry.id)) && !!seen.add(String(entry.id))).slice(0, 30);
  const dates = [...new Set(recentLogs.map(entry => serviceDate(entry.at)))].sort().reverse();
  const recentEvents = [];
  for (const date of dates) {
    recentEvents.push(...practiceForDate({ practiceLogs: recentLogs }, date));
  }
  const mistakes = new Map<string, number>();
  for (const [key, count] of Object.entries(object(data.globalMistakes))) {
    if (/^[a-z0-9;,./'\[\]\\-]$/i.test(key) && integer(count, 1000000000) !== null && Number(count) > 0) {
      const normalized = key.toUpperCase();
      mistakes.set(normalized, Math.min(1000000000, (mistakes.get(normalized) || 0) + Number(count)));
    }
  }
  const weakKeys = [...mistakes].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, 10);
  const loginNumber = typeof data.loginNumber === 'number' ? String(data.loginNumber) : data.loginNumber;
  return {
    courses: [course('mouse', 'マウス', mouseStages, mouse, mouse === null || mouse === 7 ? null : String(mouse + 1)),
      course('keyboard', 'キーボード・ことば入力', keyboardStages, sequence === null ? null : completedKeyboard.size, keyboardNext === null ? null : String(keyboardNext)),
      course('vision', 'ビジョン', visionStages, vision === null ? null : visionStages.filter(stage => stage.status === 'cleared').length, null),
      course('word', 'Word学習', wordStages, word === null ? null : wordStages.filter(stage => stage.status === 'cleared').length, null)],
    weakKeys, recentEvents,
    account: { authIdSaved: typeof data.authUserId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.authUserId),
      loginNumber: typeof loginNumber === 'string' && /^\d{1,12}$/.test(loginNumber) ? loginNumber : null,
      passcodeIssuedAt: timestamp(data.authPasscodeIssuedAt), loginVerified: false },
  };
}

export type ProgressRequest = { supportProjectRef: string; organizationId: string; studentId: string; childId: string; linkId: string };
type Permission = { campus_id: string; support_child_id: string; support_link_id: string };
export type ProgressReader = {
  scopes: () => Promise<string[]>;
  permission: () => Promise<Permission | null>;
  learner: () => Promise<{ id: string; data: Data } | null>;
};
const denied = () => Object.assign(new Error('児童の連携範囲が変更されています。更新して確認してください。'), { status: 403 });
export async function readBoundProgress(reader: ProgressReader, request: ProgressRequest, project: string, table: string) {
  const authorized = async () => {
    const permission = await reader.permission();
    const scopes = await reader.scopes();
    if (!permission || permission.support_child_id !== request.childId || permission.support_link_id !== request.linkId || !scopes.includes(permission.campus_id)) throw denied();
    return permission;
  };
  const permission = await authorized();
  const row = await reader.learner();
  const identity = row && row.id === request.studentId ? classroomIdentity(row.id, row.data, project, table) : null;
  if (!identity?.displayName || identity.campusId !== permission.campus_id) throw denied();
  const progress = projectProgress(row!.data);
  if ((await authorized()).campus_id !== identity.campusId) throw denied();
  return { schemaVersion: 1, identity, childId: request.childId, linkId: request.linkId, ...progress };
}
