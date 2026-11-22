// «Sett ut alt for meg»: et fornuftig utgangspunkt for møbleringen av ett rom. Ren logikk uten DOM.
// Møbler står rett (0 eller 90 grader) inntil rette vegger. Det som ikke får en god plass, blir stående igjen.
import { edges, pointInPoly, opening, labelPoint } from './plan.js';
import { FOOT } from './data.js';
import { instances, footprint, isCorner } from './logic.js';

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

// ---------- Hjørnesofa ----------
// w og d er målene på hele vinkelen. corner sier hvilket hjørne av den som er åpent, sett på tegningen
// ('nw', 'ne', 'sw', 'se'). Sofaen er da de to armene langs sidene motsatt det åpne hjørnet.

export const armOf = (f) => Math.max(20, Math.min(95, f.w - 20, f.d - 20)); // dybden på hver arm

// Flatene møbelet dekker: én for vanlige møbler, to armer for en hjørnesofa.
export function boxesOf(f) {
  const b = boxOf(f);
  if (!f.corner) return [b];
  const t = armOf(f);
  return [
    f.corner.includes('n') ? [b[0], b[3] - t, b[2], b[3]] : [b[0], b[1], b[2], b[1] + t], // armen langs nord- eller sørsiden
    f.corner.includes('e') ? [b[0], b[1], b[0] + t, b[3]] : [b[2] - t, b[1], b[2], b[3]], // armen langs vest- eller østsiden
  ];
}

// Åpent hjørne når ryggen står mot en vegg med retning n inn i rommet. Vinkelen peker da ut i rommet.
export const notchFor = (n) => (n[1] > 0 ? 'se' : n[1] < 0 ? 'ne' : n[0] > 0 ? 'se' : 'sw');

// Snu 90 grader med klokka: det åpne hjørnet flytter seg ett hakk rundt.
export const turnCorner = (c) => ({ nw: 'ne', ne: 'se', se: 'sw', sw: 'nw' }[c]);

// Speilvend: ryggen står der den sto, men vinkelen bytter side.
export function flipCorner(f) {
  const c = f.corner;
  if (!c) return c;
  return f.r === 90 ? (c[0] === 'n' ? 's' : 'n') + c[1] : c[0] + (c[1] === 'e' ? 'w' : 'e');
}

// Det åpne hjørnet sett fra møbelets egen ramme (før det er snudd), til bruk når det tegnes.
export function localNotch(f) {
  if (f.r !== 90) return f.corner;
  return (f.corner[1] === 'e' ? 'n' : 's') + (f.corner[0] === 'n' ? 'w' : 'e');
}

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

// Veggen et møbel står med ryggen mot, eller undefined når det står fritt.
function backWallOf(walls, f) {
  return walls.find((wall) => (wall.o === 'H') === (f.r !== 90)
    && Math.abs((f.x - wall.a[0]) * wall.n[0] + (f.y - wall.a[1]) * wall.n[1] - f.d / 2) <= 40
    && (() => { const t = (f.x - wall.a[0]) * wall.u[0] + (f.y - wall.a[1]) * wall.u[1]; return t >= 0 && t <= wall.len; })());
}

