// Ren logikk uten DOM, slik at den kan testes i Node.
import { AREAS, STYLES, QUESTIONS, ITEMS, ROOMS, HOMES, LIFE, ITEM_WORDS, WISH_WORDS, LEVELS } from './data.js';

const FINN = 'https://www.finn.no/recommerce/forsale/search';
const FINN_FURNITURE = '0.78'; // Møbler og interiør

export function newState() {
  return {
    v: 1, step: 0, area: '', home: 'toroms', style: null, level: 'vanlig', total: null,
    rooms: roomsFromHome('toroms'), life: [], lifeText: '', autoWish: {}, items: {}, seq: 100,
  };
}

export function roomsFromHome(homeId) {
  const home = HOMES.find((h) => h.id === homeId) || HOMES[2];
  return home.rooms.map(([type, size], i) => ({ id: 'r' + (i + 1), type, size, m2: null, wall: null }));
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
      out.push({
        key, itemId, room, item, v: variant(item, room.size),
        st: saved.st || dflt, saved,
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
  return m === undefined ? defaultMax(inst, state) : m;
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

// Alt vi vet om hva brukeren vil ha for én ting.
export function wishOf(inst, state) {
  const auto = state.autoWish[inst.itemId] || '';
  const own = inst.saved.wish || '';
  const w = parseWish([auto, own].filter(Boolean).join(', '));
  let replace = null;
  for (const [qid, idx] of Object.entries(inst.saved.picks || {})) {
    const opt = QUESTIONS[qid]?.options[idx];
    if (!opt) continue;
    if (opt.replace) replace = opt.replace;
    if (opt.q && !w.search.includes(opt.q)) w.search.push(opt.q);
    if (opt.note && !w.notes.includes(opt.note)) w.notes.push(opt.note);
    if (opt.avoid && !w.avoid.includes(opt.avoid)) w.avoid.push(opt.avoid);
  }
  for (const k of inst.saved.kw || []) if (!w.search.includes(k)) w.search.push(k);
  w.search = w.search.filter((s) => !w.avoid.includes(s));
  return { ...w, replace };
}

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
  if (state.area) p.set('location', state.area);
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

// Hvor bred tingen kan være når brukeren har målt veggen.
export function wallNote(inst) {
  if (!inst.room.wall || !['sofa', 'sovesofa', 'tvbenk', 'garderobe', 'skrivebord'].includes(inst.itemId)) return '';
  const max = inst.room.wall - (inst.item.wall || 20);
  return max > 40 ? `Maks ca. ${max} cm bred, siden veggen er ${inst.room.wall} cm.` : '';
}

export function tipsFor(inst, state) {
  return state.life.map((id) => LIFE.find((l) => l.id === id)?.tips[inst.itemId]).filter(Boolean);
}

export function styleWords(inst, state) {
  const style = STYLES.find((s) => s.id === state.style);
  return style ? style.kw[inst.item.kind] || [] : [];
}

// ---------- Budsjett ----------

export function summary(state) {
  const all = instances(state);
  const need = all.filter((i) => i.st === 'need');
  const bought = all.filter((i) => i.st === 'bought');
  const sum = (arr, f) => arr.reduce((a, i) => a + (f(i) || 0), 0);
  const level = (f) => sum(need, (i) => round50(i.v.u * f));
  const paid = sum(bought, (i) => i.saved.paid);
  const maxSum = sum(need, (i) => maxOf(i, state));
  const noLimit = need.filter((i) => maxOf(i, state) === null).length;
  const left = state.total ? state.total - paid : null;
  return {
    need: need.length, have: all.filter((i) => i.st === 'have').length, bought: bought.length,
    low: level(LEVELS[0].f), mid: level(LEVELS[1].f), high: level(LEVELS[2].f),
    newSum: sum(need, (i) => i.v.n), maxSum, noLimit, paid, left,
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
  const out = { ...newState(), step: [0, 1, 2, 3].includes(s.step) ? s.step : 0, area: s.area };
  out.home = HOMES.some((h) => h.id === s.home) ? s.home : out.home;
  out.style = STYLES.some((x) => x.id === s.style) ? s.style : null;
  out.level = LEVELS.some((x) => x.id === s.level) ? s.level : 'vanlig';
  out.total = n(s.total, 1e7);
  out.seq = n(s.seq, 1e6) || 100;
  out.rooms = s.rooms.filter((r) => /^r\d{1,6}$/.test(r.id)).slice(0, 30)
    .map((r) => ({ id: r.id, type: r.type, size: r.size, m2: n(r.m2, 200), wall: n(r.wall, 2000) }));
  out.life = s.life.filter((id) => LIFE.some((l) => l.id === id));
  out.lifeText = typeof s.lifeText === 'string' ? s.lifeText.slice(0, 2000) : '';
  out.autoWish = {};
  for (const [k, v] of Object.entries(s.autoWish || {})) if (ITEMS[k] && typeof v === 'string') out.autoWish[k] = v.slice(0, 500);
  out.items = {};
  for (const [k, v] of Object.entries(s.items)) {
    const [rid, itemId] = k.split(':');
    if (!v || typeof v !== 'object' || !ITEMS[itemId] || !out.rooms.some((r) => r.id === rid)) continue;
    const it = {};
    if (['need', 'have', 'bought', 'off'].includes(v.st)) it.st = v.st;
    if (v.max === null) it.max = null; else if (n(v.max, 1e6)) it.max = n(v.max, 1e6);
    if (typeof v.wish === 'string') it.wish = v.wish.slice(0, 300);
    if (n(v.paid, 1e6)) it.paid = n(v.paid, 1e6);
    if (typeof v.seen === 'string' && /^\d{4}-\d\d-\d\d$/.test(v.seen)) it.seen = v.seen;
    if (Array.isArray(v.kw)) it.kw = v.kw.filter((x) => typeof x === 'string' && /^[a-zæøåé]{2,20}$/.test(x)).slice(0, 6);
    if (v.picks && typeof v.picks === 'object') {
      it.picks = {};
      for (const [q, i] of Object.entries(v.picks)) if (QUESTIONS[q] && Number.isInteger(i) && QUESTIONS[q].options[i]) it.picks[q] = i;
    }
    out.items[k] = it;
  }
  return out;
}

export function validState(s) {
  return !!s && s.v === 1 && Array.isArray(s.rooms) && s.rooms.every((r) => ROOMS[r.type] && 'SML'.includes(r.size))
    && typeof s.items === 'object' && Array.isArray(s.life)
    && (s.area === '' || AREAS.some((a) => a.id === s.area));
}

export const kr = (n) => `${Math.round(n).toLocaleString('nb-NO').replace(/ | /g, ' ')} kr`;
