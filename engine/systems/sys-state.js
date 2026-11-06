// The shape of state.sys, the game systems' part of a save. No imports, so engine/state.js
// can use it without import cycles. Changing this shape needs a schema migration.

export function createSys() {
  return {
    phase: null, // { kind: 'day'|'night', left, used }
    unfed: 0, // actions since he last fed
    recent: [], // the last few feedings, for the animal diet weakness
    diet: {}, // feeding counts by kind, ever (achievements read this)
    tally: { kills: 0, witnesses: 0, vampireKills: 0 }, // since the last rest
    raids: {}, // day raids per book
    fight: null, // the current or last fight
    ventures: {}, // id -> { level, book, legacy }
    collis: { hidden: false },
    holdings: {}, // id -> book acquired
    path: '', // 'coven' | 'lone'
    village: { built: {}, fund: 0 },
    circle: {}, // id -> member
    sired: {}, // book -> count
    people: {}, // id -> { met, fate }
    romances: {}, // id -> { state, book, since, ending, endedIn }
    seq: 0,
    originals: {}, // id -> { state, by, fate, name, book }
    items: {}, // id -> { book, displayed, lost }
    sleep: { plan: null, wake: null, history: [] },
    lore: { codex: {}, kin: {} }, // id -> { book, chapter } / id -> { book, status } (session 4)
    lastRest: null,
  };
}
