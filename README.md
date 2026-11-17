# Stroombalans

Stroombalans is een Nederlandstalige simulator voor huishoudelijke stroom op een
eenfasige **230 V / 35 A** aansluiting. De app kan lokaal op een Node-server
draaien of als statische site op GitHub Pages, waarbij de simulatie en opslag
volledig in de browser lopen.

## Functies

- Apparaten aan/uit zetten en direct zien of de combinatie binnen de hoofdzekering past.
- Rood alleen wanneer de accu het tekort niet kan opvangen; met accu-ondersteuning blijft het amber.
- Per apparaat zien of het direct past, alleen met accu kan, of niet past.
- Accu-instellingen, laden/ontladen, resterende tijd en benodigde accucapaciteit.
- Zoninstellingen en een 24-uurs geschiedenis van stroom, accu en verbruikers.
- Netonderbreking met accu-back-up en ondersteund afschakelen.
- Aangepaste apparaten toevoegen, aanpassen en verwijderen.
- Simulatie starten, pauzeren, versnellen en de dag opnieuw beginnen.
- Getallen invoeren met een komma, bijvoorbeeld `1,5` kW of `0,95` powerfactor.
- Alle configuratie en simulatietoestand blijft bewaard na een herstart.

## Vereisten

- Node.js 22 of nieuwer.
- npm.
- Voor gebruik op een iPhone: de telefoon en computer op hetzelfde Wi-Fi-netwerk.

## Installeren en starten

```powershell
npm install
npm start
```

`npm start` bouwt eerst de client en start daarna de server op
`http://localhost:3000`. De server luistert op `0.0.0.0` en toont bij het starten
ook de LAN-adressen. Open zo'n adres op de iPhone.

Als de pagina op de iPhone niet bereikbaar is, sta dan inkomend TCP-verkeer op
poort 3000 toe in Windows Firewall.

De server heeft geen authenticatie en is bedoeld voor gebruik op een vertrouwd
lokaal netwerk. Zet hem niet rechtstreeks op het internet.

## GitHub Pages

De statische build gebruikt geen API of server: de simulatie-engine draait in de
browser en bewaren van configuratie en toestand gebeurt in `localStorage` van de
browser. Iedere bezoeker heeft daardoor een eigen, lokale simulatietoestand.

1. Zet de repository op GitHub en maak in **Settings → Pages** de source
   **GitHub Actions**.
2. Push naar `main` of `master`. De workflow
   `.github/workflows/deploy.yml` bouwt `dist/client` met
   `npm run build:gh-pages` en publiceert die map.
3. De base URL wordt automatisch afgeleid uit `GITHUB_REPOSITORY`, dus een site
   op `https://<gebruiker>.github.io/<repo>/` werkt zonder extra instellingen.

Voor een handmatige lokale test van de statische build:

```powershell
$env:GITHUB_REPOSITORY = '<gebruiker>/<repo>'
npm run build:gh-pages
```

Daarna kun je `dist/client` met een willekeurige static file server openen. De
gewone `npm run build` blijft de versie voor de lokale Node-server maken.

## Ontwikkelen

```powershell
npm run dev
```

Dit start de API op poort 3000 en Vite op `http://localhost:5173`. De
Vite-ontwikkelserver stuurt `/api`-verzoeken door naar de API.

## Scripts

| Commando | Functie |
| --- | --- |
| `npm run dev` | Server en client met hot reload |
| `npm start` | Productie-build maken en server starten |
| `npm run build` | Typecheck en client-build voor de lokale server |
| `npm run build:gh-pages` | Statische build met project-base-url voor GitHub Pages |
| `npm run typecheck` | TypeScript controleren |
| `npm run lint` | ESLint uitvoeren |
| `npm test` | Unit-tests uitvoeren |

## Gebruik

De simulatie start om 08:00, gepauzeerd op 60x. Met de afspeelknop laat je de
gesimuleerde tijd lopen. De header toont de actuele netstroom in ampère en het
totale verbruik in watt.

In **Instellingen** kun je:

- de hoofdzekering en netspanning aanpassen;
- bestaande apparaten en hun vermogen aanpassen;
- aangepaste apparaten toevoegen of verwijderen;
- de dag resetten of alle gegevens terugzetten naar de standaardwaarden.

Een netonderbreking schakel je in via de netstatus in het dashboard. Tijdens een
onderbreking wordt het netverbruik op nul gezet en rekent de app met accu,
zonne-energie en afschakelsuggesties.

## Gegevens en persistentie

De server bewaart gegevens in:

- `data/config.json`: apparaten, accu, zon, zekering en overige instellingen;
- `data/state.json`: simulatetijd, snelheid, aan/uit-standen, accu-SOC en de
  geschiedenis van de afgelopen 24 uur.

Schrijfacties worden atomair uitgevoerd. Wijzigingen worden direct opgeslagen en
de simulatetoestand wordt daarnaast iedere 10 seconden opgeslagen. Bij afsluiten
schrijft de server de laatste toestand weg. De geschiedenis zit in
`state.json`; er is geen apart `history.json`.

Om volledig schoon te beginnen: stop de server, verwijder
`data/config.json` en `data/state.json`, en start opnieuw. Je kunt ook **Reset
alles** in de instellingen gebruiken.

De map `data/` staat in `.gitignore`.

In de GitHub Pages-versie worden dezelfde gegevens bewaard onder de
`localStorage`-sleutel `stroombalans.v1`. De serverbestanden en de map `data/`
worden dan niet gebruikt.

## Modellering

- Apparent vermogen wordt berekend als `W / PF`; de stroom is leidend.
- Zon en accu worden voor de stroomberekening op PF 1 benaderd.
- De accu helpt alleen boven de ingestelde drempel en binnen zijn maximale
  laad-/ontlaadvermogen en resterende energie.
- Past-indicatoren, accu-afstemming en de gemiddelde acculooptijd rekenen met
  het verwachte gemiddelde verbruik van apparaten die aan staan, inclusief
  duty-cycli en programmafasen. De live meter en zekeringwaarschuwingen blijven
  het momentane verbruik gebruiken.
- De hoofdzekering wordt gesimuleerd als een harde 35 A-grens. Er is geen
  automatische uitschakeling; de app toont waarschuwingen en suggesties.
- De simulatie is deterministisch en volledig gesimuleerd. Er is geen koppeling
  met een P1-meter, Hue-bridge of echte zekeringkast.

## Tests

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

De unit-tests staan in `tests/` en dekken onder andere de stroomberekening,
accu-ontlading, netonderbreking, afschakelen, het verwisselen van apparaten,
gemiddelde schattingen tijdens duty-cycli en de hulpfuncties voor dimensionering.

## Projectstructuur

```text
shared/     Domeintypes, standaardwaarden, Zod-schema's en berekeningen
server/     Express-API, SSE-stream, persistentie en simulatie-engine
client/     React-dashboard, componenten en styling
tests/      Vitest unit-tests
data/       Lokale configuratie en simulatetoestand (niet in git)
.github/    GitHub Actions workflow voor GitHub Pages
```
