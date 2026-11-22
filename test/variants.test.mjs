// Varianter av ting, kommentarer, søk på tvers av kategorier og U-sofa på tegningen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newState, instances, normalize, withDrawing, footprint, shapeOf, isCorner, autoVariant, variantsOf, furnName,
  searchText, finnUrl, altWords, altLinks, inCategory, wishOf, summary, parseWish,
} from '../js/logic.js';
import { ITEMS, FOOT } from '../js/data.js';
import { syncFurniture, arrangeRoom, boxOf, boxesOf, armOf, openFor, turnU, flipped, localOpen, turned, fitsRoom, notchAt } from '../js/arrange.js';
import { pointInPoly } from '../js/plan.js';

const get = (s, id) => instances(s).find((i) => i.itemId === id && i.st !== 'off') || instances(s).find((i) => i.itemId === id);
const params = (url) => new URL(url).searchParams;
const rect = (w, h, x = 100, y = 100) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const clone = (v) => JSON.parse(JSON.stringify(v));
function home() {
  const s = newState();
  s.rooms = withDrawing(s.rooms); s.drawn = true;
  return s;
}

test('varianter: hver ting har hele settet, og tegningen har mål for alle', () => {
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.ok(Array.isArray(it.alt) && it.alt.length >= 1, `${id} mangler andre ord`);
    if (!it.size) { assert.ok(!it.alt.includes(it.q), id); continue; }
    const keys = Object.keys(it.size);
    assert.ok(keys.length >= 2 && keys.length <= 8, `${id}: ${keys.length} varianter`);
    assert.ok(it.pick, `${id} mangler overskrift over valget`);
    for (const z of 'SML') assert.ok(it.size[autoVariant(it, z)], `${id}: ingen variant for rom ${z}`);
    for (const [k, v] of Object.entries(it.size)) {
      assert.ok(v.label && v.q && v.u > 0 && v.n > 0, `${id}.${k}`);
      assert.ok(!(v.alt || []).includes(v.q), `${id}.${k}: søkeordet står også som annet ord`);
      if (FOOT[id]) assert.ok(footprint(id, k)?.length === 2, `${id}.${k} mangler mål`);
    }
    if (FOOT[id] && !Array.isArray(FOOT[id])) for (const k of Object.keys(FOOT[id])) assert.ok(it.size[k], `${id}: mål for ukjent variant ${k}`);
    for (const [, short] of variantsOf(it)) assert.ok(short.length <= 18, `${id}: «${short}» er for langt til en knapp`);
  }
});

test('varianter: sofa har åtte, og rommet foreslår fortsatt den vanlige', () => {
  assert.deepEqual(Object.keys(ITEMS.sofa.size), ['S', 'M', 'x4', 'L', 'U', 'chaise', 'modul', 'sove']);
  assert.deepEqual(Object.keys(ITEMS.seng.size), ['x90', 'S', 'x150', 'M', 'L', 'fam', 'koye']);
  const s = newState();                                   // 2-roms: stue M, soverom M
  assert.equal(get(s, 'sofa').size, 'M');
  assert.equal(get(s, 'sofa').v.q, '3-seter sofa');
  assert.equal(get(s, 'seng').v.label, '160 cm bred');
  s.items[get(s, 'sofa').key] = { size: 'U' };
  const u = get(s, 'sofa');
  assert.equal(u.v.q, 'u-sofa');
  assert.equal(shapeOf('sofa', 'U'), 'U'); assert.ok(!isCorner('sofa', 'U'));
  assert.equal(shapeOf('sofa', 'chaise'), 'L'); assert.ok(isCorner('sofa', 'chaise'));
  assert.equal(shapeOf('sofa', 'modul'), null);
  assert.deepEqual(footprint('sofa', 'U'), [320, 210]);
  assert.equal(furnName('sofa', 'U'), 'U-sofa'); assert.equal(furnName('sofa', 'M'), 'Sofa'); assert.equal(furnName('sofa', 'L'), 'Hjørnesofa');
  s.items[get(s, 'seng').key] = { size: 'L' };
  assert.equal(get(s, 'seng').v.q, 'dobbeltseng 180');
  // ting som før bare hadde én utgave, foreslår den samme som før
  const st = get(s, 'lenestol'), bh = get(s, 'bokhylle');
  assert.deepEqual([st.size, st.v.q, st.v.u], ['std', 'lenestol', 1500]);
  assert.deepEqual([bh.size, bh.v.q, bh.v.u], ['hoy', 'bokhylle', 500]);
  assert.deepEqual(footprint('bokhylle', 'M'), [80, 30]);  // eldre tegninger har romstørrelsen lagret
  // benk i stedet for stoler: én benk, ikke fire
  const stoler = get(s, 'spisestoler');
  assert.equal(stoler.qty, 2);
  s.items[stoler.key] = { size: 'benk' };
  assert.deepEqual([get(s, 'spisestoler').qty, get(s, 'spisestoler').v.q], [1, 'spisebenk']);
  assert.ok(summary(s).mid > 0);
});

