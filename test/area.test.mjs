import test from 'node:test';
import assert from 'node:assert/strict';
import topo from '../geo/norge.js';
import places from '../geo/steder.js';
import { project, unproject, kmToUnits, distKm, decodeTopo, fylkerFor, searchPlaces, nearestPlace, shapeAt, shapesInCircle, FYLKE_CODE, RADII } from '../js/geo.js';
import { areaParams, areaLabel, areaPhrase, cleanNear, nearFylker } from '../js/areastate.js';
import { AREAS, ITEMS } from '../js/data.js';
import { newState, normalize, finnUrl, decorLinks, instances } from '../js/logic.js';

const geo = decodeTopo(topo);
const OSLO = '0.20061', AKERSHUS = '0.20003';
const ski = { lat: 59.7195, lon: 10.8358, km: 20, name: 'Ski', fylker: [AKERSHUS, OSLO], geo: true };

test('kartdata: 15 fylker, 357 kommuner, og alle fylker har en Finn-kode som appen kjenner', () => {
  assert.equal(geo.fylker.length, 15);
  assert.equal(geo.kommuner.length, 357);
  for (const f of geo.fylker) assert.ok(AREAS.some((a) => a.id === FYLKE_CODE[f.f]), `fylke ${f.f}`);
  assert.equal(new Set(Object.values(FYLKE_CODE)).size, 15);
});

test('projeksjon: fram og tilbake gir samme punkt, og sirkler er runde', () => {
  for (const [lon, lat] of [[10.75, 59.91], [5.32, 60.39], [18.96, 69.65], [30.05, 69.73]]) {
    const [lon2, lat2] = unproject(...project(lon, lat));
    assert.ok(Math.abs(lon - lon2) < 1e-9 && Math.abs(lat - lat2) < 1e-9);
  }
  // 20 km rett øst og rett nord skal være like langt på kartet (innen 1 %).
  const lat = 59.72, lon = 10.84, r = kmToUnits(20, lat);
  const [x0, y0] = project(lon, lat);
  const [, yN] = project(lon, lat + 20 / 111.32);
  assert.ok(Math.abs((y0 - yN) / r - 1) < 0.01);
  const east = unproject(x0 + r, y0);
  assert.ok(Math.abs(distKm(lat, lon, east[1], east[0]) - 20) < 0.2);
});

test('avstand: Oslo–Bergen er rundt 305 km', () => {
  const d = distKm(59.9139, 10.7522, 60.3913, 5.3221);
  assert.ok(d > 300 && d < 310, String(d));
});

test('stedssøk: «ski» gir byen Ski først, og tåler store bokstaver og mellomrom', () => {
  const hits = searchPlaces(places, ' SKI ');
  assert.equal(hits[0][0], 'Ski');
  assert.equal(hits[0][4], 'Nordre Follo');
  assert.ok(hits.length > 1 && hits.length <= 6);
  assert.equal(searchPlaces(places, 'tromsø')[0][0], 'Tromsø');
  assert.equal(searchPlaces(places, 'sandvik').some((p) => p[0] === 'Sandvika'), true);
  assert.deepEqual(searchPlaces(places, ''), []);
  assert.deepEqual(searchPlaces(places, 'xqzw'), []);
});

test('nærmeste sted og kommune for et punkt', () => {
  assert.equal(nearestPlace(places, 59.72, 10.835)[0], 'Ski');
  assert.equal(nearestPlace(places, 62.0, 2.0), null); // ute i havet
  assert.equal(shapeAt(geo.kommuner, 59.7195, 10.8358).n, 'Nordre Follo');
  assert.equal(shapeAt(geo.kommuner, 69.6496, 18.956).n, 'Tromsø');
});

test('fylker som sirkelen dekker', () => {
  assert.deepEqual(fylkerFor(geo.fylker, 59.7195, 10.8358, 5), [AKERSHUS]);
  assert.deepEqual(fylkerFor(geo.fylker, 59.7195, 10.8358, 20), ['0.20002', AKERSHUS, OSLO]); // Østfold, Akershus, Oslo
  assert.deepEqual(fylkerFor(geo.fylker, 59.9139, 10.7522, 5), [OSLO]);
  assert.deepEqual(fylkerFor(geo.fylker, 69.6496, 18.956, 20), [FYLKE_CODE[55]]); // Troms
  assert.ok(fylkerFor(geo.fylker, 59.7195, 10.8358, 100).length >= 4);
  // Et punkt i sjøen utenfor kysten får nærmeste fylke, aldri en tom liste.
  assert.equal(fylkerFor(geo.fylker, 58.0, 6.0, 5).length, 1);
  const near = shapesInCircle(geo.kommuner, 59.7195, 10.8358, 10).map((k) => k.n);
  assert.ok(near.includes('Nordre Follo') && near.includes('Ås') && !near.includes('Bergen'));
});

