// Генерира server/db-data.js от db/schema.sql и db/curriculum.mjs.
// Сайтът сам създава таблиците и попълва учебната програма при първото отваряне,
// когато базата е празна. Пусни `npm run db:build` само ако промениш тези два файла.
import { readFileSync, writeFileSync } from 'node:fs';
import { grades, extras, links } from './curriculum.mjs';

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const rows = [];
let id = 0;

const add = (s) => {
  id += 1;
  rows.push(
    '(' +
      [id, q(s.slug), s.parent ?? 'NULL', q(s.kind), s.grade ?? 'NULL', q(s.code), q(s.title), q(s.summary),
        q(s.goals ? JSON.stringify(s.goals) : null), s.sort].join(', ') +
      ')',
  );
  return id;
};

grades.forEach((g, gi) => {
  const gid = add({ slug: `klas-${g.grade}`, kind: 'grade', grade: g.grade, title: g.title, summary: g.summary, sort: gi });
  g.themes.forEach((th, ti) => {
    const tid = add({
      slug: `klas-${g.grade}-tema-${ti + 1}`, parent: gid, kind: 'theme', grade: g.grade,
      title: th.title, summary: th.summary, sort: ti,
    });
    th.topics.forEach((tp, pi) => {
      add({
        slug: `klas-${g.grade}-${tp.code.replace('.', '-')}`, parent: tid, kind: 'topic', grade: g.grade,
        code: tp.code, title: tp.title, goals: tp.goals, sort: pi,
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
  `INSERT OR IGNORE INTO sections (id, slug, parent_id, kind, grade, code, title, summary, goals, sort) VALUES ${rows.join(',\n')}`,
  `INSERT OR IGNORE INTO links (id, category, title, url, description, sort) VALUES ${linkRows.join(',\n')}`,
];

writeFileSync(
  new URL('../server/db-data.js', import.meta.url),
  `// Генерирано от db/build-seed.mjs — не редактирай на ръка\n` +
    `export const schema = ${JSON.stringify(schema, null, 1)};\n\n` +
    `export const seed = ${JSON.stringify(seed, null, 1)};\n`,
);
console.log(`server/db-data.js: ${schema.length} таблици/индекса, ${id} раздела, ${links.length} връзки`);
