// Общи неща за файловете: вид, размер, изтегляне от базата на части

export const fmtSize = (b) =>
  b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`;

export const ext = (name) => ((name || '').match(/\.([a-z0-9]{1,5})$/i)?.[1] || '').toLowerCase();

// Вид на файла → етикет и цвят (вместо иконки)
const KINDS = [
  ['pdf', /^pdf$/],
  ['pres', /^(pptx?|odp|key|pps|ppsx)$/],
  ['doc', /^(docx?|odt|rtf|txt|pages)$/],
  ['sheet', /^(xlsx?|ods|csv|numbers)$/],
  ['img', /^(png|jpe?g|gif|webp|svg|heic|bmp|tiff?)$/],
  ['media', /^(mp4|webm|mov|mp3|wav|m4a|ogg)$/],
  ['map', /^(kmz|kml|geojson|gpx|shp|zip)$/],
];
export const kindOf = (m) => (m.kind === 'link' ? 'link' : KINDS.find(([, re]) => re.test(ext(m.fileName)))?.[0] || 'other');
export const tagText = (m) => (m.kind === 'link' ? 'Линк' : ext(m.fileName).toUpperCase().slice(0, 4) || 'Файл');

export const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

// Какво можем да покажем направо в сайта
export function previewType(m) {
  if (m.kind === 'link') return embedUrl(m.url) ? 'embed' : null;
  const e = ext(m.fileName);
  if (e === 'pdf') return 'pdf';
  if (/^(png|jpe?g|gif|webp)$/.test(e)) return 'image';
  if (/^(mp4|webm|mov)$/.test(e)) return 'video';
  if (/^(mp3|wav|m4a|ogg)$/.test(e)) return 'audio';
  if (e === 'docx') return 'docx';
  if (e === 'txt') return 'text';
  return null;
}

// Линкове, които могат да се вградят в страницата
export function embedUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const h = u.hostname.replace(/^(www\.|m\.)/, '');
  if (h === 'youtube.com' || h === 'youtu.be') {
    const id = h === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.match(/\/(embed|shorts|live)\/([\w-]+)/)?.[2];
    if (!id) return null;
    const t = parseInt(u.searchParams.get('t') || u.searchParams.get('start') || '0', 10);
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}${t ? `?start=${t}` : ''}`;
  }
  if (h === 'vimeo.com') {
    const id = u.pathname.match(/^\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (h === 'drive.google.com') {
    const id = u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1];
    return id ? `https://drive.google.com/file/d/${id}/preview` : null;
  }
  if (h === 'docs.google.com') {
    const m = u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([\w-]+)/);
    if (!m) return null;
    return `https://docs.google.com/${m[1]}/d/${m[2]}/${m[1] === 'presentation' ? 'embed' : 'preview'}`;
  }
  if (h.endsWith('arcgis.com') && u.protocol === 'https:') return u.href;
  return null;
}

// ---------- Изтегляне на файл от базата ----------
const cache = new Map(); // id → Blob, за да не тегли втори път

export async function pool(n, limit, job) {
  let next = 0;
  const run = async () => {
    while (next < n) await job(next++);
  };
  await Promise.all(Array.from({ length: Math.min(limit, n) }, run));
}

const SAFE_MIME = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp4|ogg|wav|x-m4a)|text\/plain)$/;

export async function fetchFile(m, onProgress = () => {}) {
  if (cache.has(m.id)) return cache.get(m.id);
  const parts = new Array(m.chunks);
  let done = 0;
  await pool(m.chunks, 4, async (i) => {
    const res = await fetch(`/api/materials/${m.id}/chunks/${i}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Файлът не можа да се изтегли (грешка ${res.status}). Опитай пак.`);
    const b64 = await res.text();
    parts[i] = await (await fetch('data:application/octet-stream;base64,' + b64)).arrayBuffer();
    onProgress(++done / m.chunks);
  });
  const blob = new Blob(parts, { type: SAFE_MIME.test(m.mime) ? m.mime : 'application/octet-stream' });
  cache.set(m.id, blob);
  return blob;
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
