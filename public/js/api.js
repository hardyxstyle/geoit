// Връзка със сървъра
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Когато сървърът не е върнал наше съобщение (напр. лимит на Cloudflare)
export function errorText(status) {
  if (status === 503 || status === 500) return `Сървърът не успя да обработи заявката (грешка ${status}). Опитай пак след малко.`;
  if (status === 413) return 'Файлът е твърде голям за сървъра.';
  return `Нещо се обърка (грешка ${status}). Опитай пак.`;
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, 'Няма връзка със сървъра. Провери интернета и опитай пак.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || errorText(res.status));
  return data;
}
