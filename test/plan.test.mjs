import test from 'node:test';
import assert from 'node:assert/strict';
import { straighten, area, areaM2, edges, setEdgeLength, nearestEdge, labelPoint, pointInPoly, opening, wallFor, moved } from '../js/plan.js';

// Lager en skjelven håndtegnet strek langs hjørnene, med støy og mange punkter.
function wobbly(corners, { noise = 12, step = 15, close = true, seed = 1 } = {}) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * 2 * noise; };
  const pts = [];
  const list = close ? [...corners, corners[0]] : corners;
  for (let i = 0; i < list.length - 1; i++) {
    const [a, b] = [list[i], list[i + 1]];
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n + rnd(), a[1] + ((b[1] - a[1]) * k) / n + rnd()]);
  }
  return pts;
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

test('skjelven firkant blir rett firkant', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const p = straighten(wobbly([[100, 100], [520, 110], [510, 400], [95, 390]], { seed }));
    assert.equal(p.length, 4, `seed ${seed}: ${JSON.stringify(p)}`);
    edges(p).forEach((e) => assert.ok(e.a[0] === e.b[0] || e.a[1] === e.b[1], 'rette vinkler'));
    p.flat().forEach((v) => assert.equal(v % 10, 0));
    assert.ok(near(areaM2(p), 12, 1.2), String(areaM2(p)));
  }
});

test('start midt på en vegg og litt overlapp på slutten', () => {
  const p = straighten(wobbly([[300, 100], [500, 100], [500, 400], [100, 400], [100, 100], [340, 105]], { close: false, seed: 7 }));
  assert.equal(p.length, 4, JSON.stringify(p));
});

test('åpen strek lukkes av seg selv', () => {
  const p = straighten(wobbly([[100, 100], [500, 100], [500, 400], [100, 400]], { close: false, seed: 3 }));
  assert.equal(p.length, 4, JSON.stringify(p));
});

test('L-formet rom får seks hjørner', () => {
  for (const seed of [1, 2, 3]) {
    const p = straighten(wobbly([[100, 100], [600, 100], [600, 300], [350, 300], [350, 500], [100, 500]], { seed }));
    assert.equal(p.length, 6, `seed ${seed}: ${JSON.stringify(p)}`);
    edges(p).forEach((e) => assert.ok(e.a[0] === e.b[0] || e.a[1] === e.b[1]));
    assert.ok(near(areaM2(p), 15, 1.5), String(areaM2(p)));
  }
});

test('skrå vegg beholdes', () => {
  const p = straighten(wobbly([[100, 100], [500, 100], [500, 300], [300, 500], [100, 500]], { seed: 2 }));
  assert.equal(p.length, 5, JSON.stringify(p));
  assert.equal(edges(p).filter((e) => e.a[0] !== e.b[0] && e.a[1] !== e.b[1]).length, 1);
});

test('for små streker gir ikke rom', () => {
  assert.equal(straighten([[0, 0], [10, 0], [10, 10], [0, 10]]), null);
  assert.equal(straighten(wobbly([[100, 100], [160, 100], [160, 150], [100, 150]], { noise: 3 })), null);
  assert.equal(straighten(null), null);
});

test('sette lengde på en vegg', () => {
  const rect = [[100, 100], [500, 100], [500, 400], [100, 400]];
  const wider = setEdgeLength(rect, 0, 620);
  assert.deepEqual(wider, [[100, 100], [720, 100], [720, 400], [100, 400]]);
  const taller = setEdgeLength(rect, 1, 250);
  assert.deepEqual(taller, [[100, 100], [500, 100], [500, 350], [100, 350]]);
  const last = setEdgeLength(rect, 3, 200); // veggen fra siste hjørne tilbake til første
  assert.equal(Math.round(edges(last)[3].len), 200);
  edges(last).forEach((e) => assert.ok(e.a[0] === e.b[0] || e.a[1] === e.b[1]));
  const L = [[100, 100], [600, 100], [600, 300], [350, 300], [350, 500], [100, 500]];
  const L2 = setEdgeLength(L, 0, 700);
  assert.equal(edges(L2)[0].len, 700);
  assert.equal(L2.length, 6);
  edges(L2).forEach((e) => assert.ok(e.a[0] === e.b[0] || e.a[1] === e.b[1]));
  assert.deepEqual(setEdgeLength(rect, 0, 400), rect);
  // fra starten: venstre vegg flyttes i stedet for høyre
  assert.deepEqual(setEdgeLength(rect, 0, 620, true), [[-120, 100], [500, 100], [500, 400], [-120, 400]]);
  const L3 = setEdgeLength(L, 2, 400, true); // vegg C i vinkelrommet, uten å røre vegg E
  assert.equal(Math.round(edges(L3)[2].len), 400); assert.equal(edges(L3)[4].len, edges(L)[4].len);
  edges(L3).forEach((e) => assert.ok(e.a[0] === e.b[0] || e.a[1] === e.b[1]));
});

test('nærmeste vegg, punkt i rom og navnepunkt', () => {
  const L = [[100, 100], [600, 100], [600, 300], [350, 300], [350, 500], [100, 500]];
  const e = nearestEdge(L, [300, 110]);
  assert.equal(e.i, 0); assert.ok(near(e.t, 0.4, 0.01)); assert.equal(Math.round(e.d), 10);
  assert.ok(pointInPoly([200, 400], L)); assert.ok(!pointInPoly([500, 400], L));
  assert.ok(pointInPoly(labelPoint(L), L));
  const U = [[0, 0], [600, 0], [600, 400], [450, 400], [450, 150], [150, 150], [150, 400], [0, 400]];
  assert.ok(pointInPoly(labelPoint(U), U));
  assert.deepEqual(moved([[0, 0], [100, 0], [100, 100]], 24, -6), [[20, -10], [120, -10], [120, 90]]);
  assert.equal(area([[0, 0], [100, 0], [100, 100], [0, 100]]), 10000);
});

test('dør peker inn i rommet, og møbel finner veggen sin', () => {
  const rect = [[100, 100], [500, 100], [500, 400], [100, 400]];
  const d = opening(rect, { e: 0, t: 0.5, w: 80 });
  assert.deepEqual(d.p, [300, 100]); assert.deepEqual(d.n, [0, 1]); assert.equal(d.half, 40);
  const edge = opening(rect, { e: 0, t: 0, w: 80 });
  assert.deepEqual(edge.p, [140, 100]); // holdes innenfor veggen
  const sofa = { x: 300, y: 150, w: 210, d: 90, r: 0 };
  assert.deepEqual(wallFor(rect, [{ e: 0, t: 0.1, w: 80, kind: 'door' }, { e: 0, t: 0.8, w: 100, kind: 'window' }], sofa), { e: 0, len: 400, free: 320 });
  assert.equal(wallFor(rect, [], { x: 300, y: 250, w: 210, d: 90, r: 0 }), null); // midt i rommet
  const side = wallFor(rect, [], { x: 150, y: 250, w: 210, d: 90, r: 90 });
  assert.equal(side.e, 3); assert.equal(side.len, 300);
});
