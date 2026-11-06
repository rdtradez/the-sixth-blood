// Small DOM helpers shared by the reader's modules.

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Turn *italic* and **bold** into elements. Everything else stays plain text (never HTML). */
export function inline(text) {
  const frag = document.createDocumentFragment();
  for (const part of text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)) {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) frag.append(h('strong', {}, part.slice(2, -2)));
    else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) frag.append(h('em', {}, part.slice(1, -1)));
    else frag.append(part);
  }
  return frag;
}

/** An element from trusted SVG markup (the app's own artwork only, never story text). */
export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

let toastTimer;
export function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `show${isError ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, isError ? 6000 : 3200);
}
