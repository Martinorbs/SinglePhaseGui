import { SimulationEngine } from '../../server/simulation/engine';
import { defaultConfig, defaultState } from '../../shared/defaults';
import {
  appliancePatchSchema,
  batterySchema,
  customApplianceSchema,
  normalizeConfig,
  normalizeState,
  outageSchema,
  settingsSchema,
  sheddingSchema,
  simulationActionSchema,
  solarSchema
} from '../../shared/schema';
import type {
  AppConfig,
  Bootstrap,
  SimState,
  Snapshot
} from '../../shared/types';
import {
  ApiError,
  type Api,
  type SimulationAction,
  type StreamHandlers
} from './api';

const STORAGE_KEY = 'stroombalans.v1';

interface StoredData {
  config: AppConfig;
  state: SimState;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStored(): StoredData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredData>;
    if (!parsed.config || !parsed.state) return null;
    const config = normalizeConfig(parsed.config);
    return { config, state: normalizeState(parsed.state, config) };
  } catch {
    return null;
  }
}

function createEngine(): SimulationEngine {
  const stored = readStored();
  const config = stored?.config ?? defaultConfig();
  const state = stored?.state ?? defaultState(config);
  return new SimulationEngine(config, state);
}

const engine = createEngine();
const listeners = new Set<(snapshot: Snapshot) => void>();
let advanceTimer: number | null = null;
let streamTimer: number | null = null;

function save(): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ config: engine.config, state: engine.state })
    );
  } catch {
    // storage can be unavailable in private browsing
  }
}

function emit(): void {
  const snapshot = engine.snapshot();
  for (const listener of listeners) listener(snapshot);
}

function startTimers(): void {
  if (advanceTimer === null) {
    advanceTimer = window.setInterval(() => engine.advance(0.25), 250);
  }
  if (streamTimer === null) {
    streamTimer = window.setInterval(() => {
      if (listeners.size > 0) emit();
    }, 500);
  }
}

function stopTimers(): void {
  if (advanceTimer !== null) {
    window.clearInterval(advanceTimer);
    advanceTimer = null;
  }
  if (streamTimer !== null) {
    window.clearInterval(streamTimer);
    streamTimer = null;
  }
}

function invalid(): never {
  throw new ApiError('Ongeldige invoer.', 400);
}

function result(): Bootstrap {
  save();
  emit();
  return clone({ config: engine.config, snapshot: engine.snapshot() });
}

export const localApi: Api = {
  bootstrap: async () => result(),
  history: async () => clone({ points: engine.state.history }),
  patchAppliance: async (id, patch) => {
    const parsed = appliancePatchSchema.safeParse(patch);
    if (!parsed.success) invalid();
    let changed = false;
    if (parsed.data.on !== undefined) {
      changed = engine.setApplianceOn(id, parsed.data.on) || changed;
    }
    if (parsed.data.config) {
      changed = engine.patchAppliance(id, parsed.data.config) || changed;
    }
    if (!changed) throw new ApiError('Apparaat niet gevonden.', 404);
    return result();
  },
  addAppliance: async (input) => {
    const parsed = customApplianceSchema.safeParse(input);
    if (!parsed.success) invalid();
    const id = engine.addCustomAppliance({
      ...parsed.data,
      kind: parsed.data.kind,
      dutyPct: parsed.data.dutyPct,
      cycleMin: parsed.data.cycleMin
    });
    return { id, ...result() };
  },
  deleteAppliance: async (id) => {
    if (!engine.deleteCustomAppliance(id)) {
      throw new ApiError('Alleen aangepaste apparaten kunnen worden verwijderd.', 400);
    }
    return result();
  },
  patchBattery: async (patch) => {
    const parsed = batterySchema.partial().safeParse(patch);
    if (!parsed.success) invalid();
    engine.patchBattery(parsed.data);
    return result();
  },
  patchSolar: async (patch) => {
    const parsed = solarSchema.partial().safeParse(patch);
    if (!parsed.success) invalid();
    engine.patchSolar(parsed.data);
    return result();
  },
  patchSettings: async (patch) => {
    const parsed = settingsSchema.partial().safeParse(patch);
    if (!parsed.success) invalid();
    engine.patchSettings(parsed.data);
    return result();
  },
  simulation: async (action: SimulationAction) => {
    const parsed = simulationActionSchema.safeParse(action);
    if (!parsed.success) invalid();
    const data = parsed.data;
    switch (data.action) {
      case 'play':
        engine.setRunning(true);
        break;
      case 'pause':
        engine.setRunning(false);
        break;
      case 'setSpeed':
        if (data.speed !== undefined) engine.setSpeed(data.speed);
        break;
      case 'setSeason':
        if (data.season) engine.setSeason(data.season);
        break;
      case 'setTime':
        if (data.timeOfDaySec !== undefined) {
          engine.setTimeOfDay(data.timeOfDaySec);
        }
        break;
      case 'resetDay':
        engine.resetDay();
        break;
      case 'resetAll':
        engine.resetAll();
        break;
    }
    return result();
  },
  outage: async (enabled) => {
    const parsed = outageSchema.safeParse({ enabled });
    if (!parsed.success) invalid();
    engine.setOutage(parsed.data.enabled);
    return result();
  },
  applyShedding: async (ids) => {
    const parsed = sheddingSchema.safeParse({ ids });
    if (!parsed.success) invalid();
    engine.applyShedding(parsed.data.ids);
    return result();
  },
  stream: ({ onTick, onConnected }: StreamHandlers) => {
    const listener = (snapshot: Snapshot) => onTick(snapshot);
    listeners.add(listener);
    onConnected(true);
    listener(engine.snapshot());
    startTimers();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) stopTimers();
    };
  }
};
