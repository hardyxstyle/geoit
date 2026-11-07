// Прави списък на файловете в public/files → public/files/index.json
// Пуска се от Cloudflare при всяко обновяване (Build command: node scripts/files-index.mjs),
// за да знае сайтът кои файлове има в папката.
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/files', import.meta.url));
if (!existsSync(root)) mkdirSync(root, { recursive: true });

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort((a, b) => a.localeCompare(b, 'bg'))) {
    if (name.startsWith('.') || name === 'index.json' || name === 'README.md') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else {
      const parts = relative(root, full).split(sep);
      files.push({
        path: '/files/' + parts.map(encodeURIComponent).join('/'),
        name,
        folder: parts.slice(0, -1).join(' / '),
        size: st.size,
      });
    }
  }
})(root);

writeFileSync(join(root, 'index.json'), JSON.stringify({ files }, null, 1));
console.log(`public/files/index.json: ${files.length} файла`);
