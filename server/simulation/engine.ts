import type {
  AppConfig,
  ApplianceCalc,
  ApplianceConfig,
  ApplianceRuntime,
  ApplianceSnapshot,
  BatterySnapshot,
  BatteryStatusKey,
  CustomApplianceInput,
  FitResult,
  HistoryPoint,
  OverviewSnapshot,
  Priority,
  Season,
  SheddingSnapshot,
  SimState,
  SizingSnapshot,
  Snapshot,
  TotalsSnapshot
} from '../../shared/types';
import {
  HISTORY_LIMIT,
  defaultConfig,
  defaultState
} from '../../shared/defaults';
import {
  DISHWASHER_PHASES,
  DRYER_PHASES,
  WASHER_PHASES,
  aircoPower,
  ampsFromWatts,
  clamp,
  formatClock,
  heatPumpSeasonFactor,
  phaseAt,
  round,
  solarWatts,
  treadmillWatts,
  type PhaseSegment
} from '../../shared/calculations';

interface BatteryFlow {
  dischargeW: number;
  chargeW: number;
  chargeSolarW: number;
  chargeGridW: number;
  powerW: number;
  status: string;
  statusKey: BatteryStatusKey;
  runtimeSec: number | null;
  emptyAtClock: string | null;
  fullAtClock: string | null;
  expectedDischargeW: number;
  expectedRuntimeSec: number | null;
  expectedEmptyAtClock: string | null;
  socPct: number;
}

interface FlowResult {
  per: Record<string, ApplianceCalc>;
  loadW: number;
  loadA: number;
  vaLoad: number;
  expectedLoadW: number;
  expectedVaLoad: number;
  solarW: number;
  gridW: number;
  gridA: number;
  battery: BatteryFlow;
  unassistedA: number;
}

const PHASE_TABLES = {
  washer: WASHER_PHASES,
  dryer: DRYER_PHASES,
  dishwasher: DISHWASHER_PHASES
} as const;

const PRIORITY_RANK: Record<Priority, number> = {
  laag: 0,
  midden: 1,
  hoog: 2
};

const BATTERY_LABELS: Record<BatteryStatusKey, string> = {
  vol: 'Vol',
  'laden-zon': 'Laden met zon',
  'laden-net': 'Laden met net',
  ontladen: 'Ondersteunt',
  noodstroom: 'Noodstroom',
  leeg: 'Leeg',
  'stand-by': 'Stand-by',
  uit: 'Uit'
};

export class SimulationEngine {
  config: AppConfig;
  state: SimState;

  constructor(config: AppConfig, state: SimState) {
    this.config = config;
    this.state = state;
    this.ensureRuntimeEntries();
    this.ensureHistorySeed();
  }

  get voltage(): number {
    return this.config.settings.voltage;
  }

  get limitA(): number {
    return this.config.settings.mainFuseA;
  }

  private ensureRuntimeEntries(): void {
    for (const appliance of this.config.appliances) {
      if (!this.state.appliances[appliance.id]) {
        this.state.appliances[appliance.id] = { on: false };
      }
    }
    const ids = new Set(this.config.appliances.map((a) => a.id));
    for (const id of Object.keys(this.state.appliances)) {
      if (!ids.has(id)) delete this.state.appliances[id];
    }
  }

