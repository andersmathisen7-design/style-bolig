import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, encodeState, decodeState } from '../js/logic.js';
import { VERSION, REPO, MAX_TEXT, MAX_URL, contextOf, contextLines, buildReport, plainText, issueUrl } from '../js/feedback.js';

const STEPS = ['Bolig', 'Stil', 'Ting', 'Plasser', 'Finn'];
const env = { steps: STEPS, width: 390, height: 844, userAgent: 'Mozilla/5.0 (iPhone)  Test' };
const parse = (url) => { const u = new URL(url); return { path: u.pathname, title: u.searchParams.get('title'), body: u.searchParams.get('body'), labels: u.searchParams.get('labels') }; };

test('repo og versjon er satt ett sted', () => {
  assert.equal(REPO, 'andersmathisen7-design/style-bolig');
  assert.match(VERSION, /^\d{4}-\d{2}-\d{2}[a-z]?$/);
});

// Telefonen kan holde på gammel kode. Alle filene hentes med versjonen i adressen, så en ny versjon alltid lastes.
test('index.html henter alle skriptene med samme versjon som appen', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  for (const f of readdirSync(new URL('../js/', import.meta.url)).filter((x) => x.endsWith('.js'))) {
    assert.equal(map[`./js/${f}`], `./js/${f}?v=${VERSION}`, f);
  }
  assert.ok(html.includes(`js/app.js?v=${VERSION}`));
  assert.ok(html.includes(`css/style.css?v=${VERSION}`));
});