test('gamle lister: S, M og L er fortsatt varianter, og sofatype blir en variant', () => {
  const s = home();
  const sofa = get(s, 'sofa'), seng = get(s, 'seng'), stol = get(s, 'lenestol');
  const room = s.rooms.find((r) => r.id === sofa.room.id);
  const x = (room.poly[0][0] + room.poly[1][0]) / 2, y = room.poly[0][1] + 5 + 85;
  s.items[sofa.key] = { size: 'L' };
  s.items[seng.key] = { size: 'S' };
  s.items[stol.key] = { st: 'need', size: 'L' };          // kunne ikke velges før, så den skal bare forsvinne
  s.furn = [
    { id: 'f101', room: room.id, item: 'sofa', x, y, w: 260, d: 170, r: 0, s: 'L', corner: 'se' },
    { id: 'f102', room: room.id, item: 'lenestol', x: x, y: y + 250, w: 80, d: 80, r: 0, s: 'M' },
  ];
  const n = normalize(clone(s));
  assert.equal(n.items[sofa.key].size, 'L');
  assert.equal(get(n, 'sofa').v.q, 'hjørnesofa');
  assert.equal(get(n, 'seng').v.q, 'seng 120');
  assert.equal(n.items[stol.key].size, undefined);
  assert.equal(get(n, 'lenestol').size, 'std');
  assert.deepEqual(n.furn.map((f) => [f.s, f.corner]), [['L', 'se'], ['M', undefined]]);
  assert.equal(syncFurniture(n), n.furn);                  // ingenting flytter seg av at lista har fått flere varianter
  // «Type: Sovesofa / Med sjeselong / Modulsofa» var før et eget spørsmål
  for (const [i, want] of [[1, 'sove'], [2, 'chaise'], [3, 'modul']]) {
    const old = clone({ ...newState(), items: { 'r1:sofa': { picks: { sofatype: i, farge: 2 } } } });
    const m = normalize(old);
    assert.equal(m.items['r1:sofa'].size, want);
    assert.deepEqual(m.items['r1:sofa'].picks, { farge: 2 });
  }
  assert.equal(normalize(clone({ ...newState(), items: { 'r1:sofa': { size: 'tull' } } })).items['r1:sofa'].size, undefined);
  // et lagret svar på et spørsmål tingen ikke lenger har, skal ikke styre søket i det skjulte
  const t = newState();
  t.items['r1:sofa'] = { picks: { sofatype: 1 } };
  assert.equal(searchText(get(t, 'sofa'), t), '3-seter sofa');
});

