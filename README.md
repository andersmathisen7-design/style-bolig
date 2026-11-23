# Brukthjem

Et lite nettsted som hjelper deg å innrede med brukt. Du sier hva slags bolig du har, hva du allerede eier og hva du liker. Tilbake får du en liste per rom med anbefalt størrelse, makspris per ting og ferdige søk på Finn.

Brukthjem er ikke tilknyttet FINN.no eller IKEA.

## Slik virker det

Fem steg:

1. **Bolig.** Velg hybel, 1-roms, 2-roms og så videre, eller tegn boligen selv. Tegningen går i fire steg, og en linje over tegningen sier alltid hva som er neste: (1) tegn en runde rundt hele boligen på frihånd, så rettes streken opp til rette vegger (boligen kan ha vinkler og skrå vegger, og flere etasjer); (2) dra rette streker tvers over for å dele i rom. Du kan også hoppe over runden og dra en strek rett på det tomme arket: da blir arket boligen, og streken deler den i to. Én strek deler alle rom den går gjennom, så en strek tvers over hele boligen blir én sammenhengende vegg, og en ny strek på tvers gir fire rom. En kort strek inne i ett rom deler bare det rommet; (3) trykk på hvert rom og velg hva det er; (4) sett inn dører og vinduer. Trykk på en vegg, en dør eller et vindu for å endre det: valgene kommer i en linje rett under tegningen. Vegger får lengde i cm (skriv inn, eller trykk − 10 og + 10). Dører og vinduer får bredde og avstand fra hjørnet, og kan dras bortover veggen. Rom som ligger inntil hverandre, deler veggen: flytter du den, følger naborommet med, og en endring som ville gitt glipe eller overlapp mellom rom, blir ikke gjort. En dør i en vegg mellom to rom er én dør og hører til begge rommene. «Tegn på nytt» tar bort tegningen på etasjen, så du kan begynne med et nytt omriss («Angre» henter den tilbake). Har appen laget en enkel tegning for deg fordi du gikk til «Plasser» uten å tegne, erstattes den av omrisset du tegner.
2. **Stil.** Fjorten stiler med bilder. Hver stil har tre retninger du kan velge mellom, med egne søkeord. Stilen gir også forslag til pynt. Under bildene står hva som bør være brukt, hva som er greit å kjøpe nytt og hva du bør unngå i stilen, og hvor godt nytt fra kjedene passer.
3. **Ting.** Hva vil du ha? En avkrysningsliste per rom, der haken betyr at tingen er med. Det vanlige er huket av på forhånd. Velg antall og variant rett på raden: sofaen kan for eksempel være 2-, 3- eller 4-seter, hjørnesofa, U-sofa (hesteskosofa), med sjeselong, modulsofa eller sovesofa, og senga finnes fra 90 cm til familieseng og køyeseng. Rommets størrelse foreslår en variant, og du kan velge en annen. Hver ting, også dine egne, har en «Kommentar» der du skriver hva du ser etter. Legg til møbler, kjøkkenutstyr, pynt og egne ting, og si om stil, komfort eller pris er viktigst. Du kan også skrive hva du har og hva du vil ha, så huker appen av.
4. **Plasser.** Hvor skal tingene stå? Sett møblene ut på tegningen og dra dem på plass, eller trykk «Sett ut alt for meg» for et utgangspunkt. Har du ikke tegnet boligen, lages en enkel tegning av rommene. Møbler som står inntil en vegg, gir lista største bredde for den tingen. Steget er valgfritt. Tegningen følger lista: bytter du variant, antall eller tar noe bort på lista, endres møblene på tegningen også. Hjørnesofa, sofa med sjeselong og hjørneskrivebord tegnes som en vinkel, og U-sofa som en hestesko med åpningen ut i rommet. Begge kan snus og speilvendes. Knappene for å snu og ta bort det valgte møbelet ligger rett under tegningen. Et møbel som snus, blir stående inne i rommet: treffer det en vegg, skyves det inntil den.
5. **Finn.** Lista over det som skal skaffes. Hver ting har makspris, ferdige Finn-søk (alt, lagt ut i dag, gis bort), en nypris å sammenligne med, og «Dagens runde» for en rask daglig sjekk. Hovedsøket ser bare i «Møbler og interiør». «Søk bredere» bruker de samme ordene i alle kategorier, og «Andre ord folk bruker» gir ett søk per synonym (sofabord: stuebord, salongbord, kaffebord), også de i alle kategorier. Slik finner du annonser som er lagt i feil kategori eller kaller tingen noe annet. «Dagens runde» søker bredt. Hver ting har en dom: «Kjøp brukt», «Brukt eller nytt» eller «Kjøp nytt», med én setning om hvorfor og inntil tre nye alternativer som passer stilen (IKEA, JYSK og Rusta). Ting som bør kjøpes nye, er merket på lista, og der står det nye over Finn-søket. Nederst ligger «Triks som løfter rommet» for stilen og rommene dine. Huker du av «Jeg vil gjerne fikse litt selv», vises også ideer med verktøy, innkjøp og framgangsmåte. Ord fra kommentaren som kan brukes i et søk, legges i søket. Resten står som «Se etter selv».

