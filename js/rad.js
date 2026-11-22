// Råd om nytt og brukt, og triks per stil. Ren logikk: dataene fra js/nytt.js og js/triks.js sendes inn,
// så de kan lastes først når de trengs.

export const VERDICTS = { brukt: 'Kjøp brukt', begge: 'Brukt eller nytt', nytt: 'Kjøp nytt' };

// Noen varianter er egentlig en annen ting i rådene: sofa som sovesofa følger rådene for sovesofa.
const AS = { 'sofa:sove': 'sovesofa' };
export const adviceId = (inst) => AS[`${inst.itemId}:${inst.size}`] || inst.itemId;

// Dommen for en ting på lista: { id, label, why }, eller null for egne ting og ting uten råd.
export function verdictOf(nytt, inst) {
  const it = nytt?.items?.[adviceId(inst)];
  if (!it || inst.item?.custom) return null;
  return { id: it.verdict, label: VERDICTS[it.verdict], why: it.why };
}

// Nye produkter som passer stilen, i rekkefølgen de står i kilden (det mest aktuelle først).
//  - special: varianten er en egen type (hjørnesofa, køyeseng). Eksemplene gjelder vanlig utgave, så de vises ikke.
//  - off: ingen passer stilen, men tingen bør kjøpes ny uansett. Da vises de enkleste, merket som utenfor stilen.
export function newPicks(nytt, inst, styleId, n = 3) {
  const none = { list: [], off: false, special: false };
  const it = nytt?.items?.[adviceId(inst)];
  if (!it || inst.item?.custom) return none;
  if (inst.v?.name && adviceId(inst) === inst.itemId) return { ...none, special: true };
  const style = styleId || 'fri';
  const fit = it.new.filter((p) => p.fits.includes(style));
  if (fit.length) return { ...none, list: fit.slice(0, n) };
  if (it.verdict === 'nytt' && it.new.length) return { ...none, list: [...it.new].sort((a, b) => a.price - b.price).slice(0, 2), off: true };
  return none;
}

// Hvor godt nytt fra kjedene passer stilen, i vanlige ord.
const FIT_TEXT = [
  'Nesten ingenting nytt fra kjedene passer. Her er det brukt som lager stilen.',
  'Lite nytt fra kjedene passer. De store møblene bør være brukte.',
  'Noe nytt fra kjedene passer, men velg med omhu.',
  'Nytt fra kjedene passer stilen godt.',
];
export function styleAdvice(nytt, styleId) {
  const s = nytt?.styles?.[styleId];
  return s ? { ...s, fit: FIT_TEXT[s.newFit] } : null;
}

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
// «2026-11-22» → «22. november 2026»
export function dateText(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m && MONTHS[m[2] - 1] ? `${Number(m[3])}. ${MONTHS[m[2] - 1]} ${m[1]}` : '';
}

// ---------- Triks ----------

// Hybelen er stue, soverom og kjøkken i ett.
const ROOM_AS = { ettrom: ['stue', 'soverom', 'kjokken'] };
const roomTypes = (rooms) => new Set((rooms || []).flatMap((r) => ROOM_AS[r.type] || [r.type]));
const LEVEL = { lett: 0, middels: 1, krevende: 2 };

// Hvilken ting på lista et triks handler om: ordet for tingen står først i et ord i tittelen
// («Smal hylle bak sofaen» gjelder sofaen). Brukes bare til å sortere, så et bomtreff gjør liten skade.
function aboutItem(trick, need) {
  const title = trick.title.toLowerCase();
  for (const inst of need) {
    if (inst.item?.custom) continue;
    const word = inst.item.name.toLowerCase().split(' ')[0].replace(/[^a-zæøå]/g, '');
    if (word.length < 4) continue;
    if (new RegExp(`(^|[^a-zæøå])${word}`).test(title)) return inst;
  }
  return null;
}

// Triks for valgt stil og rommene i boligen.
//  - diy av: bare grep som ikke krever verktøy.
//  - diy på: gjør-det-selv-ideene først (de letteste øverst), så de andre.
// Innenfor hver gruppe kommer triks som gjelder noe på lista først, deretter de som er gode å starte med.
// need = tingene som står igjen på lista.
export function tricksFor(triks, state, need = []) {
  if (!triks) return [];
  const style = state.style || 'fri';
  const rooms = roomTypes(state.rooms);
  const start = new Set(triks.starters);
  return triks.tricks
    .filter((t) => t.styles.includes(style) && t.rooms.some((r) => rooms.has(r)) && (state.diy || !t.diy))
    .map((t, i) => {
      const inst = aboutItem(t, need);
      return { t, i, score: (inst ? 2 : 0) + (start.has(t.id) ? 1 : 0) };
    })
    .sort((a, b) => (!!b.t.diy - !!a.t.diy) || (b.score - a.score) || ((a.t.diy ? LEVEL[a.t.diy.level] : 0) - (b.t.diy ? LEVEL[b.t.diy.level] : 0)) || (a.i - b.i))
    .map(({ t }) => t);
}

// «200–900 kr», eller «ca. 300 kr» når det bare er én sum.
export function costText(cost, kr) {
  if (!Array.isArray(cost)) return '';
  const [lo, hi] = cost;
  if (!hi) return 'gratis';
  return lo === hi ? `ca. ${kr(hi)}` : `${lo.toLocaleString('nb-NO').replace(/\s/g, ' ')}–${kr(hi)}`;
}
