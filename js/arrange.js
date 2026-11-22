// «Sett ut alt for meg»: et fornuftig utgangspunkt for møbleringen av ett rom. Ren logikk uten DOM.
// Møbler står rett (0 eller 90 grader) inntil rette vegger. Det som ikke får en god plass, blir stående igjen.
import { edges, pointInPoly, opening, labelPoint } from './plan.js';

const GAP = 5;                       // luft mellom møbel og vegg
const TALL = ['garderobe', 'bokhylle']; // høye ting skal ikke stå foran vinduer
// Ting som settes langs ledige veggstrekk, de største først. 'center' = midt på strekket, 'corner' = inn mot et hjørne.
const ALONG = [
  ['garderobe', 'corner'], ['sovesofa', 'center'], ['gjesteseng', 'corner'], ['barneseng', 'corner'], ['skrivebord', 'corner'],
  ['kommode', 'center'], ['bokhylle', 'corner'], ['tvbenk', 'center'], ['benk', 'center'], ['skohylle', 'corner'],
  ['lekekasse', 'corner'], ['kjokkentralle', 'corner'], ['badhylle', 'corner'], ['lenestol', 'corner'], ['gulvlampe', 'corner'],
];

export const boxOf = (f) => {
  const hw = (f.r === 90 ? f.d : f.w) / 2, hh = (f.r === 90 ? f.w : f.d) / 2;
  return [f.x - hw, f.y - hh, f.x + hw, f.y + hh];
};
const hits = (a, b, pad = 0) => a[0] < b[2] + pad && a[2] > b[0] - pad && a[1] < b[3] + pad && a[3] > b[1] - pad;

// Rette vegger med retning langs veggen (u) og inn i rommet (n).
function wallsOf(poly) {
  return edges(poly).map((e, i) => {
    const o = e.a[1] === e.b[1] ? 'H' : e.a[0] === e.b[0] ? 'V' : null;
    if (!o || e.len < 1) return null;
    const u = [(e.b[0] - e.a[0]) / e.len, (e.b[1] - e.a[1]) / e.len];
    const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    let n = [-u[1] + 0, u[0] + 0];
    if (!pointInPoly([mid[0] + n[0] * 8, mid[1] + n[1] * 8], poly)) n = [u[1] + 0, -u[0] + 0];
    return { i, a: e.a, len: e.len, o, u, n };
  }).filter(Boolean);
}

// Områder som må holdes fri: døråpningen med slagfeltet innenfor, og et belte foran vinduer (bare for høye ting).
function zonesOf(room) {
  return (room.doors || []).map((d) => {
    const o = opening(room.poly, d);
    if (!o) return null;
    const depth = d.kind === 'window' ? 60 : o.half * 2;
    const pts = [-1, 1].flatMap((s) => [[o.p[0] + o.u[0] * o.half * s, o.p[1] + o.u[1] * o.half * s], [o.p[0] + o.u[0] * o.half * s + o.n[0] * depth, o.p[1] + o.u[1] * o.half * s + o.n[1] * depth]]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { e: d.e, window: d.kind === 'window', box: [Math.min(...xs) - 5, Math.min(...ys) - 5, Math.max(...xs) + 5, Math.max(...ys) + 5], along: [o.p, o.half] };
  }).filter(Boolean);
}

function insideRoom(poly, b) {
  const [x0, y0, x1, y1] = [b[0] + 1, b[1] + 1, b[2] - 1, b[3] - 1];
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const probe = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [mx, y0], [mx, y1], [x0, my], [x1, my], [mx, my]];
  if (!probe.every((p) => pointInPoly(p, poly))) return false;
  return !poly.some(([x, y]) => x > x0 && x < x1 && y > y0 && y < y1); // et hjørne i rommet stikker inn i møbelet
}

