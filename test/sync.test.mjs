import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, instances, normalize, withDrawing, footprint, isCorner, placedWall } from '../js/logic.js';
import { syncFurniture, arrangeRoom, boxOf, boxesOf, armOf, notchFor, turnCorner, flipCorner, localNotch } from '../js/arrange.js';
import { pointInPoly } from '../js/plan.js';

// 2-roms med tegning. Stua er rom r1.
function home() {
  const s = newState();
  s.rooms = withDrawing(s.rooms); s.drawn = true;
  return s;
}
const stue = (s) => s.rooms.find((r) => r.type === 'stue');
const key = (s, id) => instances(s).find((i) => i.itemId === id && i.st !== 'off').key;
// Setter et møbel med ryggen mot den øverste veggen i rommet, midt på.
function onTopWall(room, item, size, extra = {}) {
  const fp = footprint(item, size), xs = room.poly.map((p) => p[0]), y0 = Math.min(...room.poly.map((p) => p[1]));
  return { id: 'f101', room: room.id, item, x: (Math.min(...xs) + Math.max(...xs)) / 2, y: y0 + 5 + fp[1] / 2, w: fp[0], d: fp[1], r: 0, s: size, ...extra };
}
const inside = (room, f) => { const b = boxOf(f); return [[b[0] + 1, b[1] + 1], [b[2] - 1, b[1] + 1], [b[2] - 1, b[3] - 1], [b[0] + 1, b[3] - 1]].every((p) => pointInPoly(p, room.poly)); };

test('ingenting å gjøre: samme liste tilbake, og to ganger gir det samme', () => {
  const s = home();
  assert.equal(syncFurniture(s), s.furn);
  s.furn = [onTopWall(stue(s), 'sofa', 'M')];
  assert.equal(syncFurniture(s), s.furn);
  s.items[key(s, 'sofa')] = { size: 'L' };
  const once = syncFurniture(s);
  assert.notEqual(once, s.furn);
  s.furn = once;
  assert.equal(syncFurniture(s), once);
});

test('størrelse: byttet til hjørnesofa gir en vinkel med riktige mål, med ryggen der den sto', () => {
  const s = home(), room = stue(s);
  const sofa = onTopWall(room, 'sofa', 'M');
  const lamp = { id: 'f102', room: room.id, item: 'gulvlampe', x: sofa.x, y: sofa.y + 250, w: 35, d: 35, r: 0, s: 'M' };
  s.furn = [sofa, lamp];
  s.items[key(s, 'sofa')] = { size: 'L' };
  const out = syncFurniture(s);
  const f = out.find((x) => x.id === 'f101');
  assert.deepEqual([f.w, f.d, f.s, f.corner, f.r], [260, 170, 'L', 'se', 0]);
  assert.equal(f.x, sofa.x);                                  // samme plass langs veggen
  assert.equal(boxOf(f)[1], boxOf(sofa)[1]);                  // ryggen står fortsatt mot veggen
  assert.ok(inside(room, f));
  assert.equal(out.find((x) => x.id === 'f102'), lamp);       // møbler som ikke er endret, er urørt (samme objekt)
  assert.equal(placedWall({ ...s, furn: out }, room.id, 'sofa').letter, 'A');
  // tilbake til 2-seter: vanlig firkant igjen
  s.furn = out; s.items[key(s, 'sofa')] = { size: 'S' };
  const small = syncFurniture(s).find((x) => x.id === 'f101');
  assert.deepEqual([small.w, small.d, small.s, small.corner], [160, 90, 'S', undefined]);
  assert.equal(boxOf(small)[1], boxOf(sofa)[1]);
});

test('størrelse: for stort for plassen skyves langs veggen, og egne mål overstyres bare av et størrelsesvalg', () => {
  const s = home(), room = stue(s);
  const x1 = Math.max(...room.poly.map((p) => p[0]));
  const sofa = { ...onTopWall(room, 'sofa', 'S'), x: x1 - 5 - 80 };    // helt inn i høyre hjørne
  s.furn = [sofa];
  s.items[key(s, 'sofa')] = { size: 'L' };
  const f = syncFurniture(s)[0];
  assert.ok(inside(room, f), JSON.stringify(f));
  assert.ok(f.x < sofa.x);                                             // skjøvet inn i rommet
  // egne mål: blir stående så lenge størrelsen på lista er den samme
  const typed = { ...onTopWall(room, 'sofa', 'L', { corner: 'se' }), w: 300, d: 200 };
  s.furn = [typed];
  assert.equal(syncFurniture(s), s.furn);
  s.items[key(s, 'sofa')] = { size: 'M' };
  const m = syncFurniture(s)[0];
  assert.deepEqual([m.w, m.d, m.corner], [210, 90, undefined]);
  // seng: 150 -> 180
  const bedRoom = s.rooms.find((r) => r.type === 'soverom');
  s.furn = [{ ...onTopWall(bedRoom, 'seng', 'M'), id: 'f7' }];
  s.items[key(s, 'seng')] = { size: 'L' };
  const bed = syncFurniture(s)[0];
  assert.deepEqual([bed.w, bed.d, bed.s], [180, 200, 'L']);
});

