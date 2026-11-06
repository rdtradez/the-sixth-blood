// Content checker: parses and validates every chapter in content/manifest.json.
// Run with `npm run check`. Exits 1 on errors so it can gate a release.
// (The full developer tools, with flag registry checks, come in a later session.)

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeLoader } from '../engine/node-loader.js';
import { parseChapter } from '../engine/script.js';
import { validateChapter } from '../engine/validate.js';
import { checkContentMigrations } from '../engine/versioning.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const loader = createNodeLoader(root);
const manifest = await loader.manifest();

let errors = 0;
let warnings = 0;
const ids = new Set();
for (const book of manifest.books) for (const c of book.chapters) {
  if (ids.has(c.id)) { console.error(`manifest: chapter id "${c.id}" is listed twice`); errors++; }
  ids.add(c.id);
}

for (const problem of checkContentMigrations(await loader.migrations(), manifest.contentVersion)) {
  console.error(`migrations: ${problem}`);
  errors++;
}

for (const book of manifest.books) {
  for (const meta of book.chapters) {
    if (!existsSync(join(root, 'content', meta.file))) {
      console.error(`${meta.file}: listed in the manifest but the file does not exist`);
      errors++;
      continue;
    }
    const { chapter, errors: parseErrors } = parseChapter(await loader.chapterSource(meta.file), { file: meta.file });
    for (const e of parseErrors) { console.error(e.message); errors++; }
    if (!chapter) continue;
    if (chapter.id !== meta.id) { console.error(`${meta.file}: header says "@chapter ${chapter.id}" but the manifest says "${meta.id}"`); errors++; }
    const report = validateChapter(chapter, { chapterIds: ids, commandNames: new Set(['log']) });
    for (const e of report.errors) { console.error(e.message); errors++; }
    for (const w of report.warnings) { console.warn(`warning: ${w.message}`); warnings++; }
  }
}

const count = manifest.books.reduce((n, b) => n + b.chapters.length, 0);
console.log(`${count} chapter(s) checked: ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
