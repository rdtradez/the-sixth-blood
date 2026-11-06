// Static checks on a compiled chapter. The parser already reports syntax errors;
// this finds problems that only show up across the whole chapter or manifest:
// jumps to scenes that do not exist, unreachable scenes, scenes that can run off
// their end, and commands that nothing handles.

import { ScriptError } from './util.js';

const TERMINAL = new Set(['goto', 'ret', 'chapter_end']);

/**
 * @param chapter  compiled chapter
 * @param opts     { chapterIds?: Set<string>, commandNames?: Set<string> }
 * @returns { errors: ScriptError[], warnings: ScriptError[] }
 */
export function validateChapter(chapter, { chapterIds = null, commandNames = null, variantIds = null } = {}) {
  const errors = [];
  const warnings = [];
  const file = chapter.file;
  const err = (line, msg) => errors.push(new ScriptError(msg, { file, line }));
  const warn = (line, msg) => warnings.push(new ScriptError(msg, { file, line }));

  const edges = {};
  for (const [name, scene] of Object.entries(chapter.scenes)) {
    edges[name] = new Set();
    let canFallOff = false;
    for (const op of scene.ops) {
      if (op.op === 'goto' || op.op === 'call') {
        if (!chapter.scenes[op.scene]) err(op.line, `${op.op === 'goto' ? '->' : '~>'} "${op.scene}": no such scene${op.by ? ' (the base scene is required; variants are optional)' : ''}`);
        else edges[name].add(op.scene);
        if (op.by) {
          // Variant scenes ("arrival_briton") are reached through the base jump.
          const ids = variantIds?.[op.by];
          for (const other of Object.keys(chapter.scenes)) {
            if (!other.startsWith(`${op.scene}_`)) continue;
            const suffix = other.slice(op.scene.length + 1);
            if (!ids || ids.has(suffix)) edges[name].add(other);
          }
        }
      } else if (op.op === 'chapter_end') {
        const t = op.target;
        if (t !== 'next' && t !== 'endbook' && chapterIds && !chapterIds.has(t)) {
          err(op.line, `=> "${t}": no such chapter (use a chapter id, "next" or "endbook")`);
        }
      } else if (op.op === 'do' && commandNames && !commandNames.has(op.name)) {
        err(op.line, `unknown command "${op.name}"`);
      }
      if ((op.op === 'jmp' || op.op === 'jf') && op.to >= scene.ops.length) canFallOff = true;
    }
    const last = scene.ops[scene.ops.length - 1];
    if (!last || (!TERMINAL.has(last.op) && !(last.op === 'jmp' && !last.endJump))) canFallOff = true;
    if (canFallOff) warn(scene.line, `scene "${name}" can run off its end (finish every path with "->", "<~" or "=>")`);
  }

  const seen = new Set();
  const queue = [chapter.start];
  while (queue.length) {
    const s = queue.pop();
    if (seen.has(s) || !chapter.scenes[s]) continue;
    seen.add(s);
    for (const t of edges[s]) queue.push(t);
  }
  for (const [name, scene] of Object.entries(chapter.scenes)) {
    if (!seen.has(name)) warn(scene.line, `scene "${name}" is never reached`);
  }
  return { errors, warnings };
}
