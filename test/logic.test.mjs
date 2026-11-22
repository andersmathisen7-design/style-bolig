import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newState, instances, parseWish, parseLife, finnUrl, ikeaUrl, searchText, summary, fitBudget, maxOf,
  layoutPlan, encodeState, decodeState, normalize, sizeFromM2, wallNote, newHint, roomsFromHome,
} from '../js/logic.js';
import { ITEMS, ROOMS, HOMES, LIFE, QUESTIONS, ITEM_WORDS } from '../js/data.js';

const get = (s, id) => instances(s).find((i) => i.itemId === id && i.st !== 'off') || instances(s).find((i) => i.itemId === id);

test('data henger sammen', () => {
  for (const [id, r] of Object.entries(ROOMS)) for (const it of [...r.ess, ...r.extra]) assert.ok(ITEMS[it], `${id}: ${it}`);
  for (const h of HOMES) for (const [type, size] of h.rooms) assert.ok(ROOMS[type] && 'SML'.includes(size));
  for (const l of LIFE) { for (const [types, it] of l.add) { assert.ok(ITEMS[it]); types.forEach((t) => assert.ok(ROOMS[t])); } Object.keys(l.tips).forEach((k) => assert.ok(ITEMS[k], k)); }
  for (const [id, it] of Object.entries(ITEMS)) {
    (it.ask || []).forEach((q) => assert.ok(QUESTIONS[q], `${id}: ${q}`));
    const vs = it.size ? Object.values(it.size) : [it];
    vs.forEach((v) => assert.ok(v.q && v.u > 0 && v.n > 0, id));
  }
  ITEM_WORDS.forEach(([, it]) => assert.ok(ITEMS[it]));
});

test('ikke rundt, vil ha firkantet', () => {
  const w = parseWish('Jeg vil ikke ha rundt bord, jeg vil ha firkantet');
  assert.deepEqual(w.avoid, ['rundt']);
  assert.deepEqual(w.search, []);
  assert.deepEqual(w.notes, ['firkantet']);
});

test('ønsker blir søkeord, mål blir notater', () => {
  const w = parseWish('gjerne eik og uttrekkbart, maks 180 cm, ikke glass eller marmor');
  assert.deepEqual(w.search.sort(), ['eik', 'uttrekkbart']);
  assert.deepEqual(w.avoid.sort(), ['glass', 'marmor']);
  assert.deepEqual(w.notes, ['maks 180 cm']);
  assert.deepEqual(parseWish('uten skinn, heller fløyel').search, ['fløyel']);
  assert.deepEqual(parseWish('').search, []);
});

test('hverdagstekst gir valg og ønsker per ting', () => {
  const p = parseLife('Jeg jobber hjemmefra og har ofte venner på middag. Har ikke barn. Jeg vil ikke ha rundt bord. Jeg vil ha firkantet. Sofaen bør være grønn.');
  assert.ok(p.life.includes('jobb') && p.life.includes('gjester'));
  assert.ok(!p.life.includes('barn'));
  assert.ok(p.wishes.spisebord.includes('rundt') && p.wishes.spisebord.includes('firkantet'));
  assert.ok(p.wishes.sofa.includes('grønn'));
});

test('hverdag legger til ting', () => {
  const s = newState();
  assert.equal(get(s, 'skrivebord').st, 'off');
  s.life = ['jobb'];
  assert.equal(get(s, 'skrivebord').st, 'need');
});

test('Finn-lenker', () => {
  const s = newState();
  s.area = '0.20061';
  s.autoWish = { sofa: 'sofaen bør være grønn', spisebord: 'ikke rundt bord' };
  const sofa = get(s, 'sofa');
  const u = new URL(finnUrl(sofa, s));
  assert.equal(u.origin + u.pathname, 'https://www.finn.no/recommerce/forsale/search');
  assert.equal(u.searchParams.get('q'), '3-seter sofa grønn');
  assert.equal(u.searchParams.get('category'), '0.78');
  assert.equal(u.searchParams.get('location'), '0.20061');
  assert.equal(u.searchParams.get('price_to'), '3000');
  assert.equal(new URL(finnUrl(sofa, s, 'today')).searchParams.get('published'), '1');
  const free = new URL(finnUrl(sofa, s, 'free'));
  assert.equal(free.searchParams.get('trade_type'), '2');
  assert.equal(free.searchParams.get('price_to'), null);
  assert.equal(searchText(get(s, 'spisebord'), s), 'spisebord');
  assert.equal(new URL(finnUrl(get(s, 'bestikk'), s)).searchParams.get('category'), null);
  s.area = '';
  assert.equal(new URL(finnUrl(sofa, s)).searchParams.get('location'), null);
});

