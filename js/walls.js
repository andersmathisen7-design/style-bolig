// Vegger som deles av flere rom, og dører og vinduer som står i dem. Ren logikk uten DOM.
// Hvert rom er fortsatt sin egen mangekant. Når en vegg flyttes, flyttes hele det sammenhengende veggstykket
// i alle rom som ligger inntil, så rommene alltid ligger kant i kant. En endring som ville gitt glipe eller
// overlapp, blir ikke gjort i det hele tatt.
import { SNAP, edges, valid, pointInPoly, nearestEdge, splitPoly, canonical } from './plan.js';

const snap = (v) => Math.round(v / SNAP) * SNAP;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const TOL = 1; // så nær må to vegger ligge for å regnes som samme linje, i cm
const signed = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; };
const perimeter = (P) => edges(P).reduce((s, e) => s + e.len, 0);

const MSG = {
  small: 'Da blir et rom for lite eller vrengt. Prøv en mindre endring.',
  hit: 'Veggen støter mot et annet rom.',
  gap: 'Det går ikke uten å lage en glipe mot naborommet.',
  big: 'Da blir boligen for stor for arket.',
  none: 'Veggen kan ikke flyttes den veien.',
};

// ---------- Mål på hvor godt rommene ligger kant i kant ----------

// Summen av arealene og arealet av det rommene dekker til sammen. Er de like, overlapper ingen rom.
// Regnes eksakt, også med skrå vegger: mellom to nabohøyder krysser ingen vegger hverandre.
export function coverage(polys) {
  const segs = [];
  const ys = new Set();
  polys.forEach((P, pi) => P.forEach((a, i) => {
    const b = P[(i + 1) % P.length];
    ys.add(a[1]);
    if (a[1] !== b[1]) segs.push(a[1] < b[1] ? [a, b, pi] : [b, a, pi]);
  }));
  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i], slantA = a[0] !== b[0];
    for (let j = i + 1; j < segs.length; j++) {
      const [c, d] = segs[j];
      if (!slantA && c[0] === d[0]) continue; // to loddrette vegger krysser aldri
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (Math.abs(den) < 1e-9) continue;
      const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
      const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
      if (t > 0 && t < 1 && u > 0 && u < 1) ys.add(a[1] + (b[1] - a[1]) * t);
    }
  }
  const Y = [...ys].sort((p, q) => p - q);
  let sum = 0, union = 0;
  for (let s = 0; s + 1 < Y.length; s++) {
    const y0 = Y[s], y1 = Y[s + 1], h = y1 - y0, ym = (y0 + y1) / 2;
    if (h <= 0) continue;
    const per = new Map();
    for (const [a, b, pi] of segs) {
      if (a[1] > y0 + 1e-9 || b[1] < y1 - 1e-9) continue;
      if (!per.has(pi)) per.set(pi, []);
      per.get(pi).push(a[0] + ((b[0] - a[0]) * (ym - a[1])) / (b[1] - a[1]));
    }
    const ivs = [];
    for (const xs of per.values()) {
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) { ivs.push([xs[i], xs[i + 1]]); sum += (xs[i + 1] - xs[i]) * h; }
    }
    ivs.sort((p, q) => p[0] - q[0]);
    let end = -Infinity;
    for (const [l, r] of ivs) if (r > end) { union += (r - Math.max(l, end)) * h; end = r; }
  }
  return { sum, union, overlap: sum - union };
}

