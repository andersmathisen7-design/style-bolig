import { AREAS, STYLES, QUESTIONS, ITEMS, ROOMS, HOMES, LEVELS, GROUPS, PRIOS } from './data.js';
import {
  newState, roomsFromHome, roomLabel, roomM2, sizeFromM2, sizeRange, instances, defaultMax, maxOf,
  parseLife, parseOwned, wishOf, searchText, finnUrl, ikeaUrl, wallNote, tipsFor, styleWords, summary, fitBudget, decorLinks,
  newHint, layoutPlan, totalM2, encodeState, decodeState, normalize, pruneItems, kr,
  prioOf, kwOf, comfortFor, footprint, withDrawing, placedWall,
} from './logic.js';
import { ai, initAI, readPlan, readLife } from './ai.js';
import { drawView, furnishView, roomPanel, bindEditor, editorActions, isDragging, sheetFor } from './editor.js';

const KEY = 'brukthjem.v2'; // v2: starter med blanke ark etter at tegningen ble lagt om
const app = document.getElementById('app');
const STEPS = ['Bolig', 'Stil', 'Ting', 'Plasser', 'Finn'];
const LAST = STEPS.length - 1;
const canShare = !window.__noShare; // forhåndsvisninger uten egen adresse kan ikke dele lenker
const SIZE_NAME = { S: 'Lite', M: 'Middels', L: 'Stort' };

let state = load();
const ui = {
  open: null, room: null, round: false, shared: null, copied: '', sure: false, busy: '', msg: null, style: null,
  tab: state.drawn ? 'draw' : 'pick', tool: 'draw', floor: 0, sheet: sheetFor(state, window.innerWidth < 600 ? 1000 : 1500), furn: null, note: '', info: '', write: false, furnish: false,
};

