// Ren logikk uten DOM, slik at den kan testes i Node.
import { AREAS, STYLES, QUESTIONS, ITEMS, ROOMS, HOMES, LIFE, ITEM_WORDS, WISH_WORDS, LEVELS, FOOT, PRIOS, COMFORT, CORNER } from './data.js';
import { wallFor, letter } from './plan.js';
import { areaParams, cleanNear } from './areastate.js';

const FINN = 'https://www.finn.no/recommerce/forsale/search';
const FINN_FURNITURE = '0.78'; // Møbler og interiør

export function newState() {
  return {
    v: 1, step: 0, area: '', home: 'toroms', style: null, sub: null, prio: null, level: 'vanlig', total: null,
    rooms: roomsFromHome('toroms'), drawn: false, floors: ['1. etasje'], furn: [], life: [], lifeText: '', autoWish: {}, items: {}, custom: [], seq: 100,
  };
}

export function roomsFromHome(homeId) {
  const home = HOMES.find((h) => h.id === homeId) || HOMES[2];
  return home.rooms.map(([type, size], i) => ({ id: 'r' + (i + 1), type, size, m2: null, wall: null }));
}

// Fjerner lagrede valg for rom som er borte eller har byttet type.
export function pruneItems(items, oldRooms, newRooms) {
  const out = {};
  for (const [key, v] of Object.entries(items)) {
    const rid = key.split(':')[0];
    const a = oldRooms.find((r) => r.id === rid), b = newRooms.find((r) => r.id === rid);
    if (a && b && a.type === b.type) out[key] = v;
  }
  return out;
}

export function roomLabel(rooms, room) {
  const same = rooms.filter((r) => r.type === room.type);
  const name = ROOMS[room.type].name;
  return same.length > 1 ? `${name} ${same.indexOf(room) + 1}` : name;
}

export function roomM2(room) {
  return room.m2 || ROOMS[room.type].m2[room.size];
}

export function sizeFromM2(type, m2) {
  const [a, b] = ROOMS[type].lim;
  return m2 < a ? 'S' : m2 < b ? 'M' : 'L';
}

export function sizeRange(type, size) {
  const [a, b] = ROOMS[type].lim;
  const r = (n) => String(Math.round(n));
  return size === 'S' ? `under ${r(a)} m²` : size === 'M' ? `${r(a)}–${r(b)} m²` : `over ${r(b)} m²`;
}

function variant(def, size) {
  return def.size ? def.size[size] : { label: '', q: def.q, u: def.u, n: def.n };
}

// Ting hverdagen din legger til, som nøkler «rom:ting».
function lifeAdds(state) {
  const keys = new Set();
  for (const id of state.life) {
    const life = LIFE.find((l) => l.id === id);
    if (!life) continue;
    for (const [types, itemId] of life.add) {
      for (const type of types) {
        const room = state.rooms.find((r) => r.type === type);
        if (room) { keys.add(`${room.id}:${itemId}`); break; }
      }
    }
  }
  return keys;
}

// Alle ting i alle rom, med status: need (trenger), have (har), bought (kjøpt), off (ikke med).
export function instances(state) {
  const adds = lifeAdds(state);
  const out = [];
  for (const room of state.rooms) {
    const def = ROOMS[room.type];
    const ids = [...def.ess, ...def.extra];
    for (const key of adds) {
      const [rid, itemId] = key.split(':');
      if (rid === room.id && !ids.includes(itemId)) ids.push(itemId);
    }
    for (const itemId of ids) {
      const key = `${room.id}:${itemId}`;
      const item = ITEMS[itemId];
      const saved = state.items[key] || {};
      const dflt = def.ess.includes(itemId) || adds.has(key) ? 'need' : 'off';
      const size = 'SML'.includes(saved.size || '?') ? saved.size : room.size; // egen størrelse går foran rommets
      const dq = typeof item.qty === 'object' ? item.qty[size] : item.qty || 1;
      out.push({
        key, itemId, room, item, size, v: variant(item, size), qty: saved.qty || dq,
        st: saved.st || dflt, saved,
      });
    }
    // Egne ting brukeren har skrevet inn. Ingen prisanslag, så de holdes utenfor summene.
    for (const c of state.custom || []) {
      if (c.room !== room.id) continue;
      const key = `${room.id}:${c.id}`;
      const saved = state.items[key] || {};
      out.push({
        key, itemId: c.id, room, item: { name: c.name, kind: 'deco', cat: false, custom: true },
        size: room.size, qty: saved.qty || 1,
        v: { label: '', q: c.name.toLowerCase(), u: 0, n: 0 }, st: saved.st || 'need', saved,
      });
    }
  }
  return out;
}

