# SinglePhaseGUI — “Stroombalans” — Implementation Plan

## 1. Purpose

A Dutch-language, browser-based simulator for household electrical load on a **1×230 V, 35 A** connection. It runs as a local Node server (`npm start`), is usable from an iPhone on the same Wi-Fi, and lets you:

- toggle appliances and see whether the current combination fits,
- identify which combinations overload the 35 A main fuse,
- enable/configure solar and a home battery,
- simulate battery assist, sustain time and empty-at time,
- simulate a grid outage with battery backup and assisted load shedding.

The UI stays calm and nuanced. Battery runtime is the key metric; alarming styling is reserved for a remaining over-limit state that the battery cannot cover. Battery-assisted peaks use amber instead.

## 2. Final decisions

- **Connection:** single-phase 230 V, 35 A main fuse. Only the main fuse is modeled; no group breakers.
- **Current check:** power-factor aware; amps are authoritative, watts shown for context.
- **Purely simulated.** No live P1 integration in v1.
- **Solar:** future scenario; default off, 0 kWp; fully configurable; toggle allows comparison.
- **Battery:** default 5 kWh, 2.5 kW charge/discharge, 90% round-trip efficiency, 100% initial SOC, no reserve. Charges from grid + solar to stay ready; assists only above the configurable threshold (default 35 A); provides outage backup.
- **Heat pump:** 5 kW thermal central heating, ~1.4 kW electrical in winter, no electric backup element, no defrost model, always on low/slow while enabled.
- **Air conditioner:** 5 kW cooling and 5 kW heating output, triple split with three independent indoor units, manual year-round.
- **Gas boiler:** domestic hot water only; 80 W electrical while firing, modeled as a manual toggle.
- **Bathroom floor heating:** 500 W manual on/off.
- **Treadmill:** VirtuFit Elite TR-500i, speed-driven conservative power curve.
- **Hue:** one whole-house group, 15–30 bulbs, 250 W max, dimmable.
- **Extra loads included:** dishwasher, microwave, kettle, coffee machine, extractor, separate fridge/freezer, mechanical ventilation, cameras/doorbell, home automation hub, hair dryer, iron, NAS, network gear.
- **Custom appliances:** add/edit/delete; constant or duty-cycle profiles.
- **Persistence:** everything survives restart — config, simulated time, speed, SOC, appliance states and 24 h history. Server downtime pauses the simulation and resumes where it left off.
- **UI:** single scrolling dashboard, Dutch labels, mobile-first, live A/W gauge, SOC/runtime, top-consumer breakdown, 24 h timeline; numeric inputs accept decimal commas.
- **Warnings:** hard limit only, plus percentage/headroom; red only when battery output/energy cannot cover the remaining overload; amber when the battery covers it; calm wording; no auto-tripping.
- **Stack:** React + TypeScript + Tailwind, Express, SSE, server-authoritative simulation, npm start only.

## 3. Electrical and current model

```
P_load  = Σ P_appliance                         (real power, W)
VA_load = Σ (P_appliance / PF_appliance)        (apparent power)
I_load  = VA_load / 230

I_grid  = max(0, (VA_load − P_solar − P_battery) / 230)
P_grid  = max(0, P_load − P_solar − P_battery)

limit   = 35 A
over    = I_grid > limit
```

- Solar and battery are approximated at PF 1 for the current offset; this is documented as an approximation.
- Battery assist threshold is configurable in **amps** (default 35 A).
- If the battery is enabled, it discharges only the deficit above the threshold, limited by its max output and remaining energy.
- If the deficit remains after maximum battery output, the UI shows the exact remaining **A and W** reduction needed and switches the warning to red.
- No automatic fuse trip. A short note explains the thermal nature of fuses: brief peaks are usually harmless; sustained overload matters.
- The gauge shows **A first**, then W, percentage of 35 A and remaining headroom.

## 4. Default appliance catalog

All values, power factors, profiles and priorities are editable. Priority: **H**oog / **M**idden / **L**aag, used for outage and over-limit suggestions.

