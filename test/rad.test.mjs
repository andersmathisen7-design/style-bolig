// Råd om nytt og brukt, nye produkter per stil, og triks med og uten gjør-det-selv.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, STYLES, ROOMS } from '../js/data.js';
import { newState, instances, normalize, encodeState, decodeState, wordUrl, kr } from '../js/logic.js';
import { VERDICTS, adviceId, verdictOf, newPicks, styleAdvice, tricksFor, dateText, costText } from '../js/rad.js';
import NYTT from '../js/nytt.js';
import TRIKS from '../js/triks.js';

const inst = (itemId, size = 'M') => {
  const item = ITEMS[itemId];
  const v = item.size ? item.size[size] || Object.values(item.size)[0] : { label: '', q: item.q, u: item.u, n: item.n }; // som i instances()
  return { itemId, item, size, v, st: 'need', saved: {} };
};
const withStyle = (style, patch = {}) => ({ ...newState(), style, ...patch });

test('dataene dekker alle ting og stiler, og lenkene er trygge', () => {
  assert.match(NYTT.asOf, /^\d{4}-\d{2}-\d{2}$/);
  for (const id of Object.keys(ITEMS)) {
    const it = NYTT.items[id];
    assert.ok(it, `mangler råd for ${id}`);
    assert.ok(VERDICTS[it.verdict], `ukjent dom for ${id}`);
    assert.ok(it.why.length > 10 && it.why.length < 200, `begrunnelsen for ${id} skal være én kort setning eller to`);
    for (const p of it.new) {
      assert.match(p.url, /^https:\/\/(www\.)?(ikea\.com|jysk\.no|rusta\.com)\//, `${id}: ${p.url}`);
      assert.ok(p.price > 0 && p.fits.every((s) => STYLES.some((x) => x.id === s)));
    }
  }
  for (const s of STYLES) assert.ok(NYTT.styles[s.id], `mangler stilråd for ${s.id}`);
  for (const t of TRIKS.tricks) {
    assert.ok(t.rooms.every((r) => ROOMS[r]) && t.styles.every((s) => STYLES.some((x) => x.id === s)), t.id);
    if (t.source) assert.match(t.source.url, /^https:\/\//);
  }
  assert.ok(TRIKS.starters.every((id) => TRIKS.tricks.some((t) => t.id === id)));
});

test('dom per ting', () => {
  assert.deepEqual(verdictOf(NYTT, inst('sofa')), { id: 'brukt', label: 'Kjøp brukt', why: NYTT.items.sofa.why });
  assert.equal(verdictOf(NYTT, inst('gardiner')).label, 'Kjøp nytt');
  assert.equal(verdictOf(NYTT, inst('teppe')).label, 'Brukt eller nytt');
  // egne ting og manglende data gir ingen dom
  assert.equal(verdictOf(NYTT, { itemId: 'c101', item: { custom: true, name: 'Piano' }, v: {}, size: 'M' }), null);
  assert.equal(verdictOf(null, inst('sofa')), null);
});

test('sofa som sovesofa følger rådene for sovesofa', () => {
  assert.equal(adviceId(inst('sofa', 'sove')), 'sovesofa');
  assert.equal(verdictOf(NYTT, inst('sofa', 'sove')).id, NYTT.items.sovesofa.verdict);
  const picks = newPicks(NYTT, inst('sofa', 'sove'), 'moderne');
  assert.ok(picks.list.length && picks.list.every((p) => /sovesofa/i.test(p.name)));
});

test('nye produkter velges etter stil, høyst tre, i kildens rekkefølge', () => {
  const sk = newPicks(NYTT, inst('sofa'), 'skandi');
  assert.ok(sk.list.length >= 1 && sk.list.length <= 3 && !sk.off);
  assert.ok(sk.list.every((p) => p.fits.includes('skandi')));
  const order = NYTT.items.sofa.new.filter((p) => p.fits.includes('skandi')).map((p) => p.name);
  assert.deepEqual(sk.list.map((p) => p.name), order.slice(0, 3));
  // landlig får EKTORP, ikke GLOSTAD
  const la = newPicks(NYTT, inst('sofa'), 'landlig').list.map((p) => p.name).join(' ');
  assert.match(la, /EKTORP/);
  assert.doesNotMatch(la, /GLOSTAD/);
  // uten valgt stil brukes «fri»
  assert.deepEqual(newPicks(NYTT, inst('sofa'), null).list, newPicks(NYTT, inst('sofa'), 'fri').list);
});

test('ingen produkter i stilen: tomt for brukt-ting, de enkleste for ting som bør kjøpes nye', () => {
  const sofa = newPicks(NYTT, inst('sofa'), 'vintage');
  assert.deepEqual(sofa, { list: [], off: false, special: false });
  const gard = newPicks(NYTT, inst('gardiner'), 'vintage');
  assert.equal(gard.off, true);
  assert.equal(gard.list.length, 2);
  assert.ok(gard.list[0].price <= gard.list[1].price);
  assert.ok(gard.list.every((p) => !p.fits.includes('vintage')));
});

test('egne varianter (hjørnesofa, køyeseng) får ikke eksempler som gjelder vanlig utgave', () => {
  assert.deepEqual(newPicks(NYTT, inst('sofa', 'L'), 'skandi'), { list: [], off: false, special: true });
  assert.equal(newPicks(NYTT, inst('seng', 'koye'), 'skandi').special, true);
  assert.equal(verdictOf(NYTT, inst('sofa', 'L')).id, 'brukt'); // dommen gjelder fortsatt
});

test('stilråd: brukt, nytt, unngå og hvor godt kjedene passer', () => {
  const a = styleAdvice(NYTT, 'vintage');
  assert.ok(a.used && a.new && a.avoid && a.words.length);
  assert.match(a.fit, /^Nesten ingenting nytt/);
  assert.match(styleAdvice(NYTT, 'skandi').fit, /passer stilen godt/);
  assert.equal(styleAdvice(NYTT, 'finnesikke'), null);
  assert.equal(styleAdvice(null, 'skandi'), null);
});

test('triks uten gjør-det-selv krever ikke verktøy', () => {
  for (const s of STYLES) {
    const list = tricksFor(TRIKS, withStyle(s.id));
    assert.ok(list.every((t) => !t.diy && t.styles.includes(s.id)), s.id);
  }
});

test('gjør-det-selv: flere triks, oppskriftene først og de letteste før de krevende', () => {
  const off = tricksFor(TRIKS, withStyle('skandi'));
  const on = tricksFor(TRIKS, withStyle('skandi', { diy: true }));
  assert.ok(on.length > off.length);
  const firstPlain = on.findIndex((t) => !t.diy);
  assert.ok(firstPlain > 0 && on.slice(firstPlain).every((t) => !t.diy), 'alle med oppskrift står før de uten');
  assert.deepEqual(on.slice(firstPlain).map((t) => t.id), off.map((t) => t.id));
  assert.ok(off.every((t) => on.some((x) => x.id === t.id)));
});

test('triks følger rommene i boligen og tingene på lista', () => {
  const bad = { ...withStyle('skandi', { diy: true }), rooms: [{ id: 'r1', type: 'bad', size: 'M' }] };
  const list = tricksFor(TRIKS, bad);
  assert.ok(list.length && list.every((t) => t.rooms.includes('bad')));
  // hybelen teller som stue, soverom og kjøkken
  const hybel = { ...withStyle('skandi'), rooms: [{ id: 'r1', type: 'ettrom', size: 'M' }] };
  assert.ok(tricksFor(TRIKS, hybel).some((t) => t.rooms.includes('stue')));
  // et triks om noe på lista kommer før de andre i samme gruppe
  const state = withStyle('skandi', { diy: true });
  const need = instances(state).filter((i) => i.st === 'need');
  assert.ok(need.some((i) => i.itemId === 'sofa'));
  const ranked = tricksFor(TRIKS, state, need);
  const iSofa = ranked.findIndex((t) => /sofa/i.test(t.title));
  const iUnrelated = ranked.findIndex((t) => t.diy && !need.some((n) => new RegExp(n.item.name.toLowerCase().split(' ')[0]).test(t.title.toLowerCase())) && !TRIKS.starters.includes(t.id));
  assert.ok(iSofa >= 0 && iSofa < iUnrelated);
  // uten stil brukes «fri», og uten data kommer ingenting
  assert.ok(tricksFor(TRIKS, withStyle(null)).every((t) => t.styles.includes('fri')));
  assert.deepEqual(tricksFor(null, state), []);
});

test('«fikse litt selv» lagres, deles og ryddes', () => {
  assert.equal(newState().diy, false);
  assert.equal(normalize({ ...newState(), diy: true }).diy, true);
  assert.equal(normalize({ ...newState(), diy: 'ja' }).diy, false);
  const old = newState(); delete old.diy; // lister lagret før valget fantes
  assert.equal(normalize(old).diy, false);
  assert.equal(decodeState(encodeState({ ...newState(), diy: true })).diy, true);
});

test('tekster: dato, kostnad og fritt søk', () => {
  assert.equal(dateText('2026-11-22'), '22. november 2026');
  assert.equal(dateText('2026-03-01'), '1. mars 2026');
  assert.equal(dateText('tull'), '');
  assert.equal(costText([200, 900], kr), '200–900 kr');
  assert.equal(costText([300, 300], kr), 'ca. 300 kr');
  assert.equal(costText([0, 0], kr), 'gratis');
  const url = new URL(wordUrl({ ...newState(), area: '0.20061' }, 'teak skjenk', true));
  assert.equal(url.searchParams.get('q'), 'teak skjenk');
  assert.equal(url.searchParams.get('category'), '0.78');
  assert.equal(url.searchParams.get('location'), '0.20061');
  assert.equal(new URL(wordUrl(newState(), 'kommode')).searchParams.get('category'), null);
});
