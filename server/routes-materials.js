// Материали: качени файлове и линкове към урок или страница.
// Файловете се пазят в D1 на части (base64), за да не трябва R2.
import { json, fail, readJson, clean } from './http.js';
import { currentUser, requireActive, requireStaff } from './auth.js';

// Малки части: безплатният план на Cloudflare дава само 10 ms процесорно време на заявка
export const CHUNK = 256 * 1024; // байта в една част
export const MAX_FILE = 25 * 1024 * 1024; // 25 MB на файл
export const TOTAL_LIMIT = 300 * 1024 * 1024; // общо място за файлове (базата е до 500 MB)

// Файлове, които могат да навредят на училищните компютри
const BLOCKED = /\.(exe|msi|bat|cmd|com|scr|pif|vbs|vbe|js|jse|wsf|wsh|ps1|sh|apk|app|dmg|jar|html?|xhtml|php|hta|lnk|reg|cpl)$/i;

export const TABS = ['urok', 'karti', 'zadachi', 'materiali'];
const tabOf = (v) => (TABS.includes(v) ? v : 'materiali');

const isStaff = (u) => u.role === 'teacher' || u.role === 'admin';
const canEdit = (u, m) => u.role === 'admin' || (m.created_by !== null && m.created_by === u.id);
const mb = (b) => Math.max(0, Math.floor(b / 1048576));

const FIELDS = `m.id, m.section_id, m.kind, m.title, m.description, m.url, m.file_name, m.mime, m.size, m.chunks,
                m.audience, m.tab, m.created_by, m.created_at, m.updated_at, u.name AS author`;

const shape = (m, me) => ({
  id: m.id,
  kind: m.kind,
  title: m.title,
  description: m.description,
  url: m.kind === 'link' ? m.url : null,
  fileName: m.file_name,
  mime: m.mime,
  size: m.size,
  chunks: m.chunks,
  audience: m.audience,
  tab: m.tab || 'materiali',
  author: m.author,
  createdAt: m.created_at,
  canEdit: canEdit(me, m),
  ...(m.slug ? { section: { slug: m.slug, title: m.section_title, code: m.code, grade: m.grade } } : {}),
});

// Видими материали към един раздел (ползва се и от страницата на урока)
export async function listForSection(env, me, sectionId) {
  const { results } = await env.DB.prepare(
    `SELECT ${FIELDS} FROM materials m LEFT JOIN users u ON u.id = m.created_by
      WHERE m.section_id = ?1 AND m.status = 'ready' AND (m.audience = 'all' OR ?2)
      ORDER BY m.created_at DESC, m.id DESC`,
  )
    .bind(sectionId, isStaff(me) ? 1 : 0)
    .all();
  return results.map((m) => shape(m, me));
}

export async function list(env, request) {
  const me = requireActive(await currentUser(env, request));
  const slug = new URL(request.url).searchParams.get('section') || '';
  const s = await env.DB.prepare('SELECT id FROM sections WHERE slug = ?').bind(slug).first();
  if (!s) fail(404, 'Няма такъв урок.');
  return json({ materials: await listForSection(env, me, s.id) });
}

// Последно добавени — за началната страница
export async function recent(env, request) {
  const me = requireActive(await currentUser(env, request));
  const { results } = await env.DB.prepare(
    `SELECT ${FIELDS}, s.slug, s.title AS section_title, s.code, s.grade
       FROM materials m JOIN sections s ON s.id = m.section_id LEFT JOIN users u ON u.id = m.created_by
      WHERE m.status = 'ready' AND (m.audience = 'all' OR ?1)
      ORDER BY m.created_at DESC, m.id DESC LIMIT 8`,
  )
    .bind(isStaff(me) ? 1 : 0)
    .all();
  return json({ materials: results.map((m) => shape(m, me)) });
}

async function usedBytes(env) {
  return (await env.DB.prepare("SELECT COALESCE(SUM(size), 0) AS s FROM materials WHERE kind = 'file'").first()).s;
}

export async function storage(env, request) {
  requireStaff(await currentUser(env, request));
  return json({ used: await usedBytes(env), limit: TOTAL_LIMIT, maxFile: MAX_FILE });
}

