// Developer tools (developer mode: open the app with ?dev). Everything here works on a Game and
// is also used by tools/walk.js and the tests.
//
//   chapterList(game)             every chapter in the manifest, developer books included
//   jump(game, id, options)       start any chapter now, optionally at a scene
//   setVar(game, name, value)     set a flag, stat or text, the way a script would
//   listVars(game)                every variable in the current state, sorted
//   snapshot / restore            save and return to a point in memory, to test each branch of a choice
//   explore(game, id, options)    play every choice of a chapter on copies of the state and report
//                                 what could not be reached, what ended, and what threw an error

import { EngineError, clone, fnv1a } from './util.js';
import { Runner } from './runner.js';
import { assign } from './state.js';
import { recordSet } from './content.js';
import { knownVar } from './content-check.js';

function requireDev(game) {
  if (!game.devMode) throw new EngineError('Developer mode is off. Open the app with ?dev to turn it on.');
}

export function chapterList(game) {
  return game.manifest.books.flatMap((b) => (b.chapters ?? []).map((c, index) => ({
    id: c.id, title: c.title, bookId: b.id, bookTitle: b.title, index, dev: Boolean(b.dev),
  })));
}

/** Scene names of a chapter, start scene first. */
export async function sceneList(game, chapterId) {
  const chapter = await game.getChapter(chapterId);
  return [chapter.start, ...Object.keys(chapter.scenes).filter((n) => n !== chapter.start)];
}

/**
 * Start a chapter. By default the state is the quick start default history of the chapter's book
 * (so flags and systems have sensible values); `keep: true` carries the current state across instead.
 */
export async function jump(game, chapterId, { scene = null, keep = false, hero = null } = {}) {
  requireDev(game);
  const meta = game.chapterMeta[chapterId];
  if (!meta) throw new EngineError(`no chapter "${chapterId}" in the manifest`);
  if (keep && game.state) {
    Object.assign(game.state, { book: meta.bookId, stack: [], pos: null, frame: null });
  } else {
    game.state = game.quickState(meta.bookId, { hero });
  }
  return game.startChapter(chapterId, scene ?? undefined);
}

/** Turn typed text into true, false, a number or text, as the developer panel does. */
export function parseValue(text) {
  const t = String(text).trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t !== '' && Number.isFinite(Number(t))) return Number(t);
  return t.replace(/^"(.*)"$/, '$1');
}

/** Set a variable. Declared stats are clamped; unregistered names are allowed but reported. */
export function setVar(game, name, value) {
  requireDev(game);
  const st = game.state;
  if (!st) throw new EngineError('No game is in progress.');
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) || ['__proto__', 'constructor', 'prototype'].includes(name)) throw new EngineError(`"${name}" is not a valid variable name`);
  const registered = knownVar(name, { stats: game.statDefs, content: game.content });
  const warnings = [];
  assign(st, game.statDefs, name, value);
  recordSet({ state: st, content: game.content, vars: st.vars }, name, st.vars[name], (m) => warnings.push(m));
  if (!registered) warnings.push(`"${name}" is not registered in the flag registry, so chapters will not recognise it.`);
  return { name, value: st.vars[name], registered, warnings };
}

export function unsetVar(game, name) {
  requireDev(game);
  delete game.state?.vars[name];
}

export function listVars(game) {
  const vars = game.state?.vars ?? {};
  return Object.keys(vars).sort().map((name) => ({
    name,
    value: vars[name],
    kind: Object.hasOwn(game.statDefs, name) || Object.hasOwn(game.statDefs, `${name.split('.')[0]}.*`) ? 'stat' : game.content.flags.lookup(name)?.kind ?? (name.startsWith('_') ? 'scratch' : 'unregistered'),
  }));
}

/** Remember the current moment under a label. */
export function snapshot(game, label = 'A') {
  requireDev(game);
  if (!game.state) throw new EngineError('No game is in progress.');
  game.devSnaps.set(label, clone(game.state));
  return label;
}

/** Go back to a remembered moment (the snapshot stays, so it can be used again for the next branch). */
export async function restore(game, label = 'A') {
  requireDev(game);
  const snap = game.devSnaps.get(label);
  if (!snap) throw new EngineError(`no snapshot "${label}"`);
  game.state = clone(snap);
  game.undo = null;
  const chapter = await game.getChapter(game.state.chapter);
  game.runner = new Runner(chapter, game.state, game.runnerEnv());
  game.runner.resume();
  return game.state.frame;
}

export function snapshotLabels(game) {
  return [...game.devSnaps.keys()];
}