// Areal av hull: tomrom som er helt omgitt av rom. Regnes eksakt når alle vegger er rette (vannrett eller loddrett).
// Med skrå vegger gir den null, og da er det de andre kontrollene som gjelder.
export function holes(polys) {
  if (polys.some((P) => P.some((a, i) => { const b = P[(i + 1) % P.length]; return a[0] !== b[0] && a[1] !== b[1]; }))) return 0;
  const X = [...new Set(polys.flatMap((P) => P.map((p) => p[0])))].sort((a, b) => a - b);
  const Y = [...new Set(polys.flatMap((P) => P.map((p) => p[1])))].sort((a, b) => a - b);
  const W = X.length + 1, H = Y.length + 1; // én rute med luft rundt hele tegningen
  const xi = new Map(X.map((v, i) => [v, i])), full = new Uint8Array(W * H);
  for (const P of polys) {
    for (let r = 0; r + 1 < Y.length; r++) {
      const ym = (Y[r] + Y[r + 1]) / 2, xs = [];
      P.forEach((a, i) => { const b = P[(i + 1) % P.length]; if (a[0] === b[0] && Math.min(a[1], b[1]) < ym && Math.max(a[1], b[1]) > ym) xs.push(a[0]); });
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let c = xi.get(xs[k]); c < xi.get(xs[k + 1]); c++) full[(r + 1) * W + c + 1] = 1;
    }
  }
  const seen = new Uint8Array(W * H), todo = [0];
  seen[0] = 1;
  while (todo.length) {
    const at = todo.pop(), c = at % W, r = (at - c) / W;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c2 = c + dc, r2 = r + dr, k = r2 * W + c2;
      if (c2 < 0 || r2 < 0 || c2 >= W || r2 >= H || seen[k] || full[k]) continue;
      seen[k] = 1; todo.push(k);
    }
  }
  let hole = 0;
  for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) if (!full[r * W + c] && !seen[r * W + c]) hole += (X[c] - X[c - 1]) * (Y[r] - Y[r - 1]);
  return hole;
}

// Par av vegger i to ulike rom som ligger på samme linje og oppå hverandre: [romA, veggA, romB, veggB].
function sharedPairs(polys) {
  const E = polys.map((P) => edges(P));
  const box = polys.map((P) => { const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]); return [Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2]; });
  const out = [];
  for (let ra = 0; ra < polys.length; ra++) {
    for (let rb = ra + 1; rb < polys.length; rb++) {
      if (box[ra][0] > box[rb][2] || box[rb][0] > box[ra][2] || box[ra][1] > box[rb][3] || box[rb][1] > box[ra][3]) continue;
      E[ra].forEach((x, ea) => {
        if (x.len < 1) return;
        const ux = (x.b[0] - x.a[0]) / x.len, uy = (x.b[1] - x.a[1]) / x.len;
        E[rb].forEach((y, eb) => {
          if (y.len < 1) return;
          if (Math.abs((y.a[0] - x.a[0]) * uy - (y.a[1] - x.a[1]) * ux) > TOL || Math.abs((y.b[0] - x.a[0]) * uy - (y.b[1] - x.a[1]) * ux) > TOL) return;
          const s1 = (y.a[0] - x.a[0]) * ux + (y.a[1] - x.a[1]) * uy, s2 = (y.b[0] - x.a[0]) * ux + (y.b[1] - x.a[1]) * uy;
          if (Math.min(x.len, Math.max(s1, s2)) - Math.max(0, Math.min(s1, s2)) > 5) out.push([ra, ea, rb, eb]);
        });
      });
    }
  }
  return out;
}

// Rommene som henger sammen med dette rommet gjennom felles vegger (rommet selv er med).
export function groupOf(rooms, id) {
  const pairs = sharedPairs(rooms.map((r) => r.poly));
  const start = rooms.findIndex((r) => r.id === id);
  if (start < 0) return [];
  const inGroup = new Set([start]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [a, , b] of pairs) if (inGroup.has(a) !== inGroup.has(b)) { inGroup.add(a); inGroup.add(b); grew = true; }
  }
  return [...inGroup].map((i) => rooms[i].id);
}

// Rommet på den andre siden av en vegg, om det finnes.
export function neighbourAt(rooms, id, i) {
  const ra = rooms.findIndex((r) => r.id === id);
  for (const [a, ea, b, eb] of sharedPairs(rooms.map((r) => r.poly))) {
    if (a === ra && ea === i) return rooms[b];
    if (b === ra && eb === i) return rooms[a];
  }
  return null;
}

// ---------- Flytte vegger og hjørner ----------