function checkUrl(raw) {
  const url = clean(raw, 1000);
  let u;
  try {
    u = new URL(url);
  } catch {
    fail(400, 'Линкът не изглежда правилен. Трябва да започва с https://');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') fail(400, 'Линкът трябва да започва с https://');
  return u.href;
}

function readMeta(b) {
  const title = clean(b.title, 150);
  if (title.length < 2) fail(400, 'Напиши заглавие на материала.');
  return {
    title,
    description: clean(b.description, 1000) || null,
    audience: b.audience === 'teachers' ? 'teachers' : 'all',
    tab: tabOf(b.tab),
  };
}

export async function create(env, request) {
  const me = requireStaff(await currentUser(env, request));
  const b = await readJson(request);
  const section = await env.DB.prepare("SELECT id FROM sections WHERE slug = ? AND kind IN ('topic', 'page')")
    .bind(clean(b.section, 120))
    .first();
  if (!section) fail(404, 'Няма такъв урок.');
  const meta = readMeta(b);

  if (b.kind === 'link') {
    const url = checkUrl(b.url);
    const res = await env.DB.prepare(
      `INSERT INTO materials (section_id, kind, title, description, url, audience, tab, created_by)
       VALUES (?, 'link', ?, ?, ?, ?, ?, ?)`,
    )
      .bind(section.id, meta.title, meta.description, url, meta.audience, meta.tab, me.id)
      .run();
    return json({ id: res.meta.last_row_id }, 201);
  }

  const fileName = clean(b.fileName, 200).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  const size = Number(b.size);
  if (!fileName) fail(400, 'Избери файл.');
  if (BLOCKED.test(fileName)) fail(400, 'Този тип файл не може да се качва (програми и скриптове не са позволени).');
  if (!Number.isInteger(size) || size <= 0) fail(400, 'Файлът е празен.');
  if (size > MAX_FILE) fail(413, `Файлът е над ${mb(MAX_FILE)} MB. Сложи го в Google Drive и добави линк към него.`);

  // Недовършени качвания на същия човек от преди повече от час — чистим ги
  const stale = await env.DB.prepare(
    "SELECT id FROM materials WHERE status = 'uploading' AND created_by = ? AND created_at < datetime('now', '-1 hour')",
  )
    .bind(me.id)
    .all();
  if (stale.results.length) await removeMaterials(env, stale.results.map((r) => r.id));

  const used = await usedBytes(env);
  if (used + size > TOTAL_LIMIT) {
    fail(413, `Няма достатъчно място. Свободни са ${mb(TOTAL_LIMIT - used)} MB. Изтрий стари файлове или сложи този като линк.`);
  }

  const mime = clean(b.mime, 100) || 'application/octet-stream';
  const chunks = Math.ceil(size / CHUNK);
  const res = await env.DB.prepare(
    `INSERT INTO materials (section_id, kind, title, description, file_name, mime, size, chunks, chunk_size, audience, tab, status, created_by)
     VALUES (?, 'file', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploading', ?)`,
  )
    .bind(section.id, meta.title, meta.description, fileName, mime, size, chunks, CHUNK, meta.audience, meta.tab, me.id)
    .run();
  return json({ id: res.meta.last_row_id, chunkSize: CHUNK, chunks }, 201);
}

async function loadOwnUpload(env, me, id) {
  const m = await env.DB.prepare('SELECT id, created_by, status, size, chunks, chunk_size FROM materials WHERE id = ? AND kind = ?')
    .bind(Number(id), 'file')
    .first();
  if (!m) fail(404, 'Няма такъв файл.');
  if (m.created_by !== me.id) fail(403, 'Само този, който качва файла, може да го довърши.');
  if (m.status !== 'uploading') fail(409, 'Файлът вече е качен.');
  return m;
}

const b64Bytes = (s) => (s.length / 4) * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);

// Една част като base64 текст в тялото на заявката (без JSON — по-малко работа за сървъра)
export async function putChunk(env, request, id, idx) {
  const me = requireStaff(await currentUser(env, request));
  const m = await loadOwnUpload(env, me, id);
  const index = Number(idx);
  if (!Number.isInteger(index) || index < 0 || index >= m.chunks) fail(400, 'Невалидна част от файла.');
  const data = await request.text();
  const expected = index === m.chunks - 1 ? m.size - m.chunk_size * index : m.chunk_size;
  if (data.length % 4 !== 0 || b64Bytes(data) !== expected) fail(400, 'Част от файла пристигна повредена. Опитай пак.');
  await env.DB.prepare('INSERT OR REPLACE INTO material_chunks (material_id, idx, data) VALUES (?, ?, ?)')
    .bind(m.id, index, data)
    .run();
  return json({ ok: true });
}

export async function finish(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const m = await loadOwnUpload(env, me, id);
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM material_chunks WHERE material_id = ?').bind(m.id).first();
  if (n !== m.chunks) fail(409, 'Не всички части от файла са качени. Опитай пак.');
  await env.DB.prepare("UPDATE materials SET status = 'ready', created_at = datetime('now') WHERE id = ?").bind(m.id).run();
  return json({ ok: true });
}

// Една част от файла като base64 текст. Браузърът сглобява файла сам.
export async function getChunk(env, request, id, idx) {
  const me = requireActive(await currentUser(env, request));
  const m = await env.DB.prepare("SELECT id, audience, status FROM materials WHERE id = ? AND kind = 'file'")
    .bind(Number(id))
    .first();
  if (!m || m.status !== 'ready' || (m.audience === 'teachers' && !isStaff(me))) fail(404, 'Няма такъв файл.');
  const row = await env.DB.prepare('SELECT data FROM material_chunks WHERE material_id = ? AND idx = ?')
    .bind(m.id, Number(idx))
    .first();
  if (!row) fail(404, 'Липсва част от файла.');
  return new Response(row.data, {
    headers: {
      'content-type': 'text/plain; charset=us-ascii',
      'cache-control': 'private, max-age=604800',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function loadEditable(env, me, id) {
  const m = await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(Number(id)).first();
  if (!m) fail(404, 'Няма такъв материал.');
  if (!canEdit(me, m)) fail(403, 'Можеш да променяш само материалите, които ти си качил.');
  return m;
}

export async function update(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const m = await loadEditable(env, me, id);
  const b = await readJson(request);
  const meta = readMeta(b);
  const url = m.kind === 'link' ? checkUrl(b.url ?? m.url) : null;
  await env.DB.prepare(
    "UPDATE materials SET title = ?, description = ?, audience = ?, tab = ?, url = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(meta.title, meta.description, meta.audience, meta.tab, url, m.id)
    .run();
  return json({ ok: true });
}

async function removeMaterials(env, ids) {
  const stmts = [];
  for (const id of ids) {
    stmts.push(env.DB.prepare('DELETE FROM material_chunks WHERE material_id = ?').bind(id));
    stmts.push(env.DB.prepare('DELETE FROM materials WHERE id = ?').bind(id));
  }
  await env.DB.batch(stmts);
}

export async function remove(env, request, id) {
  const me = requireStaff(await currentUser(env, request));
  const m = await loadEditable(env, me, id);
  await removeMaterials(env, [m.id]);
  return json({ ok: true });
}