const round50 = (n) => Math.max(50, Math.round(n / 50) * 50);

export function defaultMax(inst, state) {
  const level = LEVELS.find((l) => l.id === state.level) || LEVELS[1];
  return round50(inst.v.u * level.f);
}

// undefined = bruk anslaget, null = ingen prisgrense
export function maxOf(inst, state) {
  const m = inst.saved.max;
  if (m === undefined) return inst.item.custom ? null : defaultMax(inst, state);
  return m;
}

// ---------- Fritekst ----------

const NEG = /\b(ikke|uten|ingen|aldri|unngå|slippe|slipper)\b/g;
const BREAK = /[,;:]|\bmen\b|\bheller\b|\bvil ha\b|\bønsker\b|\bgjerne\b/;

function negated(text, index) {
  const before = text.slice(Math.max(0, index - 28), index);
  let last = -1;
  for (const m of before.matchAll(NEG)) last = m.index + m[0].length;
  if (last < 0) return false;
  return !BREAK.test(before.slice(last));
}

// «ikke rundt, gjerne eik, maks 180 cm» -> { search: ['eik'], avoid: ['rundt'], notes: ['maks 180 cm'] }
export function parseWish(raw) {
  const text = ' ' + String(raw || '').toLowerCase() + ' ';
  const search = [], avoid = [], notes = [];
  const push = (arr, v) => { if (v && !arr.includes(v)) arr.push(v); };
  for (const w of WISH_WORDS) {
    const m = w.rx.exec(text);
    if (!m) continue;
    if (negated(text, m.index)) push(avoid, w.label);
    else if (w.q) push(search, w.q);
    else push(notes, w.label);
  }
  for (const m of text.matchAll(/(maks(?:imalt)?|max|under|inntil|ikke over|minst|over)?\s*(\d{2,3})\s*cm/g)) {
    const pre = m[1] || '';
    const word = /minst|^over/.test(pre) ? 'minst' : pre ? 'maks' : 'ca.';
    push(notes, `${word} ${m[2]} cm`);
  }
  for (const m of text.matchAll(/(\d{1,2})\s*(personer|pers\b|mennesker)/g)) push(notes, `plass til ${m[1]}`);
  return { search, avoid: avoid.filter((a) => !search.includes(a)), notes };
}

function itemInSentence(s) {
  for (const [word, itemId] of ITEM_WORDS) {
    if (new RegExp('(^|[^a-zæøå])' + word).test(s)) return itemId;
  }
  return null;
}

// Leser «fortell om hverdagen»: finner hverdagsvalg og ønsker som hører til bestemte ting.
export function parseLife(raw) {
  const text = String(raw || '').toLowerCase();
  const life = [];
  for (const l of LIFE) {
    const m = l.rx.exec(text);
    if (m && !negated(text, m.index)) life.push(l.id);
  }
  const wishes = {};
  let last = null;
  for (const s of text.split(/[.!?\n]+/).map((x) => x.trim()).filter(Boolean)) {
    const itemId = itemInSentence(s) || last;
    if (!itemId) continue;
    const w = parseWish(s);
    if (w.search.length + w.avoid.length + w.notes.length === 0) { last = itemInSentence(s) || last; continue; }
    wishes[itemId] = wishes[itemId] ? wishes[itemId] + ', ' + s : s;
    last = itemId;
  }
  return { life, wishes };
}

