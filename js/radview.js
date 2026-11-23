// Råd på skjermen: dom per ting (brukt eller nytt), nye alternativer som passer stilen, stilens blanding av
// brukt og nytt, og triks. Dataene lastes først når et steg som viser dem åpnes.
import { kr, ikeaUrl, newHint, instances, wordUrl } from './logic.js';
import { verdictOf, newPicks, styleAdvice, tricksFor, dateText, costText } from './rad.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SHOWN = 4; // triks som vises før «Vis flere»

const data = { nytt: null, triks: null, loading: false, failed: false };
export const adviceData = data; // for tester

export function loadAdvice(ctx) {
  if (data.nytt || data.loading || data.failed) return;
  data.loading = true;
  Promise.all([import('./nytt.js'), import('./triks.js')])
    .then(([n, t]) => { data.nytt = n.default; data.triks = t.default; })
    .catch(() => { data.failed = true; }) // uten rådene virker lista som før
    .finally(() => { data.loading = false; ctx.later(); });
}

const link = (url, text, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;

// ---------- Per ting på lista ----------

export const buysNew = (inst) => inst.st === 'need' && verdictOf(data.nytt, inst)?.id === 'nytt';

// På den lukkede raden vises bare unntaket: ting som bør kjøpes nye.
export const rowVerdict = (inst) => (buysNew(inst) ? '<span class="item-buy">Kjøp nytt</span>' : '');

// Øverst i den åpne tingen: dommen og én setning om hvorfor.
export function verdictLine(inst) {
  const v = verdictOf(data.nytt, inst);
  return v ? `<p class="verdict v-${v.id}"><strong>${esc(v.label)}.</strong> ${esc(v.why)}</p>` : '';
}

// Hvor nye alternativer skal stå i den åpne tingen: øverst når tingen bør kjøpes ny, midt i når begge deler
// er like bra, og nederst når brukt er best.
export function newSlot(inst) {
  const v = verdictOf(data.nytt, inst);
  return v?.id === 'nytt' ? 'top' : v?.id === 'begge' ? 'mid' : 'end';
}

export function newBlock(inst, state, sum) {
  if (inst.item.custom) return '';
  const hint = newHint(inst, state, sum);
  const v = verdictOf(data.nytt, inst);
  const main = v?.id === 'nytt';
  const picks = newPicks(data.nytt, inst, state.style);
  const lead = hint === 'finish' ? 'Du har nesten alt. Det kan lønne seg å kjøpe ny og bli ferdig.' : main || v?.id === 'begge' ? '' : 'Finner du ingenting brukt?';
  const cls = `new${hint === 'finish' ? ' hot' : ''}${main ? ' main' : ''}`;
  if (!picks.list.length) {
    const missing = v && !picks.special ? '<p class="hint">Vi har ikke funnet noe nytt hos IKEA, JYSK eller Rusta som passer stilen din.</p>' : '';
    return `<div class="${cls}">
      <p>${lead} Ny koster fra ca. ${kr(inst.v.n)}${hint === 'fits' ? ', og det er innenfor maksprisen din' : ''}.</p>${missing}
      ${link(ikeaUrl(inst, state), 'Se nye hos IKEA', main ? 'btn small' : 'link')}
    </div>`;
  }
  const head = picks.off ? 'Enkelt og nytt' : state.style && state.style !== 'fri' ? 'Nytt som passer stilen din' : 'Nye alternativer';
  return `<div class="${cls}">
    ${lead ? `<p>${lead}</p>` : ''}
    <span class="q-label">${head}</span>
    ${picks.off ? '<p class="hint">Ingen av disse er laget for stilen din, men de gjør jobben og synes lite.</p>' : ''}
    <ul class="newlist">${picks.list.map((p) => `<li>${link(p.url, p.name)}<span class="newprice">${kr(p.price)}</span>
      <small>${esc(p.store)}${p.note ? `. ${esc(p.note)}` : ''}${p.unsure ? ' Prisen er ikke sjekket.' : ''}</small></li>`).join('')}</ul>
    <p class="hint">Priser sett ${dateText(data.nytt.asOf)}.</p>
    ${link(ikeaUrl(inst, state), 'Søk etter flere hos IKEA', 'link')}
  </div>`;
}

// Én setning øverst på lista når noe bør kjøpes nytt.
// Ting som bør kjøpes nye, er merket på hver rad. Lista trenger ingen egen setning om det.
export const listNote = () => '';

// ---------- Per stil ----------

export function styleAdviceBlock(state, styleId) {
  const a = styleAdvice(data.nytt, styleId);
  if (!a) return '';
  return `<section class="panel mix">
    <h2>Brukt og nytt i denne stilen</h2>
    <p class="mix-fit">${esc(a.fit)}</p>
    <dl class="mixlist">
      <dt>Finn brukt</dt><dd>${esc(a.used)}</dd>
      <dt>Greit nytt</dt><dd>${esc(a.new)}</dd>
      <dt>Unngå</dt><dd>${esc(a.avoid)}</dd>
    </dl>
    ${a.words.length ? `<span class="q-label">Ord å søke på hos Finn</span>
    <div class="chips">${a.words.map((w) => link(wordUrl(state, w, true), w, 'chip mini')).join('')}</div>` : ''}
  </section>`;
}

// ---------- Triks ----------

const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

function trickBody(t, state) {
  return `<div class="trick-body">
    <p>${esc(t.what)}</p>
    ${t.renterOk ? '' : '<p class="look">Leier du? Spør utleier først.</p>'}
    ${t.buy.length ? `<span class="q-label">Dette trenger du</span>
    <ul class="buylist">${t.buy.map((b) => `<li>${esc(b.what.replace(/\s*\(ca\.-pris\)/, ''))}<small>${esc(b.where)}${b.kr ? `, ca. ${kr(b.kr)}` : ''}</small></li>`).join('')}</ul>` : ''}
    ${t.diy ? `<span class="q-label">Slik gjør du det</span>
    ${t.diy.tools.length ? `<p class="hint">Verktøy: ${esc(t.diy.tools.join(', '))}.</p>` : ''}
    <ol class="howto">${t.diy.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${t.finn.length ? `<span class="q-label">Søk på Finn</span>
    <div class="chips">${t.finn.map((w) => link(wordUrl(state, w), w, 'chip mini')).join('')}</div>` : ''}
    ${t.trend || t.source ? `<p class="hint">${esc(t.trend || '')}${t.source && host(t.source.url) ? ` ${link(t.source.url, `Kilde: ${host(t.source.url)}`)}` : ''}</p>` : ''}
  </div>`;
}

export function tricksPanel(state, ui) {
  if (!data.triks) return '';
  const need = instances(state).filter((i) => i.st === 'need');
  const list = tricksFor(data.triks, state, need);
  const shown = ui.tricksAll ? list : list.slice(0, SHOWN);
  return `<section class="roomlist tricks">
    <h2>Triks</h2>
    <label class="ar-check" for="diy"><input type="checkbox" id="diy" data-ch="diy" ${state.diy ? 'checked' : ''}><span>Vis også ting jeg må fikse selv</span></label>
    ${list.length ? `<ul class="tricklist">${shown.map((t) => { const open = ui.trick === t.id; return `<li class="trick${open ? ' open' : ''}">
      <button class="trick-main" data-act="trick" data-v="${esc(t.id)}" aria-expanded="${open}">
        <span class="trick-title">${esc(t.title)}</span>
        <span class="trick-meta">${esc(costText(t.cost, kr))}${t.diy ? `, ${esc(t.diy.level)}, ${esc(t.diy.time)}` : ', uten verktøy'}</span>
      </button>
      ${open ? trickBody(t, state) : ''}</li>`; }).join('')}</ul>` : '<p class="hint">Ingen triks uten verktøy for denne stilen ennå.</p>'}
    ${list.length > SHOWN ? `<button class="link" data-act="moretricks">${ui.tricksAll ? 'Vis færre' : `Vis ${list.length - SHOWN} til`}</button>` : ''}
  </section>`;
}

export function adviceActions(ctx) {
  const { ui } = ctx;
  return {
    actions: {
      trick(v) { ui.trick = ui.trick === v ? null : v; ctx.later(); },
      moretricks() { ui.tricksAll = !ui.tricksAll; ctx.later(); },
    },
    changes: {
      diy(el) { ctx.state().diy = el.checked; ui.tricksAll = false; },
    },
  };
}
