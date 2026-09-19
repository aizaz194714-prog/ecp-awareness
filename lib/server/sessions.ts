import 'server-only';
import crypto from 'node:crypto';

export type ParticipantSession = { type: 'participant'; sub: number; exp: number };
export type AdminSession = { type: 'admin'; sub: number; username: string; csrf: string; exp: number };
type Session = ParticipantSession | AdminSession;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error('SESSION_SECRET is required. Generate a random value of at least 32 bytes.');
  return value;
}

function signature(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function signSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifySession<T extends Session['type']>(token: string | undefined, type: T): Extract<Session, { type: T }> | null {
  if (!token) return null;
  const [payload, supplied] = token.split('.');
  if (!payload || !supplied) return null;
  const expected = signature(payload), actualBuffer = Buffer.from(supplied), expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    if (session.type !== type || !Number.isInteger(session.sub) || session.exp <= Date.now()) return null;
    return session as Extract<Session, { type: T }>;
  } catch { return null; }
}

export function participantToken(id: number) {
  return signSession({ type: 'participant', sub: id, exp: Date.now() + 24 * 60 * 60 * 1000 });
}

export function adminToken(id: number, username: string, csrf = crypto.randomBytes(24).toString('hex')) {
  return { csrf, token: signSession({ type: 'admin', sub: id, username, csrf, exp: Date.now() + 30 * 60 * 1000 }) };
}