test('kommentar: gjelder alle ting, også egne, og går inn i søket', () => {
  const s = newState();
  s.custom = [{ id: 'c101', room: 'r1', name: 'Puff' }];
  s.items['r1:c101'] = { wish: 'grønn fløyel, ikke rund, maks 60 cm' };
  s.items[get(s, 'tvbenk').key] = { wish: 'gjerne eik <b>' };
  const n = normalize(clone(s));
  const puff = instances(n).find((i) => i.itemId === 'c101');
  assert.equal(searchText(puff, n), 'puff fløyel grønn');
  assert.deepEqual(wishOf(puff, n).notes, ['maks 60 cm']);
  assert.deepEqual(wishOf(puff, n).avoid, ['rundt']);
  assert.equal(searchText(get(n, 'tvbenk'), n), 'tv-benk eik');
  assert.equal(n.items[get(n, 'tvbenk').key].wish, 'gjerne eik <b>');   // lagres som skrevet, og vises alltid med esc()
  // ord som slutter på å eller é ble før oversett når de sto foran komma eller mellomrom
  assert.deepEqual(parseWish('grå, ikke blå. Gjerne bouclé og unngå skinn'), { search: ['bouclé', 'grå'], avoid: ['skinn', 'blå'], notes: [] });
  assert.deepEqual(parseWish('blå sofa').search, ['blå']);
  assert.deepEqual(parseWish('grått og blått').search, ['grå', 'blå']);
  assert.deepEqual(parseWish('grågrønn').search, []);
  s.items['r1:c101'] = { wish: 'x'.repeat(500) };
  assert.equal(normalize(clone(s)).items['r1:c101'].wish.length, 300);
  s.items['r1:c101'] = { wish: 42 };
  assert.equal(normalize(clone(s)).items['r1:c101'].wish, undefined);
});

test('søk: hovedsøket holder seg i kategorien, «Søk bredere» og andre ord gjør det ikke', () => {
  const s = newState();
  s.area = '0.20061';
  const bord = get(s, 'sofabord');
  s.items[bord.key] = { wish: 'rundt, eik' };
  const i = get(s, 'sofabord');
  const main = params(finnUrl(i, s)), broad = params(finnUrl(i, s, 'all', { broad: true }));
  assert.equal(main.get('category'), '0.78');
  assert.equal(broad.get('category'), null);
  for (const k of ['q', 'location', 'price_to', 'sort']) assert.equal(broad.get(k), main.get(k), k);
  assert.equal(main.get('q'), 'sofabord rundt eik');
  assert.equal(main.get('location'), '0.20061');
  assert.deepEqual(altWords(i, s), ['stuebord', 'salongbord', 'kaffebord']);
  const alts = altLinks(i, s);
  assert.deepEqual(alts.map((a) => a.word), ['stuebord', 'salongbord', 'kaffebord']);
  for (const a of alts) {
    const p = params(a.url);
    assert.equal(p.get('q'), `${a.word} rundt eik`);
    assert.equal(p.get('category'), null);
    assert.equal(p.get('location'), '0.20061');
    assert.equal(p.get('price_to'), main.get('price_to'));
  }
  // dagens runde: bredt, og bare det som er lagt ut i dag
  const today = params(finnUrl(i, s, 'today', { broad: true }));
  assert.deepEqual([today.get('published'), today.get('category'), today.get('q')], ['1', null, 'sofabord rundt eik']);
  assert.equal(params(finnUrl(i, s, 'free', { broad: true })).get('price_to'), null);
  // variantens egne ord kommer først
  s.items[get(s, 'sofa').key] = { size: 'U' };
  assert.deepEqual(altWords(get(s, 'sofa'), s).slice(0, 3), ['hesteskosofa', 'u-formet sofa', 'u sofa']);
  assert.equal(params(altLinks(get(s, 'sofa'), s)[0].url).get('q'), 'hesteskosofa');
  // tv-benk: ordene brukeren ba om
  for (const w of ['tv-bord', 'mediabenk', 'skjenk', 'sideboard']) assert.ok(altWords(get(s, 'tvbenk'), s).includes(w), w);
  assert.ok(ITEMS.kommode.alt.includes('skuffeseksjon') && ITEMS.garderobe.alt.includes('klesskap') && ITEMS.bokhylle.alt.includes('reol'));
  assert.ok(ITEMS.lenestol.alt.includes('godstol') && ITEMS.spisebord.alt.includes('kjøkkenbord') && ITEMS.gulvlampe.alt.includes('stålampe') && ITEMS.teppe.alt.includes('rye'));
  // ting utenfor «Møbler og interiør» søkes alltid bredt, så de trenger ikke egen knapp
  const bestikk = get(s, 'bestikk');
  assert.ok(!inCategory(bestikk) && inCategory(i));
  assert.equal(finnUrl(bestikk, s), finnUrl(bestikk, s, 'all', { broad: true }));
  // et svar som bytter søkeord, skal ikke komme igjen som «annet ord»
  s.items[get(s, 'seng').key] = { picks: { sengtype: 1 } };
  assert.equal(searchText(get(s, 'seng'), s), 'kontinentalseng');
  assert.ok(!altWords(get(s, 'seng'), s).includes('kontinentalseng'));
  // egne ting har ingen andre ord
  s.custom = [{ id: 'c101', room: 'r1', name: 'Puff' }];
  assert.deepEqual(altLinks(instances(s).find((x) => x.itemId === 'c101'), s), []);
});

