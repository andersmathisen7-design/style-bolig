import { AREAS, STYLES, QUESTIONS, ITEMS, ROOMS, HOMES, LIFE, LEVELS } from './data.js';
import {
  newState, roomsFromHome, roomLabel, roomM2, sizeFromM2, sizeRange, instances, defaultMax, maxOf,
  parseLife, wishOf, searchText, finnUrl, ikeaUrl, wallNote, tipsFor, styleWords, summary, fitBudget,
  newHint, layoutPlan, totalM2, encodeState, decodeState, normalize, kr,
} from './logic.js';

const KEY = 'brukthjem.v1';
const app = document.getElementById('app');
const STEPS = ['Bolig', 'Stil', 'Hverdag', 'Lista'];
const SIZE_NAME = { S: 'Lite', M: 'Middels', L: 'Stort' };

let state = load();
const ui = { open: null, room: null, round: false, shared: null, copied: '' };

function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* tomt eller utilgjengelig */ }
  return normalize(saved) || newState();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* lagring er bare en bekvemmelighet */ }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = Math.round(Number(String(v).replace(/[^\d.,]/g, '').replace(',', '.'))); return Number.isFinite(n) && n > 0 ? n : null; };
const today = () => new Date().toISOString().slice(0, 10);

// ---------- Visninger ----------

function header() {
  return `
  <header class="top">
    <span class="brand">Brukthjem</span>
    <nav class="steps" aria-label="Steg">
      ${STEPS.map((s, i) => `<button class="step" data-act="step" data-v="${i}" ${state.step === i ? 'aria-current="step"' : ''}><span class="step-n">${i + 1}</span>${s}</button>`).join('')}
    </nav>
  </header>`;
}

function sharedBanner() {
  if (!ui.shared) return '';
  return `<div class="banner" role="status">
    <p>Du åpnet en delt liste. Vil du bruke den i stedet for din egen?</p>
    <div class="row"><button class="btn" data-act="useShared">Bruk den delte lista</button><button class="btn ghost" data-act="dropShared">Behold min</button></div>
  </div>`;
}

