// The circle: coven members (vampires) and, on the lone path, the human keepers.
// Every member is a person in content/people.json, and their loyalty is the stat loyalty.<id>.
//
//   $ do sire("lucia", "scout")               give the Dark Gift (cap per book and in total, not in Book One)
//   $ do sire("lucia", "scout", true)         a rare fledgling who inherits daywalking
//   $ do recruit("orsino", "merchant", 2)     a vampire of another line joins (line, starting age tier)
//   $ do keeper("tullia", "steward")          a sworn human of the Valerius keepers
//   $ do assign_role("lucia", "guard")        roles are free text the story chooses
//   $ do member_fate("lucia", "left")         active, left, dead, captured, betrayed
//   in_circle("lucia"), member("lucia", "status"), member_power("lucia"), daywalker("lucia")
//   coven_size(), circle_size(), can_sire(), sired_this_book()
//
// Assigned missions, sent in a day or night action instead of acting himself:
//   $ do send("lucia", "scout", 2)            scout, protect, negotiate, hunt, retrieve; risk 1 to 3
//   on_mission("lucia"), mission("lucia")     "" while away, then success, partial, injured or missing
//   $ do debrief("lucia")                     clear the report once the story has told it
// Missions resolve at rest after 1 chapter (2 for risk 3 or retrieve). Outcomes come from the
// member's age, role, loyalty and the risk, with a seeded roll.
//
// Their own missions:
//   $ do quest("lucia", "lost_brother")       the member has a personal quest
//   $ do quest_answer("lucia", "join")        approve, refuse or join: changes loyalty
//   $ do quest_done("lucia")                  finished; quest("lucia") reads its key, quest_state() its state
//   acts_alone("lucia")                       low loyalty: they act behind his back

import { sysOf, cat, rule, bump, stat, bookNumber, roll, logDecision } from './core.js';
import { EngineError } from '../util.js';

export const STATUSES = ['active', 'left', 'dead', 'captured', 'betrayed'];
export const MISSIONS = ['scout', 'protect', 'negotiate', 'hunt', 'retrieve'];
export const MEMBER_FIELDS = ['status', 'role', 'line', 'kind', 'sire', 'joined', 'quest'];
export const QUEST_ANSWERS = ['approve', 'refuse', 'join'];

const present = (m) => m && (m.status === 'active');

function get(ctx, id) {
  const m = sysOf(ctx).circle[id];
  if (!m) throw new EngineError(`"${id}" is not in the circle (sire, recruit or keeper first)`);
  return m;
}

/** A member's strength: their age tier at joining, plus every book since, plus the old blood if he sired them. */
export function memberPower(ctx, m) {
  if (m.kind === 'keeper') return 1;
  let p = m.tier + Math.max(0, bookNumber(ctx) - bookNumber(ctx, m.joined));
  if (m.sire === 'hero') p += 1;
  if (m.sire === 'hero' && m.tier <= 1 && Object.hasOwn(sysOf(ctx).holdings, 'training_hall')) p += 1;
  if (m.injured) p -= 1;
  return p;
}

function vampires(s) {
  return Object.values(s.circle).filter((m) => m.kind === 'vampire' && present(m));
}

function sireProblem(ctx) {
  const s = sysOf(ctx);
  if (bookNumber(ctx) < rule(ctx, 'coven.sireFromBook', 2)) return 'he cannot give the Dark Gift yet (not before Book Two)';
  if ((s.sired[ctx.state.book] ?? 0) >= rule(ctx, 'coven.sirePerBook', 2)) return 'he has already sired as many as he can this book';
  if (vampires(s).length >= rule(ctx, 'coven.cap', 10)) return 'the coven is at its limit';
  return null;
}

function add(ctx, id, m, loyalty) {
  const s = sysOf(ctx);
  const old = s.circle[id];
  if (old && present(old)) throw new EngineError(`"${id}" is already in the circle`);
  s.circle[id] = { id, injured: false, mission: null, quest: null, role: '', status: 'active', joined: ctx.state.book, ...m };
  ctx.state.vars[`loyalty.${id}`] = Math.max(0, Math.min(100, Math.round(loyalty)));
}

