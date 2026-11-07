// Материали към всеки таб на урока: списък, качване, линкове, промяна
import { api, ApiError, errorText } from './api.js';
import { state } from './app.js';
import { esc, $, toast, formatDate } from './ui.js';
import { fmtSize, kindOf, tagText, host, previewType, pool, isSiteFile, fileNameOf } from './files.js';
import { openMaterial, inlinePreview } from './viewer.js';

const isStaff = () => state.user && (state.user.role === 'teacher' || state.user.role === 'admin');

export const TAB_NAMES = { urok: 'Урок', karti: 'Карти и графики', zadachi: 'Задачи и тестове', materiali: 'Материали' };

const EMPTY = {
  urok: {
    staff: 'Качи готов урок като PDF, Word или презентация, или добави линк.',
    student: '',
  },
  karti: {
    staff: 'Качи карта, инфографика или диаграма (снимка или PDF), или добави линк към ArcGIS, Google Earth и т.н.',
    student: 'Към този урок още няма карти и графики.',
  },
  zadachi: {
    staff: 'Качи тест, работен лист или домашно. По-нататък тук ще може да се правят и тестове с автоматична проверка.',
    student: 'Към този урок още няма задачи.',
  },
  materiali: {
    staff: 'Качи презентация, работен лист или PDF, или добави линк към видео или карта.',
    student: 'Учителят още не е добавил материали към този урок.',
  },
};

// „vodi_afrika-urok.pdf“ → „vodi afrika-urok“
const niceTitle = (name) => name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();

export const typeTag = (m) => `<span class="ftag" data-t="${kindOf(m)}">${esc(tagText(m))}</span>`;

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

