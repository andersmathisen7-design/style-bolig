// Daglig sjekk på Finn.
// Siden skriver en «profil» (hva brukeren leter etter) til databasen som følger med siden. En planlagt Claude-økt
// leser profilen hver morgen, ser på det som er lagt ut på Finn i dag, og skriver «funn» tilbake. Siden viser funnene.
// Alt som leses fra databasen, regnes som fremmed tekst: formen sjekkes, teksten vaskes, og bare Finn-lenker slipper gjennom.
// Jobben er beskrevet i docs/finn-jobb.md. Endres formatet her, må den fila endres samtidig.
import { AREAS, STYLES } from './data.js';
import { instances, maxOf, wishOf, searchText, finnUrl, altLinks, styleWords, prioOf, roomLabel, kr } from './logic.js';

export const ROOT = 'sjekk';        // sjekk/<bruker-id> = profilen, sjekk/<bruker-id>/funn/siste = funnene
export const FORMAT = 1;
export const MAX_THINGS = 40;
export const MAX_PICKS = 3;
export const MAX_HIDDEN = 300;

// ---------- Rene funksjoner (testet i test/funn.test.mjs) ----------

const clip = (s, n) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const words = (arr, n = 8, len = 60) => (Array.isArray(arr) ? arr.map((x) => clip(x, len)).filter(Boolean).slice(0, n) : []);
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Det jobben trenger å vite om lista. Bare ting brukeren fortsatt leter etter er med.
// opt.area = beskrivelse av området, opt.hidden = annonser brukeren har sagt nei til, opt.now = klokka (for tester).
export function buildProfile(state, opt = {}) {
  const style = STYLES.find((s) => s.id === state.style) || null;
  const sub = style && Number.isInteger(state.sub) ? style.photos[state.sub] : null;
  const things = instances(state).filter((i) => i.st === 'need').slice(0, MAX_THINGS).map((inst) => {
    const w = wishOf(inst, state);
    const max = maxOf(inst, state);
    const t = {
      key: inst.key,
      room: clip(roomLabel(state.rooms, inst.room), 60),
      name: clip(inst.item.name, 80),
      q: clip(searchText(inst, state), 120),
      qty: inst.qty,
      url: finnUrl(inst, state, 'today', { broad: true }), // lagt ut i dag, alle kategorier
      alt: altLinks(inst, state, 'today').slice(0, 3).map((a) => ({ word: clip(a.word, 60), url: a.url })),
    };
    if (inst.v.label) t.variant = clip(inst.v.label, 80);
    if (max) t.max = max;
    if (inst.saved.maxw) t.maxw = inst.saved.maxw;
    for (const k of ['search', 'avoid', 'notes']) { const list = words(w[k], 8, 80); if (list.length) t[k] = list; }
    const sw = words(styleWords(inst, state), 4);
    if (sw.length) t.words = sw;
    const prio = prioOf(inst, state);
    if (prio) t.prio = prio;
    return t;
  });
  const p = {
    v: FORMAT,
    updatedAt: (opt.now || new Date()).toISOString(),
    area: clip(opt.area ?? (AREAS.find((a) => a.id === state.area)?.name || 'Hele Norge'), 80),
    things,
    hidden: cleanHidden(opt.hidden),
  };
  if (style && style.id !== 'fri') p.style = { name: style.name, ...(sub?.name ? { sub: sub.name } : {}) };
  if (state.prio) p.prio = state.prio;
  return p;
}

// Lik profil gir lik tekst, uansett rekkefølgen på feltene og når den ble laget. Brukes til å la være å skrive uten grunn.
export function profileSig(p) {
  const sorted = (x) => (Array.isArray(x) ? x.map(sorted) : isObj(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sorted(x[k])])) : x);
  if (!isObj(p)) return '';
  const { updatedAt, ...rest } = p;
  return JSON.stringify(sorted(rest));
}

