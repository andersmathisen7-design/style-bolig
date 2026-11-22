import test from 'node:test';
import assert from 'node:assert/strict';
import { straighten, straightenLine, isLine, splitPoly, moveWall, moveCorner, dragAlong, setEdgeLength, valid, remapDoors, canonical, areaM2, area, edges, opening } from '../js/plan.js';

function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
// En håndtegnet strek gjennom punktene, med skjelving og en liten krok i hver ende.
function scribble(points, seed, { jitter = 8, spacing = 14, hook = 12 } = {}) {
  const r = rng(seed), out = [];
  const first = points[0], last = points[points.length - 1];
  for (let k = 3; k >= 1; k--) out.push([first[0] + (r() - 0.5) * hook, first[1] + (r() - 0.5) * hook]);
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (spacing * (0.6 + r() * 0.8))));
    for (let k = 0; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n + (r() - 0.5) * 2 * jitter, a[1] + ((b[1] - a[1]) * k) / n + (r() - 0.5) * 2 * jitter]);
  }
  for (let k = 1; k <= 3; k++) out.push([last[0] + (r() - 0.5) * hook, last[1] + (r() - 0.5) * hook]);
  return out;
}
const rect = [[100, 100], [700, 100], [700, 500], [100, 500]];
const L = [[100, 100], [700, 100], [700, 350], [420, 350], [420, 620], [100, 620]];
const same = (a, b) => assert.deepEqual(canonical(a), canonical(b));

test('en strek er en linje, en runde er et rom', () => {
  assert.ok(isLine(scribble([[400, 60], [400, 540]], 1)));
  assert.ok(isLine(scribble([[60, 300], [400, 300], [400, 540]], 2)));
  assert.ok(!isLine(scribble([...rect, rect[0]], 3)));
  assert.ok(!isLine(scribble([[100, 100], [700, 100], [700, 500], [100, 500]], 4))); // tre vegger er fortsatt et rom
});

test('skjelven strek blir rett linje', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const v = straightenLine(scribble([[395 + (seed % 7), 70], [405, 530]], seed), 40);
    assert.ok(v && v.length === 2 && v[0][0] === v[1][0] && Math.abs(v[0][0] - 400) <= 20, `seed ${seed}: ${JSON.stringify(v)}`);
    const h = straightenLine(scribble([[60, 300], [740, 310]], seed), 40);
    assert.ok(h && h.length === 2 && h[0][1] === h[1][1] && Math.abs(h[0][1] - 305) <= 20, `seed ${seed}: ${JSON.stringify(h)}`);
    const bent = straightenLine(scribble([[60, 300], [400, 300], [400, 540]], seed), 40);
    assert.ok(bent && bent.length === 3 && bent[0][1] === bent[1][1] && bent[1][0] === bent[2][0], `seed ${seed}: ${JSON.stringify(bent)}`);
  }
  assert.equal(straightenLine([[0, 0], [5, 5], [10, 0]], 40), null);
});

test('dele en firkant med en strek', () => {
  const [a, b] = splitPoly(rect, [[400, 60], [400, 540]]);   // streken går litt utenfor veggene
  same(a.length === 4 && a.some((p) => p[0] === 700) ? a : b, [[400, 100], [700, 100], [700, 500], [400, 500]]);
  same(a.some((p) => p[0] === 100) ? a : b, [[100, 100], [400, 100], [400, 500], [100, 500]]);
  const short = splitPoly(rect, [[150, 300], [600, 300]]);   // streken stopper før veggene: forlenges
  assert.ok(short); assert.equal(area(short[0]) + area(short[1]), area(rect));
  short.forEach((p) => assert.equal(p.length, 4));
  assert.equal(splitPoly(rect, [[800, 100], [900, 500]]), null);   // utenfor rommet
  assert.equal(splitPoly(rect, [[105, 60], [105, 540]]), null);    // for tynn bit
});

test('dele med knekt strek og dele vinkelrom', () => {
  const parts = splitPoly(rect, [[60, 300], [400, 300], [400, 540]]); // skjærer ut nedre venstre hjørne
  assert.ok(parts);
  const small = parts.find((p) => p.length === 4), big = parts.find((p) => p.length === 6);
  same(small, [[100, 300], [400, 300], [400, 500], [100, 500]]);
  assert.equal(area(big) + area(small), area(rect));
  const [x, y] = splitPoly(L, [[60, 350], [450, 350]]);              // deler L-en der den knekker
  assert.equal(area(x) + area(y), area(L));
  assert.deepEqual([x.length, y.length].sort(), [4, 4]);
  const diag = splitPoly(rect, [[100, 300], [400, 100]]);            // skrå strek gir skråvegg
  assert.ok(diag); assert.equal(Math.round(area(diag[0]) + area(diag[1])), area(rect));
  assert.deepEqual([diag[0].length, diag[1].length].sort(), [3, 5]);
});

test('hele veien: tegn strek med finger og del rommet', () => {
  let bad = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const x = 250 + (seed * 13) % 300;
    const line = straightenLine(scribble([[x, 70 + (seed % 60)], [x + (seed % 9) - 4, 520 - (seed % 50)]], seed), 45);
    const parts = line && splitPoly(rect, line);
    if (!(parts && parts.every((p) => p.length === 4) && area(parts[0]) + area(parts[1]) === area(rect) && parts.some((p) => p.some((q) => Math.abs(q[0] - x) <= 20)))) bad++;
  }
  assert.equal(bad, 0);
});

