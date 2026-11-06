// Материали: списък, качване, линкове, отваряне и изтегляне
import { api } from './api.js';
import { state } from './app.js';
import { esc, $, toast, formatDate } from './ui.js';

const isStaff = () => state.user && (state.user.role === 'teacher' || state.user.role === 'admin');

export const fmtSize = (b) =>
  b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`;

const ext = (name) => ((name || '').match(/\.([a-z0-9]{1,5})$/i)?.[1] || '').toLowerCase();

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
const kindOf = (m) => (m.kind === 'link' ? 'link' : KINDS.find(([, re]) => re.test(ext(m.fileName)))?.[0] || 'other');
const tagText = (m) => (m.kind === 'link' ? 'Линк' : ext(m.fileName).toUpperCase().slice(0, 4) || 'Файл');

// Само тези типове се отварят в нов раздел; всичко останало се изтегля (по-безопасно)
const OPENABLE = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|video\/(mp4|webm)|audio\/(mpeg|mp4|ogg|wav))$/;
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

export const typeTag = (m) => `<span class="ftag" data-t="${kindOf(m)}">${esc(tagText(m))}</span>`;

// ---------- Изтегляне ----------
const cache = new Map(); // id → Blob, за да не тегли втори път

async function pool(n, limit, job) {
  let next = 0;
  const run = async () => {
    while (next < n) await job(next++);
  };
  await Promise.all(Array.from({ length: Math.min(limit, n) }, run));
}

async function fetchFile(m, onProgress) {
  if (cache.has(m.id)) return cache.get(m.id);
  const parts = new Array(m.chunks);
  let done = 0;
  await pool(m.chunks, 3, async (i) => {
    const res = await fetch(`/api/materials/${m.id}/chunks/${i}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Файлът не можа да се изтегли. Опитай пак.');
    const b64 = await res.text();
    parts[i] = await (await fetch('data:application/octet-stream;base64,' + b64)).arrayBuffer();
    onProgress(++done / m.chunks);
  });
  const blob = new Blob(parts, { type: OPENABLE.test(m.mime) ? m.mime : 'application/octet-stream' });
  cache.set(m.id, blob);
  return blob;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function getFile(m, btn, open) {
  // Прозорецът се отваря веднага при клика, иначе браузърът го блокира
  const win = open ? window.open('', '_blank') : null;
  if (win) win.document.title = 'Зареждане…';
  const label = btn.textContent;
  btn.disabled = true;
  try {
    const blob = await fetchFile(m, (p) => (btn.textContent = `${Math.round(p * 100)}%`));
    if (win) {
      const url = URL.createObjectURL(blob);
      win.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 300_000);
    } else saveBlob(blob, m.fileName);
  } catch (err) {
    win?.close();
    toast(err.message);
  } finally {
    btn.textContent = label;
    btn.disabled = false;
  }
}

// ---------- Качване ----------
const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Файлът не може да се прочете.'));
    r.readAsDataURL(blob);
  });

async function retry(fn, times = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= times || (err.status && err.status < 500 && err.status !== 429)) throw err;
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
}

async function uploadFile(section, file, meta, onProgress) {
  const { id, chunkSize, chunks } = await api('/materials', {
    method: 'POST',
    body: { ...meta, section, kind: 'file', fileName: file.name, mime: file.type, size: file.size },
  });
  try {
    let done = 0;
    await pool(chunks, 3, async (i) => {
      const data = await toBase64(file.slice(i * chunkSize, Math.min(file.size, (i + 1) * chunkSize)));
      await retry(() => api(`/materials/${id}/chunks`, { method: 'POST', body: { index: i, data } }));
      onProgress(++done / chunks);
    });
    await retry(() => api(`/materials/${id}/finish`, { method: 'POST' }));
  } catch (err) {
    api(`/materials/${id}`, { method: 'DELETE' }).catch(() => {});
    throw err;
  }
}

