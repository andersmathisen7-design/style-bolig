// Geometri for plantegningen. Alt er i centimeter. Ren logikk uten DOM, så den kan testes i Node.

export const SNAP = 10; // alt låses til nærmeste 10 cm
const snap = (v) => Math.round(v / SNAP) * SNAP;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const at = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

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

const median = (arr) => { const v = [...arr].sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : 0; };

// Punkter med jevn avstand langs streken, uansett hvor fort fingeren gikk.
function resample(pts, step) {
  const out = [pts[0]];
  let left = step;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let d = dist(a, b);
    while (d >= left) {
      const t = left / d;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(a);
      d = dist(a, b);
      left = step;
    }
    left -= d;
  }
  return out;
}

function crosses(poly) {
  const n = poly.length;
  const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const [a, b, c, d] = [poly[i], at(poly, i + 1), poly[j], at(poly, j + 1)];
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;
    }
  }
  return false;
}

// Gjør en håndtegnet runde om til et rom med rette vegger.
// Leser retningen fingeren beveger seg i, ikke enkeltpunkter: lange strekk samme vei blir vegger,
// mens avrundede hjørner, kroker i start og slutt og små rykk blir borte. Er streken uklar, blir
// rommet en firkant rundt det som ble tegnet. tol = hvor unøyaktig en finger er, i cm.
// Gir en liste med hjørner, eller null når streken er for liten til å være et rom.
export function straighten(raw, tol = 40) {
  if (!raw || raw.length < 4) return null;
  const pts = [raw[0]];
  for (const p of raw) if (dist(p, pts[pts.length - 1]) > 1) pts.push(p);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  if (len < 300 || box[2] - box[0] < 100 || box[3] - box[1] < 100) return null;
  const fallback = () => {
    const [x0, y0, x1, y1] = box.map(snap);
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  };

  const step = Math.min(20, Math.max(4, len / 160));
  const P = resample(pts, step);
  const n = P.length - 1;
  if (n < 8) return fallback();

  // Retning for hvert lille stykke, målt over et vindu så skjelving ikke teller.
  const k = Math.max(1, Math.round(tol / step / 2));
  const cls = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - k)], b = P[Math.min(n, i + 1 + k)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const deg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
    cls.push(deg < 30 ? (dx > 0 ? 'R' : 'L') : deg > 60 ? (dy > 0 ? 'D' : 'U') : 'X');
  }
  let runs = [];
  cls.forEach((c, i) => { const last = runs[runs.length - 1]; if (last && last.c === c) last.b = i; else runs.push({ c, a: i, b: i }); });

  // Fjern korte strekk, korteste først. Skrå strekk må være lange for å telle som skråvegg.
  const minAxis = Math.max(tol * 1.5, len * 0.035), minDiag = Math.max(tol * 3.5, len * 0.12);
  const ratio = (r) => ((r.b - r.a + 1) * step) / (r.c === 'X' ? minDiag : minAxis);
  while (runs.length > 1) {
    let w = 0;
    runs.forEach((r, i) => { if (ratio(r) < ratio(runs[w])) w = i; });
    if (ratio(runs[w]) >= 1) break;
    runs.splice(w, 1);
    if (w > 0 && w < runs.length && runs[w - 1].c === runs[w].c) { runs[w - 1].b = runs[w].b; runs.splice(w, 1); }
  }
  // Runden slutter der den begynte: første og siste strekk kan være samme vegg.
  if (runs.length > 2 && runs[0].c === runs[runs.length - 1].c) {
    const last = runs.pop();
    runs[0].wrap = last;
  }
  if (runs.length < 2) return fallback();

  // Hver vegg får én linje: medianen av punktene midt på strekket.
  const axis = (c) => (c === 'R' || c === 'L' ? 'H' : c === 'X' ? 'X' : 'V');
  const samples = (r) => {
    const take = (q) => { const m = Math.floor((q.b - q.a + 1) * 0.15); return P.slice(q.a + m, q.b + 2 - m); };
    return r.wrap ? [...take(r), ...take(r.wrap)] : take(r);
  };
  let es = runs.map((r) => {
    const o = axis(r.c), sm = samples(r);
    return { o, c: o === 'H' ? snap(median(sm.map((q) => q[1]))) : o === 'V' ? snap(median(sm.map((q) => q[0]))) : null, r };
  });
  const mid = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  // Punktet på streken mellom to vegger.
  const between = (i) => {
    const A = es[i].r, B = at(es, i + 1).r;
    if (i === es.length - 1) { // åpen strek: lukk ved den enden som ligger ytterst, så ingenting av det tegnede kuttes
      const far = (k) => (Math.abs(P[0][k] - mid[k]) > Math.abs(P[n][k] - mid[k]) ? P[0][k] : P[n][k]);
      return [far(0), far(1)];
    }
    return P[Math.round((A.b + 1 + B.a) / 2)];
  };
  // To vegger samme vei etter hverandre (åpen strek, eller en smal innbuktning): sett inn veggen som mangler.
  const joined = [];
  es.forEach((e, i) => {
    joined.push(e);
    const next = at(es, i + 1);
    if (e.o !== 'X' && e.o === next.o) {
      const p = between(i);
      joined.push({ o: e.o === 'H' ? 'V' : 'H', c: snap(e.o === 'H' ? p[0] : p[1]), r: null, mid: p });
    }
  });
  es = joined;
  const corner = es.map((A, i) => {
    const B = at(es, i + 1);
    if (A.o === 'H' && B.o === 'V') return [B.c, A.c];
    if (A.o === 'V' && B.o === 'H') return [A.c, B.c];
    const p = A.r && B.r ? P[i === es.length - 1 ? 0 : Math.round((A.r.b + 1 + B.r.a) / 2)] : (A.mid || B.mid || P[0]);
    const x = A.o === 'V' ? A.c : B.o === 'V' ? B.c : snap(p[0]);
    const y = A.o === 'H' ? A.c : B.o === 'H' ? B.c : snap(p[1]);
    return [x, y];
  });

  const poly = tidy(corner);
  const pad = tol * 2;
  const inside = poly.every(([x, y]) => x >= box[0] - pad && x <= box[2] + pad && y >= box[1] - pad && y <= box[3] + pad);
  const boxArea = (box[2] - box[0]) * (box[3] - box[1]);
  const diag = es.some((e) => e.o === 'X');
  const ok = poly.length >= (diag ? 3 : 4) && (diag || poly.length % 2 === 0) && inside && !crosses(poly)
    && area(poly) >= 10000 && area(poly) >= boxArea * (diag ? 0.3 : 0.45);
  return ok ? poly : (boxArea >= 10000 ? fallback() : null);
}

