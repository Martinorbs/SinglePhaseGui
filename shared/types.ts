export type Season = 'winter' | 'lente' | 'zomer' | 'herfst';
export type Priority = 'hoog' | 'midden' | 'laag';
export type Orientation = 'zuid' | 'oost' | 'west';
export type AircoMode = 'uit' | 'koelen' | 'verwarmen';

export type ApplianceKind =
  | 'constant'
  | 'duty'
  | 'fridge'
  | 'oven'
  | 'airfryer'
  | 'timer'
  | 'coffee'
  | 'washer'
  | 'dryer'
  | 'dishwasher'
  | 'induction'
  | 'treadmill'
  | 'hue'
  | 'heatpump'
  | 'airco';

export interface InductionZone {
  name: string;
  maxW: number;
  level: number;
}

export interface AircoUnit {
  name: string;
  sharePct: number;
  level: number;
}

export interface ApplianceParams {
  watts?: number;
  dutyPct?: number;
  cycleMin?: number;
  offsetMin?: number;
  autoOffMin?: number;
  preheatMin?: number;
  dutyAfterPreheatPct?: number;
  brightnessPct?: number;
  zones?: InductionZone[];
  speedKmh?: number;
  inclinePct?: number;
  weightKg?: number;
  baseW?: number;
  perKmh?: number;
  marginPct?: number;
  brewMin?: number;
  keepWarmW?: number;
  keepWarmMin?: number;
  durationMin?: number;
  coolingKw?: number;
  heatingKw?: number;
  eer?: number;
  cop?: number;
  minElectricW?: number;
  maxElectricW?: number;
  units?: AircoUnit[];
  mode?: AircoMode;
  [key: string]: unknown;
}

export interface ApplianceConfig {
  id: string;
  name: string;
  room: string;
  kind: ApplianceKind;
  priority: Priority;
  powerFactor: number;
  builtin: boolean;
  params: ApplianceParams;
}

export interface BatteryConfig {
  enabled: boolean;
  capacityKwh: number;
  maxChargeKw: number;
  maxDischargeKw: number;
  roundTripEfficiency: number;
  initialSocPct: number;
  assistThresholdA: number;
  chargeFromGrid: boolean;
  chargeFromSolar: boolean;
}

export interface SolarConfig {
  enabled: boolean;
  kwp: number;
  orientation: Orientation;
}

export interface AppSettings {
  voltage: number;
  mainFuseA: number;
}

export interface AppConfig {
  version: number;
  appliances: ApplianceConfig[];
  battery: BatteryConfig;
  solar: SolarConfig;
  settings: AppSettings;
}

export interface ApplianceRuntime {
  on: boolean;
  startedAtSec?: number;
  autoOffAtSec?: number;
}

export interface HistoryPoint {
  t: number;
  loadW: number;
  loadA: number;
  gridW: number;
  gridA: number;
  solarW: number;
  batteryW: number;
  socPct: number;
  rooms: Record<string, number>;
}

export interface SimState {
  version: number;
  simTimeSec: number;
  running: boolean;
  speed: number;
  season: Season;
  outage: boolean;
  batterySocWh: number;
  batteryDischarging: boolean;
  appliances: Record<string, ApplianceRuntime>;
  history: HistoryPoint[];
  lastHistoryMinute: number;
}

export type BatteryStatusKey =
  | 'vol'
  | 'laden-zon'
  | 'laden-net'
  | 'ontladen'
  | 'noodstroom'
  | 'leeg'
  | 'stand-by'
  | 'uit';

export interface BatterySnapshot {
  enabled: boolean;
  socPct: number;
  socKwh: number;
  capacityKwh: number;
  status: string;
  statusKey: BatteryStatusKey;
  powerW: number;
  dischargeW: number;
  chargeW: number;
  runtimeSec: number | null;
  emptyAtClock: string | null;
  fullAtClock: string | null;
  expectedDischargeW: number;
  expectedRuntimeSec: number | null;
  expectedEmptyAtClock: string | null;
  chargeFromGrid: boolean;
  chargeFromSolar: boolean;
  assistThresholdA: number;
}

export interface SolarSnapshot {
  enabled: boolean;
  powerW: number;
  kwp: number;
  orientation: Orientation;
}

export interface TotalsSnapshot {
  loadW: number;
  loadA: number;
  gridW: number;
  gridA: number;
  solarW: number;
  batteryW: number;
  unassistedA: number;
  batteryAssistA: number;
  limitA: number;
  percent: number;
  headroomA: number;
  headroomW: number;
  overLimit: boolean;
  batteryCovering: boolean;
  neededReductionA: number;
  neededReductionW: number;
  phase: 'ok' | 'dichtbij' | 'accu' | 'over';
}

export interface OverviewSnapshot {
  enabledCount: number;
  peakW: number;
  peakA: number;
  averageW: number;
  averageA: number;
  fuseA: number;
  fuseW: number;
  batteryOutputW: number;
  surplusW: number;
  averageSurplusW: number;
  fitsFuse: boolean;
  fitsBattery: boolean;
  fitsCombined: boolean;
  batteryRuntimeSec: number | null;
  gridRuntimeSec: number | null;
}

export interface ApplianceCalc {
  id: string;
  name: string;
  room: string;
  watts: number;
  currentA: number;
  va: number;
  status: string;
  statusKey: string;
  progressPct?: number;
  phaseLabel?: string;
}

export interface ApplianceSnapshot {
  id: string;
  on: boolean;
  watts: number;
  currentA: number;
  status: string;
  statusKey?: string;
  progressPct?: number;
  phaseLabel?: string;
}

export interface FitResult {
  status: 'direct' | 'accu' | 'niet' | 'aan';
  extraA: number;
  requiredBatteryW: number;
  runtimeSec: number | null;
}

export interface SheddingSuggestion {
  id: string;
  name: string;
  room: string;
  watts: number;
  priority: Priority;
}

export interface SheddingSnapshot {
  deficitA: number;
  deficitW: number;
  suggestions: SheddingSuggestion[];
}

export interface SizingRow {
  hours: number;
  requiredKw: number;
  requiredKwh: number;
}

export interface SizingSnapshot {
  deficitA: number;
  deficitW: number;
  rows: SizingRow[];
  maxRuntimeSec: number | null;
  batteryOutputKw: number;
  batteryCapacityKwh: number;
}

export interface Snapshot {
  simTimeSec: number;
  clock: string;
  running: boolean;
  speed: number;
  season: Season;
  outage: boolean;
  totals: TotalsSnapshot;
  overview: OverviewSnapshot;
  battery: BatterySnapshot;
  solar: SolarSnapshot;
  appliances: Record<string, ApplianceSnapshot>;
  fit: Record<string, FitResult>;
  shedding: SheddingSnapshot;
  sizing: SizingSnapshot;
}

export interface Bootstrap {
  config: AppConfig;
  snapshot: Snapshot;
}

export interface AppliancePatch {
  on?: boolean;
  config?: {
    name?: string;
    room?: string;
    priority?: Priority;
    powerFactor?: number;
    params?: ApplianceParams;
  };
}

export interface CustomApplianceInput {
  name: string;
  room: string;
  kind: 'constant' | 'duty';
  watts: number;
  dutyPct?: number;
  cycleMin?: number;
  powerFactor?: number;
  priority?: Priority;
}
