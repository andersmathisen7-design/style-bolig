// Daglig sjekk på Finn: profilen som skrives, funnene som leses, skjulte annonser og datotekst.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, roomsFromHome, instances, finnUrl } from '../js/logic.js';
import { STYLES } from '../js/data.js';
import {
  FORMAT, MAX_THINGS, MAX_HIDDEN, buildProfile, profileSig, adId, safeFinnUrl, cleanHidden, addHidden, cleanFinds,
  osloDay, dayText, summaryText, priceText, findsBlock, checkPanel,
} from '../js/funn.js';

function home() {
  const s = newState();
  s.rooms = roomsFromHome('toroms');
  s.style = STYLES[0].id; s.sub = 0; s.prio = 'stil'; s.area = '0.20061';
  return s;
}
const NOW = new Date('2026-11-22T20:00:00Z');
const need = (s) => instances(s).filter((i) => i.st === 'need');
const ad = (id) => `https://www.finn.no/recommerce/forsale/item/${id}`;
const pick = (id, over = {}) => ({ id: String(id), title: `Sofa ${id}`, price: 1500, place: 'Oslo', url: ad(id), why: 'Passer stilen', score: 8, cat: 'Sofa', day: '2026-11-23', ...over });
// Skrives som { nøkkel: [funn] } i testene, og gjøres om til lista jobben skriver: [{ key, picks }].
const rows = (things) => (things && typeof things === 'object' && !Array.isArray(things) ? Object.entries(things).map(([key, picks]) => ({ key, picks })) : things);
const finds = (things, over = {}) => ({ v: 1, day: '2026-11-23', time: '06:45', seen: 120, skipped: [], things: rows(things), ...over });

test('profil: bare ting brukeren leter etter, med ferdige søk for «lagt ut i dag»', () => {
  const s = home();
  const first = need(s)[0], second = need(s)[1];
  s.items[second.key] = { st: 'bought', paid: 500 };
  const p = buildProfile(s, { now: NOW });
  assert.equal(p.v, FORMAT);
  assert.equal(p.updatedAt, '2026-11-22T20:00:00.000Z');
  assert.equal(p.area, 'Oslo');
  assert.deepEqual(p.style, { name: STYLES[0].name, sub: STYLES[0].photos[0].name });
  assert.equal(p.prio, 'stil');
  assert.deepEqual(p.hidden, []);
  assert.equal(p.things.length, need(s).length);
  assert.ok(!p.things.some((t) => t.key === second.key), 'kjøpte ting er ikke med');
  const t = p.things.find((x) => x.key === first.key);
  assert.equal(t.name, first.item.name);
  assert.ok(t.room && t.q && t.qty >= 1);
  // Lenkene lages av finnUrl, så område og pris følger resten av siden.
  // Jobben får samme søk som knappen, men uten «sort»: Finn ber roboter la slike adresser være.
  assert.equal(t.url, finnUrl(first, s, 'today', { broad: true }).replace('&sort=PUBLISHED_DESC', ''));
  assert.ok(!JSON.stringify(p).includes('sort='));
  const u = new URL(t.url).searchParams;
  assert.equal(u.get('published'), '1');
  assert.equal(u.get('category'), null, 'bredt søk, uten kategori');
  assert.equal(u.get('location'), '0.20061');
  assert.ok(t.alt.length >= 1 && t.alt.length <= 3);
  for (const a of t.alt) { assert.ok(a.word); assert.equal(new URL(a.url).searchParams.get('published'), '1'); }
  for (const x of p.things) assert.equal(safeFinnUrl(x.url), x.url);
});

test('profil: ønsker deles i søk, unngå og merknader, og pris, bredde og antall følger med', () => {
  const s = home();
  const sofa = need(s).find((i) => i.itemId === 'sofa');
  s.items[sofa.key] = { wish: 'grå, ikke skinn', max: 2500, maxw: 220, qty: 2, prio: 'komfort' };
  const t = buildProfile(s, { now: NOW }).things.find((x) => x.key === sofa.key);
  assert.equal(t.max, 2500);
  assert.equal(t.maxw, 220);
  assert.equal(t.qty, 2);
  assert.equal(t.prio, 'komfort');
  assert.ok(t.search.includes('grå'));
  assert.ok(t.avoid.includes('skinn'));
  assert.ok(t.notes.some((n) => n.includes('220')));
  assert.ok(t.variant);
  // Ingen prisgrense: feltet er ikke med, og søket har ingen pris.
  s.items[sofa.key] = { max: null };
  const free = buildProfile(s, { now: NOW }).things.find((x) => x.key === sofa.key);
  assert.equal('max' in free, false);
  assert.equal(new URL(free.url).searchParams.get('price_to'), null);
});

