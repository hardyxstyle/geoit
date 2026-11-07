// Помощни функции за интерфейса

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let toastTimer;
export function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

export const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const roleName = { student: 'Ученик', teacher: 'Учител', admin: 'Администратор' };

export const classLabel = (u) => (u.grade ? `${u.grade}${u.classLetter || ''} клас` : '');

export function formatDate(s) {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z'));
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Иконки (рисувани на ръка, наследяват цвета на текста)
export const icon = {
  search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4.5 4.5"/></svg>',
  menu: '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14"/></svg>',
  map: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M8 16 23 10l18 6 15-6v38l-15 6-18-6-15 6z"/><path d="M23 10v38M41 16v38" opacity=".55"/><path d="M14 30c4-3 7 2 11-1s6-5 10-2 7 3 11 0" stroke-dasharray="3 3" opacity=".7"/></svg>',
  pin: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M32 56s16-15 16-28a16 16 0 0 0-32 0c0 13 16 28 16 28z"/><circle cx="32" cy="28" r="6"/></svg>',
  check: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="12" y="8" width="40" height="48" rx="4"/><path d="m20 24 4 4 8-8M20 40l4 4 8-8M38 25h6M38 41h6"/></svg>',
  folder: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M8 18a4 4 0 0 1 4-4h12l5 6h23a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"/><path d="M8 26h48" opacity=".55"/></svg>',
  book: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M32 16c-6-4-14-5-22-4v36c8-1 16 0 22 4 6-4 14-5 22-4V12c-8-1-16 0-22 4z"/><path d="M32 16v36"/></svg>',
};

// ---------- Релефът в началото ----------
// Детерминистични „хоризонтали“ на остров — без случайни числа, винаги еднакъв.
function blob(cx, cy, R, i) {
  const pts = [];
  const N = 72;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    const r =
      R *
      (1 +
        0.13 * Math.sin(2 * a + 0.6) +
        0.07 * Math.sin(3 * a + 1.9 + i * 0.22) +
        0.045 * Math.sin(5 * a + 0.4 + i * 0.35) +
        0.02 * Math.sin(9 * a + i));
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a) * 0.86]);
  }
  // Затворена Catmull-Rom крива → кубични Безие
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let k = 0; k < N; k++) {
    const p0 = pts[(k - 1 + N) % N], p1 = pts[k], p2 = pts[(k + 1) % N], p3 = pts[(k + 2) % N];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

export function reliefSvg() {
  const fills = ['--h-shallow', '--h-low', '--h-plain', '--h-hill', '--h-up', '--h-mount', '--h-peak'];
  const rings = fills
    .map((f, i) => {
      const d = blob(232 + i * 7, 210 - i * 6, 178 - i * 25, i);
      return `<path class="fill" style="--i:${i}" d="${d}" fill="var(${f})"/>
              <path class="ring" style="--i:${i}" d="${d}" fill="none" stroke="var(--h-line)" stroke-width="${i === 1 ? 1.6 : 1}" ${i === 0 ? 'stroke-dasharray="4 4"' : ''}/>`;
    })
    .join('');
  return `
  <svg class="relief" viewBox="0 0 460 400" role="img" aria-label="Карта на въображаем остров с хоризонтали">
    <rect x="0" y="0" width="460" height="400" rx="18" fill="var(--h-deep)"/>
    ${rings}
    <g fill="var(--ink)" font-family="Onest, sans-serif">
      <path d="M269 178l6 -11 6 11z"/>
      <text x="285" y="177" font-size="12" font-weight="600">2925 м</text>
      <text x="40" y="58" font-size="12" fill="var(--ink-soft)" font-style="italic">Залив на въпросите</text>
    </g>
    <g transform="translate(34 356)" fill="var(--ink)" font-family="Onest, sans-serif" font-size="10">
      <rect width="40" height="6" fill="var(--ink)"/><rect x="40" width="40" height="6" fill="none" stroke="var(--ink)"/>
      <rect x="80" width="40" height="6" fill="var(--ink)"/>
      <text y="-5">0</text><text x="36" y="-5">50</text><text x="72" y="-5">100 км</text>
    </g>
    <g transform="translate(416 52)" fill="none" stroke="var(--ink)" stroke-width="1.4">
      <circle r="16"/><path d="M0 -12 4 0 0 12 -4 0z" fill="var(--ink)" stroke="none"/>
      <text y="-22" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)" stroke="none" font-family="Onest, sans-serif">С</text>
    </g>
  </svg>`;
}

export function animateRelief(root) {
  $$('.relief .ring', root).forEach((p) => p.style.setProperty('--len', Math.ceil(p.getTotalLength())));
}

// ---------- Зареждане на библиотеки при нужда ----------
const loaded = new Map();
export function loadScript(src) {
  if (!loaded.has(src)) {
    loaded.set(
      src,
      new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => {
          loaded.delete(src);
          reject(new Error('Не успях да заредя нужната част от сайта. Провери интернета и опитай пак.'));
        };
        document.head.append(s);
      }),
    );
  }
  return loaded.get(src);
}

export function loadCss(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.append(l);
  }
}

// ---------- Безопасен HTML (текстът на урока, внесени Word файлове) ----------
// Вградени видеа и карти — само от тези сайтове
const IFRAME_HOSTS = /^(www\.)?(youtube(-nocookie)?\.com|player\.vimeo\.com|drive\.google\.com|docs\.google\.com|([a-z0-9-]+\.)*arcgis\.com|www\.google\.com)$/;

export async function sanitizeHtml(html) {
  await loadScript('/vendor/purify-3.2.6.min.js');
  const P = window.DOMPurify;
  if (!P.__gk) {
    P.addHook('uponSanitizeElement', (node, data) => {
      if (data.tagName === 'iframe') {
        let ok = false;
        try {
          const u = new URL(node.getAttribute('src') || '', location.href);
          ok = u.protocol === 'https:' && IFRAME_HOSTS.test(u.hostname);
        } catch {
          ok = false;
        }
        if (!ok) node.parentNode?.removeChild(node);
      }
    });
    // Връзките се отварят в същия прозорец
    P.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.removeAttribute('target');
        node.setAttribute('rel', 'noopener');
      }
      if (node.tagName === 'IFRAME') {
        node.setAttribute('allowfullscreen', '');
        node.setAttribute('loading', 'lazy');
      }
    });
    P.__gk = true;
  }
  return P.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allowfullscreen', 'frameborder', 'allow'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpe?g|gif|webp);base64,|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

// ---------- Снимки: смаляване преди запис ----------
export async function shrinkImage(blob, max = 1280, quality = 0.82) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Снимката не може да се отвори.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const small = blob.size < 180 * 1024 && scale === 1 && /^image\/(png|jpe?g|gif|webp)$/.test(blob.type);
    if (small) {
      return await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
      });
    }
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
