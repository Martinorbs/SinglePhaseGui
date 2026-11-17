import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Api } from '../client/src/api';

const store = new Map<string, string>();
let localApi: Api;

beforeAll(async () => {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value)
    },
    setInterval: (callback: () => void, ms: number) =>
      setInterval(callback, ms),
    clearInterval: (id: unknown) => clearInterval(id as NodeJS.Timeout)
  });
  localApi = (await import('../client/src/localApi')).localApi;
});

describe('local API', () => {
  it('runs the simulation and stores state in the browser', async () => {
    const initial = await localApi.bootstrap();
    expect(initial.snapshot.overview.enabledCount).toBeGreaterThan(0);

    const next = await localApi.patchAppliance('kettle', { on: true });
    expect(next.snapshot.appliances.kettle.on).toBe(true);
    expect(store.has('stroombalans.v1')).toBe(true);

    const history = await localApi.history();
    expect(history.points.length).toBeGreaterThan(0);
  });
});
