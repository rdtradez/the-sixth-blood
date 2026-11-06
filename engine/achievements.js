// Achievements (content/achievements.json). Each has a `when` expression written with the same
// functions chapters use, for example lone() or fed("human") == 0.
//
//   "at": "book"      checked when a book ends (the default); "book": "<id>" limits it to that book's end
//   "at": "chapter"   checked at the end of every chapter and every book
//
// Earned achievements are stored in the profile (they outlive a playthrough) with the time they
// were earned. They are never awarded to a quick start (or a developer jump, which uses one), since those skip real play.

import { parseExpr, evaluate, BUILTIN_FNS } from './expr.js';
import { CONTENT_FNS } from './content.js';
import { SYSTEM_FNS } from './systems/index.js';

const compiled = new Map();

/** Compile (and cache) an achievement's expression. Throws ExprError for a malformed one. */
export function compileWhen(src) {
  if (!compiled.has(src)) compiled.set(src, parseExpr(src));
  return compiled.get(src);
}

/**
 * Check the achievements that apply at this moment and store any newly earned.
 * @param scope 'chapter' (a chapter just ended) or 'book' (a book just ended)
 * @returns the newly earned achievements as { id, title, text }
 */
export function evaluateAchievements(game, scope, bookId) {
  const profile = game.saves.getProfile();
  const state = game.state;
  const ctx = {
    vars: state.vars,
    state,
    content: game.content,
    fns: { ...BUILTIN_FNS, ...CONTENT_FNS, ...SYSTEM_FNS, ...game.fns },
    rand: () => 0.5,
    visited: () => 0,
  };
  const got = [];
  for (const [id, def] of Object.entries(game.content.achievements)) {
    if (Object.hasOwn(profile.achievements, id)) continue;
    const at = def.at ?? 'book';
    if (at === 'book' && scope !== 'book') continue;
    if (def.book && def.book !== bookId) continue;
    if (scope === 'chapter' && at !== 'chapter') continue;
    let ok = false;
    try { ok = Boolean(evaluate(compileWhen(def.when), ctx)); } catch (e) { game.warn(`achievement "${id}": ${e.message}`); }
    if (!ok) continue;
    profile.achievements[id] = game.now();
    got.push({ id, title: def.title ?? id, text: def.text ?? '' });
  }
  if (got.length) game.saves.setProfile(profile);
  return got;
}
