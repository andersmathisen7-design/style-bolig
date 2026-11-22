# Brukthjem

Et lite nettsted som hjelper deg å innrede med brukt. Du sier hva slags bolig du har, hva du allerede eier og hva du liker. Tilbake får du en liste per rom med anbefalt størrelse, makspris per ting og ferdige søk på Finn.

Brukthjem er ikke tilknyttet FINN.no eller IKEA.

## Slik virker det

1. **Bolig.** Velg hybel, 1-roms, 2-roms og så videre, eller tegn boligen selv: tegn rundt hvert rom på frihånd, så rettes strekene opp til rette vegger. Rom kan ha vinkler og skrå vegger, og boligen kan ha flere etasjer. Etterpå setter du riktige veggmål, dører, vinduer og møbler. Møbler du setter inntil en vegg, gir lista største bredde for den tingen.
2. **Stil.** Åtte stiler med bilder. Trykk på en stil for flere eksempler og kjennetegn. Stilen gir forslag til søkeord og pynt.
3. **Hverdag.** Skriv fritt («vil ikke ha rundt bord, sofaen bør være grønn») eller trykk på ferdige valg. Teksten tolkes av enkle regler i nettleseren.
4. **Lista.** Huk av det du har, og legg til egne ting med en kort beskrivelse. Hver ting har makspris, ferdige Finn-søk (alt, lagt ut i dag, gis bort), en nypris å sammenligne med, og «Dagens runde» for en rask daglig sjekk.

Alt lagres i nettleseren (`localStorage`). Ingenting sendes noe sted. Lista kan deles som en lenke.

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
| `js/editor.js` | Tegneflaten og verktøyene. |
| `test/logic.test.mjs` | Tester for logikken. |

## Om tallene

- Bruktprisene (`u`) er anslag ut fra stikkprøver av Finn-annonser i november 2026.
- Nyprisene (`n`) er omtrentlige laveste priser, delvis hentet fra ikea.no i november 2026.
- Områdekodene for fylker er sjekket mot finn.no i november 2026.

Prisene endrer seg. Se over `js/data.js` med jevne mellomrom.

## Bilder

Stilbildene er hentet fra [Unsplash](https://unsplash.com) under Unsplash-lisensen, som tillater fri bruk uten krav om kreditering. Fotograf og lenke til originalen står likevel under hvert bilde i appen og i `js/data.js`. Bilder merket Unsplash+ er ikke brukt.

## Skrift

Bricolage Grotesque, lisensiert under SIL Open Font License 1.1.