test('forslag: tittel, tekst og merkelapp', () => {
  const r = buildReport({ kind: 'forslag', text: '  Jeg savner et søk på hele Østlandet.  ' });
  assert.equal(r.label, 'forslag');
  assert.equal(r.title, 'Forslag: Jeg savner et søk på hele Østlandet.');
  assert.match(r.body, /^## Hva savner du\?\nJeg savner et søk på hele Østlandet\./);
  assert.ok(r.body.endsWith(`Sendt fra Brukthjem ${VERSION}.`));
  assert.ok(!r.body.includes('Teknisk'));
});

test('feil: begge feltene og merkelapp', () => {
  const r = buildReport({ kind: 'feil', text: 'Sofaen forsvant', before: 'Snudde den 90 grader', context: ['Steg: 4 av 5 (Plasser)'] });
  assert.equal(r.label, 'feil');
  assert.equal(r.title, 'Feil: Sofaen forsvant');
  assert.match(r.body, /## Hva skjedde\?\nSofaen forsvant/);
  assert.match(r.body, /## Hva gjorde jeg rett før\?\nSnudde den 90 grader/);
  assert.match(r.body, /## Teknisk\n- Steg: 4 av 5 \(Plasser\)/);
});

test('det valgfrie feltet tas ikke med når det er tomt', () => {
  const r = buildReport({ kind: 'feil', text: 'Noe gikk galt', before: '   ' });
  assert.ok(!r.body.includes('rett før'));
});

test('forslag får aldri teknisk informasjon eller lista, selv om de sendes inn', () => {
  const r = buildReport({ kind: 'forslag', text: 'Flere stiler', before: 'skal ikke med', context: ['Steg: 1'], payload: 'HEMMELIG' });
  assert.ok(!r.body.includes('Teknisk'));
  assert.ok(!r.body.includes('HEMMELIG'));
  assert.ok(!r.body.includes('skal ikke med'));
});

test('ukjent type regnes som forslag', () => {
  assert.equal(buildReport({ kind: 'annet', text: 'x' }).label, 'forslag');
});

test('tittelen er én linje og kortes ned', () => {
  const r = buildReport({ kind: 'feil', text: `Første linje\nandre linje ${'å'.repeat(100)}` });
  assert.ok(!r.title.includes('\n'));
  assert.ok(r.title.startsWith('Feil: Første linje andre linje'));
  assert.ok(r.title.endsWith('…'));
  assert.equal(Array.from(r.title).length, 'Feil: '.length + 70 + 1);
});

test('hvert felt kortes til 1000 tegn', () => {
  const r = buildReport({ kind: 'feil', text: 'a'.repeat(1500), before: 'b'.repeat(1500) });
  assert.equal(r.body.match(/a+/g).sort((x, y) => y.length - x.length)[0].length, MAX_TEXT);
  assert.equal(r.body.match(/b+/g).sort((x, y) => y.length - x.length)[0].length, MAX_TEXT);
});

test('lenken: norske tegn og spesialtegn kodes og kommer hele tilbake', () => {
  const text = 'Kjøkkenbenk på 2,4 m & «æøå ÆØÅ» #1 100 % + a=b? <b>fet</b> "sitat" 😀\nny linje';
  const { url, truncated } = issueUrl({ kind: 'forslag', text });
  assert.equal(truncated, '');
  assert.ok(url.startsWith(`https://github.com/${REPO}/issues/new?title=`));
  assert.ok(!/[\s<>"«»æøåÆØÅ#]/.test(url.slice(url.indexOf('?'))), 'ingen rå spesialtegn i lenken');
  assert.ok(url.includes('%C3%B8'), 'ø er kodet som UTF-8');
  const p = parse(url);
  assert.equal(p.path, `/${REPO}/issues/new`);
  assert.equal(p.labels, 'forslag');
  assert.equal(p.body, buildReport({ kind: 'forslag', text }).body);
  assert.ok(p.body.includes(text));
  assert.ok(p.title.startsWith('Forslag: Kjøkkenbenk på 2,4 m & «æøå ÆØÅ» #1 100 % + a=b?'));
});

test('lenken: merkelapp følger typen', () => {
  assert.equal(parse(issueUrl({ kind: 'forslag', text: 'x' }).url).labels, 'forslag');
  assert.equal(parse(issueUrl({ kind: 'feil', text: 'x' }).url).labels, 'feil');
});

test('lenken: for lang tekst kortes ned med en merknad, og holder seg under grensa', () => {
  const input = { kind: 'feil', text: 'ø'.repeat(1000), before: '😀'.repeat(1000), context: ['Steg: 1 av 5 (Bolig)'] };
  const { url, truncated } = issueUrl(input);
  assert.equal(truncated, 'tekst');
  assert.ok(url.length <= MAX_URL, `lenken er ${url.length} tegn`);
  assert.ok(url.length > MAX_URL - 40, 'bruker plassen som finnes');
  const p = parse(url); // kaster hvis et tegn er delt i to
  assert.ok(p.body.endsWith('[Teksten er kortet ned for å få plass i lenken.]'));
  assert.ok(p.body.startsWith('## Hva skjedde?\nøøø'));
  assert.equal(p.labels, 'feil');
  assert.doesNotThrow(() => decodeURIComponent(url.slice(url.indexOf('?') + 1)));
});

test('lenken: egen grense kan settes', () => {
  const { url, truncated } = issueUrl({ kind: 'forslag', text: 'x'.repeat(900) }, { max: 400 });
  assert.equal(truncated, 'tekst');
  assert.ok(url.length <= 400);
});

test('lenken: lista tas ut før teksten kortes, og det sies fra', () => {
  const payload = 'A'.repeat(7000);
  const input = { kind: 'feil', text: 'Lista ble tom', context: ['Steg: 5 av 5 (Finn)'], payload };
  const { url, truncated } = issueUrl(input);
  assert.equal(truncated, 'liste');
  assert.ok(url.length <= MAX_URL);
  const p = parse(url);
  assert.ok(!p.body.includes('AAAA'));
  assert.ok(p.body.includes('Lista fikk ikke plass i lenken'));
  assert.ok(p.body.includes('Lista ble tom'));
  assert.ok(plainText(buildReport(input)).includes(payload), 'kopiert tekst har med hele lista');
});

test('lenken: en kort liste følger med hel', () => {
  const { url, truncated } = issueUrl({ kind: 'feil', text: 'x', payload: 'abc-_123' });
  assert.equal(truncated, '');
  assert.match(parse(url).body, /## Lista mi\n```\nabc-_123\n```/);
});

test('teknisk informasjon: steg, skjerm, nettleser og antall', () => {
  const s = newState();
  s.step = 2;
  const c = contextOf(s, env);
  assert.equal(c.version, VERSION);
  assert.equal(c.step, '3 av 5 (Ting)');
  assert.equal(c.screen, '390 × 844');
  assert.equal(c.agent, 'Mozilla/5.0 (iPhone) Test');
  assert.equal(c.rooms, s.rooms.length);
  assert.equal(c.drawn, 0);
  assert.equal(c.furn, 0);
  assert.ok(c.things > 0);
  const lines = contextLines(c);
  assert.ok(lines.includes('Steg: 3 av 5 (Ting)'));
  assert.ok(lines.some((l) => l.startsWith('Tegning: nei')));
  assert.ok(lines.some((l) => l === `Ting på lista: ${c.things}`));
});

test('teknisk informasjon: tegning og møbler telles', () => {
  const s = newState();
  s.rooms[0].poly = [[0, 0], [400, 0], [400, 300], [0, 300]];
  s.furn = [{ id: 'f1', room: s.rooms[0].id, item: 'sofa' }, { id: 'f2', room: s.rooms[0].id, item: 'sofa' }];
  s.floors = ['1. etasje', '2. etasje'];
  const c = contextOf(s, env);
  assert.equal(c.drawn, 1);
  assert.equal(c.furn, 2);
  assert.ok(contextLines(c).some((l) => l.startsWith('Tegning: ja, 1 av') && l.endsWith('2 etasjer')));
  assert.ok(contextLines(c).includes('Møbler satt ut: 2'));
});

test('teknisk informasjon inneholder aldri det brukeren har skrevet', () => {
  const s = newState();
  const secret = 'HEMMELIGKOMMENTAR';
  const key = `${s.rooms[0].id}:sofa`;
  s.items[key] = { st: 'need', cmt: secret, note: secret };
  s.custom = [{ id: 'c101', room: s.rooms[0].id, name: secret }];
  s.lifeText = secret; s.wish = secret; s.note = secret; s.area = secret;
  const lines = contextLines(contextOf(s, { ...env, userAgent: 'UA' }));
  const r = buildReport({ kind: 'feil', text: 'Feil', context: lines, payload: null });
  assert.ok(!JSON.stringify(lines).includes(secret));
  assert.ok(!plainText(r).includes(secret));
  assert.ok(!decodeURIComponent(issueUrl({ kind: 'feil', text: 'Feil', context: lines }).url).includes(secret));
  assert.ok(lines.some((l) => /1 egne$/.test(l)), 'egne ting telles, men navnet er ikke med');
});

test('lista følger bare med når den legges ved, og kan da leses tilbake', () => {
  const s = newState();
  s.custom = [{ id: 'c101', room: s.rooms[0].id, name: 'Blå vase' }];
  const payload = encodeState(s);
  const without = buildReport({ kind: 'feil', text: 'Feil', context: contextLines(contextOf(s, env)) });
  assert.ok(!without.body.includes('Lista mi'));
  assert.ok(!without.body.includes(payload));
  const withList = buildReport({ kind: 'feil', text: 'Feil', payload });
  const m = withList.body.match(/## Lista mi\n```\n([\s\S]+?)\n```/);
  assert.ok(m);
  assert.equal(decodeState(m[1]).custom[0].name, 'Blå vase');
});

test('kopiert tekst har tittelen øverst', () => {
  const r = buildReport({ kind: 'forslag', text: 'Mørk modus' });
  assert.equal(plainText(r), `Forslag: Mørk modus\n\n${r.body}`);
});
