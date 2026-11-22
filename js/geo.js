// Kartmatematikk uten DOM, så den kan testes i Node: projeksjon, avstander, søk i stedsnavn
// og hvilke fylker en sirkel dekker.

// Fylkesnummer -> områdekode på Finn (samme koder som AREAS i data.js).
export const FYLKE_CODE = {
  '03': '0.20061', 11: '0.20012', 15: '0.20015', 18: '0.20018', 31: '0.20002', 32: '0.20003', 33: '0.20007', 34: '0.22034',
  39: '0.20008', 40: '0.20009', 42: '0.22042', 46: '0.22046', 50: '0.20016', 55: '0.20019', 56: '0.20020',
};
export const RADII = [5, 10, 20, 30, 50, 100];

const RAD = Math.PI / 180;
export const SCALE = 1000; // kartenheter per grad lengde

// Mercator: former blir riktige lokalt, så en sirkel på kartet er en sirkel i terrenget.
export function project(lon, lat) {
  return [lon * SCALE, -Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD * SCALE];
}
export function unproject(x, y) {
  return [x / SCALE, (2 * Math.atan(Math.exp((-y / SCALE) * RAD)) - Math.PI / 2) / RAD];
}
// Radius i kartenheter for en sirkel på km kilometer ved denne breddegraden.
export const kmToUnits = (km, lat) => (km / (111.32 * Math.cos(lat * RAD))) * SCALE;

export function distKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

// Pakker ut TopoJSON til rene ringer med [lengde, bredde].
export function decodeTopo(topo) {
  const { scale, translate } = topo.transform;
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
  });
  const ring = (ids) => {
    const out = [];
    for (const id of ids) {
      const a = id < 0 ? [...arcs[~id]].reverse() : arcs[id];
      for (let i = out.length ? 1 : 0; i < a.length; i++) out.push(a[i]);
    }
    return out;
  };
  const rings = (g) => (g.type === 'Polygon' ? g.arcs.map(ring) : g.type === 'MultiPolygon' ? g.arcs.flatMap((p) => p.map(ring)) : []);
  return {
    kommuner: topo.objects.kommuner.geometries.map((g) => ({ n: g.properties.n, k: g.properties.k, f: g.properties.f, rings: rings(g) })),
    fylker: topo.objects.fylker.geometries.map((g) => ({ f: g.properties.f, rings: rings(g) })),
  };
}

export function centroid(ring) {
  let x = 0, y = 0, a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const f = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    x += (ring[i][0] + ring[i + 1][0]) * f; y += (ring[i][1] + ring[i + 1][1]) * f; a += f;
  }
  return a ? [x / (3 * a), y / (3 * a)] : ring[0];
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Hull i flater (innsjøer, enklaver) telles med partall-regelen: inne i et odde antall ringer = inne.
export const inShape = (shape, lat, lon) => shape.rings.reduce((n, r) => n + (inRing(lon, lat, r) ? 1 : 0), 0) % 2 === 1;

// Korteste avstand i km fra et punkt til kanten av en flate (regnet flatt rundt punktet, godt nok under 200 km).
function edgeKm(shape, lat, lon) {
  const kx = 111.32 * Math.cos(lat * RAD), ky = 110.57;
  let best = Infinity;
  for (const ring of shape.rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const ax = (ring[i][0] - lon) * kx, ay = (ring[i][1] - lat) * ky, bx = (ring[i + 1][0] - lon) * kx, by = (ring[i + 1][1] - lat) * ky;
      const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy;
      const t = len2 ? Math.min(1, Math.max(0, -(ax * vx + ay * vy) / len2)) : 0;
      const d = Math.hypot(ax + vx * t, ay + vy * t);
      if (d < best) best = d;
    }
  }
  return best;
}

// Flatene (fylker eller kommuner) som en sirkel berører.
export function shapesInCircle(shapes, lat, lon, km) {
  return shapes.filter((s) => inShape(s, lat, lon) || edgeKm(s, lat, lon) <= km);
}
export const shapeAt = (shapes, lat, lon) => shapes.find((s) => inShape(s, lat, lon)) || null;

// Finn-koder for fylkene sirkelen dekker. Ligger punktet i sjøen uten land innen rekkevidde, blir det nærmeste fylke.
export function fylkerFor(fylker, lat, lon, km) {
  let hit = shapesInCircle(fylker, lat, lon, km);
  if (!hit.length) hit = [fylker.reduce((a, s) => (edgeKm(s, lat, lon) < edgeKm(a, lat, lon) ? s : a), fylker[0])];
  return hit.map((s) => FYLKE_CODE[s.f]).filter(Boolean).sort();
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9æøå ]/g, ' ').replace(/\s+/g, ' ').trim();

// Søk i stedsnavn. Steder er [navn, bredde, lengde, type, kommune, fylkesnummer]; lavere type er viktigere.
// Treff som begynner med søket kommer først, deretter viktigste type, deretter korteste navn.
export function searchPlaces(places, query, limit = 6) {
  const q = norm(query);
  if (q.length < 2) return [];
  const hits = [];
  for (const p of places) {
    const n = norm(p[0]);
    const at = n.indexOf(q);
    if (at < 0) continue;
    const word = at === 0 || n[at - 1] === ' ';
    hits.push([n === q ? 0 : at === 0 ? 1 : word ? 2 : 3, p]);
  }
  hits.sort((a, b) => a[0] - b[0] || a[1][3] - b[1][3] || a[1][0].length - b[1][0].length || a[1][0].localeCompare(b[1][0], 'nb'));
  return hits.slice(0, limit).map((h) => h[1]);
}

export function nearestPlace(places, lat, lon, maxKm = 8, maxType = 6) {
  let best = null, d = maxKm;
  for (const p of places) {
    if (p[3] > maxType || Math.abs(p[1] - lat) > 0.2) continue;
    const k = distKm(lat, lon, p[1], p[2]) + p[3] * 0.25; // litt fordel til viktigere steder
    if (k < d) { d = k; best = p; }
  }
  return best;
}