// Alle veggstykker som ligger på samme linje som denne veggen og henger sammen med den.
// touch = også stykker som bare møtes i et punkt (hele den rette veggen gjennom boligen).
function runOf(polys, ri, ei, touch) {
  const P = polys[ri], a = P[ei], b = P[(ei + 1) % P.length];
  const k = a[0] === b[0] ? 0 : 1, j = 1 - k, c = a[k]; // k = aksen veggen står stille i
  const cand = [];
  polys.forEach((Q, qi) => Q.forEach((p, pi) => {
    const q = Q[(pi + 1) % Q.length];
    if (Math.abs(p[k] - c) <= TOL && Math.abs(q[k] - c) <= TOL && p[j] !== q[j]) cand.push({ r: qi, e: pi, lo: Math.min(p[j], q[j]), hi: Math.max(p[j], q[j]), on: qi === ri && pi === ei });
  }));
  let grew = true;
  while (grew) {
    grew = false;
    for (const x of cand) {
      if (x.on) continue;
      if (cand.some((y) => y.on && (touch ? Math.min(x.hi, y.hi) - Math.max(x.lo, y.lo) >= 0 : Math.min(x.hi, y.hi) - Math.max(x.lo, y.lo) > 5))) { x.on = true; grew = true; }
    }
  }
  return cand.filter((x) => x.on);
}

// Skyver et hjørne langs aksen k. Står hjørnet i enden av en vegg på tvers av aksen, er det hele det
// sammenhengende veggstykket som flyttes, i alle rom. Ellers flyttes hjørnet, og hjørner i andre rom som ligger
// i samme punkt, følger med.
function push(ctx, ri, vi, k, d) {
  const { polys, D } = ctx;
  if (!d || D[ri][vi][k] !== null) return;
  const P = polys[ri], n = P.length, v = P[vi];
  const onLine = (Q, i) => { const m = Q.length, q = Q[i]; return [Q[(i - 1 + m) % m], Q[(i + 1) % m]].some((w) => w[k] === q[k] && w[1 - k] !== q[1 - k]); };
  let ran = false;
  for (const [e, o] of [[(vi - 1 + n) % n, (vi - 1 + n) % n], [vi, (vi + 1) % n]]) {
    const w = P[o];
    if (w[k] !== v[k] || w[1 - k] === v[1 - k]) continue;
    ran = true;
    for (const x of runOf(polys, ri, e, ctx.touch)) {
      const Q = polys[x.r];
      for (const t of [x.e, (x.e + 1) % Q.length]) {
        if (D[x.r][t][k] === null) D[x.r][t][k] = d;
        // Hjørner i andre rom som ligger i samme punkt uten egen vegg langs linja, følger med veggen.
        polys.forEach((R, qi) => R.forEach((p, pi) => {
          if (D[qi][pi][k] === null && Math.abs(p[0] - Q[t][0]) <= TOL && Math.abs(p[1] - Q[t][1]) <= TOL && !onLine(R, pi)) D[qi][pi][k] = d;
        }));
      }
    }
  }
  if (ran) return;
  D[ri][vi][k] = d;
  polys.forEach((Q, qi) => Q.forEach((p, pi) => {
    if ((qi !== ri || pi !== vi) && Math.abs(p[0] - v[0]) <= TOL && Math.abs(p[1] - v[1]) <= TOL) push(ctx, qi, pi, k, d);
  }));
}