// Rydder et ønske som kommer ferdig oppdelt (fra AI eller en delt lenke).
const word = (s) => (typeof s === 'string' ? s.toLowerCase().trim() : '');

export function cleanWish(w) {
  if (!w || typeof w !== 'object') return null;
  const list = (v, rx, max) => (Array.isArray(v) ? v : []).map(word).filter((s) => rx.test(s)).slice(0, max);
  const out = {
    search: list(w.search, /^[a-zæøåé0-9-]{2,25}( [a-zæøåé0-9-]{1,15})?$/, 3),
    avoid: list(w.avoid, /^.{2,40}$/, 5),
    notes: list(w.notes, /^.{2,60}$/, 5),
  };
  return out.search.length + out.avoid.length + out.notes.length ? out : null;
}

// Finner ting brukeren sier de har fra før, og ting de sier de mangler: «Jeg har seng og sofa. Trenger en lenestol.»
export function parseOwned(raw) {
  const have = new Set(), need = new Set();
  for (const sentence of String(raw || '').toLowerCase().split(/[.!?\n]+/)) {
    let rest = sentence;
    const found = [];
    for (const [word, itemId] of ITEM_WORDS) { // lengste ord først, og hvert ord brukes bare én gang
      const rx = new RegExp('(^|[^a-zæøå])' + word + '[a-zæøå]*');
      if (rx.test(rest)) { found.push(itemId); rest = rest.replace(rx, ' '); }
    }
    if (!found.length || /\b(ikke|ingen|uten|aldri)\b/.test(sentence)) continue;
    if (/\b(trenger|mangler|ønsker meg|vil ha|skal ha|må ha)\b/.test(sentence)) found.forEach((id) => need.add(id));
    else if (/\b(har|eier|fått|arvet|beholder)\b/.test(sentence)) found.forEach((id) => have.add(id));
  }
  return { have: [...have].filter((id) => !need.has(id)), need: [...need] };
}

// Alt vi vet om hva brukeren vil ha for én ting.
// autoWish er enten en setning (tolket av ordlistene) eller et ferdig oppdelt ønske (tolket av AI).
export function wishOf(inst, state) {
  const auto = state.autoWish[inst.itemId] || '';
  const own = inst.saved.wish || '';
  const w = parseWish([typeof auto === 'string' ? auto : '', own].filter(Boolean).join(', '));
  if (auto && typeof auto === 'object') {
    for (const k of ['search', 'avoid', 'notes']) for (const x of auto[k] || []) if (!w[k].includes(x)) w[k].push(x);
  }
  let replace = null;
  for (const [qid, idx] of Object.entries(inst.saved.picks || {})) {
    const opt = QUESTIONS[qid]?.options[idx];
    if (!opt) continue;
    if (opt.replace) replace = opt.replace;
    if (opt.q && !w.search.includes(opt.q)) w.search.push(opt.q);
    if (opt.note && !w.notes.includes(opt.note)) w.notes.push(opt.note);
    if (opt.avoid && !w.avoid.includes(opt.avoid)) w.avoid.push(opt.avoid);
  }
  // Er stil viktigst, er første stilord med i søket til brukeren selv velger noe annet.
  const kw = inst.saved.kw ?? (prioOf(inst, state) === 'stil' ? styleWords(inst, state).slice(0, 1) : []);
  for (const k of kw) if (!w.search.includes(k)) w.search.push(k);
  if (inst.saved.maxw) w.notes.push(`maks ${inst.saved.maxw} cm bred`);
  w.search = w.search.filter((s) => !w.avoid.includes(s));
  return { ...w, replace };
}

export const prioOf = (inst, state) => inst.saved.prio || state.prio || null;
export const kwOf = (inst, state) => inst.saved.kw ?? (prioOf(inst, state) === 'stil' ? styleWords(inst, state).slice(0, 1) : []);
export const comfortFor = (inst, state) => (prioOf(inst, state) === 'komfort' ? COMFORT[inst.itemId] || null : null);

