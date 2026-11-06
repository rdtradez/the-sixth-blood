// Content checker: parses and validates every chapter in content/manifest.json, plus the
// flag registry, story voice, people and origins files. Run with `npm run check`.
// Exits 1 on errors so it can gate a release.

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeLoader } from '../engine/node-loader.js';
import { parseChapter } from '../engine/script.js';
import { validateChapter } from '../engine/validate.js';
import { checkContentMigrations } from '../engine/versioning.js';
import { checkContentFiles, checkChapterContent } from '../engine/content-check.js';
import { CONTENT_FILES, COMMAND_NAMES, assembleContent } from '../engine/game.js';
import { checkCatalog } from '../engine/systems/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const loader = createNodeLoader(root);

let errors = 0;
let warnings = 0;
const error = (m) => { console.error(m); errors++; };
const warning = (m) => { console.warn(`warning: ${m}`); warnings++; };

let manifest, stats, content;
try {
  manifest = await loader.manifest();
  stats = await loader.stats();
  const files = {};
  for (const name of CONTENT_FILES) files[name] = (await loader.json(name)) ?? {};
  content = assembleContent(files, stats, manifest);
} catch (e) {
  error(e.message);
  process.exit(1);
}

const ids = new Set();
for (const book of manifest.books) for (const c of book.chapters ?? []) {
  if (ids.has(c.id)) error(`manifest: chapter id "${c.id}" is listed twice`);
  ids.add(c.id);
}

for (const problem of checkContentMigrations(await loader.migrations(), manifest.contentVersion)) error(`migrations: ${problem}`);

const files = checkContentFiles({ manifest, stats, content });
files.errors.forEach(error);
files.warnings.forEach(warning);
checkCatalog(content.systems, { bookIds: new Set(manifest.books.map((b) => b.id)) }).forEach(error);

const commandNames = new Set(COMMAND_NAMES);
for (const book of manifest.books) {
  for (const meta of book.chapters ?? []) {
    if (!existsSync(join(root, 'content', meta.file))) {
      error(`${meta.file}: listed in the manifest but the file does not exist`);
      continue;
    }
    const { chapter, errors: parseErrors } = parseChapter(await loader.chapterSource(meta.file), { file: meta.file });
    for (const e of parseErrors) error(e.message);
    if (!chapter) continue;
    if (chapter.id !== meta.id) error(`${meta.file}: header says "@chapter ${chapter.id}" but the manifest says "${meta.id}"`);
    const report = validateChapter(chapter, { chapterIds: ids, commandNames, variantIds: content.variantIds });
    report.errors.forEach((e) => error(e.message));
    report.warnings.forEach((w) => warning(w.message));
    const deep = checkChapterContent(chapter, { stats, content, dev: Boolean(book.dev) });
    deep.errors.forEach((e) => error(e.message));
    deep.warnings.forEach((w) => warning(w.message));
  }
}

// Velati journal scripts: chapter format, run at the end of each book, no choices allowed.
for (const book of manifest.books) {
  if (!book.journal) continue;
  if (!existsSync(join(root, 'content', book.journal))) { error(`${book.id}: journal "${book.journal}" does not exist`); continue; }
  const { chapter, errors: parseErrors } = parseChapter(await loader.chapterSource(book.journal), { file: book.journal });
  parseErrors.forEach((e) => error(e.message));
  if (!chapter) continue;
  const report = validateChapter(chapter, { chapterIds: ids, commandNames, variantIds: content.variantIds });
  report.errors.forEach((e) => error(e.message));
  report.warnings.forEach((w) => warning(w.message));
  const deep = checkChapterContent(chapter, { stats, content, dev: Boolean(book.dev) });
  deep.errors.forEach((e) => error(e.message));
  deep.warnings.forEach((w) => warning(w.message));
  for (const scene of Object.values(chapter.scenes)) {
    for (const op of scene.ops) if (op.op === 'choices') error(`${book.journal}:${op.line}: a journal script cannot offer choices`);
  }
}

const count = manifest.books.reduce((n, b) => n + (b.chapters?.length ?? 0), 0);
console.log(`${manifest.books.length} book(s), ${count} chapter(s) checked: ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