function viewHome() {
  const plan = layoutPlan(state.rooms);
  const sel = state.rooms.find((r) => r.id === ui.room);
  return `
  <h1>Hva skal innredes?</h1>
  <p class="lead">Si hva du har og hva du liker, så får du en liste med ferdige søk på Finn. Start med boligen: velg det som ligner mest, og trykk på et rom for å endre størrelsen.</p>
  <div class="chips" role="group" aria-label="Boligtype">
    ${HOMES.map((h) => `<button class="chip ${state.home === h.id ? 'on' : ''}" data-act="home" data-v="${h.id}">${h.name}<small>${h.hint}</small></button>`).join('')}
  </div>
  <div class="plan" style="aspect-ratio:${state.rooms.length > 5 ? '1/1' : '4/3'}">
    ${plan.map((p) => {
      const r = state.rooms.find((x) => x.id === p.id);
      return `<button class="room ${ui.room === r.id ? 'on' : ''}" data-act="room" data-v="${r.id}" style="left:${p.x}%;top:${p.y}%;width:${p.w}%;height:${p.h}%">
        <span class="room-name">${esc(roomLabel(state.rooms, r))}</span><span class="room-m2">${roomM2(r)} m²</span></button>`;
    }).join('')}
  </div>
  <p class="plan-sum">Omtrent ${totalM2(state.rooms)} m² fordelt på ${state.rooms.length} rom. Tegningen viser størrelser, ikke hvordan rommene ligger.</p>
  ${sel ? roomEditor(sel) : ''}
  <div class="field">
    <label for="addroom">Mangler det et rom?</label>
    <select id="addroom" data-ch="addroom"><option value="">Legg til rom</option>
      ${Object.entries(ROOMS).map(([id, r]) => `<option value="${id}">${r.name}</option>`).join('')}</select>
  </div>
  <div class="field">
    <label for="area">Hvor vil du lete?</label>
    <select id="area" data-ch="area">${AREAS.map((a) => `<option value="${a.id}" ${state.area === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select>
  </div>`;
}

function roomEditor(r) {
  return `
  <section class="panel" aria-label="Endre rom">
    <h2>${esc(roomLabel(state.rooms, r))}</h2>
    <div class="chips" role="group" aria-label="Størrelse">
      ${['S', 'M', 'L'].map((s) => `<button class="chip ${r.size === s && !r.m2 ? 'on' : ''}" data-act="size" data-v="${s}">${SIZE_NAME[s]}<small>${sizeRange(r.type, s)}</small></button>`).join('')}
    </div>
    <div class="pair">
      <div class="field"><label for="m2">Eller skriv inn m²</label><input id="m2" inputmode="decimal" data-ch="m2" value="${r.m2 ?? ''}" placeholder="f.eks. 18"></div>
      <div class="field"><label for="wall">Lengste ledige vegg, cm</label><input id="wall" inputmode="numeric" data-ch="wall" value="${r.wall ?? ''}" placeholder="valgfritt"></div>
    </div>
    <p class="hint">Veggmålet brukes til å regne ut hvor bred sofa, benk eller skap du har plass til.</p>
    <button class="link danger" data-act="delroom">Fjern rommet</button>
  </section>`;
}

function viewStyle() {
  return `
  <h1>Hvilken stil liker du?</h1>
  <p class="lead">Stilen gir deg forslag til søkeord på hver ting. Du kan bytte når som helst.</p>
  <div class="styles">
    ${STYLES.map((s) => `<button class="style ${state.style === s.id ? 'on' : ''}" data-act="style" data-v="${s.id}">
      <span class="swatch" aria-hidden="true">${s.colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
      <span class="style-name">${s.name}</span><span class="style-desc">${s.desc}</span></button>`).join('')}
  </div>`;
}

function viewLife() {
  const got = Object.entries(state.autoWish);
  const all = instances(state);
  return `
  <h1>Hvordan bruker du hjemmet?</h1>
  <p class="lead">Skriv med egne ord, trykk på det som passer, eller begge deler.</p>
  <div class="field">
    <label for="life">Fortell litt</label>
    <textarea id="life" rows="4" data-ch="life" placeholder="F.eks. «Jeg jobber hjemmefra og har ofte venner på middag. Vil ikke ha rundt bord, og sofaen bør være grønn.»">${esc(state.lifeText)}</textarea>
    <button class="btn small" data-act="read">Les teksten</button>
  </div>
  <div class="chips" role="group" aria-label="Hverdagen din">
    ${LIFE.map((l) => `<button class="chip ${state.life.includes(l.id) ? 'on' : ''}" data-act="life" data-v="${l.id}" aria-pressed="${state.life.includes(l.id)}">${l.label}</button>`).join('')}
  </div>
  ${got.length ? `<section class="panel"><h2>Dette fikk vi med oss</h2><ul class="got">
    ${got.map(([itemId, text]) => {
      const inst = all.find((i) => i.itemId === itemId) || { itemId, saved: {}, v: {}, item: ITEMS[itemId] };
      const w = wishOf({ ...inst, saved: {} }, state);
      const parts = [w.search.length ? `søker etter ${w.search.join(', ')}` : '', w.avoid.length ? `unngår ${w.avoid.join(', ')}` : '', w.notes.length ? `ser etter ${w.notes.join(', ')}` : ''].filter(Boolean);
      return `<li><strong>${esc(ITEMS[itemId].name)}:</strong> ${esc(parts.join('. '))}. <button class="link" data-act="dropWish" data-v="${itemId}">Fjern</button></li>`;
    }).join('')}</ul></section>` : ''}
  <p class="hint">Teksten leses av enkle regler i nettleseren din, ikke av en AI. Ord vi ikke kjenner igjen, hopper vi over. På hver ting i lista kan du rette og legge til.</p>`;
}

function budgetPanel(sum) {
  return `
  <section class="panel budget">
    <h2>Hva vil du bruke?</h2>
    <div class="levels" role="group" aria-label="Prisnivå">
      ${LEVELS.map((l, i) => `<button class="level ${state.level === l.id ? 'on' : ''}" data-act="level" data-v="${l.id}">
        <span class="level-name">${l.name}</span><span class="level-sum">ca. ${kr([sum.low, sum.mid, sum.high][i])}</span><span class="level-hint">${l.hint}</span></button>`).join('')}
    </div>
    <p class="hint">Summene gjelder det som står igjen på lista. Alt nytt i rimeligste variant: ca. ${kr(sum.newSum)}.</p>
    <div class="field">
      <label for="total">Totalbudsjett, hvis du har et</label>
      <input id="total" inputmode="numeric" data-ch="total" value="${state.total ?? ''}" placeholder="valgfritt, i kroner">
    </div>
    ${state.total ? `<p class="budget-line">Brukt ${kr(sum.paid)} av ${kr(state.total)}. Igjen: <strong>${kr(sum.left)}</strong>.</p>` : (sum.paid ? `<p class="budget-line">Brukt så langt: <strong>${kr(sum.paid)}</strong>.</p>` : '')}
    ${sum.over > 0 ? `<div class="warn"><p>Makspriser på lista er til sammen ${kr(sum.over)} mer enn du har igjen.</p><button class="btn small" data-act="fit">Senk makspriser så det går opp</button></div>` : ''}
  </section>`;
}

function itemRow(inst, sum) {
  const open = ui.open === inst.key;
  const max = maxOf(inst, state);
  const tag = inst.st === 'bought' ? `kjøpt ${inst.saved.paid ? kr(inst.saved.paid) : ''}` : inst.st === 'have' ? 'har' : max === null ? 'ingen grense' : `inntil ${kr(max)}`;
  return `
  <li class="item is-${inst.st} ${open ? 'open' : ''}">
    <div class="item-head">
      <button class="check" data-act="have" data-v="${inst.key}" aria-pressed="${inst.st === 'have'}" aria-label="Har ${esc(inst.item.name)} fra før"></button>
      <button class="item-main" data-act="open" data-v="${inst.key}" aria-expanded="${open}">
        <span class="item-name">${esc(inst.item.name)}</span>
        ${inst.v.label && inst.st === 'need' ? `<span class="item-size">${esc(inst.v.label)}</span>` : ''}
      </button>
      <span class="tag tag-${inst.st}">${esc(tag)}</span>
    </div>
    ${open ? itemBody(inst, sum) : ''}
  </li>`;
}

function itemBody(inst, sum) {
  const k = inst.key;
  if (inst.st === 'have') return `<div class="item-body"><p>Du har denne fra før.</p><button class="link" data-act="status" data-v="${k}" data-st="need">Jeg trenger den likevel</button></div>`;
  if (inst.st === 'bought') return `<div class="item-body"><p>Kjøpt${inst.saved.paid ? ` for ${kr(inst.saved.paid)}` : ''}.</p><button class="link" data-act="status" data-v="${k}" data-st="need">Angre, jeg leter fortsatt</button></div>`;
  const w = wishOf(inst, state);
  const max = maxOf(inst, state);
  const area = AREAS.find((a) => a.id === state.area)?.name || 'Hele Norge';
  const hint = newHint(inst, state, sum);
  const words = styleWords(inst, state);
  const kw = inst.saved.kw || [];
  const picks = inst.saved.picks || {};
  const notes = [...w.avoid.map((a) => `ikke ${a}`), ...w.notes];
  return `
  <div class="item-body">
    ${[wallNote(inst), ...tipsFor(inst, state)].filter(Boolean).map((t) => `<p class="tip">${esc(t)}</p>`).join('')}
    <div class="row">
      <a class="btn" href="${esc(finnUrl(inst, state, 'all'))}" target="_blank" rel="noopener" data-act="seen" data-v="${k}">Søk på Finn</a>
      <a class="btn ghost" href="${esc(finnUrl(inst, state, 'today'))}" target="_blank" rel="noopener" data-act="seen" data-v="${k}">Lagt ut i dag</a>
      <a class="btn ghost" href="${esc(finnUrl(inst, state, 'free'))}" target="_blank" rel="noopener">Gis bort</a>
    </div>
    <p class="hint">Søker etter «${esc(searchText(inst, state))}» i ${esc(area)}${max ? `, inntil ${kr(max)}` : ''}.</p>
    ${notes.length ? `<p class="look">Se etter selv i annonsen: ${esc(notes.join(', '))}.</p>` : ''}

    ${words.length ? `<div class="q"><span class="q-label">Søkeord i stilen din</span><div class="chips">
      ${words.map((x) => `<button class="chip mini ${kw.includes(x) ? 'on' : ''}" data-act="kw" data-v="${k}" data-w="${esc(x)}" aria-pressed="${kw.includes(x)}">${esc(x)}</button>`).join('')}</div></div>` : ''}
    ${(inst.item.ask || []).map((qid) => `<div class="q"><span class="q-label">${QUESTIONS[qid].label}</span><div class="chips">
      ${QUESTIONS[qid].options.map((o, i) => `<button class="chip mini ${picks[qid] === i ? 'on' : ''}" data-act="pick" data-v="${k}" data-q="${qid}" data-i="${i}" aria-pressed="${picks[qid] === i}">${o.label}</button>`).join('')}</div></div>`).join('')}
    <div class="field">
      <label for="wish-${k}">Egne ønsker</label>
      <input id="wish-${k}" data-ch="wish" data-v="${k}" value="${esc(inst.saved.wish || '')}" placeholder="f.eks. ikke rundt, gjerne eik, maks 180 cm">
    </div>
    <div class="pair">
      <div class="field"><label for="max-${k}">Makspris, kr</label><input id="max-${k}" inputmode="numeric" data-ch="max" data-v="${k}" value="${max ?? ''}" placeholder="ingen grense"></div>
      <div class="field end">${max === null
        ? `<button class="link" data-act="maxreset" data-v="${k}">Bruk anslaget, ${kr(defaultMax(inst, state))}</button>`
        : `<button class="link" data-act="nomax" data-v="${k}">Ingen prisgrense</button>`}</div>
    </div>
    <div class="new ${hint === 'finish' ? 'hot' : ''}">
      <p>${hint === 'finish' ? 'Du har nesten alt. Det kan lønne seg å kjøpe ny og bli ferdig.' : 'Finner du ingenting brukt?'}
      Ny koster fra ca. ${kr(inst.v.n)}${hint === 'fits' ? ', og det er innenfor maksprisen din' : ''}.</p>
      <a class="link" href="${esc(ikeaUrl(inst, state))}" target="_blank" rel="noopener">Se nye hos IKEA</a>
    </div>
    <div class="done">
      <div class="field"><label for="paid-${k}">Fant du en? Skriv prisen</label><input id="paid-${k}" inputmode="numeric" placeholder="kr"></div>
      <button class="btn small" data-act="bought" data-v="${k}">Merk som kjøpt</button>
      <button class="link" data-act="status" data-v="${k}" data-st="off">Trenger ikke</button>
    </div>
  </div>`;
}

function viewRound(need) {
  return `
  <section class="panel">
    <h2>Dagens runde</h2>
    <p>Én rask titt om dagen holder. Hver lenke viser bare det som er lagt ut i dag. Vil du ha varsel, trykk «Lagre søk» inne på Finn.</p>
    <ul class="round">
      ${need.map((i) => `<li><a href="${esc(finnUrl(i, state, 'today'))}" target="_blank" rel="noopener" data-act="seen" data-v="${i.key}">${esc(i.item.name)}<small>${esc(roomLabel(state.rooms, i.room))}</small></a>
        <span class="seen ${i.saved.seen === today() ? 'yes' : ''}">${i.saved.seen === today() ? 'sett i dag' : 'ikke sett'}</span></li>`).join('')}
    </ul>
    <button class="btn ghost small" data-act="round">Tilbake til lista</button>
  </section>`;
}

function viewList() {
  const all = instances(state);
  const sum = summary(state);
  const need = all.filter((i) => i.st === 'need');
  if (ui.round) return `<h1>Lista di</h1>${viewRound(need)}`;
  const style = STYLES.find((s) => s.id === state.style);
  return `
  <h1>Lista di</h1>
  <p class="lead">${sum.need === 0 ? 'Ingenting igjen å finne. Legg til ting under rommene, eller nyt et ferdig hjem.' : `${sum.need} ting igjen å finne.`}
    ${sum.have ? ` ${sum.have} har du fra før.` : ''}${sum.bought ? ` ${sum.bought} er kjøpt.` : ''} Huk av det du har. Trykk på en ting for å søke.</p>
  ${!style ? `<p class="hint">Du har ikke valgt stil ennå. <button class="link" data-act="step" data-v="1">Velg stil</button></p>` : ''}
  ${budgetPanel(sum)}
  ${need.length ? `<button class="btn wide" data-act="round">Dagens runde: se hva som er nytt på Finn</button>` : ''}
  ${state.rooms.map((room) => {
    const mine = all.filter((i) => i.room.id === room.id);
    const on = mine.filter((i) => i.st !== 'off');
    const off = mine.filter((i) => i.st === 'off');
    return `<section class="roomlist">
      <h2>${esc(roomLabel(state.rooms, room))}<small>${roomM2(room)} m²</small></h2>
      <ul class="items">${on.map((i) => itemRow(i, sum)).join('')}</ul>
      ${off.length ? `<div class="more"><span class="q-label">Legg til</span><div class="chips">${off.map((i) => `<button class="chip mini add" data-act="status" data-v="${i.key}" data-st="need">+ ${esc(i.item.name)}</button>`).join('')}</div></div>` : ''}
    </section>`;
  }).join('')}
  <section class="panel">
    <h2>Ta med deg lista</h2>
    <p>Lista lagres bare i denne nettleseren. Med en lenke kan du åpne den på en annen enhet eller sende den til noen.</p>
    <div class="row"><button class="btn ghost small" data-act="share">Kopier lenke til lista</button><button class="link danger" data-act="reset">Start på nytt</button></div>
    ${ui.copied ? `<div class="field"><label for="sharelink">${ui.copied === 'ok' ? 'Lenken er kopiert' : 'Kopier lenken herfra'}</label><input id="sharelink" readonly value="${esc(shareUrl())}"></div>` : ''}
  </section>`;
}

function footerNav() {
  if (state.step === 3) return '';
  return `<div class="nav">
    ${state.step > 0 ? `<button class="btn ghost" data-act="step" data-v="${state.step - 1}">Tilbake</button>` : '<span></span>'}
    <button class="btn" data-act="step" data-v="${state.step + 1}">${state.step === 2 ? 'Lag lista' : `Neste: ${STEPS[state.step + 1].toLowerCase()}`}</button>
  </div>`;
}

function shareUrl() {
  return `${location.origin}${location.pathname}#l=${encodeState({ ...state, step: 3 })}`;
}

function render() {
  const active = document.activeElement;
  const fid = active && active !== document.body ? active.id : '';
  const sig = (el) => ['act', 'v', 'q', 'i', 'w', 'st'].map((k) => el.dataset[k] ?? '').join('|');
  const fsig = !fid && active?.dataset?.act ? sig(active) : '';
  const views = [viewHome, viewStyle, viewLife, viewList];
  app.innerHTML = `${header()}<main>${sharedBanner()}${views[state.step]()}</main>${footerNav()}
    <footer class="foot"><p>Brukthjem er et uavhengig hjelpemiddel og er ikke tilknyttet FINN.no eller IKEA. Prisene er anslag fra november 2026. Ingenting sendes fra nettleseren din.</p></footer>`;
  if (fid) document.getElementById(fid)?.focus({ preventScroll: true });
  else if (fsig) [...app.querySelectorAll('[data-act]')].find((el) => sig(el) === fsig)?.focus({ preventScroll: true });
}
let queued = false;
function later() {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; render(); }, 0);
}
function commit() { save(); later(); }
function setItem(key, patch) { state.items[key] = { ...state.items[key], ...patch }; commit(); }
const instByKey = (key) => instances(state).find((i) => i.key === key);