export function searchText(inst, state) {
  const w = wishOf(inst, state);
  const base = w.replace || inst.v.q;
  const extra = w.search.filter((s) => !base.split(' ').includes(s));
  return [base, ...extra].join(' ');
}

// mode: 'all' = alt til salgs under makspris, 'today' = lagt ut i dag, 'free' = gis bort
export function finnUrl(inst, state, mode = 'all') {
  const p = new URLSearchParams();
  p.set('q', searchText(inst, state));
  if (inst.item.cat !== false) p.set('category', FINN_FURNITURE);
  for (const [k, v] of areaParams(state)) p.append(k, v);
  if (mode === 'free') p.set('trade_type', '2');
  else {
    const max = maxOf(inst, state);
    if (max) p.set('price_to', String(max));
  }
  if (mode === 'today') p.set('published', '1');
  p.set('sort', 'PUBLISHED_DESC');
  return `${FINN}?${p.toString()}`;
}

export function ikeaUrl(inst, state) {
  const w = wishOf(inst, state);
  const q = (w.replace || inst.v.q).replace(/\d+x\d+|\b\d{3}\b/g, '').trim();
  return 'https://www.ikea.com/no/no/search/?q=' + encodeURIComponent(q);
}

// Pynt og veggpynt i valgt stil, som ferdige Finn-søk.
export function decorLinks(state, mode = 'all') {
  const style = STYLES.find((s) => s.id === state.style) || STYLES[STYLES.length - 1];
  return style.decor.map(([label, q]) => {
    const p = new URLSearchParams({ q });
    for (const [k, v] of areaParams(state)) p.append(k, v);
    if (mode === 'today') p.set('published', '1');
    p.set('sort', 'PUBLISHED_DESC');
    return { label, q, url: `${FINN}?${p.toString()}` };
  });
}

// Hvor bred tingen kan være. Best når møbelet er satt ut på tegningen, ellers ut fra veggmålet til rommet.
const WALL_ITEMS = ['sofa', 'sovesofa', 'tvbenk', 'garderobe', 'skrivebord', 'bokhylle', 'kommode', 'seng'];
export function wallNote(inst, state) {
  if (!WALL_ITEMS.includes(inst.itemId)) return '';
  const pw = state ? placedWall(state, inst.room.id, inst.itemId) : null;
  if (pw) {
    const max = pw.free - (inst.item.wall ?? 20);
    const doors = pw.free < pw.len ? `, der ${pw.free} cm er fri for dører` : '';
    return max > 40 ? `På tegningen står den mot vegg ${pw.letter}, som er ${pw.len} cm${doors}. Maks ca. ${max} cm bred.` : '';
  }
  if (!inst.room.wall || ['bokhylle', 'kommode', 'seng'].includes(inst.itemId)) return '';
  const max = inst.room.wall - (inst.item.wall || 20);
  return max > 40 ? `Maks ca. ${max} cm bred, siden veggen er ${inst.room.wall} cm.` : '';
}

export function tipsFor(inst, state) {
  return state.life.map((id) => LIFE.find((l) => l.id === id)?.tips[inst.itemId]).filter(Boolean);
}

export function styleWords(inst, state) {
  const style = STYLES.find((s) => s.id === state.style);
  if (!style) return [];
  const sub = Number.isInteger(state.sub) ? style.photos[state.sub] : null; // valgt retning innenfor stilen
  const own = (sub && sub[inst.item.kind]) || [];
  return [...new Set([...own, ...(style.kw[inst.item.kind] || [])])].slice(0, 4);
}

// ---------- Budsjett ----------

export function summary(state) {
  const all = instances(state);
  const need = all.filter((i) => i.st === 'need');
  const bought = all.filter((i) => i.st === 'bought');
  const sum = (arr, f) => arr.reduce((a, i) => a + (f(i) || 0), 0);
  const level = (f) => sum(need, (i) => (i.item.custom ? 0 : round50(i.v.u * f) * i.qty));
  const paid = sum(bought, (i) => i.saved.paid);
  const maxSum = sum(need, (i) => (maxOf(i, state) || 0) * i.qty);
  const noLimit = need.filter((i) => maxOf(i, state) === null).length;
  const left = state.total ? state.total - paid : null;
  return {
    need: need.length, have: all.filter((i) => i.st === 'have').length, bought: bought.length,
    low: level(LEVELS[0].f), mid: level(LEVELS[1].f), high: level(LEVELS[2].f),
    newSum: sum(need, (i) => i.v.n * i.qty), maxSum, noLimit, paid, left,
    over: left !== null ? Math.max(0, maxSum - left) : 0,
  };
}

