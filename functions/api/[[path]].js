// Единна входна точка за /api/* (Cloudflare Pages Functions)
import { json, HttpError } from '../../server/http.js';
import * as auth from '../../server/routes-auth.js';
import * as users from '../../server/routes-users.js';
import * as content from '../../server/routes-content.js';
import { ensureDb } from '../../server/setup.js';

// [метод, шаблон, обработчик]; :x хваща част от адреса
const routes = [
  ['POST', '/api/auth/register', auth.register],
  ['POST', '/api/auth/login', auth.login],
  ['POST', '/api/auth/logout', auth.logout],
  ['GET', '/api/me', auth.me],
  ['POST', '/api/me/password', auth.changePassword],

  ['GET', '/api/users', users.listUsers],
  ['POST', '/api/users/:id/approve', users.approveUser],
  ['POST', '/api/users/:id/block', users.blockUser],
  ['POST', '/api/users/:id/unblock', users.unblockUser],
  ['POST', '/api/users/:id/reset-password', users.resetPassword],
  ['PATCH', '/api/users/:id', users.updateUser],
  ['DELETE', '/api/users/:id', users.deleteUser],

  ['GET', '/api/overview', content.overview],
  ['GET', '/api/sections/:slug', content.section],
  ['GET', '/api/links', content.links],
  ['GET', '/api/search', content.search],
];

function match(pattern, path) {
  const a = pattern.split('/');
  const b = path.split('/');
  if (a.length !== b.length) return null;
  const params = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params.push(decodeURIComponent(b[i]));
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export async function onRequest({ request, env }) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  // Всяка промяна идва като JSON — защита от заявки, пуснати от чужди сайтове (CSRF)
  if (request.method !== 'GET' && !(request.headers.get('content-type') || '').includes('application/json')) {
    return json({ error: 'Заявката трябва да е JSON.' }, 415);
  }
  try {
    await ensureDb(env);
    let methodMismatch = false;
    for (const [method, pattern, handler] of routes) {
      const params = match(pattern, path);
      if (!params) continue;
      if (method !== request.method) {
        methodMismatch = true;
        continue;
      }
      return await handler(env, request, ...params);
    }
    return json({ error: methodMismatch ? 'Методът не е позволен.' : 'Няма такъв адрес.' }, methodMismatch ? 405 : 404);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: 'Нещо се обърка на сървъра. Опитай пак след малко.' }, 500);
  }
}