test('profil: tom liste, uten stil, egne ting og mange ting', () => {
  const empty = buildProfile(newState(), { now: NOW });
  assert.equal(empty.area, 'Hele Norge');
  assert.equal('style' in empty, false);
  const s = home(); s.style = null; s.sub = null; s.prio = null;
  s.custom = [{ id: 'c1', room: s.rooms[0].id, name: 'Gyngestol <b>' }];
  const p = buildProfile(s, { now: NOW, area: 'Innen 20 km fra Bergen', hidden: ['123456', 'x', 7, '123456'] });
  assert.equal(p.area, 'Innen 20 km fra Bergen');
  assert.deepEqual(p.hidden, ['123456']);
  const own = p.things.find((t) => t.key.endsWith(':c1'));
  assert.equal(own.name, 'Gyngestol <b>');
  assert.equal('max' in own, false);
  for (let i = 0; i < 60; i++) s.custom.push({ id: `x${i}`, room: s.rooms[0].id, name: `Ting ${i}` });
  const big = buildProfile(s, { now: NOW });
  assert.equal(big.things.length, MAX_THINGS);
  assert.ok(JSON.stringify(big).length < 200000, 'godt under grensen for ett dokument');
});

test('profil: samme liste gir samme signatur uansett tidspunkt og feltrekkefølge', () => {
  const s = home();
  const a = buildProfile(s, { now: NOW });
  const b = buildProfile(s, { now: new Date('2026-11-25T08:00:00Z') });
  assert.equal(profileSig(a), profileSig(b));
  const shuffled = Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(a))).reverse());
  assert.equal(profileSig(shuffled), profileSig(a));
  const sofa = need(s).find((i) => i.itemId === 'sofa');
  s.items[sofa.key] = { max: 999 };
  assert.notEqual(profileSig(buildProfile(s, { now: NOW })), profileSig(a));
  assert.notEqual(profileSig(buildProfile(home(), { now: NOW, hidden: ['123456'] })), profileSig(a));
  assert.equal(profileSig(null), '');
});

test('lenker: bare https://www.finn.no/ slipper gjennom', () => {
  assert.equal(safeFinnUrl(ad(123456789)), ad(123456789));
  for (const bad of [
    'http://www.finn.no/recommerce/forsale/item/123456', 'https://finn.no/item/123456', 'https://www.finn.no.evil.example/item/123456',
    'https://www.finn.no@evil.example/item/123456', 'https://evil.example/https://www.finn.no/', 'javascript:alert(1)', 'data:text/html,x',
    '//www.finn.no/item/123456', ' https://www.finn.no/item/123456', 'https://www.finn.no:8443/item/123456', '', null, 42, {}, `https://www.finn.no/${'a'.repeat(400)}`,
  ]) assert.equal(safeFinnUrl(bad), '', String(bad).slice(0, 50));
  assert.equal(adId(ad(123456789)), '123456789');
  assert.equal(adId('https://www.finn.no/recommerce/forsale/item/123456789?ci=1'), '123456789');
  assert.equal(adId('https://www.finn.no/bap/forsale/ad.html?finnkode=123456789'), '123456789');
  assert.equal(adId('https://www.finn.no/recommerce/forsale/search?q=sofa'), '');
});

test('skjulte annonser: bare Finn-koder, ingen dobbelt, og de eldste faller ut', () => {
  assert.deepEqual(cleanHidden(['123456', 123456, '12', 'abc', '<script>', '123456', '7654321']), ['123456', '7654321']);
  assert.deepEqual(cleanHidden('123456'), []);
  assert.deepEqual(addHidden(['111111', '222222'], '111111'), ['222222', '111111']);
  assert.deepEqual(addHidden(null, 'nei'), []);
  let list = [];
  for (let i = 0; i < MAX_HIDDEN + 20; i++) list = addHidden(list, String(100000 + i));
  assert.equal(list.length, MAX_HIDDEN);
  assert.equal(list.at(-1), String(100000 + MAX_HIDDEN + 19));
  assert.ok(!list.includes('100000'));
});

test('funn: riktig form vises, med inntil tre per ting og nyeste først', () => {
  const f = cleanFinds(finds({
    'r1:sofa': [pick(100001, { score: 6 }), pick(100002, { score: 9 }), pick(100003, { day: '2026-11-22', score: 10 }), pick(100004, { score: 7 }), pick(100002)],
    'r1:bord': [pick(200001, { price: 0, place: '' })],
    'r9:borte': [pick(300001)],
  }, { skipped: ['r1:bord', 'r9:borte', 5] }), ['r1:sofa', 'r1:bord']);
  assert.equal(f.day, '2026-11-23');
  assert.equal(f.time, '06:45');
  assert.equal(f.seen, 120);
  assert.deepEqual(f.things['r1:sofa'].map((p) => p.id), ['100002', '100004', '100001'], 'dagens først, best først');
  assert.equal(f.things['r1:bord'][0].price, 0);
  assert.equal('r9:borte' in f.things, false, 'ting som ikke er på lista lenger, vises ikke');
  assert.equal(f.total, 4);
  assert.equal(f.fresh, 4);
  assert.deepEqual(f.skipped, ['r1:bord']);
});