| Room | Appliance | Default power | PF | Behavior | Priority |
|---|---|---:|---:|---|---|
| Keuken | Inductiekookplaat | 7200 W max | 1.00 | 4 independent zones, levels + boost, total clamp 7200 W | L |
| Keuken | Oven | 3000 W | 1.00 | 8 min preheat, then thermostat cycling ~55% | L |
| Keuken | Airfryer | 1700 W | 1.00 | ~70% duty, 20 min auto-off | L |
| Keuken | Koelkast | 100 W | 0.85 | Compressor ~40% duty | H |
| Keuken | Vriezer | 140 W | 0.85 | Compressor ~40% duty, offset from fridge | H |
| Keuken | Vaatwasser | 2200 W max | 0.95 | Eco cycle ~2 h 15: heat, wash, heat-rinse, dry | L |
| Keuken | Magnetron | 1100 W | 1.00 | Countdown timer, default 3 min | L |
| Keuken | Waterkoker | 2200 W | 1.00 | Auto-off after 3 min | L |
| Keuken | Koffiemachine | 1450 W | 1.00 | Brew ~2 min, 60 W keep-warm for 10 min | L |
| Keuken | Afzuigkap | 250 W | 0.90 | Constant while on | L |
| Woonkamer | TV woonkamer | 120 W | 0.90 | Constant | M |
| Woonkamer | Desktop PC | 400 W | 0.95 | Moderate preset | M |
| Woonkamer | Telefoonlader | 20 W | 0.90 | Constant | L |
| Sportkamer | Loopband TR-500i | ~850 W at 5 km/h; max 3000 W | 0.90 | Speed/incline/weight-driven conservative curve | L |
| Sportkamer | TV sportkamer | 100 W | 0.90 | Constant | M |
| Wasruimte | Wasmachine | 2200 W max | 0.95 | Standard cotton ~2 h: heat, wash, rinse, spin | L |
| Wasruimte | Warmtepompdroger | 800 W | 0.90 | ~2.5 h low steady draw, ~1.9 kWh | L |
| Klimaat | Warmtepomp | ~1400 W winter (5 kW thermal) | 0.90 | Season-dependent; always on low/slow; no defrost | M |
| Klimaat | Airco triple split | ~1670 W cooling / ~1430 W heating at full; max 2000 W | 0.95 | 3 independent indoor units, shared mode, 5 kW thermal | L |
| Klimaat | Vloerverwarming badkamer | 500 W | 1.00 | Manual on/off | L |
| Klimaat | Gasboiler (tapwater) | 80 W | 0.90 | Manual “boiler firing” toggle; no DHW demand model | M |
| Verlichting | Hue hele huis | 250 W max | 0.90 | One group, dimmer 0–100% | M |
| Overig | NAS / homeserver | 40 W | 0.95 | Always-on toggle | H |
| Overig | Netwerkapparatuur | 30 W | 0.90 | Always-on toggle | H |
| Overig | Mechanische ventilatie / WTW | 30 W | 0.90 | Always-on toggle | H |
| Overig | Camera’s / deurbel | 15 W | 0.90 | Always-on toggle | H |
| Overig | Domotica hub | 10 W | 0.90 | Always-on toggle | M |
| Overig | Föhn | 1800 W | 1.00 | 10 min auto-off | L |
| Overig | Strijkijzer | 1200 W | 1.00 | 10 min auto-off | L |
| Overig | Custom appliances | User-defined | Editable | Constant or duty cycle | Editable |

First-run state: fridge, freezer, NAS, network, ventilation, cameras, hub and central heat pump on; everything else off. Battery 100%; simulation paused at 08:00 with 60× selected. Season defaults to the current month.

## 5. Simulation behavior

### Time control

- Fixed 1-second simulated timestep; server-authoritative.
- Speeds: 1×, 10×, 60×, 300×, 900×, 3600×.
- Pause, resume, reset day, reset everything.
- Simulation continues without connected clients. On server restart, restore saved state and resume; no time passes while the server is down.

### Appliance profiles

- **Washer:** fill/heat, wash, rinse, spin/drain phases; editable durations and wattages.
- **Dryer:** heat-up, steady drying, cool-down.
- **Dishwasher:** heat, wash, heat-rinse, rinse, dry.
- **Oven/airfryer:** thermostat duty cycling; oven preheat.
- **Fridge/freezer:** deterministic compressor cycling, staggered.
- **Kettle/microwave/coffee/hair dryer/iron:** timers and auto-off.
- **Induction:** four zones with levels and boost; total power clamp.
- **Hue:** brightness scales the configured maximum.
- **Treadmill:**
  `P = (200 + 105 × km/h) × (weight/80) × (1 + 0.03 × incline%) × 1.10`
  Default 85 kg, 10% margin, clamp 3000 W, 5-second soft start. At 5 km/h ≈ 850 W; at 10 km/h ≈ 1.6 kW. All parameters editable; TV is separate.

### Central heat pump and bathroom floor heating

- Season selector: winter / lente / zomer / herfst.
- Heat pump electrical input: winter 1400 W, spring/autumn 65%, summer 0; no electric backup; no defrost; no thermostat cycling.
- Bathroom floor heating: constant 500 W while on.
- Manual override allows turning the heat pump off.

### Air conditioner — triple split

