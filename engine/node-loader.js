// Loads content from disk. Used by tests and tools; never imported by the browser app.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function createNodeLoader(root) {
  const read = (p) => readFile(join(root, p), 'utf8');
  return {
    manifest: async () => JSON.parse(await read('content/manifest.json')),
    stats: async () => {
      const s = JSON.parse(await read('content/stats.json'));
      return s.stats ?? s;
    },
    chapterSource: (file) => read(`content/${file}`),
    async migrations() {
      try {
        const mod = await import(pathToFileURL(join(root, 'content/migrations.js')).href);
        return mod.default ?? [];
      } catch {
        return [];
      }
    },
  };
}
