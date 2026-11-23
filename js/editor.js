// Plantegningen: tegn omrisset, del det i rom med rette streker, sett mål, dører, vinduer og møbler.
// Mens man drar, endres bare det som vises. Tilstanden lagres når man slipper.
import { ROOMS, ITEMS } from './data.js';
import { roomLabel, sizeFromM2, footprint, instances, shapeOf, furnName } from './logic.js';
import {
  straighten, straightenLine, isLine, splitPoly, alignTo, fitSheet, canonical,
  area, areaM2, edges, letter, nearestEdge, labelPoint, pointInPoly, wallFor,
} from './plan.js';
import { planEdit, planLength, applyPlan, splitAlong, hostsOf, placeOn, syncDoors, coverage, neighbourAt } from './walls.js';
import { arrangeRoom, armOf, localNotch, localOpen, flipped, turned, keepInside } from './arrange.js';

export const SHEETS = [1000, 1500, 2500];
const TOOLS = [['draw', 'Tegn og del'], ['move', 'Flytt'], ['door', 'Dør'], ['window', 'Vindu']];
const HINTS = {
  draw: 'Trykk på et rom, en vegg, en dør eller et vindu for å endre det.',
  move: 'Dra i en vegg, et hjørne eller hele boligen. Trykk for å velge.',
  door: 'Trykk på en vegg for å sette inn en dør.',
  window: 'Trykk på en vegg for å sette inn et vindu.',
};
const WIDTHS = { door: [70, 80, 90], window: [60, 100, 120, 150, 200] }; // vanlige bredder, i cm
const KIND = { door: 'Dør', window: 'Vindu' };

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

const onFloor = (state, floor) => state.rooms.filter((r) => r.poly && (r.floor || 0) === floor);

// Tar bort alt som er tegnet på én etasje: rom, møbler, dører og vinduer. Rommene på de andre etasjene står.
export function clearFloor(state, floor) {
  const gone = new Set(onFloor(state, floor).map((r) => r.id));
  state.rooms = state.rooms.filter((r) => !gone.has(r.id));
  state.furn = (state.furn || []).filter((f) => !gone.has(f.room));
  state.custom = (state.custom || []).filter((c) => !gone.has(c.room));
  state.openings = (state.openings || []).filter((o) => o.floor !== floor);
  state.drawn = state.rooms.some((r) => r.poly);
  delete state.auto;
}
// Veggen en dør eller et vindu måles langs: helst en vegg i det valgte rommet.
const refHost = (rooms, o, prefer) => { const hs = hostsOf(rooms, o); return hs.find((h) => h.id === prefer) || hs[0] || null; };

// Neste steg i tegningen. Gir [steg, tekst]; steg 0 betyr at alt det viktigste er gjort.
function guide(state, ui, rooms) {
  const left = rooms.filter((r) => r.guess).length;
  if (!rooms.length) return [1, 'Dra en strek tvers over arket for å dele det i to rom, eller tegn en runde rundt boligen.'];
  if (rooms.length === 1) return [2, 'Dra en rett strek tvers over boligen for å dele den i rom.'];
  if (left) return [3, `Trykk på hvert rom og velg hva det er. ${left === 1 ? 'Ett rom' : `${left} rom`} igjen.`];
  if (!(state.openings || []).some((o) => o.floor === ui.floor)) return [4, 'Velg «Dør» eller «Vindu» og trykk på veggen der den står.'];
  return [0, 'Trykk på en vegg, en dør eller et vindu for å sette mål.'];
}

// ---------- Visning ----------

