// Reading settings: applying them to the page and the Settings tab of the menu.

import { h } from './dom.js';
import { SETTING_DEFS } from '../engine/settings.js';

const THEME_COLOR = { night: '#0d0b0b', dusk: '#1d1a19', parchment: '#efe4cb' };

/** Put the saved settings on the page (theme, text size, story font). */
export function applySettings(game) {
  const s = game.settings;
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.size = s.textSize;
  root.dataset.font = s.font;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[s.theme] ?? THEME_COLOR.night);
}

/** The Settings tab. `onChange` runs after a setting changes so the menu can redraw. */
export function settingsPanel(game, onChange) {
  const s = game.settings;
  const change = (key, value) => { game.setSetting(key, value); applySettings(game); onChange(); };
  const rows = [];
  for (const [key, def] of Object.entries(SETTING_DEFS)) {
    if (def.hidden) continue;
    const id = `set-${key}`;
    const group = def.kind === 'bool'
      ? h('div', { class: 'seg', role: 'group', 'aria-labelledby': id },
        h('button', { type: 'button', 'aria-pressed': String(s[key] === true), onclick: () => change(key, true) }, 'On'),
        h('button', { type: 'button', 'aria-pressed': String(s[key] === false), onclick: () => change(key, false) }, 'Off'))
      : h('div', { class: 'seg', role: 'group', 'aria-labelledby': id },
        ...def.values.map((v) => h('button', { type: 'button', 'aria-pressed': String(s[key] === v.id), onclick: () => change(key, v.id) }, v.label)));
    rows.push(h('div', { class: 'setting' }, h('span', { class: 'name', id }, def.label), group, def.help ? h('span', { class: 'help' }, def.help) : null));
  }
  return [
    h('h2', {}, 'Reading'),
    h('div', { class: 'preview' }, h('p', {}, 'The road climbs out of the sleeping city in the last of the dark, and the lamps below are still lit.')),
    ...rows,
  ];
}
