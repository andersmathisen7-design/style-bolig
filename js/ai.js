// Valgfri AI. Finnes bare der siden vises inne i Claude (window.claude). Ellers er alt her avslått,
// og appen bruker ordlistene i logic.js. Hvert kall bruker av Claude-kvoten til den som ser på siden.
import { ROOMS, ITEMS, LIFE } from './data.js';
import { cleanWish } from './logic.js';

let sample = null;
export const ai = { ready: false, images: false, types: 'image/jpeg,image/png,image/webp' };

export async function initAI() {
  try {
    sample = (await window.claude?.use('sample')) || null;
    if (!sample) return false;
    ai.ready = true;
    const lim = await sample.limits().catch(() => null);
    if (lim?.images) { ai.images = true; ai.types = lim.images.mediaTypes.join(','); }
    return true;
  } catch { return false; }
}

const GONE = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];

// Gjør en feil om til en setning brukeren kan handle på. Slår av AI der den ikke kommer tilbake.
function fail(e, what) {
  const code = e?.code || 'upstream_error';
  if (GONE.includes(code)) { ai.ready = false; ai.images = false; return new Error('Claude er ikke tilgjengelig her. Du kan fortsatt sette opp alt selv.'); }
  if (code === 'images_unavailable') { ai.images = false; return new Error('Bilder kan ikke sendes herfra. Sett opp rommene selv.'); }
  if (code === 'image_rejected') return new Error('Bildet kunne ikke brukes. Prøv en JPG eller PNG.');
  if (code === 'rate_limited') return new Error('Claude har ikke kapasitet akkurat nå. Prøv igjen om litt.');
  if (code === 'session_expired') return new Error('Du er logget ut av Claude. Logg inn og prøv igjen.');
  if (code === 'cancelled') return new Error('');
  if (code === 'upstream_error') return new Error('Fikk ikke kontakt med Claude. Prøv igjen.');
  return new Error(`Claude klarte ikke å lese ${what}. Prøv igjen, eller gjør det selv.`);
}

const PLAN_PROMPT = `Du får et bilde av en plantegning for en bolig i Norge. Finn rommene og arealet på hvert rom.

Svar kun med JSON på denne formen:
{"rooms":[{"type":"stue","m2":21.5}],"note":""}

Regler:
- type må være en av: stue, kjokken, soverom, gang, bad, kontor, barnerom, balkong, ettrom.
- Bruk arealet som står skrevet i rommet. Står det bare mål (f.eks. 3,2 x 4,1), regn ut. Står det ingenting, anslå ut fra proporsjonene og eventuelt totalareal.
- Stue og kjøkken i åpen løsning: gi én "stue" og én "kjokken", og del arealet omtrent 65/35.
- Hybel der ett rom er både stue og soverom: bruk "ettrom".
- Entré og hall er "gang". WC og dusj er "bad". Terrasse og veranda er "balkong".
- Hopp over bod, vaskerom, trapp, garasje og tekniske rom.
- Flere soverom gir flere "soverom"-linjer, største først.
- "note": én kort setning på norsk hvis noe var uklart eller anslått, ellers tom streng.
- Er bildet ikke en plantegning: {"rooms":[],"note":"Dette ser ikke ut som en plantegning."}`;

// Leser en plantegning. Gir { rooms: [{type, m2}], note }.
export async function readPlan(file) {
  if (!sample || !ai.images) throw new Error('Claude er ikke tilgjengelig her.');
  let data;
  try { data = await sample.json(PLAN_PROMPT, { images: [file] }); } catch (e) { throw fail(e, 'tegningen'); }
  const rooms = (Array.isArray(data?.rooms) ? data.rooms : [])
    .filter((r) => r && ROOMS[r.type])
    .slice(0, 15)
    .map((r) => {
      const m2 = Math.round(Number(r.m2));
      return { type: r.type, m2: Number.isFinite(m2) && m2 >= 1 && m2 <= 200 ? m2 : null };
    });
  const note = typeof data?.note === 'string' ? data.note.slice(0, 200) : '';
  if (!rooms.length) throw new Error(note || 'Fant ingen rom i bildet. Prøv et tydeligere bilde.');
  return { rooms, note };
}

const lifePrompt = (text) => `En person beskriver hvordan de bor og hva de ønsker seg av møbler. Gjør teksten om til data for en innredningsliste.

Svar kun med JSON på denne formen:
{"life":["jobb"],"have":["sofa"],"need":["lenestol"],"wishes":{"spisebord":{"search":["eik"],"avoid":["rundt"],"notes":["firkantet","plass til 6"]}}}

life: velg bare blant disse, og bare når teksten tydelig sier det:
${LIFE.map((l) => `${l.id} = ${l.label}`).join('; ')}

have: ting personen sier de har fra før. need: ting personen sier de mangler eller vil ha.
wishes: ønsker for bestemte ting. Bruk bare disse id-ene for alle tre:
${Object.entries(ITEMS).map(([id, it]) => `${id} = ${it.name}`).join('; ')}

For hvert ønske:
- search: høyst 3 enkeltord som pleier å stå i bruktannonser og som personen VIL ha (materiale, farge, merke, eller type som «uttrekkbart»). Små bokstaver.
- avoid: det personen IKKE vil ha, som korte ord.
- notes: andre krav som må sjekkes i annonsen, som form («firkantet»), mål («maks 180 cm») eller antall plasser. Korte fraser.
Ta bare med det teksten faktisk sier. Tomme lister er greit.

Teksten:
"""
${text.slice(0, 2000)}
"""`;

// Leser fritekst om hverdagen. Gir { life, have, need, wishes }.
export async function readLife(text) {
  if (!sample) throw new Error('Claude er ikke tilgjengelig her.');
  let data;
  try { data = await sample.json(lifePrompt(text), { modelTier: 'quick' }); } catch (e) { throw fail(e, 'teksten'); }
  const ids = (v) => [...new Set((Array.isArray(v) ? v : []).filter((id) => typeof id === 'string' && ITEMS[id]))];
  const wishes = {};
  for (const [id, w] of Object.entries(data?.wishes && typeof data.wishes === 'object' ? data.wishes : {})) {
    const clean = ITEMS[id] ? cleanWish(w) : null;
    if (clean) wishes[id] = clean;
  }
  return {
    life: (Array.isArray(data?.life) ? data.life : []).filter((id) => LIFE.some((l) => l.id === id)),
    have: ids(data?.have), need: ids(data?.need), wishes,
  };
}