test('eldre møbler uten størrelsesmerke leses av målene', () => {
  const s = home(), room = stue(s);
  const { s: _drop, ...legacy } = onTopWall(room, 'sofa', 'M');
  s.furn = [legacy];
  const marked = syncFurniture(s)[0];
  assert.deepEqual([marked.w, marked.d, marked.s], [210, 90, 'M']);      // bare merket, ikke endret
  s.items[key(s, 'sofa')] = { size: 'L' };                               // brukerens tilfelle: lista sa hjørnesofa, tegningen sto igjen
  s.furn = [legacy];
  const fixed = syncFurniture(s)[0];
  assert.deepEqual([fixed.w, fixed.d, fixed.corner], [260, 170, 'se']);
  s.furn = [{ ...legacy, w: 260, d: 100 }];                              // gammel «hjørnesofa» tegnet som firkant
  const old = syncFurniture(s)[0];
  assert.deepEqual([old.w, old.d, old.corner, old.s], [260, 170, 'se', 'L']);
  s.furn = [{ ...legacy, w: 233, d: 88 }];                               // egne mål uten merke: røres ikke
  const own = syncFurniture(s)[0];
  assert.deepEqual([own.w, own.d, own.s], [233, 88, 'L']);
});

test('antall: de sist utsatte tas bort når antallet går ned, og ingenting settes ut når det går opp', () => {
  const s = home(), room = s.rooms.find((r) => r.type === 'soverom');
  const nb = (id, x) => ({ id, room: room.id, item: 'nattbord', x, y: room.poly[0][1] + 30, w: 45, d: 40, r: 0, s: 'M' });
  s.furn = [nb('f12', room.poly[0][0] + 200), nb('f3', room.poly[0][0] + 40), nb('f20', room.poly[0][0] + 120)];
  assert.equal(syncFurniture(s).length, 2);                                // lista sier 2
  assert.deepEqual(syncFurniture(s).map((f) => f.id), ['f12', 'f3']);      // f20 ble satt ut sist
  s.items[key(s, 'nattbord')] = { qty: 1 };
  assert.deepEqual(syncFurniture(s).map((f) => f.id), ['f3']);
  s.furn = syncFurniture(s);
  s.items[key(s, 'nattbord')] = { qty: 4 };
  assert.equal(syncFurniture(s), s.furn);
});

test('tatt bort fra lista: møbelet forsvinner fra tegningen, kjøpt blir stående', () => {
  const s = home(), room = stue(s);
  const sofa = onTopWall(room, 'sofa', 'M');
  const tv = { id: 'f102', room: room.id, item: 'tvbenk', x: sofa.x, y: sofa.y + 300, w: 150, d: 40, r: 0, s: 'M' };
  s.furn = [sofa, tv];
  s.items[key(s, 'sofa')] = { st: 'have' };                               // haken fjernet
  assert.deepEqual(syncFurniture(s), [tv]);
  s.items[key(s, 'sofa')] = { st: 'bought', paid: 1200 };
  assert.equal(syncFurniture(s), s.furn);
  const lene = instances(s).find((i) => i.itemId === 'lenestol' && i.room.id === room.id);
  s.items[lene.key] = { st: 'need' };
  s.furn = [...s.furn, { id: 'f103', room: room.id, item: 'lenestol', x: sofa.x + 200, y: sofa.y, w: 80, d: 80, r: 0, s: 'M' }];
  assert.equal(syncFurniture(s).length, 3);
  s.items[lene.key] = { st: 'off' };                                       // ekstra ting tatt bort igjen
  assert.equal(syncFurniture(s).length, 2);
  for (const i of instances(s)) if (i.st === 'need') s.items[i.key] = { st: 'have' };   // «Fjern alle haker»
  assert.deepEqual(syncFurniture(s).map((f) => f.item), ['sofa']);         // bare den kjøpte står igjen
  s.rooms = s.rooms.filter((r) => r.id !== room.id);                       // rommet er borte
  assert.deepEqual(syncFurniture(s), []);
});