function attempt(rooms, edit, touch) {
  const polys = rooms.map((r) => r.poly);
  const D = polys.map((P) => P.map(() => [null, null]));
  const ctx = { polys, D, touch };
  const ri = rooms.findIndex((r) => r.id === edit.room);
  const P = polys[ri];
  if (!P) return { ok: false, why: 'none' };
  const n = P.length, i = ((edit.i || 0) % n + n) % n, a = P[i], b = P[(i + 1) % n];
  let shift = null;
  if (edit.kind === 'wall') {
    if (a[0] === b[0]) push(ctx, ri, i, 0, snap(edit.dx));
    else if (a[1] === b[1]) push(ctx, ri, i, 1, snap(edit.dy));
    else { // skrå vegg: flyttes rett ut fra seg selv, og endene glir langs naboveggene
      const l = dist(a, b), nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, d = edit.dx * nx + edit.dy * ny;
      for (const [vi, oi] of [[i, (i - 1 + n) % n], [(i + 1) % n, (i + 2) % n]]) {
        const v = P[vi], o = P[oi], ol = dist(v, o) || 1, w = [(o[0] - v[0]) / ol, (o[1] - v[1]) / ol], dot = nx * w[0] + ny * w[1];
        const mv = Math.abs(dot) > 0.2 ? [w[0] * d / dot, w[1] * d / dot] : [nx * d, ny * d];
        push(ctx, ri, vi, 0, snap(mv[0])); push(ctx, ri, vi, 1, snap(mv[1]));
      }
    }
  } else if (edit.kind === 'corner') {
    push(ctx, ri, i, 0, snap(edit.dx)); push(ctx, ri, i, 1, snap(edit.dy));
  } else if (edit.kind === 'len') {
    const cur = dist(a, b);
    if (!cur) return { ok: false, why: 'none' };
    const u = [(b[0] - a[0]) / cur, (b[1] - a[1]) / cur], vi = edit.fromStart ? i : (i + 1) % n, sgn = edit.fromStart ? -1 : 1;
    const from = edit.fromStart ? b : a, to = P[vi];
    const want = [snap(from[0] + sgn * u[0] * edit.len), snap(from[1] + sgn * u[1] * edit.len)];
    if (a[1] !== b[1] || a[0] === b[0]) push(ctx, ri, vi, 1, want[1] - to[1]); // en vannrett vegg endres bare bortover
    if (a[0] !== b[0] || a[1] === b[1]) push(ctx, ri, vi, 0, want[0] - to[0]);
  } else if (edit.kind === 'move') {
    shift = [snap(edit.dx), snap(edit.dy)];
    const ids = new Set(groupOf(rooms, edit.room));
    rooms.forEach((r, qi) => { if (ids.has(r.id)) D[qi].forEach((v) => { v[0] = shift[0]; v[1] = shift[1]; }); });
  }
  const raw = polys.map((Q, r) => Q.map((p, v) => [p[0] + (D[r][v][0] || 0), p[1] + (D[r][v][1] || 0)]));
  const changed = raw.map((Q, r) => Q.some((p, v) => p[0] !== polys[r][v][0] || p[1] !== polys[r][v][1]));
  if (!changed.some(Boolean)) return { ok: false, why: 'none' };
  const next = [];
  for (let r = 0; r < polys.length; r++) {
    if (!changed[r]) { next.push(polys[r]); continue; }
    const v = shift ? raw[r] : valid(raw[r]);
    if (!v || Math.sign(signed(v)) !== Math.sign(signed(polys[r]))) return { ok: false, why: 'small' };
    next.push(v);
  }
  if (!shift) {
    // Vegger som lå inntil hverandre, skal fortsatt ligge på samme linje.
    for (const [ra, ea, rb, eb] of sharedPairs(polys)) {
      if (!changed[ra] && !changed[rb]) continue;
      const p = raw[ra][ea], q = raw[ra][(ea + 1) % raw[ra].length], c = raw[rb][eb], d = raw[rb][(eb + 1) % raw[rb].length];
      const l = dist(p, q);
      if (l < 1 || dist(c, d) < 1) continue;
      const off = (z) => Math.abs((z[0] - p[0]) * (q[1] - p[1]) - (z[1] - p[1]) * (q[0] - p[0])) / l;
      if (off(c) > TOL * 1.5 || off(d) > TOL * 1.5) return { ok: false, why: 'gap' };
    }
  }
  if (coverage(next).overlap > coverage(polys).overlap + 0.5) return { ok: false, why: 'hit' };
  if (holes(next) > holes(polys) + 0.5) return { ok: false, why: 'gap' };
  const xs = next.flatMap((Q) => Q.map((p) => p[0])), ys = next.flatMap((Q) => Q.map((p) => p[1]));
  if (Math.max(...xs) - Math.min(0, ...xs) > 2500 || Math.max(...ys) - Math.min(0, ...ys) > 2500) return { ok: false, why: 'big' };
  return { ok: true, ids: rooms.map((r) => r.id), raw, next, changed, shift };
}

// Planlegger en endring uten å gjøre den. rooms = rommene på etasjen ({ id, poly }).
// edit: { kind: 'wall' | 'corner', room, i, dx, dy }, { kind: 'len', room, i, len, fromStart } eller { kind: 'move', room, dx, dy }.
// Først flyttes bare veggstykkene som må følge med. Går ikke det, prøves hele den rette veggen.
export function planEdit(rooms, edit) {
  let why = 'small';
  for (const touch of [false, true]) {
    const res = attempt(rooms, edit, touch);
    if (res.ok) return res;
    why = res.why;
    if (why === 'none' || edit.kind === 'move') break;
  }
  return { ok: false, why, msg: MSG[why] };
}

