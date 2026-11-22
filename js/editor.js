// Plantegningen: tegn rom på frihånd, rett dem opp, sett mål, dører, vinduer og møbler.
// Mens man drar, endres bare det som vises. Tilstanden lagres når man slipper.
import { ROOMS, ITEMS } from './data.js';
import { roomLabel, sizeFromM2, footprint, instances, shapeOf, furnName } from './logic.js';
import {
  straighten, straightenLine, isLine, splitPoly, moveWall, moveCorner, dragAlong, valid, remapDoor, remapDoors, alignTo, fitSheet, canonical,
  area, areaM2, edges, letter, setEdgeLength, nearestEdge, labelPoint, pointInPoly, moved, opening, wallFor,
} from './plan.js';
import { arrangeRoom, armOf, localNotch, localOpen, flipped, turned, keepInside } from './arrange.js';

export const SHEETS = [1000, 1500, 2500];
const TOOLS = [['draw', 'Tegn rom'], ['move', 'Velg og flytt'], ['door', 'Dør'], ['window', 'Vindu']];
const HINTS = {
  draw: 'Tegn rundt boligen eller et rom, slik veggene går. Dra en strek tvers over et rom for å dele det i to.',
  move: 'Trykk på et rom for å velge det. Dra rommet for å flytte, eller dra i et hjørne eller en bokstav for å endre formen.',
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
  const picked = (state.furn || []).find((f) => f.id === ui.furn);
  const on = ui.room === r.id || picked?.room === r.id; // rommet til det valgte møbelet viser også veggbokstavene
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
  const shape = ui.room === r.id && ui.tool === 'move' && !ui.furnish;
  const marks = on ? edges(r.poly).map((e, i) => {
    const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    const u = [(e.b[0] - e.a[0]) / (e.len || 1), (e.b[1] - e.a[1]) / (e.len || 1)];
    let n = [-u[1], u[0]];
    if (pointInPoly([mid[0] + n[0] * 12, mid[1] + n[1] * 12], r.poly)) n = [u[1], -u[0]]; // bokstaven står på utsiden, så den ikke dekker møbler
    const p = [mid[0] + n[0] * 30 * k, mid[1] + n[1] * 30 * k];
    const q = [mid[0] - n[0] * 26 * k, mid[1] - n[1] * 26 * k]; // lengden står på innsiden
    return `${e.len >= 90 * k ? `<text class="wlen ${(r.fixed || []).includes(i) ? 'set' : ''}" x="${q[0]}" y="${q[1]}" font-size="${21 * k}" dy="${7 * k}">${m(e.len)} m</text>` : ''}
      <circle class="mark" cx="${p[0]}" cy="${p[1]}" r="${19 * k}"/><text class="mark-t" x="${p[0]}" y="${p[1]}" font-size="${23 * k}" dy="${8 * k}">${letter(i)}</text>
      ${shape ? `<circle class="hit" data-wall="${i}" cx="${p[0]}" cy="${p[1]}" r="${40 * k}"/>` : ''}`;
  }).join('') + (shape ? r.poly.map((c2, i) => `<circle class="handle" cx="${c2[0]}" cy="${c2[1]}" r="${12 * k}" stroke-width="${4 * k}"/><circle class="hit" data-corner="${i}" cx="${c2[0]}" cy="${c2[1]}" r="${40 * k}"/>`).join('') : '') : '';
  const furn = (state.furn || []).filter((f) => f.room === r.id).map((f) => {
    const sel = ui.furn === f.id;
    const fs = clamp(Math.min(f.w, f.d) * 0.34, 17 * k, 26 * k);
    const room = (f.r === 90 ? f.d : f.w) - 8 * k; // teksten står alltid vannrett
    if (f.u) return uSvg(f, sel, k);
    if (f.corner) return cornerSvg(f, sel, k);
    const name = shortName(f, room, fs);
    return `<g class="furn ${sel ? 'on' : ''}" data-furn="${f.id}" transform="translate(${f.x} ${f.y}) rotate(${f.r})">
      <rect x="${-f.w / 2}" y="${-f.d / 2}" width="${f.w}" height="${f.d}" rx="${4 * k}" stroke-width="${2.5 * k}"/>
      <text font-size="${fs}" dy="${fs * 0.35}" transform="rotate(${-f.r})">${esc(name)}</text></g>`;
  }).join('');
  return `<g data-g="${r.id}">
    <polygon class="proom ${on ? 'on' : ''}" data-room="${r.id}" points="${pts(r.poly)}" stroke-width="${6 * k}"/>
    ${doors}
    <text class="pname" x="${c[0]}" y="${c[1]}" font-size="${32 * k}">${esc(roomLabel(state.rooms, r))}</text>
    <text class="pm2" x="${c[0]}" y="${c[1] + 34 * k}" font-size="${26 * k}">${r.m2} m²</text>
    ${furn}<g class="marks">${marks}</g></g>`;
}

