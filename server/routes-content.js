// Учебно съдържание: класове → теми → уроци; школи и състезания; връзки
import { json, fail } from './http.js';
import { currentUser, requireActive } from './auth.js';
import { listForSection } from './routes-materials.js';

const FIELDS = 'id, slug, parent_id, kind, grade, code, title, summary, goals, body, sort, updated_at';

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
    body: s.body,
    updatedAt: s.updated_at,
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
    `SELECT ${FIELDS} FROM sections WHERE parent_id = ? ORDER BY sort`,
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

// Търсене по заглавие и цели
export async function search(env, request) {
  requireActive(await currentUser(env, request));
  const q = (new URL(request.url).searchParams.get('q') || '').trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return json({ results: [] });
  // SQLite не прави разлика между главни и малки букви на кирилица, затова филтрираме тук
  const { results: all } = await env.DB.prepare(
    `SELECT slug, kind, grade, code, title, summary, goals, body FROM sections
      WHERE kind IN ('topic', 'page', 'theme') ORDER BY grade, parent_id, sort`,
  ).all();
  const hay = (r) => [r.title, r.summary, r.goals, r.body].filter(Boolean).join(' ').toLowerCase();
  const results = all
    .filter((r) => hay(r).includes(q))
    .sort((a, b) => Number(!a.title.toLowerCase().includes(q)) - Number(!b.title.toLowerCase().includes(q)))
    .slice(0, 20)
    .map(({ slug, kind, grade, code, title }) => ({ slug, kind, grade, code, title }));
  return json({ results });
}
