// Alt innhold appen bygger på: fylker, stiler, rom, ting og priser.
// Prisene er anslag (november 2026): «u» = vanlig bruktpris, «n» = rimeligste nypris.

// Finn.no sine områdekoder (fylker). Sjekket mot finn.no november 2026.
export const AREAS = [
  { id: '', name: 'Hele Norge' },
  { id: '0.22042', name: 'Agder' },
  { id: '0.20003', name: 'Akershus' },
  { id: '0.20007', name: 'Buskerud' },
  { id: '0.20020', name: 'Finnmark' },
  { id: '0.22034', name: 'Innlandet' },
  { id: '0.20015', name: 'Møre og Romsdal' },
  { id: '0.20018', name: 'Nordland' },
  { id: '0.20061', name: 'Oslo' },
  { id: '0.20012', name: 'Rogaland' },
  { id: '0.20009', name: 'Telemark' },
  { id: '0.20019', name: 'Troms' },
  { id: '0.20016', name: 'Trøndelag' },
  { id: '0.20008', name: 'Vestfold' },
  { id: '0.22046', name: 'Vestland' },
  { id: '0.20002', name: 'Østfold' },
];

// kw = søkeord som pleier å stå i annonser, per type ting.
// photos: bildene ligger i photos/<id>-<n>.webp (og <id>-1s.webp som lite bilde). Hentet fra Unsplash.
export const STYLES = [
  {
    id: 'skandi', name: 'Skandinavisk', desc: 'Lyst treverk, hvitt og rolige farger.',
    colors: ['#F4F1EA', '#D9C7A8', '#9FB0A6', '#3C4A4B'],
    traits: ["Lyst tre som eik og bjørk", "Hvitt, grått og dempede farger", "Enkle former og lite pynt"],
    photos: [{"alt": "Lys stue med grå og hvite sofaer, rundt bord i lyst tre og vedovn mellom store vinduer", "by": "Clay Banks", "url": "https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-fire-place-UTWRDWMMaag"}, {"alt": "Lys sofa, rundt sofabord i tre og en flettet skinnstol", "by": "Erika Osberg", "url": "https://unsplash.com/photos/brown-wooden-round-table-near-white-couch-nLqdo69GFy4"}, {"alt": "Grå sofa med strikket puff og runde trebord på et lyst teppe", "by": "Minh Pham", "url": "https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-large-window-OtXADkUh3-I"}],
    decor: [["Plakater og bilder", "plakat ramme"], ["Vaser", "vase keramikk"], ["Lysestaker", "lysestake"], ["Speil", "speil eik"], ["Pledd", "pledd ull"]],
    kw: { wood: ['eik', 'hvit', 'bjørk'], soft: ['beige', 'grå', 'lys'], light: ['hvit', 'messing'], deco: ['ull', 'hvit'] },
  },
  {
    id: 'japandi', name: 'Japandi', desc: 'Lave møbler, eik og bambus, lite pynt.',
    colors: ['#EFE8DC', '#C9B79A', '#7C7A6B', '#2B2B28'],
    traits: ["Lave møbler", "Eik, bambus og mørke detaljer", "Få, utvalgte ting"],
    photos: [{"alt": "Lav grågrønn sofa, ovalt bord i mørkt tre og hvite vegger", "by": "Katja Rooke", "url": "https://unsplash.com/photos/gray-2-seat-sofa-near-brown-wooden-coffee-table-77JACslA8G0"}, {"alt": "Soverom med lav seng, spilevegg i mørkt tre og flettede lamper", "by": "Thufeil M", "url": "https://unsplash.com/photos/a-bedroom-with-a-large-bed-and-a-round-mirror-on-the-wall-OihXclRy8n0"}, {"alt": "Spisekrok i tre foran et stort vindu med en enkel pendellampe", "by": "Don Kaveen", "url": "https://unsplash.com/photos/brown-wooden-table-with-chairs-DsH3VOZanYA"}],
    decor: [["Keramikk", "keramikk vase"], ["Rislamper", "rislampe"], ["Kurver", "kurv flettet"], ["Bilder", "plakat ramme eik"], ["Skåler og fat", "keramikk fat"]],
    kw: { wood: ['eik', 'bambus', 'svart'], soft: ['beige', 'lin'], light: ['rispapir', 'bambus'], deco: ['jute', 'keramikk'] },
  },
  {
    id: 'retro', name: 'Retro og teak', desc: '50- og 60-tall, teak og tydelige farger.',
    colors: ['#E3B23C', '#B5651D', '#3F6C6A', '#3A2A20'],
    traits: ["Teak og palisander", "Skrå, smale ben", "Oransje, grønt og sennepsgult"],
    photos: [{"alt": "Grønn sofa, sofabord med skrå ben, buelampe og plakater på veggen", "by": "Spacejoy", "url": "https://unsplash.com/photos/a-living-room-with-a-green-couch-and-a-coffee-table-0JGRXomKXSw"}, {"alt": "Teakskjenk, nyreformet bord og lenestoler foran en murvegg", "by": "Phebe Tan", "url": "https://unsplash.com/photos/flat-screen-tv-turned-off-jqFpFBzz0Tg"}, {"alt": "Oransje sofa foran en grønn vegg med fargerike bilder", "by": "Spacejoy", "url": "https://unsplash.com/photos/orange-and-black-sofa-with-throw-pillows-q3Qd86sfaoU"}],
    decor: [["Plakater", "retro plakat"], ["Speil", "teak speil"], ["Keramikk", "keramikk retro"], ["Ryer og vegg-tepper", "rya"], ["Veggklokker", "veggklokke retro"], ["Lysestaker", "lysestake messing"]],
    kw: { wood: ['teak', 'retro', 'palisander'], soft: ['retro', 'ull', 'fløyel'], light: ['retro', 'messing'], deco: ['retro', 'rya'] },
  },
  {
    id: 'industri', name: 'Industriell', desc: 'Metall, mørkt tre, skinn og sort.',
    colors: ['#B9B4AA', '#7A5C3E', '#4A4F54', '#1E1F21'],
    traits: ["Metall og mørkt tre", "Skinn og grove flater", "Svart, grått og brunt"],
    photos: [{"alt": "Loft med svart skinnsofa, murvegger, synlige rør og hems i stål", "by": "Aaron Huber", "url": "https://unsplash.com/photos/industrial-loft-with-dining-area-s95oB2n9jng"}, {"alt": "Mørkegrønn sofa, rundt bord og TV-benk i mørkt tre ved en murvegg", "by": "ubeyonroad", "url": "https://unsplash.com/photos/modern-living-room-with-green-sofa-and-brick-wall-ojLOdyLG_as"}, {"alt": "Svart sofa foran en rød murvegg med tre store bilder", "by": "MAHZA D'BRATA", "url": "https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-brick-wall-G88ehihe6wQ"}],
    decor: [["Bilder", "plakat sort ramme"], ["Veggklokker", "veggklokke industriell"], ["Skilt", "emaljeskilt"], ["Lamper", "lampe industriell"], ["Hyller", "vegghylle metall"]],
    kw: { wood: ['industriell', 'metall', 'sort'], soft: ['skinn', 'grå'], light: ['industriell', 'metall'], deco: ['sort', 'metall'] },
  },
  {
    id: 'landlig', name: 'Landlig', desc: 'Furu, malte møbler og lune tekstiler.',
    colors: ['#F1EADB', '#C8B08A', '#8FA08A', '#6B4F3A'],
    traits: ["Furu og malte møbler", "Vedovn, bjelker og panel", "Lin, ull og ruter"],
    photos: [{"alt": "Stue med synlige takbjelker, steinvegg, vedovn og grå hjørnesofa", "by": "Clay Banks", "url": "https://unsplash.com/photos/cozy-living-room-with-lit-wood-stove-and-gray-sectional-rFpEHzGB37w"}, {"alt": "Hvitmalt panel, tretak, trapp og vedovn i en lys stue", "by": "Clay Banks", "url": "https://unsplash.com/photos/bright-living-room-with-fireplace-wood-ceiling-staircase-3bgpVpEZV6s"}, {"alt": "Grønn fløyelssofa, gammel trekiste som bord og mønstret teppe", "by": "Clay Banks", "url": "https://unsplash.com/photos/cozy-living-room-with-plush-sofa-and-wooden-chest-E0pZm6b2z7A"}],
    decor: [["Malerier", "maleri"], ["Veggtallerkener", "veggtallerken"], ["Broderte bilder", "brodert bilde"], ["Lysestaker", "lysestake messing"], ["Krukker", "krukke"]],
    kw: { wood: ['furu', 'landlig', 'antikk'], soft: ['landlig', 'beige'], light: ['landlig', 'messing'], deco: ['landlig', 'fillerye'] },
  },
  {
    id: 'boho', name: 'Boho', desc: 'Rotting, planter, mønstre og varme farger.',
    colors: ['#F0D9B5', '#C96F4A', '#7F9B76', '#5A3E36'],
    traits: ["Rotting, bambus og kurver", "Mange planter", "Mønstrede tepper og puter"],
    photos: [{"alt": "Grå sofa, flettede lamper, mange planter og et mønstret teppe", "by": "Spacejoy", "url": "https://unsplash.com/photos/living-room-with-grey-sofa-YqFz7UMm8qE"}, {"alt": "Lys stue med flettede kurver på veggen og et rødt mønstret teppe", "by": "Spacejoy", "url": "https://unsplash.com/photos/white-and-brown-living-room-set-85pCvDWDMmI"}, {"alt": "Blå sofa i en stue full av planter og hengende potter", "by": "Lydia Mailloux", "url": "https://unsplash.com/photos/blue-sofa-with-throw-pillows-Ex9TEVXTrPw"}],
    decor: [["Makramé", "makrame"], ["Kurver til vegg", "kurv vegg"], ["Puter", "kelim pute"], ["Speil", "rotting speil"], ["Plantehengere", "plantehenger"]],
    kw: { wood: ['rotting', 'bambus', 'kurv'], soft: ['fløyel', 'grønn'], light: ['rotting', 'bambus'], deco: ['kelim', 'rotting'] },
  },
  {
    id: 'varm', name: 'Varm minimalisme', desc: 'Få ting, myke former og jordfarger.',
    colors: ['#EEE3D3', '#CDB59A', '#A77E62', '#4B3B32'],
    traits: ["Myke, buede former", "Beige, krem og jordfarger", "Bouclé, ull og keramikk"],
    photos: [{"alt": "Beige hjørnesofa, to runde bord i lyst tre og runde lamper", "by": "Pipcke", "url": "https://unsplash.com/photos/a-living-room-with-a-couch-and-a-table-g_5UyVBIX_k"}, {"alt": "Kremhvit sofa, runde speil i rotting og et lyst teppe", "by": "Spacejoy", "url": "https://unsplash.com/photos/a-living-room-filled-with-furniture-and-a-mirror-c0JoR_-2x3E"}, {"alt": "Buet beige sofa foran en vegg i grov, varm puss", "by": "Ishan Sharma", "url": "https://unsplash.com/photos/modern-living-room-with-curved-sofa-and-decorative-wall-art-DjaSE8vgUXg"}],
    decor: [["Keramikk", "keramikk vase"], ["Skulpturer", "skulptur"], ["Malerier", "maleri abstrakt"], ["Lysestaker", "lysestake"], ["Puter", "pute bouclé"]],
    kw: { wood: ['eik', 'valnøtt', 'rund'], soft: ['bouclé', 'beige'], light: ['keramikk', 'opal'], deco: ['ull', 'beige'] },
  },
  {
    id: 'fri', name: 'Blander fritt', desc: 'Ingen bestemt stil. Vi søker bredt.',
    colors: ['#E83E8C', '#0E6B5C', '#F2B705', '#1B2430'],
    traits: ["Sterke farger", "Gammelt og nytt om hverandre", "Bilder tett i tett på veggen"],
    photos: [{"alt": "Grønn fløyelssofa med fargerike puter og et knallrosa teppe", "by": "Spacejoy", "url": "https://unsplash.com/photos/green-sofa-chair-near-brown-wooden-table-ucCsSBzYBQQ"}, {"alt": "Oransje buet sofa, hvit lenestol og stripet teppe", "by": "Spacejoy", "url": "https://unsplash.com/photos/living-room-with-white-curtains-vPKNB_gc23Q"}, {"alt": "Blå sofa under en vegg tettpakket med fargerike malerier", "by": "Steph Wilson", "url": "https://unsplash.com/photos/a-living-room-filled-with-a-blue-couch-and-lots-of-pictures-on-the-wall-MhsCRIaVQW0"}],
    decor: [["Malerier", "maleri"], ["Plakater", "plakat"], ["Vaser", "vase"], ["Speil", "speil"], ["Lysestaker", "lysestake"]],
    kw: { wood: [], soft: [], light: [], deco: [] },
  },
];

