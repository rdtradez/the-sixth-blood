// The menu's information tabs: You, People, Family, Codex and Achievements. Each returns a list of
// elements built from the data the engine provides (engine/screens.js); nothing here changes the game.

import { h } from './dom.js';

const empty = (text) => h('p', { class: 'empty' }, text);

export function youPanel(game) {
  const lines = game.status();
  const hero = game.state?.vars?.['hero.name'];
  const book = game.manifest.books.find((b) => b.id === game.state?.book);
  const look = game.describeLook(game.heroLook());
  if (!lines.length) return [empty('Begin a story to see how you are.')];
  return [
    h('h2', {}, hero ? `How ${hero} is` : 'How you are'),
    book ? h('p', { class: 'count' }, `${book.title}${book.city ? `, ${book.city}` : ''}`) : null,
    look ? h('p', { class: 'portrait' }, look) : null,
    h('div', { class: 'status' }, ...lines.map((l) => h('p', {}, h('span', { class: 'label' }, l.label), l.text))),
  ];
}

export function peoplePanel(game) {
  const people = game.people();
  if (!people.length) return [h('h2', {}, 'People'), empty('No one yet. People you meet are listed here, with where things stand between you.')];
  const sorted = [...people.filter((p) => !p.gone), ...people.filter((p) => p.gone)];
  return [
    h('h2', {}, 'People'),
    ...sorted.map((p) => h('div', { class: `person${p.gone ? ' gone' : ''}` },
      h('div', { class: 'who' }, h('span', { class: 'pname' }, p.name), p.title ? h('span', { class: 'ptitle' }, p.title) : null),
      h('div', { class: 'notes' }, [...p.status, p.metIn ? `Met in ${p.metIn}` : ''].filter(Boolean).join(' · ')),
      p.bio ? h('p', { class: 'bio' }, p.bio) : null)),
  ];
}

function member(n) {
  const cls = `member${n.you ? ' you' : ''}${n.status === 'dead' ? ' dead' : ''}${n.status === 'unknown' ? ' unknown' : ''}`;
  return h('div', { class: cls },
    h('span', { class: 'mname' }, [n.name, n.surname && !n.you ? n.surname : ''].filter(Boolean).join(' ')),
    n.label ? h('span', { class: 'mlabel' }, n.label) : null,
    n.bookTitle ? h('span', { class: 'mbook' }, n.bookTitle) : null);
}

function treeItem(n) {
  const couple = h('div', { class: 'couple' }, member(n), n.partner ? [h('span', { class: 'join', 'aria-hidden': 'true' }, '◆'), member(n.partner)] : null);
  return h('li', {}, couple, n.children.length ? h('ul', {}, ...n.children.map(treeItem)) : null);
}

export function familyPanel(game) {
  const tree = game.family();
  if (!tree.length) return [h('h2', {}, 'The Valerius family'), empty('Your family line is drawn here as you learn of them.')];
  return [h('h2', {}, 'The Valerius family'), h('div', { class: 'family' }, h('ul', {}, ...tree.map(treeItem)))];
}

export function mapPanel(game) {
  const maps = game.maps();
  if (!maps.length) return [h('h2', {}, 'Map'), empty('Begin a story to see its city.')];
  const visible = maps.flatMap((m) => m.sites);
  const fire = maps.some((m) => m.fire.some((s) => visible.includes(s)));
  const frame = h('iframe', { class: 'citymap', src: 'app/maps/city.html?embed=1', title: `Map of ${maps.map((m) => m.title).join(' and ')}` });
  const send = () => frame.contentWindow?.postMessage({ type: 'map', visible, fire }, '*');
  frame.addEventListener('load', send);
  const onReady = (e) => { if (!frame.isConnected && e.source !== frame.contentWindow) { window.removeEventListener('message', onReady); return; } if (e.source === frame.contentWindow && e.data?.type === 'map-ready') send(); };
  window.addEventListener('message', onReady);
  return [h('h2', {}, 'Map'), frame];
}

export function codexPanel(game) {
  const view = game.codex();
  if (!view.groups.length) return [h('h2', {}, 'Codex'), empty('Nothing discovered yet. Lore you uncover is kept here.')];
  const out = [h('h2', {}, 'Codex'), h('p', { class: 'count' }, `${view.unlocked} discovered`)];
  const root = h('div', { class: 'codex' });
  for (const g of view.groups) {
    root.append(h('h3', {}, g.label));
    for (const e of g.entries) {
      if (e.locked) { root.append(h('div', { class: 'entry locked' }, 'Undiscovered')); continue; }
      root.append(h('details', { class: 'entry' },
        h('summary', {}, h('span', {}, e.title)),
        h('div', { class: 'body' }, e.bookTitle ? h('p', { class: 'src' }, e.bookTitle) : null, ...e.text.map((t) => h('p', {}, t)))));
    }
  }
  out.push(root);
  return out;
}

export function achievementsPanel(game) {
  const list = game.achievements();
  if (!list.length) return [h('h2', {}, 'Achievements'), empty('No achievements are defined yet.')];
  const earned = list.filter((a) => a.earned).length;
  return [
    h('h2', {}, 'Achievements'),
    h('p', { class: 'count' }, `${earned} of ${list.length} earned`),
    ...list.map((a) => h('div', { class: `ach${a.earned ? '' : ' locked'}` },
      h('div', { class: 'atitle' }, a.earned || !a.secret ? a.title : 'Hidden'),
      h('p', { class: 'atext' }, a.earned || !a.secret ? a.text : 'Keep playing to find out.'),
      a.earned ? h('span', { class: 'earned' }, `Earned ${new Date(a.at).toLocaleDateString()}`) : null)),
  ];
}