// Navnet som får plass på møbelet: hele navnet på varianten, ellers navnet på tingen, ellers første ord.
function shortName(f, room, fs) {
  const fit = (t) => t.length * fs * 0.6 <= room;
  const full = furnName(f.item, f.s), plain = ITEMS[f.item]?.name || '', word = plain.split(' ')[0];
  return [full, plain, word].find(fit) || word.slice(0, Math.max(1, Math.floor(room / (fs * 0.6))));
}

// U-sofa: en hestesko med rygg og en arm i hver ende. Tegnes i møbelets egen ramme, som vinkelen under.
function uSvg(f, sel, k) {
  const t = armOf(f), sy = localOpen(f) === 'n' ? -1 : 1; // grunnformen er åpen nedover
  const Y = (v) => v * sy;
  const w2 = f.w / 2, d2 = f.d / 2;
  const p = [[-w2, -d2], [w2, -d2], [w2, d2], [w2 - t, d2], [w2 - t, -d2 + t], [-w2 + t, -d2 + t], [-w2 + t, d2], [-w2, d2]].map(([x, y]) => `${x},${Y(y)}`).join(' ');
  const fs = clamp(t * 0.34, 17 * k, 26 * k);
  const seam = (x) => `<line class="seam" x1="${x}" y1="${Y(-d2)}" x2="${x}" y2="${Y(-d2 + t)}" stroke-width="${1.5 * k}"/>`;
  return `<g class="furn ${sel ? 'on' : ''}" data-furn="${f.id}" data-shape="u" transform="translate(${f.x} ${f.y}) rotate(${f.r})">
    <polygon points="${p}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
    ${seam(-w2 + t)}${seam(w2 - t)}
    <text font-size="${fs}" x="0" y="${Y(-d2 + t / 2)}" dy="${fs * 0.35}" transform="rotate(${-f.r} 0 ${Y(-d2 + t / 2)})">${esc(shortName(f, (f.r === 90 ? t : f.w) - 8 * k, fs))}</text></g>`;
}

// Vinkel (hjørnesofa, sofa med sjeselong, hjørnebord): ryggarm og sidearm. Tegnes i møbelets egen ramme, så den følger med når den dras og snus.
function cornerSvg(f, sel, k) {
  const t = armOf(f), n = localNotch(f);
  const sx = n[1] === 'e' ? 1 : -1, sy = n[0] === 's' ? 1 : -1; // speiler grunnformen (åpent hjørne nede til høyre)
  const X = (v) => v * sx, Y = (v) => v * sy;
  const w2 = f.w / 2, d2 = f.d / 2;
  const p = [[-w2, -d2], [w2, -d2], [w2, -d2 + t], [-w2 + t, -d2 + t], [-w2 + t, d2], [-w2, d2]].map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
  const fs = clamp(t * 0.34, 17 * k, 26 * k);
  return `<g class="furn ${sel ? 'on' : ''}" data-furn="${f.id}" data-shape="l" transform="translate(${f.x} ${f.y}) rotate(${f.r})">
    <polygon points="${p}" stroke-width="${2.5 * k}" stroke-linejoin="round"/>
    <line class="seam" x1="${X(-w2 + t)}" y1="${Y(-d2)}" x2="${X(-w2 + t)}" y2="${Y(-d2 + t)}" stroke-width="${1.5 * k}"/>
    <text font-size="${fs}" x="${X(t / 2)}" y="${Y(-d2 + t / 2)}" dy="${fs * 0.35}" transform="rotate(${-f.r} ${X(t / 2)} ${Y(-d2 + t / 2)})">${esc(shortName(f, (f.r === 90 ? t : f.w - t) - 8 * k, fs))}</text></g>`;
}