async function sendChunk(id, index, data) {
  let res;
  try {
    res = await fetch(`/api/materials/${id}/chunks/${index}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'text/plain', 'x-requested-with': 'geokompas' },
      body: data,
    });
  } catch {
    throw new ApiError(0, 'Връзката прекъсна. Провери интернета и опитай пак.');
  }
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new ApiError(res.status, j?.error || errorText(res.status));
  }
}

export async function uploadFile(section, file, meta, onProgress = () => {}) {
  const { id, chunkSize, chunks } = await api('/materials', {
    method: 'POST',
    body: { ...meta, section, kind: 'file', fileName: file.name, mime: file.type, size: file.size },
  });
  try {
    let done = 0;
    await pool(chunks, 4, async (i) => {
      const data = await toBase64(file.slice(i * chunkSize, Math.min(file.size, (i + 1) * chunkSize)));
      await retry(() => sendChunk(id, i, data));
      onProgress(++done / chunks);
    });
    await retry(() => api(`/materials/${id}/finish`, { method: 'POST' }));
  } catch (err) {
    api(`/materials/${id}`, { method: 'DELETE' }).catch(() => {});
    throw err;
  }
}

// ---------- Един ред от списъка ----------
export function itemHtml(m, { showSection = false, inline = false } = {}) {
  const site = isSiteFile(m);
  const meta = [m.author, site ? 'файл в сайта' : m.kind === 'link' ? host(m.url) : fmtSize(m.size), formatDate(m.createdAt)].filter(Boolean);
  const where =
    showSection && m.section
      ? `<a class="mat-where" href="/s/${esc(m.section.slug)}#${esc(m.tab || 'materiali')}" data-c="${m.section.grade || 'x'}">${m.section.grade ? m.section.grade + ' кл., ' : ''}${esc((m.section.code ? m.section.code + ' ' : '') + m.section.title)}</a>`
      : '';
  const canPreview = !!previewType(m);
  const isFile = m.kind === 'file' || site;
  const showInline = inline && canPreview && isFile && /^(pdf|image|docx)$/.test(previewType(m));
  const actions = [
    showInline ? '' : `<button class="btn ghost small" type="button" data-m="open" data-id="${m.id}">${canPreview || !isFile ? 'Отвори' : 'Изтегли'}</button>`,
    isFile && (canPreview || showInline) ? `<button class="btn ghost small" type="button" data-m="download" data-id="${m.id}">Изтегли</button>` : '',
    m.canEdit && !showSection
      ? `<button class="btn ghost small" type="button" data-m="edit" data-id="${m.id}">Промени</button>
         <button class="btn danger small" type="button" data-m="delete" data-id="${m.id}">Изтрий</button>`
      : '',
  ].join('');
  return `
    <li class="mat ${showInline ? 'with-inline' : ''}">
      ${typeTag(m)}
      <div class="mat-body">
        <strong class="mat-title">${esc(m.title)}</strong>
        ${m.description ? `<p class="mat-desc">${esc(m.description)}</p>` : ''}
        ${where}
        <span class="mat-meta">${meta.map(esc).join(', ')}${m.audience === 'teachers' ? '<span class="only-staff">Само за учители</span>' : ''}</span>
      </div>
      <div class="mat-actions">${actions}</div>
      ${showInline ? `<div class="inline-preview" data-preview="${m.id}"></div>` : ''}
    </li>`;
}

// „Отвори“ и „Изтегли“ работят навсякъде, където има списък
export function bindFileActions(root, getList) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-m="open"], [data-m="download"]');
    if (!btn) return;
    const m = getList().find((x) => x.id === Number(btn.dataset.id));
    if (!m) return;
    if (btn.dataset.m === 'open' && ((m.kind === 'link' && !isSiteFile(m)) || previewType(m))) return openMaterial(m);
    // изтегляне
    const label = btn.textContent;
    btn.disabled = true;
    try {
      const { fetchFile, saveBlob } = await import('./files.js');
      saveBlob(await fetchFile(m, (p) => (btn.textContent = `${Math.round(p * 100)}%`)), fileNameOf(m));
    } catch (err) {
      toast(err.message);
    } finally {
      btn.textContent = label;
      btn.disabled = false;
    }
  });
}

// ---------- Панел с материали за един таб ----------
// all — всички материали на урока; панелът показва само тези от своя таб
export function materialsPanel(root, { slug, tab, all, onChange, inline = false, compactEmpty = false }) {
  let everything = all;
  const staff = isStaff();
  const mine = () => everything.filter((m) => (m.tab || 'materiali') === tab);

  function draw() {
    const list = mine();
    const empty = staff ? EMPTY[tab].staff : EMPTY[tab].student;
    root.innerHTML = `
      <div class="mats">
        ${staff ? `
          <div class="mats-actions">
            <button class="btn ${tab === 'urok' ? 'ghost' : ''}" type="button" data-m="upload">${tab === 'urok' ? 'Качи готов урок (файл)' : 'Качи файл'}</button>
            <button class="btn ghost" type="button" data-m="link">Добави линк</button>
            <button class="btn ghost" type="button" data-m="site">Файл от сайта</button>
            <span class="drop-hint">или пусни файл тук</span>
          </div>` : ''}
        ${list.length
          ? `<ul class="mat-list">${list.map((m) => itemHtml(m, { inline })).join('')}</ul>`
          : compactEmpty
            ? (staff ? `<p class="muted">${esc(empty)}</p>` : '')
            : `<div class="empty"><strong>Още няма нищо тук</strong><span>${esc(empty)}</span></div>`}
      </div>
      <dialog class="mdlg"></dialog>`;
    if (inline) {
      root.querySelectorAll('[data-preview]').forEach((box) => {
        const m = list.find((x) => x.id === Number(box.dataset.preview));
        if (m) inlinePreview(box, m);
      });
    }
  }

  async function reload() {
    const data = await api('/materials?section=' + encodeURIComponent(slug));
    everything = data.materials;
    draw();
    onChange?.(everything);
  }

  // ---- Диалог за качване / линк / промяна ----
  function openForm(mode, m = null, file = null) {
    const dlg = $('.mdlg', root);
    const isSite = mode === 'site' || (m && isSiteFile(m));
    const isLink = !isSite && (mode === 'link' || m?.kind === 'link');
    const title = mode === 'edit' ? 'Промени материала' : isSite ? 'Файл от сайта' : isLink ? 'Добави линк' : 'Качи файл';
    const curTab = m?.tab || tab;
    dlg.innerHTML = `
      <h2>${title}</h2>
      <form class="form" novalidate>
        ${mode === 'upload' ? `
          <div class="field">
            <label for="mf-file">Файл</label>
            <input class="input" id="mf-file" name="file" type="file" required>
            <span class="hint storage-hint">До 25 MB.</span>
          </div>` : ''}
        ${isSite ? `
          <div class="field">
            <label for="mf-find">Избери файл</label>
            <input class="input" id="mf-find" type="search" placeholder="Търси по име или папка" autocomplete="off">
            <div class="site-files" role="listbox" aria-label="Файлове в сайта"><p class="muted">Зареждане…</p></div>
            <input type="hidden" name="url" value="${esc(m?.url || '')}">
            <span class="hint">Това са файловете от папка <b>public/files</b> в GitHub. Не заемат място в базата, но са публични — всеки, който има линка, може да ги отвори.</span>
          </div>` : ''}
        ${isLink ? `
          <div class="field"><label for="mf-url">Адрес</label>
            <input class="input" id="mf-url" name="url" type="url" inputmode="url" placeholder="https://" value="${esc(m?.url || '')}" required>
            <span class="hint">YouTube и Google Drive/Документи/Презентации се показват направо в сайта.</span></div>` : ''}
        <div class="field"><label for="mf-title">Заглавие</label>
          <input class="input" id="mf-title" name="title" maxlength="150" value="${esc(m?.title || '')}" required></div>
        <div class="field"><label for="mf-desc">Описание <span class="opt">(по желание)</span></label>
          <textarea class="input" id="mf-desc" name="description" rows="2" maxlength="1000">${esc(m?.description || '')}</textarea></div>
        <div class="row">
          <div class="field"><label for="mf-tab">Къде да стои</label>
            <select class="input" id="mf-tab" name="tab">
              ${Object.entries(TAB_NAMES).map(([k, v]) => `<option value="${k}" ${k === curTab ? 'selected' : ''}>${v}</option>`).join('')}
            </select></div>
          <div class="field"><label for="mf-aud">Кой го вижда</label>
            <select class="input" id="mf-aud" name="audience">
              <option value="all" ${m?.audience !== 'teachers' ? 'selected' : ''}>Всички</option>
              <option value="teachers" ${m?.audience === 'teachers' ? 'selected' : ''}>Само учители</option>
            </select></div>
        </div>
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

    if (isSite) {
      const box = $('.site-files', form);
      const hidden = form.querySelector('input[name="url"]');
      fetch('/files/index.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { files: [] }))
        .catch(() => ({ files: [] }))
        .then(({ files }) => {
          const draw = (q = '') => {
            const list = files.filter((f) => (f.folder + ' ' + f.name).toLowerCase().includes(q.toLowerCase()));
            box.innerHTML = list.length
              ? list.map((f) => `
                  <label class="site-file">
                    <input type="radio" name="sitefile" value="${esc(f.path)}" ${f.path === hidden.value ? 'checked' : ''}>
                    <span><strong>${esc(f.name)}</strong><small>${esc([f.folder, fmtSize(f.size)].filter(Boolean).join(', '))}</small></span>
                  </label>`).join('')
              : `<p class="muted">${files.length ? 'Няма файл с такова име.' : 'Още няма файлове в сайта. Качи ги в папка public/files в GitHub и изчакай 1–2 минути.'}</p>`;
          };
          draw();
          $('#mf-find', form).addEventListener('input', (e) => draw(e.target.value));
          box.addEventListener('change', (e) => {
            const f = files.find((x) => x.path === e.target.value);
            if (!f) return;
            hidden.value = f.path;
            if (!titleInput.value.trim() || titleInput.dataset.auto) {
              titleInput.value = niceTitle(f.name);
              titleInput.dataset.auto = '1';
            }
          });
          titleInput.addEventListener('input', () => delete titleInput.dataset.auto);
        });
    }

    const pickName = (f) => {
      if (f && !titleInput.value.trim()) titleInput.value = niceTitle(f.name);
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
      const prog = $('.progress', form);
      err.textContent = '';
      const data = Object.fromEntries(new FormData(form));
      const meta = { title: data.title, description: data.description, audience: data.audience, tab: data.tab };
      busy = true;
      submit.disabled = true;
      try {
        if (mode === 'edit') {
          await api('/materials/' + m.id, { method: 'PATCH', body: { ...meta, url: data.url } });
          toast('Промените са запазени.');
        } else if (isLink || isSite) {
          if (isSite && !data.url) throw new Error('Избери файл от списъка.');
          await api('/materials', { method: 'POST', body: { ...meta, section: slug, kind: 'link', url: data.url } });
          toast(isSite ? 'Файлът е добавен.' : 'Линкът е добавен.');
        } else {
          const f = fileInput.files[0];
          if (!f) throw new Error('Избери файл.');
          if (f.size > 25 * 1048576) throw new Error('Файлът е над 25 MB. Сложи го в Google Drive и добави линк към него.');
          if (!meta.title.trim()) meta.title = f.name;
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
        prog.hidden = true;
      } finally {
        busy = false;
        submit.disabled = false;
      }
    });
    dlg.showModal();
    (fileInput && !file ? fileInput : isSite && !m ? $('#mf-find', form) : isLink && !m ? $('#mf-url', form) : titleInput).focus();
  }

  function confirmDelete(m) {
    const dlg = $('.mdlg', root);
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
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-m]');
    if (!btn || !root.contains(btn)) return;
    const m = everything.find((x) => x.id === Number(btn.dataset.id));
    const act = btn.dataset.m;
    if (act === 'upload') openForm('upload');
    else if (act === 'link') openForm('link');
    else if (act === 'site') openForm('site');
    else if (act === 'edit' && m) openForm('edit', m);
    else if (act === 'delete' && m) confirmDelete(m);
  });
  bindFileActions(root, () => everything);

  if (staff) {
    root.addEventListener('dragover', (e) => {
      if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
      e.preventDefault();
      $('.mats', root)?.classList.add('dragging');
    });
    root.addEventListener('dragleave', (e) => {
      if (!root.contains(e.relatedTarget)) $('.mats', root)?.classList.remove('dragging');
    });
    root.addEventListener('drop', (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      $('.mats', root)?.classList.remove('dragging');
      openForm('upload', null, f);
    });
  }

  draw();
  return { open: (mode) => openForm(mode) };
}
