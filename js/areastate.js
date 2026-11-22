// Området brukeren leter i, og hvordan det sendes til Finn. Ren logikk uten DOM.
//
// To måter å velge på:
//  - state.area: ett fylke (Finn-kode som «0.20061»), eller '' for hele Norge. Slik var det fra starten.
//  - state.near: et punkt med radius valgt på kartet: { lat, lon, km, name, fylker, geo }.
//    fylker = Finn-kodene for fylkene sirkelen dekker. De er sjekket mot finn.no og avgrenser alltid søket.
//    geo = om sirkelen også sendes med (lat, lon, radius i meter). Det er IKKE bekreftet at Finn bruker disse
//    feltene i Torget-søk. Bruker Finn dem, blir treffene snevret inn til sirkelen. Hvis ikke, gjelder fylkene.
import { AREAS } from './data.js';
import { RADII } from './geo.js';

export function cleanNear(n) {
  if (!n || typeof n !== 'object') return null;
  const ok = Number.isFinite(n.lat) && n.lat >= 57 && n.lat <= 72 && Number.isFinite(n.lon) && n.lon >= 3 && n.lon <= 33 && RADII.includes(n.km);
  const fylker = (Array.isArray(n.fylker) ? n.fylker : []).filter((c) => c && AREAS.some((a) => a.id === c));
  if (!ok || !fylker.length) return null;
  return {
    lat: +n.lat.toFixed(4), lon: +n.lon.toFixed(4), km: n.km,
    name: typeof n.name === 'string' && n.name.trim() ? n.name.trim().slice(0, 60) : 'valgt punkt',
    fylker: [...new Set(fylker)].slice(0, 8), geo: n.geo !== false,
  };
}

// Feltene som legges på alle Finn-lenker: [[navn, verdi], ...].
export function areaParams(state) {
  const n = state.near;
  if (n) {
    const out = n.fylker.map((c) => ['location', c]);
    if (n.geo !== false) out.push(['lat', String(n.lat)], ['lon', String(n.lon)], ['radius', String(n.km * 1000)]);
    return out;
  }
  return state.area ? [['location', state.area]] : [];
}

const fylkeName = (code) => AREAS.find((a) => a.id === code)?.name || '';
const list = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} og ${names[names.length - 1]}`);

// «Innen 15 km fra Ski», «Oslo» eller «Hele Norge».
export function areaLabel(state) {
  if (state.near) return `Innen ${state.near.km} km fra ${state.near.name}`;
  return fylkeName(state.area) || 'Hele Norge';
}
// Passer etter «Søker etter «sofa» …»: «innen 15 km fra Ski», «i Oslo» eller «i hele Norge».
// Sendes ikke sirkelen med, er det fylkene som gjelder, og da sier teksten det.
export function areaPhrase(state) {
  const n = state.near;
  if (n) return n.geo !== false ? `innen ${n.km} km fra ${n.name}` : `i ${nearFylker(state)}`;
  return state.area && fylkeName(state.area) ? `i ${fylkeName(state.area)}` : 'i hele Norge';
}
export const nearFylker = (state) => (state.near ? list(state.near.fylker.map(fylkeName).filter(Boolean)) : '');
