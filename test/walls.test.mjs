import test from 'node:test';
import assert from 'node:assert/strict';
import { area, valid, pointInPoly } from '../js/plan.js';
import { coverage, holes, planEdit, planLength, splitAlong, groupOf, neighbourAt, hostsOf, placeOn, syncDoors, openingsFromDoors, applyPlan } from '../js/walls.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const RECT = rect(100, 100, 900, 700);
const LSHAPE = [[100, 100], [900, 100], [900, 500], [500, 500], [500, 900], [100, 900]];

// Deler rommene med en rett strek og gir de nye rommene, slik tegningen gjør det.
let seq = 1;
function cut(rooms, line) {
  const found = splitAlong(rooms, line);
  const out = rooms.map((r) => ({ ...r }));
  for (const f of found) {
    out.find((r) => r.id === f.id).poly = f.parts[0];
    out.push({ id: 'n' + (seq += 1), poly: f.parts[1], fixed: [] });
  }
  return out;
}
const apply = (rooms, plan) => rooms.map((r, i) => ({ ...r, poly: plan.next[i] }));
const tiled = (rooms) => { const c = coverage(rooms.map((r) => r.poly)); return c.overlap < 1 && holes(rooms.map((r) => r.poly)) < 1; };

test('coverage og holes måler overlapp og hull riktig', () => {
  const two = [rect(0, 0, 400, 300), rect(300, 0, 700, 300)];
  assert.deepEqual(coverage(two), { sum: 240000, union: 210000, overlap: 30000 });
  assert.equal(coverage([rect(0, 0, 400, 300), rect(400, 0, 700, 300)]).overlap, 0);
  const tri = [[0, 0], [400, 0], [0, 400]], sq = rect(0, 0, 200, 200);
  assert.equal(coverage([tri, sq]).overlap, 40000);                 // firkanten ligger helt inne i trekanten
  assert.equal(coverage([tri, [[400, 0], [400, 400], [0, 400]]]).overlap, 0); // to trekanter langs samme skråvegg
  const ring = [rect(0, 0, 300, 100), rect(200, 100, 300, 300), rect(0, 200, 200, 300), rect(0, 100, 100, 200)];
  assert.equal(holes(ring), 100 * 100);
  assert.equal(holes([...ring, rect(100, 100, 200, 200)]), 0);
  assert.equal(holes([rect(0, 0, 300, 100), rect(200, 100, 300, 300), rect(0, 200, 200, 300)]), 0); // åpen mot utsiden: ikke et hull
});

test('én strek tvers over deler alle rom den går gjennom', () => {
  let rooms = [{ id: 'a', poly: RECT }];
  rooms = cut(rooms, [[80, 400], [920, 400]]);                      // tvers over hele boligen
  assert.equal(rooms.length, 2);
  rooms = cut(rooms, [[500, 80], [500, 720]]);                      // en strek som krysser den første
  assert.equal(rooms.length, 4);
  assert.ok(tiled(rooms));
  assert.equal(rooms.reduce((s, r) => s + area(r.poly), 0), area(RECT));
  for (const r of rooms) assert.equal(r.poly.length, 4);
  const before = rooms.length;
  rooms = cut(rooms, [[150, 250], [450, 250]]);                     // en kort strek inne i ett rom deler bare det
  assert.equal(rooms.length, before + 1);
  rooms = cut(rooms, [[300, 450], [300, 680], ]);                   // nesten hele veien i ett rom
  assert.equal(rooms.length, before + 2);
  assert.ok(tiled(rooms));
  // En strek som bare så vidt stikker inn i naborommet, deler ikke naborommet.
  const four = cut(cut([{ id: 'a', poly: RECT }], [[80, 400], [920, 400]]), [[500, 80], [500, 720]]);
  assert.equal(cut(four, [[120, 250], [540, 250]]).length, 5);
  assert.equal(cut(four, [[120, 250], [880, 250]]).length, 6);
  assert.equal(cut(four, [[100, 400], [900, 400]]).length, 4);      // langs en vegg som alt finnes: ingenting skjer
});

