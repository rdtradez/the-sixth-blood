// The story runner. Executes a compiled chapter until it reaches a point where
// the player must act (continue, choose, or end of chapter), then stops and
// leaves a "frame" in state.frame describing what to show.
//
// The runner never touches the browser, storage, or the network. It only reads
// and writes the plain state object, which is why saving is trivial.

import { evaluate, BUILTIN_FNS } from './expr.js';
import { WAIT_OPS } from './script.js';
import { assign } from './state.js';
import { EngineError, nextRandom } from './util.js';

const MAX_STEPS = 50000;

export class Runner {
  /**
   * @param chapter  compiled chapter from parseChapter
   * @param state    plain game state (mutated in place)
   * @param env      { statDefs, fns, commands, warn, onUnknown }
   */
  constructor(chapter, state, env = {}) {
    this.chapter = chapter;
    this.state = state;
    this.env = {
      statDefs: {},
      fns: {},
      commands: {},
      warn: () => {},
      ...env,
    };
    this.fns = { ...BUILTIN_FNS, ...this.env.fns };
    this.commands = { log: (ctx, ...a) => this.env.warn(`log: ${a.join(' ')}`), ...this.env.commands };
  }

  get frame() {
    return this.state.frame;
  }

  // ---- Public controls --------------------------------------------------------

  /** Begin the chapter at a scene (default: the chapter's start scene). */
  start(scene = this.chapter.start) {
    this.state.stack = [];
    this.#enterScene(scene);
    return this.#run();
  }

  /** Re-attach to a loaded state that is sitting at a wait point. Executes nothing. */
  resume() {
    const op = this.#op();
    if (!op || !WAIT_OPS.has(op.op)) {
      throw new EngineError(`saved position ${this.state.pos.scene}:${this.state.pos.pc} is not a wait point`);
    }
    const frame = this.state.frame ?? { wait: op.op, paragraphs: [] };
    frame.wait = op.op;
    if (op.op === 'choices') frame.choices = this.#visibleChoices(op);
    if (op.op === 'chapter_end') frame.next = op.target;
    this.state.frame = frame;
    return frame;
  }

  /** Move past a page break. */
  continue() {
    const frame = this.state.frame;
    if (!frame || frame.wait !== 'page') throw new EngineError('nothing to continue (not at a page break)');
    this.state.pos.pc += 1;
    return this.#run();
  }

  /** Pick a choice by its index in frame.choices. */
  choose(index) {
    const frame = this.state.frame;
    if (!frame || frame.wait !== 'choices') throw new EngineError('no choice is waiting');
    const picked = frame.choices[index];
    if (!picked) throw new EngineError(`no choice at index ${index}`);
    const op = this.#op();
    const option = op.options[picked.i];
    if (option.once) this.state.once[option.key] = true;
    this.state.pos.pc = option.to;
    return this.#run();
  }

  // ---- Internals ----------------------------------------------------------------