function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* tomt eller utilgjengelig */ }
  return normalize(saved) || newState();
}
// Angre: hver gang noe endres, tas det vare på hvordan det var. Hvilket steg man står på, teller ikke som en endring.
const undoStack = [];
let lastJson = null;
const snapshot = () => JSON.stringify({ ...state, step: 0 });
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* lagring er bare en bekvemmelighet */ }
}
function save() {
  const now = snapshot();
  if (lastJson !== null && now !== lastJson) { undoStack.push(lastJson); if (undoStack.length > 50) undoStack.shift(); }
  lastJson = now;
  persist();
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
  const sel = state.rooms.find((r) => r.id === ui.room);
  return `
  <h1>Hva skal innredes?</h1>
  <p class="lead">Si hva du har og hva du liker, så får du en liste med ferdige søk på Finn. Start med boligen: velg en som ligner, eller tegn den selv.</p>
  <div class="tabs" role="group" aria-label="Hvordan vil du sette opp boligen?">
    <button class="tab ${ui.tab === 'pick' ? 'on' : ''}" data-act="tab" data-v="pick" aria-pressed="${ui.tab === 'pick'}">Velg bolig</button>
    <button class="tab ${ui.tab === 'draw' ? 'on' : ''}" data-act="tab" data-v="draw" aria-pressed="${ui.tab === 'draw'}">Tegn selv</button>
  </div>
  ${ui.tab === 'draw' ? drawView(state, ui, undoStack.length > 0) : pickView()}
  ${sel ? (sel.poly ? roomPanel(state, ui, sel) : roomEditor(sel)) : ''}
  ${ui.tab === 'pick' ? `<div class="field">
    <label for="addroom">Mangler det et rom?</label>
    <select id="addroom" data-ch="addroom"><option value="">Legg til rom</option>
      ${Object.entries(ROOMS).map(([id, r]) => `<option value="${id}">${r.name}</option>`).join('')}</select>
  </div>` : ''}
  <div class="field">
    <label for="area">Hvor vil du lete?</label>
    <select id="area" data-ch="area">${AREAS.map((a) => `<option value="${a.id}" ${state.area === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select>
  </div>`;
}

function pickView() {
  const plan = layoutPlan(state.rooms);
  return `
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
  <p class="plan-sum">Omtrent ${totalM2(state.rooms)} m² fordelt på ${state.rooms.length} rom. Trykk på et rom for å endre størrelsen. Tegningen viser størrelser, ikke hvordan rommene ligger.</p>
  ${uploadPanel()}`;
}

function status(where) {
  if (ui.busy === where) return `<p class="status" role="status">${where === 'plan' ? 'Claude leser tegningen. Det tar gjerne et halvt minutt.' : 'Claude leser teksten.'}</p>`;
  if (ui.msg?.where === where) return `<p class="status ${ui.msg.bad ? 'bad' : ''}" role="status">${esc(ui.msg.text)}</p>`;
  return '';
}

function uploadPanel() {
  if (!ai.images) return '';
  return `
  <section class="panel">
    <h2>Har du en plantegning?</h2>
    <p>Last opp et bilde, så leser Claude av rom og kvadratmeter. Et skjermbilde fra boligannonsen holder.</p>
    <label class="btn ghost small filebtn ${ui.busy ? 'off' : ''}">Velg bilde av plantegning
      <input class="vh" type="file" id="planfile" accept="${esc(ai.types)}" data-ch="planfile" ${ui.busy ? 'disabled' : ''}></label>
    ${status('plan')}
  </section>`;
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

const photo = (id, n, small) => `photos/${id}-${n}${small ? 's' : ''}.webp`;

const subName = () => { const st = STYLES.find((x) => x.id === state.style); return st && Number.isInteger(state.sub) ? st.photos[state.sub].name : ''; };

function viewStyle() {
  const open = STYLES.find((s) => s.id === ui.style);
  if (open) return styleDetail(open);
  return `
  <h1>Hvilken stil liker du?</h1>
  <p class="lead">Trykk på en stil for å se retningene innenfor den og velge den som ligner mest på deg.</p>
  <div class="styles">
    ${STYLES.map((s) => `<button class="style ${state.style === s.id ? 'on' : ''}" data-act="styleopen" data-v="${s.id}">
      <img src="${photo(s.id, state.style === s.id && Number.isInteger(state.sub) ? state.sub + 1 : 1, !(state.style === s.id && state.sub))}" alt="" width="480" height="360" loading="lazy">
      <span class="style-name">${s.name}${state.style === s.id ? '<span class="picked">Valgt</span>' : ''}</span>
      <span class="style-desc">${state.style === s.id && subName() ? esc(subName()) : s.desc}</span></button>`).join('')}
  </div>`;
}

function styleDetail(s) {
  const mine = state.style === s.id;
  return `
  <button class="link back" data-act="styleopen" data-v="">Alle stiler</button>
  <h1>${s.name}</h1>
  <p class="lead">${s.desc} Velg retningen som passer best, eller ta hele stilen.</p>
  <ul class="traits">${s.traits.map((t) => `<li>${t}</li>`).join('')}</ul>
  <div class="gallery">
    ${s.photos.map((p, i) => { const on = mine && state.sub === i; const words = [...new Set([...p.wood, ...p.soft])]; return `<figure class="${on ? 'on' : ''}">
      <img src="${photo(s.id, i + 1)}" alt="${esc(p.alt)}" width="900" height="675" ${i ? 'loading="lazy"' : ''}>
      <figcaption><h2>${esc(p.name)}${on ? '<span class="picked">Valgt</span>' : ''}</h2>
        <p>${esc(p.alt)}. Vi søker gjerne etter ${esc(words.join(', '))}.</p>
        <button class="btn small ${on ? 'ghost' : ''}" data-act="style" data-v="${s.id}" data-i="${i}">${on ? 'Dette er retningen din' : `Velg ${esc(p.name.toLowerCase())}`}</button>
        <a class="credit" href="${esc(p.url)}" target="_blank" rel="noopener">Foto: ${esc(p.by)}, Unsplash</a></figcaption></figure>`; }).join('')}
  </div>
  <div class="row"><button class="btn ghost" data-act="style" data-v="${s.id}">${mine && state.sub === null ? 'Du har valgt hele stilen' : `Velg hele stilen ${esc(s.name.toLowerCase())}`}</button>
    <button class="link" data-act="styleopen" data-v="">Se de andre stilene</button></div>`;
}

// Kort navn på en størrelse, så tre valg får plass på én linje: «3-seter, ca. 200–230 cm bred» blir «3-seter».
const shortSize = (label) => label.split(',')[0].replace(/^Ca\. /, '').replace(' eller stor 3-seter', '');

// Valgfri hjelp på «Ting»: skriv med egne ord, så huker vi av.
function writeHelp() {
  const got = Object.entries(state.autoWish);
  const all = instances(state);
  return `
  <div class="write">
    <button class="link" data-act="write" aria-expanded="${ui.write}">${ui.write ? 'Skjul skrivefeltet' : 'Vil du heller skrive det?'}</button>
    ${ui.write ? `<div class="field">
      <label for="life">Beskriv hva du har og hva du vil ha, så huker vi av for deg</label>
      <textarea id="life" rows="3" data-ch="life" placeholder="F.eks. «Jeg har seng og sofa fra før. Vil ikke ha rundt bord, og gjerne en grønn lenestol.»">${esc(state.lifeText)}</textarea>
      <button class="btn small" data-act="read" ${ui.busy ? 'disabled' : ''}>Les teksten</button>
      ${status('life')}
    </div>
    ${got.length ? `<ul class="got">
      ${got.map(([itemId]) => {
        const inst = all.find((i) => i.itemId === itemId) || { itemId, saved: {}, v: {}, item: ITEMS[itemId] };
        const w = wishOf({ ...inst, saved: {} }, state);
        const parts = [w.search.length ? `søker etter ${w.search.join(', ')}` : '', w.avoid.length ? `unngår ${w.avoid.join(', ')}` : '', w.notes.length ? `ser etter ${w.notes.join(', ')}` : ''].filter(Boolean);
        return `<li><strong>${esc(ITEMS[itemId].name)}:</strong> ${esc(parts.join('. '))}. <button class="link" data-act="dropWish" data-v="${itemId}">Fjern</button></li>`;
      }).join('')}</ul>` : ''}
    <p class="hint">${ai.ready
      ? 'Claude leser teksten når du trykker på knappen. Det bruker litt av Claude-kvoten din.'
      : 'Teksten leses av enkle regler i nettleseren din, ikke av en AI. Ord vi ikke kjenner igjen, hopper vi over.'}</p>` : ''}
  </div>`;
}

function thingRow(inst) {
  const k = inst.key, on = inst.st === 'need';
  return `
  <li class="item thing is-${inst.st}">
    <div class="item-head">
      <button class="check ${inst.st === 'bought' ? 'done' : ''}" data-act="want" data-v="${k}" aria-pressed="${inst.st !== 'have'}" aria-label="${esc(inst.item.name)} er med på lista"></button>
      <span class="item-main"><span class="item-name">${esc(inst.item.name)}</span>
        ${inst.st === 'bought' ? '<span class="item-size">Kjøpt</span>' : inst.st === 'have' ? '<span class="item-size">Ikke med</span>' : ''}</span>
      ${on ? `<div class="stepper mini" role="group" aria-label="Antall ${esc(inst.item.name)}"><button data-act="qty" data-v="${k}" data-d="-1" aria-label="Færre" ${inst.qty <= 1 ? 'disabled' : ''}>−</button><span aria-live="polite">${inst.qty}</span><button data-act="qty" data-v="${k}" data-d="1" aria-label="Flere">+</button></div>` : ''}
    </div>
    ${on && inst.item.size ? `<div class="chips thing-size" role="group" aria-label="Størrelse på ${esc(inst.item.name)}">
      ${['S', 'M', 'L'].map((z) => `<button class="chip mini ${inst.size === z ? 'on' : ''}" data-act="isize" data-v="${k}" data-s="${z}" aria-pressed="${inst.size === z}">${esc(shortSize(inst.item.size[z].label))}</button>`).join('')}</div>` : ''}
  </li>`;
}

function viewThings() {
  const all = instances(state);
  const n = all.filter((i) => i.st === 'need').length;
  return `
  <h1>Hva vil du ha?</h1>
  <p class="lead">Haken betyr at tingen er med. Vi har huket av det de fleste trenger, så fjern haken på det du har fra før. Velg antall og størrelse der det passer.</p>
  <div class="row bulk"><button class="link" data-act="noneon">Fjern alle haker</button><button class="link" data-act="usualon">Huk av det vanlige</button></div>
  <div class="q"><span class="q-label">Hva er viktigst når du velger?</span>
    <div class="chips" role="group" aria-label="Viktigst">
      ${PRIOS.map(([id, name]) => `<button class="chip ${state.prio === id ? 'on' : ''}" data-act="prio" data-v="${id}" aria-pressed="${state.prio === id}">${name}</button>`).join('')}
    </div>
    <p class="hint">${state.prio ? esc(PRIOS.find((x) => x[0] === state.prio)[2]) + ' Du kan velge noe annet for enkeltting senere.' : 'Valgfritt. Du kan også velge dette for hver enkelt ting senere.'}</p></div>
  ${writeHelp()}
  ${state.rooms.map((room) => {
    const mine = all.filter((i) => i.room.id === room.id);
    const on = mine.filter((i) => i.st !== 'off');
    const off = mine.filter((i) => i.st === 'off');
    return `<section class="roomlist">
      <h2>${esc(roomLabel(state.rooms, room))}<small>${roomM2(room)} m²${state.floors.length > 1 && room.poly ? `, ${esc(state.floors[room.floor || 0])}` : ''}</small></h2>
      <ul class="items">${on.map(thingRow).join('')}</ul>
      ${off.length ? `<div class="more">${GROUPS.map(([gid, gname]) => {
        const g = off.filter((i) => (i.item.group || 'mobler') === gid);
        return g.length ? `<span class="q-label">${gname}</span><div class="chips">${g.map((i) => `<button class="chip mini add" data-act="status" data-v="${i.key}" data-st="need">+ ${esc(i.item.name)}</button>`).join('')}</div>` : '';
      }).join('')}</div>` : ''}
      <div class="own"><div class="field"><label for="own-${room.id}">Noe annet? Beskriv hva du ser etter</label>
        <input id="own-${room.id}" data-enter="own" data-v="${room.id}" maxlength="60" placeholder="f.eks. grønn fløyelspuff"></div>
        <button class="btn ghost small" data-act="own" data-v="${room.id}">Legg til</button></div>
    </section>`;
  }).join('')}
  <p class="plan-sum">${n} ting er med på lista.</p>`;
}

// ----- steg 4: Plasser -----
function viewPlace() {
  return `
  <h1>Hvor skal tingene stå?</h1>
  <p class="lead">Sett ut det viktigste omtrent der det skal stå. Da vet vi hvilken vegg sofaen har og hvor bred den kan være. Steget er valgfritt, så du kan gå rett videre.</p>
  ${furnishView(state, ui, undoStack.length > 0)}`;
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
  const tag = inst.st === 'bought' ? `kjøpt ${inst.saved.paid ? kr(inst.saved.paid) : ''}` : inst.st === 'have' ? 'ikke med' : `${inst.qty > 1 ? `${inst.qty} × ` : ''}${max === null ? 'ingen grense' : `inntil ${kr(max)}`}`;
  return `
  <li class="item find is-${inst.st} ${open ? 'open' : ''}">
    <div class="item-head">
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
  if (inst.st === 'bought') return `<div class="item-body"><p>Kjøpt${inst.saved.paid ? ` for ${kr(inst.saved.paid)}` : ''}.</p><button class="link" data-act="status" data-v="${k}" data-st="need">Angre, jeg leter fortsatt</button></div>`;
  const w = wishOf(inst, state);
  const max = maxOf(inst, state);
  const area = AREAS.find((a) => a.id === state.area)?.name || 'Hele Norge';
  const hint = newHint(inst, state, sum);
  const words = styleWords(inst, state);
  const kw = kwOf(inst, state);
  const picks = inst.saved.picks || {};
  const prio = prioOf(inst, state), comfort = comfortFor(inst, state);
  const canPlace = !inst.item.custom && footprint(inst.itemId, inst.size);
  const pw = canPlace ? placedWall(state, inst.room.id, inst.itemId) : null;
  const isPlaced = canPlace && state.furn.some((f) => f.room === inst.room.id && f.item === inst.itemId);
  const notes = [...w.avoid.map((a) => `ikke ${a}`), ...w.notes];
  return `
  <div class="item-body">
    ${[wallNote(inst, state), ...tipsFor(inst, state)].filter(Boolean).map((t) => `<p class="tip">${esc(t)}</p>`).join('')}
    <div class="row">
      <a class="btn" href="${esc(finnUrl(inst, state, 'all'))}" target="_blank" rel="noopener" data-act="seen" data-v="${k}">Søk på Finn</a>
      <a class="btn ghost" href="${esc(finnUrl(inst, state, 'today'))}" target="_blank" rel="noopener" data-act="seen" data-v="${k}">Lagt ut i dag</a>
      <a class="btn ghost" href="${esc(finnUrl(inst, state, 'free'))}" target="_blank" rel="noopener">Gis bort</a>
    </div>
    <p class="hint">Søker etter «${esc(searchText(inst, state))}» i ${esc(area)}${max ? `, inntil ${kr(max)}${inst.qty > 1 ? ' per stk' : ''}` : ''}.${inst.qty > 1 ? ` Du skal ha ${inst.qty}. Like møbler selges ofte samlet, så prøv også å legge til «par» eller «2 stk».` : ''}</p>
    ${prio === 'pris' ? '<p class="tip">Pris er viktigst: sjekk «Gis bort» først.</p>' : ''}
    ${comfort ? `<p class="tip">Komfort er viktigst: ${esc(comfort.tip)}</p>` : ''}

    <div class="twocol">
      <div class="q"><span class="q-label">Antall</span>
        <div class="stepper"><button data-act="qty" data-v="${k}" data-d="-1" aria-label="Færre" ${inst.qty <= 1 ? 'disabled' : ''}>−</button><span aria-live="polite">${inst.qty}</span><button data-act="qty" data-v="${k}" data-d="1" aria-label="Flere">+</button></div></div>
      <div class="field"><label for="maxw-${k}">Maks bredde, cm</label><input id="maxw-${k}" inputmode="numeric" data-ch="maxw" data-v="${k}" value="${inst.saved.maxw ?? ''}" placeholder="valgfritt"></div>
    </div>
    ${inst.item.size ? `<div class="q"><span class="q-label">Størrelse</span><div class="chips">
      ${['S', 'M', 'L'].map((z) => `<button class="chip mini ${inst.size === z ? 'on' : ''}" data-act="isize" data-v="${k}" data-s="${z}" aria-pressed="${inst.size === z}">${esc(inst.item.size[z].label)}</button>`).join('')}</div>
      ${inst.saved.size ? '' : '<p class="hint">Foreslått ut fra størrelsen på rommet.</p>'}</div>` : ''}
    ${canPlace ? `<div class="q"><span class="q-label">Plassering</span>
      <p class="hint">${pw ? `Står mot vegg ${pw.letter} på tegningen.` : isPlaced ? 'Står fritt i rommet på tegningen.' : 'Ikke satt ut ennå. Sett den ut på tegningen, så regner vi ut hvor stor den kan være.'}</p>
      <button class="btn ghost small" data-act="place" data-v="${k}">${isPlaced ? 'Flytt på tegningen' : 'Bestem hvor den skal stå'}</button></div>` : ''}
    <div class="q"><span class="q-label">Viktigst for denne</span><div class="chips">
      ${PRIOS.map(([id, name]) => `<button class="chip mini ${prio === id ? 'on' : ''}" data-act="iprio" data-v="${k}" data-p="${id}" aria-pressed="${prio === id}">${name}</button>`).join('')}</div></div>
    ${comfort && comfort.words.length ? `<div class="q"><span class="q-label">Søkeord for komfort</span><div class="chips">
      ${comfort.words.map((x) => `<button class="chip mini ${kw.includes(x) ? 'on' : ''}" data-act="kw" data-v="${k}" data-w="${esc(x)}" aria-pressed="${kw.includes(x)}">${esc(x)}</button>`).join('')}</div></div>` : ''}
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
        ? (inst.item.custom ? '' : `<button class="link" data-act="maxreset" data-v="${k}">Bruk anslaget, ${kr(defaultMax(inst, state))}</button>`)
        : `<button class="link" data-act="nomax" data-v="${k}">Ingen prisgrense</button>`}</div>
    </div>
    ${inst.item.custom ? '' : `<div class="new ${hint === 'finish' ? 'hot' : ''}">
      <p>${hint === 'finish' ? 'Du har nesten alt. Det kan lønne seg å kjøpe ny og bli ferdig.' : 'Finner du ingenting brukt?'}
      Ny koster fra ca. ${kr(inst.v.n)}${hint === 'fits' ? ', og det er innenfor maksprisen din' : ''}.</p>
      <a class="link" href="${esc(ikeaUrl(inst, state))}" target="_blank" rel="noopener">Se nye hos IKEA</a>
    </div>`}
    <div class="done">
      <div class="field"><label for="paid-${k}">Fant du en? Skriv prisen</label><input id="paid-${k}" inputmode="numeric" placeholder="kr"></div>
      <button class="btn small" data-act="bought" data-v="${k}">Merk som kjøpt</button>
      <button class="link" data-act="status" data-v="${k}" data-st="${!inst.item.custom && ROOMS[inst.room.type].ess.includes(inst.itemId) ? 'have' : 'off'}">Ta bort fra lista</button>
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
    <h2>Pynt lagt ut i dag</h2>
    <div class="chips">${decorLinks(state, 'today').map((d) => `<a class="chip mini" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.label)}</a>`).join('')}</div>
    <button class="btn ghost small" data-act="round">Tilbake til lista</button>
  </section>`;
}

