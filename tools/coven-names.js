// Finds story lines that name a coven member without checking that they are in the coven.
// A line is fine when it, or a choice/?if line above it that it sits under, mentions in_circle("name")
// or the member's own status. Usage: node tools/coven-names.js [content/house-divided] [--list]
// Spoiler free: prints file and line numbers only unless --list is given.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const NAMES = ['Prisca', 'Fiammetta', 'Hanno', 'Thibault', 'Tiro'];
const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const list = process.argv.includes('--list');

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsb') ? [p] : [];
  });
}

const indent = (l) => l.length - l.trimStart().length;
let total = 0;
for (const dir of dirs.length ? dirs : ['content']) {
  for (const file of files(dir).sort()) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const stack = []; // { indent, text } of ?if / ?elif / choice lines above
    const hits = [];
    lines.forEach((raw, i) => {
      const t = raw.trim();
      if (!t || t.startsWith('//') || t.startsWith('#') || t.startsWith('@')) return;
      const ind = indent(raw);
      while (stack.length && stack[stack.length - 1].indent >= ind) stack.pop();
      const isGate = t.startsWith('?if') || t.startsWith('?elif') || t.startsWith('* ') || t.startsWith(':');
      if (isGate) stack.push({ indent: ind, text: t });
      const isText = !/^(\$|\?|->|~>|<~|=>|---|:|\*)/.test(t) || t.startsWith('* ');
      if (!isText) return;
      const named = NAMES.filter((n) => new RegExp(`\\b${n}\\b`).test(t.replace(/\?if.*$/, '')));
      if (!named.length) return;
      const context = [raw, ...stack.map((s) => s.text)].join('\n');
      const unguarded = named.filter((n) => !new RegExp(`in_circle\\("${n.toLowerCase()}"\\)|member\\("${n.toLowerCase()}"`).test(context));
      if (unguarded.length) hits.push({ line: i + 1, unguarded, text: t });
    });
    if (hits.length) {
      total += hits.length;
      console.log(`${file}: ${hits.length} line(s) at ${hits.map((h) => h.line).join(', ')}`);
      if (list) for (const h of hits) console.log(`   ${h.line} [${h.unguarded.join(',')}] ${h.text.slice(0, 110)}`);
    }
  }
}
console.log(`${total} line(s) name a coven member who may not be in the coven.`);
process.exitCode = 0;