test('valg og stilord i søket', () => {
  const s = newState();
  const key = get(s, 'sofa').key;
  s.items[key] = { picks: { sofatype: 1, farge: 2 }, kw: ['lin'], max: null };
  const sofa = get(s, 'sofa');
  assert.equal(searchText(sofa, s), 'sovesofa grønn lin');
  assert.equal(new URL(finnUrl(sofa, s)).searchParams.get('price_to'), null);
  assert.ok(ikeaUrl(sofa, s).endsWith('q=sovesofa'));
  const bord = get(s, 'spisebord');
  s.items[bord.key] = { picks: { form: 0 }, wish: 'rundt' };
  assert.equal(searchText(get(s, 'spisebord'), s), 'spisebord'); // firkantet valgt: «rundt» skal ikke søkes
});

test('budsjett', () => {
  const s = newState();
  const a = summary(s);
  assert.ok(a.need > 10 && a.low < a.mid && a.mid < a.high);
  assert.equal(a.maxSum, a.mid);
  s.level = 'lav';
  assert.equal(summary(s).maxSum, a.low);
  s.total = 5000;
  const b = summary(s);
  assert.ok(b.over > 0);
  s.items = fitBudget(s);
  const c = summary(s);
  assert.ok(c.maxSum <= 5000 && c.over === 0, String(c.maxSum));
  const sofa = get(s, 'sofa');
  s.items[sofa.key] = { st: 'bought', paid: 1200 };
  assert.equal(summary(s).paid, 1200);
  assert.equal(summary(s).left, 3800);
});

test('nytt-hint', () => {
  const s = newState();
  const lampe = get(s, 'gulvlampe');
  assert.equal(newHint(lampe, s, summary(s)), 'fits'); // 500 kr maks dekker ny til 200
  const sofa = get(s, 'sofa');
  s.items[sofa.key] = { max: 500 };
  assert.equal(newHint(get(s, 'sofa'), s, summary(s)), '');
  for (const i of instances(s)) if (i.st === 'need' && i.itemId !== 'sofa') s.items[i.key] = { st: 'have' };
  assert.equal(newHint(get(s, 'sofa'), s, summary(s)), ''); // 500 kr holder ikke til ny
  s.items[sofa.key] = {};
  assert.equal(newHint(get(s, 'sofa'), s, summary(s)), 'finish');
  s.total = 1000;
  assert.equal(newHint(get(s, 'sofa'), s, summary(s)), 'fits'); // budsjettet rekker ikke ny, men maksprisen gjør
});

test('rom, mål og plantegning', () => {
  assert.equal(sizeFromM2('stue', 12), 'S');
  assert.equal(sizeFromM2('stue', 20), 'M');
  assert.equal(sizeFromM2('stue', 31), 'L');
  for (const h of HOMES) {
    const rooms = roomsFromHome(h.id);
    const plan = layoutPlan(rooms);
    assert.equal(plan.length, rooms.length);
    const area = plan.reduce((a, p) => a + p.w * p.h, 0);
    assert.ok(Math.abs(area - 10000) < 1, `${h.id}: ${area}`);
    plan.forEach((p) => assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 100.01 && p.y + p.h <= 100.01));
  }
  const s = newState();
  s.rooms[0].wall = 240;
  assert.match(wallNote(get(s, 'sofa')), /200 cm/);
});