// Setter ut møbler i ett rom.
// room: { poly, doors }. wants: [{ item, w, d, qty }]. existing: møbler som alt står i rommet ({ item, x, y, w, d, r }).
// Gir { placed: [{ item, x, y, w, d, r }], skipped: [item, ...] }.
export function arrangeRoom(room, wants, existing = []) {
  const poly = room.poly;
  const walls = wallsOf(poly), zones = zonesOf(room);
  const taken = existing.map((f) => ({ box: boxOf(f), rug: f.item === 'teppe', f }));
  const left = wants.map((w) => ({ ...w })).filter((w) => w.qty > 0 && w.w > 0 && w.d > 0);
  const placed = [];
  const want = (id) => left.find((w) => w.item === id && w.qty > 0);
  const standing = (id) => [...placed, ...existing].find((f) => f.item === id);

  const fits = (f, { rug = false, tall = false, pad = 5 } = {}) => {
    const b = boxOf(f);
    if (!insideRoom(poly, b)) return false;
    if (zones.some((z) => (!z.window || tall) && hits(b, z.box))) return false;
    return rug || !taken.some((t) => !t.rug && hits(b, t.box, pad));
  };
  const put = (w, f, opts) => {
    if (!f || !fits(f, opts)) return null;
    const piece = { item: w.item, x: Math.round(f.x), y: Math.round(f.y), w: w.w, d: w.d, r: f.r };
    placed.push(piece); taken.push({ box: boxOf(piece), rug: w.item === 'teppe', f: piece });
    w.qty -= 1;
    return piece;
  };
  const onWall = (wall, pos, w) => ({
    x: wall.a[0] + wall.u[0] * pos + wall.n[0] * (GAP + w.d / 2), y: wall.a[1] + wall.u[1] * pos + wall.n[1] * (GAP + w.d / 2), w: w.w, d: w.d, r: wall.o === 'H' ? 0 : 90,
  });

  // Veggstrekk uten dører (og uten vinduer for høye ting), lengste først.
  const stretches = (tall, only) => {
    const out = [];
    for (const wall of only || walls) {
      let free = [[0, wall.len]];
      for (const z of zones) {
        if (z.e !== wall.i || (z.window && !tall)) continue;
        const c = (z.along[0][0] - wall.a[0]) * wall.u[0] + (z.along[0][1] - wall.a[1]) * wall.u[1];
        const [s, e] = [c - z.along[1] - 10, c + z.along[1] + 10];
        free = free.flatMap(([a, b]) => (e <= a || s >= b ? [[a, b]] : [[a, s], [e, b]].filter(([p, q]) => q - p > 1)));
      }
      for (const [s, e] of free) out.push({ wall, s, e });
    }
    return out.sort((p, q) => (q.e - q.s) - (p.e - p.s));
  };
  // Prøver ønsket plass først, deretter andre plasser langs samme strekk, så neste strekk.
  const alongWall = (w, { prefer = 'center', only, room: need = 0, tall = false } = {}) => {
    for (const st of stretches(tall, only)) {
      const lo = st.s + w.w / 2 + (st.s === 0 ? GAP : 0), hi = st.e - w.w / 2 - (st.e === st.wall.len ? GAP : 0);
      if (hi < lo || st.e - st.s < w.w + need) continue;
      const target = typeof prefer === 'number' ? Math.min(hi, Math.max(lo, prefer)) : prefer === 'center' ? (st.s + st.e) / 2 : lo;
      const slide = [];
      for (let p = lo; p <= hi; p += 10) slide.push(p);
      const far = (p) => (prefer === 'corner' ? Math.min(p - lo, hi - p) : Math.abs(p - target)); // hjørneting prøver begge ender først
      const tries = [target, ...(prefer === 'corner' ? [hi] : []), ...slide.sort((a, b) => far(a) - far(b))];
      for (const pos of tries) {
        const f = onWall(st.wall, pos, w);
        if (fits(f, { tall })) return { f, wall: st.wall, pos };
      }
    }
    return null;
  };
  // Veggen et møbel står med ryggen mot.
  const backWall = (f) => walls.find((wall) => (wall.o === 'H') === (f.r !== 90)
    && Math.abs((f.x - wall.a[0]) * wall.n[0] + (f.y - wall.a[1]) * wall.n[1] - f.d / 2) <= 40
    && (() => { const t = (f.x - wall.a[0]) * wall.u[0] + (f.y - wall.a[1]) * wall.u[1]; return t >= 0 && t <= wall.len; })());
  const inFront = (f, wall, w, gap) => ({ x: f.x + wall.n[0] * (f.d / 2 + gap + w.d / 2), y: f.y + wall.n[1] * (f.d / 2 + gap + w.d / 2), w: w.w, d: w.d, r: f.r });

  // 1. Sofagruppa: sofa midt på det lengste ledige veggstrekket, TV-benk rett overfor, bord foran og teppe under.
  const sofaWant = want('sofa') || (!standing('sofa') && want('sovesofa'));
  if (sofaWant && !standing(sofaWant.item)) { const hit = alongWall(sofaWant); if (hit) put(sofaWant, hit.f); }
  const sofa = standing('sofa') || standing('sovesofa');
  const sofaWall = sofa && backWall(sofa);
  const tv = want('tvbenk');
  if (tv && sofaWall && !standing('tvbenk')) {
    // sikt mot sofaen: plassen på den motsatte veggen som ligger rett overfor
    const facing = walls.filter((wall) => wall.n[0] === -sofaWall.n[0] && wall.n[1] === -sofaWall.n[1])
      .map((wall) => ({ wall, pos: (sofa.x - wall.a[0]) * wall.u[0] + (sofa.y - wall.a[1]) * wall.u[1] }))
      .filter(({ wall, pos }) => pos >= 0 && pos <= wall.len);
    const aimed = facing.map(({ wall, pos }) => alongWall(tv, { only: [wall], prefer: pos })).find(Boolean);
    if (aimed) put(tv, aimed.f);
  }
  const bord = want('sofabord');
  let front = null;
  if (sofaWall) {
    front = inFront(sofa, sofaWall, bord || { w: 100, d: 60 }, 35);
    if (bord && !standing('sofabord')) put(bord, front);
  }
  const rug = want('teppe');
  if (rug && !standing('teppe')) {
    const c = front && fits({ ...front, w: rug.w, d: rug.d }, { rug: true }) ? front : null;
    const mid = labelPoint(poly);
    const tries = c ? [{ ...c, w: rug.w, d: rug.d }] : [{ x: mid[0], y: mid[1], w: rug.w, d: rug.d, r: 0 }, { x: mid[0], y: mid[1], w: rug.w, d: rug.d, r: 90 }];
    for (const f of tries) if (put(rug, f, { rug: true })) break;
  }

  // 2. Seng med hodeenden midt på et ledig veggstrekk, helst med plass til nattbord på begge sider.
  const bedWant = want('seng'), nb = want('nattbord');
  if (bedWant && !standing('seng')) {
    const sides = nb ? Math.min(2, nb.qty) * (nb.w + GAP) : 0;
    const hit = alongWall(bedWant, { room: sides }) || alongWall(bedWant);
    if (hit) put(bedWant, hit.f);
  }
  const bed = standing('seng');
  const bedWall = bed && backWall(bed);
  if (nb && bedWall) {
    const pos = (bed.x - bedWall.a[0]) * bedWall.u[0] + (bed.y - bedWall.a[1]) * bedWall.u[1];
    for (const side of [-1, 1]) if (nb.qty > 0) put(nb, onWall(bedWall, pos + side * (bed.w / 2 + nb.w / 2 + GAP), nb));
  }

  // 3. Spisebord og utemøbler står fritt: nærmest midten av rommet, med plass til stoler rundt.
  for (const [id, air] of [['spisebord', 60], ['utemobler', 30]]) {
    const w = want(id);
    if (!w || standing(id)) continue;
    const mid = labelPoint(poly);
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const wide = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    let best = null;
    for (const r of wide ? [0, 90] : [90, 0]) {
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 20) {
        for (let y = Math.min(...ys); y <= Math.max(...ys); y += 20) {
          const f = { x, y, w: w.w, d: w.d, r };
          const b = boxOf(f), room2 = air * 0.75; // litt luft til veggene også, så stolene får plass
          if (!fits(f, { pad: air }) || !insideRoom(poly, [b[0] - room2, b[1] - room2, b[2] + room2, b[3] + room2])) continue;
          const score = Math.hypot(x - mid[0], y - mid[1]) + (r === (wide ? 0 : 90) ? 0 : 15);
          if (!best || score < best.score) best = { f, score };
        }
      }
    }
    if (best) put(w, best.f, { pad: air });
  }

  // 4. Resten langs ledige veggstrekk.
  for (const [id, prefer] of ALONG) {
    const w = want(id);
    if (!w) continue;
    while (w.qty > 0) {
      const hit = alongWall(w, { prefer, tall: TALL.includes(id) });
      if (!hit || !put(w, hit.f, { tall: TALL.includes(id) })) break;
    }
  }
  // 5. Kontorstol foran skrivebordet.
  const chair = want('kontorstol'), desk = standing('skrivebord'), deskWall = desk && backWall(desk);
  if (chair && deskWall) put(chair, inFront(desk, deskWall, chair, 10));

  return { placed, skipped: left.filter((w) => w.qty > 0).map((w) => w.item) };
}
