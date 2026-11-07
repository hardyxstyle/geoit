// Текст в Markdown (от Gemini, ChatGPT и др.) → HTML за редактора на урока.
// Разбира: # заглавия, **удебелен**, *курсив*, [връзка](https://…), списъци „- “ и „1. “, „---“.
// Раздел със заглавие „Запомни“ става каре „Запомни!“ (blockquote).
import { esc } from './ui.js';

// Прилича ли поставеният текст на Markdown?
export function looksLikeMarkdown(text) {
  const t = String(text || '');
  const heads = (t.match(/^#{1,6}\s+\S/gm) || []).length;
  const bold = (t.match(/\*\*[^*\n]+\*\*/g) || []).length;
  return heads >= 1 || bold >= 2;
}

function inline(s) {
  let h = esc(s);
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, a, u) => `<a href="${u}">${a}</a>`);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  h = h.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  h = h.replace(/`([^`]+)`/g, '$1');
  return h;
}

export function markdownToHtml(md) {
  const lines = String(md).replace(/\r/g, '').split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol'
  let quote = false; // в раздел „Запомни“
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length <= 2 ? 2 : 3;
      quote = /запомни/i.test(h[2]);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^([-*_])\1{2,}$/.test(line)) {
      closeList();
      quote = false;
      continue;
    }
    const ul = line.match(/^[-*+•]\s+(.*)$/);
    const ol = line.match(/^\d{1,3}[.)]\s+(.*)$/);
    if (ul || ol) {
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    closeList();
    const text = line.replace(/^>\s?/, '');
    out.push(quote || line.startsWith('>') ? `<blockquote>${inline(text)}</blockquote>` : `<p>${inline(text)}</p>`);
  }
  closeList();
  return out.join('');
}