test('deling og rydding', () => {
  const s = newState();
  s.lifeText = 'æøå «test»';
  s.items[get(s, 'sofa').key] = { st: 'have', wish: 'grønn' };
  const back = decodeState(encodeState(s));
  assert.equal(back.lifeText, s.lifeText);
  assert.equal(get(back, 'sofa').st, 'have');
  assert.equal(decodeState('tull'), null);
  const bad = JSON.parse(JSON.stringify(s));
  bad.rooms[0].m2 = '<img src=x onerror=alert(1)>';
  bad.total = '<b>';
  bad.items['r1:sofa'] = { st: 'x', max: '<i>', kw: ['<script>'], picks: { form: 99 }, paid: 'a' };
  bad.autoWish = { finnesikke: 'x', sofa: 5 };
  const n = normalize(bad);
  assert.equal(n.rooms[0].m2, null);
  assert.equal(n.total, null);
  assert.deepEqual(n.items['r1:sofa'], { kw: [], picks: {} });
  assert.deepEqual(n.autoWish, {});
  assert.equal(maxOf(get(n, 'sofa'), n), 3000);
});

test('egne ting og pynt', async () => {
  const { decorLinks, cleanWish } = await import('../js/logic.js');
  const { STYLES } = await import('../js/data.js');
  STYLES.forEach((s) => assert.ok(s.decor.length >= 4, s.id));
  const s = newState();
  s.custom = [{ id: 'c101', room: 'r1', name: 'Grønn fløyelspuff' }];
  const own = instances(s).find((i) => i.itemId === 'c101');
  assert.equal(own.st, 'need');
  assert.equal(maxOf(own, s), null);
  const u = new URL(finnUrl(own, s));
  assert.equal(u.searchParams.get('q'), 'grønn fløyelspuff');
  assert.equal(u.searchParams.get('price_to'), null);
  assert.equal(summary(s).mid, summary(newState()).mid);
  assert.equal(newHint(own, s, summary(s)), '');
  const back = decodeState(encodeState(s));
  assert.equal(back.custom[0].name, 'Grønn fløyelspuff');
  s.custom.push({ id: 'x', room: 'r1', name: '<b>' }, { id: 'c5', room: 'finnesikke', name: 'a' });
  assert.equal(normalize(JSON.parse(JSON.stringify(s))).custom.length, 1);
  s.style = 'retro'; s.area = '0.20061';
  const d = decorLinks(s, 'today');
  assert.equal(new URL(d[0].url).searchParams.get('q'), 'retro plakat');
  assert.equal(new URL(d[0].url).searchParams.get('published'), '1');
  assert.deepEqual(cleanWish({ search: ['Eik', '<x>', 'hev senk'], avoid: ['rundt'], notes: [5] }), { search: ['eik', 'hev senk'], avoid: ['rundt'], notes: [] });
  s.autoWish = { spisebord: { search: ['eik'], avoid: ['rundt'], notes: ['firkantet'] } };
  assert.equal(searchText(get(s, 'spisebord'), s), 'spisebord eik');
});

test('plantegning: lagring, eldre format og møbel mot vegg', async () => {
  const { placedWall, footprint } = await import('../js/logic.js');
  const s = newState();
  s.floors = ['1. etasje', 'x'];
  s.rooms = [
    { id: 'r101', type: 'stue', size: 'M', m2: 12, wall: 400, floor: 0, poly: [[100, 100], [500, 100], [500, 400], [100, 400]], doors: [{ e: 0, t: 0.1, w: 80, kind: 'door' }, { e: 9, t: 0.5, w: 80 }] },
    { id: 'r102', type: 'soverom', size: 'S', m2: 4, wall: null, g: { x: 2, y: 2, w: 4, h: 4 } },
    { id: 'r103', type: 'bad', size: 'S', m2: 4, wall: null, floor: 7, poly: [[0, 0], ['<x>', 0], [1, 1]] },
  ];
  s.furn = [{ id: 'f1', room: 'r101', item: 'sofa', x: 300, y: 150, w: 210, d: 90, r: 0 }, { id: 'f2', room: 'r103', item: 'sofa', x: 0, y: 0, w: 100, d: 50, r: 0 }, { id: 'bad', room: 'r101', item: 'sofa', x: 0, y: 0, w: 1, d: 1 }];
  s.drawn = true;
  const n = normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(n.floors, ['1. etasje', '2. etasje']);
  assert.equal(n.rooms[0].doors.length, 1);
  assert.deepEqual(n.rooms[1].poly, [[100, 100], [300, 100], [300, 300], [100, 300]]); // gammelt rektangel
  assert.equal(n.rooms[2].poly, undefined);
  assert.equal(n.furn.length, 1);
  assert.equal(n.drawn, true);
  assert.deepEqual(placedWall(n, 'r101', 'sofa'), { e: 0, len: 400, free: 320, letter: 'A' });
  assert.match(wallNote(get(n, 'sofa'), n), /vegg A.*400 cm.*320 cm er fri.*280 cm bred/);
  assert.deepEqual(footprint('sofa', 'M'), [210, 90]);
  assert.deepEqual(footprint('nattbord', 'S'), [45, 40]);
  assert.equal(footprint('gardiner', 'M'), null);
  const back = decodeState(encodeState(n));
  assert.deepEqual(back.rooms[0].poly, n.rooms[0].poly);
});

