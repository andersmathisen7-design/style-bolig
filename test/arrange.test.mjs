import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeRoom, boxOf } from '../js/arrange.js';
import { pointInPoly, opening } from '../js/plan.js';

const rect = (w, h, x = 100, y = 100) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const by = (res, id) => res.placed.filter((f) => f.item === id);

// Alt som er satt ut skal ligge inne i rommet, ikke stå i veien for dører, og ikke overlappe (tepper kan ligge under).
function check(room, res, existing = []) {
  const all = [...existing, ...res.placed];
  for (const f of res.placed) {
    const b = boxOf(f);
    for (const p of [[b[0] + 2, b[1] + 2], [b[2] - 2, b[1] + 2], [b[2] - 2, b[3] - 2], [b[0] + 2, b[3] - 2], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]]) assert.ok(pointInPoly(p, room.poly), `${f.item} stikker utenfor: ${JSON.stringify(f)}`);
    for (const [x, y] of room.poly) assert.ok(!(x > b[0] + 1 && x < b[2] - 1 && y > b[1] + 1 && y < b[3] - 1), `${f.item} dekker et hjørne i rommet`);
    for (const d of (room.doors || []).filter((o) => o.kind !== 'window')) {
      const o = opening(room.poly, d), w = o.half * 2;
      const zone = [Math.min(o.p[0] - o.half, o.p[0] - o.half + o.n[0] * w), Math.min(o.p[1] - o.half, o.p[1] - o.half + o.n[1] * w), Math.max(o.p[0] + o.half, o.p[0] + o.half + o.n[0] * w), Math.max(o.p[1] + o.half, o.p[1] + o.half + o.n[1] * w)];
      const z = o.u[0] ? [o.p[0] - o.half, Math.min(o.p[1], o.p[1] + o.n[1] * w), o.p[0] + o.half, Math.max(o.p[1], o.p[1] + o.n[1] * w)] : [Math.min(o.p[0], o.p[0] + o.n[0] * w), o.p[1] - o.half, Math.max(o.p[0], o.p[0] + o.n[0] * w), o.p[1] + o.half];
      assert.ok(!overlap(b, z), `${f.item} står i veien for en dør: ${JSON.stringify(f)} ${JSON.stringify(zone)}`);
    }
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    if (all[i].item === 'teppe' || all[j].item === 'teppe') continue;
    assert.ok(!overlap(boxOf(all[i]), boxOf(all[j])), `${all[i].item} og ${all[j].item} overlapper`);
  }
}
const stue = [
  { item: 'sofa', w: 210, d: 90, qty: 1 }, { item: 'sofabord', w: 100, d: 60, qty: 1 }, { item: 'tvbenk', w: 150, d: 40, qty: 1 },
  { item: 'teppe', w: 230, d: 160, qty: 1 }, { item: 'gulvlampe', w: 35, d: 35, qty: 1 }, { item: 'bokhylle', w: 80, d: 30, qty: 1 }, { item: 'lenestol', w: 80, d: 80, qty: 1 },
];
const soverom = [{ item: 'seng', w: 160, d: 200, qty: 1 }, { item: 'nattbord', w: 45, d: 40, qty: 2 }, { item: 'garderobe', w: 150, d: 60, qty: 1 }, { item: 'kommode', w: 80, d: 45, qty: 1 }];

test('stue: sofa mot den lengste ledige veggen, TV rett overfor, bord foran', () => {
  const room = { poly: rect(500, 400), doors: [{ e: 0, t: 0.15, w: 80, kind: 'door' }, { e: 2, t: 0.5, w: 120, kind: 'window' }] };
  const res = arrangeRoom(room, stue);
  check(room, res);
  const sofa = by(res, 'sofa')[0], tv = by(res, 'tvbenk')[0], bord = by(res, 'sofabord')[0], rug = by(res, 'teppe')[0];
  assert.ok(sofa && tv && bord && rug, JSON.stringify(res));
  assert.equal(sofa.r, tv.r);
  if (sofa.r === 0) { assert.ok(Math.abs(sofa.x - tv.x) <= 60); assert.ok(Math.abs(sofa.y - tv.y) > 200); assert.equal(bord.x, sofa.x); assert.ok(Math.abs(bord.y - sofa.y) < 130); }
  else { assert.ok(Math.abs(sofa.y - tv.y) <= 60); assert.ok(Math.abs(sofa.x - tv.x) > 200); assert.equal(bord.y, sofa.y); }
  assert.ok(Math.abs(rug.x - bord.x) <= 1 && Math.abs(rug.y - bord.y) <= 1); // teppet ligger under bordet
  assert.deepEqual(res.skipped, []);
  // sofaen står helt inntil en vegg
  const b = boxOf(sofa);
  assert.ok([b[0] - 100, b[1] - 100, 600 - b[2], 500 - b[3]].some((g) => g <= 6));
});

