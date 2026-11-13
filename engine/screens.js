// Plain data for the player's screens: People, Codex, Family tree and Achievements.
// No DOM here; app/ turns these into elements and tests read them directly.

import { CONTENT_FNS } from './content.js';
import { loreOf, entryUnlocked, originalKnown } from './systems/lore.js';
import { TASKS, taskProblem } from './systems/circle.js';

const FATE_WORDS = { alive: 'Alive', dead: 'Dead', turned: 'Turned', missing: 'Missing', gone: 'Gone from your life' };
const MEMBER_WORDS = { active: '', left: 'Left your coven', dead: 'Dead', captured: 'Captured', betrayed: 'Betrayed you' };
const ROMANCE_WORDS = { courting: 'Courting', together: 'Together' };
const ENDING_WORDS = { turned: 'Turned by you', left_behind: 'Left behind', lost: 'Lost', parted: 'Parted ways' };

const ctxOf = (state, content) => ({ state, vars: state.vars, content });
const bookTitle = (content, id) => content.manifest?.books?.find((b) => b.id === id)?.title ?? '';
const paragraphs = (text) => (Array.isArray(text) ? text : String(text ?? '').split(/\n\s*\n|\n/)).map((t) => t.trim()).filter(Boolean);

/** Everyone the hero has met or taken into his circle, with where things stand between you. */
export function peopleView(state, content) {
  const s = state?.sys;
  if (!s) return [];
  const ctx = ctxOf(state, content);
  const ids = [...new Set([...Object.keys(s.people ?? {}), ...Object.keys(s.circle ?? {}), ...Object.keys(s.romances ?? {})])];
  return ids.filter((id) => Object.hasOwn(content.people, id) && id !== 'hero').map((id) => {
    const p = s.people?.[id];
    const m = s.circle?.[id];
    const r = s.romances?.[id];
    const def = content.people[id] ?? {};
    const notes = [];
    if (m) {
      if (m.kind === 'keeper') notes.push('One of your keepers');
      else notes.push(MEMBER_WORDS[m.status] || 'In your coven');
      if (m.daywalk) notes.push('Walks in daylight');
    }
    if (p && p.fate !== 'alive') notes.push(FATE_WORDS[p.fate] ?? p.fate);
    if (r) notes.push(r.ending ? `Love: ${ENDING_WORDS[r.ending] ?? r.ending}` : `Love: ${ROMANCE_WORDS[r.state] ?? r.state}`);
    const gone = (p && ['dead', 'missing', 'gone'].includes(p.fate)) || (m && ['dead', 'left', 'captured', 'betrayed'].includes(m.status));
    return {
      id,
      name: CONTENT_FNS.name(ctx, id),
      title: m?.role || def.title || '',
      bio: def.bio ?? '',
      met: p?.met ?? m?.joined ?? null,
      metIn: bookTitle(content, p?.met ?? m?.joined),
      status: notes.length ? notes : ['Alive'],
      gone: Boolean(gone),
      romance: r ? (r.ending ? `ended:${r.ending}` : r.state) : '',
      circle: m ? m.kind : '',
    };
  });
}

/** The codex grouped by category. Locked entries show as undiscovered rows unless the entry is `hidden`. */
export function codexView(state, content) {
  const s = state?.sys;
  const cat = content.systems ?? {};
  const cats = { ...(cat.codexCategories ?? {}) };
  const rows = [];
  for (const [id, def] of Object.entries(cat.codex ?? {})) {
    const open = s ? entryUnlocked(s, id, def) : false;
    if (!open && def.hidden) continue;
    rows.push(open
      ? { id, category: def.category ?? 'lore', title: def.title ?? id, text: paragraphs(def.text), book: def.book ?? '', bookTitle: bookTitle(content, def.book), locked: false }
      : { id, category: def.category ?? 'lore', title: '', text: [], book: def.book ?? '', bookTitle: '', locked: true });
  }
  // Originals the hero has learned of appear on their own, unless an entry already covers them.
  const covered = new Set(Object.values(cat.codex ?? {}).map((d) => d.original).filter(Boolean));
  for (const [id, def] of Object.entries(cat.originals ?? {})) {
    if (covered.has(id) || !s || !originalKnown(s, id)) continue;
    cats.originals ??= 'The Originals';
    rows.push({
      id: `original.${id}`,
      category: 'originals',
      title: def.title ?? id,
      text: paragraphs(def.gift ? `${def.title ?? id}. Gift: ${def.gift}.` : ''),
      book: def.book ?? '',
      bookTitle: bookTitle(content, def.book),
      locked: false,
    });
  }
  const order = Object.keys(cats);
  for (const r of rows) if (!order.includes(r.category)) { order.push(r.category); cats[r.category] = r.category; }
  const groups = order.map((id) => ({ id, label: cats[id], entries: rows.filter((r) => r.category === id) })).filter((g) => g.entries.length);
  const all = rows.filter((r) => !r.id.startsWith('original.'));
  return {
    groups,
    unlocked: rows.filter((r) => !r.locked).length,
    total: all.length + rows.filter((r) => r.id.startsWith('original.')).length,
  };
}

/**
 * The Valerius family tree as nested couples: [{ id, name, label, status, partner?, children: [...] }].
 * Only relatives the story has introduced with $ do kin() appear. Roots are known members with no
 * known parent whose partner (if any) also has no known parent.
 */
