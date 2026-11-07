// Текстът на един таб: показване, писане в редактор, внасяне от Word, предишни версии
import { api } from './api.js';
import { state } from './app.js';
import { esc, $, toast, formatDate, loadScript, loadCss, sanitizeHtml, shrinkImage, setUnsaved, pickFile } from './ui.js';

const QUILL_JS = '/vendor/quill-2.0.3.js';
const QUILL_CSS = '/vendor/quill-2.0.3.snow.css';
const MAMMOTH = '/vendor/mammoth-1.9.1.min.js';
const MAX_BODY = 1_400_000;

const isStaff = () => state.user && (state.user.role === 'teacher' || state.user.role === 'admin');

// ---------- Word (.docx) → HTML ----------
export async function wordToHtml(file) {
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

const WORDS = {
  urok: { what: 'урока', write: 'Напиши урока', edit: 'Редактирай урока', placeholder: 'Започни да пишеш урока…' },
  other: { what: 'текста', write: 'Напиши текст', edit: 'Редактирай текста', placeholder: 'Напиши задачи, указания, „Запомни!“…' },
};

/**
 * root   — къде се показва текстът
 * tools  — къде отиват бутоните (за учители)
 * text   — { body, updatedAt, updatedBy }
 * onMode — извиква се с 'edit' / 'view', за да скрие останалото в таба докато се пише
 */
export function textBlock(root, tools, { slug, tab, text, onMode }) {
  const staff = isStaff();
  const w = tab === 'urok' ? WORDS.urok : WORDS.other;
  const key = `text-${slug}-${tab}`;
  let quill = null;
  let dirty = false;
  const setDirty = (v) => {
    dirty = v;
    setUnsaved(key, v);
  };

  function drawTools(editing) {
    if (!tools) return;
    tools.innerHTML = editing
      ? ''
      : `<button class="btn ${text.body ? 'ghost' : ''}" type="button" data-t="edit">${text.body ? w.edit : w.write}</button>
         <button class="btn ghost" type="button" data-t="word">Внеси от Word</button>
         ${text.body ? '<button class="btn ghost" type="button" data-t="history">Предишни версии</button>' : ''}`;
  }

  async function view() {
    setDirty(false);
    quill = null;
    onMode?.('view');
    drawTools(false);
    root.innerHTML = text.body
      ? `<article class="prose lesson-body"></article>
         ${text.updatedBy ? `<p class="edited">Последна промяна: ${esc(text.updatedBy)}, ${formatDate(text.updatedAt)}</p>` : ''}`
      : '';
    if (text.body) $('.lesson-body', root).innerHTML = await sanitizeHtml(text.body);
  }

  async function edit(html = text.body || '', note = '') {
    onMode?.('edit');
    drawTools(true);
    root.innerHTML = `
      <div class="lesson-edit">
        <div class="editor-bar">
          <strong>${text.body ? `Редактиране на ${w.what}` : w.write}</strong>
          <span class="spacer"></span>
          <button class="btn ghost small" type="button" data-t="word">Внеси от Word</button>
          <button class="btn ghost small" type="button" data-t="cancel">Отказ</button>
          <button class="btn small" type="button" data-t="save">Запази</button>
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
      placeholder: w.placeholder,
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
    setDirty(!!note); // внесен Word или стара версия — още не е записано
    quill.on('text-change', () => setDirty(true));
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
    const btn = $('[data-t="save"]', root);
    err.innerHTML = '';
    const plain = quill.getText().trim();
    const hasMedia = !!quill.root.querySelector('img, iframe');
    const body = plain || hasMedia ? quill.getSemanticHTML().replace(/&nbsp;/g, ' ') : '';
    if (body.length > MAX_BODY) {
      err.textContent = 'Текстът е твърде голям — обикновено заради много снимки. Махни някоя или я качи като отделен файл в таба.';
      return;
    }
    btn.disabled = true;
    try {
      const res = await api(`/sections/${encodeURIComponent(slug)}/text/${tab}`, {
        method: 'PUT',
        body: { body, text: plain || (hasMedia ? 'Снимки' : ''), baseUpdatedAt: text.updatedAt || null, force },
      });
      text.body = body || null;
      text.updatedAt = res.updatedAt;
      text.updatedBy = res.updatedBy;
      setDirty(false);
      toast(body ? 'Запазено.' : 'Текстът е изтрит.');
      view();
    } catch (ex) {
      if (ex.status === 409) {
        err.innerHTML = `${esc(ex.message)} Ако запазиш, техните промени ще се заменят с твоите (старият текст остава в „Предишни версии“).
          <button class="btn small danger" type="button" data-t="force" style="margin-left:.5rem">Запази въпреки това</button>`;
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
        setDirty(true);
        toast('Текстът е внесен. Провери го и натисни „Запази“.');
      } else {
        await edit(html, `Внесено от „${f.name}“. Провери текста, таблиците и снимките и натисни „Запази“.`);
      }
    } catch (ex) {
      toast(ex.message);
    }
  }

  async function showHistory() {
    let dlg = $('.ldlg', root);
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.className = 'ldlg';
      root.append(dlg);
    }
    const base = `/sections/${encodeURIComponent(slug)}/text/${tab}/revisions`;
    dlg.innerHTML = '<h2>Предишни версии</h2><div class="loading">Зареждане…</div>';
    dlg.showModal();
    const close = () => dlg.close();
    try {
      const { revisions } = await api(base);
      dlg.innerHTML = `<h2>Предишни версии</h2>
        ${revisions.length
          ? `<p class="muted">Пазят се последните 5 записа. Като отвориш версия, тя влиза в редактора — натисни „Запази“, за да я върнеш.</p>
             <ul class="rev-list">${revisions.map((r) => `
               <li><div><strong>${formatDate(r.updatedAt)}</strong>${r.author ? `, ${esc(r.author)}` : ''}
                 <span class="muted">${esc(r.preview || '')}…</span></div>
                 <button class="btn ghost small" type="button" data-rev="${r.id}">Отвори</button></li>`).join('')}</ul>`
          : '<p class="muted">Още няма предишни версии — появяват се след първата промяна.</p>'}
        <div class="buttons"><button class="btn ghost" type="button" data-close>Затвори</button></div>`;
      $('[data-close]', dlg).addEventListener('click', close);
      dlg.querySelectorAll('[data-rev]').forEach((b) =>
        b.addEventListener('click', async () => {
          const { body } = await api(`${base}/${b.dataset.rev}`);
          close();
          await edit(body || '', 'Това е стара версия. Натисни „Запази“, за да я върнеш, или „Отказ“.');
        }),
      );
    } catch (ex) {
      dlg.innerHTML = `<h2>Предишни версии</h2><p>${esc(ex.message)}</p><div class="buttons"><button class="btn ghost" type="button" data-close>Затвори</button></div>`;
      $('[data-close]', dlg).addEventListener('click', close);
    }
  }

  const onClick = (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    const act = b.dataset.t;
    if (act === 'edit') edit();
    else if (act === 'word') importWord();
    else if (act === 'history') showHistory();
    else if (act === 'save') save();
    else if (act === 'force') save(true);
    else if (act === 'cancel') {
      if (dirty && !window.confirm('Да се откажа ли от промените?')) return;
      view();
    }
  };
  root.addEventListener('click', onClick);
  tools?.addEventListener('click', onClick);

  if (staff || text.body) view();
  return { hasText: () => !!text.body };
}
