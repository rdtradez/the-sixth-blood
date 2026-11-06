// The game systems (session 3), gathered in one place.
//
//   life        day and night phases, feeding, power costs, kills, witnesses, day raids
//   combat      fights of 2 or 3 exchanges
//   collis      ventures, wealth, holdings, coven or lone path
//   village     Collesanto's buildings and prosperity
//   circle      coven roster, keepers, assigned missions, members' own quests
//   bonds       people met, fates, romances and how they ended
//   originals   the six originals tracker
//   collection  pieces for the New York museum
//   sleep       sleep and steward resolution, the wake report
//   lore        the codex and the family tree
//   looks       the hero's chosen appearance in the story's words
//
// `$ do rest()` closes a chapter: hunger rises, Secrecy and Humanity settle, ventures pay,
// missions come home. rested("income") and friends read what that rest did.
//
// The Velati journal is composed by the Game at the end of each book from the book's
// journal script (see engine/game.js and docs/SYSTEMS.md).

import { checked, sysOf, rule, EMPTY_CATALOG, argProblem, optional, enumValues } from './core.js';
import { life, restLife } from './life.js';
import { combat, tierNames } from './combat.js';
import { collis, restCollis, income } from './collis.js';
import { village, villageDefense } from './village.js';
import { circle, restCircle, memberPower } from './circle.js';
import { bonds } from './bonds.js';
import { originals, quickOriginals, originalRecord } from './originals.js';
import { collection } from './collection.js';
import { sleep, quickSleep } from './sleep.js';
import { lore, quickLore } from './lore.js';
import { looks } from './looks.js';
import { lookCatalog } from '../looks.js';
import { EngineError } from '../util.js';
import { createSys } from './sys-state.js';

export { createSys };

export const SYSTEMS = { life, combat, collis, village, circle, bonds, originals, collection, sleep, lore, looks };

const REST_FIELDS = ['income', 'kills', 'witnesses', 'missions'];

const rest = {
  fns: {
    rested: {
      spec: [REST_FIELDS],
      fn(ctx, field) {
        const r = sysOf(ctx).lastRest;
        if (!r) return 0;
        return field === 'missions' ? r.missions.length : r[field] ?? 0;
      },
    },
  },
  commands: {
    rest: {
      spec: [],
      fn(ctx) {
        const report = { book: ctx.state.book, chapter: ctx.state.chapter };
        restCollis(ctx, report);
        restCircle(ctx, report);
        restLife(ctx, report);
        sysOf(ctx).lastRest = report;
      },
    },
  },
};

const ALL = { ...SYSTEMS, rest };

/** name -> spec, for functions and for commands. Used by the parser, validator and checker. */
export const FN_SPECS = {};
export const COMMAND_SPECS = {};
export const SYSTEM_FNS = {};
export const SYSTEM_COMMANDS = {};
for (const sys of Object.values(ALL)) {
  for (const [name, { spec, fn }] of Object.entries(sys.fns ?? {})) {
    if (Object.hasOwn(FN_SPECS, name)) throw new Error(`system function "${name}" is defined twice`);
    FN_SPECS[name] = spec;
    SYSTEM_FNS[name] = checked(name, spec, fn, 'function');
  }
  for (const [name, { spec, fn }] of Object.entries(sys.commands ?? {})) {
    if (Object.hasOwn(COMMAND_SPECS, name)) throw new Error(`system command "${name}" is defined twice`);
    COMMAND_SPECS[name] = spec;
    SYSTEM_COMMANDS[name] = checked(name, spec, fn, '$ do');
  }
}
export const SYSTEM_FN_NAMES = Object.keys(SYSTEM_FNS);
export const SYSTEM_COMMAND_NAMES = Object.keys(SYSTEM_COMMANDS);

// ---- Catalogs ---------------------------------------------------------------------------------

/** Content files the systems read, by loader name. */
export const SYSTEM_FILES = ['rules', 'ventures', 'village', 'holdings', 'originals', 'collection', 'sleep', 'codex', 'family', 'looks'];