// Plass til et nattbord ved hodeenden av senga. Hodeenden er den enden som står nærmest en vegg.
function besideBed(poly, bed, fp, taken) {
  const lengthwise = bed.r === 90 ? [1, 0] : [0, 1], across = bed.r === 90 ? [0, 1] : [1, 0];
  const end = (sign) => [bed.x + lengthwise[0] * sign * bed.d / 2, bed.y + lengthwise[1] * sign * bed.d / 2];
  const head = nearestEdge(poly, end(-1)).d <= nearestEdge(poly, end(1)).d ? -1 : 1;
  const h = end(head);
  for (const side of [-1, 1]) {
    const x = Math.round(h[0] - lengthwise[0] * head * fp[1] / 2 + across[0] * side * (bed.w / 2 + fp[0] / 2 + 5));
    const y = Math.round(h[1] - lengthwise[1] * head * fp[1] / 2 + across[1] * side * (bed.w / 2 + fp[0] / 2 + 5));
    if (!taken.some((f) => Math.hypot(f.x - x, f.y - y) < 30)) return { x, y, r: bed.r };
  }
  return null;
}

// Etter at et rom har fått ny form: la naborommenes vegger følge med, og sørg for at alt får plass på arket.
function settle(state, ui, room, before, raw) {
  for (const o of state.rooms) {
    if (o === room || !o.poly || (o.floor || 0) !== (room.floor || 0)) continue;
    const next = dragAlong(before, raw, o.poly);
    if (next !== o.poly) { o.doors = remapDoors(o.poly, o.doors, next); o.poly = next; o.fixed = []; refit(o); }
  }
  const all = state.rooms.filter((r) => r.poly);
  const minX = Math.min(0, ...all.flatMap((r) => r.poly.map((p) => p[0]))), minY = Math.min(0, ...all.flatMap((r) => r.poly.map((p) => p[1])));
  if (minX < 0 || minY < 0) { // noe havnet utenfor venstre eller øvre kant: skyv hele tegningen inn
    for (const r of all) r.poly = r.poly.map(([x, y]) => [x - minX, y - minY]);
    for (const f of state.furn) { f.x -= minX; f.y -= minY; }
  }
  ui.sheet = Math.max(ui.sheet, sheetFor(state, ui.sheet));
}

// Minste ark som rommer alt som er tegnet.
export function sheetFor(state, fallback) {
  const far = Math.max(0, ...state.rooms.filter((r) => r.poly).flatMap((r) => r.poly.flat()));
  return far ? (SHEETS.find((s) => s >= far) || SHEETS[SHEETS.length - 1]) : fallback;
}

// Selve arket med rutenett, rom, dører og møbler.
function sheetSvg(state, ui, rooms, emptyText) {
  const S = ui.sheet, k = S / 1000;
  const sorted = [...rooms].sort((a, b) => (a.id === ui.room) - (b.id === ui.room));
  return `
  <div class="sheet"><svg class="draw tool-${ui.tool} ${ui.furnish ? 'furnishing' : ''}" id="draw" viewBox="0 0 ${S} ${S}" role="img" aria-label="Plantegning av ${esc(state.floors[ui.floor])}">
    <defs>
      <pattern id="g50" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" class="g-thin" stroke-width="${1.2 * k}"/></pattern>
      <pattern id="g100" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" class="g-bold" stroke-width="${1.6 * k}"/></pattern>
    </defs>
    <rect width="${S}" height="${S}" fill="url(#g50)"/><rect width="${S}" height="${S}" fill="url(#g100)"/>
    ${sorted.map((r) => roomSvg(state, ui, r, k)).join('')}
    ${rooms.length ? '' : `<text class="empty" x="${S / 2}" y="${S / 2}" font-size="${36 * k}">${emptyText}</text>`}
    <polyline id="ink" fill="none" stroke-width="${5 * k}" points=""/>
  </svg></div>`;
}

