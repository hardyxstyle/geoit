// Учебно съдържание: класове → теми → уроци; школи и състезания; връзки
import { json, fail, readJson } from './http.js';
import { currentUser, requireActive, requireStaff } from './auth.js';
import { listForSection } from './routes-materials.js';
import { listForSection as quizzesFor } from './routes-quizzes.js';

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
                WHERE m.section_id = t.id AND m.status = 'ready' AND (m.audience = 'all' OR ?2)) AS materials,
              (SELECT COUNT(*) FROM quizzes q WHERE q.section_id = t.id AND (q.status = 'published' OR ?2)) AS quizzes,
              (SELECT 1 FROM lesson_views v WHERE v.user_id = ?3 AND v.section_id = t.id) AS seen,
              (SELECT MAX(a.score / a.max_score) FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
                WHERE q.section_id = t.id AND a.user_id = ?3) AS best
         FROM sections t JOIN sections th ON th.id = t.parent_id
        WHERE th.parent_id = ?1 ORDER BY t.sort`,
    )
      .bind(s.id, staff, me.id)
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
        .map((g) => ({
          slug: g.slug, code: g.code, title: g.title, materials: g.materials, quizzes: g.quizzes,
          ...(staff ? {} : { seen: !!g.seen, best: g.best }),
        })),
    })),
    materials: s.kind === 'topic' || s.kind === 'page' ? await listForSection(env, me, s.id) : [],
    texts: s.kind === 'topic' || s.kind === 'page' ? await tabTexts(env, s.id) : {},
    quizzes: s.kind === 'topic' || s.kind === 'page' ? await quizzesFor(env, me, s.id) : [],
    prev,
    next,
  });
}

async function tabTexts(env, sectionId) {
  const { results } = await env.DB.prepare(
    `SELECT t.tab, t.body, t.updated_at, u.name AS author FROM tab_texts t LEFT JOIN users u ON u.id = t.updated_by
      WHERE t.section_id = ? AND t.body IS NOT NULL`,
  )
    .bind(sectionId)
    .all();
  return Object.fromEntries(results.map((r) => [r.tab, { body: r.body, updatedAt: r.updated_at, updatedBy: r.author }]));
}

export async function links(env, request) {
  requireActive(await currentUser(env, request));
  const { results } = await env.DB.prepare(
    'SELECT id, category, title, url, description FROM links ORDER BY sort, id',
  ).all();
  return json({ links: results });
}

// ---------- Текст в табовете ----------
// Таб „Урок“ пази текста си в sections.body; другите табове — в tab_texts.
export const TEXT_TABS = ['urok', 'karti', 'zadachi', 'materiali'];

async function loadText(env, sectionId, tab) {
  if (tab === 'urok') {
    return env.DB.prepare('SELECT body, body_text, updated_by, updated_at FROM sections WHERE id = ?').bind(sectionId).first();
  }
  return (
    (await env.DB.prepare('SELECT body, body_text, updated_by, updated_at FROM tab_texts WHERE section_id = ? AND tab = ?')
      .bind(sectionId, tab)
      .first()) || { body: null, body_text: null, updated_by: null, updated_at: null }
  );
}

async function sectionForText(env, slug) {
  const s = await env.DB.prepare('SELECT id, kind FROM sections WHERE slug = ?').bind(slug).first();
  if (!s || (s.kind !== 'topic' && s.kind !== 'page')) fail(404, 'Няма такъв урок.');
  return s;
}

const checkTab = (tab) => {
  if (!TEXT_TABS.includes(tab)) fail(404, 'Няма такъв таб.');
  return tab;
};

export async function saveText(env, request, slug, tab) {
  const me = requireStaff(await currentUser(env, request));
  checkTab(tab);
  const b = await readJson(request);
  const s = await sectionForText(env, slug);
  const old = await loadText(env, s.id, tab);

  const text = typeof b.text === 'string' ? b.text.trim().slice(0, MAX_TEXT) : '';
  const body = typeof b.body === 'string' && b.body.trim() ? b.body : null;
  if (body && body.length > MAX_BODY) {
    fail(413, 'Текстът е твърде голям — обикновено заради много или големи снимки. Махни някоя снимка или я качи като отделен файл в таба.');
  }
  // Някой друг да не е записал междувременно
  if (!b.force && (b.baseUpdatedAt || null) !== (old.updated_at || null)) {
    fail(409, 'Докато пишеше, някой друг е променил този текст.');
  }

  const stmts = [];
  if (old.body) {
    stmts.push(
      env.DB.prepare('INSERT INTO section_revisions (section_id, tab, body, body_text, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(s.id, tab, old.body, old.body_text, old.updated_by, old.updated_at),
    );
  }
  if (tab === 'urok') {
    stmts.push(
      env.DB.prepare("UPDATE sections SET body = ?, body_text = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(body, body ? text : null, me.id, s.id),
    );
  } else {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO tab_texts (section_id, tab, body, body_text, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT (section_id, tab) DO UPDATE SET body = ?3, body_text = ?4, updated_by = ?5, updated_at = datetime('now')`,
      ).bind(s.id, tab, body, body ? text : null, me.id),
    );
  }
  stmts.push(
    env.DB.prepare(
      `DELETE FROM section_revisions WHERE section_id = ?1 AND tab = ?2 AND id NOT IN
         (SELECT id FROM section_revisions WHERE section_id = ?1 AND tab = ?2 ORDER BY id DESC LIMIT ${KEEP_REVISIONS})`,
    ).bind(s.id, tab),
  );
  await env.DB.batch(stmts);
  const after = await loadText(env, s.id, tab);
  return json({ updatedAt: after.updated_at, updatedBy: me.name });
}

export async function revisions(env, request, slug, tab) {
  requireStaff(await currentUser(env, request));
  checkTab(tab);
  const s = await sectionForText(env, slug);
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.updated_at, u.name AS author, substr(r.body_text, 1, 140) AS preview
       FROM section_revisions r LEFT JOIN users u ON u.id = r.updated_by
      WHERE r.section_id = ? AND r.tab = ? ORDER BY r.id DESC`,
  )
    .bind(s.id, tab)
    .all();
  return json({ revisions: results.map((r) => ({ id: r.id, updatedAt: r.updated_at, author: r.author, preview: r.preview })) });
}

export async function revision(env, request, slug, tab, id) {
  requireStaff(await currentUser(env, request));
  checkTab(tab);
  const r = await env.DB.prepare(
    'SELECT r.body FROM section_revisions r JOIN sections s ON s.id = r.section_id WHERE s.slug = ? AND r.tab = ? AND r.id = ?',
  )
    .bind(slug, tab, Number(id))
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
    `SELECT slug, kind, grade, code, title, summary, goals, body_text,
            (SELECT group_concat(body_text, ' ') FROM tab_texts WHERE tab_texts.section_id = sections.id) AS tabs_text
       FROM sections
      WHERE kind IN ('topic', 'page', 'theme') ORDER BY grade, parent_id, sort`,
  ).all();
  const hay = (r) => [r.title, r.summary, r.goals, r.body_text, r.tabs_text].filter(Boolean).join(' ').toLowerCase();
  const results = all
    .filter((r) => hay(r).includes(q))
    .sort((a, b) => Number(!a.title.toLowerCase().includes(q)) - Number(!b.title.toLowerCase().includes(q)))
    .slice(0, 20)
    .map(({ slug, kind, grade, code, title }) => ({ slug, kind, grade, code, title }));
  return json({ results });
}
