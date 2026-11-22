// Geometri for plantegningen. Alt er i centimeter. Ren logikk uten DOM, så den kan testes i Node.

export const SNAP = 10; // alt låses til nærmeste 10 cm
const snap = (v) => Math.round(v / SNAP) * SNAP;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const at = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

// Ramer–Douglas–Peucker: fjerner punkter som ligger nær linja mellom naboene.
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const len = dist(a, b) || 1;
  let worst = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / len;
    if (d > worst) { worst = d; idx = i; }
  }
  if (worst <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

// H = vannrett, V = loddrett, D = skrå. Streker innenfor 30 grader regnes som rette.
function orient(a, b) {
  const deg = (Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[0] - a[0])) * 180) / Math.PI;
  return deg < 30 ? 'H' : deg > 60 ? 'V' : 'D';
}

export function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = at(poly, i + 1); s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}
export const areaM2 = (poly) => area(poly) / 10000;

// Fjerner doble punkter og punkter som ligger midt på en rett vegg.
function tidy(poly) {
  let p = poly.slice(), changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = at(p, i - 1), b = p[i], c = at(p, i + 1);
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (dist(a, b) < 1 || Math.abs(cross) < 1) { p.splice(i, 1); changed = true; break; }
    }
  }
  return p;
}

// Gjør en håndtegnet runde om til et rom med rette vegger.
// Gir en liste med hjørner, eller null når streken er for liten til å være et rom.
export function straighten(raw) {
  if (!raw || raw.length < 4) return null;
  let len = 0;
  for (let i = 1; i < raw.length; i++) len += dist(raw[i - 1], raw[i]);
  if (len < 300) return null;

  // Forenkle som en lukket sløyfe: del ved punktet lengst fra start.
  let far = 0;
  raw.forEach((p, i) => { if (dist(p, raw[0]) > dist(raw[far], raw[0])) far = i; });
  const eps = Math.max(25, Math.min(60, len * 0.02));
  let loop = [...rdp(raw.slice(0, far + 1), eps).slice(0, -1), ...rdp([...raw.slice(far), raw[0]], eps).slice(0, -1)];

  // Slå sammen streker som går samme vei, og fjern korte stumper.
  let changed = true;
  while (changed && loop.length > 3) {
    changed = false;
    for (let i = 0; i < loop.length; i++) {
      const a = at(loop, i - 1), b = loop[i], c = at(loop, i + 1);
      const o1 = orient(a, b), o2 = orient(b, c);
      if ((o1 === o2 && o1 !== 'D') || dist(a, b) < 35) { loop.splice(i, 1); changed = true; break; }
    }
  }
  if (loop.length < 3) return null;

  // Hver vannrette vegg får én høyde, hver loddrette én sidekoordinat. Hjørnene er der veggene møtes.
  const n = loop.length;
  const edge = loop.map((p, i) => {
    const q = at(loop, i + 1), o = orient(p, q);
    return { o, c: o === 'H' ? snap((p[1] + q[1]) / 2) : o === 'V' ? snap((p[0] + q[0]) / 2) : null };
  });
  const out = loop.map((p, i) => {
    const prev = at(edge, i - 1), next = edge[i];
    let x = snap(p[0]), y = snap(p[1]);
    if (prev.o === 'V') x = prev.c; else if (next.o === 'V') x = next.c;
    if (prev.o === 'H') y = prev.c; else if (next.o === 'H') y = next.c;
    return [x, y];
  });
  const poly = tidy(out);
  return poly.length >= 3 && area(poly) >= 10000 && n >= 3 ? poly : null;
}

export function edges(poly) {
  return poly.map((a, i) => { const b = at(poly, i + 1); return { a, b, len: dist(a, b) }; });
}

export const letter = (i) => String.fromCharCode(65 + (i % 26));