// ---------- Един ред от списъка ----------
export function itemHtml(m, { showSection = false } = {}) {
  const meta = [
    m.author,
    m.kind === 'link' ? host(m.url) : fmtSize(m.size),
    formatDate(m.createdAt),
  ].filter(Boolean);
  const where = showSection && m.section
    ? `<a class="mat-where" href="/s/${esc(m.section.slug)}#materiali" data-c="${m.section.grade || 'x'}">${m.section.grade ? m.section.grade + ' кл., ' : ''}${esc((m.section.code ? m.section.code + ' ' : '') + m.section.title)}</a>`
    : '';
  const actions =
    m.kind === 'link'
      ? `<a class="btn ghost small" href="${esc(m.url)}" target="_blank" rel="noopener">Отвори</a>`
      : `${OPENABLE.test(m.mime) ? `<button class="btn ghost small" type="button" data-m="open" data-id="${m.id}">Отвори</button>` : ''}
         <button class="btn ghost small" type="button" data-m="download" data-id="${m.id}">Изтегли</button>`;
  return `
    <li class="mat">
      ${typeTag(m)}
      <div class="mat-body">
        <strong class="mat-title">${esc(m.title)}</strong>
        ${m.description ? `<p class="mat-desc">${esc(m.description)}</p>` : ''}
        ${where}
        <span class="mat-meta">${meta.map(esc).join(', ')}${m.audience === 'teachers' ? '<span class="only-staff">Само за учители</span>' : ''}</span>
      </div>
      <div class="mat-actions">
        ${actions}
        ${m.canEdit && !showSection ? `<button class="btn ghost small" type="button" data-m="edit" data-id="${m.id}">Промени</button>
          <button class="btn danger small" type="button" data-m="delete" data-id="${m.id}">Изтрий</button>` : ''}
      </div>
    </li>`;
}

// Действията „Отвори“ и „Изтегли“ работят навсякъде, където има списък
export function bindFileActions(root, getList) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-m="open"], [data-m="download"]');
    if (!btn) return;
    const m = getList().find((x) => x.id === Number(btn.dataset.id));
    if (m) getFile(m, btn, btn.dataset.m === 'open');
  });
}

