# Brukthjem

Et lite nettsted som hjelper deg å innrede med brukt. Du sier hva slags bolig du har, hva du allerede eier og hva du liker. Tilbake får du en liste per rom med anbefalt størrelse, makspris per ting og ferdige søk på Finn.

Brukthjem er ikke tilknyttet FINN.no eller IKEA.

## Slik virker det

Fem steg:

1. **Bolig.** Velg hybel, 1-roms, 2-roms og så videre, eller tegn boligen selv. Tegn rundt boligen eller et rom på frihånd, så rettes strekene opp til rette vegger. Dra en strek tvers over et rom for å dele det i to; streken kan ha en knekk. Rom kan ha vinkler og skrå vegger, og boligen kan ha flere etasjer. Dra i hjørner og vegger for å endre formen, skriv inn mål bare på de veggene du har mål på, og sett inn dører og vinduer.
2. **Stil.** Fjorten stiler med bilder. Hver stil har tre retninger du kan velge mellom, med egne søkeord. Stilen gir også forslag til pynt.
3. **Ting.** Hva vil du ha? En avkrysningsliste per rom, der haken betyr at tingen er med. Det vanlige er huket av på forhånd. Velg antall og variant rett på raden: sofaen kan for eksempel være 2-, 3- eller 4-seter, hjørnesofa, U-sofa (hesteskosofa), med sjeselong, modulsofa eller sovesofa, og senga finnes fra 90 cm til familieseng og køyeseng. Rommets størrelse foreslår en variant, og du kan velge en annen. Hver ting, også dine egne, har en «Kommentar» der du skriver hva du ser etter. Legg til møbler, kjøkkenutstyr, pynt og egne ting, og si om stil, komfort eller pris er viktigst. Du kan også skrive hva du har og hva du vil ha, så huker appen av.
4. **Plasser.** Hvor skal tingene stå? Sett møblene ut på tegningen og dra dem på plass, eller trykk «Sett ut alt for meg» for et utgangspunkt. Har du ikke tegnet boligen, lages en enkel tegning av rommene. Møbler som står inntil en vegg, gir lista største bredde for den tingen. Steget er valgfritt. Tegningen følger lista: bytter du variant, antall eller tar noe bort på lista, endres møblene på tegningen også. Hjørnesofa, sofa med sjeselong og hjørneskrivebord tegnes som en vinkel, og U-sofa som en hestesko med åpningen ut i rommet. Begge kan snus og speilvendes. Knappene for å snu og ta bort det valgte møbelet ligger rett under tegningen. Et møbel som snus, blir stående inne i rommet: treffer det en vegg, skyves det inntil den.
5. **Finn.** Lista over det som skal skaffes. Hver ting har makspris, ferdige Finn-søk (alt, lagt ut i dag, gis bort), en nypris å sammenligne med, og «Dagens runde» for en rask daglig sjekk. Hovedsøket ser bare i «Møbler og interiør». «Søk bredere» bruker de samme ordene i alle kategorier, og «Andre ord folk bruker» gir ett søk per synonym (sofabord: stuebord, salongbord, kaffebord), også de i alle kategorier. Slik finner du annonser som er lagt i feil kategori eller kaller tingen noe annet. «Dagens runde» søker bredt. Ord fra kommentaren som kan brukes i et søk, legges i søket. Resten står som «Se etter selv».

Alt lagres i nettleseren (`localStorage`). Ingenting sendes noe sted. Lista kan deles som en lenke.

Nederst på hvert steg ligger «Forslag og feil». Der kan du foreslå noe nytt eller melde en feil: «Send på GitHub» åpner en ferdig utfylt sak i `andersmathisen7-design/style-bolig` (merket `forslag` eller `feil`), og «Kopier teksten» gir deg den samme teksten til å lime inn et annet sted. En feilmelding får med steg, versjon, skjermstørrelse, nettleser og antall rom, møbler og ting. Det du har skrevet i appen og selve lista følger bare med hvis du huker av «Legg ved lista mi».

## Med og uten AI

Når siden vises inne i Claude (som en publisert artifact), kan den be Claude om to ting: lese av rom og kvadratmeter fra et bilde av en plantegning, og tolke friteksten din. Hvert kall bruker av kvoten til den som ser på siden. Koden ligger i `js/ai.js`.

På en vanlig nettside, som GitHub Pages, finnes ikke dette. Da skjules opplastingen, og friteksten tolkes av ordlistene.

## Hva appen ikke gjør ennå

- **Ingen AI på åpen nettside.** GitHub Pages serverer bare filer. En AI der trenger en liten server som holder på API-nøkkelen. Fritekst tolkes derfor med ordlister i `js/data.js` (`WISH_WORDS`, `LIFE`).
- **Ingen automatisk overvåking av Finn.** Finns vilkår begrenser automatisert tilgang, og det offisielle API-et gir bare tilgang til egne annonser. Appen lager derfor lenker som du selv åpner. Varsler får du ved å trykke «Lagre søk» inne på Finn.

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
| `js/editor.js` | Tegneflaten og verktøyene, og møbleringen på steg 4. |
| `js/arrange.js` | «Sett ut alt for meg»: regler for hvor møbler settes. |
| `js/feedback.js` | «Forslag og feil»: skjemaet, teksten og GitHub-lenken. Repo (`REPO`) og versjon (`VERSION`) settes øverst i fila. Tester i `test/feedback.test.mjs`. |
| `test/logic.test.mjs` | Tester for logikken. |
| `test/variants.test.mjs` | Tester for varianter, kommentarer, bredt søk og U-sofa. |

## Om tallene

- Bruktprisene (`u`) er anslag ut fra stikkprøver av Finn-annonser i november 2026.
- Nyprisene (`n`) er omtrentlige laveste priser, delvis hentet fra ikea.no i november 2026.
- Områdekodene for fylker er sjekket mot finn.no i november 2026.
- Prisene på de nyeste variantene (U-sofa, modulsofa, familieseng, hev/senk-bord og lignende) er grove anslag, og er ikke sjekket mot annonser.
- «Andre ord folk bruker» (`alt` i `js/data.js`) er satt opp etter skjønn. Det er ikke målt hvilke ord som faktisk gir flest treff på Finn.

Prisene endrer seg. Se over `js/data.js` med jevne mellomrom.

## Bilder

Stilbildene er hentet fra [Unsplash](https://unsplash.com) under Unsplash-lisensen, som tillater fri bruk uten krav om kreditering. Fotograf og lenke til originalen står likevel under hvert bilde i appen og i `js/data.js`. Bilder merket Unsplash+ er ikke brukt.

## Skrift

Bricolage Grotesque, lisensiert under SIL Open Font License 1.1.
