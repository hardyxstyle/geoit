// Автоматично създаване и обновяване на базата.
// При първата заявка след deploy пускаме всички CREATE ... IF NOT EXISTS —
// така нови таблици се добавят сами, без команди. Учебната програма влиза само в празна база.
import { schema, seed, sync, structureVersion } from './db-data.js';
import { HttpError } from './http.js';

// Нови колони в съществуващи таблици: [таблица, колона, команда]
const COLUMNS = [
  ['materials', 'chunk_size', 'ALTER TABLE materials ADD COLUMN chunk_size INTEGER'],
  ['materials', 'tab', "ALTER TABLE materials ADD COLUMN tab TEXT NOT NULL DEFAULT 'materiali'"],
  ['sections', 'body_text', 'ALTER TABLE sections ADD COLUMN body_text TEXT'],
  ['section_revisions', 'tab', "ALTER TABLE section_revisions ADD COLUMN tab TEXT NOT NULL DEFAULT 'urok'"],
  ['sections', 'lesson_type', 'ALTER TABLE sections ADD COLUMN lesson_type TEXT'],
];

const SET_VERSION = "INSERT INTO meta (key, value) VALUES ('structure', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value";

let ready = false;

export async function ensureDb(env) {
  if (ready) return;
  if (!env.DB) {
    throw new HttpError(
      503,
      'Базата не е свързана. В Cloudflare: проектът → Settings → Bindings → добави D1 база с име DB и направи нов deploy.',
    );
  }
  await env.DB.batch(schema.map((s) => env.DB.prepare(s)));
  for (const [table, column, sql] of COLUMNS) {
    const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    if (!results.some((c) => c.name === column)) await env.DB.prepare(sql).run();
  }
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM sections').first();
  if (n === 0) {
    // Празна база: програмата влиза направо в новия вид
    await env.DB.batch([...seed.map((s) => env.DB.prepare(s)), env.DB.prepare(SET_VERSION).bind(String(structureVersion))]);
  } else {
    // Работеща база: пренареждаме уроците веднъж — всичко или нищо (batch е транзакция)
    const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'structure'").first();
    if (Number(row?.value || 0) < structureVersion) {
      await env.DB.batch([
        ...sync.map(([sql, args]) => env.DB.prepare(sql).bind(...args)),
        env.DB.prepare(SET_VERSION).bind(String(structureVersion)),
      ]);
    }
  }
  ready = true;
}
