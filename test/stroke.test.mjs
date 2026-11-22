// Etterligner ekte fingerstreker: avrundede hjørner, kroker i start og slutt, overlapp, skjelving,
// skjev hånd og ujevn fart. Mange tilfeldige varianter per form.
import test from 'node:test';
import assert from 'node:assert/strict';
import { straighten, alignTo, fitSheet, canonical, areaM2, edges } from '../js/plan.js';

function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// corners: hjørnene i tegnerekkefølge. Gir punkter slik en finger ville laget dem.
function finger(corners, seed, o = {}) {
  const r = rng(seed);
  const radius = o.radius ?? 30 + r() * 60;      // avrundede hjørner
  const jitter = o.jitter ?? 4 + r() * 8;
  const spacing = o.spacing ?? 6 + r() * 30;     // rask eller langsom finger
  const tilt = ((o.tilt ?? (r() - 0.5) * 12) * Math.PI) / 180; // skjev hånd
  const startAt = o.startAt ?? r();              // start et sted langs første vegg
  const overlap = o.overlap ?? (r() - 0.4) * 120; // stopper før start, eller går litt forbi
  const hook = o.hook ?? r() * 25;
  const n = corners.length;
  // Tett sti med avrundede hjørner
  const path = [];
  for (let i = 0; i < n; i++) {
    const a = corners[i], b = corners[(i + 1) % n], c = corners[(i + 2) % n];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const rr = Math.min(radius, ab / 2.2, bc / 2.2);
    const u = [(b[0] - a[0]) / ab, (b[1] - a[1]) / ab], v = [(c[0] - b[0]) / bc, (c[1] - b[1]) / bc];
    const from = [a[0] + u[0] * Math.min(radius, ab / 2.2), a[1] + u[1] * Math.min(radius, ab / 2.2)];
    const to = [b[0] - u[0] * rr, b[1] - u[1] * rr];
    const steps = Math.max(2, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 3));
    for (let k = 0; k <= steps; k++) path.push([from[0] + ((to[0] - from[0]) * k) / steps, from[1] + ((to[1] - from[1]) * k) / steps]);
    const out = [b[0] + v[0] * rr, b[1] + v[1] * rr];
    for (let k = 1; k < 8; k++) { const t = k / 8; path.push([(1 - t) * (1 - t) * to[0] + 2 * t * (1 - t) * b[0] + t * t * out[0], (1 - t) * (1 - t) * to[1] + 2 * t * (1 - t) * b[1] + t * t * out[1]]); }
  }
  // Start et stykke inn på første vegg, gå runden, og slutt litt før eller etter start
  const first = Math.floor((startAt * 0.8 + 0.1) * (Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]) / 3));
  let loop = [...path.slice(first), ...path.slice(0, first)];
  const extra = Math.round(overlap / 3);
  loop = extra > 0 ? [...loop, ...loop.slice(0, extra)] : loop.slice(0, loop.length + extra);
  // Krok i start og slutt
  const h = Math.round(hook / 3);
  if (h > 1) {
    const s0 = loop[0], e0 = loop[loop.length - 1];
    const pre = [], post = [];
    for (let k = h; k >= 1; k--) pre.push([s0[0] - k * 2 * (r() - 0.5), s0[1] + k * 2.5]);
    for (let k = 1; k <= h; k++) post.push([e0[0] + k * 2.5, e0[1] + k * 2 * (r() - 0.5)]);
    loop = [...pre, ...loop, ...post];
  }
  // Tynn ut til fingerens fart, skjelv og vri
  const cx = corners.reduce((s, p) => s + p[0], 0) / n, cy = corners.reduce((s, p) => s + p[1], 0) / n;
  const out = [];
  let acc = 0;
  loop.forEach((p, i) => {
    if (i) acc += Math.hypot(p[0] - loop[i - 1][0], p[1] - loop[i - 1][1]);
    if (i && acc < spacing * (0.5 + r())) return;
    acc = 0;
    const x = p[0] - cx, y = p[1] - cy;
    out.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt) + (r() - 0.5) * 2 * jitter, cy + x * Math.sin(tilt) + y * Math.cos(tilt) + (r() - 0.5) * 2 * jitter]);
  });
  return out;
}
const rectilinear = (p) => edges(p).every((e) => e.a[0] === e.b[0] || e.a[1] === e.b[1]);

test('firkanter tegnet med finger blir firkanter', () => {
  const sizes = [[300, 250], [400, 300], [520, 380], [250, 600], [700, 450], [180, 220]];
  let bad = [];
  for (let seed = 1; seed <= 400; seed++) {
    const [w, h] = sizes[seed % sizes.length];
    const x = 100 + (seed * 37) % 300, y = 80 + (seed * 53) % 300;
    const cw = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const corners = seed % 2 ? cw : [cw[0], cw[3], cw[2], cw[1]]; // med og mot klokka
    const start = seed % 4;                                        // start på hvilken som helst vegg
    const rot = [...corners.slice(start), ...corners.slice(0, start)];
    for (const tol of [30, 45, 60]) {
      const p = straighten(finger(rot, seed), tol);
      const ok = p && p.length === 4 && rectilinear(p) && Math.abs(areaM2(p) - (w * h) / 10000) <= Math.max(1, (w * h) / 10000 * 0.22);
      if (!ok) bad.push(`seed ${seed} tol ${tol} ${w}x${h}: ${JSON.stringify(p)}`);
    }
  }
  assert.equal(bad.length, 0, `${bad.length} av 1200 feilet:\n${bad.slice(0, 6).join('\n')}`);
});