// Setter lengden på en vegg. Naboveggen flyttes i den enden som rokker ved færrest mål som alt er satt.
export function planLength(rooms, roomId, i, len) {
  const r = rooms.find((x) => x.id === roomId);
  if (!r) return { ok: false, msg: MSG.none };
  const e = edges(r.poly)[i];
  const L = clamp(snap(len), 30, 3000);
  if (!e || L === snap(e.len)) return { ok: true, same: true };
  const broken = (plan) => rooms.reduce((s, x, ri) => s + (x.fixed || []).filter((k) => {
    if ((x === r && k === i) || k >= x.poly.length) return false;
    const before = edges(x.poly)[k].len, now = dist(plan.raw[ri][k], plan.raw[ri][(k + 1) % x.poly.length]);
    return Math.abs(before - now) > 0.5;
  }).length, 0);
  const tries = [false, true].map((fromStart) => planEdit(rooms, { kind: 'len', room: roomId, i, len: L, fromStart }));
  const ok = tries.filter((t) => t.ok).sort((p, q) => broken(p) - broken(q));
  return ok[0] || tries[0];
}

// ---------- Dører og vinduer ----------

// Veggene en dør eller et vindu står i. Står den i en vegg mellom to rom, gir det to treff.
export function hostsOf(rooms, o) {
  const out = [];
  rooms.forEach((r, ri) => edges(r.poly).forEach((e, i) => {
    if (e.len < 1) return;
    const ux = (e.b[0] - e.a[0]) / e.len, uy = (e.b[1] - e.a[1]) / e.len;
    const s = (o.x - e.a[0]) * ux + (o.y - e.a[1]) * uy, off = Math.abs((o.x - e.a[0]) * uy - (o.y - e.a[1]) * ux);
    if (off <= 3 && s >= o.w / 2 - 1 && s <= e.len - o.w / 2 + 1) out.push({ ri, id: r.id, e: i, s, t: s / e.len, len: e.len, a: e.a, u: [ux, uy] });
  }));
  return out;
}

const round1 = (v) => Math.round(v * 10) / 10;

// Legger en åpning på en vegg, med midten s cm fra veggens første hjørne. Holder den innenfor veggen.
export function placeOn(poly, e, s, w) {
  const ed = edges(poly)[e];
  if (!ed || ed.len < 40) return null;
  const width = Math.min(w, Math.floor(ed.len));
  const at = clamp(s, width / 2, ed.len - width / 2);
  const u = [(ed.b[0] - ed.a[0]) / ed.len, (ed.b[1] - ed.a[1]) / ed.len];
  return { x: round1(ed.a[0] + u[0] * at), y: round1(ed.a[1] + u[1] * at), w: width };
}

// Skriver åpningene inn i rommene de hører til (room.doors), og fjerner åpninger som ikke lenger står i en vegg.
// Resten av appen leser room.doors, så den trenger ikke vite at en dør kan høre til to rom.
export function syncDoors(state) {
  const drawn = state.rooms.filter((r) => r.poly);
  for (const r of drawn) r.doors = [];
  const keep = [];
  for (const o of state.openings || []) {
    const rooms = drawn.filter((r) => (r.floor || 0) === o.floor);
    const hosts = hostsOf(rooms, o);
    if (!hosts.length) continue;
    keep.push(o);
    for (const h of hosts) rooms[h.ri].doors.push({ e: h.e, t: h.t, w: o.w, kind: o.kind, id: o.id });
  }
  state.openings = keep;
  return state;
}

// Eldre tegninger hadde dørene lagret i hvert rom. Gjør dem om til åpninger, én per dør også i delte vegger.
export function openingsFromDoors(rooms, nextId) {
  const out = [];
  for (const r of rooms) {
    if (!r.poly) continue;
    for (const d of r.doors || []) {
      const ed = edges(r.poly)[d.e];
      if (!ed || ed.len < 1) continue;
      const w = Math.min(d.w, Math.floor(ed.len)), s = clamp(d.t * ed.len, w / 2, ed.len - w / 2);
      const x = round1(ed.a[0] + ((ed.b[0] - ed.a[0]) / ed.len) * s), y = round1(ed.a[1] + ((ed.b[1] - ed.a[1]) / ed.len) * s);
      const kind = d.kind === 'window' ? 'window' : 'door', floor = r.floor || 0;
      if (out.some((o) => o.floor === floor && Math.hypot(o.x - x, o.y - y) < Math.max(20, w / 2))) continue;
      out.push({ id: nextId(), floor, kind, w, x, y });
    }
  }
  return out;
}