- Nominal **5.0 kW cooling** and **5.0 kW heating** thermal output; editable.
- EER 3.0 cooling, COP 3.5 heating; PF 0.95; max electrical input 2.0 kW; minimum ~250 W when any indoor unit runs.
- One shared system mode (koelen/verwarmen); no simultaneous heating and cooling.
- Three indoor units with independent on/off and 0–100% levels; equal default capacity shares, editable.
- Total thermal output clamped at 5 kW; electrical input derived from thermal output and efficiency, then capped.
- Manual year-round; default off. It can run alongside the central heat pump; both count toward the electrical total.
- Priority low for shedding, editable.

### Solar

- Default off, 0 kWp.
- Configurable kWp, orientation (zuid/oost/west), season-based deterministic production curve.
- Solar serves load first, then charges the battery, then exports; grid import can become negative.

### Battery

- Default 5 kWh, 2.5 kW charge, 2.5 kW discharge, 90% round-trip, initial SOC 100%.
- Grid + solar charging enabled by default, throttled so charging never causes an overload.
- Discharges only above the assist threshold (default 35 A), exactly the deficit, limited by output and energy.
- Hysteresis prevents rapid charge/discharge flapping.
- No outage reserve.
- Runtime display: remaining energy ÷ current net discharge, plus projected empty clock time. The dashboard also shows an expected runtime based on the average load of all appliances that are on.
- Battery sizing helper: at the current average load, shows required output kW and required kWh for 1/2/4 h, compared with the configured battery.
- Outage: grid forced to 0; solar + battery supply the house; battery supplies up to max output; solar surplus charges it.

### Fit indicators and assisted shedding

- Each appliance card shows:
  - **Past direct** — fits within 35 A without battery assist.
  - **Accu nodig** — fits only if the battery can cover the extra load; shows estimated runtime.
  - **Past niet** — exceeds battery output/energy or 35 A even with assist.
- Fit, sizing and expected battery runtime use the average expected draw of all appliances that are on,
  including duty cycles and program phases, so thermostat cycling does not change the estimate. Live
  warnings and the gauge still use instantaneous load.
- Outage deficit panel explains the shortfall and suggests switch-offs by priority and wattage. One-click apply with undo.
- Similar suggestions are available when the grid limit is exceeded, but never applied automatically.

## 6. UI and UX

Single scrolling dashboard, usable at 390 px:

1. **Hero:** ampere gauge (35 A scale), W, percentage, remaining A/W headroom; battery chip with SOC/status/runtime; solar and grid chips.
2. **Simulation bar:** play/pause, speed, clock, season, reset.
3. **Appliance cards grouped by room:** toggle, live W, fit indicator, profile progress, expandable settings. Large touch targets, no hover-only controls.
4. **Battery and solar panels:** configuration, SOC bar, runtime, empty-at, sizing helper.
5. **Charts:** 24 h stacked appliance timeline with 35 A limit line, battery SOC chart, top-consumer breakdown.
6. **Outage mode:** confirmation toggle, supply/demand panel, load-shedding assistant.
7. **Settings sheet:** add/edit/delete custom appliances, edit all wattages/profiles/PFs, fuse settings, reset options.

Visual tone: warm neutral background, white cards, tabular numbers; teal/green for headroom, soft amber near the limit, muted red only when actually over. No flashing or alarms.

Suggested Dutch copy:

- “Je gebruikt 23,4 A van 35 A — nog 11,6 A ruimte.”
- “Accu ondersteunt · nog ±1 u 55 min · leeg rond 19:42.”
- “Voeg de oven toe: past direct.”
- “Met de accu kan dit er nog ±35 min bij.”
- “Je zit 2,1 A boven de limiet. Schakel bijvoorbeeld de airfryer uit of laat de accu bijspringen.”

## 7. Architecture

```
SinglePhaseGUI/
  package.json
  tsconfig.json
  vite.config.ts
  eslint.config.js
  README.md
  PLAN.md
  shared/
    types.ts          domain types
    defaults.ts       catalog and defaults
    schema.ts         Zod validation + migration
    calculations.ts   PF/amps, fit, battery sizing helpers
  server/
    index.ts          Express, static hosting, LAN banner
    api.ts            REST endpoints
    stream.ts         SSE
    persistence.ts    atomic config/state files
    simulation/
      engine.ts       tick loop, appliance profiles, battery, solar, outage, shedding, history
  client/
    index.html
    src/main.tsx, App.tsx, api.ts, useLiveState.ts
    src/components/   ui, gauge, cards, panels, charts, settings sheet
    src/styles.css
  tests/
    engine.test.ts, calculations.test.ts
  data/
    config.json       user configuration
    state.json        runtime state plus rolling 24 h history
```

