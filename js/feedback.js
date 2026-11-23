// Forslagskasse og feilmelding. Appen har ingen tjener, så ingenting sendes av seg selv:
// brukeren åpner enten en ferdig utfylt sak på GitHub, eller kopierer teksten og limer den inn et sted.
import { instances } from './logic.js';

export const VERSION = '2026-11-23c';
export const REPO = 'andersmathisen7-design/style-bolig';
// Skru på når repoet over er åpent og har «Issues» slått på. Til da vises bare «Kopier teksten»,
// slik at ingen sendes til en side som ikke finnes.
export const ISSUES = true;
export const MAX_TEXT = 1000;  // tegn per felt
export const MAX_URL = 6000;   // lengre lenker enn dette kan bli avvist

const KINDS = {
  forslag: { label: 'forslag', title: 'Forslag', q: 'Hva savner du?', open: 'Foreslå noe nytt', missing: 'Skriv hva du savner først.' },
  feil: { label: 'feil', title: 'Feil', q: 'Hva skjedde?', open: 'Meld en feil', missing: 'Skriv hva som skjedde først.' },
};
const CUT_NOTE = '\n\n[Teksten er kortet ned for å få plass i lenken.]';
const LIST_NOTE = 'Lista fikk ikke plass i lenken. Lim den inn fra «Kopier teksten».';

const clip = (s, n) => Array.from(String(s ?? '')).slice(0, n).join('');
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ---------- Ren tekstbygging (testet i test/feedback.test.mjs) ----------

// Det tekniske som legges ved en feilmelding: bare tall og valg, aldri det brukeren selv har skrevet.
export function contextOf(state, env = {}) {
  const all = instances(state);
  const steps = env.steps || [];
  return {
    version: VERSION,
    step: `${state.step + 1} av ${steps.length || '?'}${steps[state.step] ? ` (${steps[state.step]})` : ''}`,
    screen: env.width && env.height ? `${env.width} × ${env.height}` : 'ukjent',
    agent: clip(oneLine(env.userAgent) || 'ukjent', 200),
    rooms: state.rooms.length,
    drawn: state.rooms.filter((r) => r.poly).length,
    floors: (state.floors || []).length || 1,
    furn: (state.furn || []).length,
    things: all.filter((i) => i.st === 'need').length,
    bought: all.filter((i) => i.st === 'bought').length,
    own: (state.custom || []).length,
    style: state.style || 'ikke valgt',
  };
}

export function contextLines(c) {
  return [
    `Versjon: ${c.version}`,
    `Steg: ${c.step}`,
    `Skjerm: ${c.screen}`,
    `Nettleser: ${c.agent}`,
    `Tegning: ${c.drawn ? `ja, ${c.drawn} av ${c.rooms} rom er tegnet${c.floors > 1 ? `, ${c.floors} etasjer` : ''}` : `nei, ${c.rooms} rom fra «Velg bolig»`}`,
    `Møbler satt ut: ${c.furn}`,
    `Ting på lista: ${c.things}${c.bought ? `, ${c.bought} kjøpt` : ''}${c.own ? `, ${c.own} egne` : ''}`,
    `Stil: ${c.style}`,
  ];
}

// input: { kind, text, before, context: [linjer] | null, payload: tekst | null, payloadNote: bool }
// Gir tittel og tekst på norsk. Det samme brukes til GitHub-lenken og til «Kopier teksten».
export function buildReport(input) {
  const kind = KINDS[input.kind] ? input.kind : 'forslag';
  const k = KINDS[kind];
  const text = clip(String(input.text ?? '').trim(), MAX_TEXT);
  const before = kind === 'feil' ? clip(String(input.before ?? '').trim(), MAX_TEXT) : '';
  const head = clip(oneLine(text), 70);
  const title = head ? `${k.title}: ${head}${Array.from(oneLine(text)).length > 70 ? '…' : ''}` : k.title;
  const parts = [`## ${k.q}\n${text || '(tomt)'}`];
  if (before) parts.push(`## Hva gjorde jeg rett før?\n${before}`);
  if (kind === 'feil' && input.context?.length) parts.push(`## Teknisk\n${input.context.map((l) => `- ${l}`).join('\n')}`);
  if (kind === 'feil' && input.payload) parts.push(`## Lista mi\n\`\`\`\n${input.payload}\n\`\`\``);
  else if (kind === 'feil' && input.payloadNote) parts.push(`## Lista mi\n${LIST_NOTE}`);
  parts.push(`Sendt fra Brukthjem ${VERSION}.`);
  return { kind, label: k.label, title, body: parts.join('\n\n') };
}

export const plainText = (report) => `${report.title}\n\n${report.body}`;

function makeUrl(repo, r, body) {
  return `https://github.com/${repo}/issues/new?title=${encodeURIComponent(r.title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(r.label)}`;
}

