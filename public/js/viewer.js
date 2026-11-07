// Преглед на файлове и линкове направо в сайта (в същия прозорец)
import { esc, loadScript, sanitizeHtml, toast } from './ui.js';
import { fetchFile, saveBlob, previewType, embedUrl, fmtSize, host } from './files.js';

const PDF_JS = '/vendor/pdf-3.11.174.min.js';
const PDF_WORKER = '/vendor/pdf-3.11.174.worker.min.js';
const MAMMOTH = '/vendor/mammoth-1.9.1.min.js';

// ---------- Показване в контейнер (използва се и в прозореца, и направо в урока) ----------
export async function renderPreview(box, m, { onProgress } = {}) {
  const type = previewType(m);
  const urls = [];
  box.dataset.type = type || 'none';

  if (type === 'embed') {
    box.innerHTML = `<div class="embed"><iframe src="${esc(embedUrl(m.url))}" title="${esc(m.title)}"
      allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="lazy"></iframe></div>`;
    return () => {};
  }
  if (!type) {
    box.innerHTML = `<div class="empty"><strong>Този вид файл не може да се покаже тук</strong>
      <span>Изтегли го и го отвори на компютъра. Ако е презентация, по-удобно е да се качи и като PDF — тогава ще се вижда направо в сайта.</span>
      <button class="btn" type="button" data-dl>Изтегли (${esc(fmtSize(m.size))})</button></div>`;
    box.querySelector('[data-dl]').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        saveBlob(await fetchFile(m, (p) => (b.textContent = `${Math.round(p * 100)}%`)), m.fileName);
      } catch (err) {
        toast(err.message);
      }
      b.textContent = 'Изтегли';
      b.disabled = false;
    });
    return () => {};
  }

  box.innerHTML = `<div class="loading-file"><div class="progress"><div class="bar"></div><span class="ptext">Зареждане…</span></div></div>`;
  const bar = box.querySelector('.bar');
  const ptext = box.querySelector('.ptext');
  const blob = await fetchFile(m, (p) => {
    bar.style.width = `${Math.round(p * 100)}%`;
    ptext.textContent = `Зареждане… ${Math.round(p * 100)}%`;
    onProgress?.(p);
  });
  const objUrl = () => {
    const u = URL.createObjectURL(blob);
    urls.push(u);
    return u;
  };

  if (type === 'image') box.innerHTML = `<img class="preview-img" src="${objUrl()}" alt="${esc(m.title)}">`;
  else if (type === 'video') box.innerHTML = `<video class="preview-media" src="${objUrl()}" controls playsinline></video>`;
  else if (type === 'audio') box.innerHTML = `<audio class="preview-audio" src="${objUrl()}" controls></audio>`;
  else if (type === 'text') box.innerHTML = `<pre class="preview-text">${esc(await blob.text())}</pre>`;
  else if (type === 'docx') {
    await loadScript(MAMMOTH);
    const { value } = await window.mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
    box.innerHTML = `<article class="prose preview-doc">${await sanitizeHtml(value)}</article>`;
  } else if (type === 'pdf') await renderPdf(box, blob);

  return () => urls.forEach((u) => URL.revokeObjectURL(u));
}

async function renderPdf(box, blob) {
  await loadScript(PDF_JS);
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
  box.innerHTML = `<div class="pdf-pages">${Array.from({ length: pdf.numPages }, (_, i) =>
    `<div class="pdf-page" data-page="${i + 1}" style="aspect-ratio:${first.width}/${first.height}"><span class="pdf-num">${i + 1} / ${pdf.numPages}</span></div>`).join('')}</div>`;

  // Страниците се рисуват, когато стигнеш до тях
  const draw = async (el) => {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const page = await pdf.getPage(Number(el.dataset.page));
    const base = page.getViewport({ scale: 1 });
    const scale = (el.clientWidth / base.width) * Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    el.style.aspectRatio = `${base.width}/${base.height}`;
    el.prepend(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  };
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (io.unobserve(e.target), draw(e.target))),
    { rootMargin: '600px 0px' },
  );
  box.querySelectorAll('.pdf-page').forEach((el) => io.observe(el));
}

// ---------- Прозорец за преглед над страницата ----------
let dlg;
let cleanup = () => {};
let ignorePop = false;

function ensureDialog() {
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.className = 'viewer';
  dlg.setAttribute('aria-labelledby', 'viewer-title');
  document.body.append(dlg);
  dlg.addEventListener('close', () => {
    cleanup();
    cleanup = () => {};
    dlg.innerHTML = '';
    document.documentElement.classList.remove('viewer-open');
    // Затворен с бутона или Esc → махаме и записа в историята
    if (history.state?.viewer) {
      ignorePop = true;
      history.back();
    }
  });
  return dlg;
}

// Бутонът „Назад“ на телефона затваря прегледа, вместо да напуска страницата
export function handleViewerPop() {
  if (ignorePop) {
    ignorePop = false;
    return true;
  }
  if (dlg?.open) {
    history.replaceState({ ...history.state, viewer: false }, '');
    dlg.close();
    return true;
  }
  return false;
}

export function openMaterial(m) {
  // Линк, който не може да се вгради → отваряме го в същия прозорец
  if (m.kind === 'link' && !embedUrl(m.url)) {
    location.href = m.url;
    return;
  }
  const d = ensureDialog();
  const meta = m.kind === 'link' ? host(m.url) : fmtSize(m.size);
  d.innerHTML = `
    <header class="viewer-head">
      <div class="viewer-title"><strong id="viewer-title">${esc(m.title)}</strong><span>${esc(meta)}</span></div>
      <div class="viewer-actions">
        ${m.kind === 'file' ? '<button class="btn ghost small" type="button" data-v="dl">Изтегли</button>' : `<a class="btn ghost small" href="${esc(m.url)}">Отвори в сайта им</a>`}
        <button class="btn small" type="button" data-v="close">Затвори</button>
      </div>
    </header>
    <div class="viewer-body"></div>`;
  d.querySelector('[data-v="close"]').addEventListener('click', () => d.close());
  d.querySelector('[data-v="dl"]')?.addEventListener('click', async () => {
    try {
      saveBlob(await fetchFile(m), m.fileName);
    } catch (err) {
      toast(err.message);
    }
  });
  history.pushState({ ...history.state, viewer: true }, '', location.href);
  document.documentElement.classList.add('viewer-open');
  d.showModal();
  renderPreview(d.querySelector('.viewer-body'), m)
    .then((fn) => (cleanup = fn))
    .catch((err) => {
      d.querySelector('.viewer-body').innerHTML = `<div class="empty"><strong>Не успях да покажа файла</strong><span>${esc(err.message)}</span></div>`;
    });
}

// ---------- Показване направо в урока, когато стигнеш до него ----------
export function inlinePreview(box, m) {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      renderPreview(box, m).catch((err) => {
        box.innerHTML = `<div class="empty"><strong>Не успях да покажа файла</strong><span>${esc(err.message)}</span></div>`;
      });
    },
    { rootMargin: '300px 0px' },
  );
  io.observe(box);
}