function viewList() {
  const all = instances(state);
  const sum = summary(state);
  const need = all.filter((i) => i.st === 'need');
  if (ui.round) return `<h1>Finn tingene</h1>${viewRound(need)}`;
  const style = STYLES.find((s) => s.id === state.style);
  const rooms = state.rooms.map((room) => ({ room, mine: all.filter((i) => i.room.id === room.id && (i.st === 'need' || i.st === 'bought')) })).filter((x) => x.mine.length);
  return `
  <h1>Finn tingene</h1>
  <p class="lead">${sum.need === 0 ? 'Ingenting igjen å finne.' : `${sum.need} ting å finne.`}${sum.bought ? ` ${sum.bought} er kjøpt.` : ''} Trykk på en ting for å søke på Finn.
    <button class="link" data-act="step" data-v="2">Endre hva som er med</button></p>
  ${style
    ? `<div class="mystyle"><img src="${Number.isInteger(state.sub) ? photo(style.id, state.sub + 1) : photo(style.id, 1, true)}" alt="" width="480" height="360"><p><strong>${style.name}</strong>${subName() ? `<br>${esc(subName())}` : ''}<br><button class="link" data-act="step" data-v="1">Bytt stil</button></p></div>`
    : `<p class="hint">Du har ikke valgt stil ennå. <button class="link" data-act="step" data-v="1">Velg stil</button></p>`}
  ${budgetPanel(sum)}
  ${need.length ? `<button class="btn wide" data-act="round">Dagens runde: se hva som er nytt på Finn</button>` : ''}
  ${rooms.length ? '' : `<section class="panel"><p>Lista er tom. Gå til «Ting» og huk av det du vil ha.</p><button class="btn small" data-act="step" data-v="2">Velg ting</button></section>`}
  ${rooms.map(({ room, mine }) => `<section class="roomlist">
      <h2>${esc(roomLabel(state.rooms, room))}<small>${roomM2(room)} m²${state.floors.length > 1 && room.poly ? `, ${esc(state.floors[room.floor || 0])}` : ''}</small></h2>
      <ul class="items">${mine.map((i) => itemRow(i, sum)).join('')}</ul>
    </section>`).join('')}
  <section class="roomlist decor">
    <h2>Pynt som passer stilen</h2>
    <p>Bilder, veggpynt og småting${style && style.id !== 'fri' ? ` i stilen ${style.name.toLowerCase()}` : ''}. Verdt en titt når du likevel er inne på Finn.</p>
    <div class="chips">${decorLinks(state).map((d) => `<a class="chip mini" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.label)}</a>`).join('')}</div>
  </section>
  <section class="panel">
    <h2>Ta med deg lista</h2>
    <p>Lista lagres bare i denne nettleseren.${canShare ? ' Med en lenke kan du åpne den på en annen enhet eller sende den til noen.' : ''}</p>
    <div class="row">${canShare ? '<button class="btn ghost small" data-act="share">Kopier lenke til lista</button>' : ''}${ui.sure
      ? `<span class="sure">Slette hele lista?</span><button class="btn small" data-act="reset">Ja, slett</button><button class="link" data-act="unsure">Avbryt</button>`
      : `<button class="link danger" data-act="sure">Start på nytt</button>`}</div>
    ${ui.copied ? `<div class="field"><label for="sharelink">${ui.copied === 'ok' ? 'Lenken er kopiert' : 'Kopier lenken herfra'}</label><input id="sharelink" readonly value="${esc(shareUrl())}"></div>` : ''}
  </section>`;
}