// Spørsmål man kan svare på med ett trykk når man ikke vet helt hva man vil ha.
// q = legges til i søket, note = noe du må se etter selv i annonsen, replace = bytter ut søkeordet.
export const QUESTIONS = {
  form: {
    label: 'Form',
    options: [
      { label: 'Firkantet', note: 'Firkantet (se på bildet)', avoid: 'rundt' },
      { label: 'Rundt', q: 'rundt' },
      { label: 'Ovalt', q: 'ovalt' },
    ],
  },
  uttrekk: {
    label: 'Kan forlenges',
    options: [{ label: 'Ja, uttrekkbart', q: 'uttrekkbart' }, { label: 'Slagbord', q: 'slagbord' }],
  },
  tre: {
    label: 'Materiale',
    options: [
      { label: 'Eik', q: 'eik' }, { label: 'Teak', q: 'teak' }, { label: 'Furu', q: 'furu' },
      { label: 'Hvitt', q: 'hvit' }, { label: 'Svart', q: 'svart' }, { label: 'Glass', q: 'glass' },
    ],
  },
  sofatype: {
    label: 'Type',
    options: [
      { label: 'Vanlig', },
      { label: 'Sovesofa', replace: 'sovesofa' },
      { label: 'Med sjeselong', q: 'sjeselong' },
      { label: 'Modulsofa', replace: 'modulsofa' },
    ],
  },
  stoff: {
    label: 'Trekk',
    options: [
      { label: 'Stoff' },
      { label: 'Skinn', q: 'skinn' },
      { label: 'Avtagbart trekk', note: 'Avtagbart trekk (spør selger)' },
    ],
  },
  farge: {
    label: 'Farge',
    options: [
      { label: 'Beige', q: 'beige' }, { label: 'Grå', q: 'grå' }, { label: 'Grønn', q: 'grønn' },
      { label: 'Blå', q: 'blå' }, { label: 'Brun', q: 'brun' }, { label: 'Svart', q: 'svart' },
    ],
  },
  sengtype: {
    label: 'Type',
    options: [
      { label: 'Rammemadrass', replace: 'rammemadrass' },
      { label: 'Kontinentalseng', replace: 'kontinentalseng' },
      { label: 'Kun sengeramme', replace: 'sengeramme' },
      { label: 'Med oppbevaring', q: 'oppbevaring' },
    ],
  },
};