test('areaParams: hele Norge, ett fylke og sirkel', () => {
  assert.deepEqual(areaParams({ area: '' }), []);
  assert.deepEqual(areaParams({ area: OSLO }), [['location', OSLO]]);
  assert.deepEqual(areaParams({ area: '', near: ski }), [['location', AKERSHUS], ['location', OSLO], ['lat', '59.7195'], ['lon', '10.8358'], ['radius', '20000']]);
  assert.deepEqual(areaParams({ area: '', near: { ...ski, geo: false } }), [['location', AKERSHUS], ['location', OSLO]]);
  assert.deepEqual(areaParams({ area: OSLO, near: ski }).filter(([k]) => k === 'location').length, 2); // sirkelen går foran
});

test('tekster for valgt område', () => {
  assert.equal(areaLabel({ area: '' }), 'Hele Norge');
  assert.equal(areaLabel({ area: OSLO }), 'Oslo');
  assert.equal(areaLabel({ near: ski }), 'Innen 20 km fra Ski');
  assert.equal(areaPhrase({ area: '' }), 'i hele Norge');
  assert.equal(areaPhrase({ area: OSLO }), 'i Oslo');
  assert.equal(areaPhrase({ near: ski }), 'innen 20 km fra Ski');
  assert.equal(areaPhrase({ near: { ...ski, geo: false } }), 'i Akershus og Oslo');
  assert.equal(nearFylker({ near: ski }), 'Akershus og Oslo');
});

test('cleanNear: slipper bare gjennom gyldige valg', () => {
  assert.deepEqual(cleanNear(ski), ski);
  assert.equal(cleanNear(null), null);
  assert.equal(cleanNear({ ...ski, km: 7 }), null);
  assert.equal(cleanNear({ ...ski, lat: 40 }), null);
  assert.equal(cleanNear({ ...ski, lat: '59.7' }), null);
  assert.equal(cleanNear({ ...ski, fylker: ['0.99999'] }), null);
  assert.equal(cleanNear({ ...ski, fylker: [] }), null);
  assert.equal(cleanNear({ ...ski, name: '' }).name, 'valgt punkt');
  assert.equal(cleanNear({ ...ski, geo: undefined }).geo, true);
  assert.equal(cleanNear({ ...ski, geo: false }).geo, false);
  assert.deepEqual(cleanNear({ ...ski, fylker: [OSLO, OSLO, 'tull'] }).fylker, [OSLO]);
  for (const km of RADII) assert.equal(cleanNear({ ...ski, km }).km, km);
});

test('normalize: gamle lister med fylkeskode virker som før, og kartvalget overlever lagring', () => {
  const old = normalize({ ...newState(), area: OSLO });
  assert.equal(old.area, OSLO);
  assert.equal(old.near, null);
  assert.deepEqual(areaParams(old), [['location', OSLO]]);
  const s = normalize(JSON.parse(JSON.stringify({ ...newState(), area: '', near: ski })));
  assert.deepEqual(s.near, ski);
  assert.equal(normalize({ ...newState(), near: { lat: 1, lon: 2, km: 3 } }).near, null);
  assert.equal(normalize({ ...newState(), near: 'Ski' }).near, null);
});

test('Finn-lenkene bruker området: alle fylkene, og sirkelen når den er på', () => {
  const base = { ...newState(), near: ski };
  const inst = instances(base).find((i) => i.st === 'need') || instances(base)[0];
  for (const mode of ['all', 'today', 'free']) {
    const u = new URL(finnUrl(inst, base, mode));
    assert.deepEqual(u.searchParams.getAll('location'), [AKERSHUS, OSLO]);
    assert.equal(u.searchParams.get('lat'), '59.7195');
    assert.equal(u.searchParams.get('lon'), '10.8358');
    assert.equal(u.searchParams.get('radius'), '20000');
  }
  const off = new URL(finnUrl(inst, { ...base, near: { ...ski, geo: false } }, 'all'));
  assert.deepEqual(off.searchParams.getAll('location'), [AKERSHUS, OSLO]);
  assert.equal(off.searchParams.has('lat') || off.searchParams.has('radius'), false);
  const fy = new URL(finnUrl(inst, { ...newState(), area: OSLO }, 'all'));
  assert.deepEqual(fy.searchParams.getAll('location'), [OSLO]);
  assert.equal(new URL(finnUrl(inst, newState(), 'all')).searchParams.has('location'), false);
  assert.ok(ITEMS[inst.itemId] || inst.item);
});

test('pyntelenkene bruker samme område', () => {
  const links = decorLinks({ ...newState(), near: ski });
  assert.ok(links.length > 0);
  for (const l of links) {
    const u = new URL(l.url || l.href);
    assert.deepEqual(u.searchParams.getAll('location'), [AKERSHUS, OSLO]);
    assert.equal(u.searchParams.get('radius'), '20000');
  }
});