function footerNav() {
  if (state.step === LAST) return '';
  const next = state.step === LAST - 1 ? 'Finn tingene' : `Neste: ${STEPS[state.step + 1].toLowerCase()}`;
  return `<div class="nav">
    ${state.step > 0 ? `<button class="btn ghost" data-act="step" data-v="${state.step - 1}">Tilbake</button>` : '<span></span>'}
    <button class="btn" data-act="step" data-v="${state.step + 1}">${next}</button>
  </div>`;
}

function shareUrl() {
  return `${location.origin}${location.pathname}#l=${encodeState({ ...state, step: LAST })}`;
}

// «Plasser» trenger en tegning. Finnes det ingen, lages den av rommene fra «Velg bolig».
function ensureDrawing() {
  if (!state.drawn && state.rooms.length) { state.rooms = withDrawing(state.rooms); state.drawn = true; }
  ui.sheet = sheetFor(state, ui.sheet);
  if (!state.rooms.some((r) => r.poly && (r.floor || 0) === ui.floor)) ui.floor = 0;
}

function render() {
  const active = document.activeElement;
  const fid = active && active !== document.body ? active.id : '';
  const sig = (el) => ['act', 'v', 'q', 'i', 'w', 'st'].map((k) => el.dataset[k] ?? '').join('|');
  const fsig = !fid && active?.dataset?.act ? sig(active) : '';
  const views = [viewHome, viewStyle, viewThings, viewPlace, viewList];
  ui.furnish = state.step === 3; // på «Plasser» kan bare møbler flyttes
  if (ui.furnish) ui.tool = 'move';
  app.innerHTML = `${header()}<main>${sharedBanner()}${views[state.step]()}</main>${footerNav()}
    <footer class="foot"><p>Brukthjem er et uavhengig hjelpemiddel og er ikke tilknyttet FINN.no eller IKEA. Prisene er anslag fra november 2026. ${ai.ready ? 'Lista lagres bare i nettleseren din. Tekst og bilder sendes til Claude bare når du ber om det.' : 'Ingenting sendes fra nettleseren din.'}</p></footer>`;
  if (fid) document.getElementById(fid)?.focus({ preventScroll: true });
  else if (fsig) [...app.querySelectorAll('[data-act]')].find((el) => sig(el) === fsig)?.focus({ preventScroll: true });
}
let queued = false;
function later() {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; if (!isDragging()) render(); }, 0);
}
function commit() { save(); later(); }
function setItem(key, patch) { state.items[key] = { ...state.items[key], ...patch }; commit(); }
const instByKey = (key) => instances(state).find((i) => i.key === key);
// Tar bort haken på det brukeren har fra før, og setter hake på det de sier de mangler.
function applyOwned(have, need) {
  const all = instances(state);
  for (const id of have) for (const i of all.filter((x) => x.itemId === id && x.st === 'need')) state.items[i.key] = { ...state.items[i.key], st: ROOMS[i.room.type].ess.includes(id) ? 'have' : 'off' };
  for (const id of need) {
    if (all.some((x) => x.itemId === id && x.st === 'need')) continue;
    const i = all.find((x) => x.itemId === id);
    if (i) state.items[i.key] = { ...state.items[i.key], st: 'need' };
  }
  const names = (list) => list.filter((id) => all.some((x) => x.itemId === id)).map((id) => ITEMS[id].name.toLowerCase()).join(', ');
  return [names(have) ? `Tok bort haken på ${names(have)}.` : '', names(need) ? `La til ${names(need)}.` : ''].filter(Boolean).join(' ');
}