// ---------- Hendelser ----------

const actions = {
  read() { const el = document.getElementById('life'); if (el) { changes.life(el); commit(); } },
  step(v) { state.step = Math.min(3, Math.max(0, Number(v))); ui.round = false; ui.room = null; commit(); window.scrollTo(0, 0); },
  home(v) { state.home = v; state.rooms = roomsFromHome(v); ui.room = null; commit(); },
  room(v) { ui.room = ui.room === v ? null : v; later(); },
  size(v) { const r = state.rooms.find((x) => x.id === ui.room); if (r) { r.size = v; r.m2 = null; commit(); } },
  delroom() { state.rooms = state.rooms.filter((r) => r.id !== ui.room); ui.room = null; commit(); },
  style(v) { state.style = v; commit(); },
  life(v) { state.life = state.life.includes(v) ? state.life.filter((x) => x !== v) : [...state.life, v]; commit(); },
  dropWish(v) { delete state.autoWish[v]; commit(); },
  level(v) { state.level = v; commit(); },
  fit() { state.items = fitBudget(state); commit(); },
  round() { ui.round = !ui.round; later(); window.scrollTo(0, 0); },
  open(v) { ui.open = ui.open === v ? null : v; later(); },
  have(v) { const i = instByKey(v); if (i) setItem(v, { st: i.st === 'have' ? 'need' : 'have' }); },
  status(v, el) { setItem(v, { st: el.dataset.st }); if (el.dataset.st === 'off') ui.open = null; },
  kw(v, el) { const i = instByKey(v); const w = el.dataset.w; const kw = i.saved.kw || []; setItem(v, { kw: kw.includes(w) ? kw.filter((x) => x !== w) : [...kw, w] }); },
  pick(v, el) { const i = instByKey(v); const picks = { ...(i.saved.picks || {}) }; const n = Number(el.dataset.i); if (picks[el.dataset.q] === n) delete picks[el.dataset.q]; else picks[el.dataset.q] = n; setItem(v, { picks }); },
  nomax(v) { setItem(v, { max: null }); },
  maxreset(v) { const it = { ...state.items[v] }; delete it.max; state.items[v] = it; commit(); },
  bought(v) { setItem(v, { st: 'bought', paid: num(document.getElementById(`paid-${v}`)?.value) }); ui.open = null; },
  seen(v) { setItem(v, { seen: today() }); },
  async share() {
    try { await navigator.clipboard.writeText(shareUrl()); ui.copied = 'ok'; } catch { ui.copied = 'manual'; }
    later();
  },
  reset() { if (confirm('Vil du slette lista og starte på nytt?')) { state = newState(); ui.open = ui.room = null; commit(); window.scrollTo(0, 0); } },
  useShared() { state = ui.shared; ui.shared = null; history.replaceState(null, '', location.pathname); commit(); },
  dropShared() { ui.shared = null; history.replaceState(null, '', location.pathname); later(); },
};

