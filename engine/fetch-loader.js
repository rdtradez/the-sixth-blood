// Loads content over HTTP (GitHub Pages or any static server). Browser only.

export function createFetchLoader(base = new URL('../', import.meta.url).href) {
  const url = (path) => new URL(path, base).href;
  async function get(path, kind) {
    // "no-cache" revalidates with the server so a new release is seen promptly.
    const res = await fetch(url(path), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
    return kind === 'json' ? res.json() : res.text();
  }
  return {
    manifest: () => get('content/manifest.json', 'json'),
    stats: () => get('content/stats.json', 'json').then((s) => s.stats ?? s),
    chapterSource: (file) => get(`content/${file}`, 'text'),
    async migrations() {
      try {
        const mod = await import(url('content/migrations.js'));
        return mod.default ?? [];
      } catch {
        return [];
      }
    },
  };
}
