import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || !encoded) return false;
  const [salt, expected] = encoded.split(':');
  const actual = await scrypt(password, salt, 64);
  const bytes = Buffer.from(expected, 'hex');
  return actual.length === bytes.length && timingSafeEqual(actual, bytes);
}

export function sessionToken(req) {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('cube_session='));
  const token = cookie?.slice('cube_session='.length);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function setSession(res, req, token, secureSetting, maxAge = 7 * 86400) {
  const secure = secureSetting === 'true' || (secureSetting !== 'false' && req.secure);
  res.setHeader(
    'Set-Cookie',
    `cube_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`,
  );
}