export function familyView(state, content) {
  const s = state?.sys;
  if (!s) return [];
  const known = loreOf(s).kin;
  const defs = content.systems?.kin ?? {};
  const ctx = ctxOf(state, content);
  const ids = Object.keys(defs).filter((id) => Object.hasOwn(known, id));
  const gender = (id) => CONTENT_FNS.gender(ctx, defs[id].person ?? id);
  const node = (id) => {
    const d = defs[id];
    const who = d.person ?? id;
    const g = gender(id);
    const label = typeof d.label === 'object' ? (d.label[g] ?? d.label.x ?? d.label.m ?? '') : d.label ?? '';
    return {
      id,
      name: Object.hasOwn(content.people, who) ? CONTENT_FNS.name(ctx, who) : d.name ?? id,
      surname: Object.hasOwn(content.people, who) ? CONTENT_FNS.surname(ctx, who) : '',
      label,
      status: known[id].status,
      book: known[id].book,
      bookTitle: bookTitle(content, known[id].book),
      years: d.years ?? '',
      you: Boolean(d.you),
      children: [],
    };
  };
  const partnerOf = (id) => {
    const direct = defs[id].partner;
    if (direct && known[direct]) return direct;
    return ids.find((o) => defs[o].partner === id) ?? null;
  };
  const parentsOf = (id) => (defs[id].parents ?? []).filter((p) => known[p]);
  const seen = new Set();
  const build = (id) => {
    const partner = partnerOf(id);
    const n = node(id);
    seen.add(id);
    if (partner) { n.partner = node(partner); seen.add(partner); }
    const couple = [id, partner].filter(Boolean);
    const kids = ids.filter((k) => !seen.has(k) && parentsOf(k).some((p) => couple.includes(p)));
    for (const k of kids) { if (!seen.has(k)) n.children.push(build(k)); }
    return n;
  };
  const roots = ids.filter((id) => {
    if (parentsOf(id).length) return false;
    const partner = partnerOf(id);
    return !(partner && parentsOf(partner).length);
  });
  const out = [];
  for (const id of roots) if (!seen.has(id)) out.push(build(id));
  return out;
}

/** Achievements with whether and when each was earned. Locked ones keep their text hidden unless `open`. */
export function achievementsView(profile, content) {
  const earned = profile?.achievements ?? {};
  return Object.entries(content.achievements ?? {}).map(([id, def]) => ({
    id,
    title: def.title ?? id,
    text: def.text ?? '',
    hint: def.hint ?? '',
    earned: Object.hasOwn(earned, id),
    at: earned[id] ?? null,
    secret: Boolean(def.secret),
  }));
}

export const TASK_INFO = {
  guard: { label: 'Guard your rest', text: 'Watch over the place where you sleep, so you are less likely to be found.' },
  business: { label: 'Work the business', text: 'Take a hand in your ventures, so they pay more now and you wake richer after the long sleep.' },
  watch: { label: 'Keep watch', text: 'Listen to the city while you sleep, and bring you news when you wake.' },
};
const TASK_RESULT_WORDS = { success: 'It went well.', partial: 'It went partly well.', failed: 'It did not go well.' };
const MISSION_WORDS = { scout: 'scouting', protect: 'guarding', negotiate: 'negotiating', hunt: 'hunting', retrieve: 'retrieving something' };
const MISSION_RESULT_WORDS = { success: 'Came back with what you asked.', partial: 'Came back with part of it.', injured: 'Came back hurt.', missing: 'Did not come back.' };

/**
 * The Coven tab: everyone sworn to you, what they are doing now, and the standing task each has for
 * the long sleep. No numbers are shown; loyalty and strength stay in the story's voice.
 */
export function covenView(state, content) {
  const s = state?.sys;
  if (!s) return { members: [], tasks: [], covenCount: 0 };
  const ctx = ctxOf(state, content);
  const members = Object.values(s.circle ?? {}).filter((m) => Object.hasOwn(content.people, m.id)).map((m) => {
    const active = m.status === 'active';
    const notes = [];
    if (m.kind === 'keeper') notes.push('Keeper');
    else notes.push('Coven');
    if (m.sire === 'hero') notes.push('Your blood');
    if (m.daywalk) notes.push('Walks in daylight');
    if (m.injured) notes.push('Hurt');
    if (!active) notes.push(MEMBER_WORDS[m.status] || m.status);
    let doing = '';
    if (active && m.mission && !m.mission.outcome) doing = `Away, ${MISSION_WORDS[m.mission.kind] ?? 'on an errand'}.`;
    else if (active && m.mission?.outcome) doing = MISSION_RESULT_WORDS[m.mission.outcome] ?? '';
    else if (active && m.task) doing = `Will ${TASK_INFO[m.task].label.toLowerCase()} while you sleep.`;
    else if (active) doing = 'At your side.';
    return {
      id: m.id,
      name: CONTENT_FNS.name(ctx, m.id),
      role: m.role || '',
      notes,
      doing,
      active,
      task: m.task || '',
      lastTask: m.taskResult ? `${TASK_INFO[m.task]?.label ?? 'Last task'}: ${TASK_RESULT_WORDS[m.taskResult] ?? ''}`.trim() : '',
      canTask: active && !taskProblem(m),
      joinedIn: bookTitle(content, m.joined),
    };
  });
  const order = (m) => (m.active ? 0 : 1);
  members.sort((a, b) => order(a) - order(b));
  return {
    members,
    tasks: TASKS.map((id) => ({ id, ...TASK_INFO[id] })),
    covenCount: members.filter((m) => m.active).length,
  };
}