test('U-sofa: rygg og to armer, åpningen kan snus hele veien rundt', () => {
  const f = { item: 'sofa', x: 300, y: 300, w: 320, d: 210, r: 0, u: 's' };
  const t = armOf(f);
  assert.equal(t, 95);
  const bs = boxesOf(f), b = boxOf(f);
  assert.equal(bs.length, 3);
  assert.deepEqual(bs[0], [b[0], b[1], b[2], b[1] + t]);                     // ryggen øverst når åpningen er ned
  for (const x of bs) assert.ok(x[0] >= b[0] && x[1] >= b[1] && x[2] <= b[2] && x[3] <= b[3]);
  const hole = (g) => { const o = boxOf(g), q = armOf(g); return { n: [o[0] + q, o[1], o[2] - q, o[3] - q], s: [o[0] + q, o[1] + q, o[2] - q, o[3]], e: [o[0] + q, o[1] + q, o[2], o[3] - q], w: [o[0], o[1] + q, o[2] - q, o[3] - q] }[g.u]; };
  assert.ok(!bs.some((x) => overlap(x, hole(f))));                           // åpningen er fri
  const area = (x) => (x[2] - x[0]) * (x[3] - x[1]);
  assert.equal(area(hole(f)), (320 - 2 * t) * (210 - t));
  assert.deepEqual(['n', 'e', 's', 'w'].map(turnU), ['e', 's', 'w', 'n']);
  assert.deepEqual(['n', 'e', 's', 'w'].map((u) => flipped({ ...f, u }).u), ['s', 'w', 'n', 'e']);
  assert.deepEqual([localOpen({ r: 0, u: 'n' }), localOpen({ r: 0, u: 's' }), localOpen({ r: 90, u: 'e' }), localOpen({ r: 90, u: 'w' })], ['n', 's', 'n', 's']);
  assert.deepEqual([[0, 1], [0, -1], [1, 0], [-1, 0]].map(openFor), ['s', 'n', 'e', 'w']);
  // fire snu gir samme sofa tilbake, og den står inne i rommet hele veien
  const room = { poly: rect(500, 400) };
  let g = { ...f, x: 350, y: 300 };
  const seen = [];
  for (let i = 0; i < 4; i++) {
    g = turned(room, g);
    assert.ok(g && fitsRoom(room, g), `snu ${i + 1}`);
    assert.ok((g.r === 90 ? ['e', 'w'] : ['n', 's']).includes(g.u));
    for (const x of boxesOf(g)) assert.ok(!overlap(x, hole(g)));
    seen.push(g.u);
  }
  assert.deepEqual(seen, ['w', 'n', 'e', 's']);
  assert.deepEqual([g.r, g.u, g.w, g.d], [0, 's', 320, 210]);
  // lagring: åpningen må passe med retningen, og en hestesko er ikke samtidig en vinkel
  const s = home(), stue = s.rooms.find((r) => r.type === 'stue');
  const at = { id: 'f101', room: stue.id, item: 'sofa', x: stue.poly[0][0] + 200, y: stue.poly[0][1] + 150, w: 320, d: 210, s: 'U' };
  s.furn = [{ ...at, r: 0, u: 'n', corner: 'se' }, { ...at, id: 'f102', r: 90, u: 'n' }, { ...at, id: 'f103', r: 90, u: 'w' }, { ...at, id: 'f104', r: 0, u: 'x' }];
  assert.deepEqual(normalize(clone(s)).furn.map((x) => [x.s, x.u, x.corner]), [['U', 'n', undefined], ['U', undefined, undefined], ['U', 'w', undefined], ['U', undefined, undefined]]);
});