test('en delt vegg flyttes i begge rom, og naboene følger med', () => {
  const four = cut(cut([{ id: 'a', poly: RECT }], [[80, 400], [920, 400]]), [[500, 80], [500, 720]]);
  const tl = four.find((r) => pointInPoly([200, 200], r.poly)), tr = four.find((r) => pointInPoly([800, 200], r.poly));
  const bl = four.find((r) => pointInPoly([200, 600], r.poly));
  const i = tl.poly.findIndex((p, k) => p[0] === 500 && tl.poly[(k + 1) % 4][0] === 500);
  const plan = planEdit(four, { kind: 'wall', room: tl.id, i, dx: 53, dy: 20 });
  assert.ok(plan.ok);
  const moved = apply(four, plan);
  assert.deepEqual(moved.find((r) => r.id === tl.id).poly, rect(100, 100, 550, 400));
  assert.deepEqual(moved.find((r) => r.id === tr.id).poly, rect(550, 100, 900, 400));
  assert.deepEqual(moved.find((r) => r.id === bl.id).poly, bl.poly);       // rommet under står i ro
  assert.ok(tiled(moved));
  assert.equal(neighbourAt(four, tl.id, i).id, tr.id);
  assert.equal(groupOf(four, tl.id).length, 4);
  // Veggen mellom øvre og nedre rad henger sammen hele veien: alle fire rom følger.
  const j = tl.poly.findIndex((p, k) => p[1] === 400 && tl.poly[(k + 1) % 4][1] === 400);
  const down = planEdit(moved, { kind: 'wall', room: tl.id, i: j, dx: 0, dy: 100 });
  assert.ok(down.ok && down.changed.every(Boolean));
  assert.ok(tiled(apply(moved, down)));
  // For langt: naborommet ville blitt borte. Da skjer ingenting.
  const far = planEdit(four, { kind: 'wall', room: tl.id, i, dx: 390, dy: 0 });
  assert.equal(far.ok, false);
  assert.match(far.msg, /for lite/);
  // Et hjørne dras: begge veggene inn mot hjørnet flyttes, i alle rom.
  const c = tl.poly.findIndex((p) => p[0] === 500 && p[1] === 400);
  const corner = planEdit(four, { kind: 'corner', room: tl.id, i: c, dx: -40, dy: 60 });
  assert.ok(corner.ok);
  assert.ok(tiled(apply(four, corner)));
});

test('en lengde som skrives inn, flytter naboveggen i alle rom', () => {
  const two = cut([{ id: 'a', poly: RECT, fixed: [] }], [[500, 80], [500, 720]]);
  const left = two.find((r) => pointInPoly([200, 200], r.poly)), right = two.find((r) => r !== left);
  const plan = planLength(two, left.id, 0, 450);                    // vegg A i venstre rom: 4 m blir 4,5 m
  assert.ok(plan.ok);
  const next = apply(two, plan);
  assert.deepEqual(next.find((r) => r.id === left.id).poly, rect(100, 100, 550, 700));
  assert.deepEqual(next.find((r) => r.id === right.id).poly, rect(550, 100, 900, 700));
  assert.ok(planLength(two, left.id, 0, 400).same);
  // Er veggen på den ene siden satt, flyttes den andre enden.
  left.fixed = [];
  right.fixed = [0];                                                 // vegg A i høyre rom er satt til 4 m
  const other = planLength(two, left.id, 0, 450);
  assert.deepEqual(apply(two, other).find((r) => r.id === left.id).poly, rect(50, 100, 500, 700));
  assert.equal(planEdit(two, { kind: 'len', room: left.id, i: 0, len: 790, fromStart: false }).ok, false); // høyre rom ville blitt 10 cm bredt
  right.fixed = [];
  assert.deepEqual(apply(two, planLength(two, left.id, 0, 790)).find((r) => r.id === left.id).poly, rect(-290, 100, 500, 700)); // da vokser rommet den andre veien
});

test('skråvegg mellom to rom: hele veggen følger med når det må til', () => {
  const R1 = [[0, 0], [400, 0], [800, 300], [800, 600], [0, 600]], R2 = [[400, 0], [800, 0], [800, 300]];
  const rooms = [{ id: 'a', poly: R1 }, { id: 'b', poly: R2 }];
  const plan = planEdit(rooms, { kind: 'wall', room: 'a', i: 0, dx: 0, dy: -50 });
  assert.ok(plan.ok);
  const c = coverage(plan.next);
  assert.ok(c.overlap < 1);
  assert.equal(c.union, area(R1) + area(R2) + 800 * 50);            // begge rommene ble 50 cm høyere, uten glipe
  // Skråveggen selv flyttes ut: endene glir langs naboveggene i begge rom.
  const out = planEdit(rooms, { kind: 'wall', room: 'a', i: 1, dx: 40, dy: -40 });
  assert.ok(out.ok && coverage(out.next).overlap < 1);
});