// ---------- Hendelser ----------

const actions = {
  async read() {
    const el = document.getElementById('life');
    if (!el || ui.busy) return;
    changes.life(el); // ordlistene først, så det alltid kommer noe
    const rules = parseOwned(state.lifeText);
    const said = applyOwned(rules.have, rules.need);
    ui.msg = state.lifeText.trim() ? { where: 'life', text: said || 'Lest. Vi fant ingen ting å huke av eller ta bort.' } : null;
    if (!ai.ready || !state.lifeText.trim()) { commit(); return; }
    ui.busy = 'life'; commit();
    try {
      const r = await readLife(state.lifeText);
      state.life = [...new Set([...state.life, ...r.life])];
      state.autoWish = r.wishes;
      const more = applyOwned(r.have, r.need);
      ui.msg = { where: 'life', text: [said, more].filter(Boolean).join(' ') || 'Lest. Vi fant ingen ting å huke av eller ta bort.' };
    } catch (e) {
      if (e.message) ui.msg = { where: 'life', bad: true, text: `${e.message} Vi brukte de enkle reglene i stedet.${said ? ` ${said}` : ''}` };
    }
    ui.busy = ''; commit();
  },
  step(v) {
    state.step = Math.min(LAST, Math.max(0, Number(v) || 0));
    ui.round = false; ui.room = null; ui.furn = null; ui.style = null; ui.open = null; ui.note = ''; ui.info = '';
    if (state.step === 3) ensureDrawing();
    commit(); window.scrollTo(0, 0);
  },
  write() { ui.write = !ui.write; later(); },
  home(v) { const rooms = roomsFromHome(v); state.items = pruneItems(state.items, state.rooms, rooms); state.custom = state.custom.filter((c) => rooms.some((r) => r.id === c.room)); state.home = v; state.rooms = rooms; state.drawn = false; state.furn = []; state.floors = ['1. etasje']; ui.room = null; ui.furn = null; ui.floor = 0; ui.msg = null; commit(); },
  undo() {
    const json = undoStack.pop();
    const prev = json && normalize(JSON.parse(json));
    if (!prev) return;
    prev.step = state.step;
    state = prev; lastJson = json;
    if (!state.rooms.some((r) => r.id === ui.room)) ui.room = null;
    if (!state.furn.some((f) => f.id === ui.furn)) ui.furn = null;
    ui.floor = Math.min(ui.floor, state.floors.length - 1); ui.note = '';
    persist(); later();
  },
  tab(v) { ui.tab = v === 'draw' ? 'draw' : 'pick'; ui.room = null; ui.furn = null; ui.note = ''; later(); },
  room(v) { ui.room = ui.room === v ? null : v; ui.furn = null; later(); },
  size(v) { const r = state.rooms.find((x) => x.id === ui.room); if (r) { r.size = v; r.m2 = null; commit(); } },
  delroom() { state.rooms = state.rooms.filter((r) => r.id !== ui.room); state.furn = state.furn.filter((f) => f.room !== ui.room); state.drawn = state.rooms.some((r) => r.poly); state.custom = state.custom.filter((c) => c.room !== ui.room); ui.room = null; commit(); },
  style(v, el) { state.style = v; state.sub = el?.dataset.i !== undefined ? Number(el.dataset.i) : null; ui.style = null; commit(); window.scrollTo(0, 0); },
  styleopen(v) { ui.style = v || null; later(); window.scrollTo(0, 0); },
  dropWish(v) { delete state.autoWish[v]; commit(); },
  level(v) { state.level = v; commit(); },
  fit() { state.items = fitBudget(state); commit(); },
  round() { ui.round = !ui.round; later(); window.scrollTo(0, 0); },
  open(v) { ui.open = ui.open === v ? null : v; later(); },
  // Haken betyr «vil ha». Uten hake er tingen ikke med: det vanlige blir stående grået ut, ekstra ting går tilbake til forslagene.
  want(v) {
    const i = instByKey(v);
    if (!i) return;
    if (i.st === 'have') setItem(v, { st: 'need' });
    else if (i.item.custom) actions.status(v, { dataset: { st: 'off' } });
    else setItem(v, { st: ROOMS[i.room.type].ess.includes(i.itemId) ? 'have' : 'off' });
  },
  noneon() {
    for (const i of instances(state)) if (i.st === 'need' && !i.item.custom) state.items[i.key] = { ...state.items[i.key], st: ROOMS[i.room.type].ess.includes(i.itemId) ? 'have' : 'off' };
    ui.open = null; commit();
  },
  usualon() {
    for (const i of instances(state)) if (i.st === 'have' && ROOMS[i.room.type].ess.includes(i.itemId)) state.items[i.key] = { ...state.items[i.key], st: 'need' };
    commit();
  },
  status(v, el) {
    const [rid, id] = v.split(':');
    if (el.dataset.st === 'off') ui.open = null;
    if (el.dataset.st === 'off' && state.custom.some((c) => c.id === id && c.room === rid)) {
      state.custom = state.custom.filter((c) => !(c.id === id && c.room === rid));
      delete state.items[v];
      commit();
    } else setItem(v, { st: el.dataset.st });
  },
  own(v) {
    const el = document.getElementById(`own-${v}`);
    const name = (el?.value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!name || !state.rooms.some((r) => r.id === v) || state.custom.length >= 40) return;
    const id = 'c' + (state.seq = (state.seq || 100) + 1);
    state.custom = [...state.custom, { id, room: v, name: name[0].toUpperCase() + name.slice(1) }];
    ui.open = `${v}:${id}`;
    commit();
  },
  kw(v, el) { const i = instByKey(v); const w = el.dataset.w; const kw = kwOf(i, state); setItem(v, { kw: kw.includes(w) ? kw.filter((x) => x !== w) : [...kw, w] }); },
  qty(v, el) { const i = instByKey(v); if (i) setItem(v, { qty: Math.min(12, Math.max(1, i.qty + Number(el.dataset.d))) }); },
  isize(v, el) { const i = instByKey(v); if (!i) return; const it = { ...state.items[v] }; if (i.saved.size === el.dataset.s) delete it.size; else it.size = el.dataset.s; state.items[v] = it; commit(); },
  iprio(v, el) { const i = instByKey(v); if (!i) return; const it = { ...state.items[v] }; if (i.saved.prio === el.dataset.p) delete it.prio; else it.prio = el.dataset.p; state.items[v] = it; commit(); },
  prio(v) { state.prio = state.prio === v ? null : v; commit(); },
  usepreset() { if (!state.drawn) { state.rooms = withDrawing(state.rooms); state.drawn = true; ui.sheet = sheetFor(state, ui.sheet); commit(); } },
  // Fra «Finn» og rett til «Plasser», med møbelet satt ut og valgt.
  place(v) {
    const i = instByKey(v);
    if (!i) return;
    state.step = 3; ui.open = null; ui.round = false; ui.furn = null; ui.note = ''; ui.info = '';
    ensureDrawing();
    const room = state.rooms.find((r) => r.id === i.room.id);
    if (!room?.poly) { ui.room = null; ui.note = `${roomLabel(state.rooms, i.room)} er ikke tegnet ennå. Tegn rommet under «Bolig», så kan du sette ut møbler i det.`; commit(); window.scrollTo(0, 0); return; }
    ui.tool = 'move'; ui.floor = room.floor || 0; ui.room = room.id;
    actions.addfurn(i.itemId);
    commit(); window.scrollTo(0, 0);
  },
  pick(v, el) { const i = instByKey(v); const picks = { ...(i.saved.picks || {}) }; const n = Number(el.dataset.i); if (picks[el.dataset.q] === n) delete picks[el.dataset.q]; else picks[el.dataset.q] = n; setItem(v, { picks }); },
  nomax(v) { setItem(v, { max: null }); },
  maxreset(v) { const it = { ...state.items[v] }; delete it.max; state.items[v] = it; commit(); },
  bought(v) { setItem(v, { st: 'bought', paid: num(document.getElementById(`paid-${v}`)?.value) }); ui.open = null; },
  seen(v) { setItem(v, { seen: today() }); },
  async share() {
    try { await navigator.clipboard.writeText(shareUrl()); ui.copied = 'ok'; } catch { ui.copied = 'manual'; }
    later();
  },
  sure() { ui.sure = true; later(); },
  unsure() { ui.sure = false; later(); },
  reset() { state = newState(); ui.open = ui.room = null; ui.sure = false; ui.copied = ''; ui.tab = 'pick'; ui.floor = 0; ui.furn = null; ui.info = ''; ui.write = false; commit(); window.scrollTo(0, 0); },
  useShared() { state = ui.shared; ui.tab = state.drawn ? 'draw' : 'pick'; ui.shared = null; history.replaceState(null, '', location.pathname); commit(); },
  dropShared() { ui.shared = null; history.replaceState(null, '', location.pathname); later(); },
};