// Setter ut møbler i ett rom.
// room: { poly, doors }. wants: [{ item, w, d, qty }]. existing: møbler som alt står i rommet ({ item, x, y, w, d, r }).
// Gir { placed: [{ item, x, y, w, d, r }], skipped: [item, ...] }.
export function arrangeRoom(room, wants, existing = []) {
  const poly = room.poly;
  const walls = wallsOf(poly), zones = zonesOf(room);
  const taken = existing.map((f) => ({ boxes: boxesOf(f), rug: f.item === 'teppe', f }));
  const left = wants.map((w) => ({ ...w })).filter((w) => w.qty > 0 && w.w > 0 && w.d > 0);
  const placed = [];
  const want = (id) => left.find((w) => w.item === id && w.qty > 0);
  const standing = (id) => [...placed, ...existing].find((f) => f.item === id);

  const fits = (f, { rug = false, tall = false, pad = 5 } = {}) => {
    const b = boxOf(f);
    if (!insideRoom(poly, b)) return false;
    if (zones.some((z) => (!z.window || tall) && hits(b, z.box))) return false;
    return rug || !taken.some((t) => !t.rug && t.boxes.some((tb) => hits(b, tb, pad)));
  };
  const put = (w, f, opts) => {
    if (!f || !fits(f, opts)) return null;
    const piece = { item: w.item, x: Math.round(f.x), y: Math.round(f.y), w: w.w, d: w.d, r: f.r, ...(w.s ? { s: w.s } : {}), ...(f.corner ? { corner: f.corner } : {}) };
    placed.push(piece); taken.push({ boxes: boxesOf(piece), rug: w.item === 'teppe', f: piece });
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
  const backWall = (f) => backWallOf(walls, f);
  const inFront = (f, wall, w, gap) => ({ x: f.x + wall.n[0] * (f.d / 2 + gap + w.d / 2), y: f.y + wall.n[1] * (f.d / 2 + gap + w.d / 2), w: w.w, d: w.d, r: f.r });
  // Foran en hjørnesofa betyr inne i vinkelen: foran ryggarmen, ved siden av den andre armen.
  const inAngle = (f, wall, w, gap) => {
    const t = armOf(f);
    const side = wall.o === 'H' ? (f.corner.includes('e') ? 1 : -1) * Math.sign(wall.u[0]) : (f.corner.includes('s') ? 1 : -1) * Math.sign(wall.u[1]);
    const out = -f.d / 2 + t + gap + w.d / 2; // fra midten av vinkelen og ut i rommet
    return { x: f.x + wall.u[0] * side * t / 2 + wall.n[0] * out, y: f.y + wall.u[1] * side * t / 2 + wall.n[1] * out, w: w.w, d: w.d, r: f.r };
  };

  // 1. Sofagruppa: sofa midt på det lengste ledige veggstrekket, TV-benk rett overfor, bord foran og teppe under.
  const sofaWant = want('sofa') || (!standing('sofa') && want('sovesofa'));
  if (sofaWant && !standing(sofaWant.item)) {
    const hit = alongWall(sofaWant);
    if (hit) put(sofaWant, sofaWant.corner ? { ...hit.f, corner: notchFor(hit.wall.n) } : hit.f); // vinkelen peker ut i rommet
  }
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
    front = sofa.corner ? inAngle(sofa, sofaWall, bord || { w: 100, d: 60 }, 30) : inFront(sofa, sofaWall, bord || { w: 100, d: 60 }, 35);
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

// ---------- Tegningen følger lista ----------

const OLD_FOOT = { sofa: { L: [260, 100] } }; // mål fra før hjørnesofaen ble tegnet som en vinkel

// Hvilken størrelse et møbel er tegnet for. Eldre møbler mangler merket, så da leses det av målene.
function sizedFor(f, listSize) {
  if (f.s) return { s: f.s, stale: false };
  const fp = FOOT[f.item];
  if (!fp || Array.isArray(fp)) return { s: listSize, stale: false };
  const same = (a) => a && a[0] === f.w && a[1] === f.d;
  const hit = ['S', 'M', 'L'].find((k) => same(fp[k]));
  if (hit) return { s: hit, stale: false };
  const old = Object.keys(OLD_FOOT[f.item] || {}).find((k) => same(OLD_FOOT[f.item][k]));
  return old ? { s: old, stale: true } : { s: listSize, stale: false }; // ellers har brukeren skrevet egne mål
}

// Gir møbelet nye mål. Står det med ryggen mot en vegg, blir ryggen stående der, og møbelet skyves langs
// veggen hvis det ellers ville stukket ut av rommet eller inn i en dør. Står det fritt, beholder det midtpunktet.
function resized(room, f, fp, corner) {
  const next = { ...f, w: fp[0], d: fp[1] };
  const walls = wallsOf(room.poly);
  const wall = backWallOf(walls, f);
  if (wall) {
    const zones = zonesOf(room).filter((z) => !z.window);
    const gap = Math.max(0, (f.x - wall.a[0]) * wall.n[0] + (f.y - wall.a[1]) * wall.n[1] - f.d / 2);
    const pos0 = (f.x - wall.a[0]) * wall.u[0] + (f.y - wall.a[1]) * wall.u[1];
    const at = (pos) => ({ ...next, x: Math.round(wall.a[0] + wall.u[0] * pos + wall.n[0] * (gap + fp[1] / 2)), y: Math.round(wall.a[1] + wall.u[1] * pos + wall.n[1] * (gap + fp[1] / 2)) });
    const ok = (g) => insideRoom(room.poly, boxOf(g)) && !zones.some((z) => hits(boxOf(g), z.box));
    let best = at(pos0);
    if (!ok(best)) {
      for (let step = 10; step <= wall.len; step += 10) {
        const c = [at(pos0 - step), at(pos0 + step)].find(ok);
        if (c) { best = c; break; }
      }
    }
    next.x = best.x; next.y = best.y;
  }
  if (corner) next.corner = f.corner || (wall ? notchFor(wall.n) : 'se'); else delete next.corner;
  return next;
}

// Holder møblene på tegningen i takt med lista. Kalles etter hver endring.
// - Ting som ikke lenger er med på lista, tas bort (kjøpte ting blir stående).
// - Står det flere enn antallet på lista, tas de sist utsatte bort.
// - Er størrelsen på lista endret, får møbelet nye mål (og hjørnesofa blir en vinkel).
// Gir samme liste tilbake når ingenting må endres, og rører aldri møbler som alt stemmer.
export function syncFurniture(state) {
  const furn = state.furn || [];
  if (!furn.length) return furn;
  const byKey = new Map(instances(state).map((i) => [`${i.room.id}:${i.itemId}`, i]));
  const seen = new Map(), drop = new Set();
  for (const f of [...furn].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))) { // eldste først
    const key = `${f.room}:${f.item}`, inst = byKey.get(key);
    if (!inst || (inst.st !== 'need' && inst.st !== 'bought')) { drop.add(f.id); continue; }
    const n = (seen.get(key) || 0) + 1;
    if (n > inst.qty) drop.add(f.id); else seen.set(key, n);
  }
  let changed = drop.size > 0;
  const out = [];
  for (const f of furn) {
    if (drop.has(f.id)) continue;
    const inst = byKey.get(`${f.room}:${f.item}`);
    const room = state.rooms.find((r) => r.id === f.room);
    const fp = footprint(f.item, inst.size);
    if (!fp || !room?.poly) { out.push(f); continue; }
    const { s, stale } = sizedFor(f, inst.size);
    const was = footprint(f.item, s), corner = isCorner(f.item, inst.size);
    const moved = s !== inst.size && (!was || was[0] !== fp[0] || was[1] !== fp[1] || corner !== !!f.corner);
    if (stale || moved) { out.push({ ...resized(room, f, fp, corner), s: inst.size }); changed = true; }
    else if (!f.s) { out.push({ ...f, s }); changed = true; } // merk eldre møbler, uten å røre målene
    else out.push(f);
  }
  return changed ? out : furn;
}
