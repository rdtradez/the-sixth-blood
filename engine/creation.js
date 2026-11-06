// Character creation (session 5): the data the creation screen needs, and the rules for which
// mortal roles and arrival paths fit together. Pure functions over the normalized content.
//
// content/origins.json lists origins, roles and paths. Each role may list the `paths` that fit it
// and each path may list origins it is `notFor`. Scripts accept any combination (heroVars never
// refuses one); the creation screen only offers combinations that make sense.

import { LOOK_FIELDS, EMPTY_LOOKS, optionIds, seededRandom, suggestLook, normalizeLook } from './looks.js';

export { LOOK_FIELDS };

/** Arrival paths that fit an origin and a mortal role, best suggestion first. */
export function compatiblePaths(origins, originId, roleId) {
  const origin = origins.origin.find((o) => o.id === originId);
  const role = origins.role.find((r) => r.id === roleId);
  const fits = origins.path.filter((p) => !(p.notFor ?? []).includes(originId) && (!role?.paths || role.paths.includes(p.id)));
  const first = (origin?.paths ?? []).filter((id) => fits.some((p) => p.id === id));
  return [...first, ...fits.map((p) => p.id).filter((id) => !first.includes(id))];
}

/** Mortal roles that fit an origin, best suggestion first. */
export function rolesFor(origins, originId) {
  const origin = origins.origin.find((o) => o.id === originId);
  const fits = origins.role.filter((r) => !(r.notFor ?? []).includes(originId)).map((r) => r.id);
  const first = (origin?.roles ?? []).filter((id) => fits.includes(id));
  return [...first, ...fits.filter((id) => !first.includes(id))];
}

/**
 * Make creation choices consistent: a role and path that suit the origin (the suggestion when
 * the choice does not fit), and a complete look. Returns { gender, name, origin, role, path, look }.
 */
export function fitHero(content, hero = {}, random = null) {
  const { origins } = content;
  const originId = origins.origin.find((o) => o.id === hero.origin)?.id ?? origins.origin[0]?.id ?? '';
  const roles = rolesFor(origins, originId);
  const role = roles.includes(hero.role) ? hero.role : roles[0] ?? '';
  const paths = compatiblePaths(origins, originId, role);
  const path = paths.includes(hero.path) ? hero.path : paths[0] ?? '';
  const looks = content.systems?.looks ?? EMPTY_LOOKS;
  const base = { origin: originId, role, path };
  const look = hero.look ? normalizeLook(looks, base, hero.look) : suggestLook(looks, base, random);
  return { gender: ['m', 'f', 'x'].includes(hero.gender) ? hero.gender : 'm', name: (hero.name ?? '').trim(), ...base, look };
}

/** Everything the creation screen draws, as plain data. */
export function creationOptions(content) {
  const { origins } = content;
  const looks = content.systems?.looks ?? EMPTY_LOOKS;
  return {
    genders: [{ id: 'm', label: 'A man' }, { id: 'f', label: 'A woman' }],
    origins: origins.origin.map((o) => ({
      id: o.id,
      label: o.label,
      blurb: o.blurb ?? '',
      names: { m: o.names?.m ?? [], f: o.names?.f ?? [] },
      roles: rolesFor(origins, o.id),
    })),
    roles: origins.role.map((r) => ({ id: r.id, label: r.label, blurb: r.blurb ?? '' })),
    paths: origins.path.map((p) => ({ id: p.id, label: p.label, blurb: p.blurb ?? '' })),
    looks: {
      order: looks.order,
      fields: looks.order.map((id) => ({ id, label: looks.fields[id].label, options: looks.fields[id].options.map((o) => ({ id: o.id, label: o.label })) })),
    },
  };
}

/** The look options offered for each field to an origin (skin tones depend on it). */
export function lookChoices(content, originId) {
  const looks = content.systems?.looks ?? EMPTY_LOOKS;
  return Object.fromEntries(looks.order.map((f) => [f, optionIds(looks, f, originId)]));
}

export { seededRandom };