// ---- Branch explorer -------------------------------------------------------------------------

/**
 * Play a chapter through every combination of its choices (up to limits) on copies of a state and
 * report on it. Start from `base` (a state) or the quick start history of the chapter's book.
 * Random outcomes follow the state's seed, so each path is repeatable.
 *
 * @returns {{ paths, truncated, endings, optionsTotal, optionsTaken, untaken, unreachedScenes, errors }}
 */
export async function explore(game, chapterId, { base = null, maxPaths = 300, maxPages = 400, scene } = {}) {
  const meta = game.chapterMeta[chapterId];
  if (!meta) throw new EngineError(`no chapter "${chapterId}" in the manifest`);
  const chapter = await game.getChapter(chapterId);
  const env = game.runnerEnv();
  const start = base ? clone(base) : game.quickState(meta.bookId);
  start.chapter = chapterId;
  start.book = meta.bookId;
  start.chapterVersion = chapter.version;
  start.frame = null;

  const options = new Map(); // key -> { scene, line, text }
  for (const [name, sc] of Object.entries(chapter.scenes)) {
    sc.ops.forEach((op) => {
      if (op.op !== 'choices') return;
      op.options.forEach((o) => {
        const text = (o.parts ?? [o.text]).map((p) => (typeof p === 'string' ? p : '{…}')).join('');
        options.set(`${name}:${o.line ?? op.line}:${text}`, { scene: name, line: o.line ?? op.line, text });
      });
    });
  }
  const taken = new Set();
  const endings = new Set();
  const errors = [];
  const seenStates = new Set();
  const visitedScenes = new Set();
  let paths = 0;
  let truncated = false;

  const optionKey = (st, frameChoice) => {
    const op = chapter.scenes[st.pos.scene].ops[st.pos.pc];
    const o = op.options[frameChoice.i];
    const text = (o.parts ?? [o.text]).map((p) => (typeof p === 'string' ? p : '{…}')).join('');
    return `${st.pos.scene}:${o.line ?? op.line}:${text}`;
  };

  // Depth first with an explicit stack so long chapters do not overflow. Each work item is a copy
  // of the state sitting at a choice (or at the chapter start) and the option to take there, so an
  // error on one branch never stops the others.
  const work = [];
  try {
    new Runner(chapter, start, env).start(scene);
    work.push({ state: start, pick: null, trail: [], pages: 0 });
  } catch (e) {
    errors.push({ message: e.message, trail: [] });
  }

  while (work.length) {
    if (paths >= maxPaths) { truncated = true; break; }
    const item = work.pop();
    const { state } = item;
    const trail = [...item.trail];
    let pages = item.pages;
    const runner = new Runner(chapter, state, env);
    try {
      runner.resume();
      if (item.pick !== null) {
        const choice = state.frame.choices[item.pick];
        taken.add(optionKey(state, choice));
        trail.push(choice.text);
        runner.choose(item.pick);
      }
      for (;;) {
        for (const name of Object.keys(state.visited)) if (name.startsWith(`${chapterId}.`)) visitedScenes.add(name.slice(chapterId.length + 1));
        const frame = state.frame;
        if (frame.wait === 'chapter_end') { endings.add(frame.next); paths++; break; }
        if (frame.wait === 'page') {
          if (++pages > maxPages) { errors.push({ message: `more than ${maxPages} page breaks without an ending (a loop?)`, trail }); paths++; break; }
          runner.continue();
          continue;
        }
        // At a choice: the same situation reached twice is explored once.
        const key = fnv1a(JSON.stringify([state.pos, state.vars, state.once, state.sys, state.stack]));
        if (seenStates.has(key)) { paths++; break; }
        seenStates.add(key);
        for (let n = frame.choices.length - 1; n >= 1; n--) work.push({ state: clone(state), pick: n, trail: [...trail], pages });
        taken.add(optionKey(state, frame.choices[0]));
        trail.push(frame.choices[0].text);
        runner.choose(0);
      }
    } catch (e) {
      errors.push({ message: e.message, trail });
      paths++;
    }
  }

  const optionsTaken = [...taken].filter((k) => options.has(k)).length;
  const untaken = [...options.entries()].filter(([k]) => !taken.has(k)).map(([, v]) => v);
  const unreachedScenes = Object.keys(chapter.scenes).filter((n) => !visitedScenes.has(n));
  return {
    chapter: chapterId,
    paths,
    truncated,
    endings: [...endings],
    optionsTotal: options.size,
    optionsTaken,
    untaken,
    unreachedScenes,
    errors,
  };
}