// Finn-koden i en annonselenke.
export function adId(url) {
  const m = String(url || '').match(/\/item\/(\d{5,12})(?:[/?#]|$)/) || String(url || '').match(/[?&]finnkode=(\d{5,12})(?:[&#]|$)/);
  return m ? m[1] : '';
}

// Bare vanlige https-lenker til www.finn.no slipper gjennom. Alt annet blir en tom tekst.
export function safeFinnUrl(u) {
  if (typeof u !== 'string' || u.length > 300 || !u.startsWith('https://www.finn.no/')) return '';
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:' || url.hostname !== 'www.finn.no' || url.username || url.password || url.port) return '';
    return url.href;
  } catch { return ''; }
}

export function cleanHidden(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x) => typeof x === 'string' && /^\d{5,12}$/.test(x)))].slice(-MAX_HIDDEN);
}
export const addHidden = (list, id) => cleanHidden([...cleanHidden(list).filter((x) => x !== id), id]);

function cleanPick(raw, runDay) {
  if (!isObj(raw)) return null;
  const url = safeFinnUrl(raw.url);
  const id = adId(url);
  const title = clip(raw.title, 120);
  if (!url || !id || !title) return null;
  const price = typeof raw.price === 'number' && Number.isFinite(raw.price) && raw.price >= 0 && raw.price < 1e7 ? Math.round(raw.price) : null;
  const score = typeof raw.score === 'number' && raw.score >= 0 && raw.score <= 10 ? Math.round(raw.score) : null;
  return { id, url, title, price, place: clip(raw.place, 60), why: clip(raw.why, 160), cat: clip(raw.cat, 40), score, day: isDay(raw.day) && raw.day <= runDay ? raw.day : runDay };
}

// Gjør det som står i databasen om til noe som trygt kan vises, eller null hvis det ikke er funn i riktig format.
// keys = tingene brukeren leter etter nå, hidden = annonser som ikke skal vises igjen.
export function cleanFinds(raw, keys = [], hidden = []) {
  if (!isObj(raw) || raw.v !== FORMAT || !isDay(raw.day)) return null;
  const hide = new Set(cleanHidden(hidden));
  // things er en liste: [{ key, picks: [...] }]. Første rad for hver ting gjelder.
  const src = new Map();
  for (const row of Array.isArray(raw.things) ? raw.things.slice(0, 80) : []) {
    if (isObj(row) && typeof row.key === 'string' && Array.isArray(row.picks) && !src.has(row.key)) src.set(row.key, row.picks);
  }
  const things = {};
  let total = 0, fresh = 0;
  for (const key of keys) {
    if (!src.has(key) || key === '__proto__') continue;
    const seen = new Set();
    const picks = src.get(key).slice(0, 12).map((p) => cleanPick(p, raw.day))
      .filter((p) => p && !hide.has(p.id) && !seen.has(p.id) && seen.add(p.id))
      .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : (b.score ?? 0) - (a.score ?? 0)))
      .slice(0, MAX_PICKS);
    if (!picks.length) continue;
    things[key] = picks;
    total += picks.length;
    fresh += picks.filter((p) => p.day === raw.day).length;
  }
  return {
    day: raw.day,
    time: typeof raw.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time) ? raw.time : '',
    seen: Number.isInteger(raw.seen) && raw.seen >= 0 ? raw.seen : null,
    skipped: (Array.isArray(raw.skipped) ? raw.skipped : []).filter((k) => keys.includes(k)),
    things, total, fresh,
  };
}

