import type {
  ApplianceParams,
  Orientation,
  Season,
  SolarConfig,
  SolarSnapshot
} from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function round0(value: number): number {
  return Math.round(value);
}

export function parseDecimalInput(value: string, fallback = 0): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatClock(totalSeconds: number): string {
  const secondsInDay = ((Math.floor(totalSeconds) % 86400) + 86400) % 86400;
  const h = Math.floor(secondsInDay / 3600);
  const m = Math.floor((secondsInDay % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  if (seconds <= 0) return 'leeg';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 1) return '< 1 min';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} u`;
  return `${h} u ${m} min`;
}

export function formatKw(watts: number, decimals = 2): string {
  return `${round(watts / 1000, decimals).toFixed(decimals).replace('.', ',')} kW`;
}

export function formatW(watts: number): string {
  return `${round0(watts)} W`;
}

export function formatA(amps: number, decimals = 1): string {
  return `${round(amps, decimals).toFixed(decimals).replace('.', ',')} A`;
}

export function ampsFromWatts(watts: number, powerFactor: number, voltage: number): number {
  return watts / (Math.max(0.1, powerFactor) * voltage);
}

export function heatPumpSeasonFactor(season: Season): number {
  switch (season) {
    case 'winter':
      return 1;
    case 'lente':
      return 0.65;
    case 'herfst':
      return 0.65;
    case 'zomer':
      return 0;
  }
}

export function treadmillWatts(params: ApplianceParams): number {
  const speed = clamp(Number(params.speedKmh ?? 5), 0.8, 20);
  const weight = clamp(Number(params.weightKg ?? 85), 40, 150);
  const incline = clamp(Number(params.inclinePct ?? 0), 0, 15);
  const margin = 1 + clamp(Number(params.marginPct ?? 10), 0, 30) / 100;
  const base = Number(params.baseW ?? 200);
  const perKmh = Number(params.perKmh ?? 105);
  const raw = (base + perKmh * speed) * (weight / 80) * (1 + 0.03 * incline) * margin;
  return Math.min(Number(params.watts ?? 3000), Math.round(raw));
}

export function aircoPower(params: ApplianceParams): {
  thermalKw: number;
  electricW: number;
} {
  const mode = params.mode ?? 'uit';
  const units = params.units ?? [];
  const active = units.filter((u) => Number(u.level) > 0);
  if (mode === 'uit' || active.length === 0) {
    return { thermalKw: 0, electricW: 0 };
  }
  const capacityKw = Number(
    mode === 'koelen' ? (params.coolingKw ?? 5) : (params.heatingKw ?? 5)
  );
  const efficiency = Number(mode === 'koelen' ? (params.eer ?? 3) : (params.cop ?? 3.5));
  const thermalKw = active.reduce((sum, unit) => {
    return sum + capacityKw * (Number(unit.sharePct) / 100) * (Number(unit.level) / 100);
  }, 0);
  let electricW = (thermalKw / Math.max(0.5, efficiency)) * 1000;
  if (thermalKw > 0) {
    electricW = Math.max(Number(params.minElectricW ?? 250), electricW);
  }
  electricW = Math.min(electricW, Number(params.maxElectricW ?? 2000));
  return { thermalKw, electricW: Math.round(electricW) };
}

const DAYLIGHT: Record<Season, [number, number]> = {
  winter: [9, 16.5],
  lente: [7, 20],
  zomer: [6, 21],
  herfst: [8, 19]
};

const SOLAR_PEAK: Record<Season, number> = {
  winter: 0.22,
  lente: 0.62,
  zomer: 0.88,
  herfst: 0.35
};

export function orientationShift(orientation: Orientation): number {
  if (orientation === 'oost') return -1.3;
  if (orientation === 'west') return 1.3;
  return 0;
}

export function solarWatts(
  solar: SolarConfig,
  season: Season,
  timeOfDaySec: number
): number {
  if (!solar.enabled || solar.kwp <= 0) return 0;
  const [start, end] = DAYLIGHT[season];
  const hour = timeOfDaySec / 3600;
  if (hour < start || hour > end) return 0;
  const mid = (start + end) / 2 + orientationShift(solar.orientation);
  const half = (end - start) / 2;
  const x = clamp((hour - mid) / half, -1, 1);
  const shape = Math.max(0, Math.cos((x * Math.PI) / 2));
  const orientationFactor = solar.orientation === 'zuid' ? 1 : 0.88;
  return Math.round(
    solar.kwp * 1000 * SOLAR_PEAK[season] * shape * orientationFactor
  );
}

export function solarSnapshot(
  solar: SolarConfig,
  season: Season,
  timeOfDaySec: number
): SolarSnapshot {
  return {
    enabled: solar.enabled,
    powerW: solarWatts(solar, season, timeOfDaySec),
    kwp: solar.kwp,
    orientation: solar.orientation
  };
}

export interface PhaseSegment {
  from: number;
  to: number;
  fractionOfMax: number;
  label: string;
}

export const WASHER_PHASES: PhaseSegment[] = [
  { from: 0, to: 0.08, fractionOfMax: 0.9, label: 'Verwarmen' },
  { from: 0.08, to: 0.46, fractionOfMax: 0.08, label: 'Wassen' },
  { from: 0.46, to: 0.62, fractionOfMax: 0.55, label: 'Spoelen + verwarmen' },
  { from: 0.62, to: 0.75, fractionOfMax: 0.1, label: 'Spoelen' },
  { from: 0.75, to: 0.93, fractionOfMax: 0.25, label: 'Centrifugeren' },
  { from: 0.93, to: 1, fractionOfMax: 0.03, label: 'Pompen' }
];

export const DRYER_PHASES: PhaseSegment[] = [
  { from: 0, to: 0.07, fractionOfMax: 1, label: 'Opwarmen' },
  { from: 0.07, to: 0.9, fractionOfMax: 0.9, label: 'Drogen' },
  { from: 0.9, to: 1, fractionOfMax: 0.4, label: 'Afronden' }
];

export const DISHWASHER_PHASES: PhaseSegment[] = [
  { from: 0, to: 0.185, fractionOfMax: 0.9, label: 'Verwarmen' },
  { from: 0.185, to: 0.445, fractionOfMax: 0.08, label: 'Wassen' },
  { from: 0.445, to: 0.555, fractionOfMax: 0.9, label: 'Spoelwater verwarmen' },
  { from: 0.555, to: 0.89, fractionOfMax: 0.08, label: 'Spoelen' },
  { from: 0.89, to: 1, fractionOfMax: 0.15, label: 'Drogen' }
];

export function phaseAt(
  phases: PhaseSegment[],
  progress: number
): PhaseSegment | null {
  const p = clamp(progress, 0, 0.999999);
  return phases.find((phase) => p >= phase.from && p < phase.to) ?? null;
}

export function currentSeasonLabel(season: Season): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}
