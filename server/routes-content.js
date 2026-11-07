// Учебно съдържание: класове → теми → уроци; школи и състезания; връзки
import { json, fail, readJson } from './http.js';
import { currentUser, requireActive, requireStaff } from './auth.js';
import { listForSection } from './routes-materials.js';

// Без текста на урока — той може да е голям (снимки), четем го само когато трябва
const LIST_FIELDS = 'id, slug, parent_id, kind, grade, code, title, summary, goals, sort, updated_at';
const FIELDS = `${LIST_FIELDS}, body, (SELECT name FROM users WHERE users.id = sections.updated_by) AS updated_by_name`;

export const MAX_BODY = 1_500_000; // знака — около 1,5 MB, с вградените снимки
const MAX_TEXT = 20_000;
const KEEP_REVISIONS = 5;

const shape = (s) =>
  s && {
    id: s.id,
    slug: s.slug,
    kind: s.kind,
    grade: s.grade,
    code: s.code,
    title: s.title,
    summary: s.summary,
    goals: s.goals ? JSON.parse(s.goals) : [],
    body: s.body ?? null,
    updatedAt: s.updated_at,
    updatedBy: s.updated_by_name ?? null,
  };

// Началната страница: класовете и разделът за школи
export async function overview(env, request) {
  requireActive(await currentUser(env, request));
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.slug, s.kind, s.grade, s.title, s.summary,
            (SELECT COUNT(*) FROM sections t WHERE t.parent_id = s.id) AS children,
            (SELECT COUNT(*) FROM sections t JOIN sections p ON t.parent_id = p.id WHERE p.parent_id = s.id) AS grandchildren
       FROM sections s WHERE s.parent_id IS NULL ORDER BY s.sort`,
  ).all();
  return json({ sections: results });
}

export async function section(env, request, slug) {
  const me = requireActive(await currentUser(env, request));
  const staff = me.role === 'teacher' || me.role === 'admin' ? 1 : 0;
  const s = await env.DB.prepare(`SELECT ${FIELDS} FROM sections WHERE slug = ?`).bind(slug).first();
  if (!s) fail(404, 'Няма такава страница.');

  // Път назад (трохи)
  const crumbs = [];
  let parentId = s.parent_id;
  while (parentId) {
    const p = await env.DB.prepare('SELECT id, slug, kind, title, parent_id FROM sections WHERE id = ?').bind(parentId).first();
    if (!p) break;
    crumbs.unshift({ slug: p.slug, kind: p.kind, title: p.title });
    parentId = p.parent_id;
  }

  // Децата; за клас — и внуците (темите с техните уроци)
  const { results: children } = await env.DB.prepare(
    `SELECT ${LIST_FIELDS} FROM sections WHERE parent_id = ? ORDER BY sort`,
  )
    .bind(s.id)
    .all();
  let grand = [];
  if (s.kind === 'grade' && children.length) {
    // Уроците във всяка тема + колко материала има към всеки
    const { results } = await env.DB.prepare(
      `SELECT t.id, t.slug, t.parent_id, t.code, t.title,
              (SELECT COUNT(*) FROM materials m
                WHERE m.section_id = t.id AND m.status = 'ready' AND (m.audience = 'all' OR ?2)) AS materials
         FROM sections t JOIN sections th ON th.id = t.parent_id
        WHERE th.parent_id = ?1 ORDER BY t.sort`,
    )
      .bind(s.id, staff)
      .all();
    grand = results;
  }

  // Предишен и следващ урок в рамките на класа
  let prev = null;
  let next = null;
  if (s.kind === 'topic' || s.kind === 'page') {
    const scope =
      s.kind === 'topic'
        ? `SELECT t.slug, t.code, t.title FROM sections t JOIN sections th ON t.parent_id = th.id
            WHERE t.kind = 'topic' AND t.grade = ?1 ORDER BY th.sort, t.sort`
        : `SELECT slug, code, title FROM sections WHERE parent_id = ?1 ORDER BY sort`;
    const { results: list } = await env.DB.prepare(scope)
      .bind(s.kind === 'topic' ? s.grade : s.parent_id)
      .all();
    const i = list.findIndex((x) => x.slug === s.slug);
    prev = list[i - 1] || null;
    next = list[i + 1] || null;
  }

  return json({
    section: shape(s),
    crumbs,
    children: children.map((c) => ({
      ...shape(c),
      topics: grand
        .filter((g) => g.parent_id === c.id)
        .map((g) => ({ slug: g.slug, code: g.code, title: g.title, materials: g.materials })),
    })),
    materials: s.kind === 'topic' || s.kind === 'page' ? await listForSection(env, me, s.id) : [],
    prev,
    next,
  });
}

export async function links(env, request) {
  requireActive(await currentUser(env, request));
  const { results } = await env.DB.prepare(
    'SELECT id, category, title, url, description FROM links ORDER BY sort, id',
  ).all();
  return json({ links: results });
}

// ---------- Текстът на урока ----------
export async function saveBody(env, request, slug) {
  const me = requireStaff(await currentUser(env, request));
  const b = await readJson(request);
  const s = await env.DB.prepare('SELECT id, kind, body, body_text, updated_by, updated_at FROM sections WHERE slug = ?')
    .bind(slug)
    .first();
  if (!s || (s.kind !== 'topic' && s.kind !== 'page')) fail(404, 'Няма такъв урок.');

  const text = typeof b.text === 'string' ? b.text.trim().slice(0, MAX_TEXT) : '';
  const body = typeof b.body === 'string' && b.body.trim() ? b.body : null;
  if (body && body.length > MAX_BODY) {
    fail(413, 'Урокът е твърде голям — обикновено заради много или големи снимки. Махни някоя снимка или я качи като отделен файл в таба.');
  }
  // Някой друг да не е записал междувременно
  if (!b.force && (b.baseUpdatedAt || null) !== (s.updated_at || null)) {
    fail(409, 'Докато пишеше, някой друг е променил урока.');
  }

  const stmts = [];
  if (s.body) {
    stmts.push(
      env.DB.prepare('INSERT INTO section_revisions (section_id, body, body_text, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(s.id, s.body, s.body_text, s.updated_by, s.updated_at),
    );
  }
  stmts.push(
    env.DB.prepare("UPDATE sections SET body = ?, body_text = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(body, body ? text : null, me.id, s.id),
  );
  stmts.push(
    env.DB.prepare(
      `DELETE FROM section_revisions WHERE section_id = ?1 AND id NOT IN
         (SELECT id FROM section_revisions WHERE section_id = ?1 ORDER BY id DESC LIMIT ${KEEP_REVISIONS})`,
    ).bind(s.id),
  );
  await env.DB.batch(stmts);
  const after = await env.DB.prepare('SELECT updated_at FROM sections WHERE id = ?').bind(s.id).first();
  return json({ updatedAt: after.updated_at, updatedBy: me.name });
}

export async function revisions(env, request, slug) {
  requireStaff(await currentUser(env, request));
  const s = await env.DB.prepare('SELECT id FROM sections WHERE slug = ?').bind(slug).first();
  if (!s) fail(404, 'Няма такъв урок.');
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.updated_at, u.name AS author, substr(r.body_text, 1, 140) AS preview
       FROM section_revisions r LEFT JOIN users u ON u.id = r.updated_by
      WHERE r.section_id = ? ORDER BY r.id DESC`,
  )
    .bind(s.id)
    .all();
  return json({ revisions: results.map((r) => ({ id: r.id, updatedAt: r.updated_at, author: r.author, preview: r.preview })) });
}

