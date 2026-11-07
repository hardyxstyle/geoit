// Генерира server/db-data.js от db/schema.sql и db/curriculum.mjs.
// Сайтът сам създава таблиците и попълва учебната програма при първото отваряне,
// когато базата е празна. Пусни `npm run db:build` само ако промениш тези два файла.
import { readFileSync, writeFileSync } from 'node:fs';
import { grades, extras, links, structure } from './curriculum.mjs';

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const rows = [];
let id = 0;
const topicSlug = (g, tp) => tp.slug || `klas-${g.grade}-${tp.code.replace('.', '-')}`;
const themeSlug = (g, ti) => `klas-${g.grade}-tema-${ti + 1}`;

const add = (s) => {
  id += 1;
  rows.push(
    '(' +
      [id, q(s.slug), s.parent ?? 'NULL', q(s.kind), s.grade ?? 'NULL', q(s.code), q(s.title), q(s.summary),
        q(s.goals ? JSON.stringify(s.goals) : null), s.sort, q(s.type)].join(', ') +
      ')',
  );
  return id;
};

grades.forEach((g, gi) => {
  const gid = add({ slug: `klas-${g.grade}`, kind: 'grade', grade: g.grade, title: g.title, summary: g.summary, sort: gi });
  g.themes.forEach((th, ti) => {
    const tid = add({
      slug: themeSlug(g, ti), parent: gid, kind: 'theme', grade: g.grade,
      title: th.title, summary: th.summary, sort: ti,
    });
    th.topics.forEach((tp, pi) => {
      add({
        slug: topicSlug(g, tp), parent: tid, kind: 'topic', grade: g.grade,
        code: tp.code, title: tp.title, summary: tp.summary, goals: tp.goals, sort: pi, type: tp.type,
      });
    });
  });
});

const aid = add({ slug: 'shkoli', kind: 'area', title: extras.title, summary: extras.summary, sort: 10 });
extras.pages.forEach((p, i) =>
  add({ slug: p.slug, parent: aid, kind: 'page', title: p.title, summary: p.summary, goals: p.goals, sort: i }),
);

const linkRows = links.map(
  ([category, title, url, description], i) =>
    `(${i + 1}, ${q(category)}, ${q(title)}, ${q(url)}, ${q(description)}, ${i})`,
);

// Таблиците — от schema.sql, по една команда
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  .replace(/--.*$/gm, '')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

// Учебната програма — две големи команди (по-малко заявки към базата)
const seed = [
  `INSERT OR IGNORE INTO sections (id, slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type) VALUES ${rows.join(',\n')}`,
  `INSERT OR IGNORE INTO links (id, category, title, url, description, sort) VALUES ${linkRows.join(',\n')}`,
];

// Пренареждане на клас в база, която вече работи (structure.grades).
// Уроците се намират по slug: съществуващите се местят и преименуват на място (текст, файлове,
// тестове и напредък остават към тях), новите се добавят. Стари уроци, които вече ги няма в
// програмата, се изтриват само ако са празни; иначе остават в края на темата си без номер.
const sync = [];
const UPSERT = `INSERT INTO sections (slug, parent_id, kind, grade, code, title, summary, goals, sort, lesson_type)
  VALUES (?, (SELECT id FROM sections WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET parent_id = excluded.parent_id, kind = excluded.kind, grade = excluded.grade,
    code = excluded.code, title = excluded.title, summary = excluded.summary, goals = excluded.goals,
    sort = excluded.sort, lesson_type = excluded.lesson_type`;
const params = (...v) => v.map((x) => (x === undefined ? null : x));
for (const g of grades.filter((x) => structure.grades.includes(x.grade))) {
  const gslug = `klas-${g.grade}`;
  sync.push(['UPDATE sections SET title = ?, summary = ? WHERE slug = ?', [g.title, g.summary, gslug]]);
  const keep = [];
  g.themes.forEach((th, ti) => {
    const ts = themeSlug(g, ti);
    sync.push([UPSERT, params(ts, gslug, 'theme', g.grade, null, th.title, th.summary, null, ti, null)]);
    th.topics.forEach((tp, pi) => {
      const s = topicSlug(g, tp);
      keep.push(s);
      sync.push([UPSERT, params(s, ts, 'topic', g.grade, tp.code, tp.title, tp.summary,
        tp.goals ? JSON.stringify(tp.goals) : null, pi, tp.type)]);
    });
  });
  const themes = g.themes.map((_, ti) => themeSlug(g, ti));
  const notIn = (list) => `slug NOT IN (${list.map((x) => q(x)).join(', ')})`;
  const empty = `(body IS NULL OR body = '')
    AND NOT EXISTS (SELECT 1 FROM materials m WHERE m.section_id = sections.id)
    AND NOT EXISTS (SELECT 1 FROM quizzes z WHERE z.section_id = sections.id)
    AND NOT EXISTS (SELECT 1 FROM tab_texts x WHERE x.section_id = sections.id AND x.body <> '')`;
  sync.push([`DELETE FROM lesson_views WHERE section_id IN (SELECT id FROM sections
    WHERE grade = ? AND kind = 'topic' AND ${notIn(keep)} AND ${empty})`, [g.grade]]);
  sync.push([`DELETE FROM section_revisions WHERE section_id IN (SELECT id FROM sections
    WHERE grade = ? AND kind = 'topic' AND ${notIn(keep)} AND ${empty})`, [g.grade]]);
  sync.push([`DELETE FROM tab_texts WHERE section_id IN (SELECT id FROM sections
    WHERE grade = ? AND kind = 'topic' AND ${notIn(keep)} AND ${empty})`, [g.grade]]);
  sync.push([`DELETE FROM sections WHERE grade = ? AND kind = 'topic' AND ${notIn(keep)} AND ${empty}`, [g.grade]]);
  sync.push([`UPDATE sections SET code = NULL, sort = 900 + sort WHERE grade = ? AND kind = 'topic' AND ${notIn(keep)} AND sort < 900`, [g.grade]]);
  sync.push([`DELETE FROM sections WHERE grade = ? AND kind = 'theme' AND ${notIn(themes)}
    AND NOT EXISTS (SELECT 1 FROM sections c WHERE c.parent_id = sections.id)`, [g.grade]]);
}

writeFileSync(
  new URL('../server/db-data.js', import.meta.url),
  `// Генерирано от db/build-seed.mjs — не редактирай на ръка\n` +
    `export const schema = ${JSON.stringify(schema, null, 1)};\n\n` +
    `export const seed = ${JSON.stringify(seed, null, 1)};\n\n` +
    `export const structureVersion = ${structure.version};\n\n` +
    `export const sync = ${JSON.stringify(sync, null, 1)};\n`,
);
console.log(`server/db-data.js: ${schema.length} таблици/индекса, ${id} раздела, ${links.length} връзки`);
