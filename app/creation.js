// Character creation screen (session 5): who you are, your name, your life before, your face,
// and a last look before the story begins. Draws engine/creation.js data; owns no game rules.
// The finished hero is { gender, name, origin, role, path, look } and goes to game.startBook.

import { h } from './dom.js';

const STEPS = ['Who you are', 'Your name', 'Your life', 'Your face', 'Begin'];

/**
 * Show the creation screen in `app`. `onBegin(hero)` starts the story; `onCancel()` goes back.
 * `game` supplies the options (creationOptions, suggestHero, lookChoices, describeLook).
 */
export function creationScreen({ game, app, book, onBegin, onCancel }) {
  const opts = game.creationOptions();
  const byId = (list, id) => list.find((x) => x.id === id);
  let draft = game.suggestHero({ gender: 'm', origin: opts.origins[0].id });
  let step = 0;
  let nameTouched = false;
  let lookTouched = false;
  let lifeTouched = false;

  /** Re-fit the draft after a change: role and path that suit the origin, the look kept or re-suggested. */
  function refit(change) {
    const next = { ...draft, ...change };
    if (change.role || change.path) lifeTouched = true;
    if (change.origin && !lifeTouched) { next.role = undefined; next.path = undefined; }
    if (!lookTouched && (change.origin || change.role)) next.look = undefined;
    if (!nameTouched && (change.origin || change.gender)) next.name = '';
    draft = game.suggestHero(next);
    render();
  }

  const chips = (label, items, selected, pick) => h('div', { class: 'chips', role: 'group', 'aria-label': label },
    ...items.map((it) => h('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': String(it.id === selected),
      onclick: () => pick(it.id),
    }, it.label)));

  const blurb = (text) => (text ? h('p', { class: 'blurb' }, text) : null);

  // ---- steps ----------------------------------------------------------------------------------

  function stepWho() {
    const origin = byId(opts.origins, draft.origin);
    return [
      h('p', { class: 'info' }, 'Who walks into this story? Your homeland shapes how you see Rome, and how Rome sees you.'),
      h('h3', {}, 'You are'),
      chips('Gender', opts.genders, draft.gender, (id) => refit({ gender: id })),
      h('h3', {}, 'Your homeland'),
      chips('Homeland', opts.origins.map((o) => ({ id: o.id, label: o.label })), draft.origin, (id) => refit({ origin: id })),
      blurb(origin?.blurb),
    ];
  }

  function stepName() {
    const origin = byId(opts.origins, draft.origin);
    const names = origin?.names[draft.gender === 'f' ? 'f' : 'm'] ?? [];
    const input = h('input', {
      type: 'text', maxlength: '40', autocomplete: 'off', 'aria-label': 'Your name', value: draft.name,
      oninput: (e) => { draft.name = e.target.value; nameTouched = true; },
    });
    return [
      h('p', { class: 'info' }, 'Choose a name from your homeland, or write your own. Those closest to you will always know it.'),
      h('label', { class: 'field' }, 'Name', input),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Suggested names' },
        ...names.map((n) => h('button', { type: 'button', class: 'chip', onclick: () => { draft.name = n; nameTouched = true; render(); } }, n))),
    ];
  }

  function stepLife() {
    const origin = byId(opts.origins, draft.origin);
    const roles = origin.roles.map((id) => byId(opts.roles, id));
    const paths = game.compatiblePaths(draft.origin, draft.role).map((id) => byId(opts.paths, id));
    return [
      h('p', { class: 'info' }, 'What you were before you settled in the hill village of Collesanto, and how you came to the empire.'),
      h('h3', {}, 'What you were'),
      chips('Mortal role', roles, draft.role, (id) => refit({ role: id })),
      blurb(byId(opts.roles, draft.role)?.blurb),
      h('h3', {}, 'How you came to Rome'),
      chips('How you came to Rome', paths, draft.path, (id) => refit({ path: id })),
      blurb(byId(opts.paths, draft.path)?.blurb),
    ];
  }

  function stepFace() {
    const choices = game.lookChoices(draft.origin);
    const rows = opts.looks.fields.map((f) => {
      const labels = Object.fromEntries(f.options.map((o) => [o.id, o.label]));
      const sel = h('select', {
        'aria-label': f.label,
        onchange: (e) => { draft.look = { ...draft.look, [f.id]: e.target.value }; lookTouched = true; render(); },
      }, ...choices[f.id].map((id) => h('option', { value: id, selected: id === draft.look[f.id] }, labels[id])));
      return h('label', { class: 'field' }, f.label, sel);
    });
    return [
      h('p', { class: 'info' }, 'Your appearance is fixed forever once you are turned. The story will remember it.'),
      h('div', { class: 'look-grid' }, ...rows),
      h('button', {
        type: 'button', class: 'small',
        onclick: () => { draft.look = game.suggestHero({ ...draft, look: undefined }, Math.random).look; lookTouched = true; render(); },
      }, 'Suggest a look'),
      h('p', { class: 'portrait' }, game.describeLook(draft.look)),
    ];
  }

  function stepBegin() {
    const origin = byId(opts.origins, draft.origin);
    return [
      h('h3', {}, draft.name || 'You'),
      h('p', { class: 'info' }, draft.gender === 'f' ? 'A woman' : 'A man'),
      h('p', {}, h('span', { class: 'label' }, 'Homeland: '), origin.label),
      h('p', {}, h('span', { class: 'label' }, 'Before: '), byId(opts.roles, draft.role).label),
      h('p', {}, h('span', { class: 'label' }, 'Came to Rome: '), byId(opts.paths, draft.path).label),
      h('p', { class: 'portrait' }, game.describeLook(draft.look)),
    ];
  }

  const bodies = [stepWho, stepName, stepLife, stepFace, stepBegin];

  // ---- frame ----------------------------------------------------------------------------------

  function render() {
    if (step === 1 && !draft.name) draft.name = game.suggestHero({ ...draft, name: '' }).name;
    const last = step === STEPS.length - 1;
    const dots = h('ol', { class: 'steps', 'aria-label': 'Progress' },
      ...STEPS.map((label, i) => h('li', { class: i === step ? 'on' : i < step ? 'done' : '', 'aria-current': i === step ? 'step' : false }, label)));
    const actions = h('div', { class: 'actions' },
      last
        ? h('button', { class: 'primary', onclick: () => onBegin({ ...draft, name: draft.name.trim() || game.suggestHero(draft).name }) }, 'Begin the story')
        : h('button', { class: 'primary', onclick: () => { step++; render(); } }, 'Continue'),
      h('button', { onclick: () => { if (step === 0) onCancel(); else { step--; render(); } } }, step === 0 ? 'Back to the book' : 'Back'));
    app.replaceChildren(
      h('main', { id: 'story', class: 'creation' },
        h('p', { class: 'kicker' }, book?.title ?? ''),
        h('h1', {}, 'Create your hero'),
        dots,
        h('h2', { class: 'story-h' }, STEPS[step]),
        ...bodies[step]().filter(Boolean)),
      actions);
    window.scrollTo(0, 0);
  }

  render();
}