test('sett ut: U-sofa med ryggen mot veggen, åpningen ut i rommet, bordet inni og TV rett overfor', () => {
  const room = { poly: rect(520, 420), doors: [{ e: 3, t: 0.85, w: 80, kind: 'door' }] };
  const wants = [
    { item: 'sofa', w: 320, d: 210, qty: 1, s: 'U', u: true }, { item: 'sofabord', w: 100, d: 60, qty: 1, s: 'M' },
    { item: 'tvbenk', w: 150, d: 40, qty: 1, s: 'M' }, { item: 'teppe', w: 230, d: 160, qty: 1, s: 'M' }, { item: 'gulvlampe', w: 35, d: 35, qty: 1 },
  ];
  const res = arrangeRoom(room, wants);
  const one = (id) => res.placed.find((f) => f.item === id);
  const sofa = one('sofa'), bord = one('sofabord'), tv = one('tvbenk');
  assert.ok(sofa && bord && tv && one('teppe'), JSON.stringify(res));
  assert.deepEqual([sofa.s, sofa.corner], ['U', undefined]);
  assert.ok(fitsRoom(room, sofa));
  // ryggen står inntil en vegg, og åpningen vender bort fra den
  const b = boxOf(sofa), back = boxesOf(sofa)[0];
  const wallGap = { s: back[1] - 100, n: 520 - back[3], e: back[0] - 100, w: 620 - back[2] }[sofa.u];
  assert.ok(wallGap >= 0 && wallGap <= 10, `ryggen står ${wallGap} cm fra veggen`);
  assert.ok((sofa.r === 90 ? ['e', 'w'] : ['n', 's']).includes(sofa.u));
  // bordet står inne i hesteskoen uten å røre armene
  const tb = boxOf(bord);
  assert.ok(tb[0] >= b[0] && tb[1] >= b[1] && tb[2] <= b[2] && tb[3] <= b[3], 'bordet står inne i sofaen');
  for (const x of boxesOf(sofa)) assert.ok(!overlap(tb, x), 'bordet står oppå sofaen');
  // TV-benken står på motsatt vegg, rett overfor
  const horiz = sofa.r !== 90;
  assert.ok(Math.abs(horiz ? tv.x - sofa.x : tv.y - sofa.y) <= 20);
  assert.ok(Math.abs(horiz ? tv.y - sofa.y : tv.x - sofa.x) > 200);
  for (const f of res.placed) for (const g of res.placed) {
    if (f === g || f.item === 'teppe' || g.item === 'teppe') continue;
    for (const x of boxesOf(f)) for (const y of boxesOf(g)) assert.ok(!overlap(x, y), `${f.item} og ${g.item} overlapper`);
  }
  // for stort bord får ikke plass inni: da står det foran åpningen i stedet
  const big = arrangeRoom(room, [{ item: 'sofa', w: 320, d: 210, qty: 1, u: true }, { item: 'sofabord', w: 130, d: 70, qty: 1 }]);
  const s2 = big.placed.find((f) => f.item === 'sofa'), t2 = big.placed.find((f) => f.item === 'sofabord');
  if (t2) for (const x of boxesOf(s2)) assert.ok(!overlap(boxOf(t2), x));
  // sofa med sjeselong er en vinkel, som hjørnesofaen
  const ch = arrangeRoom(room, [{ item: 'sofa', w: 250, d: 160, qty: 1, s: 'chaise', corner: true }, { item: 'sofabord', w: 100, d: 60, qty: 1 }]);
  const c = ch.placed.find((f) => f.item === 'sofa'), ct = ch.placed.find((f) => f.item === 'sofabord');
  assert.ok(c.corner && !c.u && ct);
  for (const x of boxesOf(c)) assert.ok(!overlap(boxOf(ct), x));
});