// Ting. kind styrer hvilke stilord som foreslås. cat:false = ligger ikke under «Møbler og interiør» på Finn.
// size gir egne mål, søkeord og priser etter romstørrelse. wall = ting som bør måles mot en vegg (klaring i cm).
export const ITEMS = {
  sofa: {
    name: 'Sofa', kind: 'soft', ask: ['sofatype', 'stoff', 'farge'], wall: 40,
    size: {
      S: { label: '2-seter, ca. 150–180 cm bred', q: '2-seter sofa', u: 2000, n: 1500 },
      M: { label: '3-seter, ca. 200–230 cm bred', q: '3-seter sofa', u: 3000, n: 2000 },
      L: { label: 'Hjørnesofa eller stor 3-seter', q: 'hjørnesofa', u: 5000, n: 9000 },
    },
  },
  sovesofa: {
    name: 'Sovesofa', kind: 'soft', ask: ['farge'], wall: 30,
    size: {
      S: { label: 'Ca. 140 cm liggebredde', q: 'sovesofa', u: 2000, n: 3000 },
      M: { label: 'Ca. 140–160 cm liggebredde', q: 'sovesofa', u: 2500, n: 3500 },
      L: { label: 'Med sjeselong og oppbevaring', q: 'sovesofa sjeselong', u: 3500, n: 6000 },
    },
  },
  sofabord: {
    name: 'Sofabord', kind: 'wood', ask: ['form', 'tre'],
    size: {
      S: { label: 'Ca. 60–90 cm', q: 'sofabord', u: 600, n: 300 },
      M: { label: 'Ca. 90–120 cm', q: 'sofabord', u: 800, n: 500 },
      L: { label: 'Ca. 120–140 cm, eller to små', q: 'sofabord', u: 1200, n: 900 },
    },
  },
  tvbenk: {
    name: 'TV-benk', kind: 'wood', ask: ['tre'],
    size: {
      S: { label: 'Ca. 100–120 cm', q: 'tv-benk', u: 500, n: 400 },
      M: { label: 'Ca. 140–160 cm', q: 'tv-benk', u: 600, n: 700 },
      L: { label: 'Ca. 180–200 cm', q: 'tv-benk', u: 900, n: 1300 },
    },
  },
  lenestol: { name: 'Lenestol', kind: 'soft', ask: ['stoff', 'farge'], q: 'lenestol', u: 1500, n: 1000 },
  bokhylle: { name: 'Bokhylle', kind: 'wood', ask: ['tre'], q: 'bokhylle', u: 500, n: 600 },
  teppe: {
    name: 'Teppe', kind: 'deco', ask: ['farge'],
    size: {
      S: { label: 'Ca. 140 × 200 cm', q: 'teppe 140x200', u: 400, n: 400 },
      M: { label: 'Ca. 160 × 230 cm', q: 'teppe 160x230', u: 600, n: 700 },
      L: { label: 'Ca. 200 × 300 cm', q: 'teppe 200x300', u: 1000, n: 1300 },
    },
  },
  gulvlampe: { name: 'Gulvlampe', kind: 'light', q: 'gulvlampe', u: 500, n: 200 },
  taklampe: { name: 'Taklampe', kind: 'light', q: 'taklampe', u: 400, n: 200 },
  bordlampe: { name: 'Bordlampe', kind: 'light', q: 'bordlampe', u: 250, n: 150 },
  gardiner: { name: 'Gardiner', kind: 'deco', ask: ['farge'], q: 'gardiner', u: 200, n: 250 },
  puter: { name: 'Puter og pledd', kind: 'deco', q: 'pledd', u: 150, n: 200 },
  bilder: { name: 'Bilder og veggpynt', kind: 'deco', q: 'bilde ramme', u: 300, n: 200 },
  planter: { name: 'Planter og potter', kind: 'deco', q: 'potte', u: 150, n: 150 },

  spisebord: {
    name: 'Spisebord', kind: 'wood', ask: ['form', 'uttrekk', 'tre'], wall: 150,
    size: {
      S: { label: '2–4 personer, ca. 80–120 cm', q: 'spisebord', u: 800, n: 600 },
      M: { label: '4–6 personer, ca. 140–160 cm', q: 'spisebord', u: 1500, n: 2800 },
      L: { label: '6–8 personer, ca. 180–220 cm', q: 'spisebord', u: 2500, n: 3600 },
    },
  },
  spisestoler: {
    name: 'Spisestoler', kind: 'wood', ask: ['tre'],
    size: {
      S: { label: '2 stoler', q: 'spisestoler', u: 500, n: 600 },
      M: { label: '4 stoler', q: 'spisestoler', u: 1200, n: 1200 },
      L: { label: '6 stoler', q: 'spisestoler', u: 2000, n: 1800 },
    },
  },
  servise: { name: 'Servise og glass', kind: 'deco', cat: false, q: 'servise', u: 400, n: 500 },
  bestikk: { name: 'Bestikk', kind: 'deco', cat: false, q: 'bestikk', u: 200, n: 200 },
  gryter: { name: 'Gryter og panner', kind: 'deco', cat: false, q: 'gryter', u: 300, n: 500 },
  barkrakker: { name: 'Barkrakker', kind: 'wood', q: 'barkrakker', u: 600, n: 600 },
  kjokkentralle: { name: 'Kjøkkentralle', kind: 'wood', q: 'kjøkkentralle', u: 500, n: 600 },
  barnestol: { name: 'Barnestol', kind: 'wood', cat: false, q: 'barnestol', u: 900, n: 500 },

  seng: {
    name: 'Seng med madrass', kind: 'soft', ask: ['sengtype'], wall: 100,
    size: {
      S: { label: '120 cm bred', q: 'seng 120', u: 1200, n: 2000 },
      M: { label: '150–160 cm bred', q: 'dobbeltseng', u: 2000, n: 3500 },
      L: { label: '180 cm bred', q: 'dobbeltseng 180', u: 3000, n: 5000 },
    },
  },
  gjesteseng: { name: 'Gjesteseng', kind: 'soft', q: 'gjesteseng', u: 500, n: 800 },
  nattbord: { name: 'Nattbord', kind: 'wood', ask: ['tre'], q: 'nattbord', u: 400, n: 300 },
  garderobe: {
    name: 'Garderobeskap', kind: 'wood', ask: ['tre'], wall: 10,
    size: {
      S: { label: 'Ca. 80–100 cm bredt', q: 'garderobeskap', u: 800, n: 1000 },
      M: { label: 'Ca. 150 cm bredt', q: 'garderobeskap', u: 1200, n: 2500 },
      L: { label: 'Ca. 200 cm eller mer', q: 'garderobeskap', u: 2000, n: 4000 },
    },
  },
  kommode: { name: 'Kommode', kind: 'wood', ask: ['tre'], q: 'kommode', u: 500, n: 600 },
  speil: { name: 'Speil', kind: 'deco', q: 'speil', u: 300, n: 200 },

  skohylle: { name: 'Skohylle', kind: 'wood', q: 'skohylle', u: 200, n: 150 },
  knagger: { name: 'Knaggrekke eller stumtjener', kind: 'wood', q: 'knaggrekke', u: 150, n: 100 },
  benk: { name: 'Benk', kind: 'wood', q: 'benk gang', u: 500, n: 600 },

  skrivebord: {
    name: 'Skrivebord', kind: 'wood', ask: ['tre'], wall: 10,
    size: {
      S: { label: 'Ca. 100 cm', q: 'skrivebord', u: 500, n: 500 },
      M: { label: 'Ca. 120–140 cm', q: 'skrivebord', u: 700, n: 800 },
      L: { label: 'Ca. 160 cm, gjerne hev/senk', q: 'skrivebord hev senk', u: 2000, n: 3000 },
    },
  },
  kontorstol: { name: 'Kontorstol', kind: 'soft', q: 'kontorstol', u: 600, n: 600 },
  skrivebordslampe: { name: 'Skrivebordslampe', kind: 'light', q: 'skrivebordslampe', u: 200, n: 150 },

  badhylle: { name: 'Hylle eller skap til bad', kind: 'wood', q: 'baderomshylle', u: 300, n: 300 },
  toykurv: { name: 'Skittentøyskurv', kind: 'deco', q: 'skittentøyskurv', u: 100, n: 150 },

  barneseng: { name: 'Barneseng', kind: 'wood', q: 'barneseng', u: 800, n: 1000 },
  lekekasse: { name: 'Oppbevaring til leker', kind: 'wood', q: 'lekeoppbevaring', u: 300, n: 400 },

  utemobler: { name: 'Bord og stoler ute', kind: 'wood', cat: false, q: 'balkongmøbler', u: 800, n: 800 },
};