test('soverom: seng med hodeenden mot veggen og nattbord på hver side', () => {
  const room = { poly: rect(360, 300), doors: [{ e: 3, t: 0.2, w: 80, kind: 'door' }] };
  const res = arrangeRoom(room, soverom);
  check(room, res);
  const bed = by(res, 'seng')[0], nb = by(res, 'nattbord');
  assert.ok(bed, JSON.stringify(res));
  assert.equal(nb.length, 2);
  const along = bed.r === 0 ? 'x' : 'y';
  const sides = nb.map((n) => Math.sign(n[along] - bed[along]));
  assert.deepEqual(sides.sort(), [-1, 1]);
  nb.forEach((n) => assert.ok(Math.abs(Math.abs(n[along] - bed[along]) - (160 / 2 + 45 / 2 + 5)) <= 1));
  assert.ok(by(res, 'garderobe').length === 1);
});

test('vinkelrom: ingenting havner i hakket eller utenfor', () => {
  const room = { poly: [[100, 100], [700, 100], [700, 350], [420, 350], [420, 620], [100, 620]], doors: [{ e: 5, t: 0.5, w: 80, kind: 'door' }, { e: 1, t: 0.5, w: 100, kind: 'window' }] };
  const res = arrangeRoom(room, [...stue, { item: 'spisebord', w: 150, d: 90, qty: 1 }]);
  check(room, res);
  assert.ok(by(res, 'sofa').length === 1 && by(res, 'tvbenk').length === 1, JSON.stringify(res));
  assert.ok(by(res, 'spisebord').length === 1, JSON.stringify(res.skipped));
  const high = by(res, 'bokhylle')[0];
  if (high) { const b = boxOf(high); assert.ok(!(b[2] > 640 && b[1] < 285 && b[3] > 165), 'bokhylla står foran vinduet'); }
});

test('kjøkken: spisebord midt i rommet med plass rundt', () => {
  const room = { poly: rect(300, 340), doors: [{ e: 0, t: 0.5, w: 80, kind: 'door' }] };
  const res = arrangeRoom(room, [{ item: 'spisebord', w: 100, d: 70, qty: 1 }, { item: 'kjokkentralle', w: 60, d: 40, qty: 1 }]);
  check(room, res);
  const bord = by(res, 'spisebord')[0];
  assert.ok(bord);
  assert.ok(Math.abs(bord.x - 250) <= 60 && Math.abs(bord.y - 270) <= 90, JSON.stringify(bord));
});

test('for lite rom: heller utelatt enn dårlig plassert', () => {
  const room = { poly: rect(180, 200), doors: [{ e: 0, t: 0.5, w: 80, kind: 'door' }] };
  const res = arrangeRoom(room, soverom);
  check(room, res);
  assert.ok(res.skipped.includes('garderobe') || res.skipped.includes('seng'), JSON.stringify(res));
  assert.equal(res.placed.length + res.skipped.length >= 2, true);
});

test('det som alt står der blir stående, og nye ting tilpasser seg', () => {
  const room = { poly: rect(500, 400), doors: [] };
  const mine = [{ item: 'sofa', x: 350, y: 150, w: 210, d: 90, r: 0 }]; // brukeren har satt sofaen mot den øverste veggen
  const res = arrangeRoom(room, stue.map((w) => (w.item === 'sofa' ? { ...w, qty: 0 } : w)), mine);
  check(room, res, mine);
  assert.equal(by(res, 'sofa').length, 0);
  const tv = by(res, 'tvbenk')[0], bord = by(res, 'sofabord')[0];
  assert.ok(tv && tv.r === 0 && Math.abs(tv.x - 350) <= 1 && tv.y > 400, JSON.stringify(tv));
  assert.ok(bord && bord.x === 350 && bord.y > 150, JSON.stringify(bord));
});

test('mange tilfeldige rom og dører: aldri utenfor, aldri oppå hverandre', () => {
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 300; i++) {
    const w = 200 + Math.round(r() * 50) * 10, h = 200 + Math.round(r() * 40) * 10;
    const poly = r() < 0.4 ? [[100, 100], [100 + w, 100], [100 + w, 100 + Math.round(h * 0.5 / 10) * 10], [100 + Math.round(w * 0.6 / 10) * 10, 100 + Math.round(h * 0.5 / 10) * 10], [100 + Math.round(w * 0.6 / 10) * 10, 100 + h], [100, 100 + h]] : rect(w, h);
    const doors = Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ e: Math.floor(r() * poly.length), t: 0.1 + r() * 0.8, w: 80, kind: r() < 0.7 ? 'door' : 'window' }));
    const room = { poly, doors };
    const res = arrangeRoom(room, r() < 0.5 ? stue : soverom);
    check(room, res);
  }
});