Alt lagres i nettleseren (`localStorage`). Ingenting sendes noe sted. Lista kan deles som en lenke.

Nederst på hvert steg ligger «Forslag og feil». Der kan du foreslå noe nytt eller melde en feil: «Send på GitHub» åpner en ferdig utfylt sak i `andersmathisen7-design/style-bolig` (merket `forslag` eller `feil`), og «Kopier teksten» gir deg den samme teksten til å lime inn et annet sted. En feilmelding får med steg, versjon, skjermstørrelse, nettleser og antall rom, møbler og ting. Det du har skrevet i appen og selve lista følger bare med hvis du huker av «Legg ved lista mi».

## Med og uten AI

Når siden vises inne i Claude (som en publisert artifact), kan den be Claude om to ting: lese av rom og kvadratmeter fra et bilde av en plantegning, og tolke friteksten din. Hvert kall bruker av kvoten til den som ser på siden. Koden ligger i `js/ai.js`.

På en vanlig nettside, som GitHub Pages, finnes ikke dette. Da skjules opplastingen, og friteksten tolkes av ordlistene.

## Daglig sjekk på Finn

Inne i Claude kan du slå på «Daglig sjekk på Finn» på siste steg. Da lagres lista di i databasen som følger med siden, og en planlagt Claude-økt går gjennom den én gang hver morgen: den henter «lagt ut i dag»-søkene, lar en billig modell vurdere annonsene, og legger inntil tre «Funn til deg» under hver ting. Oppdraget økta får, står i `docs/finn-jobb.md`. Koden på siden ligger i `js/funn.js`.

- Sjekken leser titler, priser og steder. Den ser ikke på bildene og åpner ikke annonsene.
- Den henter høyst 40 søkesider per kjøring, én om gangen. Svarer ikke Finn, hoppes søket over. Finns vilkår begrenser automatisert tilgang, så sjekken er holdt så liten som mulig og gjelder bare lister der den er slått på.
- Sjekken bruker Claude-kvoten til den som eier siden, og eieren kan lese listene som er lagret. Slår du av, slettes både lista og funnene.
- Sjekken følger lista slik den er på enheten du sist endret den på.
- På en vanlig nettside, som GitHub Pages, finnes ikke databasen. Da vises ikke panelet, og alt annet er som før.

## Hva appen ikke gjør ennå

- **Ingen AI på åpen nettside.** GitHub Pages serverer bare filer. En AI der trenger en liten server som holder på API-nøkkelen. Fritekst tolkes derfor med ordlister i `js/data.js` (`WISH_WORDS`, `LIFE`).
- **Ingen overvåking av Finn på åpen nettside.** Finns vilkår begrenser automatisert tilgang, og det offisielle API-et gir bare tilgang til egne annonser. Appen lager derfor lenker som du selv åpner. Varsler får du ved å trykke «Lagre søk» inne på Finn. Unntaket er «Daglig sjekk på Finn» over, som bare finnes inne i Claude.

## Kjør lokalt

```sh
npm start        # http://localhost:8080
npm test         # tester logikken
```

Det er ingen byggesteg og ingen avhengigheter.

## Filer