// Rom. ess = det de fleste trenger. extra = kjekt å ha, legges til med ett trykk.
// m2 = tegnet størrelse per valg, lim = grenser når noen skriver inn kvadratmeter.
export const ROOMS = {
  ettrom: {
    name: 'Stue og soverom i ett', m2: { S: 16, M: 22, L: 30 }, lim: [19, 26],
    ess: ['seng', 'spisebord', 'spisestoler', 'garderobe', 'gulvlampe', 'gardiner'],
    extra: ['sofa', 'sovesofa', 'sofabord', 'tvbenk', 'kommode', 'bokhylle', 'teppe', 'skrivebord', 'kontorstol', 'speil', 'bilder', 'planter', 'puter'],
  },
  stue: {
    name: 'Stue', m2: { S: 12, M: 20, L: 30 }, lim: [15, 25],
    ess: ['sofa', 'sofabord', 'tvbenk', 'teppe', 'gulvlampe', 'gardiner'],
    extra: ['lenestol', 'bokhylle', 'sovesofa', 'taklampe', 'bordlampe', 'puter', 'bilder', 'planter', 'speil'],
  },
  kjokken: {
    name: 'Kjøkken og spiseplass', m2: { S: 6, M: 10, L: 16 }, lim: [8, 13],
    ess: ['spisebord', 'spisestoler', 'servise', 'bestikk', 'gryter', 'taklampe'],
    extra: ['barkrakker', 'kjokkentralle', 'barnestol', 'teppe', 'gardiner'],
  },
  soverom: {
    name: 'Soverom', m2: { S: 7, M: 10, L: 14 }, lim: [8.5, 12],
    ess: ['seng', 'nattbord', 'garderobe', 'bordlampe', 'gardiner'],
    extra: ['kommode', 'speil', 'teppe', 'lenestol', 'taklampe', 'skrivebord', 'kontorstol', 'gjesteseng'],
  },
  gang: {
    name: 'Gang', m2: { S: 3, M: 5, L: 8 }, lim: [4, 6.5],
    ess: ['skohylle', 'knagger', 'speil'],
    extra: ['benk', 'kommode', 'taklampe', 'teppe'],
  },
  bad: {
    name: 'Bad', m2: { S: 3, M: 5, L: 8 }, lim: [4, 6.5],
    ess: ['toykurv'],
    extra: ['badhylle', 'speil'],
  },
  kontor: {
    name: 'Hjemmekontor', m2: { S: 5, M: 8, L: 12 }, lim: [6.5, 10],
    ess: ['skrivebord', 'kontorstol', 'skrivebordslampe'],
    extra: ['bokhylle', 'teppe', 'gardiner', 'sovesofa', 'gjesteseng'],
  },
  barnerom: {
    name: 'Barnerom', m2: { S: 6, M: 9, L: 12 }, lim: [7.5, 10.5],
    ess: ['barneseng', 'kommode', 'lekekasse', 'bordlampe', 'gardiner'],
    extra: ['skrivebord', 'teppe', 'bokhylle', 'garderobe'],
  },
  balkong: {
    name: 'Balkong eller uteplass', m2: { S: 3, M: 6, L: 12 }, lim: [4.5, 9],
    ess: ['utemobler'],
    extra: ['planter'],
  },
};

