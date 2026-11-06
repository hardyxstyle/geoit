// Малки помощни функции за отговори и грешки

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const fail = (status, message) => {
  throw new HttpError(status, message);
};

export async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  // Изискваме JSON — така браузърът не може да изпрати заявка от чужд сайт без разрешение (защита от CSRF)
  if (!type.includes('application/json')) fail(415, 'Заявката трябва да е JSON.');
  try {
    return await request.json();
  } catch {
    fail(400, 'Невалиден JSON.');
  }
}

export const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