| Fil | Innhold |
| --- | --- |
| `js/data.js` | Fylker, stiler, rom, ting, priser og ordlister. Endre priser og ting her. |
| `js/logic.js` | Ren logikk: lista, Finn-lenker, tolkning av tekst, budsjett. |
| `js/app.js` | Skjermbildene og knappene. |
| `photos/` | Stilbildene, tre per stil. |
| `js/ai.js` | Valgfri AI: plantegning og fritekst. |
| `js/plan.js` | Geometri for tegningen: retting av streker, veggmål, dører. |
| `js/walls.js` | Vegger som deles av flere rom, deling med rette streker, og dører og vinduer. Tegningen lagrer én mangekant per rom (`rooms[].poly`) og én liste med åpninger per bolig (`openings`: etasje, type, bredde og midtpunkt i cm). `rooms[].doors` regnes ut fra den. Eldre tegninger gjøres om når de lastes. |
| `js/editor.js` | Tegneflaten og verktøyene, og møbleringen på steg 4. |
| `js/arrange.js` | «Sett ut alt for meg»: regler for hvor møbler settes. |
| `js/feedback.js` | «Forslag og feil»: skjemaet, teksten og GitHub-lenken. Repo (`REPO`) og versjon (`VERSION`) settes øverst i fila. Tester i `test/feedback.test.mjs`. |
| `test/logic.test.mjs` | Tester for logikken. |
| `test/variants.test.mjs` | Tester for varianter, kommentarer, bredt søk og U-sofa. |
| `js/area.js` | «Hvor vil du lete?»: kartet, stedssøket og avstandsvalget. |
| `js/areastate.js` | Hvordan valgt område lagres og sendes til Finn (`areaParams`). |
| `js/geo.js` | Kartregning: projeksjon, avstand, punkt i flate, stedssøk. |
| `geo/` | Kartdata som følger med appen. Lastes først når kartet åpnes. |
| `tools/build-geodata.mjs` | Lager filene i `geo/` på nytt. |
| `test/area.test.mjs` | Tester for område, kart og stedssøk. |
| `test/walls.test.mjs` | Tester for delte vegger. Egenskapstestene deler en bolig tilfeldig og gjør hundrevis av tilfeldige endringer, og sjekker etter hver at ingen rom overlapper og at det ikke er hull mellom dem. |
| `js/funn.js` | Daglig sjekk på Finn: profilen som lagres, funnene som vises, og koblingen til databasen. |
| `docs/finn-jobb.md` | Oppdraget til den planlagte Claude-økta som gjør den daglige sjekken. |
| `test/funn.test.mjs` | Tester for daglig sjekk: profil, vasking av funn, skjulte annonser og datotekst. |
| `js/rad.js` | Ren logikk for råd: dom per ting, nye produkter per stil, triks med og uten gjør-det-selv. |
| `js/radview.js` | Rådene på skjermen: dom og nye alternativer per ting, stilens blanding, triks. |
| `js/nytt.js`, `js/triks.js` | Rådene som data. Lages av `tools/build-rad.mjs` og lastes først når «Stil» eller «Finn» åpnes. |
| `tools/kilder/` | Kildefilene for rådene (`nytt.json`, `triks.json`). Rediger her, ikke i `js/`. |
| `tools/build-rad.mjs` | Sjekker kildefilene og lager `js/nytt.js` og `js/triks.js` på nytt: `node tools/build-rad.mjs`. |
| `test/rad.test.mjs` | Tester for rådene. |

## Om tallene

