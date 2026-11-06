// Автоматично създаване на базата при първото отваряне на сайта
import { schema, seed } from './db-data.js';
import { HttpError } from './http.js';

let ready = false;

export async function ensureDb(env) {
  if (ready) return;
  if (!env.DB) {
    throw new HttpError(
      503,
      'Базата не е свързана. В Cloudflare: проектът → Settings → Bindings → добави D1 база с име DB и направи нов deploy.',
    );
  }
  const has = await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'links'").first();
  if (!has) await env.DB.batch(schema.map((s) => env.DB.prepare(s)));
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM sections').first();
  if (n === 0) await env.DB.batch(seed.map((s) => env.DB.prepare(s)));
  ready = true;
}