- **Server-authoritative simulation**, so state keeps progressing when the iPhone sleeps.
- **SSE** for live snapshots; REST for mutations; reconnect and visibility-change resync.
- **Persistence:** Zod-validated, atomic writes (temp + rename), schema version. Config and runtime state are restored on startup; history is stored inside runtime state. Server downtime pauses simulation. “Reset simulatie” and “Reset alles” controls.
- **History:** 1-minute aggregates for a rolling 24 h; chart fetched separately from live ticks.
- **Dependencies:** Express, Zod, React, Tailwind v4, Recharts, Lucide, Vitest, Supertest, ESLint. No database, WebSocket library or Docker.
- LAN-only, no authentication. Bind `0.0.0.0`; print all LAN URLs at startup.

### API sketch

```
GET    /api/bootstrap                 config + runtime snapshot
GET    /api/stream                    SSE live ticks
GET    /api/history?window=24h
PATCH  /api/appliances/:id            on/off, levels, modes, AC units
POST   /api/appliances                add custom appliance
DELETE /api/appliances/:id            delete custom appliance
PATCH  /api/battery | /api/solar | /api/settings
POST   /api/simulation               play/pause/speed/reset/start time
POST   /api/outage
POST   /api/shedding/apply
GET    /api/battery-sizing?duration=…
GET    /api/health
```

## 8. Build phases

1. **Scaffold:** single npm project, TypeScript strict, Vite + Tailwind + Express, ESLint, Vitest, dev/prod scripts, LAN URL banner.
2. **Domain:** types, catalog, defaults, Zod schema, PF/amps and sizing helpers.
3. **Engine:** time stepping, all profiles, AC triple split, heat pump seasons, solar, battery, overload, outage, shedding, history; unit tests.
4. **Server:** REST, SSE, config/state persistence (history embedded in state), restore, validation, reset.
5. **Dashboard:** ampere gauge, appliance cards, AC and induction controls, battery/solar panels, fit indicators, Dutch copy.
6. **Charts and advanced UI:** 24 h timeline, SOC chart, breakdown, sizing helper, outage/shedding, custom appliances.
7. **Polish:** iPhone Safari pass, safe areas, accessibility, README, lint/typecheck/tests/build.

## 9. Verification

- **Unit tests:** PF/amps conversion; AC electrical calculation, unit caps and max input; battery assist in A, efficiency and runtime; battery-covered vs unassisted red states; decimal-comma parsing; outage behavior; solar curve; heat pump seasons; treadmill curve monotonic/conservative; duty cycles deterministic; average-based fit/runtime stable across oven phases; history bucketing; shedding minimal set; sizing helper; persistence restore; config 
validation/migration.
- **API tests:** bootstrap, SSE payload, mutations, persistence round-trip.
- **Commands:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- **Manual:** real iPhone over LAN; toggles, sliders, charts, background/resume SSE; no horizontal scroll at 390 px.
- **Acceptance:**
  1. `npm install && npm start` works and is reachable from the iPhone.
  2. Complete appliance list, editable values/PFs and custom appliances.
  3. Gauge in A/W updates within ~500 ms; percentage and headroom correct.
  4. Realistic cycling, washer/dryer/dishwasher phases, treadmill speed curve, seasonal heat pump, 3-unit AC, Hue dimming.
  5. Battery configurable; assists at threshold; charges from grid/solar; SOC, runtime, empty-at and sizing helper work.
  6. Solar toggle reduces grid current.
  7. Outage mode shows deficit and assisted shedding.
  8. Per-card fit indicators show Past direct / Accu nodig / Past niet correctly.
  9. Config, state and history survive restart.
  10. UI is Dutch, calm, mobile-first; lint, typecheck, tests and build pass.

## 10. Run and deployment

```
npm install
npm start          # builds client, starts server on 0.0.0.0:3000
npm run dev        # development with hot reload
```

README covers same-Wi-Fi access, Windows Firewall inbound TCP 3000, data files/reset, and the no-auth LAN-only warning. No HTTPS, Docker, PWA or authentication.

## 11. Out of scope

Real P1 integration, Hue bridge control, dynamic tariffs/cost optimization, weather/solar forecast, 3-phase support, group breakers, Home Assistant, PWA/offline, Docker, multi-user auth, automatic breaker trip, room thermal simulation, hot-water demand simulation, EV charging.

## 12. Assumptions

- All default wattages, PFs, seasons and capacities are typical values and editable.
- Solar and battery current offset approximated at PF 1.
- Treadmill default user weight 85 kg, 10% margin; editable.
- AC defaults: 5 kW cooling/heating, EER 3.0, COP 3.5, max 2 kW electrical, equal indoor-unit shares; editable.
- Gas boiler modeled only as an 80 W manual electrical load.
- Heat pump electric draw derives from 5 kW thermal at COP ~3.5.
- Fuse behavior simplified to a 35 A limit; inrush not used for warnings.
- Single household, LAN-only, no authentication.
- Server downtime pauses the simulation; state resumes on restart.
