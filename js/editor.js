// Plantegningen: tegn rom på frihånd, rett dem opp, sett mål, dører, vinduer og møbler.
// Mens man drar, endres bare det som vises. Tilstanden lagres når man slipper.
import { ROOMS, ITEMS } from './data.js';
import { roomLabel, sizeFromM2, footprint } from './logic.js';
import {
  straighten, alignTo, fitSheet, canonical, areaM2, edges, letter, setEdgeLength, nearestEdge, labelPoint, pointInPoly, moved, opening, wallFor,
} from './plan.js';

export const SHEETS = [1000, 1500, 2500];
const TOOLS = [['draw', 'Tegn rom'], ['move', 'Velg og flytt'], ['door', 'Dør'], ['window', 'Vindu']];
const HINTS = {
  draw: 'Tegn rundt rommet med fingeren eller musa, slik veggene går. Skjeve streker rettes opp når du slipper.',
  move: 'Trykk på et rom eller et møbel for å velge det. Dra for å flytte.',
  door: 'Trykk på en vegg for å sette inn en dør. Trykk på døra for å fjerne den.',
  window: 'Trykk på en vegg for å sette inn et vindu. Trykk på vinduet for å fjerne det.',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m = (cm) => String(Math.round(cm) / 100).replace('.', ',');
const pts = (poly) => poly.map((p) => p.join(',')).join(' ');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Areal, størrelsesklasse og lengste vegg følger alltid av tegningen.
export function refit(room) {
  room.m2 = Math.max(1, Math.round(areaM2(room.poly)));
  room.size = sizeFromM2(room.type, room.m2);
  room.wall = Math.round(Math.max(...edges(room.poly).map((e) => e.len)));
  room.doors = (room.doors || []).filter((d) => d.e < room.poly.length);
  return room;
}

function guessType(rooms, m2) {
  const has = (t) => rooms.some((r) => r.type === t);
  if (m2 <= 6) return !has('bad') ? 'bad' : !has('gang') ? 'gang' : 'bad';
  for (const t of ['stue', 'soverom', 'kjokken']) if (!has(t)) return t;
  return 'soverom';
}

// ---------- Visning ----------

function roomSvg(state, ui, r, k) {
  const on = ui.room === r.id;
  const c = labelPoint(r.poly);
  const doors = (r.doors || []).map((d) => {
    const o = opening(r.poly, d);
    if (!o) return '';
    const a = [o.p[0] - o.u[0] * o.half, o.p[1] - o.u[1] * o.half], b = [o.p[0] + o.u[0] * o.half, o.p[1] + o.u[1] * o.half];
    const gap = `<line class="gap" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${9 * k}"/>`;
    if (d.kind === 'window') return `${gap}<line class="win" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${3 * k}"/>`;
    const w = o.half * 2, tip = [a[0] + o.n[0] * w, a[1] + o.n[1] * w];
    const sweep = o.u[0] * o.n[1] - o.u[1] * o.n[0] > 0 ? 0 : 1;
    return `${gap}<path class="door" d="M${a[0]} ${a[1]}L${tip[0]} ${tip[1]}A${w} ${w} 0 0 ${sweep} ${b[0]} ${b[1]}" stroke-width="${2 * k}"/>`;
  }).join('');
  const marks = on ? edges(r.poly).map((e, i) => {
    const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    const u = [(e.b[0] - e.a[0]) / (e.len || 1), (e.b[1] - e.a[1]) / (e.len || 1)];
    let n = [-u[1], u[0]];
    if (pointInPoly([mid[0] + n[0] * 12, mid[1] + n[1] * 12], r.poly)) n = [u[1], -u[0]]; // bokstaven står på utsiden, så den ikke dekker møbler
    const p = [mid[0] + n[0] * 30 * k, mid[1] + n[1] * 30 * k];
    return `<circle class="mark" cx="${p[0]}" cy="${p[1]}" r="${19 * k}"/><text class="mark-t" x="${p[0]}" y="${p[1]}" font-size="${23 * k}" dy="${8 * k}">${letter(i)}</text>`;
  }).join('') : '';
  const furn = (state.furn || []).filter((f) => f.room === r.id).map((f) => {
    const sel = ui.furn === f.id;
    const fs = clamp(Math.min(f.w, f.d) * 0.34, 17 * k, 26 * k);
    const room = (f.r === 90 ? f.d : f.w) - 8 * k; // teksten står alltid vannrett
    const full = ITEMS[f.item]?.name || '', word = full.split(' ')[0];
    const fit = (t) => t.length * fs * 0.6 <= room;
    const name = fit(full) ? full : fit(word) ? word : word.slice(0, Math.max(1, Math.floor(room / (fs * 0.6))));
    return `<g class="furn ${sel ? 'on' : ''}" data-furn="${f.id}" transform="translate(${f.x} ${f.y}) rotate(${f.r})">
      <rect x="${-f.w / 2}" y="${-f.d / 2}" width="${f.w}" height="${f.d}" rx="${4 * k}" stroke-width="${2.5 * k}"/>
      <text font-size="${fs}" dy="${fs * 0.35}" transform="rotate(${-f.r})">${esc(name)}</text></g>`;
  }).join('');
  return `<g data-g="${r.id}">
    <polygon class="proom ${on ? 'on' : ''}" data-room="${r.id}" points="${pts(r.poly)}" stroke-width="${6 * k}"/>
    ${doors}
    <text class="pname" x="${c[0]}" y="${c[1]}" font-size="${32 * k}">${esc(roomLabel(state.rooms, r))}</text>
    <text class="pm2" x="${c[0]}" y="${c[1] + 34 * k}" font-size="${26 * k}">${r.m2} m²</text>
    ${furn}${marks}</g>`;
}

// Minste ark som rommer alt som er tegnet.
export function sheetFor(state, fallback) {
  const far = Math.max(0, ...state.rooms.filter((r) => r.poly).flatMap((r) => r.poly.flat()));
  return far ? (SHEETS.find((s) => s >= far) || SHEETS[SHEETS.length - 1]) : fallback;
}

export function drawView(state, ui, canUndo) {
  const S = ui.sheet, k = S / 1000;
  const rooms = state.rooms.filter((r) => r.poly && (r.floor || 0) === ui.floor);
  const all = state.rooms.filter((r) => r.poly);
  const sorted = [...rooms].sort((a, b) => (a.id === ui.room) - (b.id === ui.room));
  return `
  <div class="floors" role="group" aria-label="Etasje">
    ${state.floors.map((f, i) => `<button class="chip mini ${ui.floor === i ? 'on' : ''}" data-act="floor" data-v="${i}" aria-pressed="${ui.floor === i}">${esc(f)}</button>`).join('')}
    ${state.floors.length < 5 ? '<button class="chip mini add" data-act="addfloor">+ Etasje</button>' : ''}
  </div>
  <div class="tools" role="group" aria-label="Verktøy">
    ${TOOLS.map(([id, name]) => `<button class="tool ${ui.tool === id ? 'on' : ''}" data-act="tool" data-v="${id}" aria-pressed="${ui.tool === id}">${name}</button>`).join('')}
  </div>
  <p class="hint tool-hint">${HINTS[ui.tool]}</p>
  <div class="row undo-row"><button class="btn ghost small" data-act="undo" ${canUndo ? '' : 'disabled'}>Angre</button>
    ${ui.room && rooms.some((r) => r.id === ui.room) ? '<button class="link danger" data-act="delroom">Fjern valgt rom</button>' : ''}</div>
  <div class="sheet"><svg class="draw tool-${ui.tool}" id="draw" viewBox="0 0 ${S} ${S}" role="img" aria-label="Plantegning av ${esc(state.floors[ui.floor])}">
    <defs>
      <pattern id="g50" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" class="g-thin" stroke-width="${1.2 * k}"/></pattern>
      <pattern id="g100" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" class="g-bold" stroke-width="${1.6 * k}"/></pattern>
    </defs>
    <rect width="${S}" height="${S}" fill="url(#g50)"/><rect width="${S}" height="${S}" fill="url(#g100)"/>
    ${sorted.map((r) => roomSvg(state, ui, r, k)).join('')}
    ${rooms.length ? '' : `<text class="empty" x="${S / 2}" y="${S / 2}" font-size="${36 * k}">Tegn rundt det første rommet her</text>`}
    <polyline id="ink" fill="none" stroke-width="${5 * k}" points=""/>
  </svg></div>
  ${ui.note ? `<p class="status bad" role="status">${esc(ui.note)}</p>` : ''}
  <div class="sheetrow"><span class="plan-sum">${all.length ? `Omtrent ${all.reduce((s, r) => s + r.m2, 0)} m² i ${all.length} rom.` : (state.drawn ? '' : 'Det første rommet du tegner, erstatter rommene fra «Velg bolig».')} Store ruter er 1 meter.</span>
    <span class="chips" role="group" aria-label="Arkstørrelse">${SHEETS.map((s) => `<button class="chip mini ${S === s ? 'on' : ''}" data-act="sheet" data-v="${s}" aria-pressed="${S === s}">${s / 100} m</button>`).join('')}</span></div>
  ${rooms.length ? `<div class="chips" role="group" aria-label="Rom på denne etasjen">${rooms.map((r) => `<button class="chip mini ${ui.room === r.id ? 'on' : ''}" data-act="room" data-v="${r.id}" aria-pressed="${ui.room === r.id}">${esc(roomLabel(state.rooms, r))}</button>`).join('')}</div>` : ''}
  ${state.floors.length > 1 && !rooms.length ? '<button class="link danger" data-act="delfloor">Fjern denne etasjen</button>' : ''}
  ${furnPanel(state, ui)}`;
}

function furnPanel(state, ui) {
  const f = (state.furn || []).find((x) => x.id === ui.furn);
  const room = f && state.rooms.find((r) => r.id === f.room);
  if (!f || !room?.poly) return '';
  const w = wallFor(room.poly, room.doors, f);
  return `
  <section class="panel" aria-label="Valgt møbel">
    <h2>${esc(ITEMS[f.item].name)}<small>${esc(roomLabel(state.rooms, room))}</small></h2>
    <div class="pair">
      <div class="field"><label for="fw">Bredde, cm</label><input id="fw" inputmode="numeric" data-ch="furnw" value="${f.w}"></div>
      <div class="field"><label for="fd">Dybde, cm</label><input id="fd" inputmode="numeric" data-ch="furnd" value="${f.d}"></div>
    </div>
    <p class="tip">${w
      ? `Står mot vegg ${letter(w.e)}, som er ${m(w.len)} m.${w.free < w.len ? ` ${m(w.free)} m er fri for dører.` : ''} Lista bruker dette som største bredde.`
      : 'Står fritt i rommet. Dra det inntil en vegg, så regner lista ut hvor bredt det kan være.'}</p>
    <div class="row"><button class="btn ghost small" data-act="rotfurn">Snu 90 grader</button><button class="link danger" data-act="delfurn">Ta bort møbelet</button></div>
  </section>`;
}

export function roomPanel(state, ui, r) {
  const placeable = [...ROOMS[r.type].ess, ...ROOMS[r.type].extra].filter((id) => footprint(id, r.size));
  const placed = (id) => (state.furn || []).find((f) => f.room === r.id && f.item === id);
  return `
  <section class="panel" aria-label="Valgt rom">
    <h2>${esc(roomLabel(state.rooms, r))}<small>${r.m2} m²</small></h2>
    <span class="q-label">Hva slags rom er det?</span>
    <div class="chips" role="group" aria-label="Type rom">
      ${Object.entries(ROOMS).map(([id, t]) => `<button class="chip mini ${r.type === id ? 'on' : ''}" data-act="rtype" data-v="${id}" aria-pressed="${r.type === id}">${t.name}</button>`).join('')}
    </div>
    <span class="q-label">Sett ut møbler</span>
    <p class="hint">Sett ut det viktigste omtrent der det skal stå. Da vet lista hvilken vegg sofaen har og hvor bred den kan være.</p>
    <div class="chips" role="group" aria-label="Møbler">
      ${placeable.map((id) => `<button class="chip mini ${placed(id) ? 'on' : 'add'}" data-act="addfurn" data-v="${id}">${placed(id) ? '' : '+ '}${ITEMS[id].name}</button>`).join('')}
    </div>
    <span class="q-label">Vegger, i cm</span>
    <p class="hint">Bokstavene står på tegningen. Skriv inn det riktige målet, så flytter vi veggen.</p>
    <div class="walls">
      ${edges(r.poly).map((e, i) => `<div class="field"><label for="edge-${i}">Vegg ${letter(i)}</label><input id="edge-${i}" inputmode="numeric" data-ch="edgelen" data-v="${i}" value="${Math.round(e.len)}"></div>`).join('')}
    </div>
    <button class="link danger" data-act="delroom">Fjern rommet</button>
  </section>`;
}

// ---------- Hendelser ----------

let drag = null;
// En tegning som ikke har fått bevegelse på tre sekunder regnes som avbrutt, så appen aldri blir stående låst.
export const isDragging = () => !!drag && performance.now() - drag.t < 3000;

export function bindEditor(app, ctx) {
  const { ui } = ctx;
  const toCm = (e, svg) => {
    const b = svg.getBoundingClientRect();
    return [((e.clientX - b.left) / b.width) * ui.sheet, ((e.clientY - b.top) / b.height) * ui.sheet];
  };
  const floorRooms = () => ctx.state().rooms.filter((r) => r.poly && (r.floor || 0) === ui.floor);

  // Hindrer at siden ruller eller zoomer mens man tegner. Noen nettlesere overser touch-action på SVG.
  const hold = (e) => { if (e.target.closest?.('#draw')) e.preventDefault(); };
  for (const type of ['touchstart', 'touchmove', 'gesturestart']) app.addEventListener(type, hold, { passive: false });

  app.addEventListener('pointerdown', (e) => {
    const svg = e.target.closest?.('#draw');
    if (!svg || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (drag) { drag.ink?.setAttribute('points', ''); drag = null; } // forrige strek ble aldri avsluttet (fingeren slapp utenfor siden)
    const state = ctx.state();
    const p = toCm(e, svg);
    const pxToCm = ui.sheet / svg.getBoundingClientRect().width;
    drag = { tool: ui.tool, svg, id: e.pointerId, start: p, last: p, far: false, slop: 8 * pxToCm, t: performance.now() };
    if (ui.tool === 'draw') {
      drag.pts = [p];
      drag.ink = svg.querySelector('#ink');
    } else if (ui.tool === 'move') {
      const fEl = e.target.closest('[data-furn]'), rEl = e.target.closest('[data-room]');
      if (fEl) {
        const f = state.furn.find((x) => x.id === fEl.dataset.furn);
        drag.furn = f; drag.el = fEl; drag.pos = [f.x, f.y];
      } else if (rEl) {
        drag.room = state.rooms.find((r) => r.id === rEl.dataset.room);
        drag.el = svg.querySelector(`[data-g="${rEl.dataset.room}"]`);
        drag.delta = [0, 0];
      }
    }
    try { svg.setPointerCapture(e.pointerId); } catch { /* går fint uten */ }
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.t = performance.now();
    const p = toCm(e, drag.svg);
    if (Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) > drag.slop) drag.far = true;
    if (drag.tool === 'draw') {
      if (Math.hypot(p[0] - drag.last[0], p[1] - drag.last[1]) < drag.slop / 2) return;
      drag.pts.push(p); drag.last = p;
      drag.ink.setAttribute('points', pts(drag.pts.map(([x, y]) => [Math.round(x), Math.round(y)])));
    } else if (drag.furn && drag.far) {
      const f = drag.furn;
      drag.pos = [clamp(Math.round((f.x + p[0] - drag.start[0]) / 5) * 5, 0, ui.sheet), clamp(Math.round((f.y + p[1] - drag.start[1]) / 5) * 5, 0, ui.sheet)];
      drag.el.setAttribute('transform', `translate(${drag.pos[0]} ${drag.pos[1]}) rotate(${f.r})`);
    } else if (drag.room && drag.far) {
      drag.delta = [Math.round((p[0] - drag.start[0]) / 10) * 10, Math.round((p[1] - drag.start[1]) / 10) * 10];
      drag.el.setAttribute('transform', `translate(${drag.delta[0]} ${drag.delta[1]})`);
    }
  });

  const finish = (cancelled) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    const state = ctx.state();
    ui.note = '';
    if (cancelled) { ctx.render(); return; }

    if (d.tool === 'draw') {
      const tol = clamp(14 * (d.slop / 8), 25, 90); // en finger treffer omtrent innenfor 14 piksler
      let poly = d.far ? straighten(d.pts, tol) : null;
      if (poly) {
        poly = canonical(fitSheet(alignTo(poly, floorRooms().map((r) => r.poly), tol), ui.sheet));
        const id = 'r' + (state.seq = (state.seq || 100) + 1);
        const base = state.drawn ? state.rooms : [];
        if (!state.drawn) { state.items = {}; state.custom = []; state.furn = []; state.home = ''; state.drawn = true; }
        const room = refit({ id, type: 'stue', size: 'M', m2: null, wall: null, floor: ui.floor, poly, doors: [] });
        room.type = guessType(base, room.m2); refit(room);
        state.rooms = [...base, room];
        ui.room = id; ui.furn = null;
      } else if (d.far) ui.note = 'Det ble for lite til å være et rom. Tegn en større runde, minst én meter hver vei.';
    } else if (d.tool === 'move') {
      if (d.furn) {
        if (d.far) { d.furn.x = d.pos[0]; d.furn.y = d.pos[1]; }
        ui.furn = d.furn.id; ui.room = null;
      } else if (d.room) {
        if (d.far && (d.delta[0] || d.delta[1])) {
          const from = d.room.poly[0];
          d.room.poly = fitSheet(moved(d.room.poly, d.delta[0], d.delta[1]), ui.sheet);
          const dx = d.room.poly[0][0] - from[0], dy = d.room.poly[0][1] - from[1];
          for (const f of state.furn) if (f.room === d.room.id) { f.x += dx; f.y += dy; }
        }
        ui.room = d.room.id; ui.furn = null;
      } else { ui.room = null; ui.furn = null; }
    } else if (!d.far) {
      // Dør eller vindu: finn nærmeste vegg på denne etasjen.
      const kind = d.tool === 'window' ? 'window' : 'door';
      let best = null;
      for (const r of floorRooms()) {
        const n = nearestEdge(r.poly, d.start);
        if (n && (!best || n.d < best.n.d)) best = { r, n };
      }
      const reach = Math.max(45, d.slop * 3);
      if (!best || best.n.d > reach) ui.note = 'Trykk nærmere en vegg.';
      else {
        const { r, n } = best;
        const along = n.t * n.len;
        const hit = (r.doors || []).findIndex((o) => o.e === n.i && Math.abs(o.t * n.len - along) < o.w / 2 + 25);
        if (hit >= 0) r.doors.splice(hit, 1);
        else {
          const w = Math.min(kind === 'door' ? 80 : 120, Math.max(40, n.len - 20));
          r.doors = [...(r.doors || []), { e: n.i, t: n.t, w, kind }];
        }
        ui.room = r.id; ui.furn = null;
      }
    }
    ctx.save(); ctx.render();
  };
  window.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) finish(false); });
  window.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) finish(true); });
  // Sikkerhetsnett: noen ganger kommer aldri «slipp» fram, for eksempel når fingeren løftes utenfor siden.
  const lifted = (e) => { if (drag && !(e.touches && e.touches.length)) setTimeout(() => finish(false), 60); };
  window.addEventListener('touchend', lifted);
  window.addEventListener('touchcancel', () => setTimeout(() => finish(true), 60));
  window.addEventListener('blur', () => finish(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(true); });
  app.addEventListener('click', () => { if (drag && performance.now() - drag.t > 400) finish(true); }, true);
}