test('flytte vegg og hjørne', () => {
  assert.deepEqual(moveWall(rect, 0, 55, -44), [[100, 60], [700, 60], [700, 500], [100, 500]]);   // øverste vegg opp
  assert.deepEqual(moveWall(rect, 1, 104, 30), [[100, 100], [800, 100], [800, 500], [100, 500]]); // høyre vegg ut
  assert.deepEqual(moveCorner(rect, 2, 50, 100), [[100, 100], [750, 100], [750, 600], [100, 600]]); // nedre høyre hjørne
  const tri = [[100, 100], [500, 100], [100, 400]];
  assert.deepEqual(moveCorner(tri, 1, 100, 0), [[100, 100], [600, 100], [100, 400]]);             // skrå nabo følger ikke med
  const l2 = moveCorner(L, 3, -100, 50);                                                            // innerhjørnet i L-en
  assert.deepEqual(l2, [[100, 100], [700, 100], [700, 400], [320, 400], [320, 620], [100, 620]]);
  assert.ok(valid(l2)); edges(l2).forEach((e) => assert.ok(e.a[0] === e.b[0] || e.a[1] === e.b[1]));
  assert.equal(valid(moveWall(rect, 0, 0, 395)), null);          // rommet blir for tynt
  assert.equal(valid(moveCorner(rect, 0, 600, 400)), null);      // klemt helt sammen
});

test('dører følger med når rommet endres', () => {
  const doors = [{ e: 0, t: 0.25, w: 80, kind: 'door' }, { e: 2, t: 0.5, w: 120, kind: 'window' }];
  const wide = moveWall(rect, 1, 200, 0);
  const d2 = remapDoors(rect, doors, wide);
  assert.equal(d2.length, 2);
  assert.deepEqual(opening(wide, d2[0]).p, opening(rect, doors[0]).p);
  const [a, b] = splitPoly(rect, [[400, 60], [400, 540]]);
  const left = a.some((p) => p[0] === 100) ? a : b, right = left === a ? b : a;
  assert.equal(remapDoors(rect, [doors[0]], canonical(left)).length, 1);   // døra på x=250 havner i venstre del
  assert.equal(remapDoors(rect, [doors[0]], canonical(right)).length, 0);
  assert.equal(remapDoors(rect, [{ e: 0, t: 0.5, w: 500, kind: 'window' }], canonical(left)).length, 0); // for bredt for den nye veggen
});

test('T- og U-formede boliger', () => {
  const T = [[100, 100], [800, 100], [800, 300], [550, 300], [550, 650], [350, 650], [350, 300], [100, 300]];
  const U = [[100, 100], [300, 100], [300, 450], [600, 450], [600, 100], [800, 100], [800, 650], [100, 650]];
  const finger = (corners, seed) => scribble([...corners, corners[0], [corners[0][0] + 40, corners[0][1]]], seed, { jitter: 9, spacing: 16, hook: 14 });
  for (const [name, shape] of [['T', T], ['U', U]]) {
    let ok = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const start = seed % shape.length;
      const rot = [...shape.slice(start), ...shape.slice(0, start)];
      const p = straighten(finger(seed % 2 ? rot : [...rot].reverse(), seed), 40);
      if (p && p.length === 8 && Math.abs(areaM2(p) - areaM2(shape)) < 4 && edges(p).every((e) => e.a[0] === e.b[0] || e.a[1] === e.b[1])) ok++;
    }
    assert.ok(ok >= 97, `${name}: ${ok} av 100`);
  }
});

test('veggen til naborommet følger med', () => {
  const left = [[100, 100], [500, 100], [500, 700], [100, 700]];
  const top = [[500, 100], [900, 100], [900, 400], [500, 400]], bottom = [[500, 400], [900, 400], [900, 700], [500, 700]];
  const far = [[1000, 100], [1200, 100], [1200, 300], [1000, 300]];
  const moved = moveWall(left, 1, 50, 0);                         // høyre vegg i venstre rom ut 50 cm
  assert.deepEqual(dragAlong(left, moved, top), [[550, 100], [900, 100], [900, 400], [550, 400]]);
  assert.deepEqual(dragAlong(left, moved, bottom), [[550, 400], [900, 400], [900, 700], [550, 700]]);
  assert.equal(dragAlong(left, moved, far), far);                 // ligger ikke inntil
  const longer = setEdgeLength(left, 0, 450);                     // vegg A satt til 4,5 m: samme vegg flytter seg
  assert.deepEqual(dragAlong(left, longer, top), [[550, 100], [900, 100], [900, 400], [550, 400]]);
  const squeezed = moveWall(left, 1, 395, 0);                     // naborommet ville blitt 5 cm bredt: da står det i ro
  assert.equal(dragAlong(left, squeezed, top), top);
  const corner = [[100, 700], [500, 700], [500, 900], [100, 900]];  // berører bare i ett hjørne
  assert.equal(dragAlong(top, moveWall([[500, 100], [900, 100], [900, 700], [500, 700]], 2, 0, 100), corner), corner);
  const up = moveWall(top, 2, 0, 60);                             // skilleveggen mellom øvre og nedre rom
  assert.deepEqual(dragAlong(top, up, bottom), [[500, 460], [900, 460], [900, 700], [500, 700]]);
});
