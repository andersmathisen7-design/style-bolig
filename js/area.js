// «Hvor vil du lete?»: velg et punkt og en avstand på et kart over Norge.
// Kartet tegnes fra filer som ligger i appen (geo/), så ingenting hentes fra andre tjenester.
import { AREAS } from './data.js';
import { project, unproject, kmToUnits, decodeTopo, fylkerFor, searchPlaces, nearestPlace, shapeAt, RADII } from './geo.js';
import { areaLabel, nearFylker, cleanNear } from './areastate.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Hele fastlandet, i kartenheter. Kartet er litt høyere enn det er bredt, som landet.
const ASPECT = 1.15;
const [X0, Y0] = project(3.6, 71.5), [X1, Y1] = project(32.0, 57.4);
const FULL = { cx: (X0 + X1) / 2, cy: (Y0 + Y1) / 2, w: Math.max(X1 - X0, (Y1 - Y0) / ASPECT) * 1.04 };
const MIN_W = 160; // ca. 9 km bredt utsnitt
const TYPE = ['by', 'kommune', 'tettsted', 'bydel', 'bydel', 'område', 'bygd'];
// Byene som vises når hele landet er i bildet.
const MAJOR = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Kristiansand', 'Tromsø', 'Bodø', 'Ålesund', 'Alta', 'Narvik', 'Kirkenes', 'Mo i Rana', 'Hammerfest', 'Namsos', 'Førde', 'Lillehammer'];

const pick = { open: false, data: null, loading: false, error: '', view: { ...FULL }, hits: [], q: '', km: 20 };
export const areaPicker = pick; // for tester

const mapEl = () => document.getElementById('areamap');
const mapPx = () => mapEl()?.getBoundingClientRect().width || Math.min(window.innerWidth, 720) - 70;

function ringPath(ring) {
  let px = 0, py = 0, d = '';
  ring.forEach(([lon, lat], i) => {
    const [fx, fy] = project(lon, lat), x = Math.round(fx), y = Math.round(fy);
    if (!i) d += `M${x} ${y}l`; else if (x !== px || y !== py) d += `${x - px} ${y - py} `;
    px = x; py = y;
  });
  return `${d}z`;
}

// Grensene er store. De legges én gang i et skjult <svg> utenfor appen og vises med <use>,
// så de ikke må tolkes på nytt hver gang siden tegnes.
function mountShapes(d) {
  document.getElementById('ar-defs')?.remove();
  const host = document.createElement('div');
  host.innerHTML = `<svg id="ar-defs" width="0" height="0" aria-hidden="true" style="position:absolute"><defs>
    <path id="ar-land" fill-rule="evenodd" d="${d.fylker.map((f) => f.rings.map(ringPath).join('')).join('')}"/>
    <path id="ar-kom" d="${d.kommuner.map((k) => k.rings.map(ringPath).join('')).join('')}"/>
  </defs></svg>`;
  document.body.appendChild(host.firstChild);
}

async function load(ctx) {
  if (pick.data || pick.loading) return;
  pick.loading = true; pick.error = '';
  try {
    const [topo, places] = await Promise.all([import('../geo/norge.js'), import('../geo/steder.js')]);
    const d = decodeTopo(topo.default);
    mountShapes(d);
    pick.data = { ...d, places: places.default };
  } catch {
    pick.error = 'Kartet kunne ikke lastes. Du kan fortsatt velge et fylke under.';
  }
  pick.loading = false;
  ctx.later();
}

const viewBox = (v) => `${(v.cx - v.w / 2).toFixed(0)} ${(v.cy - (v.w * ASPECT) / 2).toFixed(0)} ${v.w.toFixed(0)} ${(v.w * ASPECT).toFixed(0)}`;
function setView(v) {
  const w = clamp(v.w, MIN_W, FULL.w);
  pick.view = { w, cx: clamp(v.cx, X0, X1), cy: clamp(v.cy, Y0, Y1) };
  const svg = mapEl();
  if (!svg) return;
  svg.setAttribute('viewBox', viewBox(pick.view));
  svg.style.setProperty('--u', (w / mapPx()).toFixed(3));
}
const viewFor = (near) => { const [x, y] = project(near.lon, near.lat); return { cx: x, cy: y, w: Math.max(kmToUnits(near.km, near.lat) * 3.2, MIN_W) }; };
// Sørger for at hele sirkelen synes, og at den ikke blir en prikk.
function fit(near, recentre) {
  const [x, y] = project(near.lon, near.lat), r = kmToUnits(near.km, near.lat), v = pick.view;
  const inside = Math.abs(x - v.cx) + r < v.w / 2 && Math.abs(y - v.cy) + r < (v.w * ASPECT) / 2;
  if (recentre || !inside || v.w > r * 12) setView(viewFor(near));
}