// ---------- Панелът към урока ----------
export function materialsPanel(panel, { slug, materials, onChange }) {
  let list = materials;
  const staff = isStaff();

  function draw() {
    panel.innerHTML = `
      <div class="mats ${staff ? 'droppable' : ''}">
        ${staff ? `
          <div class="mats-actions">
            <button class="btn" type="button" data-m="upload">Качи файл</button>
            <button class="btn ghost" type="button" data-m="link">Добави линк</button>
            <span class="drop-hint">или пусни файл тук</span>
          </div>` : ''}
        ${list.length
          ? `<ul class="mat-list">${list.map((m) => itemHtml(m)).join('')}</ul>`
          : `<div class="empty"><strong>Още няма материали</strong>
              <span>${staff ? 'Качи презентация, работен лист или PDF, или добави линк към видео или карта.' : 'Учителят още не е добавил материали към този урок.'}</span></div>`}
      </div>
      <dialog class="mdlg"></dialog>`;
  }

  async function reload() {
    const data = await api('/materials?section=' + encodeURIComponent(slug));
    list = data.materials;
    draw();
    onChange?.(list);
  }

  // ---- Диалог за качване / линк / промяна ----
  async function openForm(mode, m = null, file = null) {
    const dlg = $('.mdlg', panel);
    const isLink = mode === 'link' || m?.kind === 'link';
    const title = mode === 'edit' ? 'Промени материала' : isLink ? 'Добави линк' : 'Качи файл';
    dlg.innerHTML = `
      <h2>${title}</h2>
      <form class="form" novalidate>
        ${mode === 'upload' ? `
          <div class="field">
            <label for="mf-file">Файл</label>
            <input class="input" id="mf-file" name="file" type="file" required>
            <span class="hint storage-hint">До 25 MB.</span>
          </div>` : ''}
        ${isLink ? `
          <div class="field"><label for="mf-url">Адрес</label>
            <input class="input" id="mf-url" name="url" type="url" inputmode="url" placeholder="https://" value="${esc(m?.url || '')}" required>
            <span class="hint">Видео в YouTube, папка в Google Drive, карта в ArcGIS и т.н.</span></div>` : ''}
        <div class="field"><label for="mf-title">Заглавие</label>
          <input class="input" id="mf-title" name="title" maxlength="150" value="${esc(m?.title || '')}" required></div>
        <div class="field"><label for="mf-desc">Описание <span class="opt">(по желание)</span></label>
          <textarea class="input" id="mf-desc" name="description" rows="2" maxlength="1000">${esc(m?.description || '')}</textarea></div>
        <fieldset class="field" style="border:0;padding:0;margin:0">
          <legend class="label" style="margin-bottom:.35rem">Кой го вижда</legend>
          <div class="segmented">
            <input type="radio" id="mf-all" name="audience" value="all" ${m?.audience !== 'teachers' ? 'checked' : ''}><label for="mf-all">Всички</label>
            <input type="radio" id="mf-t" name="audience" value="teachers" ${m?.audience === 'teachers' ? 'checked' : ''}><label for="mf-t">Само учители</label>
          </div>
        </fieldset>
        <div class="progress" hidden><div class="bar"></div><span class="ptext"></span></div>
        <div class="error-box" role="alert"></div>
        <div class="buttons">
          <button class="btn ghost" type="button" data-close>Отказ</button>
          <button class="btn" type="submit">${mode === 'edit' ? 'Запази' : mode === 'upload' ? 'Качи' : 'Добави'}</button>
        </div>
      </form>`;
    const form = $('form', dlg);
    const fileInput = $('#mf-file', form);
    const titleInput = $('#mf-title', form);
    let busy = false;

    const pickName = (f) => {
      if (f && !titleInput.value.trim()) titleInput.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    };
    if (fileInput) {
      if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        pickName(file);
      }
      fileInput.addEventListener('change', () => pickName(fileInput.files[0]));
      api('/materials/storage')
        .then(({ used, limit }) => {
          $('.storage-hint', form).textContent = `До 25 MB. Свободно място: ${fmtSize(limit - used)} от ${fmtSize(limit)}.`;
        })
        .catch(() => {});
    }

    $('[data-close]', form).addEventListener('click', () => !busy && dlg.close());
    dlg.addEventListener('cancel', (e) => busy && e.preventDefault());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('.error-box', form);
      const submit = $('button[type="submit"]', form);
      err.textContent = '';
      const data = Object.fromEntries(new FormData(form));
      const meta = { title: data.title, description: data.description, audience: data.audience };
      busy = true;
      submit.disabled = true;
      try {
        if (mode === 'edit') {
          await api('/materials/' + m.id, { method: 'PATCH', body: { ...meta, url: data.url } });
          toast('Промените са запазени.');
        } else if (isLink) {
          await api('/materials', { method: 'POST', body: { ...meta, section: slug, kind: 'link', url: data.url } });
          toast('Линкът е добавен.');
        } else {
          const f = fileInput.files[0];
          if (!f) throw new Error('Избери файл.');
          if (f.size > 25 * 1048576) throw new Error('Файлът е над 25 MB. Сложи го в Google Drive и добави линк към него.');
          if (!meta.title.trim()) meta.title = f.name;
          const prog = $('.progress', form);
          prog.hidden = false;
          await uploadFile(slug, f, meta, (p) => {
            $('.bar', prog).style.width = `${Math.round(p * 100)}%`;
            $('.ptext', prog).textContent = `Качване… ${Math.round(p * 100)}%`;
          });
          toast('Файлът е качен.');
        }
        busy = false;
        dlg.close();
        await reload();
      } catch (ex) {
        err.textContent = ex.message;
        $('.progress', form) && ($('.progress', form).hidden = true);
      } finally {
        busy = false;
        submit.disabled = false;
      }
    });
    dlg.showModal();
    (fileInput && !file ? fileInput : isLink && !m ? $('#mf-url', form) : titleInput).focus();
  }

  function confirmDelete(m) {
    const dlg = $('.mdlg', panel);
    dlg.innerHTML = `<h2>Изтрий материала?</h2>
      <p>„${esc(m.title)}“ ще изчезне за всички. Това не може да се върне.</p>
      <div class="buttons"><button class="btn ghost" type="button" data-close>Отказ</button>
      <button class="btn danger" type="button" data-yes>Изтрий</button></div>`;
    $('[data-close]', dlg).addEventListener('click', () => dlg.close());
    $('[data-yes]', dlg).addEventListener('click', async () => {
      try {
        await api('/materials/' + m.id, { method: 'DELETE' });
        dlg.close();
        toast('Материалът е изтрит.');
        await reload();
      } catch (ex) {
        toast(ex.message);
      }
    });
    dlg.showModal();
  }

  // ---- Събития ----
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-m]');
    if (!btn || !panel.contains(btn)) return;
    const m = list.find((x) => x.id === Number(btn.dataset.id));
    const act = btn.dataset.m;
    if (act === 'upload') openForm('upload');
    else if (act === 'link') openForm('link');
    else if (act === 'edit' && m) openForm('edit', m);
    else if (act === 'delete' && m) confirmDelete(m);
  });
  bindFileActions(panel, () => list);

  if (staff) {
    panel.addEventListener('dragover', (e) => {
      if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
      e.preventDefault();
      $('.mats', panel)?.classList.add('dragging');
    });
    panel.addEventListener('dragleave', (e) => {
      if (!panel.contains(e.relatedTarget)) $('.mats', panel)?.classList.remove('dragging');
    });
    panel.addEventListener('drop', (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      $('.mats', panel)?.classList.remove('dragging');
      openForm('upload', null, f);
    });
  }

  draw();
}