const entries = (file, key) => {
  const raw = file?.[key] ?? {};
  const out = {};
  for (const [id, def] of Object.entries(raw)) if (id !== 'note') out[id] = { id, ...def };
  return out;
};

/** Normalize the system content files into one catalog object (content.systems). */
export function buildCatalog(files = {}) {
  const rules = files.rules ?? {};
  const gaps = entries(files.sleep, 'gaps');
  const investments = {};
  for (const g of Object.values(gaps)) for (const [id, def] of Object.entries(g.investments ?? {})) investments[id] = { id, gap: g.id, ...def };
  const tiers = {};
  for (const t of tierNames(rules)) tiers[t] = rules.combat?.tiers?.[t] ?? {};
  return {
    ...EMPTY_CATALOG,
    rules,
    ventures: entries(files.ventures, 'ventures'),
    buildings: entries(files.village, 'buildings'),
    holdings: entries(files.holdings, 'holdings'),
    originals: entries(files.originals, 'originals'),
    items: entries(files.collection, 'items'),
    codex: entries(files.codex, 'entries'),
    codexCategories: files.codex?.categories ?? {},
    kin: entries(files.family, 'members'),
    looks: lookCatalog(files.looks),
    gaps,
    investments,
    tiers,
  };
}

/** Problems in the system catalogs, for `npm run check`. */
export function checkCatalog(catalog, { bookIds }) {
  const errors = [];
  const book = (where, id) => { if (id && !bookIds.has(id)) errors.push(`${where}: unknown book "${id}"`); };
  for (const v of Object.values(catalog.ventures)) {
    book(`ventures: ${v.id}`, v.book);
    if (!v.book) errors.push(`ventures: ${v.id} has no book`);
    if (!(v.cost > 0) || !(v.income >= 0)) errors.push(`ventures: ${v.id} needs a positive cost and an income`);
  }
  for (const b of Object.values(catalog.buildings)) {
    book(`village: ${b.id}`, b.book);
    for (const r of b.requires ?? []) if (!catalog.buildings[r]) errors.push(`village: ${b.id} requires unknown building "${r}"`);
    if (!(b.cost > 0)) errors.push(`village: ${b.id} needs a positive cost`);
  }
  for (const h of Object.values(catalog.holdings)) {
    if (h.book) book(`holdings: ${h.id}`, h.book);
    if (h.path && !['any', 'coven', 'lone'].includes(h.path)) errors.push(`holdings: ${h.id} has unknown path "${h.path}"`);
    if (h.scope && !['city', 'lasting'].includes(h.scope)) errors.push(`holdings: ${h.id} has unknown scope "${h.scope}"`);
  }
  for (const o of Object.values(catalog.originals)) {
    book(`originals: ${o.id}`, o.book);
    if (!['sleeping', 'wandering'].includes(o.kind)) errors.push(`originals: ${o.id} must be "sleeping" or "wandering"`);
  }
  for (const i of Object.values(catalog.items)) book(`collection: ${i.id}`, i.book);
  for (const g of Object.values(catalog.gaps)) {
    book(`sleep: ${g.id}`, g.from);
    book(`sleep: ${g.id}`, g.to);
    if (!(g.growth > 0)) errors.push(`sleep: ${g.id} needs a positive growth`);
  }
  const KIN = ['living', 'dead', 'unknown'];
  for (const e of Object.values(catalog.codex)) {
    book(`codex: ${e.id}`, e.book);
    if (!e.title || !e.text) errors.push(`codex: ${e.id} needs a title and text`);
    if (e.category && !Object.hasOwn(catalog.codexCategories ?? {}, e.category)) errors.push(`codex: ${e.id} has unknown category "${e.category}" (see categories in content/codex.json)`);
    if (e.original && !catalog.originals[e.original]) errors.push(`codex: ${e.id} is tied to unknown original "${e.original}"`);
  }
  for (const k of Object.values(catalog.kin)) {
    book(`family: ${k.id}`, k.book);
    if (!k.book) errors.push(`family: ${k.id} has no book`);
    for (const p of k.parents ?? []) if (!catalog.kin[p]) errors.push(`family: ${k.id} has unknown parent "${p}"`);
    if (k.partner && !catalog.kin[k.partner]) errors.push(`family: ${k.id} has unknown partner "${k.partner}"`);
    if (typeof k.quick === 'string' && !KIN.includes(k.quick)) errors.push(`family: ${k.id} quick status must be one of ${KIN.join(', ')}`);
  }
  const seenInv = new Set();
  for (const g of Object.values(catalog.gaps)) for (const id of Object.keys(g.investments ?? {})) {
    if (seenInv.has(id)) errors.push(`sleep: investment "${id}" is used by two gaps`);
    seenInv.add(id);
  }
  return errors;
}