export const HOMES = [
  { id: 'hybel', name: 'Hybel', hint: 'ca. 15–25 m²', rooms: [['ettrom', 'S'], ['bad', 'S']] },
  { id: 'ettroms', name: '1-roms', hint: 'ca. 25–40 m²', rooms: [['ettrom', 'M'], ['kjokken', 'S'], ['gang', 'S'], ['bad', 'S']] },
  { id: 'toroms', name: '2-roms', hint: 'ca. 40–60 m²', rooms: [['stue', 'M'], ['kjokken', 'S'], ['soverom', 'M'], ['gang', 'S'], ['bad', 'S']] },
  { id: 'treroms', name: '3-roms', hint: 'ca. 60–85 m²', rooms: [['stue', 'M'], ['kjokken', 'M'], ['soverom', 'M'], ['soverom', 'S'], ['gang', 'S'], ['bad', 'S']] },
  { id: 'hus', name: '4-roms eller hus', hint: 'over 85 m²', rooms: [['stue', 'L'], ['kjokken', 'L'], ['soverom', 'L'], ['soverom', 'M'], ['soverom', 'S'], ['gang', 'M'], ['bad', 'M']] },
];

// Hverdagen. Hvert valg kan legge til ting (add: [romtyper å prøve i rekkefølge, ting]) og gi råd per ting.
export const LIFE = [
  {
    id: 'jobb', label: 'Jobber hjemme', rx: /hjemmekontor|jobb\w* (mye |ofte |en del )?hjemme|hjemmefra|studer\w* hjemme/,
    add: [[['kontor', 'soverom', 'stue', 'ettrom'], 'skrivebord'], [['kontor', 'soverom', 'stue', 'ettrom'], 'kontorstol']],
    tips: { skrivebord: 'Du jobber hjemme: velg et bord du orker å sitte ved hele dagen.' },
  },
  {
    id: 'gjester', label: 'Har ofte gjester', rx: /gjest|besøk|middag(er|sselskap)|venner (over|på)|overnatt/,
    add: [[['kontor', 'stue', 'ettrom'], 'gjesteseng']],
    tips: {
      spisebord: 'Du har ofte gjester: se etter et bord som kan forlenges.',
      spisestoler: 'Ta gjerne to ekstra stoler til gjester.',
      sofa: 'Overnatter gjestene? Velg «Sovesofa» under Type, så slipper du egen gjesteseng.',
    },
  },
  {
    id: 'barn', label: 'Barn i huset', rx: /\bbarn|\bunge|baby|småbarn|\bsønn|\bdatter/,
    add: [[['kjokken', 'ettrom'], 'barnestol']],
    tips: { sofa: 'Med barn: avtagbart trekk som kan vaskes er gull.', sofabord: 'Med barn: unngå glass og skarpe hjørner.' },
  },
  {
    id: 'dyr', label: 'Har kjæledyr', rx: /\bhund|\bkatt|kjæledyr|valp/,
    add: [],
    tips: { sofa: 'Med kjæledyr: tett stoff eller skinn tåler mest. Spør om selger har dyr.', teppe: 'Med kjæledyr: velg et teppe som tåler vask.' },
  },
  {
    id: 'mat', label: 'Lager mye mat', rx: /lage\w* (mye |masse |ofte )?mat|matlaging|\bbake|kokk/,
    add: [[['kjokken'], 'kjokkentralle']],
    tips: { gryter: 'Du lager mye mat: brukte støpejernsgryter varer evig.' },
  },
  {
    id: 'leser', label: 'Leser mye', rx: /\bles(er|e) |\bbøker|bokorm/,
    add: [[['stue', 'ettrom', 'soverom'], 'bokhylle'], [['stue', 'ettrom'], 'lenestol']],
    tips: { lenestol: 'Til lesing: prøv å sitte i stolen før du kjøper.' },
  },
  {
    id: 'film', label: 'Ser mye film eller gamer', rx: /\bfilm|serier|\bgam(er|ing|e )|playstation|xbox|\btv\b/,
    add: [],
    tips: { sofa: 'Til filmkvelder: en dyp sofa eller sjeselong er verdt plassen.', tvbenk: 'Sjekk at benken er bredere enn TV-en.' },
  },
  {
    id: 'trangt', label: 'Har liten plass', rx: /liten plass|trangt|lite plass|kompakt|smått/,
    add: [],
    tips: {
      spisebord: 'Liten plass: slagbord eller uttrekkbart bord tar lite når det ikke er i bruk.',
      seng: 'Liten plass: seng med oppbevaring under sparer et skap.',
      sofabord: 'Liten plass: settbord kan skyves inn i hverandre.',
    },
  },
  {
    id: 'gront', label: 'Liker planter', rx: /plante|grønne fingre/,
    add: [[['stue', 'ettrom'], 'planter']],
    tips: {},
  },
];

