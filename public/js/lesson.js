// Таб „Урок“: текстът на урока (писане в сайта или внасяне от Word) + готови файлове
import { api } from './api.js';
import { state } from './app.js';
import { esc, $, toast, formatDate, loadScript, loadCss, sanitizeHtml, shrinkImage } from './ui.js';
import { materialsPanel } from './materials.js';

const QUILL_JS = '/vendor/quill-2.0.3.js';
const QUILL_CSS = '/vendor/quill-2.0.3.snow.css';
const MAMMOTH = '/vendor/mammoth-1.9.1.min.js';
const MAX_BODY = 1_400_000;

const isStaff = () => state.user && (state.user.role === 'teacher' || state.user.role === 'admin');

// Има ли незапазени промени — проверява се преди да се напусне страницата
let dirty = false;
export const hasUnsavedLesson = () => dirty;
window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------- Word (.docx) → HTML ----------
async function wordToHtml(file) {
  if (!/\.docx$/i.test(file.name)) {
    throw new Error('Може да се внесе само .docx файл. Ако е стар .doc, отвори го в Word и го запази като .docx.');
  }
  await loadScript(MAMMOTH);
  const mammoth = window.mammoth;
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          const b64 = await image.read('base64');
          const blob = await (await fetch(`data:${image.contentType};base64,${b64}`)).blob();
          return { src: await shrinkImage(blob) };
        } catch {
          return { src: '' }; // снимки, които браузърът не може да отвори (напр. EMF)
        }
      }),
    },
  );
  const div = document.createElement('div');
  div.innerHTML = await sanitizeHtml(value);
  div.querySelectorAll('img:not([src]), img[src=""]').forEach((i) => i.remove());
  // Заглавията от Word стават заглавия от редактора: Заглавие 1 → голямо, останалите → малко
  div.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    const n = document.createElement(h.tagName === 'H1' ? 'h2' : 'h3');
    n.innerHTML = h.innerHTML;
    h.replaceWith(n);
  });
  return div.innerHTML;
}

const pickFile = (accept) =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });

// ---------- Панелът ----------
export function lessonPanel(root, { section, materials, onMaterialsChange }) {
  const staff = isStaff();
  let all = materials;
  let quill = null;

  async function view() {
    dirty = false;
    quill = null;
    const hasFiles = all.some((m) => (m.tab || 'materiali') === 'urok');
    root.innerHTML = `
      <div class="lesson">
        ${staff ? `
          <div class="lesson-tools">
            <button class="btn" type="button" data-l="edit">${section.body ? 'Редактирай урока' : 'Напиши урока'}</button>
            <button class="btn ghost" type="button" data-l="word">Внеси от Word</button>
            ${section.body ? '<button class="btn ghost" type="button" data-l="history">Предишни версии</button>' : ''}
          </div>` : ''}
        ${section.body
          ? `<article class="prose lesson-body"></article>
             ${section.updatedBy ? `<p class="edited">Последна промяна: ${esc(section.updatedBy)}, ${formatDate(section.updatedAt)}</p>` : ''}`
          : !staff && !hasFiles
            ? `<div class="empty"><strong>Урокът още не е добавен</strong><span>Учителят ще го напише или качи скоро.</span></div>`
            : staff && !hasFiles
              ? `<div class="empty lesson-start"><strong>Урокът още е празен</strong>
                   <span>Напиши го тук, внеси го от Word файл или качи готов урок като PDF или презентация.</span></div>`
              : ''}
        <div class="lesson-files"></div>
      </div>
      <dialog class="ldlg"></dialog>`;
    if (section.body) $('.lesson-body', root).innerHTML = await sanitizeHtml(section.body);
    materialsPanel($('.lesson-files', root), {
      slug: section.slug,
      tab: 'urok',
      all,
      inline: true,
      compactEmpty: true,
      onChange: (list) => {
        all = list;
        onMaterialsChange?.(list);
      },
    });
  }

  async function edit(html = section.body || '', note = '') {
    root.innerHTML = `
      <div class="lesson-edit">
        <div class="editor-bar">
          <strong>${section.body ? 'Редактиране на урока' : 'Нов урок'}</strong>
          <span class="spacer"></span>
          <button class="btn ghost small" type="button" data-l="word">Внеси от Word</button>
          <button class="btn ghost small" type="button" data-l="cancel">Отказ</button>
          <button class="btn small" type="button" data-l="save">Запази</button>
        </div>
        ${note ? `<p class="notice info edit-note">${esc(note)}</p>` : ''}
        <div class="editor-host"><div class="loading">Зареждане на редактора…</div></div>
        <p class="hint">Снимките се смаляват автоматично. За видео натисни бутона с филмовата лента и постави линк от YouTube.</p>
        <div class="error-box" role="alert"></div>
      </div>
      <dialog class="ldlg"></dialog>`;
    loadCss(QUILL_CSS);
    await loadScript(QUILL_JS);
    const host = $('.editor-host', root);
    host.innerHTML = '<div class="quill"></div>';
    quill = new window.Quill(host.firstChild, {
      theme: 'snow',
      placeholder: 'Започни да пишеш урока…',
      modules: {
        toolbar: {
          container: [
            [{ header: [2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['blockquote', 'link', 'image', 'video'],
            ['clean'],
          ],
          handlers: {
            image: async () => {
              const f = await pickFile('image/*');
              if (f) await insertImages([f]);
            },
          },
        },
        uploader: {
          mimetypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
          handler: (range, files) => insertImages(files, range),
        },
      },
    });
    // Подсказки на български за бутоните
    const tips = {
      '.ql-bold': 'Удебелен', '.ql-italic': 'Курсив', '.ql-underline': 'Подчертан', '.ql-color': 'Цвят на текста',
      '.ql-background': 'Маркер', '.ql-list[value="ordered"]': 'Номериран списък', '.ql-list[value="bullet"]': 'Списък',
      '.ql-blockquote': 'Каре „Запомни!“', '.ql-link': 'Връзка', '.ql-image': 'Снимка', '.ql-video': 'Видео (YouTube)',
      '.ql-clean': 'Махни форматирането', '.ql-header': 'Заглавие',
    };
    Object.entries(tips).forEach(([sel, t]) => root.querySelectorAll(`.ql-toolbar ${sel}`).forEach((b) => b.setAttribute('title', t)));
    const tipInput = root.querySelector('.ql-tooltip input');
    if (tipInput) {
      tipInput.dataset.link = 'https://';
      tipInput.dataset.video = 'Линк от YouTube';
    }

    if (html) quill.clipboard.dangerouslyPasteHTML(await sanitizeHtml(html), 'silent');
    quill.history.clear();
    dirty = !!note; // внесен Word или стара версия — още не е записано
    quill.on('text-change', () => (dirty = true));
    quill.focus();
  }

  async function insertImages(files, range = quill.getSelection(true)) {
    let index = range ? range.index : quill.getLength();
    for (const f of files) {
      try {
        quill.insertEmbed(index, 'image', await shrinkImage(f), 'user');
        index += 1;
      } catch (err) {
        toast(err.message);
      }
    }
    quill.setSelection(index, 0, 'silent');
  }

  async function save(force = false) {
    const err = $('.error-box', root);
    const btn = $('[data-l="save"]', root);
    err.innerHTML = '';
    const text = quill.getText().trim();
    const hasMedia = !!quill.root.querySelector('img, iframe');
    let body = text || hasMedia ? quill.getSemanticHTML().replace(/&nbsp;/g, ' ') : '';
    if (body.length > MAX_BODY) {
      err.textContent = 'Урокът е твърде голям — обикновено заради много снимки. Махни някоя или я качи като отделен файл в таба.';
      return;
    }
    btn.disabled = true;
    try {
      const res = await api(`/sections/${encodeURIComponent(section.slug)}/body`, {
        method: 'PUT',
        body: { body, text: text || (hasMedia ? 'Снимки' : ''), baseUpdatedAt: section.updatedAt, force },
      });
      section.body = body || null;
      section.updatedAt = res.updatedAt;
      section.updatedBy = res.updatedBy;
      dirty = false;
      toast(body ? 'Урокът е запазен.' : 'Текстът на урока е изтрит.');
      view();
    } catch (ex) {
      if (ex.status === 409) {
        err.innerHTML = `${esc(ex.message)} Ако запазиш, техните промени ще се заменят с твоите (старият текст остава в „Предишни версии“).
          <button class="btn small danger" type="button" data-l="force" style="margin-left:.5rem">Запази въпреки това</button>`;
      } else err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function importWord() {
    const f = await pickFile('.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    if (!f) return;
    toast('Внасям файла…');
    try {
      const html = await wordToHtml(f);
      if (quill) {
        const hasText = quill.getText().trim().length > 0;
        if (hasText && !window.confirm('Да заменя ли сегашния текст с този от Word файла?')) return;
        quill.setContents([], 'silent');
        quill.clipboard.dangerouslyPasteHTML(html, 'user');
        dirty = true;
        toast('Текстът е внесен. Провери го и натисни „Запази“.');
      } else {
        await edit(html, `Внесено от „${f.name}“. Провери текста, таблиците и снимките и натисни „Запази“.`);
      }
    } catch (ex) {
      toast(ex.message);
    }
  }

  async function showHistory() {
    const dlg = $('.ldlg', root);
    dlg.innerHTML = '<h2>Предишни версии</h2><div class="loading">Зареждане…</div>';
    dlg.showModal();
    try {
      const { revisions } = await api(`/sections/${encodeURIComponent(section.slug)}/revisions`);
      dlg.innerHTML = `<h2>Предишни версии</h2>
        ${revisions.length
          ? `<p class="muted">Пазят се последните 5 записа. Като отвориш версия, тя влиза в редактора — натисни „Запази“, за да я върнеш.</p>
             <ul class="rev-list">${revisions.map((r) => `
               <li><div><strong>${formatDate(r.updatedAt)}</strong>${r.author ? `, ${esc(r.author)}` : ''}
                 <span class="muted">${esc(r.preview || '')}…</span></div>
                 <button class="btn ghost small" type="button" data-rev="${r.id}">Отвори</button></li>`).join('')}</ul>`
          : '<p class="muted">Още няма предишни версии — появяват се след първата промяна на урока.</p>'}
        <div class="buttons"><button class="btn ghost" type="button" data-close>Затвори</button></div>`;
      $('[data-close]', dlg).addEventListener('click', () => dlg.close());
      dlg.querySelectorAll('[data-rev]').forEach((b) =>
        b.addEventListener('click', async () => {
          const { body } = await api(`/sections/${encodeURIComponent(section.slug)}/revisions/${b.dataset.rev}`);
          dlg.close();
          await edit(body || '', 'Това е стара версия на урока. Натисни „Запази“, за да я върнеш, или „Отказ“.');
        }),
      );
    } catch (ex) {
      dlg.innerHTML = `<h2>Предишни версии</h2><p>${esc(ex.message)}</p><div class="buttons"><button class="btn ghost" type="button" data-close>Затвори</button></div>`;
      $('[data-close]', dlg).addEventListener('click', () => dlg.close());
    }
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-l]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.l;
    if (act === 'edit') edit();
    else if (act === 'word') importWord();
    else if (act === 'history') showHistory();
    else if (act === 'save') save();
    else if (act === 'force') save(true);
    else if (act === 'cancel') {
      if (dirty && !window.confirm('Да се откажа ли от промените?')) return;
      quill = null;
      view();
    }
  });

  view();
}
