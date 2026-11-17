import { z } from 'zod';
import type { AppConfig, ApplianceConfig, ApplianceRuntime, SimState } from './types';
import {
  APP_VERSION,
  HISTORY_LIMIT,
  currentSeason,
  defaultConfig,
  defaultState
} from './defaults';

const seasonSchema = z.enum(['winter', 'lente', 'zomer', 'herfst']);
const prioritySchema = z.enum(['hoog', 'midden', 'laag']);
const orientationSchema = z.enum(['zuid', 'oost', 'west']);
const kindSchema = z.enum([
  'constant',
  'duty',
  'fridge',
  'oven',
  'airfryer',
  'timer',
  'coffee',
  'washer',
  'dryer',
  'dishwasher',
  'induction',
  'treadmill',
  'hue',
  'heatpump',
  'airco'
]);

export const applianceConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  room: z.string().min(1),
  kind: kindSchema,
  priority: prioritySchema,
  powerFactor: z.number().min(0.1).max(2),
  builtin: z.boolean(),
  params: z.record(z.string(), z.any())
});

export const batterySchema = z.object({
  enabled: z.boolean(),
  capacityKwh: z.number().min(0.5).max(100),
  maxChargeKw: z.number().min(0.1).max(30),
  maxDischargeKw: z.number().min(0.1).max(30),
  roundTripEfficiency: z.number().min(0.5).max(1),
  initialSocPct: z.number().min(0).max(100),
  assistThresholdA: z.number().min(1).max(100),
  chargeFromGrid: z.boolean(),
  chargeFromSolar: z.boolean()
});

export const solarSchema = z.object({
  enabled: z.boolean(),
  kwp: z.number().min(0).max(100),
  orientation: orientationSchema
});

export const settingsSchema = z.object({
  voltage: z.number().min(100).max(400),
  mainFuseA: z.number().min(1).max(200)
});

export const configSchema = z.object({
  version: z.number().int(),
  appliances: z.array(applianceConfigSchema),
  battery: batterySchema,
  solar: solarSchema,
  settings: settingsSchema
});

const runtimeSchema = z.object({
  on: z.boolean(),
  startedAtSec: z.number().optional(),
  autoOffAtSec: z.number().optional()
});

const historyPointSchema = z.object({
  t: z.number(),
  loadW: z.number(),
  loadA: z.number(),
  gridW: z.number(),
  gridA: z.number(),
  solarW: z.number(),
  batteryW: z.number(),
  socPct: z.number(),
  rooms: z.record(z.string(), z.number())
});

export const stateSchema = z.object({
  version: z.number().int(),
  simTimeSec: z.number(),
  running: z.boolean(),
  speed: z.number().min(1).max(3600),
  season: seasonSchema,
  outage: z.boolean(),
  batterySocWh: z.number(),
  batteryDischarging: z.boolean(),
  appliances: z.record(z.string(), runtimeSchema),
  history: z.array(historyPointSchema),
  lastHistoryMinute: z.number()
});

export const appliancePatchSchema = z.object({
  on: z.boolean().optional(),
  config: z
    .object({
      name: z.string().min(1).optional(),
      room: z.string().min(1).optional(),
      priority: prioritySchema.optional(),
      powerFactor: z.number().min(0.1).max(2).optional(),
      params: z.record(z.string(), z.any()).optional()
    })
    .optional()
});

export const customApplianceSchema = z.object({
  name: z.string().min(1).max(60),
  room: z.string().min(1).max(40),
  kind: z.enum(['constant', 'duty']),
  watts: z.number().min(1).max(30000),
  dutyPct: z.number().min(1).max(100).optional(),
  cycleMin: z.number().min(1).max(240).optional(),
  powerFactor: z.number().min(0.1).max(2).optional(),
  priority: prioritySchema.optional()
});

export const simulationActionSchema = z.object({
  action: z.enum(['play', 'pause', 'setSpeed', 'setSeason', 'resetDay', 'resetAll', 'setTime']),
  speed: z.number().min(1).max(3600).optional(),
  season: seasonSchema.optional(),
  timeOfDaySec: z.number().min(0).max(86400).optional()
});

export const outageSchema = z.object({
  enabled: z.boolean()
});

export const sheddingSchema = z.object({
  ids: z.array(z.string())
});

export function normalizeConfig(input: unknown): AppConfig {
  const base = defaultConfig();
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return base;

  const cfg = parsed.data as AppConfig;
  const builtinDefaults = base.appliances;
  const existingById = new Map(cfg.appliances.map((a) => [a.id, a]));
  const merged: ApplianceConfig[] = builtinDefaults.map((def) => {
    const existing = existingById.get(def.id);
    if (!existing) return def;
    return {
      ...def,
      ...existing,
      params: { ...def.params, ...existing.params }
    };
  });
  const builtinIds = new Set(builtinDefaults.map((a) => a.id));
  for (const item of cfg.appliances) {
    if (!builtinIds.has(item.id)) merged.push(item);
  }

  return {
    version: APP_VERSION,
    appliances: merged,
    battery: { ...base.battery, ...cfg.battery },
    solar: { ...base.solar, ...cfg.solar },
    settings: { ...base.settings, ...cfg.settings }
  };
}

export function normalizeState(input: unknown, config: AppConfig): SimState {
  const parsed = stateSchema.safeParse(input);
  const base = defaultState(config, currentSeason());
  if (!parsed.success) return base;

  const state = parsed.data as SimState;
  const appliances: Record<string, ApplianceRuntime> = {};
  for (const appliance of config.appliances) {
    const saved = state.appliances[appliance.id];
    appliances[appliance.id] = saved
      ? {
          on: Boolean(saved.on),
          ...(typeof saved.startedAtSec === 'number'
            ? { startedAtSec: saved.startedAtSec }
            : {}),
          ...(typeof saved.autoOffAtSec === 'number'
            ? { autoOffAtSec: saved.autoOffAtSec }
            : {})
        }
      : { on: false };
  }

  const capacityWh = config.battery.capacityKwh * 1000;
  return {
    version: APP_VERSION,
    simTimeSec: Number.isFinite(state.simTimeSec) ? state.simTimeSec : base.simTimeSec,
    running: state.running,
    speed: Math.min(3600, Math.max(1, state.speed)),
    season: state.season,
    outage: state.outage,
    batterySocWh: Math.min(capacityWh, Math.max(0, state.batterySocWh)),
    batteryDischarging: state.batteryDischarging,
    appliances,
    history: state.history.slice(-HISTORY_LIMIT),
    lastHistoryMinute: Number.isFinite(state.lastHistoryMinute)
      ? state.lastHistoryMinute
      : Math.floor(state.simTimeSec / 60) - 1
  };
}