- Bruktprisene (`u`) er anslag ut fra stikkprøver av Finn-annonser i november 2026.
- Nyprisene (`n`) er omtrentlige laveste priser, delvis hentet fra ikea.no i november 2026.
- Områdekodene for fylker er sjekket mot finn.no i november 2026.
- Prisene på de nyeste variantene (U-sofa, modulsofa, familieseng, hev/senk-bord og lignende) er grove anslag, og er ikke sjekket mot annonser.
- «Andre ord folk bruker» (`alt` i `js/data.js`) er satt opp etter skjønn. Det er ikke målt hvilke ord som faktisk gir flest treff på Finn.
- Søk innenfor en sirkel på kartet er ikke bekreftet hos Finn. Se «Område og kart».
- Prisene på nye produkter (`js/nytt.js`) er lest av butikkenes egne nettsider 22. november 2026, de fleste fra kategorisider hos IKEA. Fire lenker og priser er stikkprøvd i etterkant; resten av lenkene er ikke åpnet én for én. Tilbud og «ny lavere pris» står som merknad på produktet. Appen viser datoen og sier at prisene kan ha endret seg.
- Dommene «brukt», «begge» og «nytt», og hvilke stiler et produkt passer, er skjønn. Produktene er eksempler, ikke et fullstendig utvalg, og de tar ikke hensyn til hvilken størrelse du har valgt. Egne varianter som hjørnesofa og køyeseng får derfor bare et prisanslag.
- Triksene (`js/triks.js`) har kilde per triks. Kostnadene er omtrentlige.
- Brukthjem er heller ikke tilknyttet JYSK, Rusta eller nettstedene triksene viser til.

Prisene endrer seg. Se over `js/data.js` med jevne mellomrom.

## Område og kart

På steg 1 velger man hvor man vil lete: hele Norge, ett fylke, eller et punkt med avstand (5, 10, 20, 30, 50 eller 100 km) på et kart. Punktet settes ved å søke etter et sted eller trykke på kartet. Kartet tegnes fra filene i `geo/` og henter ingenting fra andre tjenester.

Alle Finn-lenker får området fra én funksjon, `areaParams` i `js/areastate.js`:

- **Hele Norge:** ingen områdefelt.
- **Ett fylke:** `location=0.<kode>`. Kodene er sjekket mot finn.no (november 2026).
- **Punkt og avstand:** ett `location`-felt for hvert fylke sirkelen berører. Finn dokumenterer at `location` kan gjentas ([finn.no/api/doc/search](https://www.finn.no/api/doc/search)). I tillegg sendes `lat`, `lon` og `radius` (meter).

`lat`, `lon` og `radius` er **ikke bekreftet** for Torget-søk. Finn har et filter som heter «Område i kart», men vi har ikke fått sjekket hvilke felt det bruker. Bruker Finn feltene, blir treffene snevret inn til sirkelen. Hvis ikke, gjelder fylkene. Brukeren kan slå av sirkelen i appen, og teksten sier fra om at den ikke er bekreftet. Finn har også kommunekoder (`location=1.<fylke>.<kommune>`), men vi har ingen åpen liste over dem, så de er ikke brukt.

### Kartdata

| Fil | Innhold | Kilde | Lisens | Størrelse |
| --- | --- | --- | --- | --- |
| `geo/norge.js` | Grenser for 357 kommuner og 15 fylker (2024), forenklet | Kartverket, via [robhop/fylker-og-kommuner](https://github.com/robhop/fylker-og-kommuner) | CC BY 4.0 | 160 kB |
| `geo/steder.js` | 4290 byer, tettsteder, bydeler og bygder med koordinater | Kartverket, Sentralt stedsnavnregister ([ws.geonorge.no/stedsnavn](https://ws.geonorge.no/stedsnavn/v1/)) | CC BY 4.0 | 197 kB |

Krediteringen «Kartdata: © Kartverket (CC BY 4.0)» står under kartet i appen. Grensene er forenklet for å bli små, så de er ikke nøyaktige nok til annet enn oversikt. Slik filene lages, står øverst i `tools/build-geodata.mjs`.

## Bilder

Stilbildene er hentet fra [Unsplash](https://unsplash.com) under Unsplash-lisensen, som tillater fri bruk uten krav om kreditering. Fotograf og lenke til originalen står likevel under hvert bilde i appen og i `js/data.js`. Bilder merket Unsplash+ er ikke brukt.

## Skrift

Bricolage Grotesque, lisensiert under SIL Open Font License 1.1.

## Publisering

Nettsiden ligger på GitHub Pages: https://andersmathisen7-design.github.io/style-bolig/

Pages viser grenen `gh-pages`. Bytt først versjonen i `js/feedback.js` (`VERSION`) og i `index.html` (alle `?v=`), så telefoner henter den nye koden i stedet for en gammel lagret kopi. En test sjekker at de stemmer. Etter en endring på `main`:

```
git push origin main
git push origin main:gh-pages
```