test('funn: skjulte annonser kommer ikke tilbake', () => {
  const raw = finds({ 'r1:sofa': [pick(100001), pick(100002)] });
  const f = cleanFinds(raw, ['r1:sofa'], ['100001']);
  assert.deepEqual(f.things['r1:sofa'].map((p) => p.id), ['100002']);
  assert.equal(f.fresh, 1);
  const none = cleanFinds(raw, ['r1:sofa'], ['100001', '100002']);
  assert.deepEqual(none.things, {});
  assert.equal(none.fresh, 0);
});

test('funn: feil form og fremmed innhold stoppes', () => {
  for (const bad of [null, undefined, 'tekst', [], 7, {}, { v: 2, day: '2026-11-23', things: {} }, { v: 1, day: 'i dag' }, { v: 1, day: '2026-13-45' }]) {
    assert.equal(cleanFinds(bad, ['r1:sofa']), null);
  }
  // Ingenting av dette er et gyldig funn. Nøkler som «__proto__» og «constructor» gir heller ingenting.
  const f = cleanFinds(finds({
    'r1:sofa': [
      pick(100001, { url: 'https://evil.example/item/100001' }),
      pick(100002, { url: 'javascript:alert(1)' }),
      pick(100003, { url: 'https://www.finn.no/recommerce/forsale/search?q=sofa' }),
      pick(100004, { title: '' }),
      pick(100005, { title: 42 }),
      'ikke et objekt', null, [pick(100006)],
    ],
    'r1:bord': { 0: pick(100009) },
  }), ['r1:sofa', 'r1:bord', '__proto__', 'constructor', 'toString']);
  assert.deepEqual(f.things, {});
  assert.equal(f.total, 0);
  assert.equal(cleanFinds(finds('tekst'), ['r1:sofa']).total, 0);
  assert.equal(cleanFinds(finds({ 'r1:sofa': [pick(100001)] }, { things: { 'r1:sofa': [pick(100001)] } }), ['r1:sofa']).total, 0, 'gammel form med oppslag godtas ikke');
  const twice = cleanFinds(finds([{ key: 'r1:sofa', picks: [pick(100001)] }, { key: 'r1:sofa', picks: [pick(100002)] }, { key: '__proto__', picks: [pick(100003)] }, 'x', null, { key: 5, picks: [] }, { key: 'r1:sofa' }]), ['r1:sofa', '__proto__']);
  assert.deepEqual(Object.keys(twice.things), ['r1:sofa']);
  assert.deepEqual(twice.things['r1:sofa'].map((p) => p.id), ['100001'], 'første rad for tingen gjelder');
  const g = cleanFinds(finds({
    'r1:sofa': [
      pick(100001, { url: 'https://evil.example/item/100001' }), pick(100002, { url: 'javascript:alert(1)' }), pick(100004, { title: '' }), 'tekst', null,
      pick(100007, { title: `<script>alert(1)</script>${'x'.repeat(300)}`, price: '1500', place: { a: 1 }, why: 'Linje\n\u2028to   ok', score: 99, day: '2099-01-01', cat: 5, id: 'løgn' }),
    ],
  }, { time: '25:99', seen: -4, skipped: 'alt' }), ['r1:sofa', 'constructor']);
  assert.equal(g.time, '');
  assert.equal(g.seen, null);
  assert.deepEqual(g.skipped, []);
  assert.equal(g.things['r1:sofa'].length, 1);
  const p = g.things['r1:sofa'][0];
  assert.equal(p.id, '100007', 'koden hentes fra lenken, ikke fra feltet');
  assert.equal(p.title.length, 120);
  assert.equal(p.price, null);
  assert.equal(p.place, '');
  assert.equal(p.why, 'Linje to ok');
  assert.equal(p.score, null);
  assert.equal(p.day, '2026-11-23', 'en dato i framtiden byttes med dagen jobben kjørte');
  assert.equal(p.cat, '');
  // Mange funn på én ting: bare de tolv første blir i det hele tatt sett på.
  const many = cleanFinds(finds({ 'r1:sofa': Array.from({ length: 500 }, (_, i) => pick(400000 + i)) }), ['r1:sofa']);
  assert.equal(many.things['r1:sofa'].length, 3);
});