// ---------- Gjøre endringen ----------

// Gjør en planlagt endring: nye former, mål som fortsatt gjelder, dører og vinduer som følger veggen,
// og møbler som skyves inn hvis en vegg ellers ville gått gjennom dem (keepInside fra arrange.js gjør det).
export function applyPlan(state, floor, plan, keepInside = null) {
  const rooms = plan.ids.map((id) => state.rooms.find((r) => r.id === id));
  const old = rooms.map((r) => r.poly);
  for (const o of state.openings || []) {
    if (o.floor !== floor) continue;
    const h = hostsOf(rooms, o)[0];
    if (!h || !plan.changed[h.ri]) continue;
    if (plan.shift) { o.x = round1(o.x + plan.shift[0]); o.y = round1(o.y + plan.shift[1]); continue; }
    const m = old[h.ri].length, a = plan.raw[h.ri][h.e], b = plan.raw[h.ri][(h.e + 1) % m], len = dist(a, b);
    if (len < 1) { o.x = -9999; continue; }
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    // Står veggen i samme retning som før, blir åpningen stående på samme sted. Ellers følger den med bortover veggen.
    const same = Math.abs(u[0] * h.u[0] + u[1] * h.u[1]) > 0.999;
    const s = clamp(same ? (o.x - a[0]) * u[0] + (o.y - a[1]) * u[1] : h.t * len, o.w / 2, Math.max(o.w / 2, len - o.w / 2));
    o.x = round1(a[0] + u[0] * s); o.y = round1(a[1] + u[1] * s);
  }
  const touched = [];
  rooms.forEach((r, ri) => {
    if (!plan.changed[ri]) return;
    const before = edges(old[ri]);
    r.poly = plan.next[ri];
    r.fixed = r.poly.length === before.length ? (r.fixed || []).filter((k) => k < before.length && Math.abs(before[k].len - edges(r.poly)[k].len) < 0.5) : [];
    for (const f of state.furn || []) {
      if (f.room !== r.id) continue;
      if (plan.shift) { f.x += plan.shift[0]; f.y += plan.shift[1]; } else if (keepInside) Object.assign(f, keepInside(r, f) || f);
    }
    touched.push(r.id);
  });
  syncDoors(state);
  return touched;
}

// ---------- Dele rom ----------

// Deler alle rom en rett strek går gjennom, langs den samme linja. I hvert rom forlenges linja til veggene.
// Et rom streken bare så vidt stikker inn i, blir ikke delt. Gir [{ id, parts: [A, B], inside }].
export function splitAlong(rooms, line) {
  const [p, q] = line, L = dist(p, q);
  if (!(L >= 30)) return [];
  const N = Math.max(8, Math.ceil(L / 10)), found = [];
  for (const r of rooms) {
    let best = null, cur = null;
    for (let i = 0; i <= N; i++) {
      const pt = [p[0] + ((q[0] - p[0]) * i) / N, p[1] + ((q[1] - p[1]) * i) / N];
      if (pointInPoly(pt, r.poly) && nearestEdge(r.poly, pt).d > 2) {
        cur = cur ? { a: cur.a, b: pt, n: cur.n + 1 } : { a: pt, b: pt, n: 1 };
        if (!best || cur.n > best.n) best = cur;
      } else cur = null;
    }
    if (!best || best.n < 3) continue;
    const got = splitPoly(r.poly, [best.a, best.b]);
    if (!got) continue;
    const chord = (perimeter(got[0]) + perimeter(got[1]) - perimeter(r.poly)) / 2; // lengden på den nye veggen
    found.push({ id: r.id, parts: got.map(canonical), inside: dist(best.a, best.b), chord });
  }
  const most = Math.max(0, ...found.map((f) => f.inside));
  return found.filter((f) => f.inside === most || f.inside >= f.chord * 0.45);
}