test('stilbilder finnes', async () => {
  const { STYLES } = await import('../js/data.js');
  const fs = await import('node:fs');
  for (const s of STYLES) {
    assert.equal(s.photos.length, 3); assert.equal(s.traits.length, 3);
    s.photos.forEach((p, i) => { assert.ok(p.alt && p.by && p.url.startsWith('https://unsplash.com/photos/')); assert.ok(fs.existsSync(new URL(`../photos/${s.id}-${i + 1}.webp`, import.meta.url))); });
    assert.ok(fs.existsSync(new URL(`../photos/${s.id}-1s.webp`, import.meta.url)));
  }
});

test('retninger innenfor en stil', async () => {
  const { STYLES } = await import('../js/data.js');
  const { styleWords } = await import('../js/logic.js');
  STYLES.forEach((s) => s.photos.forEach((p) => assert.ok(p.name && p.wood.length && p.soft.length, s.id)));
  const s = newState();
  s.style = 'retro';
  assert.deepEqual(styleWords(get(s, 'sofa'), s), ['retro', 'ull', 'fløyel']);
  s.sub = 2; // 70-talls farger
  assert.deepEqual(styleWords(get(s, 'sofa'), s), ['oransje', 'fløyel', 'retro', 'ull']);
  assert.deepEqual(styleWords(get(s, 'sofabord'), s).slice(0, 2), ['retro', 'glass']);
  assert.deepEqual(styleWords(get(s, 'gulvlampe'), s), ['retro', 'messing']); // lamper følger hovedstilen
  assert.equal(normalize(JSON.parse(JSON.stringify({ ...s, sub: 7 }))).sub, null);
  assert.equal(normalize(JSON.parse(JSON.stringify(s))).sub, 2);
});

test('antall, egen størrelse og hva som er viktigst', async () => {
  const { prioOf, kwOf, comfortFor, withDrawing } = await import('../js/logic.js');
  const s = newState();
  const nb = get(s, 'nattbord'), stoler = get(s, 'spisestoler');
  assert.equal(nb.qty, 2);                   // soverom M: ett på hver side
  assert.equal(stoler.qty, 2);               // lite kjøkken
  const base = summary(s);
  s.items[nb.key] = { qty: 3 };
  assert.equal(summary(s).mid - base.mid, 400);
  assert.equal(summary(s).maxSum - base.maxSum, 400);
  const sofa = get(s, 'sofa');
  s.items[sofa.key] = { size: 'L', maxw: 240 };
  assert.equal(get(s, 'sofa').v.q, 'hjørnesofa');
  assert.equal(maxOf(get(s, 'sofa'), s), 5000);
  assert.match(new URL(finnUrl(get(s, 'sofa'), s)).searchParams.get('q'), /^hjørnesofa/);
  s.style = 'retro'; s.prio = 'stil';
  assert.deepEqual(kwOf(get(s, 'sofa'), s), ['retro']);
  assert.equal(searchText(get(s, 'sofa'), s), 'hjørnesofa retro');
  s.items[sofa.key] = { ...s.items[sofa.key], kw: [] };                 // brukeren fjernet ordet selv
  assert.equal(searchText(get(s, 'sofa'), s), 'hjørnesofa');
  s.items[sofa.key] = { ...s.items[sofa.key], prio: 'komfort' };
  assert.equal(prioOf(get(s, 'sofa'), s), 'komfort');
  assert.ok(comfortFor(get(s, 'sofa'), s).tip);
  assert.equal(comfortFor(get(s, 'nattbord'), s), null);
  const n = normalize(JSON.parse(JSON.stringify({ ...s, items: { ...s.items, [nb.key]: { qty: 99, size: 'X', prio: 'tull', maxw: 9999 } } })));
  assert.deepEqual(n.items[nb.key], {});
  assert.equal(n.prio, 'stil'); assert.equal(n.items[sofa.key].maxw, 240);
  // tegning fra «Velg bolig»
  const d = withDrawing(newState().rooms);
  assert.equal(d.length, 5);
  d.forEach((r) => { assert.equal(r.poly.length, 4); assert.ok(r.m2 >= 1); r.poly.flat().forEach((v) => assert.equal(v % 10, 0)); });
  const total = d.reduce((a, r) => a + r.m2, 0);
  assert.ok(Math.abs(total - 42) <= 4, String(total));
});