function roomSvg(state, ui, r, k) {
  const picked = (state.furn || []).find((f) => f.id === ui.furn);
  const on = ui.room === r.id || picked?.room === r.id; // rommet til det valgte møbelet viser også veggbokstavene
  const c = labelPoint(r.poly);
  const shape = ui.room === r.id && ui.tool === 'move' && !ui.furnish;
  const selWall = ui.room === r.id && !ui.furnish && !ui.opening && Number.isInteger(ui.wall) ? ui.wall : -1;
  const marks = on ? edges(r.poly).map((e, i) => {
    const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    const u = [(e.b[0] - e.a[0]) / (e.len || 1), (e.b[1] - e.a[1]) / (e.len || 1)];
    let n = [-u[1], u[0]];
    if (pointInPoly([mid[0] + n[0] * 12, mid[1] + n[1] * 12], r.poly)) n = [u[1], -u[0]]; // bokstaven står på utsiden, så den ikke dekker møbler
    const p = [mid[0] + n[0] * 30 * k, mid[1] + n[1] * 30 * k];
    const q = [mid[0] - n[0] * 26 * k, mid[1] - n[1] * 26 * k]; // lengden står på innsiden
    return `${i === selWall ? `<line class="wsel" x1="${e.a[0]}" y1="${e.a[1]}" x2="${e.b[0]}" y2="${e.b[1]}" stroke-width="${10 * k}"/>` : ''}
      ${e.len >= 90 * k ? `<text class="wlen ${(r.fixed || []).includes(i) ? 'set' : ''}" x="${q[0]}" y="${q[1]}" font-size="${21 * k}" dy="${7 * k}">${m(e.len)} m</text>` : ''}
      <circle class="mark ${i === selWall ? 'on' : ''}" cx="${p[0]}" cy="${p[1]}" r="${19 * k}"/><text class="mark-t" x="${p[0]}" y="${p[1]}" font-size="${23 * k}" dy="${8 * k}">${letter(i)}</text>`;
  }).join('') + (shape ? r.poly.map((c2) => `<circle class="handle" cx="${c2[0]}" cy="${c2[1]}" r="${12 * k}" stroke-width="${4 * k}"/>`).join('') : '') : '';
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
    <polygon class="proom ${on ? 'on' : ''} ${r.guess ? 'guess' : ''}" data-room="${r.id}" points="${pts(r.poly)}" stroke-width="${6 * k}"/>
    <text class="pname" x="${c[0]}" y="${c[1]}" font-size="${32 * k}">${r.guess && !ui.furnish ? 'Rom?' : esc(roomLabel(state.rooms, r))}</text>
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

// Dører og vinduer tegnes én gang per etasje, også når to rom deler veggen. Tegnes i sin egen ramme med veggen
// langs x-aksen, så de kan skyves bortover veggen uten å tegnes på nytt.
function opsSvg(state, ui, rooms, k) {
  return (state.openings || []).filter((o) => o.floor === ui.floor).map((o) => {
    const on = ui.opening === o.id && !ui.furnish;
    const h = refHost(rooms, o, on ? ui.room : null);
    if (!h) return '';
    const half = o.w / 2, ang = Math.round((Math.atan2(h.u[1], h.u[0]) * 1800) / Math.PI) / 10;
    const into = pointInPoly([o.x - h.u[1] * 15, o.y + h.u[0] * 15], rooms[h.ri].poly) ? 1 : -1; // døra slår inn i rommet
    const body = o.kind === 'window'
      ? `<rect class="win" x="${-half}" y="${-7 * k}" width="${o.w}" height="${14 * k}" stroke-width="${2.5 * k}"/><line class="win" x1="${-half}" y1="0" x2="${half}" y2="0" stroke-width="${2 * k}"/>`
      : `<path class="door" d="M${-half} 0L${-half} ${into * o.w}A${o.w} ${o.w} 0 0 ${into > 0 ? 0 : 1} ${half} 0" stroke-width="${2.5 * k}"/>`;
    // Valgt: vis hvor avstanden måles fra, med en prikk i hjørnet og en strek bort til åpningen.
    const dim = on ? `<line class="opdim" x1="${-h.s}" y1="0" x2="${-half}" y2="0" stroke-width="${5 * k}" stroke-dasharray="${10 * k} ${8 * k}"/><circle class="opref" cx="${-h.s}" cy="0" r="${9 * k}"/>` : '';
    return `<g class="op ${o.kind} ${on ? 'on' : ''}" data-op="${o.id}" transform="translate(${o.x} ${o.y}) rotate(${ang})">${dim}<line class="gap" x1="${-half}" y1="0" x2="${half}" y2="0" stroke-width="${9 * k}"/>${body}</g>`;
  }).join('');
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

// Etter en endring: sørg for at alt ligger inne på arket, at arket er stort nok, og at dører, vinduer og mål stemmer.
function settle(state, ui) {
  const all = state.rooms.filter((r) => r.poly);
  const minX = Math.min(0, ...all.flatMap((r) => r.poly.map((p) => p[0]))), minY = Math.min(0, ...all.flatMap((r) => r.poly.map((p) => p[1])));
  if (minX < 0 || minY < 0) { // noe havnet utenfor venstre eller øvre kant: skyv hele tegningen inn
    for (const r of all) r.poly = r.poly.map(([x, y]) => [x - minX, y - minY]);
    for (const f of state.furn) { f.x -= minX; f.y -= minY; }
    for (const o of state.openings || []) { o.x -= minX; o.y -= minY; }
  }
  syncDoors(state);
  for (const r of all) refit(r);
  ui.sheet = Math.max(ui.sheet, sheetFor(state, ui.sheet));
}

// Minste ark som rommer alt som er tegnet.
export function sheetFor(state, fallback) {
  const far = Math.max(0, ...state.rooms.filter((r) => r.poly).flatMap((r) => r.poly.flat()));
  return far ? (SHEETS.find((s) => s >= far) || SHEETS[SHEETS.length - 1]) : fallback;
}

// Selve arket med rutenett, rom, dører, vinduer og møbler.
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
    <g class="ops">${opsSvg(state, ui, rooms, k)}</g>
    ${rooms.length ? '' : `<text class="empty" x="${S / 2}" y="${S / 2}" font-size="${36 * k}">${emptyText}</text>`}
    <polyline id="ink" fill="none" stroke-width="${5 * k}" points=""/>
  </svg></div>`;
}

// Linja rett under tegningen: det som er valgt, og det man kan gjøre med det. Den har alltid samme høyde, så
// ingenting hopper, og den fester seg over «Neste»-knappen så den kan nås mens man ser på tegningen.
function planBar(state, ui, rooms) {
  const o = (state.openings || []).find((x) => x.id === ui.opening);
  const r = rooms.find((x) => x.id === ui.room);
  if (o) {
    const h = refHost(rooms, o, ui.room);
    const where = h ? `vegg ${letter(h.e)} i ${roomLabel(state.rooms, rooms[h.ri]).toLowerCase()}` : '';
    return `<div class="planbar on" role="group" aria-label="${KIND[o.kind]} i ${esc(where)}">
      <div class="barrow">
        <span class="seg" role="group" aria-label="Dør eller vindu">${['door', 'window'].map((kd) => `<button class="segbtn ${o.kind === kd ? 'on' : ''}" data-act="opkind" data-v="${kd}" aria-pressed="${o.kind === kd}">${KIND[kd]}</button>`).join('')}</span>
        <label class="barfield">Bredde, cm<input id="opw" inputmode="numeric" data-ch="opw" value="${o.w}"></label>
        <label class="barfield">Fra hjørnet, cm<input id="opd" inputmode="numeric" data-ch="opd" value="${h ? Math.max(0, Math.round(h.s - o.w / 2)) : ''}"></label>
      </div>
      <div class="barrow">
        <span class="barscroll" role="group" aria-label="Vanlige bredder">${WIDTHS[o.kind].map((w) => `<button class="barchip ${o.w === w ? 'on' : ''}" data-act="opwset" data-v="${w}" aria-pressed="${o.w === w}">${w} cm</button>`).join('')}</span>
        <button class="barbtn danger" data-act="delop">Ta bort</button>
      </div></div>`;
  }
  if (r && Number.isInteger(ui.wall) && ui.wall < r.poly.length) {
    const e = edges(r.poly)[ui.wall], other = neighbourAt(rooms, r.id, ui.wall);
    const set = (r.fixed || []).includes(ui.wall);
    return `<div class="planbar on" role="group" aria-label="Vegg ${letter(ui.wall)} i ${esc(roomLabel(state.rooms, r).toLowerCase())}">
      <div class="barrow">
        <span class="planbar-name">Vegg ${letter(ui.wall)}<small>${esc(roomLabel(state.rooms, r))}${other ? ` og ${esc(roomLabel(state.rooms, other).toLowerCase())}` : ''}</small></span>
        <button class="barbtn light" data-act="addop" data-v="door">+ Dør</button>
        <button class="barbtn light" data-act="addop" data-v="window">+ Vindu</button>
      </div>
      <div class="barrow">
        <button class="barbtn" data-act="wallnudge" data-v="-10" aria-label="10 cm kortere">− 10</button>
        <label class="barfield wide">Lengde, cm${set ? ' <span class="setmark">satt</span>' : ''}<input id="walllen" inputmode="numeric" data-ch="walllen" value="${Math.round(e.len)}"></label>
        <button class="barbtn" data-act="wallnudge" data-v="10" aria-label="10 cm lengre">+ 10</button>
      </div></div>`;
  }
  if (r) {
    return `<div class="planbar on" role="group" aria-label="Valgt rom">
      <div class="barrow">
        <span class="planbar-name">${r.guess ? 'Hva slags rom er dette?' : esc(roomLabel(state.rooms, r))}<small>${r.m2} m²</small></span>
        <button class="barbtn danger" data-act="delroom">Fjern rommet</button>
      </div>
      <div class="barrow"><span class="barscroll" role="group" aria-label="Hva slags rom er det?">
        ${Object.entries(ROOMS).map(([id, t]) => `<button class="barchip ${r.type === id && !r.guess ? 'on' : ''}" data-act="rtype" data-v="${id}" aria-pressed="${r.type === id && !r.guess}">${t.name}</button>`).join('')}
      </span></div></div>`;
  }
  return `<div class="planbar"><span class="furnbar-hint">${HINTS[ui.tool]}</span></div>`;
}

export function drawView(state, ui, canUndo) {
  const S = ui.sheet;
  const rooms = onFloor(state, ui.floor);
  const all = state.rooms.filter((r) => r.poly);
  // Det som er valgt, må finnes på denne etasjen.
  const sel = rooms.find((r) => r.id === ui.room);
  if (!sel || !(ui.wall >= 0 && ui.wall < sel.poly.length)) ui.wall = null;
  if (!(state.openings || []).some((o) => o.id === ui.opening && o.floor === ui.floor)) ui.opening = null;
  const [step, text] = guide(state, ui, rooms);
  return `
  <div class="floors" role="group" aria-label="Etasje">
    ${state.floors.map((f, i) => `<button class="chip mini ${ui.floor === i ? 'on' : ''}" data-act="floor" data-v="${i}" aria-pressed="${ui.floor === i}">${esc(f)}</button>`).join('')}
    ${state.floors.length < 5 ? '<button class="chip mini add" data-act="addfloor">+ Etasje</button>' : ''}
  </div>
  <div class="tools" role="group" aria-label="Verktøy">
    ${TOOLS.map(([id, name]) => `<button class="tool ${ui.tool === id ? 'on' : ''}" data-act="tool" data-v="${id}" aria-pressed="${ui.tool === id}">${name}</button>`).join('')}
  </div>
  <p class="guide" role="status">${step ? `<b>Steg ${step} av 4</b>` : '<b>Ferdig?</b>'} ${text}</p>
  ${ui.note ? `<p class="status bad" role="status">${esc(ui.note)}</p>` : ''}${ui.info ? `<p class="status" role="status">${esc(ui.info)}</p>` : ''}
  <div class="row undo-row"><button class="btn ghost small" data-act="undo" ${canUndo ? '' : 'disabled'}>Angre</button>
    ${rooms.length ? '<button class="btn ghost small" data-act="redraw">Tegn på nytt</button>' : ''}</div>
  ${sheetSvg(state, ui, rooms, 'Tegn omrisset av boligen her')}
  ${planBar(state, ui, rooms)}
  <div class="sheetrow"><span class="plan-sum">${all.length ? `Omtrent ${all.reduce((s, r) => s + r.m2, 0)} m² i ${all.length} rom.` : (state.drawn ? '' : 'Det du tegner, erstatter rommene fra «Velg bolig».')} Store ruter er 1 meter.</span>
    <span class="chips" role="group" aria-label="Arkstørrelse">${SHEETS.map((s) => `<button class="chip mini ${S === s ? 'on' : ''}" data-act="sheet" data-v="${s}" aria-pressed="${S === s}">${s / 100} m</button>`).join('')}</span></div>
  ${rooms.length ? `<div class="chips" role="group" aria-label="Rom på denne etasjen">${rooms.map((r) => `<button class="chip mini ${ui.room === r.id ? 'on' : ''}" data-act="room" data-v="${r.id}" aria-pressed="${ui.room === r.id}">${esc(roomLabel(state.rooms, r))}</button>`).join('')}</div>` : ''}
  ${state.drawn ? '' : '<p><button class="btn ghost small" data-act="usepreset">Start med rommene fra «Velg bolig»</button></p>'}
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
    <p class="hint">Fyll bare inn de veggene du har mål på. Resten regnes ut fra tegningen. Du kan også trykke på en vegg på tegningen.</p>
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

// Omrisset når man deler et tomt ark: hele arket på tvers av streken, og så langt streken går langs den.
export function sheetOutline(line, sheet) {
  const pad = Math.round(sheet * 0.05 / 10) * 10, lo = pad, hi = sheet - pad;
  const xs = line.map((p) => p[0]), ys = line.map((p) => p[1]);
  const span = (a, b) => { const p = clamp(Math.round(a / 10) * 10, lo, hi), q = clamp(Math.round(b / 10) * 10, lo, hi); return q - p >= 200 ? [p, q] : [lo, hi]; };
  const tall = Math.max(...ys) - Math.min(...ys) >= Math.max(...xs) - Math.min(...xs);
  const [x0, x1] = tall ? [lo, hi] : span(Math.min(...xs), Math.max(...xs));
  const [y0, y1] = tall ? span(Math.min(...ys), Math.max(...ys)) : [lo, hi];
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
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
  const floorRooms = () => onFloor(ctx.state(), ui.floor);
  const select = (room = null, wall = null, op = null) => { ui.room = room; ui.wall = wall; ui.opening = op; ui.furn = null; };

  // Hindrer at siden ruller eller zoomer mens man tegner. Noen nettlesere overser touch-action på SVG.
  const hold = (e) => { if (e.target.closest?.('#draw')) e.preventDefault(); };
  for (const type of ['touchstart', 'touchmove', 'gesturestart']) app.addEventListener(type, hold, { passive: false });

  // Veggen nærmest et punkt. Deler to rom veggen, velges helst veggen i det valgte rommet, ellers i rommet punktet ligger i.
  const nearWall = (p, rooms) => {
    const cur = rooms.find((r) => r.id === ui.room);
    const inside = rooms.filter((r) => pointInPoly(p, r.poly)), home = inside.find((r) => r === cur) || inside[0];
    let best = null;
    for (const r of rooms) {
      const n = nearestEdge(r.poly, p), score = n.d - (r === cur ? 2 : 0) - (r === home ? 1 : 0);
      if (!best || score < best.score) best = { r, n, score };
    }
    return { best, home };
  };

  // Hva ligger under fingeren? reach = hvor langt unna en finger kan treffe, i cm.
  // Rekkefølge: hjørner i det valgte rommet (bare når de kan dras), så dører og vinduer, så vegger, så rom.
  const pick = (p, reach, corners) => {
    const rooms = floorRooms(), cur = rooms.find((r) => r.id === ui.room);
    if (corners && cur) {
      let bi = -1, bd = reach * 1.5;
      cur.poly.forEach((q, i) => { const dd = Math.hypot(q[0] - p[0], q[1] - p[1]); if (dd < bd) { bd = dd; bi = i; } });
      if (bi >= 0) return { kind: 'corner', room: cur, i: bi };
    }
    let op = null;
    for (const o of (ctx.state().openings || [])) {
      const h = o.floor === ui.floor && hostsOf(rooms, o)[0];
      if (!h) continue;
      const s = clamp((p[0] - o.x) * h.u[0] + (p[1] - o.y) * h.u[1], -o.w / 2, o.w / 2);
      const dd = Math.hypot(p[0] - o.x - h.u[0] * s, p[1] - o.y - h.u[1] * s);
      if (dd <= reach && (!op || dd < op.d)) op = { o, d: dd };
    }
    if (op) return { kind: 'opening', o: op.o };
    const { best, home } = nearWall(p, rooms);
    if (best && best.n.d <= reach) {
      // I et lite rom skal et trykk midt i rommet fortsatt velge rommet, ikke en vegg.
      const deep = home ? nearestEdge(home.poly, labelPoint(home.poly)).d : Infinity;
      if (!home || best.n.d <= Math.min(reach, deep * 0.55)) return { kind: 'wall', room: best.r, i: best.n.i };
    }
    return home ? { kind: 'room', room: home } : null;
  };

  app.addEventListener('pointerdown', (e) => {
    const svg = e.target.closest?.('#draw');
    if (!svg || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (drag) { drag.ink?.setAttribute('points', ''); drag = null; } // forrige strek ble aldri avsluttet (fingeren slapp utenfor siden)
    const state = ctx.state();
    const p = toCm(e, svg);
    const pxToCm = ui.sheet / svg.getBoundingClientRect().width;
    drag = { tool: ui.tool, svg, id: e.pointerId, start: p, last: p, far: false, slop: 8 * pxToCm, t: performance.now() };
    if (ui.furnish) { // på «Plasser» står rommene i ro: der flytter man bare møbler
      const fEl = e.target.closest('[data-furn]'), rEl = e.target.closest('[data-room]');
      if (fEl) { const f = state.furn.find((x) => x.id === fEl.dataset.furn); drag.furn = f; drag.el = fEl; drag.pos = [f.x, f.y]; }
      else if (rEl) drag.pickRoom = rEl.dataset.room;
    } else if (ui.tool === 'draw') {
      // En dør eller et vindu som alt er valgt, kan dras bortover veggen uten å bytte verktøy. Alt annet er en strek.
      const hit = ui.opening ? pick(p, drag.slop * 1.75, false) : null;
      if (hit?.kind === 'opening' && hit.o.id === ui.opening) {
        drag.op = hit.o; drag.host = refHost(floorRooms(), hit.o, ui.room);
        drag.el = svg.querySelector(`[data-op="${hit.o.id}"]`);
      } else { drag.pts = [p]; drag.ink = svg.querySelector('#ink'); }
    } else {
      const hit = pick(p, drag.slop * 1.75, ui.tool === 'move');
      drag.hit = hit;
      if (hit?.kind === 'opening') {
        drag.op = hit.o; drag.host = refHost(floorRooms(), hit.o, ui.room);
        drag.el = svg.querySelector(`[data-op="${hit.o.id}"]`);
      } else if (ui.tool === 'move' && hit && hit.kind !== 'room') drag.shape = { kind: hit.kind, room: hit.room.id, i: hit.i };
      else if (ui.tool === 'move' && hit) drag.group = hit.room.id;
    }
    try { svg.setPointerCapture(e.pointerId); } catch { /* går fint uten */ }
    e.preventDefault();
  });

  // Viser endringen mens man drar. Går den ikke an, blir veggen stående der den sist kunne stå.
  const preview = (plan) => {
    const d = drag;
    if (plan.ok) d.plan = plan; else { d.msg = plan.msg; if (plan.why === 'none') d.plan = null; }
    floorRooms().forEach((r, ri) => {
      const g = d.svg.querySelector(`[data-g="${r.id}"]`), el = d.svg.querySelector(`[data-room="${r.id}"]`);
      if (!g || !el) return;
      if (d.group) g.setAttribute('transform', d.plan?.changed[ri] ? `translate(${d.plan.shift[0]} ${d.plan.shift[1]})` : '');
      else el.setAttribute('points', pts(d.plan ? d.plan.raw[ri] : r.poly));
    });
    d.svg.classList.add(d.group ? 'moving' : 'shaping');
  };

  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.t = performance.now();
    const p = toCm(e, drag.svg);
    if (Math.hypot(p[0] - drag.start[0], p[1] - drag.start[1]) > drag.slop) drag.far = true;
    if (drag.pts) {
      if (Math.hypot(p[0] - drag.last[0], p[1] - drag.last[1]) < drag.slop / 2) return;
      drag.pts.push(p); drag.last = p;
      drag.ink.setAttribute('points', pts(drag.pts.map(([x, y]) => [Math.round(x), Math.round(y)])));
    } else if (!drag.far) return;
    else if (drag.furn) {
      const f = drag.furn;
      drag.pos = [clamp(Math.round((f.x + p[0] - drag.start[0]) / 5) * 5, 0, ui.sheet), clamp(Math.round((f.y + p[1] - drag.start[1]) / 5) * 5, 0, ui.sheet)];
      drag.el.setAttribute('transform', `translate(${drag.pos[0]} ${drag.pos[1]}) rotate(${f.r})`);
    } else if (drag.op && drag.host && drag.el) { // døra eller vinduet glir bortover veggen sin
      const h = drag.host, o = drag.op;
      const s = clamp(Math.round(((p[0] - h.a[0]) * h.u[0] + (p[1] - h.a[1]) * h.u[1]) / 5) * 5, o.w / 2, Math.max(o.w / 2, h.len - o.w / 2));
      drag.pos = [Math.round((h.a[0] + h.u[0] * s) * 10) / 10, Math.round((h.a[1] + h.u[1] * s) * 10) / 10];
      drag.el.setAttribute('transform', drag.el.getAttribute('transform').replace(/translate\([^)]*\)/, `translate(${drag.pos[0]} ${drag.pos[1]})`));
      drag.el.classList.add('sliding');
    } else if (drag.shape) preview(planEdit(floorRooms(), { ...drag.shape, dx: p[0] - drag.start[0], dy: p[1] - drag.start[1] }));
    else if (drag.group) preview(planEdit(floorRooms(), { kind: 'move', room: drag.group, dx: p[0] - drag.start[0], dy: p[1] - drag.start[1] }));
  });

  // Deler rommene streken går gjennom. En rett strek deler alle rom den krysser, langs samme linje, så veggen
  // blir sammenhengende. I hvert rom beholder den største delen navn, type og valg på lista.
  const splitWith = (state, raw, tol) => {
    let rooms = floorRooms();
    let line = straightenLine(raw, tol);
    if (!line) { ui.note = 'Dra streken tvers over et rom, fra vegg til vegg.'; return; }
    if (!rooms.length) { // tomt ark: arket blir boligen, og streken deler den
      addPoly(state, sheetOutline(line, ui.sheet));
      ui.info = 'Boligen er satt til størrelsen på arket. Trykk på en vegg for å sette riktig mål, eller trykk «Tegn på nytt» og tegn en runde rundt den.';
      rooms = floorRooms();
    }
    // Legg streken på linje med hjørner som ligger like ved, for eksempel knekken i et vinkelrom.
    const corners = rooms.flatMap((r) => r.poly);
    const near = (v, k2) => { let best = v, dmin = tol * 0.6; for (const q of corners) if (Math.abs(q[k2] - v) < dmin) { dmin = Math.abs(q[k2] - v); best = q[k2]; } return best; };
    line = line.map(([x, y]) => [near(x, 0), near(y, 1)]);
    let cuts = [];
    if (line.length === 2) cuts = splitAlong(rooms, line).map((f) => ({ room: rooms.find((r) => r.id === f.id), parts: f.parts, inside: f.inside }));
    else { // knekt strek: deler bare rommet det meste av streken ligger i
      let room = null, most = 0;
      for (const r of rooms) { const c = raw.filter((q) => pointInPoly(q, r.poly)).length; if (c > most) { most = c; room = r; } }
      const parts = room && splitPoly(room.poly, line);
      if (parts) cuts = [{ room, parts: parts.map(canonical), inside: 1 }];
    }
    if (!cuts.length) { ui.note = 'Streken delte ikke noe rom. Dra den tvers over, fra vegg til vegg.'; return; }
    delete state.auto; // man har begynt å tegne videre på rommene appen laget
    let chosen = null, most = -1;
    for (const c of cuts) {
      const [A, B] = c.parts, big = area(A) >= area(B) ? A : B, small = big === A ? B : A;
      const id = 'r' + (state.seq = (state.seq || 100) + 1);
      c.room.poly = big; c.room.fixed = [];
      const piece = refit({ id, type: c.room.type, size: 'M', m2: null, wall: null, floor: c.room.floor || 0, poly: small, doors: [], fixed: [], guess: true });
      piece.type = guessType(state.rooms, piece.m2);
      for (const f of state.furn) if (f.room === c.room.id && pointInPoly([f.x, f.y], small)) f.room = id;
      state.rooms = [...state.rooms, piece];
      if (c.inside > most) { most = c.inside; chosen = id; }
    }
    settle(state, ui);
    select(chosen);
  };

  // En runde blir et nytt rom. Den første runden er omrisset av boligen og erstatter rommene fra «Velg bolig».
  const addRoom = (state, raw, tol) => {
    let poly = straighten(raw, tol);
    if (!poly) { ui.note = 'Det ble for lite til å være et rom. Tegn en større runde, minst én meter hver vei.'; return; }
    let others = state.drawn ? floorRooms().map((r) => r.poly) : [];
    const overlaps = (polys) => coverage([...polys, poly]).overlap - coverage(polys).overlap > area(poly) * 0.3;
    if (overlaps(others) && state.auto) { clearFloor(state, ui.floor); others = state.drawn ? floorRooms().map((r) => r.poly) : []; } // rommene appen laget selv, byttes ut med omrisset
    poly = canonical(fitSheet(alignTo(poly, others, tol), ui.sheet));
    if (overlaps(others)) {
      ui.note = 'Det ligger et rom der fra før. Dra en rett strek tvers over et rom for å dele det, eller trykk «Tegn på nytt».'; return;
    }
    addPoly(state, poly);
  };
  const addPoly = (state, poly) => {
    const id = 'r' + (state.seq = (state.seq || 100) + 1);
    const base = state.drawn ? state.rooms : [];
    if (!state.drawn) { state.items = {}; state.custom = []; state.furn = []; state.openings = []; state.home = ''; state.drawn = true; }
    const room = refit({ id, type: 'stue', size: 'M', m2: null, wall: null, floor: ui.floor, poly, doors: [], fixed: [], guess: true });
    room.type = guessType(base, room.m2);
    state.rooms = [...base, room];
    settle(state, ui);
    select(id);
  };

  const addOpening = (state, d, kind) => {
    const rooms = floorRooms(), { best } = nearWall(d.start, rooms);
    if (!best || best.n.d > Math.max(45, d.slop * 3)) { ui.note = rooms.length ? 'Trykk nærmere en vegg.' : 'Tegn boligen først.'; return; }
    const pos = placeOn(best.r.poly, best.n.i, Math.round((best.n.t * best.n.len) / 5) * 5, kind === 'door' ? 80 : 120);
    if (!pos) { ui.note = 'Veggen er for kort.'; return; }
    const id = 'o' + (state.seq = (state.seq || 100) + 1);
    state.openings = [...(state.openings || []), { id, floor: ui.floor, kind, ...pos }];
    settle(state, ui);
    select(best.r.id, null, id);
  };

  // Et trykk uten å dra: velg det som ligger under fingeren. Med «Dør» eller «Vindu» settes det inn en ny.
  const tap = (state, d) => {
    const hit = d.hit !== undefined ? d.hit : pick(d.start, d.slop * 1.75, false);
    if (hit?.kind === 'opening') select(refHost(floorRooms(), hit.o, ui.room)?.id ?? null, null, hit.o.id);
    else if (d.tool === 'door' || d.tool === 'window') addOpening(state, d, d.tool);
    else if (!hit) select();
    else select(hit.room.id, hit.kind === 'wall' ? hit.i : null);
  };

  const finish = (cancelled) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    const state = ctx.state();
    ui.note = ''; ui.info = '';
    if (cancelled) { ctx.render(); return; }

    if (ui.furnish) {
      if (d.furn) { if (d.far) { d.furn.x = d.pos[0]; d.furn.y = d.pos[1]; } ui.furn = d.furn.id; ui.room = null; }
      else { ui.room = d.pickRoom || null; ui.furn = null; }
    } else if (d.pts && d.far) {
      const tol = clamp(14 * (d.slop / 8), 25, 90); // en finger treffer omtrent innenfor 14 piksler
      if (isLine(d.pts, tol)) splitWith(state, d.pts, tol); else addRoom(state, d.pts, tol);
    } else if (d.op && d.far) {
      if (d.pos) { d.op.x = d.pos[0]; d.op.y = d.pos[1]; settle(state, ui); }
      select(d.host?.id ?? ui.room, null, d.op.id);
    } else if (d.far && (d.shape || d.group)) {
      const room = state.rooms.find((r) => r.id === (d.shape?.room || d.group)), n = room?.poly.length;
      if (d.plan) { applyPlan(state, ui.floor, d.plan, keepInside); settle(state, ui); } else ui.note = d.msg || '';
      select(room?.id ?? null, d.shape?.kind === 'wall' && room?.poly.length === n ? d.shape.i : null);
    } else if (!d.far) tap(state, d);
    else if (d.tool !== 'draw') { select(); ui.note = `Nå er «${TOOLS.find((t) => t[0] === d.tool)?.[1]}» valgt. Trykk «Tegn og del» over tegningen for å tegne.`; }
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
  const selOp = () => (ctx.state().openings || []).find((o) => o.id === ui.opening);
  // Setter lengden på en vegg. Naborommene følger med, og veggen regnes som «satt».
  const setLen = (r, i, len) => {
    const s = ctx.state(), floor = r.floor || 0, n = r.poly.length;
    ui.note = '';
    const plan = planLength(onFloor(s, floor), r.id, i, len);
    if (!plan.ok) { ui.note = plan.msg; return; }
    if (!plan.same) { applyPlan(s, floor, plan, keepInside); settle(s, ui); }
    if (r.poly.length === n) r.fixed = [...new Set([...(r.fixed || []), i])];
  };
  // Flytter eller endrer en dør eller et vindu langs veggen. s = midten, målt fra veggens første hjørne.
  const setOp = (o, s, w) => {
    const st = ctx.state(), rooms = onFloor(st, o.floor), h = refHost(rooms, o, ui.room);
    if (!h) return;
    const pos = placeOn(rooms[h.ri].poly, h.e, s(h), clamp(Math.round(w), 40, 300));
    if (pos) { Object.assign(o, pos); settle(st, ui); }
  };
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
      // Begynn på nytt på denne etasjen. «Angre» henter tegningen tilbake.
      redraw() { clearFloor(ctx.state(), ui.floor); ui.room = null; ui.wall = null; ui.opening = null; ui.furn = null; ui.tool = 'draw'; ui.note = ''; ctx.commit(); },
      sheet(v) { if (SHEETS.includes(Number(v))) { ui.sheet = Number(v); ctx.later(); } },
      floor(v) { ui.floor = clamp(Number(v) || 0, 0, ctx.state().floors.length - 1); ui.room = null; ui.wall = null; ui.opening = null; ui.furn = null; ctx.later(); },
      addfloor() { const s = ctx.state(); if (s.floors.length < 5) { s.floors = [...s.floors, `${s.floors.length + 1}. etasje`]; ui.floor = s.floors.length - 1; ui.room = null; ui.furn = null; ctx.commit(); } },
      delfloor() {
        const s = ctx.state();
        if (s.floors.length < 2 || s.rooms.some((r) => (r.floor || 0) === ui.floor && r.poly)) return;
        s.floors = s.floors.filter((_, i) => i !== ui.floor).map((_, i) => `${i + 1}. etasje`);
        for (const r of s.rooms) if ((r.floor || 0) > ui.floor) r.floor -= 1;
        ui.floor = Math.max(0, ui.floor - 1); ctx.commit();
      },
      rtype(v) { const r = sel(); if (r && ROOMS[v]) { r.type = v; delete r.guess; if (r.poly) refit(r); else r.size = sizeFromM2(v, r.m2 || ROOMS[v].m2[r.size]); ctx.commit(); } },
      wallnudge(v) { const r = sel(); if (r?.poly && Number.isInteger(ui.wall) && ui.wall < r.poly.length) { setLen(r, ui.wall, Math.round(edges(r.poly)[ui.wall].len) + (Number(v) || 0)); ctx.commit(); } },
      // Setter en dør eller et vindu midt på den valgte veggen. Etterpå kan den dras eller få mål.
      addop(v) {
        const s = ctx.state(), r = sel(), kind = v === 'window' ? 'window' : 'door';
        if (!r?.poly || !Number.isInteger(ui.wall)) return;
        const pos = placeOn(r.poly, ui.wall, edges(r.poly)[ui.wall].len / 2, kind === 'door' ? 80 : 120);
        ui.note = '';
        if (!pos) { ui.note = 'Veggen er for kort.'; ctx.later(); return; }
        const id = 'o' + (s.seq = (s.seq || 100) + 1);
        s.openings = [...(s.openings || []), { id, floor: r.floor || 0, kind, ...pos }];
        settle(s, ui);
        ui.opening = id; ui.wall = null;
        ctx.commit();
      },
      opkind(v) { const o = selOp(); if (o && KIND[v]) { o.kind = v; settle(ctx.state(), ui); ctx.commit(); } },
      opwset(v) { const o = selOp(); if (o && Number(v)) { setOp(o, (h) => h.s - o.w / 2 + Number(v) / 2, Number(v)); ctx.commit(); } },
      delop() { const s = ctx.state(); s.openings = (s.openings || []).filter((o) => o.id !== ui.opening); ui.opening = null; settle(s, ui); ctx.commit(); },
      // Setter ut alt på lista som mangler på tegningen, rom for rom. Det som alt står der, blir stående.
      arrange() {
        const s = ctx.state();
        let added = 0;
        const missed = [];
        for (const r of s.rooms.filter((x) => x.poly)) {
          const existing = s.furn.filter((f) => f.room === r.id);
          const wants = placeable(s, r).map((x) => { const fp = footprint(x.id, x.size); return { item: x.id, w: fp[0], d: fp[1], qty: Math.max(0, x.qty - x.count), s: x.size, corner: shapeOf(x.id, x.size) === 'L', u: shapeOf(x.id, x.size) === 'U' }; });
          if (!wants.some((w) => w.qty > 0)) continue;
          const res = arrangeRoom({ poly: r.poly, doors: r.doors || [] }, wants, existing); // en dør i en delt vegg står i begge rommene
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
      // Veggen du setter mål på, regnes som «satt». Naboveggen flyttes i den enden som ikke rokker ved et mål du alt har satt.
      edgelen(el) {
        const r = sel(), len = num(el.value), i = Number(el.dataset.v);
        if (!r?.poly || !(i >= 0 && i < r.poly.length)) return;
        if (!len) { r.fixed = (r.fixed || []).filter((k) => k !== i); return; }
        setLen(r, i, len);
      },
      walllen(el) { const r = sel(), len = num(el.value); if (r?.poly && len && Number.isInteger(ui.wall) && ui.wall < r.poly.length) setLen(r, ui.wall, len); },
      // Bredden endres fra hjørnet og utover, så avstanden fra hjørnet står fast.
      opw(el) { const o = selOp(), w = num(el.value); if (o && w) setOp(o, (h) => h.s - o.w / 2 + clamp(w, 40, 300) / 2, w); },
      opd(el) { const o = selOp(), t = String(el.value).replace(/[^\d]/g, ''); if (o && t) setOp(o, () => Number(t) + o.w / 2, o.w); },
      furnw(el) { const f = selFurn(), n = num(el.value); if (f && n) resize(f, { w: clamp(n, 20, 600) }); },
      furnd(el) { const f = selFurn(), n = num(el.value); if (f && n) resize(f, { d: clamp(n, 20, 600) }); },
    },
  };
}