test('funn: det som vises, er vasket for HTML', () => {
  const f = cleanFinds(finds({ 'r1:"sofa': [pick(100001, { title: '<img src=x onerror=alert(1)>', place: '"><script>x</script>', why: "<b onclick='x'>fin</b>" })] }), ['r1:"sofa']);
  const html = findsBlock('r1:"sofa', f.things['r1:"sofa'], '2026-11-23');
  assert.ok(!/<img|<script|<b /.test(html));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('data-v="r1:&quot;sofa"'));
  assert.ok(html.includes(`href="${ad(100001)}" target="_blank" rel="noopener"`));
  assert.ok(html.includes('1 500 kr · &quot;&gt;&lt;script&gt;x&lt;/script&gt; · i dag'));
  // Selv om noen skulle gi blokka et funn som ikke er vasket, blir lenken tom og ikke farlig.
  assert.ok(findsBlock('k', [{ id: '1', url: 'javascript:alert(1)', title: 't', price: null, place: '', why: '', day: '2026-11-23' }], '2026-11-23').includes('href=""'));
  assert.equal(findsBlock('k', [], '2026-11-23'), '');
  assert.equal(findsBlock('k', undefined, '2026-11-23'), '');
});

test('panelet: skjult uten database, ærlig tekst, og riktig melding i hver tilstand', () => {
  const base = { ready: true, on: false, busy: false, late: false, err: '' };
  assert.equal(checkPanel({ ...base, ready: false }, null, '2026-11-23'), '');
  const off = checkPanel(base, null, '2026-11-23');
  assert.ok(off.includes('Daglig sjekk på Finn') && off.includes('La Claude se etter tingene mine hver kveld'));
  assert.ok(!off.includes('checked'));
  assert.ok(off.includes('én gang om dagen') && off.includes('Bildene ser den ikke på') && off.includes('Claude-kvoten'));
  const on = checkPanel({ ...base, on: true }, null, '2026-11-23');
  assert.ok(on.includes('checked') && on.includes('Ingen funn ennå. Sjekken kjøres hver kveld rundt kl. 21.'));
  const f = cleanFinds(finds({ 'r1:sofa': [pick(100001)] }, { skipped: ['r1:bord'] }), ['r1:sofa', 'r1:bord']);
  const full = checkPanel({ ...base, on: true }, f, '2026-11-23');
  assert.ok(full.includes('Sist sjekket i dag 06:45 – 1 nytt funn'));
  assert.ok(full.includes('Én ting ble ikke sjekket sist'));
  assert.ok(checkPanel({ ...base, on: true, late: true }, null, '2026-11-23').includes('Får ikke hentet funnene'));
  assert.ok(checkPanel({ ...base, err: 'Noe <gikk> galt' }, null, '2026-11-23').includes('Noe &lt;gikk&gt; galt'));
  assert.ok(checkPanel({ ...base, busy: true }, null, '2026-11-23').includes('disabled'));
});

test('datotekst: i dag, i går og dato, etter norsk tid', () => {
  assert.equal(osloDay(new Date('2026-11-22T22:30:00Z')), '2026-11-22');
  assert.equal(osloDay(new Date('2026-11-22T23:30:00Z')), '2026-11-23', 'etter midnatt i Norge');
  assert.equal(osloDay(new Date('2026-06-30T22:30:00Z')), '2026-07-01', 'sommertid');
  assert.equal(dayText('2026-11-23', '2026-11-23'), 'i dag');
  assert.equal(dayText('2026-11-22', '2026-11-23'), 'i går');
  assert.equal(dayText('2026-11-21', '2026-11-23'), '21. nov.');
  assert.equal(dayText('2026-12-31', '2027-01-01'), 'i går');
  assert.equal(dayText('2026-05-03', '2026-11-23'), '3. mai');
  assert.equal(dayText('tull', '2026-11-23'), '');
  const f = (fresh, over = {}) => ({ day: '2026-11-23', time: '06:45', fresh, ...over });
  assert.equal(summaryText(f(7), '2026-11-23'), 'Sist sjekket i dag 06:45 – 7 nye funn');
  assert.equal(summaryText(f(1), '2026-11-24'), 'Sist sjekket i går 06:45 – 1 nytt funn');
  assert.equal(summaryText(f(0, { time: '' }), '2026-11-30'), 'Sist sjekket 23. nov. – ingen nye funn');
  assert.equal(summaryText(null, '2026-11-23'), '');
  assert.equal(priceText(0), 'gis bort');
  assert.equal(priceText(null), 'pris ikke oppgitt');
  assert.equal(priceText(1500), '1 500 kr');
});