const changes = {
  area(el) { state.area = el.value; },
  addroom(el) {
    if (!ROOMS[el.value]) return;
    const id = 'r' + (state.seq = (state.seq || 100) + 1);
    state.rooms.push({ id, type: el.value, size: 'M', m2: null, wall: null });
    ui.room = id;
  },
  m2(el) { const r = state.rooms.find((x) => x.id === ui.room); const n = num(el.value); if (r) { r.m2 = n && n <= 200 ? n : null; if (r.m2) r.size = sizeFromM2(r.type, r.m2); } },
  wall(el) { const r = state.rooms.find((x) => x.id === ui.room); const n = num(el.value); if (r) r.wall = n && n <= 2000 ? n : null; },
  life(el) {
    state.lifeText = el.value.slice(0, 2000);
    const p = parseLife(state.lifeText);
    state.life = [...new Set([...state.life, ...p.life])];
    state.autoWish = p.wishes;
  },
  total(el) { state.total = num(el.value); },
  wish(el) { state.items[el.dataset.v] = { ...state.items[el.dataset.v], wish: el.value.slice(0, 300) }; },
  max(el) { state.items[el.dataset.v] = { ...state.items[el.dataset.v], max: num(el.value) }; },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.tagName !== 'A') e.preventDefault();
  actions[el.dataset.act]?.(el.dataset.v, el);
});
app.addEventListener('change', (e) => {
  const fn = changes[e.target.dataset.ch];
  if (!fn) return;
  fn(e.target);
  commit();
});

const hash = location.hash.match(/^#l=(.+)$/);
if (hash) {
  const shared = decodeState(hash[1]);
  let hasOwn = false;
  try { hasOwn = !!localStorage.getItem(KEY); } catch { /* ingen lagring */ }
  if (shared && !hasOwn) { state = shared; history.replaceState(null, '', location.pathname); save(); }
  else if (shared) ui.shared = shared;
}
render();