// Ord i fritekst som peker på en bestemt ting. Lengste ord først.
export const ITEM_WORDS = [
  ['sofabord', 'sofabord'], ['stuebord', 'sofabord'], ['salongbord', 'sofabord'],
  ['spisebord', 'spisebord'], ['kjøkkenbord', 'spisebord'], ['skrivebord', 'skrivebord'], ['nattbord', 'nattbord'],
  ['sovesofa', 'sovesofa'], ['hjørnesofa', 'sofa'], ['sofa', 'sofa'],
  ['spisestol', 'spisestoler'], ['kjøkkenstol', 'spisestoler'], ['kontorstol', 'kontorstol'], ['lenestol', 'lenestol'], ['godstol', 'lenestol'],
  ['dobbeltseng', 'seng'], ['barneseng', 'barneseng'], ['seng', 'seng'],
  ['tv-benk', 'tvbenk'], ['tvbenk', 'tvbenk'], ['tv benk', 'tvbenk'],
  ['garderobe', 'garderobe'], ['klesskap', 'garderobe'], ['kommode', 'kommode'],
  ['bokhylle', 'bokhylle'], ['reol', 'bokhylle'], ['teppe', 'teppe'], ['gardin', 'gardiner'],
  ['gulvlampe', 'gulvlampe'], ['taklampe', 'taklampe'], ['speil', 'speil'],
  ['bord', 'spisebord'],
];