test('dører og vinduer hører til veggen, også når to rom deler den', () => {
  const two = cut([{ id: 'a', poly: RECT }], [[500, 80], [500, 720]]).map((r) => ({ ...r, floor: 0, fixed: [], doors: [] }));
  const state = { rooms: two, furn: [], openings: [
    { id: 'o1', floor: 0, kind: 'door', w: 80, x: 500, y: 300 },    // i veggen mellom rommene
    { id: 'o2', floor: 0, kind: 'window', w: 150, x: 300, y: 100 }, // i ytterveggen
    { id: 'o3', floor: 0, kind: 'door', w: 80, x: 300, y: 350 },    // står ikke i noen vegg
  ] };
  syncDoors(state);
  assert.equal(state.openings.length, 2);
  assert.equal(hostsOf(two, state.openings[0]).length, 2);
  assert.deepEqual(two.map((r) => r.doors.length).sort(), [1, 2]);
  const left = two.find((r) => pointInPoly([200, 200], r.poly));
  assert.deepEqual(left.doors.find((d) => d.id === 'o2'), { e: 0, t: 0.5, w: 150, kind: 'window', id: 'o2' });
  // Veggen flyttes: døra følger med, vinduet står der det sto.
  const i = left.poly.findIndex((p, k) => p[0] === 500 && left.poly[(k + 1) % 4][0] === 500);
  left.fixed = [0, 1];
  const plan = planEdit(two, { kind: 'wall', room: left.id, i, dx: 60, dy: 0 });
  applyPlan(state, 0, plan);
  assert.deepEqual([state.openings[0].x, state.openings[0].y], [560, 300]);
  assert.deepEqual([state.openings[1].x, state.openings[1].y], [300, 100]);
  assert.deepEqual(left.fixed, [1]);                                 // vegg A ble lengre, så det målet gjelder ikke lenger
  assert.equal(two.find((r) => r !== left).doors.length, 1);
  // Hele boligen flyttes: alt følger med.
  const mv = planEdit(two, { kind: 'move', room: left.id, dx: 100, dy: 50 });
  assert.ok(mv.ok && mv.changed.every(Boolean));
  applyPlan(state, 0, mv);
  assert.deepEqual([state.openings[0].x, state.openings[0].y], [660, 350]);
  assert.equal(state.openings.length, 2);
  // Veggen blir kortere enn vinduet er bredt: vinduet skyves inn så lenge det får plass.
  assert.deepEqual(placeOn(rect(0, 0, 300, 300), 0, 20, 120), { x: 60, y: 0, w: 120 });
  assert.deepEqual(placeOn(rect(0, 0, 100, 300), 0, 50, 120), { x: 50, y: 0, w: 100 });
});

test('eldre tegninger: dører lagret i hvert rom blir til én åpning per dør', () => {
  const rooms = [
    { id: 'r1', floor: 0, poly: rect(0, 0, 400, 300), doors: [{ e: 1, t: 0.5, w: 80, kind: 'door' }, { e: 0, t: 0.5, w: 120, kind: 'window' }] },
    { id: 'r2', floor: 0, poly: rect(400, 0, 800, 300), doors: [{ e: 3, t: 0.5, w: 80, kind: 'door' }] }, // samme dør, sett fra naborommet
  ];
  let n = 0;
  const ops = openingsFromDoors(rooms, () => 'o' + (n += 1));
  assert.deepEqual(ops, [{ id: 'o1', floor: 0, kind: 'door', w: 80, x: 400, y: 150 }, { id: 'o2', floor: 0, kind: 'window', w: 120, x: 200, y: 0 }]);
});

// ---------- Egenskapstester: uansett hva man gjør, ligger rommene kant i kant ----------

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Uavhengig kontroll på et rutenett med 10 cm ruter (alle mål er hele 10 cm): overlapp og innestengte hull.
function gridCheck(rooms) {
  const xs = rooms.flatMap((r) => r.poly.map((p) => p[0])), ys = rooms.flatMap((r) => r.poly.map((p) => p[1]));
  const x0 = Math.min(...xs) - 10, y0 = Math.min(...ys) - 10, W = (Math.max(...xs) - x0) / 10 + 1, H = (Math.max(...ys) - y0) / 10 + 1;
  const count = new Uint8Array(W * H);
  for (const r of rooms) {
    const px = r.poly.map((p) => p[0]), py = r.poly.map((p) => p[1]);
    for (let j = (Math.min(...py) - y0) / 10; j < (Math.max(...py) - y0) / 10; j++) for (let i = (Math.min(...px) - x0) / 10; i < (Math.max(...px) - x0) / 10; i++) {
      if (pointInPoly([x0 + i * 10 + 5, y0 + j * 10 + 5], r.poly)) count[j * W + i] += 1;
    }
  }
  const seen = new Uint8Array(W * H), todo = [0];
  seen[0] = 1;
  while (todo.length) {
    const at = todo.pop(), i = at % W, j = (at - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, k = b * W + a; if (a >= 0 && b >= 0 && a < W && b < H && !seen[k] && !count[k]) { seen[k] = 1; todo.push(k); } }
  }
  let overlap = 0, hole = 0, covered = 0;
  for (let k = 0; k < W * H; k++) { if (count[k] > 1) overlap += 1; if (count[k]) covered += 1; else if (!seen[k]) hole += 1; }
  return { overlap, hole, covered: covered * 100 };
}

