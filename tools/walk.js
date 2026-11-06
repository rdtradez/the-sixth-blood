// Branch explorer: plays every choice of the chapters you name (default: all) on copies of a default
// history and reports choices never taken, scenes never reached, and anything that threw an error.
//
//   node tools/walk.js                  every chapter in the manifest
//   node tools/walk.js et1 etd1         only these chapters
//   node tools/walk.js etd1 --max 1000  allow more paths (default 300)
//
// Exits 1 if any path throws an error. Unreached choices and scenes are reported but are not errors,
// because some are only reachable from state that an earlier chapter sets.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeLoader } from '../engine/node-loader.js';
import { MemoryStorage } from '../engine/saves.js';
import { Game } from '../engine/game.js';
import { chapterList, explore } from '../engine/dev.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let max = 300;
const ids = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max') max = Number(args[++i]);
  else ids.push(args[i]);
}

const game = new Game({ loader: createNodeLoader(root), storage: new MemoryStorage(), warn: () => {} });
await game.init();
const all = chapterList(game);
const wanted = ids.length ? ids : all.map((c) => c.id);
let failed = false;

for (const id of wanted) {
  if (!all.some((c) => c.id === id)) { console.error(`no chapter "${id}" in the manifest`); failed = true; continue; }
  const r = await explore(game, id, { maxPaths: max });
  const cover = r.optionsTotal ? `${r.optionsTaken}/${r.optionsTotal} choices` : 'no choices';
  console.log(`${id}: ${r.paths} path(s)${r.truncated ? ' (stopped at the limit)' : ''}, ${cover}, ends: ${r.endings.join(', ') || 'none'}`);
  for (const o of r.untaken) console.log(`  never taken: "${o.text}" (scene ${o.scene}, line ${o.line})`);
  for (const s of r.unreachedScenes) console.log(`  never reached: scene ${s}`);
  for (const e of r.errors) { console.log(`  ERROR: ${e.message}${e.trail.length ? `\n    after: ${e.trail.join(' > ')}` : ''}`); failed = true; }
}
process.exit(failed ? 1 : 0);