// Skalerer makspriser så summen passer det som er igjen av budsjettet.
export function fitBudget(state) {
  const s = summary(state);
  if (s.left === null || s.maxSum === 0) return state.items;
  const f = Math.max(0, s.left) / s.maxSum;
  const items = { ...state.items };
  for (const i of instances(state).filter((x) => x.st === 'need')) {
    const max = maxOf(i, state);
    if (max === null) continue;
    items[i.key] = { ...items[i.key], max: Math.max(50, Math.floor((max * f) / 50) * 50) };
  }
  return items;
}

// 'finish' = lista er nesten ferdig og en ny er innenfor rekkevidde. 'fits' = maksprisen dekker en ny.
export function newHint(inst, state, sum) {
  if (inst.item.custom) return '';
  const max = maxOf(inst, state);
  const fits = max === null || max >= inst.v.n;
  const afford = sum.left === null ? fits : sum.left >= sum.newSum;
  if (sum.need <= 3 && afford) return 'finish';
  return fits ? 'fits' : '';
}

// ---------- Plantegning ----------

// Legger rommene i rader. Returnerer posisjoner i prosent.
export function layoutPlan(rooms) {
  const list = rooms.map((r) => ({ id: r.id, a: roomM2(r) })).sort((x, y) => y.a - x.a);
  const total = list.reduce((s, r) => s + r.a, 0) || 1;
  const nRows = list.length <= 2 ? 1 : list.length <= 5 ? 2 : 3;
  const rows = [];
  let row = [], acc = 0;
  list.forEach((r, i) => {
    row.push(r); acc += r.a;
    const roomsLeft = list.length - i - 1, rowsLeft = nRows - rows.length - 1;
    if (rowsLeft > 0 && (acc >= total / nRows || roomsLeft <= rowsLeft)) { rows.push(row); row = []; acc = 0; }
  });
  if (row.length) rows.push(row);
  const out = [];
  let y = 0;
  for (const r of rows) {
    const area = r.reduce((s, x) => s + x.a, 0);
    const h = (area / total) * 100;
    let x = 0;
    for (const room of r) {
      const w = (room.a / area) * 100;
      out.push({ id: room.id, x, y, w, h });
      x += w;
    }
    y += h;
  }
  return out;
}

// ---------- Møbler på plantegningen ----------

export function footprint(itemId, size) {
  const f = FOOT[itemId];
  return !f ? null : Array.isArray(f) ? f : f[size];
}

export const isCorner = (itemId, size) => (CORNER[itemId] || []).includes(size);

// Veggen møbelet til en ting på lista står mot, hvis det er satt ut på tegningen.
export function placedWall(state, roomId, itemId) {
  const room = state.rooms.find((r) => r.id === roomId);
  const f = (state.furn || []).find((x) => x.room === roomId && x.item === itemId);
  if (!room?.poly || !f) return null;
  const w = wallFor(room.poly, room.doors, f);
  return w ? { ...w, letter: letter(w.e) } : null;
}

// Lager en enkel tegning av rommene fra «Velg bolig», lagt inntil hverandre, som et utgangspunkt å flytte på.
export function withDrawing(rooms) {
  const total = rooms.reduce((a, r) => a + roomM2(r), 0) || 1;
  const W = Math.sqrt((total * 4) / 3) * 100, H = (total * 10000) / W;
  const snap = (v) => Math.round(v / 10) * 10;
  const lay = layoutPlan(rooms);
  return rooms.map((r) => {
    const p = lay.find((x) => x.id === r.id);
    const x0 = 50 + snap((p.x / 100) * W), y0 = 50 + snap((p.y / 100) * H), x1 = 50 + snap(((p.x + p.w) / 100) * W), y1 = 50 + snap(((p.y + p.h) / 100) * H);
    const poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const m2 = Math.max(1, Math.round(((x1 - x0) * (y1 - y0)) / 10000));
    return { ...r, poly, doors: [], fixed: [], floor: 0, m2, size: sizeFromM2(r.type, m2), wall: Math.max(x1 - x0, y1 - y0) };
  });
}