async function loadPlan(file) {
  if (!file || ui.busy) return;
  ui.busy = 'plan'; ui.msg = null; later();
  try {
    const r = await readPlan(file);
    state.rooms = r.rooms.map((x) => {
      const id = 'r' + (state.seq = (state.seq || 100) + 1);
      return { id, type: x.type, size: x.m2 ? sizeFromM2(x.type, x.m2) : 'M', m2: x.m2, wall: null };
    });
    state.home = ''; state.custom = []; state.drawn = false; state.furn = []; state.floors = ['1. etasje']; ui.floor = 0; ui.furn = null; ui.room = null;
    ui.msg = { where: 'plan', text: `Fant ${r.rooms.length} rom. Tallene er lest eller anslått fra tegningen, så se over dem. ${r.note}`.trim() };
  } catch (e) {
    if (e.message) ui.msg = { where: 'plan', bad: true, text: e.message };
  }
  ui.busy = ''; commit();
}

const changes = {
  planfile(el) { loadPlan(el.files?.[0]); },
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
    state.life = p.life; // følger teksten, siden det ikke lenger finnes egne knapper for dette
    state.autoWish = p.wishes;
  },
  total(el) { state.total = num(el.value); },
  wish(el) { state.items[el.dataset.v] = { ...state.items[el.dataset.v], wish: el.value.slice(0, 300) }; },
  max(el) { state.items[el.dataset.v] = { ...state.items[el.dataset.v], max: num(el.value) }; },
  maxw(el) { const it = { ...state.items[el.dataset.v] }; const n = num(el.value); if (n && n <= 600) it.maxw = n; else delete it.maxw; state.items[el.dataset.v] = it; },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.tagName !== 'A') e.preventDefault();
  actions[el.dataset.act]?.(el.dataset.v, el);
});
const editorCtx = { state: () => state, ui, save, render, later, commit };
const ed = editorActions(editorCtx);
Object.assign(actions, ed.actions);
Object.assign(changes, ed.changes);
bindEditor(app, editorCtx);

app.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.dataset?.enter) return;
  e.preventDefault();
  actions[e.target.dataset.enter]?.(e.target.dataset.v, e.target);
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
if (state.step === 3) ensureDrawing();
lastJson = snapshot();
render();
initAI().then((ok) => { if (ok) later(); });