// Fast rekkefølge på hjørnene: start øverst til venstre og gå med klokka. Da er vegg A alltid den øverste.
export function canonical(poly) {
  let signed = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = at(poly, i + 1); signed += a[0] * b[1] - b[0] * a[1]; }
  const p = signed < 0 ? [...poly].reverse() : poly.slice(); // på skjermen peker y nedover, så positivt areal er med klokka
  let first = 0;
  p.forEach((q, i) => { if (q[1] < p[first][1] || (q[1] === p[first][1] && q[0] < p[first][0])) first = i; });
  return [...p.slice(first), ...p.slice(0, first)];
}

// Legger veggene i et nytt rom på linje med vegger som ligger like ved i rommene fra før.
export function alignTo(poly, others, tol = 40) {
  const reach = tol * 0.7;
  const near = (v, k) => {
    let best = v, d = reach;
    for (const o of others) for (const q of o) if (Math.abs(q[k] - v) < d) { d = Math.abs(q[k] - v); best = q[k]; }
    return best;
  };
  const mapX = new Map(), mapY = new Map();
  for (const [x, y] of poly) { if (!mapX.has(x)) mapX.set(x, near(x, 0)); if (!mapY.has(y)) mapY.set(y, near(y, 1)); }
  const out = tidy(poly.map(([x, y]) => [mapX.get(x), mapY.get(y)]));
  return out.length === poly.length && area(out) >= 10000 && !crosses(out) ? out : poly;
}

// Flytter rommet inn på arket hvis det stikker utenfor.
export function fitSheet(poly, size) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const dx = Math.max(0, -Math.min(...xs)) - Math.max(0, Math.max(...xs) - size);
  const dy = Math.max(0, -Math.min(...ys)) - Math.max(0, Math.max(...ys) - size);
  return dx || dy ? poly.map(([x, y]) => [x + snap(dx), y + snap(dy)]) : poly;
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