// Ønsker i fritekst. q = fungerer som søkeord. Uten q = må sjekkes i annonsen.
export const WISH_WORDS = [
  { rx: /\brund[te]?\b/, q: 'rundt', label: 'rundt' },
  { rx: /\bfirkant\w*|\brektangul\w*|\bkvadrat\w*/, label: 'firkantet' },
  { rx: /\boval\w*/, q: 'ovalt', label: 'ovalt' },
  { rx: /\buttrekk\w*|\bforleng\w*|\bileggsplate\w*/, q: 'uttrekkbart', label: 'uttrekkbart' },
  { rx: /\bslagbord\b/, q: 'slagbord', label: 'slagbord' },
  { rx: /\boppbevaring\b/, q: 'oppbevaring', label: 'med oppbevaring' },
  { rx: /\bsjeselong\b/, q: 'sjeselong', label: 'sjeselong' },
  { rx: /\bhev[- /]?(og[- ])?senk\b/, q: 'hev senk', label: 'hev/senk' },
  { rx: /\b(massiv|heltre)\w*/, q: 'heltre', label: 'heltre' },
  { rx: /\beik\w*/, q: 'eik', label: 'eik' }, { rx: /\bteak\b/, q: 'teak', label: 'teak' },
  { rx: /\bfuru\b/, q: 'furu', label: 'furu' }, { rx: /\bbjørk\b/, q: 'bjørk', label: 'bjørk' },
  { rx: /\bvalnøtt\b/, q: 'valnøtt', label: 'valnøtt' }, { rx: /\bbambus\b/, q: 'bambus', label: 'bambus' },
  { rx: /\brotting\b/, q: 'rotting', label: 'rotting' }, { rx: /\bmarmor\b/, q: 'marmor', label: 'marmor' },
  { rx: /\bglass\w*/, q: 'glass', label: 'glass' }, { rx: /\b(metall|stål)\b/, q: 'metall', label: 'metall' },
  { rx: /\b(skinn|lær)\b/, q: 'skinn', label: 'skinn' }, { rx: /\b(fløyel|velur)\b/, q: 'fløyel', label: 'fløyel' },
  { rx: /\bboucl[eé]\b/, q: 'bouclé', label: 'bouclé' }, { rx: /\bull\b/, q: 'ull', label: 'ull' },
  { rx: /\bhvit[te]?\b/, q: 'hvit', label: 'hvit' }, { rx: /\b(svart|sort)e?\b/, q: 'svart', label: 'svart' },
  { rx: /\bgrå[tr]?\b/, q: 'grå', label: 'grå' }, { rx: /\bbeige\b/, q: 'beige', label: 'beige' },
  { rx: /\bbrun[te]?\b/, q: 'brun', label: 'brun' }, { rx: /\bgrøn[nt]e?\b/, q: 'grønn', label: 'grønn' },
  { rx: /\bblå[tr]?\b/, q: 'blå', label: 'blå' }, { rx: /\brosa\b/, q: 'rosa', label: 'rosa' },
  { rx: /\bgul[te]?\b/, q: 'gul', label: 'gul' }, { rx: /\brød[te]?\b/, q: 'rød', label: 'rød' },
  { rx: /\b(lys|lyst|lyse)\b/, label: 'lys farge' }, { rx: /\b(mørk|mørkt|mørke)\b/, label: 'mørk farge' },
  { rx: /\b(lav|lavt|lave)\b/, label: 'lav' }, { rx: /\b(høy|høyt|høye)\b/, label: 'høy' },
  { rx: /\bikea\b/, q: 'ikea', label: 'IKEA' }, { rx: /\bbolia\b/, q: 'bolia', label: 'Bolia' },
  { rx: /\bhay\b/, q: 'hay', label: 'HAY' }, { rx: /\b(ekornes|stressless)\b/, q: 'stressless', label: 'Stressless' },
];

export const LEVELS = [
  { id: 'lav', name: 'Billigst mulig', f: 0.6, hint: 'Tåler litt slitasje og venter gjerne på et kupp.' },
  { id: 'vanlig', name: 'Vanlig brukt', f: 1, hint: 'Det ting vanligvis går for på Finn.' },
  { id: 'pent', name: 'Pent brukt', f: 1.8, hint: 'Nyere ting og kjente merker.' },
];