test('hjørnesofa: armer, snu og speilvende', () => {
  const f = { x: 300, y: 200, w: 260, d: 170, r: 0, corner: 'se' };
  assert.equal(armOf(f), 95);
  assert.deepEqual(boxesOf(f), [[170, 115, 430, 210], [170, 115, 265, 285]]);        // rygg langs nord, arm langs vest
  assert.deepEqual(boxesOf({ ...f, corner: 'nw' }), [[170, 190, 430, 285], [335, 115, 430, 285]]);
  assert.deepEqual(boxesOf({ ...f, corner: undefined }), [boxOf(f)]);
  assert.equal(notchFor([0, 1]), 'se'); assert.equal(notchFor([0, -1]), 'ne'); assert.equal(notchFor([1, 0]), 'se'); assert.equal(notchFor([-1, 0]), 'sw');
  let c = 'se'; const seen = [];
  for (let i = 0; i < 4; i++) { c = turnCorner(c); seen.push(c); }
  assert.deepEqual(seen, ['sw', 'nw', 'ne', 'se']);
  assert.equal(flipCorner(f), 'sw');                                     // ryggen fortsatt mot nord
  assert.equal(flipCorner({ ...f, r: 90 }), 'ne');                       // ryggen fortsatt mot vest
  assert.equal(localNotch(f), 'se');
  assert.equal(localNotch({ ...f, r: 90 }), 'ne');
  assert.ok(isCorner('sofa', 'L')); assert.ok(!isCorner('sofa', 'M')); assert.ok(!isCorner('seng', 'L'));
  assert.deepEqual(footprint('sofa', 'L'), [260, 170]);
});

test('«Sett ut alt for meg» med hjørnesofa: ryggen mot veggen, vinkelen ut i rommet, bordet inne i vinkelen', () => {
  const rooms = [
    [[0, 0], [520, 0], [520, 420], [0, 420]],
    [[0, 0], [700, 0], [700, 300], [400, 300], [400, 600], [0, 600]],
  ];
  for (const poly of rooms) {
    const wants = [
      { item: 'sofa', w: 260, d: 170, qty: 1, s: 'L', corner: true }, { item: 'sofabord', w: 100, d: 60, qty: 1, s: 'M' },
      { item: 'tvbenk', w: 150, d: 40, qty: 1, s: 'M' }, { item: 'teppe', w: 230, d: 160, qty: 1, s: 'M' },
    ];
    const res = arrangeRoom({ poly, doors: [{ e: 2, t: 0.9, w: 80, kind: 'door' }] }, wants, []);
    const sofa = res.placed.find((f) => f.item === 'sofa'), bord = res.placed.find((f) => f.item === 'sofabord');
    assert.ok(sofa && sofa.corner && sofa.s === 'L', JSON.stringify(res));
    assert.ok(bord, JSON.stringify(res));
    const bb = boxOf(bord);
    for (const arm of boxesOf(sofa)) assert.ok(!(bb[0] < arm[2] && bb[2] > arm[0] && bb[1] < arm[3] && bb[3] > arm[1]), 'bordet står ikke oppå sofaen');
    const sb = boxOf(sofa);
    assert.ok(bb[0] >= sb[0] - 1 && bb[2] <= sb[2] + 61 && bb[1] >= sb[1] - 61 && bb[3] <= sb[3] + 61, 'bordet står ved sofaen');
    for (const f of res.placed) { const b = boxOf(f); assert.ok(pointInPoly([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], poly)); }
    assert.ok(res.placed.some((f) => f.item === 'tvbenk'));
  }
  // allerede utsatt hjørnesofa: annet settes ikke i veien for armene, men kan stå i det åpne hjørnet
  const poly = rooms[0];
  const sofa = { item: 'sofa', x: 135, y: 90, w: 260, d: 170, r: 0, corner: 'se', s: 'L' };
  const res = arrangeRoom({ poly, doors: [] }, [{ item: 'sofabord', w: 100, d: 60, qty: 1 }], [sofa]);
  assert.equal(res.placed.length, 1);
});

test('lagring: størrelsesmerke og åpent hjørne tas vare på og ryddes', () => {
  const s = home(), room = stue(s);
  s.furn = [{ ...onTopWall(room, 'sofa', 'L'), corner: 'sw' }, { ...onTopWall(room, 'tvbenk', 'M'), id: 'f102', s: 'XL', corner: '<x>' }];
  const n = normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual([n.furn[0].s, n.furn[0].corner], ['L', 'sw']);
  assert.deepEqual([n.furn[1].s, n.furn[1].corner], [undefined, undefined]);
});