export function drawView(state, ui, canUndo) {
  const S = ui.sheet;
  const rooms = state.rooms.filter((r) => r.poly && (r.floor || 0) === ui.floor);
  const all = state.rooms.filter((r) => r.poly);
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
    ${state.drawn ? '' : '<button class="btn ghost small" data-act="usepreset">Start med rommene fra «Velg bolig»</button>'}
    ${ui.room && rooms.some((r) => r.id === ui.room) ? '<button class="link danger" data-act="delroom">Fjern valgt rom</button>' : ''}</div>
  ${sheetSvg(state, ui, rooms, 'Tegn rundt boligen eller et rom her')}
  ${ui.note ? `<p class="status bad" role="status">${esc(ui.note)}</p>` : ''}
  <div class="sheetrow"><span class="plan-sum">${all.length ? `Omtrent ${all.reduce((s, r) => s + r.m2, 0)} m² i ${all.length} rom.` : (state.drawn ? '' : 'Det første rommet du tegner, erstatter rommene fra «Velg bolig».')} Store ruter er 1 meter.</span>
    <span class="chips" role="group" aria-label="Arkstørrelse">${SHEETS.map((s) => `<button class="chip mini ${S === s ? 'on' : ''}" data-act="sheet" data-v="${s}" aria-pressed="${S === s}">${s / 100} m</button>`).join('')}</span></div>
  ${rooms.length ? `<div class="chips" role="group" aria-label="Rom på denne etasjen">${rooms.map((r) => `<button class="chip mini ${ui.room === r.id ? 'on' : ''}" data-act="room" data-v="${r.id}" aria-pressed="${ui.room === r.id}">${esc(roomLabel(state.rooms, r))}</button>`).join('')}</div>` : ''}
  ${state.floors.length > 1 && !rooms.length ? '<button class="link danger" data-act="delfloor">Fjern denne etasjen</button>' : ''}`;
}

// Knappene for det valgte møbelet, rett under tegningen. Linja har alltid samme høyde, så ingenting hopper når
// man velger noe. Havner den under skjermkanten, fester den seg over «Neste»-knappen, så den alltid kan nås mens
// man ser på tegningen.
function furnBar(state, ui) {
  const f = (state.furn || []).find((x) => x.id === ui.furn);
  if (!f) return '<div class="furnbar"><span class="furnbar-hint">Trykk på et møbel for å snu det eller ta det bort.</span></div>';
  const name = furnName(f.item, f.s);
  return `<div class="furnbar on ${f.corner || f.u ? 'shaped' : ''}" role="group" aria-label="Valgt møbel: ${esc(name)}">
    <span class="furnbar-name">${esc(name)}</span>
    <button class="barbtn" data-act="rotfurn">Snu</button>
    ${f.corner ? '<button class="barbtn" data-act="flipfurn">Snu hjørnet</button>' : f.u ? '<button class="barbtn" data-act="flipfurn">Snu åpningen</button>' : ''}
    <button class="barbtn danger" data-act="delfurn">Ta bort</button>
  </div>`;
}

function furnPanel(state, ui) {
  const f = (state.furn || []).find((x) => x.id === ui.furn);
  const room = f && state.rooms.find((r) => r.id === f.room);
  if (!f || !room?.poly) return '';
  const w = wallFor(room.poly, room.doors, f);
  return `
  <section class="panel" aria-label="Valgt møbel">
    <h2>${esc(furnName(f.item, f.s))}<small>${esc(roomLabel(state.rooms, room))}</small></h2>
    <div class="pair">
      <div class="field"><label for="fw">Bredde, cm</label><input id="fw" inputmode="numeric" data-ch="furnw" value="${f.w}"></div>
      <div class="field"><label for="fd">Dybde, cm</label><input id="fd" inputmode="numeric" data-ch="furnd" value="${f.d}"></div>
    </div>
    <p class="tip">${w
      ? `Står mot vegg ${letter(w.e)}, som er ${m(w.len)} m.${w.free < w.len ? ` ${m(w.free)} m er fri for dører.` : ''} Lista bruker dette som største bredde.`
      : 'Står fritt i rommet. Dra det inntil en vegg, så regner lista ut hvor bredt det kan være.'}</p>
    ${f.corner || f.u ? `<p class="hint">Målene gjelder hele ${f.u ? 'hesteskoen' : 'vinkelen'}. Typen velger du på lista.</p>` : ''}
  </section>`;
}

export function roomPanel(state, ui, r) {
  return `
  <section class="panel" aria-label="Valgt rom">
    <h2>${esc(roomLabel(state.rooms, r))}<small>${r.m2} m²</small></h2>
    <span class="q-label">Mål på veggene, i cm</span>
    <p class="hint">Fyll bare inn de veggene du har mål på. Resten regnes ut fra tegningen. Trykk på en bokstav på tegningen for å hoppe til riktig felt.</p>
    <div class="walls">
      ${edges(r.poly).map((e, i) => { const set = (r.fixed || []).includes(i); return `<div class="field"><label for="edge-${i}">Vegg ${letter(i)}${set ? ' <span class="setmark">satt</span>' : ''}</label>
        <input id="edge-${i}" inputmode="numeric" data-ch="edgelen" data-v="${i}" value="${set ? Math.round(e.len) : ''}" placeholder="${Math.round(e.len)}"></div>`; }).join('')}
    </div>
    <span class="q-label">Hva slags rom er det?</span>
    <div class="chips" role="group" aria-label="Type rom">
      ${Object.entries(ROOMS).map(([id, t]) => `<button class="chip mini ${r.type === id ? 'on' : ''}" data-act="rtype" data-v="${id}" aria-pressed="${r.type === id}">${t.name}</button>`).join('')}
    </div>
    <button class="link danger" data-act="delroom">Fjern rommet</button>
  </section>`;
}

// Tingene på lista som kan settes ut i et rom, med hvor mange som alt står der.
function placeable(state, r) {
  return instances(state)
    .filter((i) => i.room.id === r.id && (i.st === 'need' || i.st === 'bought') && !i.item.custom && footprint(i.itemId, i.size))
    .map((i) => ({ id: i.itemId, name: i.item.name, qty: i.qty, size: i.size, count: (state.furn || []).filter((f) => f.room === r.id && f.item === i.itemId).length }));
}

function placePanel(state, ui, r) {
  const list = placeable(state, r);
  return `
  <section class="panel" aria-label="Sett ut i rommet">
    <h2>${esc(roomLabel(state.rooms, r))}<small>${r.m2} m²</small></h2>
    ${list.length ? `<span class="q-label">Sett ut</span>
    <div class="chips" role="group" aria-label="Ting som kan settes ut">
      ${list.map((x) => `<button class="chip mini ${x.count ? 'on' : 'add'}" data-act="addfurn" data-v="${x.id}">${x.count >= x.qty ? '' : '+ '}${esc(x.name)}${x.qty > 1 ? ` ${x.count}/${x.qty}` : ''}</button>`).join('')}
    </div>
    <p class="hint">Mørke knapper står allerede på tegningen. Trykk for å finne dem igjen.</p>`
    : `<p class="hint">Ingenting på lista for dette rommet kan settes ut. <button class="link" data-act="step" data-v="2">Velg ting</button></p>`}
  </section>`;
}

// Steget «Plasser»: samme tegning, men bare for å sette ut og flytte møbler.
export function furnishView(state, ui, canUndo) {
  const S = ui.sheet;
  const rooms = state.rooms.filter((r) => r.poly && (r.floor || 0) === ui.floor);
  const picked = (state.furn || []).find((f) => f.id === ui.furn);
  const cur = rooms.find((r) => r.id === (ui.room || picked?.room));
  const out = (state.furn || []).length;
  return `
  ${state.floors.length > 1 ? `<div class="floors" role="group" aria-label="Etasje">
    ${state.floors.map((f, i) => `<button class="chip mini ${ui.floor === i ? 'on' : ''}" data-act="floor" data-v="${i}" aria-pressed="${ui.floor === i}">${esc(f)}</button>`).join('')}</div>` : ''}
  <div class="row undo-row">
    <button class="btn small" data-act="arrange">Sett ut alt for meg</button>
    <button class="btn ghost small" data-act="undo" ${canUndo ? '' : 'disabled'}>Angre</button>
    ${out ? '<button class="link danger" data-act="clearfurn">Ta bort alle</button>' : ''}
  </div>
  <p class="hint tool-hint">Trykk på et rom for å velge hva som skal stå der. Trykk på et møbel for å velge det, og dra for å flytte. Knappene for å snu ligger rett under tegningen.</p>
  ${sheetSvg(state, ui, rooms, 'Ingen rom på denne etasjen')}
  ${furnBar(state, ui)}
  ${ui.note ? `<p class="status bad" role="status">${esc(ui.note)}</p>` : ''}
  ${ui.info ? `<p class="status" role="status">${esc(ui.info)}</p>` : ''}
  <div class="sheetrow"><span class="plan-sum">${out === 1 ? '1 møbel er satt ut.' : out ? `${out} møbler er satt ut.` : 'Ingen møbler er satt ut ennå.'} Store ruter er 1 meter.</span>
    <span class="chips" role="group" aria-label="Arkstørrelse">${SHEETS.map((s) => `<button class="chip mini ${S === s ? 'on' : ''}" data-act="sheet" data-v="${s}" aria-pressed="${S === s}">${s / 100} m</button>`).join('')}</span></div>
  ${rooms.length ? `<div class="chips" role="group" aria-label="Rom på denne etasjen">${rooms.map((r) => `<button class="chip mini ${cur?.id === r.id ? 'on' : ''}" data-act="room" data-v="${r.id}" aria-pressed="${cur?.id === r.id}">${esc(roomLabel(state.rooms, r))}</button>`).join('')}</div>` : ''}
  ${furnPanel(state, ui)}
  ${cur ? placePanel(state, ui, cur) : ''}`;
}

// ---------- Hendelser ----------

let drag = null;
let focusEdge = null;
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
      const fEl = ui.furnish ? e.target.closest('[data-furn]') : null, rEl = e.target.closest('[data-room]'); // møbler flyttes bare på «Plasser»
      const hEl = e.target.closest('[data-corner], [data-wall]');
      const cur = state.rooms.find((r) => r.id === ui.room);
      if (hEl && cur?.poly) {
        drag.room = cur; drag.poly0 = cur.poly;
        drag.shape = hEl.dataset.corner !== undefined ? { kind: 'corner', i: Number(hEl.dataset.corner) } : { kind: 'wall', i: Number(hEl.dataset.wall) };
        drag.el = svg.querySelector(`[data-room="${cur.id}"]`);
        drag.g = svg.querySelector(`[data-g="${cur.id}"]`);
      } else if (fEl) {
        const f = state.furn.find((x) => x.id === fEl.dataset.furn);
        drag.furn = f; drag.el = fEl; drag.pos = [f.x, f.y];
      } else if (rEl) {
        drag.room = state.rooms.find((r) => r.id === rEl.dataset.room);
        drag.el = svg.querySelector(`[data-g="${rEl.dataset.room}"]`);
        drag.delta = [0, 0];
        drag.fixed = !!ui.furnish; // på «Plasser» står rommene i ro: der flytter man bare møbler
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
    } else if (drag.shape && drag.far) {
      const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
      drag.np = drag.shape.kind === 'corner' ? moveCorner(drag.poly0, drag.shape.i, dx, dy) : moveWall(drag.poly0, drag.shape.i, dx, dy);
      drag.el.setAttribute('points', pts(drag.np));
      drag.g.classList.add('shaping');
    } else if (drag.room && drag.far && !drag.fixed) {
      drag.delta = [Math.round((p[0] - drag.start[0]) / 10) * 10, Math.round((p[1] - drag.start[1]) / 10) * 10];
      drag.el.setAttribute('transform', `translate(${drag.delta[0]} ${drag.delta[1]})`);
    }
  });

  // Deler rommet streken går gjennom. Den største delen beholder navn, type og valg på lista.
  const splitWith = (state, raw, tol) => {
    let room = null, most = 0;
    for (const r of floorRooms()) { const c = raw.filter((q) => pointInPoly(q, r.poly)).length; if (c > most) { most = c; room = r; } }
    let line = room && straightenLine(raw, tol);
    if (!line) { ui.note = 'Tegn rundt et rom, eller dra en strek tvers over et rom for å dele det.'; return; }
    // Legg streken på linje med hjørner som ligger like ved, for eksempel knekken i et vinkelrom.
    const corners = floorRooms().flatMap((r) => r.poly);
    const near = (v, k2) => { let best = v, dmin = tol * 0.6; for (const q of corners) if (Math.abs(q[k2] - v) < dmin) { dmin = Math.abs(q[k2] - v); best = q[k2]; } return best; };
    line = line.map(([x, y]) => [near(x, 0), near(y, 1)]);
    const parts = splitPoly(room.poly, line);
    if (!parts) { ui.note = 'Streken delte ikke rommet. Dra den tvers over, fra vegg til vegg.'; return; }
    const [A, B] = parts.map(canonical);
    const big = area(A) >= area(B) ? A : B, small = big === A ? B : A;
    const old = room.poly, bigDoors = [], smallDoors = [];
    for (const o of room.doors || []) {
      const x = remapDoor(old, o, big);
      if (x) bigDoors.push(x); else { const y = remapDoor(old, o, small); if (y) smallDoors.push(y); }
    }
    const id = 'r' + (state.seq = (state.seq || 100) + 1);
    room.poly = big; room.doors = bigDoors; room.fixed = []; refit(room);
    const piece = refit({ id, type: room.type, size: 'M', m2: null, wall: null, floor: room.floor || 0, poly: small, doors: smallDoors });
    piece.type = guessType(state.rooms, piece.m2); refit(piece);
    for (const f of state.furn) if (f.room === room.id && pointInPoly([f.x, f.y], small)) f.room = id;
    state.rooms = [...state.rooms, piece];
    ui.room = id; ui.furn = null;
  };

  const finish = (cancelled) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    const state = ctx.state();
    ui.note = ''; ui.info = '';
    if (cancelled) { ctx.render(); return; }

    if (d.tool === 'draw') {
      const tol = clamp(14 * (d.slop / 8), 25, 90); // en finger treffer omtrent innenfor 14 piksler
      if (d.far && isLine(d.pts, tol)) { splitWith(state, d.pts, tol); ctx.save(); ctx.render(); return; }
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
      if (d.shape) {
        const next = d.far && d.np ? valid(d.np) : null;
        if (next) {
          d.room.doors = remapDoors(d.poly0, d.room.doors, next); // dørene står der de sto
          d.room.poly = next; d.room.fixed = []; refit(d.room);
          settle(state, ui, d.room, d.poly0, d.np);
        } else if (d.far) ui.note = 'Rommet ble for lite eller vrengt. Prøv en mindre endring.';
        else if (d.shape.kind === 'wall') focusEdge = d.shape.i; // et trykk på bokstaven: gå til feltet for den veggen
        ui.room = d.room.id; ui.furn = null;
      } else if (d.furn) {
        if (d.far) { d.furn.x = d.pos[0]; d.furn.y = d.pos[1]; }
        ui.furn = d.furn.id; ui.room = null;
      } else if (d.room) {
        if (d.far && !d.fixed && (d.delta[0] || d.delta[1])) {
          const from = d.room.poly[0];
          d.room.poly = fitSheet(moved(d.room.poly, d.delta[0], d.delta[1]), ui.sheet);
          const dx = d.room.poly[0][0] - from[0], dy = d.room.poly[0][1] - from[1];
          for (const f of state.furn) if (f.room === d.room.id) { f.x += dx; f.y += dy; }
        }
        ui.room = d.room.id; ui.furn = null;
      } else {
        ui.room = null; ui.furn = null;
        // En lang strek på tomt ark mens «Velg og flytt» er valgt: brukeren prøver trolig å tegne.
        if (d.far && !ui.furnish) ui.note = 'Nå er «Velg og flytt» valgt. Trykk «Tegn rom» over tegningen for å tegne.';
      }
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
    if (focusEdge !== null) {
      const input = document.getElementById(`edge-${focusEdge}`);
      focusEdge = null;
      if (input) { input.scrollIntoView({ block: 'center', behavior: 'smooth' }); input.focus({ preventScroll: true }); }
    }
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
  // Nye mål skrevet for hånd: møbelet skyves inn igjen hvis det ellers ville stukket gjennom en vegg.
  const resize = (f, dims) => {
    const room = ctx.state().rooms.find((r) => r.id === f.room);
    const next = { ...f, ...dims };
    Object.assign(f, (room?.poly && keepInside(room, next)) || next);
  };
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
      // Setter ut alt på lista som mangler på tegningen, rom for rom. Det som alt står der, blir stående.
      arrange() {
        const s = ctx.state();
        let added = 0;
        const missed = [];
        for (const r of s.rooms.filter((x) => x.poly)) {
          const existing = s.furn.filter((f) => f.room === r.id);
          const wants = placeable(s, r).map((x) => { const fp = footprint(x.id, x.size); return { item: x.id, w: fp[0], d: fp[1], qty: Math.max(0, x.qty - x.count), s: x.size, corner: shapeOf(x.id, x.size) === 'L', u: shapeOf(x.id, x.size) === 'U' }; });
          if (!wants.some((w) => w.qty > 0)) continue;
          // En dør tegnet i naborommet er også en dør her, når den står i veggen de deler.
          const shared = s.rooms.filter((o) => o !== r && o.poly && (o.floor || 0) === (r.floor || 0))
            .flatMap((o) => (o.doors || []).map((d) => remapDoor(o.poly, d, r.poly)).filter(Boolean));
          const res = arrangeRoom({ poly: r.poly, doors: [...(r.doors || []), ...shared] }, wants, existing);
          const fresh = res.placed.slice(0, Math.max(0, 80 - s.furn.length)).map((f) => ({ id: 'f' + (s.seq = (s.seq || 100) + 1), room: r.id, ...f }));
          s.furn = [...fresh.filter((f) => f.item === 'teppe'), ...s.furn, ...fresh.filter((f) => f.item !== 'teppe')]; // tepper tegnes underst
          added += fresh.length;
          for (const id of new Set(res.skipped)) missed.push(`${ITEMS[id].name.toLowerCase()} i ${roomLabel(s.rooms, r).toLowerCase()}`);
        }
        const rest = missed.length ? ` Fant ikke god plass til ${missed.slice(0, 4).join(', ')}${missed.length > 4 ? ' og flere' : ''}. De kan du sette ut selv.` : '';
        ui.furn = null; ui.note = '';
        ui.info = added ? `${added === 1 ? 'Satte ut 1 møbel. Dra det dit du vil ha det.' : `Satte ut ${added} møbler. Dra dem dit du vil ha dem.`}${rest}` : (rest.trim() || 'Alt på lista som kan settes ut, står der allerede.');
        ctx.commit();
      },
      clearfurn() { const s = ctx.state(); s.furn = []; ui.furn = null; ui.info = ''; ctx.commit(); },
      addfurn(v) {
        const s = ctx.state(), r = sel() || s.rooms.find((x) => x.id === selFurn()?.room);
        if (!r?.poly || !ITEMS[v]) return;
        const inst = instances(s).find((i) => i.room.id === r.id && i.itemId === v);
        const have = s.furn.filter((f) => f.room === r.id && f.item === v);
        if (have.length >= (inst?.qty || 1)) { // alle er satt ut: velg neste, så man kan flytte dem etter tur
          const at = have.findIndex((f) => f.id === ui.furn);
          ui.furn = have[(at + 1) % have.length].id; ui.room = null; ui.tool = 'move'; ctx.later(); return;
        }
        const size = inst?.size || r.size;
        const fp = footprint(v, size);
        if (!fp || s.furn.length >= 80) return;
        const c = labelPoint(r.poly);
        let spot = { x: Math.round(c[0] / 5) * 5 + have.length * 30, y: Math.round(c[1] / 5) * 5 + have.length * 30, r: 0 };
        const bed = v === 'nattbord' ? s.furn.find((f) => f.room === r.id && f.item === 'seng') : null;
        if (bed) spot = besideBed(r.poly, bed, fp, have) || spot; // nattbord havner ved hodeenden, ett på hver side
        const id = 'f' + (s.seq = (s.seq || 100) + 1);
        s.furn = [...s.furn, { id, room: r.id, item: v, x: spot.x, y: spot.y, w: fp[0], d: fp[1], r: spot.r, s: size, ...(shapeOf(v, size) === 'L' ? { corner: 'se' } : shapeOf(v, size) === 'U' ? { u: 's' } : {}) }];
        ui.furn = id; ui.room = null; ui.tool = 'move';
        ctx.commit();
      },
      // Snur møbelet. Det blir stående inne i rommet: treffer det en vegg, skyves det inntil den.
      rotfurn() {
        const s = ctx.state(), f = selFurn();
        if (!f) return;
        const room = s.rooms.find((r) => r.id === f.room);
        const next = room?.poly ? turned(room, f) : { ...f, r: f.r === 90 ? 0 : 90 };
        ui.note = ''; ui.info = '';
        if (!next) { ui.note = 'Det er ikke plass til å snu den i dette rommet.'; ctx.later(); return; }
        Object.assign(f, next);
        ctx.commit();
      },
      flipfurn() {
        const s = ctx.state(), f = selFurn();
        if (!f?.corner && !f?.u) return;
        const room = s.rooms.find((r) => r.id === f.room);
        const next = flipped(f);
        Object.assign(f, (room?.poly && keepInside(room, next)) || next);
        ui.note = ''; ctx.commit();
      },
      delfurn() { const s = ctx.state(); s.furn = s.furn.filter((f) => f.id !== ui.furn); ui.furn = null; ctx.commit(); },
    },
    changes: {
      // Veggen du setter mål på, låses. Naboveggen flyttes på den siden som ikke rokker ved et mål du alt har satt.
      edgelen(el) {
        const r = sel(), len = num(el.value), i = Number(el.dataset.v);
        if (!r?.poly || !(i >= 0 && i < r.poly.length)) return;
        const fixed = new Set(r.fixed || []);
        if (!len) { fixed.delete(i); r.fixed = [...fixed]; return; }
        const n = r.poly.length, old = r.poly;
        const fromStart = fixed.has((i + 2) % n) && !fixed.has((i - 2 + n) % n);
        const next = setEdgeLength(old, i, len, fromStart);
        r.doors = remapDoors(old, r.doors, next);
        r.poly = next;
        if (next.length === n) { fixed.add(i); r.fixed = [...fixed]; } else r.fixed = [];
        refit(r);
        settle(ctx.state(), ui, r, old, next);
      },
      furnw(el) { const f = selFurn(), n = num(el.value); if (f && n) resize(f, { w: clamp(n, 20, 600) }); },
      furnd(el) { const f = selFurn(), n = num(el.value); if (f && n) resize(f, { d: clamp(n, 20, 600) }); },
    },
  };
}