// Stedsnavn som får plass i utsnittet: de viktigste først, og ingen oppå hverandre eller under knappene.
function labels(v, u) {
  const deg = v.w / 1000;
  const maxType = deg > 9 ? -1 : deg > 4 ? 0 : deg > 1.5 ? 2 : deg > 0.6 ? 4 : 6;
  const h2 = (v.w * ASPECT) / 2, [x0, y0, x1, y1] = [v.cx - v.w / 2, v.cy - h2, v.cx + v.w / 2, v.cy + h2];
  const cand = [];
  for (const p of pick.data.places) {
    const major = p[3] === 0 ? MAJOR.indexOf(p[0]) : -1;
    if (major < 0 && p[3] > maxType) continue;
    const [x, y] = project(p[2], p[1]);
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    cand.push({ p, x, y, rank: major >= 0 ? major - 100 : p[3] });
  }
  cand.sort((a, b) => a.rank - b.rank || a.p[0].length - b.p[0].length);
  const placed = [[x1 - 64 * u, y1 - 172 * u, x1, y1]]; // zoomknappene
  const hit = (box) => box[0] < x0 || box[2] > x1 || placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
  const seen = new Set(), out = [];
  for (const c of cand) {
    if (out.length >= 24) break;
    if (seen.has(c.p[0])) continue;
    const big = c.rank <= 0, w = (c.p[0].length * (big ? 7.1 : 6.4) + 8) * u, h = 16 * u;
    const right = [c.x - 4 * u, c.y - h / 2, c.x + w, c.y + h / 2], left = [c.x - w, c.y - h / 2, c.x + 4 * u, c.y + h / 2];
    const side = !hit(right) ? 1 : !hit(left) ? -1 : 0; // navnet til høyre for prikken, ellers til venstre
    if (!side) continue;
    placed.push(side > 0 ? right : left); seen.add(c.p[0]);
    out.push(`<circle class="ar-pd" cx="${c.x.toFixed(0)}" cy="${c.y.toFixed(0)}" r="${(2.2 * u).toFixed(1)}"/><text class="ar-pn${big ? ' big' : ''}" x="${(c.x + side * 6 * u).toFixed(0)}" y="${(c.y + 4 * u).toFixed(0)}"${side < 0 ? ' text-anchor="end"' : ''} font-size="${((big ? 13 : 11.5) * u).toFixed(1)}" stroke-width="${(3 * u).toFixed(1)}">${esc(c.p[0])}</text>`);
  }
  return out.join('');
}

function mapSvg(state) {
  const v = pick.view, n = state.near, u = v.w / mapPx();
  let ring = '';
  if (n) {
    const [x, y] = project(n.lon, n.lat), r = kmToUnits(n.km, n.lat);
    ring = `<circle class="ar-ring" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}"/><circle class="ar-dot" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(5 * u).toFixed(1)}"/>`;
  }
  return `<svg id="areamap" class="ar-map" viewBox="${viewBox(v)}" style="--u:${u.toFixed(3)}" role="img" aria-label="Kart over Norge. ${esc(areaLabel(state))}.">
    <use href="#ar-land" class="ar-land"/><use href="#ar-kom" class="ar-kom"/><use href="#ar-land" class="ar-fy"/>
    ${ring}${labels(v, u)}
  </svg>`;
}

const hitList = () => pick.hits.map((p, i) => `<button class="ar-hit" data-act="areahit" data-v="${i}">${esc(p[0])}<small>${TYPE[p[3]]}${p[4] && p[4] !== p[0] ? ` i ${esc(p[4])}` : ''}</small></button>`).join('');