test('vinkelrom tegnet med finger får seks hjørner', () => {
  let bad = [];
  for (let seed = 1; seed <= 200; seed++) {
    const L = [[100, 100], [700, 100], [700, 350], [420, 350], [420, 620], [100, 620]];
    const corners = seed % 2 ? L : [...L].reverse();
    const start = seed % 6;
    const rot = [...corners.slice(start), ...corners.slice(0, start)];
    const p = straighten(finger(rot, seed), 40);
    const ok = p && p.length === 6 && rectilinear(p) && Math.abs(areaM2(p) - 23.64) <= 4;
    if (!ok) bad.push(`seed ${seed}: ${JSON.stringify(p)}`);
  }
  assert.equal(bad.length, 0, `${bad.length} av 200 feilet:\n${bad.slice(0, 6).join('\n')}`);
});

test('åpen strek: tre vegger tegnet, den fjerde lukkes', () => {
  let bad = [];
  for (let seed = 1; seed <= 100; seed++) {
    const pts = finger([[100, 100], [500, 100], [500, 400], [100, 400]], seed, { startAt: 0.05, overlap: -420, hook: 0 });
    const p = straighten(pts, 40);
    if (!(p && p.length === 4 && rectilinear(p) && areaM2(p) >= 8 && areaM2(p) <= 13.5)) bad.push(`seed ${seed}: ${JSON.stringify(p)}`);
  }
  assert.equal(bad.length, 0, `${bad.length} av 100 feilet:\n${bad.slice(0, 5).join('\n')}`);
});

test('lang skråvegg beholdes, avrundede hjørner gir ikke skråvegger', () => {
  let kept = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const p = straighten(finger([[100, 100], [600, 100], [600, 300], [350, 550], [100, 550]], seed, { radius: 25, tilt: 0 }), 40);
    assert.ok(p && p.length >= 4, `seed ${seed}: ${JSON.stringify(p)}`);
    if (p.length === 5 && edges(p).filter((e) => e.a[0] !== e.b[0] && e.a[1] !== e.b[1]).length === 1) kept++;
  }
  assert.ok(kept >= 54, `skråveggen ble beholdt i ${kept} av 60`);
  for (let seed = 1; seed <= 60; seed++) {
    const p = straighten(finger([[100, 100], [500, 100], [500, 400], [100, 400]], seed, { radius: 90 }), 40);
    assert.ok(p && rectilinear(p) && p.length === 4, `seed ${seed}: ${JSON.stringify(p)}`);
  }
});

test('rot og kruseduller blir en firkant eller ingenting, aldri en umulig form', () => {
  const r = rng(9);
  for (let i = 0; i < 300; i++) {
    const pts = Array.from({ length: 5 + Math.floor(r() * 60) }, () => [100 + r() * 600, 100 + r() * 600]);
    const p = straighten(pts, 40);
    if (p) { assert.ok(p.length >= 3 && areaM2(p) >= 1, JSON.stringify(p)); p.flat().forEach((v) => assert.ok(Number.isFinite(v))); }
  }
  // en ring
  const ring = Array.from({ length: 60 }, (_, i) => [400 + 200 * Math.cos(i / 9.5), 400 + 150 * Math.sin(i / 9.5)]);
  const p = straighten(ring, 40);
  assert.ok(p && p.length === 4 && rectilinear(p), JSON.stringify(p));
});

test('nytt rom legger seg inntil veggen til naborommet, og holder seg på arket', () => {
  const a = [[100, 100], [500, 100], [500, 400], [100, 400]];
  const b = alignTo([[520, 90], [900, 90], [900, 410], [520, 410]], [a], 40);
  assert.deepEqual(b, [[500, 100], [900, 100], [900, 400], [500, 400]]);
  assert.deepEqual(alignTo([[700, 700], [900, 700], [900, 900], [700, 900]], [a], 40), [[700, 700], [900, 700], [900, 900], [700, 900]]);
  assert.deepEqual(fitSheet([[-30, 10], [510, 10], [510, 390], [-30, 390]], 1000), [[0, 10], [540, 10], [540, 390], [0, 390]]);
  assert.deepEqual(fitSheet([[700, 800], [1050, 800], [1050, 1100], [700, 1100]], 1000), [[650, 700], [1000, 700], [1000, 1000], [650, 1000]]);
});

test('vegg A er alltid den øverste, uansett hvordan man tegnet', () => {
  const want = [[100, 100], [500, 100], [500, 400], [100, 400]];
  assert.deepEqual(canonical([[500, 100], [500, 400], [100, 400], [100, 100]]), want);
  assert.deepEqual(canonical([[100, 400], [500, 400], [500, 100], [100, 100]]), want); // mot klokka
  const L = canonical([[100, 800], [600, 800], [600, 650], [350, 650], [350, 450], [100, 450]]);
  assert.deepEqual(L[0], [100, 450]); assert.deepEqual(L[1], [350, 450]);
});