function randomHome(outline, rand, cuts) {
  let rooms = [{ id: 'a', poly: outline, fixed: [] }];
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pick = (lo, hi) => Math.round((lo + rand() * (hi - lo)) / 10) * 10;
  for (let c = 0; c < cuts; c++) {
    const whole = rand() < 0.5;
    if (rand() < 0.5) { const y = pick(y0 + 120, y1 - 120), a = whole ? x0 - 20 : pick(x0, x1 - 200); rooms = cut(rooms, [[a, y], [whole ? x1 + 20 : a + pick(150, 500), y]]); }
    else { const x = pick(x0 + 120, x1 - 120), a = whole ? y0 - 20 : pick(y0, y1 - 200); rooms = cut(rooms, [[x, a], [x, whole ? y1 + 20 : a + pick(150, 500)]]); }
  }
  return rooms;
}

for (const [name, outline] of [['firkant', RECT], ['vinkel', LSHAPE]]) {
  test(`egenskap: ${name} delt i rom ligger kant i kant etter hundrevis av tilfeldige endringer`, () => {
    let accepted = 0, tried = 0, byKind = { wall: 0, corner: 0, len: 0 };
    for (let seed = 1; seed <= 6; seed++) {
      const rand = rng(seed * 7919 + outline.length);
      let rooms = randomHome(outline, rand, 3 + Math.floor(rand() * 4));
      assert.ok(rooms.length >= 3, 'boligen ble delt i flere rom');
      assert.ok(tiled(rooms));
      const g0 = gridCheck(rooms);
      assert.equal(g0.overlap + g0.hole, 0);
      assert.equal(g0.covered, area(outline));
      for (let step = 0; step < 300; step++) {
        const r = rooms[Math.floor(rand() * rooms.length)], i = Math.floor(rand() * r.poly.length);
        const d = () => (Math.floor(rand() * 31) - 15) * 10;
        const kind = ['wall', 'corner', 'len'][Math.floor(rand() * 3)];
        tried += 1;
        const a = r.poly[i], b = r.poly[(i + 1) % r.poly.length];
        const plan = kind === 'len' ? planLength(rooms, r.id, i, Math.hypot(a[0] - b[0], a[1] - b[1]) + d()) : planEdit(rooms, { kind, room: r.id, i, dx: d(), dy: d() });
        if (!plan.ok) { assert.ok(plan.msg, 'en avvist endring har en forklaring'); continue; }
        if (plan.same) continue;
        rooms = apply(rooms, plan);
        accepted += 1; byKind[kind] += 1;
        const polys = rooms.map((x) => x.poly), c = coverage(polys);
        assert.ok(c.overlap < 1, `ingen rom overlapper (frø ${seed}, steg ${step}, ${kind})`);                 // (i)
        assert.ok(holes(polys) < 1, `ingen hull mellom rommene (frø ${seed}, steg ${step}, ${kind})`);          // (ii)
        assert.ok(Math.abs(c.sum - c.union) < 1);
        for (const p of polys) { const v = valid(p); assert.ok(v && v.length === p.length && area(p) >= 10000, 'hvert rom er en gyldig mangekant på minst 1 m²'); } // (iii)
        for (const p of polys) for (const q of p) assert.ok(q[0] % 10 === 0 && q[1] % 10 === 0);
        if (accepted % 20 === 0) { const g = gridCheck(rooms); assert.equal(g.overlap, 0); assert.equal(g.hole, 0); assert.equal(g.covered, c.sum); }
      }
      const g = gridCheck(rooms);
      assert.equal(g.overlap + g.hole, 0);
      assert.equal(g.covered, rooms.reduce((s, x) => s + area(x.poly), 0));
    }
    assert.ok(accepted > 400, `nok endringer ble godtatt til at testen betyr noe (${accepted} av ${tried})`);
    assert.ok(byKind.wall > 80 && byKind.corner > 80 && byKind.len > 80, JSON.stringify(byKind));
  });
}
