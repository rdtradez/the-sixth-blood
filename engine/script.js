// Story script parser and compiler (.tsb files). See docs/SCRIPT_FORMAT.md.
//
// A chapter is parsed into scenes, and each scene is compiled to a flat list of
// operations with numeric jump targets. A flat list means the story position is
// just (scene, pc), which is what makes mid-scene saves simple and reliable.

import { parseExpr, parseTags, ExprError, BUILTIN_FNS } from './expr.js';
import { CONTENT_FN_NAMES, SHORTHAND_KEYS, PRONOUN_KEYS, VARIANT_GROUPS } from './content.js';
import { SYSTEM_FN_NAMES } from './systems/index.js';
import { ScriptError, fnv1a } from './util.js';

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const VAR_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const badVarName = (n) => !VAR_RE.test(n) || RESERVED.has(n) || n.split('.').some((p) => RESERVED.has(p));
export const WAIT_OPS = new Set(['page', 'choices', 'chapter_end']);
const TERMINATORS = new Set(['goto', 'ret', 'chapter_end', 'jmp']);
const capFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// "[briton gaul] text" shows the line only for those origins, roles or paths.
const TAG_LINE_RE = /^\[((?:not\s+|!)?[a-z_][a-z0-9_]*(?:[\s,|]+[a-z_][a-z0-9_]*)*)\]\s+(.+)$/;
const JUMP_RE = new RegExp(`^([A-Za-z_][A-Za-z0-9_]*)\\s*\\[(${VARIANT_GROUPS.join('|')})\\]$`);

/**
 * Parse and compile one chapter.
 * Returns { chapter, errors, warnings }. `chapter` is null if there were errors.
 */
