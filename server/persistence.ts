import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig, SimState } from '../shared/types';
import { normalizeConfig, normalizeState } from '../shared/schema';
import { defaultConfig, defaultState } from '../shared/defaults';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const STATE_PATH = path.join(DATA_DIR, 'state.json');

async function readJson(file: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    console.warn(`[persistence] Could not read ${file}:`, error);
    return null;
  }
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await rename(tmp, file);
}

export class Persistence {
  private stateQueue: Promise<void> = Promise.resolve();

  async init(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
  }

  async loadConfig(): Promise<AppConfig> {
    const raw = await readJson(CONFIG_PATH);
    if (raw === null) return defaultConfig();
    const normalized = normalizeConfig(raw);
    const valid =
      typeof raw === 'object' && raw !== null && 'appliances' in raw;
    if (!valid) {
      console.warn('[persistence] Invalid config, using defaults.');
      return defaultConfig();
    }
    return normalized;
  }

  async loadState(config: AppConfig): Promise<SimState> {
    const raw = await readJson(STATE_PATH);
    if (raw === null) return defaultState(config);
    const normalized = normalizeState(raw, config);
    return normalized;
  }

  async saveConfig(config: AppConfig): Promise<void> {
    try {
      await writeJsonAtomic(CONFIG_PATH, config);
    } catch (error) {
      console.error('[persistence] Failed to save config:', error);
    }
  }

  saveState(state: SimState): Promise<void> {
    this.stateQueue = this.stateQueue
      .then(() => writeJsonAtomic(STATE_PATH, state))
      .catch((error) => {
        console.error('[persistence] Failed to save state:', error);
      });
    return this.stateQueue;
  }
}