test('fem steg, og «har fra før» lest med enkle regler', async () => {
  const { parseOwned } = await import('../js/logic.js');
  const s = newState();
  for (const [given, want] of [[4, 4], [3, 3], [7, 0], [-1, 0], ['2', 0]]) assert.equal(normalize(JSON.parse(JSON.stringify({ ...s, step: given }))).step, want);
  assert.deepEqual(parseOwned('Jeg har seng og sofa fra før. Trenger en lenestol. Vil ikke ha rundt bord.'), { have: ['sofa', 'seng'], need: ['lenestol'] });
  assert.deepEqual(parseOwned('Har tv-benk og sofabord.'), { have: ['sofabord', 'tvbenk'], need: [] });
  assert.deepEqual(parseOwned('Jeg har ikke sofa. Sofaen bør være grønn.'), { have: [], need: [] });
  assert.deepEqual(parseOwned(''), { have: [], need: [] });
});

test('plantegning: dører og vinduer lagres per vegg og overlever lagring', async () => {
  const s = newState();
  s.drawn = true;
  s.rooms = [
    { id: 'r101', type: 'stue', size: 'M', m2: 12, wall: 400, floor: 0, poly: [[100, 100], [500, 100], [500, 400], [100, 400]], doors: [], fixed: [], guess: true },
    { id: 'r102', type: 'soverom', size: 'M', m2: 12, wall: 400, floor: 0, poly: [[500, 100], [900, 100], [900, 400], [500, 400]], doors: [], fixed: [] },
  ];
  s.openings = [
    { id: 'o1', floor: 0, kind: 'door', w: 90, x: 500, y: 250 },          // i veggen mellom rommene
    { id: 'o2', floor: 0, kind: 'window', w: 150.4, x: 300, y: 100 },
    { id: 'o3', floor: 0, kind: 'window', w: 100, x: 300, y: 250 },      // midt i rommet: står ikke i noen vegg
    { id: 'x', floor: 0, kind: 'door', w: 80, x: 300, y: 400 }, { id: 'o4', floor: 3, kind: 'door', w: 80, x: 300, y: 400 }, { id: 'o5', floor: 0, kind: 'door', w: 900, x: 300, y: 400 },
  ];
  const n = normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(n.openings, [{ id: 'o1', floor: 0, kind: 'door', w: 90, x: 500, y: 250 }, { id: 'o2', floor: 0, kind: 'window', w: 150, x: 300, y: 100 }]);
  assert.deepEqual(n.rooms[0].doors, [{ e: 1, t: 0.5, w: 90, kind: 'door', id: 'o1' }, { e: 0, t: 0.5, w: 150, kind: 'window', id: 'o2' }]);
  assert.deepEqual(n.rooms[1].doors, [{ e: 3, t: 0.5, w: 90, kind: 'door', id: 'o1' }]); // samme dør, sett fra naborommet
  assert.equal(n.rooms[0].guess, true);
  assert.equal(n.rooms[1].guess, undefined);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(n))), n);         // det som lagres, leses likt tilbake
  assert.deepEqual(newState().openings, []);
});