// Dagens dato i Norge, som 2026-11-22.
export function osloDay(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const MONTHS = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];
// «i dag», «i går» eller «21. nov.»
export function dayText(day, today) {
  if (!isDay(day)) return '';
  const diff = isDay(today) ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 864e5) : null;
  if (diff === 0) return 'i dag';
  if (diff === 1) return 'i går';
  return `${Number(day.slice(8))}. ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
}

// «Sist sjekket i dag 06:45 – 7 nye funn»
export function summaryText(finds, today) {
  if (!finds) return '';
  const n = finds.fresh;
  return `Sist sjekket ${dayText(finds.day, today)}${finds.time ? ` ${finds.time}` : ''} – ${n === 0 ? 'ingen nye funn' : n === 1 ? '1 nytt funn' : `${n} nye funn`}`;
}

export const priceText = (p) => (p === null ? 'pris ikke oppgitt' : p === 0 ? 'gis bort' : kr(p));

// ---------- Det som vises på «Finn» ----------

// Blokka under en ting: inntil tre funn. picks kommer fra cleanFinds, men teksten vaskes likevel her.
export function findsBlock(key, picks, today) {
  if (!picks || !picks.length) return '';
  return `<div class="funn"><h3>Funn til deg</h3><ul>${picks.map((p) => `
    <li><a href="${esc(safeFinnUrl(p.url))}" target="_blank" rel="noopener">${esc(p.title)}</a>
      <span class="funn-meta">${esc([priceText(p.price), p.place, dayText(p.day, today)].filter(Boolean).join(' · '))}</span>
      ${p.why ? `<span class="funn-why">${esc(p.why)}</span>` : ''}
      <span class="funn-act"><button class="link" data-act="funnBought" data-v="${esc(key)}" data-i="${esc(p.id)}">Jeg kjøpte denne</button><button class="link funn-no" data-act="funnHide" data-v="${esc(key)}" data-i="${esc(p.id)}">Ikke interessant</button></span></li>`).join('')}</ul></div>`;
}

// Panelet med av/på. view = det funn-objektet under viser akkurat nå, finds = vasket av cleanFinds.
export function checkPanel(view, finds, today) {
  if (!view.ready) return '';
  const note = view.err ? `<p class="status bad" role="status">${esc(view.err)}</p>`
    : !view.on ? ''
    : finds ? `<p class="status" role="status">${esc(summaryText(finds, today))}</p>${finds.skipped.length ? `<p class="hint">${finds.skipped.length === 1 ? 'Én ting ble ikke sjekket sist. Den tas først neste gang.' : `${finds.skipped.length} ting ble ikke sjekket sist. De tas først neste gang.`}</p>` : ''}`
    : view.late ? '<p class="status bad" role="status">Får ikke hentet funnene akkurat nå.</p>'
    : '<p class="status" role="status">Ingen funn ennå. Første sjekk kjøres i morgen tidlig.</p>';
  return `<section class="panel funnpanel">
    <h2>Daglig sjekk på Finn</h2>
    <label class="funn-switch"><input type="checkbox" id="funn-on" data-ch="funnOn" ${view.on ? 'checked' : ''} ${view.busy ? 'disabled' : ''}><span>La Claude se etter tingene mine hver morgen</span></label>
    ${note}
    <p class="hint">Claude sjekker én gang om dagen og leser titler, priser og steder. Bildene ser den ikke på. ${view.on
      ? 'Lista di ligger lagret hos Claude så lenge sjekken er på, og den som eier siden kan lese den. Slår du av, slettes både lista og funnene.'
      : 'Lista di lagres da hos Claude, og den som eier siden kan lese den. Sjekken bruker Claude-kvoten til eieren.'}</p>
  </section>`;
}

// ---------- Koblingen til databasen ----------

export const funn = { ready: false, on: false, busy: false, late: false, err: '', raw: null, hidden: [] };
let profRef = null, findRef = null, unsub = null, lateTimer = null, writeTimer = null;
let writing = false, again = false, lastSig = null, startSig = null, inflight = Promise.resolve(true);
let getState = () => null, changed = () => {};

const MESSAGES = {
  invalid_argument: 'Sjekken kan ikke slås på her. Du trenger tilgang til å bidra på siden.',
  transform_error: 'Sjekken kan ikke slås på her. Du trenger tilgang til å bidra på siden.',
  quota_exceeded: 'Det er ikke plass til flere lister akkurat nå.',
  revoked: 'Daglig sjekk er ikke tilgjengelig akkurat nå.',
  not_granted: 'Daglig sjekk er ikke tilgjengelig akkurat nå.',
  capability_disabled: 'Daglig sjekk er ikke tilgjengelig akkurat nå.',
  capability_removed: 'Daglig sjekk er ikke tilgjengelig akkurat nå.',
};
const message = (e) => MESSAGES[e?.code] || 'Fikk ikke lagret. Vi prøver igjen neste gang du endrer noe.';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Forbigående feil prøves én gang til etter en liten pause. Andre feil hjelper det ikke å gjenta.
async function once(fn) {
  try { return await fn(); } catch (e) {
    if (MESSAGES[e?.code] || e?.code === 'resource_exhausted') throw e;
    await wait(400 + Math.random() * 800);
    return fn();
  }
}

// Kalles én gang når siden starter. Svarer true når både databasen og en bruker-id finnes; ellers vises ingenting.
export async function initFunn(opt) {
  try {
    const [db, user] = await Promise.all([window.claude?.use('db'), window.claude?.use('user')]);
    if (!db || !user) return false;
    const uid = await user.id();
    if (!uid) return false; // ingen egen plass i databasen: da er sjekken av for dette besøket
    profRef = db.doc(`${ROOT}/${uid}`);
    findRef = profRef.collection('funn').doc('siste');
    getState = opt.getState; changed = opt.changed;
    const snap = await once(() => profRef.get());
    if (snap.exists) {
      const stored = snap.data();
      funn.on = true;
      funn.hidden = cleanHidden(stored?.hidden);
      lastSig = profileSig(stored);
      listen();
    }
    startSig = profileSig(profile());
    funn.ready = true;
    return true;
  } catch { return false; }
}

const profile = () => buildProfile(getState(), { hidden: funn.hidden });

// Én lytter på funnene så lenge sjekken er på. Kommer det ikke svar på ti sekunder, sier vi fra.
function listen() {
  if (unsub || !findRef) return;
  const settle = () => { clearTimeout(lateTimer); lateTimer = null; };
  funn.late = false;
  lateTimer = setTimeout(() => { funn.late = true; changed(); }, 10000);
  unsub = findRef.onSnapshot((snap) => {
    if (!snap.metadata?.fromCache) { settle(); funn.late = false; }
    funn.raw = snap.exists ? snap.data() : null;
    changed();
  }, () => { settle(); unsub = null; funn.late = true; changed(); });
}
function unlisten() {
  clearTimeout(lateTimer); lateTimer = null;
  if (unsub) unsub();
  unsub = null; funn.late = false;
}

// Skriver profilen hvis den er endret. Én skriving om gangen; kommer det en endring imens, skrives det en gang til etterpå.
// force = kalt fra av/på-knappen. Ellers skrives det ingenting mens sjekken slås av eller på.
function flush(force = false) {
  if (!funn.on || !profRef || (funn.busy && !force)) return Promise.resolve(true);
  if (writing) { again = true; return inflight; }
  const p = profile();
  const sig = profileSig(p);
  // En tom liste som ikke er rørt i dette besøket, skal ikke viske ut det som ble lagret fra en annen enhet.
  if (sig === lastSig || (sig === startSig && !p.things.length && lastSig !== null)) return Promise.resolve(true);
  writing = true;
  inflight = (async () => {
    let ok = true;
    try { await once(() => profRef.set(p)); lastSig = sig; funn.err = ''; }
    catch (e) { ok = false; funn.err = message(e); }
    writing = false;
    if (again) { again = false; return flush(force); }
    return ok;
  })();
  return inflight;
}

// Lista er endret. Flere endringer på rad blir til én skriving når det har vært stille litt.
export function funnTouch() {
  if (!funn.ready || !funn.on || funn.busy) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { const had = funn.err; flush().then(() => { if (funn.err !== had) changed(); }); }, 1500);
}

export async function setCheck(on) {
  if (!funn.ready || funn.busy) return;
  funn.busy = true; funn.err = ''; changed();
  clearTimeout(writeTimer);
  again = false;
  await inflight; // aldri to skrivinger til samme dokument samtidig
  if (on) {
    funn.on = true; lastSig = null;
    if (await flush(true)) listen(); else funn.on = false;
  } else {
    unlisten();
    try {
      await once(() => profRef.delete());
      await once(() => findRef.delete());
      funn.on = false; funn.raw = null; funn.hidden = []; lastSig = null;
    } catch (e) { funn.err = e?.code === 'invalid_argument' ? 'Fikk ikke slått av sjekken herfra.' : 'Fikk ikke slått av. Prøv en gang til.'; listen(); }
  }
  funn.busy = false; changed();
}

// «Ikke interessant»: annonsen skjules med en gang og huskes i profilen, så jobben ikke foreslår den igjen.
export function hideFind(id) {
  if (!funn.ready || !funn.on) return;
  funn.hidden = addHidden(funn.hidden, id);
  funnTouch();
}

// Funnene slik de skal vises nå, for tingene brukeren fortsatt leter etter.
export const currentFinds = (keys) => (funn.ready && funn.on ? cleanFinds(funn.raw, keys, funn.hidden) : null);