// Knapper og felt som hører til tegningen. Kobles inn i appens vanlige hendelser.
export function editorActions(ctx) {
  const { ui } = ctx;
  const sel = () => ctx.state().rooms.find((r) => r.id === ui.room);
  const selFurn = () => ctx.state().furn.find((f) => f.id === ui.furn);
  const num = (v) => { const n = Math.round(Number(String(v).replace(/[^\d]/g, ''))); return Number.isFinite(n) && n > 0 ? n : null; };
  return {
    actions: {
      tool(v) { if (HINTS[v]) { ui.tool = v; ui.note = ''; ctx.later(); } },
      sheet(v) { if (SHEETS.includes(Number(v))) { ui.sheet = Number(v); ctx.later(); } },
      floor(v) { ui.floor = clamp(Number(v) || 0, 0, ctx.state().floors.length - 1); ui.room = null; ui.furn = null; ctx.later(); },
      addfloor() { const s = ctx.state(); if (s.floors.length < 5) { s.floors = [...s.floors, `${s.floors.length + 1}. etasje`]; ui.floor = s.floors.length - 1; ui.room = null; ui.furn = null; ctx.commit(); } },
      delfloor() {
        const s = ctx.state();
        if (s.floors.length < 2 || s.rooms.some((r) => (r.floor || 0) === ui.floor && r.poly)) return;
        s.floors = s.floors.filter((_, i) => i !== ui.floor).map((_, i) => `${i + 1}. etasje`);
        for (const r of s.rooms) if ((r.floor || 0) > ui.floor) r.floor -= 1;
        ui.floor = Math.max(0, ui.floor - 1); ctx.commit();
      },
      rtype(v) { const r = sel(); if (r && ROOMS[v]) { r.type = v; if (r.poly) refit(r); else r.size = sizeFromM2(v, r.m2 || ROOMS[v].m2[r.size]); ctx.commit(); } },
      addfurn(v) {
        const s = ctx.state(), r = sel();
        if (!r?.poly || !ITEMS[v]) return;
        const have = s.furn.find((f) => f.room === r.id && f.item === v);
        if (have) { ui.furn = have.id; ui.room = null; ui.tool = 'move'; ctx.later(); return; }
        const fp = footprint(v, r.size);
        if (!fp || s.furn.length >= 80) return;
        const c = labelPoint(r.poly);
        const id = 'f' + (s.seq = (s.seq || 100) + 1);
        s.furn = [...s.furn, { id, room: r.id, item: v, x: Math.round(c[0] / 5) * 5, y: Math.round(c[1] / 5) * 5, w: fp[0], d: fp[1], r: 0 }];
        ui.furn = id; ui.room = null; ui.tool = 'move';
        ctx.commit();
      },
      rotfurn() { const f = selFurn(); if (f) { f.r = f.r === 90 ? 0 : 90; ctx.commit(); } },
      delfurn() { const s = ctx.state(); s.furn = s.furn.filter((f) => f.id !== ui.furn); ui.furn = null; ctx.commit(); },
    },
    changes: {
      edgelen(el) { const r = sel(), n = num(el.value); if (r?.poly && n) { r.poly = setEdgeLength(r.poly, Number(el.dataset.v), n); refit(r); } },
      furnw(el) { const f = selFurn(), n = num(el.value); if (f && n) f.w = clamp(n, 20, 600); },
      furnd(el) { const f = selFurn(), n = num(el.value); if (f && n) f.d = clamp(n, 20, 600); },
    },
  };
}