test('sett ut: hjørneskrivebord får sidearmen inn mot hjørnet, og stolen står i vinkelen', () => {
  const room = { poly: rect(360, 300), doors: [{ e: 2, t: 0.5, w: 80, kind: 'door' }] };
  const res = arrangeRoom(room, [{ item: 'skrivebord', w: 160, d: 120, qty: 1, s: 'hjorne', corner: true }, { item: 'kontorstol', w: 60, d: 60, qty: 1 }]);
  const desk = res.placed.find((f) => f.item === 'skrivebord'), chair = res.placed.find((f) => f.item === 'kontorstol');
  assert.ok(desk?.corner && chair, JSON.stringify(res));
  assert.equal(armOf(desk), 65);
  assert.ok(fitsRoom(room, desk));
  const [back, side] = boxesOf(desk);
  for (const x of [back, side]) assert.ok(!overlap(boxOf(chair), x), 'stolen står oppå bordet');
  assert.ok(overlap(boxOf(chair), boxOf(desk)), 'stolen står i vinkelen');
  // sidearmen står inntil en vegg på tvers av ryggen
  const near = (v, list) => list.some((w) => Math.abs(v - w) <= 10);
  assert.ok(desk.r === 90 ? near(side[1], [100]) || near(side[3], [400]) : near(side[0], [100]) || near(side[2], [460]), JSON.stringify(desk));
  assert.equal(notchAt({ o: 'H', u: [1, 0], n: [0, 1] }, -1), 'se'); // sidearm i vest: åpent hjørne sørøst
  assert.equal(notchAt({ o: 'H', u: [1, 0], n: [0, 1] }, 1), 'sw');
  assert.equal(notchAt({ o: 'V', u: [0, 1], n: [1, 0] }, -1), 'se');
});

test('tegningen følger lista: 3-seter blir U-sofa, U-sofa blir hjørnesofa, og tilbake til firkant', () => {
  const s = home(), room = s.rooms.find((r) => r.type === 'stue');
  const key = get(s, 'sofa').key;
  const xs = room.poly.map((p) => p[0]), y0 = Math.min(...room.poly.map((p) => p[1]));
  s.furn = [{ id: 'f101', room: room.id, item: 'sofa', x: (Math.min(...xs) + Math.max(...xs)) / 2, y: y0 + 5 + 45, w: 210, d: 90, r: 0, s: 'M' }];
  const inside = (f) => boxesOf(f).every((b) => [[b[0] + 1, b[1] + 1], [b[2] - 1, b[3] - 1]].every((p) => pointInPoly(p, room.poly)));
  s.items[key] = { size: 'U' };
  let f = syncFurniture(s)[0];
  assert.deepEqual([f.w, f.d, f.s, f.u, f.corner, f.r], [320, 210, 'U', 's', undefined, 0]);
  assert.equal(boxOf(f)[1], y0 + 5);                         // ryggen står der den sto
  assert.ok(inside(f));
  s.furn = [f];
  assert.equal(syncFurniture(s), s.furn);                    // stabilt
  s.items[key] = { size: 'L' };
  f = syncFurniture(s)[0];
  assert.deepEqual([f.w, f.d, f.s, f.u, f.corner], [260, 170, 'L', undefined, 'se']);
  assert.equal(boxOf(f)[1], y0 + 5);
  s.furn = [f]; s.items[key] = { size: 'chaise' };
  f = syncFurniture(s)[0];
  assert.deepEqual([f.w, f.d, f.s, f.corner], [250, 160, 'chaise', 'se']);
  s.furn = [f]; s.items[key] = { size: 'U' };
  f = syncFurniture(s)[0];
  assert.deepEqual([f.s, f.u, f.corner], ['U', 's', undefined]);
  s.furn = [f]; s.items[key] = { size: 'x4' };
  f = syncFurniture(s)[0];
  assert.deepEqual([f.w, f.d, f.s, f.u, f.corner], [260, 95, 'x4', undefined, undefined]);
  // en U-sofa som står fritt og er snudd, beholder åpningen når den blir hjørnesofa
  s.furn = [{ id: 'f101', room: room.id, item: 'sofa', x: Math.min(...xs) + 200, y: y0 + 220, w: 320, d: 210, r: 90, s: 'U', u: 'w' }];
  s.items[key] = { size: 'L' };
  f = syncFurniture(s)[0];
  assert.deepEqual([f.corner, f.u, f.r], ['sw', undefined, 90]);
});
