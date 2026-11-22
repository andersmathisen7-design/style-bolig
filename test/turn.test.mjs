import test from 'node:test';
import assert from 'node:assert/strict';
import { turned, keepInside, fitsRoom, boxOf, boxesOf } from '../js/arrange.js';

const rect = { poly: [[50, 50], [550, 50], [550, 450], [50, 450]], doors: [] };          // 5 × 4 m
const small = { poly: [[0, 0], [300, 0], [300, 260], [0, 260]], doors: [] };              // helt oppe i hjørnet av arket
const L = { poly: [[100, 100], [700, 100], [700, 350], [420, 350], [420, 620], [100, 620]], doors: [] };
const sofa = (x, y, r = 0) => ({ id: 'f1', room: 'r1', item: 'sofa', x, y, w: 210, d: 90, r, s: 'M' });
const corner = (x, y, r = 0, c = 'se') => ({ id: 'f1', room: 'r1', item: 'sofa', x, y, w: 260, d: 170, r, s: 'L', corner: c });
const shape = (f) => [f.w, f.d, f.r, f.corner];

test('fritt i rommet: snur rundt midten', () => {
  const f = sofa(300, 250), t = turned(rect, f);
  assert.deepEqual([t.x, t.y, t.r], [300, 250, 90]);
  assert.ok(fitsRoom(rect, t));
  assert.equal(f.r, 0); // originalen er urørt
});

test('mot en vegg: skyves akkurat inntil veggen i stedet for gjennom den', () => {
  const north = turned(rect, sofa(300, 100));       // rygg mot øverste vegg, 5 cm luft
  assert.deepEqual([north.x, north.y, north.r], [300, 155, 90]); // enden står nå inntil veggen (50 + 105)
  assert.equal(boxOf(north)[1], 50);
  const south = turned(rect, sofa(300, 400));
  assert.deepEqual([south.x, south.y], [300, 345]); assert.equal(boxOf(south)[3], 450);
  const west = turned(rect, sofa(100, 250, 90));    // står langs venstre vegg, snus til å stå ut i rommet
  assert.deepEqual([west.x, west.y, west.r], [155, 250, 0]);
  const east = turned(rect, sofa(500, 250, 90));
  assert.deepEqual([east.x, east.y, east.r], [445, 250, 0]);
});

test('i et hjørne: holder seg inne og flytter seg kortest mulig', () => {
  const t = turned(rect, sofa(160, 100));           // øverst til venstre
  assert.ok(fitsRoom(rect, t));
  assert.deepEqual([t.x, t.y], [160, 155]);         // bare ned; bortover var det plass
  const s = turned(small, { ...sofa(85, 50), w: 160 });
  assert.ok(fitsRoom(small, s));
  boxOf(s).forEach((v) => assert.ok(v >= 0));       // aldri utenfor arket
});

test('fire snu gir samme form tilbake, og møbelet er inne i rommet hele veien', () => {
  for (const start of [sofa(300, 100), sofa(100, 250, 90), sofa(445, 400), corner(300, 140), corner(415, 360, 0, 'nw'), corner(140, 250, 90, 'se')]) {
    let f = start;
    for (let i = 0; i < 4; i++) { f = turned(rect, f); assert.ok(f && fitsRoom(rect, f), JSON.stringify(f)); }
    assert.deepEqual(shape(f), shape(start));
  }
});

test('hjørnesofa: vinkelen følger med rundt og står inne i rommet', () => {
  const a = corner(300, 140);                        // rygg mot øverste vegg, åpent hjørne nede til høyre
  const b = turned(rect, a);
  assert.equal(b.r, 90); assert.equal(b.corner, 'sw');
  assert.ok(fitsRoom(rect, b));
  assert.deepEqual([b.x, b.y], [300, 180]);          // 260 høy nå: midten må 130 fra veggen
  assert.equal(boxesOf(b).length, 2);
  const seq = [b.corner]; let f = b;
  for (let i = 0; i < 3; i++) { f = turned(rect, f); seq.push(f.corner); }
  assert.deepEqual(seq, ['sw', 'nw', 'ne', 'se']);
});

test('vinkelrom: møbelet havner ikke over det innvendige hjørnet', () => {
  const t = turned(L, sofa(520, 300));               // står langs veggen ved knekken, snus mot den smale delen
  assert.ok(t && fitsRoom(L, t), JSON.stringify(t));
  const t2 = turned(L, sofa(300, 575));              // nederst i den smale delen
  assert.ok(t2 && fitsRoom(L, t2));
});

test('for trangt til å snu: gir beskjed i stedet for å sette møbelet utenfor', () => {
  const narrow = { poly: [[0, 0], [400, 0], [400, 150], [0, 150]], doors: [] };
  assert.equal(turned(narrow, sofa(200, 50)), null);
  assert.equal(keepInside(narrow, { ...sofa(200, 50), w: 500 }), null);
});

test('keepInside: urørt når det står inne, ellers kortest vei inn', () => {
  const ok = sofa(300, 250);
  assert.equal(keepInside(rect, ok), ok);
  const out = keepInside(rect, sofa(300, 20));       // dratt halvveis gjennom veggen
  assert.deepEqual([out.x, out.y], [300, 95]);
  const wide = keepInside(rect, { ...sofa(450, 100), w: 300 }); // gjort bredere for hånd inntil høyre vegg
  assert.deepEqual([wide.x, wide.y], [400, 100]);
  assert.equal(keepInside({}, ok), ok);              // rom uten tegning: ingenting å holde seg inne i
});

test('mange tilfeldige stillinger: alltid inne, aldri lenger unna enn nødvendig', () => {
  let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  let nulls = 0;
  for (let i = 0; i < 600; i++) {
    const room = i % 2 ? rect : L;
    const isCorner = i % 3 === 0;
    const xs = room.poly.map((p) => p[0]), ys = room.poly.map((p) => p[1]);
    const x = Math.round((Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs))) / 5) * 5, y = Math.round((Math.min(...ys) + rnd() * (Math.max(...ys) - Math.min(...ys))) / 5) * 5;
    const f = isCorner ? corner(x, y, rnd() < 0.5 ? 0 : 90, ['nw', 'ne', 'se', 'sw'][i % 4]) : sofa(x, y, rnd() < 0.5 ? 0 : 90);
    const t = turned(room, f);
    if (!t) { nulls++; continue; }
    assert.ok(fitsRoom(room, t), `${i}: ${JSON.stringify(t)}`);
    assert.equal(t.r, f.r === 90 ? 0 : 90);
    const plain = { ...f, r: t.r, corner: t.corner };
    if (fitsRoom(room, plain)) assert.deepEqual([t.x, t.y], [f.x, f.y], `${i}: flyttet uten grunn`);
    assert.ok(Math.hypot(t.x - f.x, t.y - f.y) <= 400);
  }
  assert.ok(nulls < 30, `${nulls} av 600 fikk ikke plass`);
});