export function parseChapter(source, { file = '<memory>', fnNames = null } = {}) {
  const errors = [];
  const warnings = [];
  const err = (line, msg) => errors.push(new ScriptError(msg, { file, line }));
  const callNames = new Set([...Object.keys(BUILTIN_FNS), ...CONTENT_FN_NAMES, ...SYSTEM_FN_NAMES, ...(fnNames ?? [])]);
  const expr = (src, line, opts = {}) => {
    try {
      return parseExpr(src, { callNames: opts.anyCall ? null : callNames });
    } catch (e) {
      if (e instanceof ExprError) { err(line, `${e.message} in "${src}"`); return null; }
      throw e;
    }
  };

  // ---- Split into header and scenes ---------------------------------------
  const header = {};
  const blocks = [];
  let cur = null;
  source.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, idx) => {
    const no = idx + 1;
    const expanded = raw.replace(/\t/g, '  ');
    const text = expanded.trim();
    if (text === '' || text.startsWith('//')) return;
    const indent = expanded.length - expanded.trimStart().length;
    if (text.startsWith('# ')) {
      const name = text.slice(2).trim();
      if (!NAME_RE.test(name)) { err(no, `bad scene name "${name}" (letters, digits, underscore)`); }
      if (blocks.some((b) => b.name === name)) err(no, `duplicate scene "${name}"`);
      cur = { name, line: no, lines: [] };
      blocks.push(cur);
      return;
    }
    if (!cur) {
      const m = /^@(\w+)\s*(.*)$/.exec(text);
      if (m) header[m[1]] = { value: m[2].trim(), line: no };
      else err(no, 'text before the first scene; start a scene with "# name"');
      return;
    }
    if (text.startsWith('@')) { err(no, 'header lines (@...) must come before the first scene'); return; }
    cur.lines.push({ no, indent, text });
  });

  for (const key of Object.keys(header)) {
    if (!['chapter', 'title', 'book', 'version', 'start', 'next'].includes(key)) {
      err(header[key].line, `unknown header "@${key}"`);
    }
  }
  if (!header.chapter?.value) err(1, 'missing "@chapter id" header');
  const version = header.version ? Number.parseInt(header.version.value, 10) : 1;
  if (!Number.isInteger(version) || version < 1) err(header.version?.line ?? 1, '@version must be a whole number, 1 or higher');
  if (blocks.length === 0) err(1, 'chapter has no scenes');

  const chapter = {
    id: header.chapter?.value ?? '',
    title: header.title?.value || header.chapter?.value || '',
    book: header.book?.value ?? '',
    version,
    start: header.start?.value || 'start',
    next: header.next?.value || null,
    file,
    scenes: {},
  };
  if (blocks.length && !blocks.some((b) => b.name === chapter.start)) {
    err(header.start?.line ?? 1, `start scene "${chapter.start}" does not exist`);
  }

  // ---- Text shorthand: {they} {Their} {livia.them} {name} {cassian.name} {alias} {surname} ----
  // Pronoun keys are the "they" words. A capital first letter capitalizes the result.
  function shorthand(src) {
    const m = /^\s*(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z]+)\s*$/.exec(src);
    if (!m) return null;
    const key = m[2].toLowerCase();
    if (!SHORTHAND_KEYS.has(key)) return null;
    if (m[2] !== key && m[2] !== capFirst(key)) return null;
    const who = { t: 'lit', v: m[1] ?? 'hero' };
    const call = PRONOUN_KEYS.has(key)
      ? { t: 'call', name: 'pro', args: [who, { t: 'lit', v: key }] }
      : { t: 'call', name: key, args: [who] };
    return m[2] === key ? call : { t: 'call', name: 'cap', args: [call] };
  }

  // ---- Text with {expressions} ---------------------------------------------
  function compileText(raw, line) {
    const parts = [];
    let buf = '';
    let hasExpr = false;
    let i = 0;
    while (i < raw.length) {
      const c = raw[i];
      if (c === '\\' && '{}\\'.includes(raw[i + 1] ?? ' ')) { buf += raw[i + 1]; i += 2; continue; }
      if (c === '{') {
        let j = i + 1;
        let q = null;
        let depth = 1;
        for (; j < raw.length; j++) {
          const d = raw[j];
          if (q) { if (d === '\\') j++; else if (d === q) q = null; }
          else if (d === '"' || d === "'") q = d;
          else if (d === '{') depth++;
          else if (d === '}') { depth--; if (depth === 0) break; }
        }
        if (j >= raw.length) { err(line, 'unclosed "{" in text (use \\{ for a literal brace)'); return { text: raw, parts: null }; }
        if (buf) parts.push(buf);
        buf = '';
        const src = raw.slice(i + 1, j);
        const ast = shorthand(src) ?? expr(src, line);
        parts.push({ expr: ast, src });
        hasExpr = true;
        i = j + 1;
        continue;
      }
      buf += c;
      i++;
    }
    if (buf) parts.push(buf);
    return hasExpr ? { text: null, parts } : { text: buf, parts: null };
  }

  // ---- Parse one scene into a tree ------------------------------------------
  function parseScene(block) {
    const lines = block.lines;
    let i = 0;

    function parseBlock(minIndent, stops) {
      const nodes = [];
      while (i < lines.length) {
        const L = lines[i];
        if (L.indent < minIndent) break;
        const t = L.text;
        const ctl = /^\?(elif|else|end)\b/.exec(t);
        if (ctl) {
          if (stops) break;
          err(L.no, `"?${ctl[1]}" without a matching "?if"`);
          i++;
          continue;
        }
        if (t.startsWith('* ')) { nodes.push(parseChoices(L.indent)); continue; }
        if (/^\?if\b/.test(t)) { nodes.push(parseIf(minIndent)); continue; }
        i++;
        const node = parseSimple(L);
        if (node) nodes.push(node);
      }
      return nodes;
    }

    function parseIf(minIndent) {
      const start = lines[i];
      const branches = [];
      let elseBody = null;
      let closed = false;
      const first = /^\?if\s+(.+)$/.exec(start.text);
      if (!first) err(start.no, '"?if" needs a condition');
      i++;
      branches.push({ cond: first ? expr(first[1], start.no) : null, body: parseBlock(minIndent, true), line: start.no });
      while (i < lines.length) {
        const L = lines[i];
        let m;
        if ((m = /^\?elif\s+(.+)$/.exec(L.text))) {
          i++;
          branches.push({ cond: expr(m[1], L.no), body: parseBlock(minIndent, true), line: L.no });
        } else if (/^\?else\s*$/.test(L.text)) {
          if (elseBody) err(L.no, 'second "?else" in the same "?if"');
          i++;
          elseBody = parseBlock(minIndent, true);
        } else if (/^\?end\s*$/.test(L.text)) {
          i++;
          closed = true;
          break;
        } else {
          break;
        }
      }
      if (!closed) err(start.no, '"?if" is never closed with "?end"');
      return { kind: 'if', branches, elseBody, line: start.no };
    }

    function parseChoices(indent) {
      const options = [];
      const startLine = lines[i].no;
      while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('* ')) {
        const L = lines[i];
        i++;
        let head = L.text.slice(2).trim();
        let cond = null;
        const cm = /^(.*?)\s+\?if\s+(.+)$/.exec(head);
        if (cm) { head = cm[1].trim(); cond = expr(cm[2], L.no); }
        let once = false;
        const om = /^(.*?)\s*\[once\]$/.exec(head);
        if (om) { head = om[1].trim(); once = true; }
        if (!head) err(L.no, 'choice has no text');
        const body = parseBlock(indent + 1, null);
        options.push({ head, cond, once, body, line: L.no });
      }
      return { kind: 'choices', options, line: startLine };
    }

    function parseSimple(L) {
      const t = L.text;
      const no = L.no;
      if (t === '---') return { kind: 'page', line: no };
      if (t === '<~') return { kind: 'ret', line: no };
      let m;
      if ((m = /^:([A-Za-z_][A-Za-z0-9_]*)$/.exec(t))) return { kind: 'label', name: m[1], line: no };
      if ((m = /^->\s*(.+)$/.exec(t))) return jump('goto', m[1].trim(), no);
      if ((m = /^~>\s*(.+)$/.exec(t))) return jump('call', m[1].trim(), no);
      if ((m = TAG_LINE_RE.exec(t))) {
        let cond = null;
        try {
          const { neg, tags } = parseTags(m[1]);
          const call = { t: 'call', name: 'variant', args: tags.map((v) => ({ t: 'lit', v })) };
          cond = neg ? { t: 'un', op: '!', a: call } : call;
        } catch (e) {
          if (e instanceof ExprError) err(no, e.message); else throw e;
        }
        const inner = parseSimple({ ...L, text: m[2].trim() });
        if (!inner) return null;
        if (inner.kind === 'label') { err(no, 'a label cannot be shown only for some origins'); return null; }
        return { kind: 'if', branches: [{ cond, body: [inner], line: no }], elseBody: null, line: no };
      }
      if ((m = /^=>\s*(.+)$/.exec(t))) return { kind: 'chapter_end', target: m[1].trim(), line: no };
      if (t.startsWith('$ ') || t === '$') return parseCommand(t.slice(1).trim(), no);
      if (t.startsWith('\\')) return { kind: 'text', raw: t.slice(1), tk: 'p', line: no };
      if (t.startsWith('## ')) return { kind: 'text', raw: t.slice(3), tk: 'h', line: no };
      if (t.startsWith('> ')) return { kind: 'text', raw: t.slice(2), tk: 'quote', line: no };
      if (/^[-=~<]>|^<~/.test(t) || /^\$/.test(t)) { err(no, `could not read line "${t}"`); return null; }
      return { kind: 'text', raw: t, tk: 'p', line: no };
    }

    // "-> arrival [origin]" goes to "arrival_briton" for a Briton if that scene exists, else "arrival".
    function jump(kind, target, no) {
      if (target.startsWith(':')) return { kind, target, line: no };
      const vm = JUMP_RE.exec(target);
      if (vm) return { kind, target: vm[1], by: vm[2], line: no };
      if (/\[/.test(target)) { err(no, `bad variant jump "${target}" (use [${VARIANT_GROUPS.join('], [')}])`); return null; }
      return { kind, target, line: no };
    }

    function parseCommand(body, no) {
      let m;
      if ((m = /^(flag|unflag)\s+(.+)$/.exec(body))) {
        const names = m[2].split(/[\s,]+/).filter(Boolean);
        for (const n of names) if (badVarName(n)) err(no, `bad flag name "${n}"`);
        return { kind: 'flag', names, value: m[1] === 'flag', line: no };
      }
      if ((m = /^do\s+(.+)$/.exec(body))) {
        const ast = expr(m[1], no, { anyCall: true });
        if (!ast) return null;
        if (ast.t !== 'call') { err(no, '"$ do" needs a call like: $ do name(arg, arg)'); return null; }
        return { kind: 'do', name: ast.name, args: ast.args, line: no };
      }
      if ((m = /^([A-Za-z_][A-Za-z0-9_.]*)\s*(=|\+=|-=|\*=|\/=)\s*(.+)$/.exec(body))) {
        if (badVarName(m[1])) { err(no, `bad variable name "${m[1]}"`); return null; }
        const ast = expr(m[3], no);
        if (!ast) return null;
        return { kind: 'set', name: m[1], how: m[2], ast, src: m[3], line: no };
      }
      err(no, `could not read command "$ ${body}"`);
      return null;
    }

    const tree = parseBlock(0, null);
    if (i < lines.length) err(lines[i].no, 'unexpected indentation');
    return tree;
  }

  // ---- Compile a tree to flat ops ---------------------------------------------
  function compileScene(block, tree) {
    const ops = [];
    const labels = {};
    const labelJumps = [];
    let pendingAnchor = null;
    const emit = (op, line) => {
      op.line = line;
      if (pendingAnchor) { op.anchor = pendingAnchor; pendingAnchor = null; }
      ops.push(op);
      return ops.length - 1;
    };
    // True if the code emitted since `from` ends in something that never falls through.
    // Forward "end jumps" (skipping the rest of an if or choice set) do not count.
    const terminatedSince = (from) =>
      ops.length > from && TERMINATORS.has(ops[ops.length - 1].op) && !ops[ops.length - 1].endJump;
    const endJump = (line) => emit({ op: 'jmp', to: -1, endJump: true }, line);

    function compileNodes(nodes) {
      for (const n of nodes) {
        switch (n.kind) {
          case 'text': {
            const { text, parts } = compileText(n.raw, n.line);
            emit({ op: 'text', tk: n.tk, text, parts, raw: n.raw }, n.line);
            break;
          }
          case 'page': emit({ op: 'page' }, n.line); break;
          case 'label':
            if (n.name in labels) err(n.line, `duplicate label ":${n.name}"`);
            labels[n.name] = ops.length;
            pendingAnchor = n.name;
            break;
          case 'set': emit({ op: 'set', name: n.name, how: n.how, ast: n.ast, src: n.src }, n.line); break;
          case 'flag': emit({ op: 'flag', names: n.names, value: n.value }, n.line); break;
          case 'do': emit({ op: 'do', name: n.name, args: n.args }, n.line); break;
          case 'ret': emit({ op: 'ret' }, n.line); break;
          case 'goto':
            if (n.target.startsWith(':')) {
              const at = emit({ op: 'jmp', to: -1, label: n.target.slice(1) }, n.line);
              labelJumps.push({ at, label: n.target.slice(1), line: n.line });
            } else emit({ op: 'goto', scene: n.target, ...(n.by ? { by: n.by } : {}) }, n.line);
            break;
          case 'call':
            if (n.target.startsWith(':')) { err(n.line, '"~>" needs a scene name, not a label'); break; }
            emit({ op: 'call', scene: n.target, ...(n.by ? { by: n.by } : {}) }, n.line);
            break;
          case 'chapter_end': emit({ op: 'chapter_end', target: n.target }, n.line); break;
          case 'if': {
            const endJumps = [];
            n.branches.forEach((br, idx) => {
              const jf = emit({ op: 'jf', ast: br.cond, to: -1 }, br.line);
              const bodyStart = ops.length;
              compileNodes(br.body);
              const isLast = idx === n.branches.length - 1 && !n.elseBody;
              if (!isLast && !terminatedSince(bodyStart)) endJumps.push(endJump(br.line));
              ops[jf].to = ops.length;
            });
            if (n.elseBody) compileNodes(n.elseBody);
            for (const j of endJumps) ops[j].to = ops.length;
            break;
          }
          case 'choices': {
            const at = emit({ op: 'choices', options: [], end: -1 }, n.line);
            const endJumps = [];
            n.options.forEach((opt, idx) => {
              const { text, parts } = compileText(opt.head, opt.line);
              const entry = {
                text, parts, raw: opt.head, cond: opt.cond, once: opt.once, to: ops.length,
                key: fnv1a(`${chapter.id}|${block.name}|${opt.head}`),
              };
              ops[at].options.push(entry);
              const bodyStart = ops.length;
              compileNodes(opt.body);
              if (idx < n.options.length - 1 && !terminatedSince(bodyStart)) endJumps.push(endJump(opt.line));
            });
            ops[at].end = ops.length;
            for (const j of endJumps) ops[j].to = ops.length;
            break;
          }
        }
      }
    }

    compileNodes(tree);
    if (pendingAnchor) emit({ op: 'nop' }, block.line);
    for (const lj of labelJumps) {
      if (!(lj.label in labels)) err(lj.line, `label ":${lj.label}" not found in scene "${block.name}"`);
      else ops[lj.at].to = labels[lj.label];
    }

    // Fingerprints let a save find its place again after a chapter is edited.
    ops.forEach((op, pc) => {
      let basis = `${op.op}|${op.raw ?? op.src ?? op.scene ?? op.target ?? op.name ?? op.names?.join(',') ?? ''}`;
      if (op.op === 'choices') {
        // The option texts identify a choice point well, and survive edits around it.
        basis += `|${op.options.map((o) => o.raw).join('/')}`;
      } else if (WAIT_OPS.has(op.op)) {
        // A page break is identified by the last two lines of text shown before it.
        const before = [];
        for (let k = pc - 1; k >= 0 && before.length < 2 && !WAIT_OPS.has(ops[k].op); k--) {
          if (ops[k].op === 'text') before.unshift(ops[k].raw);
        }
        basis += `|${before.join('/')}`;
      }
      op.fp = fnv1a(basis);
    });

    return { name: block.name, line: block.line, ops, labels };
  }

  for (const block of blocks) {
    const tree = parseScene(block);
    chapter.scenes[block.name] = compileScene(block, tree);
  }

  return { chapter: errors.length ? null : chapter, errors, warnings };
}

/** Parse or throw the first error. Convenient for tests and tools. */
export function parseChapterOrThrow(source, opts) {
  const { chapter, errors } = parseChapter(source, opts);
  if (errors.length) throw errors[0];
  return chapter;
}
