import { parseChapterOrThrow } from '../engine/script.js';
import { Runner } from '../engine/runner.js';
import { createState, applyStatDefaults } from '../engine/state.js';
import { Game } from '../engine/game.js';
import { MemoryStorage } from '../engine/saves.js';

export const STATS = {
  hunger: { min: 0, max: 100, start: 10, int: true },
  'loyalty.*': { min: 0, max: 100, int: true },
};

/** Compile a chapter from source and start a runner at its first scene. */
export function play(source, { vars = {}, seed = 1, env = {} } = {}) {
  const chapter = parseChapterOrThrow(source, { file: 'test.tsb' });
  const state = createState({ book: 'b', vars, seed });
  applyStatDefaults(state, STATS);
  const runner = new Runner(chapter, state, { statDefs: STATS, ...env });
  runner.start();
  return { chapter, state, runner };
}

export const texts = (frame) => frame.paragraphs.map((p) => p.text);

/** An in-memory loader so tests can define a whole game as strings. */
export function memoryLoader({ chapters, contentVersion = 1, stats = STATS, migrations = [], bookId = 'b' }) {
  const ids = Object.keys(chapters);
  const files = {};
  for (const id of ids) files[`${id}.tsb`] = chapters[id];
  return {
    files,
    manifest: async () => ({
      contentVersion,
      books: [{ id: bookId, title: 'Test Book', chapters: ids.map((id) => ({ id, file: `${id}.tsb`, title: `Chapter ${id}` })) }],
    }),
    stats: async () => stats,
    chapterSource: async (file) => files[file],
    migrations: async () => migrations,
  };
}

export async function makeGame(loader, { storage = new MemoryStorage(), warn = () => {}, ...rest } = {}) {
  const game = new Game({ loader, storage, warn, now: () => 1000, ...rest });
  await game.init();
  return game;
}