// Feltet på steg 1. Lukket: valgt område og en knapp. Åpent: søk, kart og avstand.
export function areaField(state) {
  const n = state.near;
  const all = n || state.area ? '<button class="link ar-all" data-act="areaall">Let i hele Norge</button>' : '';
  if (!pick.open) {
    return `
  <div class="ar-field">
    <span class="q-label">Hvor vil du lete?</span>
    <p class="ar-now">${esc(areaLabel(state))}${n ? `<small>${esc(nearFylker(state))}</small>` : ''}</p>
    ${n && n.geo !== false ? `<p class="hint">Finn får alltid ${n.fylker.length > 1 ? 'fylkene' : 'fylket'} over. Sirkelen sendes også, men vi har ikke fått bekreftet at Finn bruker den. Ligger treffene langt unna, er det ${n.fylker.length > 1 ? 'fylkene' : 'fylket'} som gjelder.</p>` : ''}
    <div class="row"><button class="btn ghost ar-open" data-act="areaopen">${n ? 'Endre på kartet' : 'Velg på kartet'}</button>${all}</div>
  </div>`;
  }
  const many = n && n.fylker.length > 1;
  return `
  <section class="panel ar-panel" aria-label="Hvor vil du lete?">
    <h2>Hvor vil du lete?</h2>
    ${pick.data ? `
    <div class="field"><label for="areaq">Søk etter by, tettsted eller bydel</label>
      <input id="areaq" type="search" autocomplete="off" autocapitalize="words" enterkeyhint="search" placeholder="f.eks. Ski" value="${esc(pick.q)}" data-enter="areahit" data-v="0"></div>
    <div id="areahits" class="ar-hits">${hitList()}</div>
    <p class="hint">Eller trykk på kartet der du vil lete. Dra for å flytte kartet, knip for å zoome.</p>
    <div class="ar-wrap">${mapSvg(state)}
      <div class="ar-zoom"><button data-act="areazoom" data-v="in" aria-label="Zoom inn">+</button><button data-act="areazoom" data-v="out" aria-label="Zoom ut">−</button><button class="ar-whole" data-act="areazoom" data-v="all" aria-label="Vis hele Norge">Hele</button></div>
    </div>
    <p class="ar-credit">Kartdata: © Kartverket (CC BY 4.0)</p>
    <span class="q-label">Hvor langt unna?</span>
    <div class="ar-kms" role="group" aria-label="Avstand">
      ${RADII.map((km) => { const on = (n ? n.km : pick.km) === km; return `<button class="ar-km ${on ? 'on' : ''}" data-act="arearad" data-v="${km}" aria-pressed="${on}">${km} km</button>`; }).join('')}
    </div>
    <p class="ar-status" role="status">${n ? `${esc(areaLabel(state))}.` : 'Ingen sirkel ennå. Søk etter et sted eller trykk på kartet.'}</p>
    ${n ? `<p class="hint">Finn får ${many ? 'fylkene' : 'fylket'} sirkelen ligger i: ${esc(nearFylker(state))}. Det virker alltid.</p>
    <label class="ar-check"><input type="checkbox" data-ch="areageo" ${n.geo ? 'checked' : ''}><span>Prøv også å sende sirkelen til Finn</span></label>
    <p class="hint">Vi har ikke fått bekreftet at Finn bruker sirkelen i disse søkene. Hvis treffene ligger langt unna, er det ${many ? 'fylkene' : 'fylket'} som gjelder.</p>` : ''}`
    : `<p class="ar-status ${pick.error ? 'bad' : ''}" role="status">${pick.error ? esc(pick.error) : 'Henter kartet …'}</p>`}
    <div class="field"><label for="areafy">Eller velg et helt fylke</label>
      <select id="areafy" data-ch="areafylke">${AREAS.map((a) => `<option value="${a.id}" ${!n && state.area === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select></div>
    <div class="row"><button class="btn" data-act="areaclose">Ferdig</button>${all}</div>
  </section>`;
}

function choose(ctx, lat, lon, name, recentre) {
  const s = ctx.state();
  const km = s.near ? s.near.km : pick.km;
  const near = cleanNear({ lat, lon, km, name, geo: s.near ? s.near.geo : true, fylker: fylkerFor(pick.data.fylker, lat, lon, km) });
  if (!near) return false; // utenfor landet
  s.near = near; s.area = '';
  fit(near, recentre);
  ctx.commit();
  return true;
}

// Navn på et punkt man har trykket på: nærmeste sted, ellers kommunen.
function nameAt(lat, lon) {
  const p = nearestPlace(pick.data.places, lat, lon, 6);
  if (p) return p[0];
  const k = shapeAt(pick.data.kommuner, lat, lon);
  return k ? `et punkt i ${k.n.split(' - ')[0]}` : 'valgt punkt';
}

export function areaActions(ctx) {
  return {
    actions: {
      areaopen() {
        const n = ctx.state().near;
        Object.assign(pick, { open: true, hits: [], q: '', view: n ? viewFor(n) : { ...FULL } });
        if (n) pick.km = n.km;
        load(ctx); ctx.later();
      },
      areaclose() { pick.open = false; ctx.later(); },
      areaall() { const s = ctx.state(); s.near = null; s.area = ''; Object.assign(pick, { view: { ...FULL }, hits: [], q: '' }); ctx.commit(); },
      areazoom(v) {
        setView(v === 'all' ? FULL : { ...pick.view, w: pick.view.w * (v === 'in' ? 0.5 : 2) });
        ctx.later(); // navnene tegnes på nytt for det nye utsnittet
      },
      arearad(v) {
        const s = ctx.state(), km = Number(v);
        if (!RADII.includes(km)) return;
        pick.km = km;
        if (!s.near || !pick.data) { ctx.later(); return; }
        s.near = cleanNear({ ...s.near, km, fylker: fylkerFor(pick.data.fylker, s.near.lat, s.near.lon, km) }) || s.near;
        setView(viewFor(s.near));
        ctx.commit();
      },
      areahit(v) {
        const p = pick.hits[Number(v)];
        if (!p || !pick.data) return;
        Object.assign(pick, { hits: [], q: '' });
        document.activeElement?.blur?.(); // tastaturet ned, så kartet synes
        choose(ctx, p[1], p[2], p[0], true);
      },
    },
    changes: {
      areafylke(el) { const s = ctx.state(); if (AREAS.some((a) => a.id === el.value)) { s.area = el.value; s.near = null; } },
      areageo(el) { const s = ctx.state(); if (s.near) s.near = { ...s.near, geo: el.checked }; },
    },
  };
}

// ---------- Kartet: dra for å flytte, to fingre for å zoome, trykk for å velge punkt ----------

let grip = null; // { pts: Map(id -> [x, y]), start, view0, d0, moved, t }

export function bindArea(app, ctx) {
  // Siden skal ikke rulle eller zoome mens fingeren er på kartet.
  const hold = (e) => { if (e.target.closest?.('#areamap')) e.preventDefault(); };
  for (const type of ['touchstart', 'touchmove', 'gesturestart']) app.addEventListener(type, hold, { passive: false });

  // Søkefeltet oppdaterer bare trefflista, så tastaturet blir stående.
  app.addEventListener('input', (e) => {
    if (e.target.id !== 'areaq' || !pick.data) return;
    pick.q = e.target.value.slice(0, 60);
    pick.hits = searchPlaces(pick.data.places, pick.q, 6);
    const box = document.getElementById('areahits');
    if (box) box.innerHTML = hitList();
  });

  const spread = (g) => { const [a, b] = [...g.pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };

  app.addEventListener('pointerdown', (e) => {
    if (!e.target.closest?.('#areamap') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (grip && performance.now() - grip.t > 3000) grip = null; // et gammelt grep som aldri ble sluppet
    if (!grip) grip = { pts: new Map(), start: [e.clientX, e.clientY], view0: { ...pick.view }, d0: 0, moved: false, t: performance.now() };
    grip.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (grip.pts.size === 2) { grip.d0 = spread(grip); grip.view0 = { ...pick.view }; grip.moved = true; }
    if (document.activeElement?.id === 'areaq') document.activeElement.blur();
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!grip || !grip.pts.has(e.pointerId)) return;
    if (!mapEl()) { grip = null; return; }
    grip.t = performance.now();
    grip.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (grip.pts.size >= 2 && grip.d0 > 0) {
      setView({ ...grip.view0, w: grip.view0.w * (grip.d0 / Math.max(10, spread(grip))) });
    } else if (grip.pts.size === 1) {
      const dx = e.clientX - grip.start[0], dy = e.clientY - grip.start[1], k = grip.view0.w / mapPx();
      if (Math.hypot(dx, dy) > 8) grip.moved = true;
      if (grip.moved) setView({ w: grip.view0.w, cx: grip.view0.cx - dx * k, cy: grip.view0.cy - dy * k });
    }
  });

  const end = (e, cancelled) => {
    if (!grip || !grip.pts.has(e.pointerId)) return;
    const g = grip;
    g.pts.delete(e.pointerId);
    if (g.pts.size) { // én finger igjen etter zoom: fortsett som flytting derfra
      [g.start] = [...g.pts.values()]; g.view0 = { ...pick.view }; g.d0 = 0;
      return;
    }
    grip = null;
    const svg = mapEl();
    if (!cancelled && !g.moved && svg && pick.data) {
      const b = svg.getBoundingClientRect(), v = pick.view;
      const [lon, lat] = unproject(v.cx - v.w / 2 + ((e.clientX - b.left) / b.width) * v.w, v.cy + ((e.clientY - b.top) / b.height - 0.5) * v.w * ASPECT);
      if (choose(ctx, lat, lon, nameAt(lat, lon), false)) return;
    }
    ctx.later(); // tegn navnene på nytt for det nye utsnittet
  };
  window.addEventListener('pointerup', (e) => end(e, false));
  window.addEventListener('pointercancel', (e) => end(e, true));
  // Sikkerhetsnett, som på romtegningen: slipp grepet hvis «slipp» aldri kommer fram.
  const drop = () => { if (grip) { grip = null; ctx.later(); } };
  window.addEventListener('touchend', (e) => { if (grip && !e.touches?.length) setTimeout(drop, 120); });
  window.addEventListener('touchcancel', () => setTimeout(drop, 120));
  window.addEventListener('blur', drop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) drop(); });
}