export const circle = {
  fns: {
    in_circle: { spec: ['person'], fn: (ctx, id) => present(sysOf(ctx).circle[id]) },
    member: {
      spec: ['person', MEMBER_FIELDS],
      fn(ctx, id, field) {
        const m = sysOf(ctx).circle[id];
        if (!m) return field === 'status' ? 'none' : '';
        if (field === 'quest') return m.quest?.key ?? '';
        return m[field] ?? '';
      },
    },
    member_power: { spec: ['person'], fn: (ctx, id) => (sysOf(ctx).circle[id] ? memberPower(ctx, sysOf(ctx).circle[id]) : 0) },
    daywalker: { spec: ['person'], fn: (ctx, id) => Boolean(sysOf(ctx).circle[id]?.daywalk) },
    coven_size: { spec: [], fn: (ctx) => vampires(sysOf(ctx)).length },
    circle_size: { spec: [], fn: (ctx) => Object.values(sysOf(ctx).circle).filter(present).length },
    can_sire: { spec: [], fn: (ctx) => sireProblem(ctx) === null },
    sired_this_book: { spec: [], fn: (ctx) => sysOf(ctx).sired[ctx.state.book] ?? 0 },
    on_mission: { spec: ['person'], fn: (ctx, id) => Boolean(sysOf(ctx).circle[id]?.mission && !sysOf(ctx).circle[id].mission.outcome) },
    mission: { spec: ['person'], fn: (ctx, id) => sysOf(ctx).circle[id]?.mission?.outcome ?? '' },
    quest_state: { spec: ['person'], fn: (ctx, id) => sysOf(ctx).circle[id]?.quest?.state ?? '' },
    acts_alone: {
      spec: ['person'],
      fn(ctx, id) {
        const m = sysOf(ctx).circle[id];
        if (!present(m)) return false;
        const lim = rule(ctx, 'coven.actsAloneBelow', 30);
        const loyalty = stat(ctx, `loyalty.${id}`);
        // The sixth line's defiance: his own fledglings drift when his defiance runs high and their loyalty is middling.
        return loyalty < lim || (m.sire === 'hero' && loyalty < lim + 20 && stat(ctx, 'defiance') >= 70);
      },
    },
  },
  commands: {
    sire: {
      spec: ['person', 'text?', 'bool?', 'number?'],
      fn(ctx, id, role = '', daywalk = false, loyalty = 70) {
        const p = sireProblem(ctx);
        if (p) throw new EngineError(`$ do sire("${id}"): ${p} (check can_sire() first)`);
        const s = sysOf(ctx);
        add(ctx, id, { kind: 'vampire', line: 'sixth', sire: 'hero', tier: 1, daywalk, role }, loyalty);
        s.sired[ctx.state.book] = (s.sired[ctx.state.book] ?? 0) + 1;
        // Siring with the old blood drains him heavily, and every new vampire alarms the Velati.
        bump(ctx, 'hunger', rule(ctx, 'coven.sireHunger', 30));
        bump(ctx, 'velati_regard', -rule(ctx, 'coven.sireVelati', 5));
        logDecision(ctx, `sired.${id}`, ctx.state.book);
      },
    },
    recruit: {
      spec: ['person', 'text', 'number?', 'text?', 'number?', 'bool?'],
      fn(ctx, id, line, tier = 1, role = '', loyalty = 50, daywalk = false) {
        if (vampires(sysOf(ctx)).length >= rule(ctx, 'coven.cap', 10)) throw new EngineError(`$ do recruit("${id}"): the coven is at its limit`);
        add(ctx, id, { kind: 'vampire', line, sire: 'other', tier: Math.max(1, Math.round(tier)), daywalk, role }, loyalty);
        logDecision(ctx, `joined.${id}`, ctx.state.book);
      },
    },
    keeper: {
      spec: ['person', 'text?', 'number?'],
      fn(ctx, id, role = '', loyalty = 60) {
        add(ctx, id, { kind: 'keeper', line: 'human', sire: '', tier: 0, daywalk: true, role }, loyalty);
      },
    },
    assign_role: { spec: ['person', 'text'], fn: (ctx, id, role) => { get(ctx, id).role = role; } },
    member_fate: {
      spec: ['person', STATUSES],
      fn(ctx, id, status) {
        const m = get(ctx, id);
        m.status = status;
        if (status !== 'active') m.mission = null;
        if (status !== 'active') logDecision(ctx, `fate.${id}`, status);
      },
    },
    send: {
      spec: ['person', MISSIONS, 'number?'],
      fn(ctx, id, kind, risk = 2) {
        const m = get(ctx, id);
        if (!present(m)) throw new EngineError(`$ do send("${id}"): they are not available`);
        if (m.mission && !m.mission.outcome) throw new EngineError(`$ do send("${id}"): already on a mission`);
        const r = Math.max(1, Math.min(3, Math.round(risk)));
        m.mission = { kind, risk: r, left: r >= 3 || kind === 'retrieve' ? 2 : 1, outcome: '' };
      },
    },
    debrief: {
      spec: ['person'],
      fn(ctx, id) {
        const m = get(ctx, id);
        if (m.mission?.outcome) m.mission = null;
      },
    },
    quest: {
      spec: ['person', 'text'],
      fn(ctx, id, key) { get(ctx, id).quest = { key, state: 'asked' }; },
    },
    quest_answer: {
      spec: ['person', QUEST_ANSWERS],
      fn(ctx, id, answer) {
        const m = get(ctx, id);
        if (!m.quest) throw new EngineError(`$ do quest_answer("${id}"): they have no quest`);
        m.quest.state = answer;
        const delta = { approve: 8, refuse: -10, join: 12 }[answer];
        bump(ctx, `loyalty.${id}`, rule(ctx, `coven.questLoyalty.${answer}`, delta));
      },
    },
    quest_done: {
      spec: ['person', 'bool?'],
      fn(ctx, id, helped = true) {
        const m = get(ctx, id);
        if (!m.quest) return;
        m.quest.state = 'done';
        if (helped) bump(ctx, `loyalty.${id}`, rule(ctx, 'coven.questDoneLoyalty', 10));
      },
    },
  },
};

