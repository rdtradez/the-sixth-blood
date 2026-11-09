// The city maps (session 6). The drawings live in app/maps/<id>.html; this file is the list of
// places each map can show, so scripts can chart them and the checker can reject misspellings.
// `start` sites are on the map from the first page. Others appear once a chapter runs
// `$ do chart("rome.warehouse")`. `fire` sites only show once the city has burned.

export const MAPS = {
  rome: {
    book: 'burning-city',
    page: 'city',
    title: 'Rome',
    start: ['roadhome'],
    fire: ['burnland'],
    sites: ['warehouse', 'counting', 'insulae', 'burnland', 'prisca', 'cityhaven', 'lictor', 'vigiles', 'senate', 'roadhome'],
  },
  collesanto: {
    book: 'burning-city',
    page: 'city',
    title: 'Collesanto',
    start: ['farm', 'square', 'villa', 'road'],
    fire: [],
    sites: ['farm', 'square', 'villa', 'press', 'mill', 'crypt', 'road'],
  },
  florence: {
    book: 'blood-and-gold',
    page: 'florence',
    title: 'Florence',
    start: ['roadhome'],
    fire: [],
    sites: ['bank', 'prisca', 'wool', 'bottega', 'haven', 'court', 'rooms', 'roadhome'],
  },
  collesanto2: {
    book: 'blood-and-gold',
    page: 'florence',
    title: 'Collesanto',
    start: ['farm', 'square', 'villa', 'road'],
    fire: [],
    sites: ['farm', 'square', 'villa', 'press', 'gate', 'crypt', 'road'],
  },
};

/** "rome.warehouse" -> true when it is a real site of a real map. */
export function siteKnown(ref) {
  const [map, site] = String(ref).split('.');
  return Boolean(MAPS[map]?.sites.includes(site));
}

/** What a map shows for a state: the ids of the visible sites. */
export function mapView(state, mapId) {
  const def = MAPS[mapId];
  if (!def) return null;
  const charted = state?.sys?.lore?.sites ?? {};
  const sites = def.sites.filter((s) => def.start.includes(s) || Object.hasOwn(charted, `${mapId}.${s}`));
  return { id: mapId, title: def.title, book: def.book, page: def.page, sites, fire: def.fire };
}

/** The maps for the book the hero is in (or every map that has a charted site, for any book). */
export function mapsFor(state, content) {
  const book = state?.book;
  return Object.keys(MAPS).filter((id) => MAPS[id].book === book).map((id) => mapView(state, id));
}