  #scene(name = this.state.pos.scene) {
    const scene = this.chapter.scenes[name];
    if (!scene) throw new EngineError(`${this.chapter.id}: no scene "${name}"`);
    return scene;
  }

  #op() {
    const { scene, pc } = this.state.pos;
    return this.chapter.scenes[scene]?.ops[pc];
  }

  #enterScene(name) {
    this.#scene(name);
    this.state.pos = { scene: name, pc: 0 };
    const key = `${this.chapter.id}.${name}`;
    this.state.visited[key] = (this.state.visited[key] ?? 0) + 1;
  }

  #ctx() {
    const st = this.state;
    const chapterId = this.chapter.id;
    return {
      vars: st.vars,
      fns: this.fns,
      state: st,
      chapter: this.chapter,
      rand: () => nextRandom(st),
      visited: (name) => st.visited[name.includes('.') ? name : `${chapterId}.${name}`] ?? 0,
      unknown: this.env.onUnknown ? (n) => this.env.onUnknown(n, this.#where()) : undefined,
    };
  }

  #where() {
    const { scene, pc } = this.state.pos;
    const line = this.chapter.scenes[scene]?.ops[pc]?.line;
    return `${this.chapter.file}${line ? ':' + line : ''} (scene ${scene})`;
  }

  #render(item, ctx) {
    if (!item.parts) return item.text;
    return item.parts
      .map((p) => {
        if (typeof p === 'string') return p;
        const v = evaluate(p.expr, ctx);
        return typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v);
      })
      .join('');
  }

  #visibleChoices(op) {
    const ctx = this.#ctx();
    const out = [];
    op.options.forEach((o, i) => {
      if (o.once && this.state.once[o.key]) return;
      if (o.cond && !evaluate(o.cond, ctx)) return;
      out.push({ i, text: this.#render(o, ctx) });
    });
    return out;
  }

  #wait(op, paragraphs, extra = {}) {
    const st = this.state;
    st.pos.fp = op.fp;
    st.pos.anchor = op.anchor ?? null;
    st.frame = { wait: op.op, paragraphs, ...extra };
    return st.frame;
  }

  #run() {
    const st = this.state;
    const paragraphs = [];
    try {
      for (let steps = 0; ; steps++) {
        if (steps > MAX_STEPS) throw new EngineError('runaway loop: no page break or choice reached');
        const scene = this.#scene();
        const op = scene.ops[st.pos.pc];
        if (!op) throw new EngineError(`scene "${scene.name}" ran off its end (add a "->", "<~" or "=>")`);
        const ctx = this.#ctx();
        switch (op.op) {
          case 'text': paragraphs.push({ text: this.#render(op, ctx), kind: op.tk }); st.pos.pc++; break;
          case 'nop': st.pos.pc++; break;
          case 'set': this.#set(op, ctx); st.pos.pc++; break;
          case 'flag':
            for (const n of op.names) {
              if (op.value) st.vars[n] = true;
              else delete st.vars[n];
            }
            st.pos.pc++;
            break;
          case 'do': {
            const fn = Object.hasOwn(this.commands, op.name) ? this.commands[op.name] : null;
            if (!fn) throw new EngineError(`unknown command "${op.name}"`);
            fn(ctx, ...op.args.map((a) => evaluate(a, ctx)));
            st.pos.pc++;
            break;
          }
          case 'jf': st.pos.pc = evaluate(op.ast, ctx) ? st.pos.pc + 1 : op.to; break;
          case 'jmp': st.pos.pc = op.to; break;
          case 'goto': this.#enterScene(op.scene); break;
          case 'call': {
            const next = scene.ops[st.pos.pc + 1];
            st.stack.push({ scene: st.pos.scene, pc: st.pos.pc + 1, fp: next?.fp ?? '' });
            this.#enterScene(op.scene);
            break;
          }
          case 'ret': {
            const back = st.stack.pop();
            if (!back) throw new EngineError('"<~" with nothing to return to');
            st.pos = { scene: back.scene, pc: back.pc };
            break;
          }
          case 'page': return this.#wait(op, paragraphs);
          case 'chapter_end': return this.#wait(op, paragraphs, { next: op.target });
          case 'choices': {
            const choices = this.#visibleChoices(op);
            if (choices.length === 0) {
              this.env.warn(`no visible choices at ${this.#where()}; continuing past them`);
              st.pos.pc = op.end;
              break;
            }
            return this.#wait(op, paragraphs, { choices });
          }
          default: throw new EngineError(`unknown operation "${op.op}"`);
        }
      }
    } catch (e) {
      if (e instanceof EngineError && !e.located) {
        e.message = `${this.#where()}: ${e.message}`;
        e.located = true;
      }
      throw e;
    }
  }

  #set(op, ctx) {
    const st = this.state;
    const value = evaluate(op.ast, ctx);
    let next = value;
    if (op.how !== '=') {
      const cur = Object.prototype.hasOwnProperty.call(st.vars, op.name) ? st.vars[op.name] : 0;
      const a = typeof cur === 'number' ? cur : Number(cur);
      const b = Number(value);
      if (Number.isNaN(a) || Number.isNaN(b)) throw new EngineError(`"${op.name} ${op.how} ..." needs numbers`);
      next = op.how === '+=' ? a + b : op.how === '-=' ? a - b : op.how === '*=' ? a * b : a / b;
    }
    assign(st, this.env.statDefs, op.name, next);
  }
}

const isWait = (op) => Boolean(op) && WAIT_OPS.has(op.op);

function nearestByFp(ops, fp, nearPc, wantWait) {
  let best = -1;
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].fp !== fp) continue;
    if (wantWait && !isWait(ops[i])) continue;
    if (best < 0 || Math.abs(i - nearPc) < Math.abs(best - nearPc)) best = i;
  }
  return best;
}

/**
 * After loading a save into a (possibly edited) chapter, make sure the saved
 * position still points at the same moment of the story, and repair it if not.
 *
 * Order of attempts: exact match, named anchor (":label" before the wait),
 * nearest wait point with the same fingerprint, then restart the scene, then
 * restart the chapter. Returns { action, scene?, notices }.
 */
export function relocate(chapter, state) {
  const notices = [];
  const pos = state.pos;
  const scene = chapter.scenes[pos.scene];
  if (!scene) {
    return { action: 'restart_chapter', notices: [`The scene "${pos.scene}" no longer exists, so this chapter restarts from its beginning.`] };
  }
  let moved = false;
  const here = scene.ops[pos.pc];
  if (!(isWait(here) && here.fp === pos.fp)) {
    let target = -1;
    if (pos.anchor && pos.anchor in scene.labels && isWait(scene.ops[scene.labels[pos.anchor]])) {
      target = scene.labels[pos.anchor];
    }
    if (target < 0) target = nearestByFp(scene.ops, pos.fp, pos.pc, true);
    if (target < 0) {
      return { action: 'restart_scene', scene: pos.scene, notices: ['This chapter was updated after your save, so the current scene restarts from its beginning.'] };
    }
    pos.pc = target;
    moved = true;
  }
  if (moved) notices.push('This chapter was updated after your save; your place was matched to the new version.');
  if (state.stack.length) {
    const repaired = [];
    for (const entry of state.stack) {
      const sc = chapter.scenes[entry.scene];
      let pc = -1;
      if (sc) {
        if (sc.ops[entry.pc] && sc.ops[entry.pc].fp === entry.fp) pc = entry.pc;
        else if (entry.fp) pc = nearestByFp(sc.ops, entry.fp, entry.pc, false);
        else if (entry.pc <= sc.ops.length) pc = entry.pc;
      }
      if (pc < 0) { repaired.length = 0; repaired.push(null); break; }
      repaired.push({ ...entry, pc });
    }
    if (repaired[0] === null) {
      state.stack = [];
      notices.push('A return point in this chapter changed, so the story continues without it.');
    } else state.stack = repaired;
  }
  return { action: moved ? 'moved' : 'ok', notices };
}