// Setter lengden på en vegg ved å skyve neste vegg. Rette hjørner forblir rette.
export function setEdgeLength(poly, i, len) {
  const n = poly.length;
  const a = poly[i], b = at(poly, i + 1), c = at(poly, i + 2);
  const cur = dist(a, b);
  const L = Math.min(3000, Math.max(30, snap(len)));
  if (!cur || L === snap(cur)) return poly;
  const u = [(b[0] - a[0]) / cur, (b[1] - a[1]) / cur];
  const d = L - cur;
  const nl = dist(b, c) || 1;
  const perp = Math.abs(u[0] * ((c[0] - b[0]) / nl) + u[1] * ((c[1] - b[1]) / nl)) < 0.05;
  const out = poly.map((p) => p.slice());
  const move = (k) => { const p = at(out, k); p[0] = snap(p[0] + u[0] * d); p[1] = snap(p[1] + u[1] * d); };
  move(i + 1);
  if (perp && n >= 4) move(i + 2);
  const res = tidy(out);
  return res.length >= 3 && area(res) >= 10000 ? res : poly;
}

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Nærmeste vegg til et punkt: hvilken vegg, hvor langt bortover (0–1) og avstand.
export function nearestEdge(poly, p) {
  let best = null;
  edges(poly).forEach((e, i) => {
    const vx = e.b[0] - e.a[0], vy = e.b[1] - e.a[1];
    const t = Math.min(1, Math.max(0, ((p[0] - e.a[0]) * vx + (p[1] - e.a[1]) * vy) / (e.len * e.len || 1)));
    const d = dist(p, [e.a[0] + vx * t, e.a[1] + vy * t]);
    if (!best || d < best.d) best = { i, t, d, len: e.len };
  });
  return best;
}

// Et punkt inne i rommet der navnet kan stå, også i L-formede rom.
export function labelPoint(poly) {
  let cx = 0, cy = 0, a2 = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = at(poly, i + 1), f = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; a2 += f;
  }
  const c = a2 ? [cx / (3 * a2), cy / (3 * a2)] : poly[0];
  if (pointInPoly(c, poly)) return c;
  let best = poly[0], bestA = -1;
  for (let i = 1; i < poly.length - 1; i++) {
    const t = [(poly[0][0] + poly[i][0] + poly[i + 1][0]) / 3, (poly[0][1] + poly[i][1] + poly[i + 1][1]) / 3];
    const ar = area([poly[0], poly[i], poly[i + 1]]);
    if (pointInPoly(t, poly) && ar > bestA) { best = t; bestA = ar; }
  }
  return best;
}

export const moved = (poly, dx, dy) => poly.map(([x, y]) => [snap(x + dx), snap(y + dy)]);

// Punkt og retning for en dør eller et vindu på en vegg.
export function opening(poly, o) {
  const e = edges(poly)[o.e];
  if (!e) return null;
  const u = [(e.b[0] - e.a[0]) / (e.len || 1), (e.b[1] - e.a[1]) / (e.len || 1)];
  const half = Math.min(o.w, e.len) / 2;
  const mid = Math.min(e.len - half, Math.max(half, o.t * e.len));
  const p = [e.a[0] + u[0] * mid, e.a[1] + u[1] * mid];
  let nrm = [-u[1] + 0, u[0] + 0];
  if (!pointInPoly([p[0] + nrm[0] * 15, p[1] + nrm[1] * 15], poly)) nrm = [u[1] + 0, -u[0] + 0];
  return { p, u, n: nrm, half };
}

// Hvilken vegg et møbel står mot, og hvor mye av veggen som er fri for dører.
// Gir null når møbelet står midt i rommet.
export function wallFor(poly, doors, f) {
  const e = nearestEdge(poly, [f.x, f.y]);
  if (!e) return null;
  const ed = edges(poly)[e.i];
  const along = Math.abs(ed.b[0] - ed.a[0]) >= Math.abs(ed.b[1] - ed.a[1]) ? 'x' : 'y';
  const deep = (f.r === 90) === (along === 'x') ? f.w : f.d; // utstrekning vinkelrett på veggen
  if (e.d - deep / 2 > 45) return null;
  const blocked = (doors || []).filter((d) => d.e === e.i && d.kind !== 'window').reduce((s, d) => s + d.w, 0);
  return { e: e.i, len: Math.round(ed.len), free: Math.max(0, Math.round(ed.len - blocked)) };
}