/** Resolve one mission. */
function resolve(ctx, m) {
  const mission = m.mission;
  const fits = m.role && m.role === mission.kind ? 2 : 0;
  const sun = m.daywalk && mission.kind === 'scout' ? 1 : 0;
  const score = memberPower(ctx, m) + fits + sun + Math.floor(stat(ctx, `loyalty.${m.id}`) / 25) + roll(ctx, 6) - mission.risk * 3;
  if (score >= 7) return 'success';
  if (score >= 4) return 'partial';
  if (score >= 2) return 'injured';
  return 'missing';
}

/** At rest: missions count down and resolve. Lost members are captured or killed (the story reads member(id, "status")). */
export function restCircle(ctx, report) {
  report.missions = [];
  for (const m of Object.values(sysOf(ctx).circle)) {
    if (!m.mission || m.mission.outcome) continue;
    m.mission.left -= 1;
    if (m.mission.left > 0) continue;
    const outcome = resolve(ctx, m);
    m.mission.outcome = outcome;
    if (outcome === 'injured') m.injured = true;
    if (outcome === 'missing') {
      m.status = m.mission.risk >= 3 || roll(ctx, 2) === 1 ? 'dead' : 'captured';
      logDecision(ctx, `fate.${m.id}`, m.status);
    }
    if (outcome === 'success') bump(ctx, `loyalty.${m.id}`, 2);
    report.missions.push({ id: m.id, outcome });
  }
}

/** On waking from a long sleep: injuries have healed. */
export function wakeCircle(ctx) {
  for (const m of Object.values(sysOf(ctx).circle)) { m.injured = false; m.mission = null; }
}