/** Check one call's literal arguments against its spec. Returns error strings. */
export function checkCall(kind, name, args, content) {
  const specs = kind === 'fn' ? FN_SPECS : COMMAND_SPECS;
  if (!Object.hasOwn(specs, name)) return [];
  const spec = specs[name];
  const required = spec.filter((k) => !optional(k)).length;
  const label = kind === 'fn' ? `${name}()` : `$ do ${name}()`;
  const out = [];
  if (args.length < required || args.length > spec.length) {
    out.push(`${label} takes ${required === spec.length ? required : `${required} to ${spec.length}`} argument(s), got ${args.length}`);
    return out;
  }
  args.forEach((a, i) => {
    if (a?.t !== 'lit') return; // only literal values can be checked before play
    const p = argProblem(spec[i], a.v, content);
    if (p) out.push(`${label}: ${p}`);
  });
  return out;
}

/** The allowed values of an enum argument, for docs and tools. */
export function argValues(kind, name, i) {
  const spec = (kind === 'fn' ? FN_SPECS : COMMAND_SPECS)[name];
  return spec ? enumValues(spec[i]) : null;
}

// ---- Quick start ------------------------------------------------------------------------------

/** Give a quick start state the default history of the systems for every skipped book. */
export function quickSystems(state, content, skippedBookIds) {
  const ctx = { state, vars: state.vars, content, rand: () => 0.5 };
  state.sys ??= createSys();
  quickOriginals(ctx, skippedBookIds);
  quickSleep(ctx, skippedBookIds);
  quickLore(ctx, skippedBookIds);
}

// ---- A summary for screens (session 4's people screen, codex, coven panel) --------------------

/** What the hero knows of his world: a plain summary of the systems state with names resolved. */
export function systemsView(state, content) {
  const ctx = { state, vars: state.vars, content };
  const s = state.sys;
  if (!s) return null;
  const c = content.systems;
  const names = rule(ctx, 'collis.names', {});
  return {
    collis: names[state.book] ?? names.default ?? 'Collis',
    income: income(ctx),
    ventures: Object.entries(s.ventures).map(([id, v]) => ({ id, name: c.ventures[id]?.name ?? id, level: v.level, dark: Boolean(c.ventures[id]?.dark), legacy: Boolean(v.legacy) })),
    holdings: Object.keys(s.holdings).map((id) => ({ id, name: c.holdings[id]?.name ?? id })),
    path: s.path,
    village: { built: Object.keys(s.village.built).map((id) => ({ id, name: c.buildings[id]?.name ?? id })), defense: villageDefense(ctx) },
    circle: Object.values(s.circle).map((m) => ({ id: m.id, kind: m.kind, role: m.role, status: m.status, line: m.line, daywalk: m.daywalk, away: Boolean(m.mission && !m.mission.outcome), power: memberPower(ctx, m) })),
    people: Object.entries(s.people).map(([id, p]) => ({ id, met: p.met, fate: p.fate, romance: s.romances[id] ? (s.romances[id].ending || s.romances[id].state) : '' })),
    // Only originals the hero has learned of: anything past their starting state.
    originals: Object.entries(s.originals).filter(([, r]) => r.state !== 'asleep' && r.state !== 'hidden').map(([id, r]) => ({ id, title: c.originals[id]?.title ?? id, ...r })),
    items: Object.entries(s.items).filter(([, i]) => !i.lost).map(([id, i]) => ({ id, name: c.items[id]?.name ?? id, book: i.book, displayed: i.displayed })),
    wake: s.sleep.wake,
  };
}

export { originalRecord, EngineError };