  private num(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private elapsed(runtime: ApplianceRuntime): number {
    const start = runtime.startedAtSec ?? this.state.simTimeSec;
    return Math.max(0, this.state.simTimeSec - start);
  }

  private calcAppliance(
    appliance: ApplianceConfig,
    runtime: ApplianceRuntime
  ): ApplianceCalc {
    const p = appliance.params;
    let watts = 0;
    let status = 'Uit';
    let statusKey = 'off';
    let progressPct: number | undefined;
    let phaseLabel: string | undefined;

    if (runtime.on) {
      switch (appliance.kind) {
        case 'constant': {
          watts = this.num(p.watts, 0);
          status = 'Aan';
          statusKey = 'on';
          break;
        }
        case 'duty':
        case 'fridge': {
          const cycle = Math.max(1, this.num(p.cycleMin, 30)) * 60;
          const offset = this.num(p.offsetMin, 0) * 60;
          const phase =
            ((((this.state.simTimeSec + offset) % cycle) + cycle) % cycle) / cycle;
          const duty = clamp(this.num(p.dutyPct, 50), 0, 100) / 100;
          const active = phase < duty;
          watts = active ? this.num(p.watts, 0) : 0;
          if (appliance.kind === 'fridge') {
            status = active ? 'Compressor loopt' : 'Rust';
          } else {
            status = active ? 'Actief' : 'Wacht';
          }
          statusKey = active ? 'on' : 'rust';
          progressPct = active ? (phase / Math.max(0.001, duty)) * 100 : 0;
          break;
        }
        case 'oven': {
          const elapsed = this.elapsed(runtime);
          const preheat = Math.max(0, this.num(p.preheatMin, 8)) * 60;
          const cycle = Math.max(1, this.num(p.cycleMin, 10)) * 60;
          if (elapsed < preheat) {
            watts = this.num(p.watts, 0);
            status = 'Voorverwarmen';
            statusKey = 'on';
            progressPct = (elapsed / Math.max(1, preheat)) * 100;
            phaseLabel = 'Voorverwarmen';
          } else {
            const phase = ((elapsed - preheat) % cycle) / cycle;
            const duty =
              clamp(this.num(p.dutyAfterPreheatPct, 55), 0, 100) / 100;
            const active = phase < duty;
            watts = active ? this.num(p.watts, 0) : 0;
            status = active ? 'Verwarmen' : 'Regelen';
            statusKey = active ? 'on' : 'rust';
            progressPct = 100;
            phaseLabel = 'Op temperatuur';
          }
          break;
        }
        case 'airfryer': {
          const elapsed = this.elapsed(runtime);
          const autoOff = Math.max(1, this.num(p.autoOffMin, 20)) * 60;
          if (elapsed >= autoOff) {
            status = 'Klaar';
            statusKey = 'off';
            progressPct = 100;
          } else {
            const cycle = Math.max(1, this.num(p.cycleMin, 10)) * 60;
            const phase = (elapsed % cycle) / cycle;
            const duty = clamp(this.num(p.dutyPct, 70), 0, 100) / 100;
            const active = phase < duty;
            watts = active ? this.num(p.watts, 0) : 0;
            status = active ? 'Bakken' : 'Regelen';
            statusKey = active ? 'on' : 'rust';
            progressPct = (elapsed / autoOff) * 100;
            phaseLabel = active ? 'Bakken' : 'Regelen';
          }
          break;
        }
        case 'timer': {
          const remaining = runtime.autoOffAtSec
            ? runtime.autoOffAtSec - this.state.simTimeSec
            : 0;
          if (remaining <= 0) {
            status = 'Klaar';
            statusKey = 'off';
          } else {
            watts = this.num(p.watts, 0);
            status = `Nog ${Math.ceil(remaining / 60)} min`;
            statusKey = 'on';
            progressPct = 100;
          }
          break;
        }
        case 'coffee': {
          const elapsed = this.elapsed(runtime);
          const brew = Math.max(0, this.num(p.brewMin, 2)) * 60;
          const keep = Math.max(0, this.num(p.keepWarmMin, 10)) * 60;
          if (elapsed < brew) {
            watts = this.num(p.watts, 0);
            status = 'Brewen';
            statusKey = 'on';
            progressPct = (elapsed / Math.max(1, brew)) * 100;
            phaseLabel = 'Brewen';
          } else if (elapsed < brew + keep) {
            watts = this.num(p.keepWarmW, 60);
            status = 'Warm houden';
            statusKey = 'on';
            progressPct = ((elapsed - brew) / Math.max(1, keep)) * 100;
            phaseLabel = 'Warm houden';
          } else {
            status = 'Klaar';
            statusKey = 'off';
            progressPct = 100;
          }
          break;
        }
        case 'washer':
        case 'dryer':
        case 'dishwasher': {
          const duration = Math.max(1, this.num(p.durationMin, 120)) * 60;
          const elapsed = this.elapsed(runtime);
          if (elapsed >= duration) {
            status = 'Klaar';
            statusKey = 'off';
            progressPct = 100;
          } else {
            const progress = elapsed / duration;
            const phases = PHASE_TABLES[appliance.kind];
            const phase = phaseAt(phases, progress);
            watts = phase ? this.num(p.watts, 0) * phase.fractionOfMax : 0;
            status = phase?.label ?? 'Programma';
            statusKey = watts > 0 ? 'on' : 'rust';
            progressPct = progress * 100;
            phaseLabel = phase?.label;
          }
          break;
        }
        case 'induction': {
          const zones = Array.isArray(p.zones) ? p.zones : [];
          const total = zones.reduce((sum, zone) => {
            const level = clamp(this.num(zone.level, 0), 0, 10);
            return sum + (level / 10) * this.num(zone.maxW, 0);
          }, 0);
          watts = Math.min(this.num(p.watts, 7200), Math.round(total));
          const active = zones.filter((zone) => this.num(zone.level, 0) > 0).length;
          status = active > 0 ? `${active} zone${active === 1 ? '' : 's'} actief` : 'Stand-by';
          statusKey = active > 0 ? 'on' : 'standby';
          break;
        }
        case 'treadmill': {
          watts = treadmillWatts(p);
          const speed = this.num(p.speedKmh, 5);
          status = `${speed.toFixed(1).replace('.', ',')} km/u`;
          statusKey = 'on';
          break;
        }
        case 'hue': {
          const brightness = clamp(this.num(p.brightnessPct, 60), 0, 100);
          watts = this.num(p.watts, 0) * (brightness / 100);
          status = `Helderheid ${Math.round(brightness)}%`;
          statusKey = brightness > 0 ? 'on' : 'off';
          break;
        }
        case 'heatpump': {
          const factor = heatPumpSeasonFactor(this.state.season);
          watts = Math.round(this.num(p.watts, 1400) * factor);
          status =
            factor > 0
              ? `Verwarmen (${this.state.season})`
              : 'Geen warmtevraag';
          statusKey = factor > 0 ? 'on' : 'off';
          break;
        }
        case 'airco': {
          const { thermalKw, electricW } = aircoPower(p);
          watts = electricW;
          const mode = p.mode ?? 'uit';
          if (mode === 'uit') {
            status = 'Uit';
            statusKey = 'off';
          } else if (watts === 0) {
            status = 'Stand-by';
            statusKey = 'standby';
          } else {
            status = `${mode === 'koelen' ? 'Koelen' : 'Verwarmen'} ${thermalKw
              .toFixed(1)
              .replace('.', ',')} kW`;
            statusKey = 'on';
          }
          break;
        }
      }
    }

    const currentA = ampsFromWatts(watts, appliance.powerFactor, this.voltage);
    return {
      id: appliance.id,
      name: appliance.name,
      room: appliance.room,
      watts: Math.round(watts),
      currentA,
      va: watts / Math.max(0.1, appliance.powerFactor),
      status,
      statusKey,
      progressPct,
      phaseLabel
    };
  }

  private checkAutoOff(): void {
    for (const appliance of this.config.appliances) {
      const runtime = this.state.appliances[appliance.id];
      if (!runtime?.on) continue;
      const p = appliance.params;
      let stop = false;
      if (runtime.autoOffAtSec !== undefined) {
        stop = this.state.simTimeSec >= runtime.autoOffAtSec;
      }
      if (!stop && appliance.kind === 'coffee') {
        const total =
          (this.num(p.brewMin, 2) + this.num(p.keepWarmMin, 10)) * 60;
        stop = this.elapsed(runtime) >= total;
      }
      if (
        !stop &&
        (appliance.kind === 'washer' ||
          appliance.kind === 'dryer' ||
          appliance.kind === 'dishwasher')
      ) {
        stop = this.elapsed(runtime) >= this.num(p.durationMin, 120) * 60;
      }
      if (stop) {
        runtime.on = false;
        delete runtime.startedAtSec;
        delete runtime.autoOffAtSec;
      }
    }
  }

  private computeFlows(dtSec: number, integrate: boolean): FlowResult {
    const per: Record<string, ApplianceCalc> = {};
    let loadW = 0;
    let vaLoad = 0;
    let expectedLoadW = 0;
    let expectedVaLoad = 0;

    for (const appliance of this.config.appliances) {
      const runtime = this.state.appliances[appliance.id] ?? { on: false };
      const calc = this.calcAppliance(appliance, runtime);
      per[appliance.id] = calc;
      loadW += calc.watts;
      vaLoad += calc.va;
      const expectedW = this.expectedWatts(appliance, runtime);
      expectedLoadW += expectedW;
      expectedVaLoad += expectedW / Math.max(0.1, appliance.powerFactor);
    }

    const solarW = solarWatts(
      this.config.solar,
      this.state.season,
      this.state.simTimeSec % 86400
    );
    const voltage = this.voltage;
    const battery = this.config.battery;
    const capacityWh = battery.capacityKwh * 1000;
    const soc = clamp(this.state.batterySocWh, 0, capacityWh);
    const eta = Math.sqrt(clamp(battery.roundTripEfficiency, 0.5, 1));
    const thresholdA = Math.min(battery.assistThresholdA, this.limitA);
    const iWithoutBattery = Math.max(0, (vaLoad - solarW) / voltage);
    const safeDt = Math.max(dtSec, 0.000001);

    let dischargeW = 0;
    let chargeSolarW = 0;
    let chargeGridW = 0;
    let statusKey: BatteryStatusKey = battery.enabled ? 'stand-by' : 'uit';

    if (battery.enabled && capacityWh > 0) {
      if (this.state.outage) {
        const net = loadW - solarW;
        if (net > 0.5) {
          if (soc > 0.01) {
            const energyCap = (soc * eta * 3600) / safeDt;
            dischargeW = Math.min(
              net,
              battery.maxDischargeKw * 1000,
              energyCap
            );
          }
        } else if (net < -0.5) {
          const room = Math.max(0, capacityWh - soc);
          const energyCap = (room * 3600) / (safeDt * eta);
          if (battery.chargeFromSolar) {
            chargeSolarW = Math.min(
              -net,
              battery.maxChargeKw * 1000,
              energyCap
            );
          }
        }

        if (dischargeW > 0.5) {
          statusKey = 'noodstroom';
        } else if (chargeSolarW > 0.5) {
          statusKey = 'laden-zon';
        } else if (soc <= 0.01) {
          statusKey = 'leeg';
        } else {
          statusKey = 'stand-by';
        }
      } else {
        const effectiveThreshold = this.state.batteryDischarging
          ? Math.max(0, thresholdA - 0.25)
          : thresholdA;
        if (iWithoutBattery > effectiveThreshold + 0.001) {
          const needW = Math.max(
            0,
            (iWithoutBattery - effectiveThreshold) * voltage
          );
          const energyCap = (soc * eta * 3600) / safeDt;
          dischargeW = Math.min(
            needW,
            battery.maxDischargeKw * 1000,
            energyCap
          );
          if (integrate) {
            this.state.batteryDischarging = dischargeW > 0.5;
          }
          if (dischargeW > 0.5) {
            statusKey = 'ontladen';
          } else if (soc <= 0.01) {
            statusKey = 'leeg';
          } else {
            statusKey = 'stand-by';
          }
        } else {
          if (integrate) this.state.batteryDischarging = false;
          if (soc >= capacityWh - 1) {
            statusKey = 'vol';
          } else {
            const surplus = Math.max(0, solarW - loadW);
            const room = Math.max(0, capacityWh - soc);
            const energyCap = (room * 3600) / (safeDt * eta);
            if (battery.chargeFromSolar) {
              chargeSolarW = Math.min(
                surplus,
                battery.maxChargeKw * 1000,
                energyCap
              );
            }
            const marginVa = Math.max(
              0,
              thresholdA * voltage - (vaLoad - solarW)
            );
            if (battery.chargeFromGrid) {
              chargeGridW = Math.min(
                Math.max(0, battery.maxChargeKw * 1000 - chargeSolarW),
                marginVa,
                Math.max(0, energyCap - chargeSolarW)
              );
            }
            if (chargeGridW > 0.5) {
              statusKey = 'laden-net';
            } else if (chargeSolarW > 0.5) {
              statusKey = 'laden-zon';
            } else {
              statusKey = 'stand-by';
            }
          }
        }
      }
    }

    const chargeW = chargeSolarW + chargeGridW;
    const batteryPowerW = dischargeW - chargeW;
    const gridW = loadW - solarW - dischargeW + chargeW;
    const gridA = Math.max(0, (vaLoad - solarW - dischargeW + chargeW) / voltage);

    if (integrate && battery.enabled) {
      const next =
        soc + ((chargeW * eta - dischargeW / eta) * dtSec) / 3600;
      this.state.batterySocWh = clamp(next, 0, capacityWh);
      if (this.state.batterySocWh <= 0.01) {
        this.state.batteryDischarging = false;
      }
    }

    const socAfter = integrate
      ? clamp(this.state.batterySocWh, 0, capacityWh)
      : soc;
    const runtimeSec =
      dischargeW > 0.5 ? (socAfter * eta * 3600) / dischargeW : null;
    const fullAtSec =
      chargeW > 0.5 && chargeW * eta > 0
        ? ((capacityWh - socAfter) / (chargeW * eta)) * 3600
        : null;

    const expectedUnassistedA = Math.max(
      0,
      (expectedVaLoad - solarW) / voltage
    );
    let expectedDischargeW = 0;
    if (battery.enabled && capacityWh > 0 && socAfter > 0.01) {
      const expectedNeedW = this.state.outage
        ? Math.max(0, expectedLoadW - solarW)
        : Math.max(0, (expectedUnassistedA - thresholdA) * voltage);
      expectedDischargeW = Math.min(
        expectedNeedW,
        battery.maxDischargeKw * 1000
      );
    }
    const expectedRuntimeSec =
      expectedDischargeW > 0.5
        ? (socAfter * eta * 3600) / expectedDischargeW
        : null;

    const batteryFlow: BatteryFlow = {
      dischargeW,
      chargeW,
      chargeSolarW,
      chargeGridW,
      powerW: batteryPowerW,
      status: BATTERY_LABELS[statusKey],
      statusKey,
      runtimeSec,
      emptyAtClock:
        runtimeSec !== null
          ? formatClock(this.state.simTimeSec + runtimeSec)
          : null,
      fullAtClock:
        fullAtSec !== null ? formatClock(this.state.simTimeSec + fullAtSec) : null,
      expectedDischargeW,
      expectedRuntimeSec,
      expectedEmptyAtClock:
        expectedRuntimeSec !== null
          ? formatClock(this.state.simTimeSec + expectedRuntimeSec)
          : null,
      socPct: (socAfter / Math.max(1, capacityWh)) * 100
    };

    return {
      per,
      loadW,
      loadA: vaLoad / voltage,
      vaLoad,
      expectedLoadW,
      expectedVaLoad,
      solarW,
      gridW,
      gridA,
      battery: batteryFlow,
      unassistedA: iWithoutBattery
    };
  }

  advance(realDeltaSec: number): void {
    if (!this.state.running || realDeltaSec <= 0) return;
    let remaining = Math.min(7200, realDeltaSec * this.state.speed);
    while (remaining > 0.000001) {
      const dt = Math.min(1, remaining);
      this.checkAutoOff();
      const flows = this.computeFlows(dt, true);
      this.state.simTimeSec += dt;
      const minute = Math.floor(this.state.simTimeSec / 60);
      if (minute > this.state.lastHistoryMinute) {
        this.state.lastHistoryMinute = minute;
        this.state.history.push(this.historyPoint(flows));
        if (this.state.history.length > HISTORY_LIMIT) {
          this.state.history.splice(0, this.state.history.length - HISTORY_LIMIT);
        }
      }
      remaining -= dt;
    }
  }

  private historyPoint(flows: FlowResult): HistoryPoint {
    const rooms: Record<string, number> = {};
    for (const calc of Object.values(flows.per)) {
      rooms[calc.room] = (rooms[calc.room] ?? 0) + calc.currentA;
    }
    for (const room of Object.keys(rooms)) {
      rooms[room] = round(rooms[room], 3);
    }
    return {
      t: round(this.state.simTimeSec, 1),
      loadW: Math.round(flows.loadW),
      loadA: round(flows.loadA, 2),
      gridW: this.state.outage ? 0 : Math.round(flows.gridW),
      gridA: this.state.outage ? 0 : round(flows.gridA, 2),
      solarW: Math.round(flows.solarW),
      batteryW: Math.round(flows.battery.powerW),
      socPct: round(flows.battery.socPct, 1),
      rooms
    };
  }

  private ensureHistorySeed(): void {
    if (this.state.history.length > 0) return;
    const flows = this.computeFlows(1, false);
    this.state.history.push(this.historyPoint(flows));
    this.state.lastHistoryMinute = Math.floor(this.state.simTimeSec / 60);
  }

  private phaseAverage(phases: PhaseSegment[]): number {
    return phases.reduce(
      (sum, phase) => sum + (phase.to - phase.from) * phase.fractionOfMax,
      0
    );
  }

  private expectedOnWatts(appliance: ApplianceConfig): number {
    const p = appliance.params;
    switch (appliance.kind) {
      case 'constant':
        return this.num(p.watts, 0);
      case 'duty':
      case 'fridge':
        return (
          this.num(p.watts, 0) *
          (clamp(this.num(p.dutyPct, 50), 0, 100) / 100)
        );
      case 'oven':
        return (
          this.num(p.watts, 0) *
          (clamp(this.num(p.dutyAfterPreheatPct, 55), 0, 100) / 100)
        );
      case 'airfryer':
        return (
          this.num(p.watts, 0) *
          (clamp(this.num(p.dutyPct, 70), 0, 100) / 100)
        );
      case 'timer':
        return this.num(p.watts, 0);
      case 'coffee': {
        const brew = Math.max(0, this.num(p.brewMin, 2));
        const keep = Math.max(0, this.num(p.keepWarmMin, 10));
        const total = brew + keep;
        if (total <= 0) return 0;
        return (
          (this.num(p.watts, 0) * brew + this.num(p.keepWarmW, 60) * keep) /
          total
        );
      }
      case 'washer':
      case 'dryer':
      case 'dishwasher':
        return (
          this.num(p.watts, 0) *
          this.phaseAverage(PHASE_TABLES[appliance.kind])
        );
      case 'induction': {
        const zones = Array.isArray(p.zones) ? p.zones : [];
        const total = zones.reduce(
          (sum, zone) =>
            sum + (clamp(this.num(zone.level, 0), 0, 10) / 10) * this.num(zone.maxW, 0),
          0
        );
        return total > 0 ? Math.min(this.num(p.watts, 7200), total) : this.num(p.watts, 7200) / 4;
      }
      case 'airco': {
        const base = p;
        const mode = p.mode === 'verwarmen' ? 'verwarmen' : 'koelen';
        const units = Array.isArray(p.units) ? p.units : [];
        const withUnits = units.some((unit) => this.num(unit.level, 0) > 0)
          ? units
          : units.map((unit, index) => ({
              ...unit,
              level: index === 0 ? 60 : 0
            }));
        return aircoPower({ ...base, mode, units: withUnits }).electricW;
      }
      case 'treadmill':
        return treadmillWatts(p);
      case 'hue': {
        const brightness = clamp(this.num(p.brightnessPct, 60), 0, 100);
        return this.num(p.watts, 0) * ((brightness > 0 ? brightness : 60) / 100);
      }
      case 'heatpump':
        return Math.round(
          this.num(p.watts, 1400) * heatPumpSeasonFactor(this.state.season)
        );
      default:
        return 0;
    }
  }

  private expectedWatts(
    appliance: ApplianceConfig,
    runtime: ApplianceRuntime
  ): number {
    if (!runtime.on) return 0;
    const p = appliance.params;
    const elapsed = this.elapsed(runtime);
    switch (appliance.kind) {
      case 'timer':
        if (
          runtime.autoOffAtSec !== undefined &&
          this.state.simTimeSec >= runtime.autoOffAtSec
        ) {
          return 0;
        }
        break;
      case 'airfryer':
        if (elapsed >= Math.max(1, this.num(p.autoOffMin, 20)) * 60) return 0;
        break;
      case 'coffee':
        if (
          elapsed >=
          (Math.max(0, this.num(p.brewMin, 2)) +
            Math.max(0, this.num(p.keepWarmMin, 10))) *
            60
        ) {
          return 0;
        }
        break;
      case 'washer':
      case 'dryer':
      case 'dishwasher':
        if (elapsed >= Math.max(1, this.num(p.durationMin, 120)) * 60) return 0;
        break;
    }
    return this.expectedOnWatts(appliance);
  }

  private peakOnWatts(appliance: ApplianceConfig): number {
    const p = appliance.params;
    switch (appliance.kind) {
      case 'duty':
      case 'fridge':
      case 'oven':
      case 'airfryer':
      case 'timer':
      case 'coffee':
      case 'washer':
      case 'dryer':
      case 'dishwasher':
      case 'hue':
        return this.num(p.watts, 0);
      case 'induction': {
        const zones = Array.isArray(p.zones) ? p.zones : [];
        const total = zones.reduce(
          (sum, zone) => sum + this.num(zone.maxW, 0),
          0
        );
        return total > 0
          ? Math.min(this.num(p.watts, 7200), total)
          : this.num(p.watts, 7200);
      }
      case 'treadmill':
        return treadmillWatts(p);
      case 'heatpump':
        return Math.round(
          this.num(p.watts, 1400) * heatPumpSeasonFactor(this.state.season)
        );
      case 'airco': {
        const units = Array.isArray(p.units) && p.units.length > 0
          ? p.units.map((unit) => ({ ...unit, level: 100 }))
          : [{ name: 'Airco', sharePct: 100, level: 100 }];
        return aircoPower({ ...p, units }).electricW;
      }
      default:
        return this.num(p.watts, 0);
    }
  }

  private computeOverview(): OverviewSnapshot {
    let peakW = 0;
    let peakVa = 0;
    let averageW = 0;
    let averageVa = 0;
    let enabledCount = 0;

    for (const appliance of this.config.appliances) {
      const runtime = this.state.appliances[appliance.id];
      if (!runtime?.on) continue;
      enabledCount += 1;
      const pf = Math.max(0.1, appliance.powerFactor);
      const peak = this.peakOnWatts(appliance);
      const average = this.expectedWatts(appliance, runtime);
      peakW += peak;
      peakVa += peak / pf;
      averageW += average;
      averageVa += average / pf;
    }

    const battery = this.config.battery;
    const fuseW = this.limitA * this.voltage;
    const outputW = battery.enabled ? battery.maxDischargeKw * 1000 : 0;
    const socWh = clamp(this.state.batterySocWh, 0, battery.capacityKwh * 1000);
    const efficiency = Math.sqrt(
      clamp(battery.roundTripEfficiency, 0.5, 1)
    );
    const usableWh = socWh * efficiency;
    const surplusW = Math.max(0, peakVa - (this.state.outage ? 0 : fuseW));
    const averageSurplusW = Math.max(
      0,
      averageVa - (this.state.outage ? 0 : fuseW)
    );
    const fitsFuse = this.state.outage || peakVa <= fuseW + 0.1;
    const fitsBattery = surplusW <= outputW + 0.1;

    const runtimeFor = (demandW: number): number | null =>
      usableWh > 0 && outputW > 0 && demandW > 0.5 && demandW <= outputW + 0.1
        ? (usableWh * 3600) / demandW
        : null;

    return {
      enabledCount,
      peakW: Math.round(peakW),
      peakA: round(peakVa / this.voltage, 2),
      averageW: Math.round(averageW),
      averageA: round(averageVa / this.voltage, 2),
      fuseA: this.limitA,
      fuseW: Math.round(fuseW),
      batteryOutputW: Math.round(outputW),
      surplusW: Math.round(surplusW),
      averageSurplusW: Math.round(averageSurplusW),
      fitsFuse,
      fitsBattery,
      fitsCombined: fitsFuse || fitsBattery,
      batteryRuntimeSec: runtimeFor(averageW),
      gridRuntimeSec: runtimeFor(averageSurplusW)
    };
  }

  private computeFit(
    flows: FlowResult,
    appliance: ApplianceConfig
  ): FitResult {
    const runtime = this.state.appliances[appliance.id] ?? { on: false };
    const expected = this.expectedOnWatts(appliance);
    if (runtime.on) {
      return {
        status: 'aan',
        extraA: 0,
        requiredBatteryW: 0,
        runtimeSec: null
      };
    }

    const addedA = ampsFromWatts(expected, appliance.powerFactor, this.voltage);
    const unassisted = Math.max(
      0,
      (flows.expectedVaLoad +
        expected / Math.max(0.1, appliance.powerFactor) -
        flows.solarW) /
        this.voltage
    );
    if (unassisted <= this.limitA + 0.05) {
      return {
        status: 'direct',
        extraA: addedA,
        requiredBatteryW: 0,
        runtimeSec: null
      };
    }

    const requiredW = (unassisted - this.limitA) * this.voltage;
    const battery = this.config.battery;
    const soc = clamp(this.state.batterySocWh, 0, battery.capacityKwh * 1000);
    const eta = Math.sqrt(battery.roundTripEfficiency);
    if (
      battery.enabled &&
      soc > 0.01 &&
      requiredW <= battery.maxDischargeKw * 1000 + 0.1
    ) {
      const runtimeSec = (soc * eta * 3600) / requiredW;
      return {
        status: 'accu',
        extraA: addedA,
        requiredBatteryW: requiredW,
        runtimeSec
      };
    }

    return {
      status: 'niet',
      extraA: addedA,
      requiredBatteryW: requiredW,
      runtimeSec: null
    };
  }

  private computeShedding(flows: FlowResult): SheddingSnapshot {
    const battery = this.config.battery;
    const maxBatteryW = battery.enabled ? battery.maxDischargeKw * 1000 : 0;
    let deficitA: number;
    if (this.state.outage) {
      deficitA = Math.max(
        0,
        flows.loadA - (flows.solarW + maxBatteryW) / this.voltage
      );
    } else {
      deficitA = Math.max(0, flows.gridA - this.limitA);
    }
    const candidates = Object.values(flows.per)
      .filter((calc) => calc.watts > 0)
      .map((calc) => ({
        calc,
        appliance: this.config.appliances.find((a) => a.id === calc.id)!
      }))
      .sort((a, b) => {
        const priority =
          PRIORITY_RANK[a.appliance.priority] - PRIORITY_RANK[b.appliance.priority];
        if (priority !== 0) return priority;
        return b.calc.watts - a.calc.watts;
      });

    const suggestions: SheddingSnapshot['suggestions'] = [];
    let covered = 0;
    for (const candidate of candidates) {
      if (covered >= deficitA) break;
      suggestions.push({
        id: candidate.calc.id,
        name: candidate.calc.name,
        room: candidate.calc.room,
        watts: candidate.calc.watts,
        priority: candidate.appliance.priority
      });
      covered += candidate.calc.currentA;
    }

    return {
      deficitA: round(deficitA, 2),
      deficitW: Math.round(deficitA * this.voltage),
      suggestions
    };
  }

  private computeSizing(flows: FlowResult): SizingSnapshot {
    const expectedUnassistedA = Math.max(
      0,
      (flows.expectedVaLoad - flows.solarW) / this.voltage
    );
    const deficitA = Math.max(0, expectedUnassistedA - this.limitA);
    const deficitW = deficitA * this.voltage;
    const battery = this.config.battery;
    const soc = clamp(this.state.batterySocWh, 0, battery.capacityKwh * 1000);
    const eta = Math.sqrt(battery.roundTripEfficiency);
    return {
      deficitA: round(deficitA, 2),
      deficitW: Math.round(deficitW),
      rows: [1, 2, 4].map((hours) => ({
        hours,
        requiredKw: round(deficitW / 1000, 2),
        requiredKwh: round((deficitW / 1000) * hours, 2)
      })),
      maxRuntimeSec:
        deficitW > 0.5 && battery.enabled && soc > 0.01
          ? (soc * eta * 3600) / deficitW
          : null,
      batteryOutputKw: battery.maxDischargeKw,
      batteryCapacityKwh: battery.capacityKwh
    };
  }

  snapshot(): Snapshot {
    const flows = this.computeFlows(1, false);
    const voltage = this.voltage;
    const appliances: Record<string, ApplianceSnapshot> = {};
    for (const calc of Object.values(flows.per)) {
      appliances[calc.id] = {
        id: calc.id,
        on: this.state.appliances[calc.id]?.on ?? false,
        watts: calc.watts,
        currentA: round(calc.currentA, 2),
        status: calc.status,
        statusKey: calc.statusKey,
        ...(calc.progressPct !== undefined ? { progressPct: calc.progressPct } : {}),
        ...(calc.phaseLabel !== undefined ? { phaseLabel: calc.phaseLabel } : {})
      };
    }

    const fit: Record<string, FitResult> = {};
    for (const appliance of this.config.appliances) {
      fit[appliance.id] = this.computeFit(flows, appliance);
    }

    const battery = this.config.battery;
    const socKwh = clamp(
      this.state.batterySocWh,
      0,
      battery.capacityKwh * 1000
    ) / 1000;
    const gridA = this.state.outage ? 0 : flows.gridA;
    const gridW = this.state.outage ? 0 : flows.gridW;
    const percent = this.state.outage
      ? 0
      : (gridA / Math.max(0.1, this.limitA)) * 100;
    const headroomA = Math.max(0, this.limitA - gridA);
    const overLimit = !this.state.outage && gridA > this.limitA + 0.01;
    const unassistedA = this.state.outage ? 0 : flows.unassistedA;
    const batteryAssistA = this.state.outage
      ? 0
      : flows.battery.dischargeW / voltage;
    const batteryCovering =
      !this.state.outage &&
      unassistedA > this.limitA + 0.01 &&
      !overLimit &&
      batteryAssistA > 0.01;

    const totals: TotalsSnapshot = {
      loadW: Math.round(flows.loadW),
      loadA: round(flows.loadA, 2),
      gridW: Math.round(gridW),
      gridA: round(gridA, 2),
      solarW: Math.round(flows.solarW),
      batteryW: Math.round(flows.battery.powerW),
      unassistedA: round(unassistedA, 2),
      batteryAssistA: round(batteryAssistA, 2),
      limitA: this.limitA,
      percent: round(percent, 1),
      headroomA: round(headroomA, 2),
      headroomW: Math.round(headroomA * voltage),
      overLimit,
      batteryCovering,
      neededReductionA: round(Math.max(0, gridA - this.limitA), 2),
      neededReductionW: Math.round(
        Math.max(0, gridA - this.limitA) * voltage
      ),
      phase: overLimit
        ? 'over'
        : batteryCovering
          ? 'accu'
          : percent >= 95
            ? 'dichtbij'
            : 'ok'
    };

    const batterySnapshot: BatterySnapshot = {
      enabled: battery.enabled,
      socPct: round(flows.battery.socPct, 1),
      socKwh: round(socKwh, 2),
      capacityKwh: battery.capacityKwh,
      status: flows.battery.status,
      statusKey: flows.battery.statusKey,
      powerW: Math.round(flows.battery.powerW),
      dischargeW: Math.round(flows.battery.dischargeW),
      chargeW: Math.round(flows.battery.chargeW),
      runtimeSec: flows.battery.runtimeSec,
      emptyAtClock: flows.battery.emptyAtClock,
      fullAtClock: flows.battery.fullAtClock,
      expectedDischargeW: Math.round(flows.battery.expectedDischargeW),
      expectedRuntimeSec: flows.battery.expectedRuntimeSec,
      expectedEmptyAtClock: flows.battery.expectedEmptyAtClock,
      chargeFromGrid: battery.chargeFromGrid,
      chargeFromSolar: battery.chargeFromSolar,
      assistThresholdA: battery.assistThresholdA
    };

    return {
      simTimeSec: this.state.simTimeSec,
      clock: formatClock(this.state.simTimeSec),
      overview: this.computeOverview(),
      running: this.state.running,
      speed: this.state.speed,
      season: this.state.season,
      outage: this.state.outage,
      totals,
      battery: batterySnapshot,
      solar: {
        enabled: this.config.solar.enabled,
        powerW: Math.round(flows.solarW),
        kwp: this.config.solar.kwp,
        orientation: this.config.solar.orientation
      },
      appliances,
      fit,
      shedding: this.computeShedding(flows),
      sizing: this.computeSizing(flows)
    };
  }

  setRunning(running: boolean): void {
    this.state.running = running;
  }

  setSpeed(speed: number): void {
    this.state.speed = clamp(speed, 1, 3600);
  }

  setSeason(season: Season): void {
    this.state.season = season;
  }

  setOutage(enabled: boolean): void {
    this.state.outage = enabled;
    if (!enabled) this.state.batteryDischarging = false;
  }

  setTimeOfDay(timeOfDaySec: number): void {
    const dayStart = Math.floor(this.state.simTimeSec / 86400) * 86400;
    this.state.simTimeSec = dayStart + clamp(timeOfDaySec, 0, 86399);
  }

  setApplianceOn(id: string, on: boolean): boolean {
    const appliance = this.config.appliances.find((a) => a.id === id);
    const runtime = this.state.appliances[id];
    if (!appliance || !runtime) return false;

    if (on) {
      runtime.on = true;
      runtime.startedAtSec = this.state.simTimeSec;
      delete runtime.autoOffAtSec;
      if (appliance.kind === 'airco') {
        if (appliance.params.mode === 'uit' || !appliance.params.mode) {
          appliance.params.mode = 'koelen';
        }
        const units = Array.isArray(appliance.params.units)
          ? appliance.params.units
          : [];
        if (!units.some((unit) => this.num(unit.level, 0) > 0)) {
          if (units[0]) units[0].level = 60;
        }
      }
      if (appliance.kind === 'induction') {
        const zones = Array.isArray(appliance.params.zones)
          ? appliance.params.zones
          : [];
        if (!zones.some((zone) => this.num(zone.level, 0) > 0)) {
          if (zones[0]) zones[0].level = 5;
        }
      }
      if (appliance.kind === 'hue') {
        if (this.num(appliance.params.brightnessPct, 60) <= 0) {
          appliance.params.brightnessPct = 60;
        }
      }
      if (appliance.params.autoOffMin !== undefined) {
        runtime.autoOffAtSec =
          this.state.simTimeSec + this.num(appliance.params.autoOffMin, 0) * 60;
      }
    } else {
      runtime.on = false;
      delete runtime.startedAtSec;
      delete runtime.autoOffAtSec;
    }
    return true;
  }

  patchAppliance(
    id: string,
    patch: {
      name?: string;
      room?: string;
      priority?: Priority;
      powerFactor?: number;
      params?: Record<string, unknown>;
    }
  ): boolean {
    const appliance = this.config.appliances.find((a) => a.id === id);
    if (!appliance) return false;
    if (patch.name !== undefined) appliance.name = patch.name;
    if (patch.room !== undefined) appliance.room = patch.room;
    if (patch.priority !== undefined) appliance.priority = patch.priority;
    if (patch.powerFactor !== undefined) {
      appliance.powerFactor = clamp(patch.powerFactor, 0.1, 2);
    }
    if (patch.params) {
      appliance.params = { ...appliance.params, ...patch.params };
    }
    if (appliance.kind === 'airco') {
      const units = Array.isArray(appliance.params.units)
        ? appliance.params.units
        : [];
      const mode = appliance.params.mode;
      if (
        (mode === 'koelen' || mode === 'verwarmen') &&
        units.some((unit) => this.num(unit.level, 0) > 0)
      ) {
        const runtime = this.state.appliances[id];
        if (runtime) runtime.on = true;
      }
    }
    if (appliance.kind === 'induction') {
      const zones = Array.isArray(appliance.params.zones)
        ? appliance.params.zones
        : [];
      if (zones.some((zone) => this.num(zone.level, 0) > 0)) {
        const runtime = this.state.appliances[id];
        if (runtime) runtime.on = true;
      }
    }
    return true;
  }

  addCustomAppliance(input: CustomApplianceInput): string {
    const id = `custom-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const appliance: ApplianceConfig = {
      id,
      name: input.name,
      room: input.room,
      kind: input.kind,
      priority: input.priority ?? 'laag',
      powerFactor: input.powerFactor ?? 1,
      builtin: false,
      params:
        input.kind === 'duty'
          ? {
              watts: input.watts,
              dutyPct: input.dutyPct ?? 50,
              cycleMin: input.cycleMin ?? 15
            }
          : { watts: input.watts }
    };
    this.config.appliances.push(appliance);
    this.state.appliances[id] = { on: false };
    return id;
  }

  deleteCustomAppliance(id: string): boolean {
    const index = this.config.appliances.findIndex((a) => a.id === id);
    if (index < 0 || this.config.appliances[index].builtin) return false;
    this.config.appliances.splice(index, 1);
    delete this.state.appliances[id];
    return true;
  }

  patchBattery(patch: Partial<AppConfig['battery']>): void {
    this.config.battery = { ...this.config.battery, ...patch };
    const capacityWh = this.config.battery.capacityKwh * 1000;
    this.state.batterySocWh = clamp(this.state.batterySocWh, 0, capacityWh);
    if (!this.config.battery.enabled) {
      this.state.batteryDischarging = false;
    }
  }

  patchSolar(patch: Partial<AppConfig['solar']>): void {
    this.config.solar = { ...this.config.solar, ...patch };
  }

  patchSettings(patch: Partial<AppConfig['settings']>): void {
    this.config.settings = { ...this.config.settings, ...patch };
  }

  applyShedding(ids: string[]): void {
    for (const id of ids) {
      this.setApplianceOn(id, false);
    }
  }

  resetDay(): void {
    const season = this.state.season;
    this.state = defaultState(this.config, season);
    this.ensureRuntimeEntries();
    this.ensureHistorySeed();
  }

  resetAll(): void {
    this.config = defaultConfig();
    this.state = defaultState(this.config);
    this.ensureRuntimeEntries();
    this.ensureHistorySeed();
  }
}
