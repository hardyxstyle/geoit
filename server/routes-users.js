// Одобрение и управление на потребители
// Учителите управляват учениците; администраторът управлява всички.
import { json, fail, readJson, clean } from './http.js';
import { currentUser, requireStaff, hashPassword } from './auth.js';

const LIST_FIELDS = 'id, email, name, role, status, grade, class_letter, created_at, approved_at, last_login_at';

const toRow = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  status: u.status,
  grade: u.grade,
  classLetter: u.class_letter,
  createdAt: u.created_at,
  approvedAt: u.approved_at,
  lastLoginAt: u.last_login_at,
});

export async function listUsers(env, request) {
  const me = requireStaff(await currentUser(env, request));
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const where = [];
  const args = [];
  if (['pending', 'active', 'blocked'].includes(status)) {
    where.push('status = ?');
    args.push(status);
  }
  if (me.role !== 'admin') where.push("role = 'student'");
  const sql = `SELECT ${LIST_FIELDS} FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, grade, class_letter, name`;
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json({ users: results.map(toRow) });
}

// Може ли me да управлява target?
async function loadTarget(env, me, id) {
  const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(Number(id)).first();
  if (!target) fail(404, 'Няма такъв потребител.');
  if (target.id === me.id) fail(400, 'Не можеш да правиш това със собствения си профил.');
  if (me.role !== 'admin' && target.role !== 'student') fail(403, 'Учителите могат да управляват само ученици.');
  return target;
}

export async function approveUser(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const target = await loadTarget(env, me, id);
  await env.DB.prepare("UPDATE users SET status = 'active', approved_by = ?, approved_at = datetime('now') WHERE id = ?")
    .bind(me.id, target.id)
    .run();
  return json({ ok: true });
}

export async function blockUser(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const target = await loadTarget(env, me, id);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET status = 'blocked' WHERE id = ?").bind(target.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id),
  ]);
  return json({ ok: true });
}

export async function unblockUser(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const target = await loadTarget(env, me, id);
  await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(target.id).run();
  return json({ ok: true });
}

export async function deleteUser(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const target = await loadTarget(env, me, id);
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(target.id).run();
  return json({ ok: true });
}

// Промяна на роля (само админ) и на клас/паралелка (учител за ученици)
export async function updateUser(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const target = await loadTarget(env, me, id);
  const body = await readJson(request);
  let role = target.role;
  if (body.role !== undefined) {
    if (me.role !== 'admin') fail(403, 'Само администраторът сменя роли.');
    if (!['student', 'teacher', 'admin'].includes(body.role)) fail(400, 'Невалидна роля.');
    role = body.role;
  }
  let grade = target.grade;
  let letter = target.class_letter;
  if (role === 'student') {
    if (body.grade !== undefined) {
      grade = Number(body.grade);
      if (![5, 6, 7].includes(grade)) fail(400, 'Класът трябва да е 5, 6 или 7.');
    }
    if (body.classLetter !== undefined) letter = clean(body.classLetter, 1).toUpperCase() || null;
  } else {
    grade = null;
    letter = null;
  }
  await env.DB.prepare('UPDATE users SET role = ?, grade = ?, class_letter = ? WHERE id = ?')
    .bind(role, grade, letter, target.id)
    .run();
  return json({ ok: true });
}

// Нова временна парола — показва се веднъж на учителя, който я дава на ученика
export async function resetPassword(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const target = await loadTarget(env, me, id);
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const temp = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  const { hash, salt } = await hashPassword(temp);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1 WHERE id = ?')
      .bind(hash, salt, target.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id),
  ]);
  return json({ tempPassword: temp });
}
