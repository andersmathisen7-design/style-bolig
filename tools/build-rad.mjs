// Lager js/nytt.js og js/triks.js av kildefilene i tools/kilder/. Kjøres for hånd når rådene skal oppdateres.
//
// Kilder:
//  - nytt.json: per ting en dom (brukt, begge eller nytt), en begrunnelse og nye produkter med pris, butikk og
//    hvilke stiler de passer. Per stil hva som bør være brukt, hva som er greit nytt og hva man bør unngå.
//    Prisene er lest av butikkenes egne sider på datoen i «asOf».
//  - triks.json: triks og gjør-det-selv-ideer per stil, med kilde.
//
// Bruk: node tools/build-rad.mjs [mappe med nytt.json og triks.json]
import fs from 'node:fs';
import path from 'node:path';
import { ITEMS, STYLES, ROOMS } from '../js/data.js';

const src = process.argv[2] || new URL('./kilder/', import.meta.url).pathname;
const out = new URL('../js/', import.meta.url).pathname;
const read = (f) => JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
const mod = (v) => `export default ${JSON.stringify(v)};\n`; // JS-modul, så den lastes med import() som resten av appen

const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };
const styleIds = STYLES.map((s) => s.id);
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const web = (v) => typeof v === 'string' && /^https:\/\/[a-z0-9.-]+\//.test(v);
const date = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

// ---------- Nytt eller brukt ----------
const nytt = read('nytt.json');
need(date(nytt.asOf), 'nytt: asOf mangler');
const items = {};
for (const [id, it] of Object.entries(nytt.items)) {
  need(ITEMS[id], `nytt: ukjent ting ${id}`);
  need(['brukt', 'begge', 'nytt'].includes(it.verdict), `nytt: ${id} har ukjent dom`);
  need(str(it.why), `nytt: ${id} mangler begrunnelse`);
  items[id] = {
    verdict: it.verdict, why: it.why.trim(),
    new: (it.new || []).map((p) => {
      need(str(p.store) && str(p.name) && web(p.url), `nytt: ${id} har et produkt uten butikk, navn eller lenke`);
      need(Number.isFinite(p.price) && p.price > 0, `nytt: ${id} / ${p.name} mangler pris`);
      need(Array.isArray(p.fits) && p.fits.length && p.fits.every((s) => styleIds.includes(s)), `nytt: ${id} / ${p.name} har ukjent stil`);
      // «unsure» settes bare når prisen ikke er sett på butikkens egen side.
      return { store: p.store, name: p.name.trim(), price: Math.round(p.price), url: p.url, fits: p.fits, ...(str(p.note) ? { note: p.note.trim() } : {}), ...(p.verified === true ? {} : { unsure: true }) };
    }),
  };
}
for (const id of Object.keys(ITEMS)) need(items[id], `nytt: mangler ting ${id}`);
const styles = {};
for (const [id, s] of Object.entries(nytt.styles)) {
  need(styleIds.includes(id), `nytt: ukjent stil ${id}`);
  need([0, 1, 2, 3].includes(s.newFit) && str(s.used) && str(s.new) && str(s.avoid) && Array.isArray(s.words), `nytt: stil ${id} er ufullstendig`);
  styles[id] = { newFit: s.newFit, used: s.used.trim(), new: s.new.trim(), avoid: s.avoid.trim(), words: s.words.filter(str).slice(0, 10) };
}
for (const id of styleIds) need(styles[id], `nytt: mangler stil ${id}`);

// ---------- Triks ----------
const triks = read('triks.json');
need(date(triks.asOf), 'triks: asOf mangler');
const seen = new Set();
const tricks = triks.tricks.map((t) => {
  need(/^[a-z0-9-]+$/.test(t.id) && !seen.has(t.id), `triks: ugyldig eller dobbel id ${t.id}`);
  seen.add(t.id);
  need(str(t.title) && str(t.what), `triks: ${t.id} mangler tekst`);
  need(t.styles.length && t.styles.every((s) => styleIds.includes(s)), `triks: ${t.id} har ukjent stil`);
  need(t.rooms.length && t.rooms.every((r) => ROOMS[r]), `triks: ${t.id} har ukjent rom`);
  need(Array.isArray(t.costNok) && t.costNok.length === 2 && t.costNok[0] <= t.costNok[1], `triks: ${t.id} mangler kostnad`);
  need(!t.source || web(t.source.url), `triks: ${t.id} har ugyldig kilde`);
  need(!t.diy || (['lett', 'middels', 'krevende'].includes(t.diy.level) && t.diy.steps.length && Array.isArray(t.diy.tools)), `triks: ${t.id} har ufullstendig oppskrift`);
  return {
    id: t.id, title: t.title.trim(), what: t.what.trim(), styles: t.styles, rooms: t.rooms, finn: (t.finn || []).filter(str),
    buy: (t.buy || []).map((b) => ({ what: b.what, where: b.where, ...(Number.isFinite(b.approxNok) ? { kr: b.approxNok } : {}) })),
    diy: t.diy ? { level: t.diy.level, time: t.diy.time, tools: t.diy.tools, steps: t.diy.steps } : null,
    renterOk: t.renterOk === true, cost: t.costNok,
    ...(t.source ? { source: { title: t.source.title, url: t.source.url } } : {}), ...(str(t.trend) ? { trend: t.trend.trim() } : {}),
  };
});
const starters = (triks.starters || []).filter((id) => seen.has(id));

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
fs.writeFileSync(path.join(out, 'nytt.js'), mod({ asOf: nytt.asOf, items, styles }));
fs.writeFileSync(path.join(out, 'triks.js'), mod({ asOf: triks.asOf, starters, tricks }));
const products = Object.values(items).reduce((n, it) => n + it.new.length, 0);
console.log(`nytt.js: ${Object.keys(items).length} ting, ${products} produkter, ${Object.keys(styles).length} stiler (${nytt.asOf})`);
console.log(`triks.js: ${tricks.length} triks, ${tricks.filter((t) => t.diy).length} med oppskrift (${triks.asOf})`);