// Lenke til en ferdig utfylt sak på GitHub. Blir den for lang, tas først lista ut, så kortes teksten.
// truncated: '' (alt med), 'liste' (lista tatt ut) eller 'tekst' (teksten kortet ned).
export function issueUrl(input, { repo = REPO, max = MAX_URL } = {}) {
  let r = buildReport(input);
  let url = makeUrl(repo, r, r.body);
  if (url.length <= max) return { url, truncated: '' };
  let truncated = 'tekst';
  if (input.payload) {
    r = buildReport({ ...input, payload: null, payloadNote: true });
    url = makeUrl(repo, r, r.body);
    if (url.length <= max) return { url, truncated: 'liste' };
    truncated = 'tekst';
  }
  const chars = Array.from(r.body); // tegn for tegn, så vi aldri deler et tegn i to
  let lo = 0, hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (makeUrl(repo, r, chars.slice(0, mid).join('') + CUT_NOTE).length <= max) lo = mid; else hi = mid - 1;
  }
  return { url: makeUrl(repo, r, chars.slice(0, lo).join('') + CUT_NOTE), truncated };
}

// ---------- Skjema ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Lever bare i minnet. Lukkes skjemaet uten at noe er sendt, står teksten der neste gang.
const fb = { open: null, text: { forslag: '', feil: '' }, before: '', ctx: true, list: false, err: '', done: '', manual: false, sent: false, focus: '', sel: null };

function inputOf(state, env) {
  const kind = fb.open;
  return {
    kind, text: fb.text[kind], before: fb.before,
    context: kind === 'feil' && fb.ctx ? contextLines(contextOf(state, env)) : null,
    payload: kind === 'feil' && fb.list && env.payload ? env.payload() : null,
  };
}

const TRUNC = {
  liste: 'Lista er for lang for lenken og blir ikke med til GitHub. Bruk «Kopier teksten» for å få med alt.',
  tekst: 'Teksten er for lang for lenken og blir kortet ned på GitHub. Bruk «Kopier teksten» for å få med alt.',
};

export function feedbackView(state, env = {}) {
  const opener = (kind) => `<button class="btn ghost small" id="fb-open-${kind}" data-fb="open" data-k="${kind}" aria-expanded="${fb.open === kind}" aria-controls="fb-form">${KINDS[kind].open}</button>`;
  return `
  <section class="fb" aria-labelledby="fb-h">
    <h2 id="fb-h">Forslag og feil</h2>
    <p class="hint">Savner du noe, eller er det noe som ikke virker? Si fra her.</p>
    <div class="row">${opener('forslag')}${opener('feil')}</div>
    ${fb.open ? form(state, env) : ''}
  </section>`;
}

function form(state, env) {
  const kind = fb.open, k = KINDS[kind];
  const input = inputOf(state, env);
  const link = issueUrl(input);
  const ctx = kind === 'feil' ? contextLines(contextOf(state, env)) : [];
  return `
  <div class="fb-form" id="fb-form">
    <div class="field"><label for="fb-text">${k.q}</label>
      <textarea id="fb-text" rows="4" maxlength="${MAX_TEXT}" data-fb-in="text" required aria-describedby="fb-err">${esc(fb.text[kind])}</textarea></div>
    ${kind === 'feil' ? `
    <div class="field"><label for="fb-before">Hva gjorde du rett før? (valgfritt)</label>
      <textarea id="fb-before" rows="3" maxlength="${MAX_TEXT}" data-fb-in="before">${esc(fb.before)}</textarea></div>
    <label class="fb-check" for="fb-ctx"><input type="checkbox" id="fb-ctx" data-fb-in="ctx" ${fb.ctx ? 'checked' : ''}> Legg ved teknisk informasjon</label>
    ${fb.ctx ? `<ul class="fb-ctx">${ctx.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="hint fb-sub">Ingen teknisk informasjon følger med.</p>'}
    <label class="fb-check" for="fb-list"><input type="checkbox" id="fb-list" data-fb-in="list" ${fb.list ? 'checked' : ''}> Legg ved lista mi</label>
    <p class="hint fb-sub">${fb.list ? 'Boligen, tingene og kommentarene dine følger med, pakket som en kode.' : 'Uten hake følger verken boligen, tingene eller kommentarene dine med.'}</p>` : ''}
    <p class="fb-err" id="fb-err" role="alert" ${fb.err ? '' : 'hidden'}>${esc(fb.err)}</p>
    <p class="hint">${ISSUES ? 'Ingenting sendes før du trykker på en av knappene. «Send på GitHub» krever en GitHub-konto.' : 'Ingenting sendes av seg selv. Kopier teksten og lim den inn der du gir beskjed.'}</p>
    <div class="row">
      ${ISSUES ? `<a class="btn" id="fb-go" data-fb="go" href="${esc(link.url)}" target="_blank" rel="noopener">Send på GitHub</a>` : ''}
      <button class="btn ${ISSUES ? 'ghost' : ''}" id="fb-copy" data-fb="copy">Kopier teksten</button>
      <button class="link" id="fb-close" data-fb="close">Lukk</button>
    </div>
    <p class="hint" id="fb-trunc" ${ISSUES && link.truncated ? '' : 'hidden'}>${TRUNC[link.truncated] || ''}</p>
    <p class="status" id="fb-done" role="status" ${fb.done ? '' : 'hidden'}>${esc(fb.done)}</p>
    ${fb.manual ? `<div class="field"><label for="fb-manual">Kopier teksten herfra</label>
      <textarea id="fb-manual" rows="7" readonly>${esc(plainText(buildReport(input)))}</textarea></div>` : ''}
  </div>`;
}

// Kalles etter hver opptegning: setter markøren der den skal stå, uten at siden hopper.
export function feedbackAfterRender(root) {
  if (fb.focus) {
    const el = root.querySelector(`#${fb.focus}`);
    fb.focus = '';
    if (el) {
      el.focus({ preventScroll: true });
      if (el.id === 'fb-manual') el.select();
      (el.closest('.field') || el).scrollIntoView({ block: 'nearest' }); // bare så mye at feltet synes
    }
  } else if (fb.sel && document.activeElement?.id === fb.sel.id) {
    try { document.activeElement.setSelectionRange(fb.sel.a, fb.sel.b); } catch { /* feltet støtter ikke markering */ }
  }
}

