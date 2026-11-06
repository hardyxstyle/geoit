// Регистрация, вход, изход, профил
import { json, fail, readJson, clean } from './http.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, clearCookie, currentUser, requireUser,
} from './auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LETTER_RE = /^[А-ЯA-Z]$/u;

export const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  status: u.status,
  grade: u.grade,
  classLetter: u.class_letter,
  mustChangePassword: !!u.must_change_password,
});

function checkPassword(p) {
  if (typeof p !== 'string' || p.length < 8) fail(400, 'Паролата трябва да е поне 8 символа.');
  if (p.length > 200) fail(400, 'Паролата е твърде дълга.');
}

export async function register(env, request) {
  const body = await readJson(request);
  const name = clean(body.name, 80);
  const email = clean(body.email, 120).toLowerCase();
  const role = body.role === 'teacher' ? 'teacher' : 'student';
  if (name.length < 3) fail(400, 'Напиши име и фамилия.');
  if (!EMAIL_RE.test(email)) fail(400, 'Имейлът не изглежда правилен.');
  checkPassword(body.password);

  let grade = null;
  let letter = null;
  if (role === 'student') {
    grade = Number(body.grade);
    if (![5, 6, 7].includes(grade)) fail(400, 'Избери клас — 5., 6. или 7.');
    letter = clean(body.classLetter, 1).toUpperCase() || null;
    if (letter && !LETTER_RE.test(letter)) fail(400, 'Паралелката е една буква, напр. А.');
  }

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) fail(409, 'Вече има профил с този имейл. Влез или помоли учител да ти смени паролата.');

  // Първият регистриран потребител става администратор и е одобрен веднага
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first();
  const isFirstAdmin = n === 0;

  const { hash, salt } = await hashPassword(body.password);
  const res = await env.DB.prepare(
    `INSERT INTO users (email, name, password_hash, password_salt, role, status, grade, class_letter, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      email, name, hash, salt,
      isFirstAdmin ? 'admin' : role,
      isFirstAdmin ? 'active' : 'pending',
      isFirstAdmin ? null : grade,
      isFirstAdmin ? null : letter,
      isFirstAdmin ? new Date().toISOString() : null,
    )
    .run();

  const id = res.meta.last_row_id;
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return json({ user: publicUser(user) }, 201, { 'set-cookie': await createSession(env, id) });
}

export async function login(env, request) {
  const body = await readJson(request);
  const email = clean(body.email, 120).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  // Същата грешка и при грешен имейл, и при грешна парола
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    fail(401, 'Грешен имейл или парола.');
  }
  if (user.status === 'blocked') fail(403, 'Профилът е спрян. Обърни се към учител.');
  await env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(user.id).run();
  return json({ user: publicUser(user) }, 200, { 'set-cookie': await createSession(env, user.id) });
}

export async function logout(env, request) {
  await destroySession(env, request);
  return json({ ok: true }, 200, { 'set-cookie': clearCookie });
}

export async function me(env, request) {
  const user = await currentUser(env, request);
  if (!user) return json({ user: null });
  let pendingCount = 0;
  if (user.status === 'active' && (user.role === 'teacher' || user.role === 'admin')) {
    const sql =
      user.role === 'admin'
        ? "SELECT COUNT(*) AS n FROM users WHERE status = 'pending'"
        : "SELECT COUNT(*) AS n FROM users WHERE status = 'pending' AND role = 'student'";
    pendingCount = (await env.DB.prepare(sql).first()).n;
  }
  return json({ user: publicUser(user), pendingCount });
}

export async function changePassword(env, request) {
  const user = requireUser(await currentUser(env, request));
  const body = await readJson(request);
  const row = await env.DB.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').bind(user.id).first();
  if (!(await verifyPassword(String(body.current || ''), row.password_hash, row.password_salt))) {
    fail(400, 'Сегашната парола е грешна.');
  }
  checkPassword(body.next);
  const { hash, salt } = await hashPassword(body.next);
  await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?')
    .bind(hash, salt, user.id)
    .run();
  return json({ ok: true });
}
