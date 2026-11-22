// Bygger kartdataene i geo/. Kjøres for hånd når grenser eller stedsnavn skal oppdateres.
//
// Kilder (begge © Kartverket, CC BY 4.0):
//  1. Kommunegrenser: Kommuner-M.geojson fra https://github.com/robhop/fylker-og-kommuner (bygd på Kartverkets data, 2024),
//     forenklet med mapshaper til TopoJSON:
//       npx mapshaper Kommuner-M.geojson name=kommuner -filter-islands min-area=1km2 \
//         -simplify visvalingam weighted 14% keep-shapes \
//         -each 'f=kommunenummer.slice(0,2), n=name, k=kommunenummer, delete id, delete name, delete kommunenavn, delete kommunenummer' \
//         -dissolve f + name=fylker -o target=* format=topojson quantization=40000 norge.topojson
//  2. Stedsnavn: Sentralt stedsnavnregister via https://ws.geonorge.no/stedsnavn/v1/sted, typene by, tettsted, bydel,
//     tettsteddel, tettbebyggelse, administrativBydel og bygdelagBygd (lagret som steder-raw.json med feltene n, t, lat, lon, k, f).
//
// Bruk: node tools/build-geodata.mjs <mappe med norge.topojson og steder-raw.json>
import fs from 'node:fs';
import path from 'node:path';
import { decodeTopo, centroid } from '../js/geo.js';

const src = process.argv[2];
if (!src) { console.error('Oppgi mappa med norge.topojson og steder-raw.json'); process.exit(1); }
const out = new URL('../geo/', import.meta.url).pathname;

const topo = JSON.parse(fs.readFileSync(path.join(src, 'norge.topojson'), 'utf8'));
// Skrives som JS-moduler, så de lastes med import() på samme måte som resten av appen (ingen fetch).
const mod = (v) => `export default ${JSON.stringify(v)};\n`;
fs.writeFileSync(path.join(out, 'norge.js'), mod(topo));

// Steder: [navn, breddegrad, lengdegrad, type, kommune, fylkesnummer]. Lavere type = viktigere.
const RANK = { by: 0, tettsted: 2, administrativBydel: 3, bydel: 4, tettsteddel: 5, tettbebyggelse: 5, bygdelagBygd: 6 };
const raw = JSON.parse(fs.readFileSync(path.join(src, 'steder-raw.json'), 'utf8'));
const no = (name) => String(name).split(' - ')[0]; // «Storfjord - Omasvuotna - Omasvuono» → «Storfjord»
const best = new Map();
for (const p of raw) {
  if (p.lat > 71.5 || p.lat < 57.5 || !p.n || !/^[0-9]{2}$/.test(p.f)) continue; // fastlandet
  const row = [no(p.n), p.lat, p.lon, RANK[p.t], no(p.k), p.f];
  const key = `${row[0]}|${row[4]}`;
  if (!best.has(key) || best.get(key)[3] > row[3]) best.set(key, row);
}
// Kommunene selv som søkbare steder (type 1), plassert midt i største flate.
const { kommuner } = decodeTopo(topo);
for (const k of kommuner) {
  const big = k.rings.reduce((a, r) => (r.length > a.length ? r : a), k.rings[0]);
  const [lon, lat] = centroid(big);
  const n = no(k.n), key = `${n}|${n}`;
  if (!best.has(key)) best.set(key, [n, +lat.toFixed(4), +lon.toFixed(4), 1, n, k.f]);
}
const places = [...best.values()].sort((a, b) => a[3] - b[3] || a[0].localeCompare(b[0], 'nb'));
fs.writeFileSync(path.join(out, 'steder.js'), mod(places));
console.log('kommuner', kommuner.length, 'steder', places.length);