// ctx: { state: () => tilstand, later: () => tegn opp på nytt, env: () => { steps, width, height, userAgent, payload() } }
export function bindFeedback(root, ctx) {
  const current = () => inputOf(ctx.state(), ctx.env());
  const missing = () => {
    if (fb.text[fb.open].trim()) return false;
    fb.err = KINDS[fb.open].missing; fb.done = ''; fb.focus = 'fb-text';
    ctx.later();
    return true;
  };

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-fb]');
    if (!el) return;
    const act = el.dataset.fb;
    if (act !== 'go') e.preventDefault();
    if (act === 'open') {
      const kind = KINDS[el.dataset.k] ? el.dataset.k : 'forslag';
      if (fb.open === kind) { close(); return; }
      fb.open = kind; fb.err = ''; fb.done = ''; fb.manual = false; fb.focus = 'fb-text'; fb.sel = null;
      ctx.later();
    } else if (act === 'close') close();
    else if (act === 'go') {
      if (missing()) { e.preventDefault(); return; }
      el.href = issueUrl(current()).url; // alltid fersk, også om feltet nettopp ble endret
      fb.err = ''; fb.done = 'Åpnet GitHub i en ny fane.'; fb.sent = true;
      ctx.later();
    } else if (act === 'copy') {
      if (missing()) return;
      const text = plainText(buildReport(current()));
      const ok = () => { fb.err = ''; fb.manual = false; fb.done = 'Kopiert. Lim teksten inn der du vil sende den.'; fb.sent = true; ctx.later(); };
      const manual = () => { fb.err = ''; fb.manual = true; fb.done = 'Fikk ikke kopiert automatisk. Kopier teksten fra feltet under.'; fb.focus = 'fb-manual'; ctx.later(); };
      try { navigator.clipboard.writeText(text).then(ok, manual); } catch { manual(); }
    }
  });

  function close() {
    const opener = `fb-open-${fb.open}`;
    if (fb.sent) { fb.text[fb.open] = ''; if (fb.open === 'feil') fb.before = ''; } // sendt eller kopiert: ferdig med teksten
    fb.open = null; fb.err = ''; fb.done = ''; fb.manual = false; fb.sent = false; fb.sel = null; fb.focus = opener;
    ctx.later();
  }

  // Mens man skriver, tegnes ikke siden opp på nytt. Lenka og meldingene oppdateres direkte.
  root.addEventListener('input', (e) => {
    const el = e.target;
    const what = el.dataset?.fbIn;
    if (!what || !fb.open || el.type === 'checkbox') return;
    const value = clip(el.value, MAX_TEXT);
    if (what === 'text') fb.text[fb.open] = value; else if (what === 'before') fb.before = value;
    fb.sel = { id: el.id, a: el.selectionStart, b: el.selectionEnd };
    fb.err = ''; fb.done = ''; fb.sent = false;
    const link = issueUrl(current());
    const go = root.querySelector('#fb-go'), trunc = root.querySelector('#fb-trunc'), err = root.querySelector('#fb-err'), done = root.querySelector('#fb-done'), man = root.querySelector('#fb-manual');
    if (go) go.href = link.url;
    if (trunc) { trunc.hidden = !ISSUES || !link.truncated; trunc.textContent = TRUNC[link.truncated] || ''; }
    if (err) err.hidden = true;
    if (done) done.hidden = true;
    if (man) man.value = plainText(buildReport(current()));
  });
  root.addEventListener('change', (e) => {
    const el = e.target;
    const what = el.dataset?.fbIn;
    if (!fb.open || el.type !== 'checkbox' || (what !== 'ctx' && what !== 'list')) return;
    fb[what] = el.checked; fb.done = '';
    ctx.later();
  });
  root.addEventListener('select', (e) => { if (e.target.dataset?.fbIn && fb.sel?.id === e.target.id) fb.sel = { id: e.target.id, a: e.target.selectionStart, b: e.target.selectionEnd }; }, true);
}
