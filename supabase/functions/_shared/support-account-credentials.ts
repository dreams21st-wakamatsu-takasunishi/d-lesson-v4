import { inspectOwnedAccounts, type AccountAccess, type AccountUser, type LoginSettings } from './support-accounts.ts';

export const operationUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const validChosenPasscode = (value: unknown): value is string => typeof value === 'string' && /^[0-9]{6}$/.test(value);
export function credentialPlan(action: string, studentId: string, data: Record<string, unknown>, rows: AccountAccess[], users: AccountUser[], owned: Map<string, AccountAccess[]>, settings: LoginSettings) {
  const inspected = inspectOwnedAccounts(studentId, data, rows, users, owned, settings);
  if (!inspected.loginNumber || !/^[a-zA-Z0-9_-]{1,80}$/.test(settings.campusCode) || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(settings.domain)
    || !/^[a-zA-Z0-9_-]{1,80}$/.test(settings.prefix) || !Number.isInteger(settings.pad) || settings.pad < 1 || settings.pad > 8) throw Error('CONFIGURATION');
  if (action === 'issue' && inspected.status === 'missing' && users.length === 0 && !data.authUserId) {
    return { loginNumber: inspected.loginNumber, authId: null, email: `${settings.prefix}${settings.campusCode}-${inspected.loginNumber.padStart(settings.pad, '0')}@${settings.domain}`.toLowerCase(), campusCode: settings.campusCode };
  }
  if (action === 'reset' && inspected.status === 'ready' && inspected.authCount >= 1 && inspected.authCount <= 10 && inspected.candidates.length === inspected.authCount
    && new Set(inspected.candidates.map(item => item.user.email?.toLowerCase())).size === inspected.authCount) {
    // Only fully verified same-child login aliases; prefer the operational-school login.
    const candidate = inspected.candidates.find(item => item.campusCode === settings.campusCode) || inspected.candidates[0];
    return { loginNumber: inspected.loginNumber, authId: candidate.user.id, email: candidate.user.email!, campusCode: candidate.campusCode };
  }
  throw Error('ACCOUNT_REVIEW');
}

// Operation-specific deterministic generation permits recovery without persisting a password/hash.
export async function operationPasscode(secret: string, operationId: string, studentId: string, digits: 6 | 10 = 10) {
  if (secret.length < 32 || !operationUuid(operationId) || !/^student_[A-Za-z0-9_-]{1,140}$/.test(studentId)) throw Error('CONFIGURATION');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(['lesson-credentials-v1', operationId.toLowerCase(), studentId]))));
  const integer = bytes.slice(0, 8).reduce((value, byte) => value * 256n + BigInt(byte), 0n);
  if (digits !== 6 && digits !== 10) throw Error('CONFIGURATION');
  return (integer % (10n ** BigInt(digits))).toString().padStart(digits, '0');
}

/** A keyed, operation-specific verifier; never send or persist the passcode in the operation table. */
export async function chosenPasscodeProof(secret: string, operationId: string, studentId: string, passcode: string) {
  if (secret.length < 32 || !operationUuid(operationId) || !/^student_[A-Za-z0-9_-]{1,140}$/.test(studentId) || !validChosenPasscode(passcode)) throw Error('CONFIGURATION');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(['lesson-chosen-passcode-v1', operationId.toLowerCase(), studentId, passcode])));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
