// Пароли (PBKDF2-SHA256) и сесии с бисквитка
import { fail } from './http.js';

const ITERATIONS = 100_000; // максимумът, който Cloudflare Workers позволява
const SESSION_DAYS = 30;
export const COOKIE = 'gk_session';

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

export function randomHex(bytes = 32) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function hashPassword(password, saltHex = randomHex(16)) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITERATIONS },
    key,
    256,
  );
  return { hash: toHex(bits), salt: saltHex };
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, hash, salt) {
  const { hash: h } = await hashPassword(password, salt);
  return safeEqual(h, hash);
}

async function sha256(text) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function createSession(env, userId) {
  const token = randomHex(32);
  const expires = Date.now() + SESSION_DAYS * 864e5;
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, expires)
    .run();
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function readToken(request) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}

export async function destroySession(env, request) {
  const token = readToken(request);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

// Връща текущия потребител или null
export async function currentUser(env, request) {
  const token = readToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.status, u.grade, u.class_letter, u.must_change_password, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
  )
    .bind(await sha256(token))
    .first();
  if (!row || row.expires_at < Date.now() || row.status === 'blocked') return null;
  delete row.expires_at;
  return row;
}

// Пазачи за правата
export function requireUser(user) {
  if (!user) fail(401, 'Влез в профила си.');
  return user;
}

export function requireActive(user) {
  requireUser(user);
  if (user.status !== 'active') fail(403, 'Профилът ти още чака одобрение.');
  return user;
}

export function requireStaff(user) {
  requireActive(user);
  if (user.role !== 'teacher' && user.role !== 'admin') fail(403, 'Само за учители.');
  return user;
}

export function requireAdmin(user) {
  requireActive(user);
  if (user.role !== 'admin') fail(403, 'Само за администратора.');
  return user;
}