export async function revision(env, request, slug, id) {
  requireStaff(await currentUser(env, request));
  const r = await env.DB.prepare(
    'SELECT r.body FROM section_revisions r JOIN sections s ON s.id = r.section_id WHERE s.slug = ? AND r.id = ?',
  )
    .bind(slug, Number(id))
    .first();
  if (!r) fail(404, 'Няма такава версия.');
  return json({ body: r.body });
}

// Търсене по заглавие, цели и текст на урока
export async function search(env, request) {
  requireActive(await currentUser(env, request));
  const q = (new URL(request.url).searchParams.get('q') || '').trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return json({ results: [] });
  // SQLite различава главни и малки букви на кирилица, затова филтрираме тук
  const { results: all } = await env.DB.prepare(
    `SELECT slug, kind, grade, code, title, summary, goals, body_text FROM sections
      WHERE kind IN ('topic', 'page', 'theme') ORDER BY grade, parent_id, sort`,
  ).all();
  const hay = (r) => [r.title, r.summary, r.goals, r.body_text].filter(Boolean).join(' ').toLowerCase();
  const results = all
    .filter((r) => hay(r).includes(q))
    .sort((a, b) => Number(!a.title.toLowerCase().includes(q)) - Number(!b.title.toLowerCase().includes(q)))
    .slice(0, 20)
    .map(({ slug, kind, grade, code, title }) => ({ slug, kind, grade, code, title }));
  return json({ results });
}
