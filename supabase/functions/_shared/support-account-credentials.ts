import { inspectOwnedAccounts, type AccountAccess, type AccountUser, type LoginSettings } from './support-accounts.ts';

export const operationUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function credentialPlan(action: string, studentId: string, data: Record<string, unknown>, rows: AccountAccess[], users: AccountUser[], owned: Map<string, AccountAccess[]>, settings: LoginSettings) {
  const inspected = inspectOwnedAccounts(studentId, data, rows, users, owned, settings);
  if (!inspected.loginNumber || !/^[a-zA-Z0-9_-]{1,80}$/.test(settings.campusCode) || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(settings.domain)
    || !/^[a-zA-Z0-9_-]{1,80}$/.test(settings.prefix) || !Number.isInteger(settings.pad) || settings.pad < 1 || settings.pad > 8) throw Error('CONFIGURATION');
  if (action === 'issue' && inspected.status === 'missing' && users.length === 0 && !data.authUserId) {
    return { loginNumber: inspected.loginNumber, authId: null, email: `${settings.prefix}${settings.campusCode}-${inspected.loginNumber.padStart(settings.pad, '0')}@${settings.domain}`.toLowerCase(), campusCode: settings.campusCode };
  }
  if (action === 'reset' && inspected.status === 'ready' && inspected.authCount === 1 && inspected.candidates.length === 1) {
    const candidate = inspected.candidates[0];
    return { loginNumber: inspected.loginNumber, authId: candidate.user.id, email: candidate.user.email!, campusCode: candidate.campusCode };
  }
  throw Error('ACCOUNT_REVIEW');
}

// Operation-specific deterministic generation permits recovery without persisting a password/hash.
export async function operationPasscode(secret: string, operationId: string, studentId: string) {
  if (secret.length < 32 || !operationUuid(operationId) || !/^student_[A-Za-z0-9_-]{1,140}$/.test(studentId)) throw Error('CONFIGURATION');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(['lesson-credentials-v1', operationId.toLowerCase(), studentId]))));
  const integer = bytes.slice(0, 8).reduce((value, byte) => value * 256n + BigInt(byte), 0n);
  return (integer % 10000000000n).toString().padStart(10, '0');
}
