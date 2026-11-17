import { describe, expect, it } from 'vitest';
import {
  aircoPower,
  ampsFromWatts,
  formatDuration,
  heatPumpSeasonFactor,
  parseDecimalInput,
  solarWatts,
  treadmillWatts
} from '../shared/calculations';

describe('power calculations', () => {
  it('converts watts to current using the power factor', () => {
    expect(ampsFromWatts(2300, 1, 230)).toBeCloseTo(10, 5);
    expect(ampsFromWatts(1840, 0.8, 230)).toBeCloseTo(10, 5);
    expect(ampsFromWatts(1000, 0.9, 230)).toBeCloseTo(4.83, 2);
  });

  it('follows the treadmill TR-500i formula', () => {
    expect(
      treadmillWatts({
        speedKmh: 8,
        inclinePct: 0,
        weightKg: 85,
        baseW: 200,
        perKmh: 105,
        marginPct: 10,
        watts: 3000
      })
    ).toBe(1216);

    const withIncline = treadmillWatts({
      speedKmh: 8,
      inclinePct: 5,
      weightKg: 85,
      baseW: 200,
      perKmh: 105,
      marginPct: 10,
      watts: 3000
    });
    expect(withIncline).toBeGreaterThan(1216);
  });

  it('computes AC electrical input from thermal output and efficiency', () => {
    const cooling = aircoPower({
      mode: 'koelen',
      coolingKw: 5,
      eer: 3,
      minElectricW: 250,
      maxElectricW: 2000,
      units: [{ name: 'Unit 1', sharePct: 100, level: 100 }]
    });
    expect(cooling.thermalKw).toBe(5);
    expect(cooling.electricW).toBe(1667);

    const heating = aircoPower({
      mode: 'verwarmen',
      heatingKw: 5,
      cop: 3.5,
      minElectricW: 250,
      maxElectricW: 2000,
      units: [{ name: 'Unit 1', sharePct: 100, level: 50 }]
    });
    expect(heating.thermalKw).toBe(2.5);
    expect(heating.electricW).toBe(714);
  });

  it('uses season values for heat pump and solar', () => {
    expect(heatPumpSeasonFactor('winter')).toBe(1);
    expect(heatPumpSeasonFactor('zomer')).toBe(0);

    const solar = { enabled: true, kwp: 4, orientation: 'zuid' as const };
    expect(solarWatts(solar, 'zomer', 0)).toBe(0);
    expect(solarWatts(solar, 'zomer', 13 * 3600)).toBeGreaterThan(0);
    expect(solarWatts({ ...solar, enabled: false }, 'zomer', 13 * 3600)).toBe(
      0
    );
  });

  it('formats durations for the UI', () => {
    expect(formatDuration(90)).toBe('2 min');
    expect(formatDuration(3600)).toBe('1 u');
    expect(formatDuration(null)).toBe('—');
  });

  it('parses decimal commas in numeric inputs', () => {
    expect(parseDecimalInput('1,5')).toBe(1.5);
    expect(parseDecimalInput('0,75')).toBe(0.75);
    expect(parseDecimalInput('12')).toBe(12);
    expect(parseDecimalInput('')).toBe(0);
    expect(parseDecimalInput('', 35)).toBe(35);
  });
});