export function totalM2(rooms) {
  return Math.round(rooms.reduce((s, r) => s + roomM2(r), 0));
}

// ---------- Deling ----------

export function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeState(str) {
  try {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const state = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return normalize(state);
  } catch { return null; }
}

// Rydder i lagret eller delt tilstand, slik at ingenting uventet havner på siden.
export function normalize(s) {
  if (!validState(s)) return null;
  const n = (v, max) => (typeof v === 'number' && v > 0 && v <= max ? Math.round(v) : null);
  const out = { ...newState(), step: [0, 1, 2, 3, 4].includes(s.step) ? s.step : 0, area: s.area };
  out.home = HOMES.some((h) => h.id === s.home) ? s.home : '';
  out.style = STYLES.some((x) => x.id === s.style) ? s.style : null;
  out.sub = out.style && [0, 1, 2].includes(s.sub) ? s.sub : null;
  out.level = LEVELS.some((x) => x.id === s.level) ? s.level : 'vanlig';
  out.prio = PRIOS.some((x) => x[0] === s.prio) ? s.prio : null;
  out.total = n(s.total, 1e7);
  out.seq = n(s.seq, 1e6) || 100;
  const pt = (q) => Array.isArray(q) && q.length === 2 && q.every((v) => Number.isFinite(v) && v >= -500 && v <= 3000);
  const nFloors = Array.isArray(s.floors) ? Math.min(5, Math.max(1, s.floors.length)) : 1;
  out.floors = Array.from({ length: nFloors }, (_, i) => `${i + 1}. etasje`);
  out.rooms = s.rooms.filter((r) => /^r\d{1,6}$/.test(r.id)).slice(0, 30).map((r) => {
    const room = { id: r.id, type: r.type, size: r.size, m2: n(r.m2, 2000), wall: n(r.wall, 3000) };
    let poly = Array.isArray(r.poly) && r.poly.length >= 3 && r.poly.length <= 40 && r.poly.every(pt) ? r.poly.map(([x, y]) => [Math.round(x), Math.round(y)]) : null;
    const g = r.g; // eldre tegninger var rektangler i halvmeters ruter
    if (!poly && g && [g.x, g.y, g.w, g.h].every(Number.isInteger) && g.w >= 1 && g.h >= 1 && g.x >= 0 && g.y >= 0 && g.x + g.w <= 60 && g.y + g.h <= 60) {
      poly = [[g.x, g.y], [g.x + g.w, g.y], [g.x + g.w, g.y + g.h], [g.x, g.y + g.h]].map(([x, y]) => [x * 50, y * 50]);
    }
    if (!poly) return room;
    const doors = (Array.isArray(r.doors) ? r.doors : [])
      .filter((d) => d && Number.isInteger(d.e) && d.e >= 0 && d.e < poly.length && d.t >= 0 && d.t <= 1 && d.w >= 40 && d.w <= 300)
      .slice(0, 12).map((d) => ({ e: d.e, t: Number(d.t), w: Math.round(d.w), kind: d.kind === 'window' ? 'window' : 'door' }));
    const fixed = (Array.isArray(r.fixed) ? r.fixed : []).filter((i) => Number.isInteger(i) && i >= 0 && i < poly.length);
    return { ...room, poly, doors, fixed: [...new Set(fixed)], floor: Number.isInteger(r.floor) && r.floor >= 0 && r.floor < nFloors ? r.floor : 0 };
  });
  out.drawn = out.rooms.some((r) => r.poly);
  out.furn = (Array.isArray(s.furn) ? s.furn : [])
    .filter((f) => f && /^f\d{1,6}$/.test(f.id) && ITEMS[f.item] && out.rooms.some((r) => r.id === f.room && r.poly)
      && [f.x, f.y].every((v) => Number.isFinite(v) && v >= -500 && v <= 3000) && [f.w, f.d].every((v) => v >= 20 && v <= 600))
    .slice(0, 80).map((f) => ({
      id: f.id, room: f.room, item: f.item, x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), d: Math.round(f.d), r: f.r === 90 ? 90 : 0,
      ...(['S', 'M', 'L'].includes(f.s) ? { s: f.s } : {}),                       // størrelsen møbelet ble tegnet for
      ...(['nw', 'ne', 'sw', 'se'].includes(f.corner) ? { corner: f.corner } : {}), // hjørnesofa: hvilket hjørne som er åpent
    }));
  out.life = s.life.filter((id) => LIFE.some((l) => l.id === id));
  out.lifeText = typeof s.lifeText === 'string' ? s.lifeText.slice(0, 2000) : '';
  out.autoWish = {};
  for (const [k, v] of Object.entries(s.autoWish || {})) {
    if (!ITEMS[k]) continue;
    if (typeof v === 'string') out.autoWish[k] = v.slice(0, 500);
    else if (cleanWish(v)) out.autoWish[k] = cleanWish(v);
  }
  out.custom = (Array.isArray(s.custom) ? s.custom : [])
    .filter((c) => c && /^c\d{1,6}$/.test(c.id) && out.rooms.some((r) => r.id === c.room) && typeof c.name === 'string' && c.name.trim())
    .slice(0, 40).map((c) => ({ id: c.id, room: c.room, name: c.name.trim().slice(0, 60) }));
  out.items = {};
  for (const [k, v] of Object.entries(s.items)) {
    const [rid, itemId] = k.split(':');
    const known = ITEMS[itemId] || out.custom.some((c) => c.id === itemId && c.room === rid);
    if (!v || typeof v !== 'object' || !known || !out.rooms.some((r) => r.id === rid)) continue;
    const it = {};
    if (['need', 'have', 'bought', 'off'].includes(v.st)) it.st = v.st;
    if (v.max === null) it.max = null; else if (n(v.max, 1e6)) it.max = n(v.max, 1e6);
    if (typeof v.wish === 'string') it.wish = v.wish.slice(0, 300);
    if (Number.isInteger(v.qty) && v.qty >= 1 && v.qty <= 12) it.qty = v.qty;
    if (v.size === 'S' || v.size === 'M' || v.size === 'L') it.size = v.size;
    if (PRIOS.some((x) => x[0] === v.prio)) it.prio = v.prio;
    if (n(v.maxw, 600)) it.maxw = n(v.maxw, 600);
    if (n(v.paid, 1e6)) it.paid = n(v.paid, 1e6);
    if (typeof v.seen === 'string' && /^\d{4}-\d\d-\d\d$/.test(v.seen)) it.seen = v.seen;
    if (Array.isArray(v.kw)) it.kw = v.kw.filter((x) => typeof x === 'string' && /^[a-zæøåé]{2,20}$/.test(x)).slice(0, 6);
    if (v.picks && typeof v.picks === 'object') {
      it.picks = {};
      for (const [q, i] of Object.entries(v.picks)) if (QUESTIONS[q] && Number.isInteger(i) && QUESTIONS[q].options[i]) it.picks[q] = i;
    }
    out.items[k] = it;
  }
  out.near = cleanNear(s.near); // område valgt på kartet
  return out;
}

export function validState(s) {
  return !!s && s.v === 1 && Array.isArray(s.rooms) && s.rooms.every((r) => ROOMS[r.type] && 'SML'.includes(r.size))
    && typeof s.items === 'object' && Array.isArray(s.life)
    && (s.area === '' || AREAS.some((a) => a.id === s.area));
}

export const kr = (n) => `${Math.round(n).toLocaleString('nb-NO').replace(/ | /g, ' ')} kr`;
