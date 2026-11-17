import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../server/simulation/engine';
import {
  defaultConfig,
  defaultState
} from '../shared/defaults';
import type { Season } from '../shared/types';

function makeEngine(season: Season = 'herfst'): SimulationEngine {
  const config = defaultConfig();
  const state = defaultState(config, season);
  state.simTimeSec = 12 * 3600;
  state.season = season;
  state.batterySocWh = config.battery.capacityKwh * 1000;
  return new SimulationEngine(config, state);
}

function allOff(engine: SimulationEngine): void {
  for (const appliance of engine.config.appliances) {
    engine.setApplianceOn(appliance.id, false);
  }
}

function setInductionMax(engine: SimulationEngine): void {
  const induction = engine.config.appliances.find(
    (item) => item.id === 'induction'
  );
  const zones = induction?.params.zones ?? [];
  engine.patchAppliance('induction', {
    params: {
      zones: zones.map((zone) => ({ ...zone, level: 10 }))
    }
  });
}

describe('SimulationEngine', () => {
  it('starts within the default connection limit', () => {
    const engine = makeEngine();
    const snapshot = engine.snapshot();

    expect(snapshot.appliances.fridge.on).toBe(true);
    expect(snapshot.appliances.kettle.on).toBe(false);
    expect(snapshot.totals.gridA).toBeGreaterThan(0);
    expect(snapshot.totals.gridA).toBeLessThanOrEqual(35);
    expect(snapshot.totals.overLimit).toBe(false);
    expect(snapshot.battery.socPct).toBe(100);
  });

  it('uses apparent power and detects an over-limit combination', () => {
    const engine = makeEngine();
    allOff(engine);
    setInductionMax(engine);
    engine.setApplianceOn('oven', true);
    engine.patchBattery({ enabled: false });

    const snapshot = engine.snapshot();
    const javascriptLoad =
      snapshot.appliances.induction.watts + snapshot.appliances.oven.watts;

    expect(javascriptLoad).toBe(10200);
    expect(snapshot.totals.loadA).toBeCloseTo(10200 / 230, 1);
    expect(snapshot.totals.gridA).toBeCloseTo(10200 / 230, 1);
    expect(snapshot.totals.overLimit).toBe(true);
    expect(snapshot.totals.neededReductionA).toBeGreaterThan(0);
  });

  it('lets the battery cap the grid current at the fuse limit', () => {
    const engine = makeEngine();
    allOff(engine);
    setInductionMax(engine);
    engine.setApplianceOn('oven', true);

    const snapshot = engine.snapshot();

    expect(snapshot.totals.loadW).toBe(10200);
    expect(snapshot.battery.dischargeW).toBeGreaterThan(0);
    expect(snapshot.battery.statusKey).toBe('ontladen');
    expect(snapshot.totals.gridA).toBeLessThanOrEqual(35.02);
    expect(snapshot.totals.overLimit).toBe(false);
    expect(snapshot.totals.batteryCovering).toBe(true);
    expect(snapshot.totals.phase).toBe('accu');
  });

  it('only reports over limit when the battery cannot cover the deficit', () => {
    const engine = makeEngine();
    allOff(engine);
    setInductionMax(engine);
    engine.setApplianceOn('oven', true);
    engine.patchBattery({ maxDischargeKw: 0.5 });

    const lowPower = engine.snapshot();
    expect(lowPower.totals.overLimit).toBe(true);
    expect(lowPower.totals.batteryCovering).toBe(false);
    expect(lowPower.totals.phase).toBe('over');

    engine.patchBattery({ maxDischargeKw: 2.5 });
    engine.state.batterySocWh = 0;
    const empty = engine.snapshot();
    expect(empty.totals.overLimit).toBe(true);
    expect(empty.totals.batteryCovering).toBe(false);
    expect(empty.totals.phase).toBe('over');
  });

  it('reports direct, battery and impossible fits', () => {
    const engine = makeEngine();
    allOff(engine);

    expect(engine.snapshot().fit.kettle.status).toBe('direct');

    engine.patchBattery({ enabled: false });
    setInductionMax(engine);
    expect(engine.snapshot().fit.oven.status).toBe('niet');

    engine.patchBattery({ enabled: true });
    const withBattery = engine.snapshot().fit.oven;
    expect(withBattery.status).toBe('accu');
    expect(withBattery.runtimeSec).toBeGreaterThan(0);
  });

  it('keeps average-based estimates stable through oven duty cycles', () => {
    const engine = makeEngine();
    allOff(engine);
    engine.patchSettings({ mainFuseA: 5 });
    engine.setApplianceOn('oven', true);

    const baseTime = engine.state.simTimeSec;
    const preheat = engine.snapshot();

    engine.state.simTimeSec = baseTime + 9 * 60;
    const active = engine.snapshot();

    engine.state.simTimeSec = baseTime + 14 * 60;
    const idle = engine.snapshot();

    expect(preheat.appliances.oven.watts).toBe(3000);
    expect(active.appliances.oven.watts).toBe(3000);
    expect(idle.appliances.oven.watts).toBe(0);

    for (const snapshot of [preheat, active, idle]) {
      expect(snapshot.fit.airfryer.status).toBe('accu');
      expect(snapshot.fit.airfryer.runtimeSec).toBeCloseTo(
        preheat.fit.airfryer.runtimeSec ?? 0,
        5
      );
      expect(snapshot.battery.expectedRuntimeSec).toBeCloseTo(
        preheat.battery.expectedRuntimeSec ?? 0,
        5
      );
      expect(snapshot.sizing.deficitA).toBeCloseTo(
        preheat.sizing.deficitA,
        5
      );
    }
  });

  it('models an outage without a grid and suggests shedding', () => {
    const engine = makeEngine('winter');
    allOff(engine);
    setInductionMax(engine);
    engine.setApplianceOn('oven', true);
    engine.state.outage = true;

    const snapshot = engine.snapshot();

    expect(snapshot.outage).toBe(true);
    expect(snapshot.totals.gridA).toBe(0);
    expect(snapshot.totals.gridW).toBe(0);
    expect(snapshot.totals.overLimit).toBe(false);
    expect(snapshot.shedding.deficitA).toBeGreaterThan(0);
    expect(snapshot.shedding.suggestions.length).toBeGreaterThan(0);

    engine.applyShedding(snapshot.shedding.suggestions.map((item) => item.id));
    expect(engine.snapshot().shedding.deficitA).toBeLessThan(
      snapshot.shedding.deficitA
    );
  });

  it('advances only while running and drains the battery', () => {
    const engine = makeEngine();
    allOff(engine);
    setInductionMax(engine);
    engine.setApplianceOn('oven', true);

    const before = engine.snapshot();
    engine.advance(5);
    expect(engine.state.simTimeSec).toBe(before.simTimeSec);

    const socBefore = engine.state.batterySocWh;
    engine.state.running = true;
    engine.state.speed = 60;
    engine.advance(1);

    expect(engine.state.simTimeSec).toBe(before.simTimeSec + 60);
    expect(engine.state.batterySocWh).toBeLessThan(socBefore);
  });

  it('can add and delete custom appliances', () => {
    const engine = makeEngine();
    const id = engine.addCustomAppliance({
      name: 'Testkachel',
      room: 'Overig',
      kind: 'constant',
      watts: 500,
      powerFactor: 1,
      priority: 'laag'
    });

    expect(engine.snapshot().appliances[id]).toBeDefined();
    engine.setApplianceOn(id, true);
    expect(engine.snapshot().appliances[id].watts).toBe(500);

    expect(engine.deleteCustomAppliance(id)).toBe(true);
    expect(engine.snapshot().appliances[id]).toBeUndefined();
    expect(engine.deleteCustomAppliance('fridge')).toBe(false);
  });

  it('resets the day while keeping configuration', () => {
    const engine = makeEngine();
    engine.patchBattery({ enabled: false });
    engine.resetDay();

    expect(engine.config.battery.enabled).toBe(false);
    expect(engine.state.simTimeSec).toBe(8 * 3600);
    expect(engine.state.running).toBe(false);
  });

  it('summarizes peak, average and runtime for enabled appliances', () => {
    const engine = makeEngine();
    allOff(engine);
    engine.setApplianceOn('kettle', true);

    const overview = engine.snapshot().overview;

    expect(overview.enabledCount).toBe(1);
    expect(overview.peakW).toBe(2200);
    expect(overview.averageW).toBe(2200);
    expect(overview.peakA).toBeCloseTo(2200 / 230, 2);
    expect(overview.fitsFuse).toBe(true);
    expect(overview.fitsCombined).toBe(true);
    expect(overview.batteryRuntimeSec).toBeGreaterThan(7000);
    expect(overview.gridRuntimeSec).toBeNull();
  });

  it('compares peak surplus with the fuse and battery output', () => {
    const engine = makeEngine();
    allOff(engine);
    setInductionMax(engine);
    engine.setApplianceOn('oven', true);

    const overview = engine.snapshot().overview;

    expect(overview.peakW).toBe(10200);
    expect(overview.fitsFuse).toBe(false);
    expect(overview.surplusW).toBeCloseTo(10200 - 35 * 230, 0);
    expect(overview.fitsBattery).toBe(true);
    expect(overview.fitsCombined).toBe(true);
    expect(overview.batteryRuntimeSec).toBeNull();
    expect(overview.gridRuntimeSec).toBeGreaterThan(0);

    engine.patchBattery({ maxDischargeKw: 1 });
    expect(engine.snapshot().overview.fitsCombined).toBe(false);
  });
});
