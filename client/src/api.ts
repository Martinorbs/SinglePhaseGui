import type {
  AppliancePatch,
  Bootstrap,
  CustomApplianceInput,
  HistoryPoint,
  Season,
  Snapshot
} from '../../shared/types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    let message = `Serverfout (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

export type SimulationAction =
  | { action: 'play' | 'pause' | 'resetDay' | 'resetAll' }
  | { action: 'setSpeed'; speed: number }
  | { action: 'setSeason'; season: Season }
  | { action: 'setTime'; timeOfDaySec: number };

export interface StreamHandlers {
  onTick: (snapshot: Snapshot) => void;
  onConnected: (connected: boolean) => void;
}

export interface Api {
  bootstrap: () => Promise<Bootstrap>;
  history: () => Promise<{ points: HistoryPoint[] }>;
  patchAppliance: (id: string, patch: AppliancePatch) => Promise<Bootstrap>;
  addAppliance: (
    input: CustomApplianceInput
  ) => Promise<Bootstrap & { id: string }>;
  deleteAppliance: (id: string) => Promise<Bootstrap>;
  patchBattery: (patch: Record<string, unknown>) => Promise<Bootstrap>;
  patchSolar: (patch: Record<string, unknown>) => Promise<Bootstrap>;
  patchSettings: (patch: Record<string, unknown>) => Promise<Bootstrap>;
  simulation: (action: SimulationAction) => Promise<Bootstrap>;
  outage: (enabled: boolean) => Promise<Bootstrap>;
  applyShedding: (ids: string[]) => Promise<Bootstrap>;
  stream: (handlers: StreamHandlers) => () => void;
}

export const remoteApi: Api = {
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  history: () => request<{ points: HistoryPoint[] }>('/api/history'),
  patchAppliance: (id, patch) =>
    request<Bootstrap>(`/api/appliances/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }),
  addAppliance: (input) =>
    request<Bootstrap & { id: string }>('/api/appliances', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  deleteAppliance: (id) =>
    request<Bootstrap>(`/api/appliances/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
  patchBattery: (patch) =>
    request<Bootstrap>('/api/battery', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }),
  patchSolar: (patch) =>
    request<Bootstrap>('/api/solar', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }),
  patchSettings: (patch) =>
    request<Bootstrap>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }),
  simulation: (action) =>
    request<Bootstrap>('/api/simulation', {
      method: 'POST',
      body: JSON.stringify(action)
    }),
  outage: (enabled) =>
    request<Bootstrap>('/api/outage', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }),
  applyShedding: (ids) =>
    request<Bootstrap>('/api/shedding/apply', {
      method: 'POST',
      body: JSON.stringify({ ids })
    }),
  stream: ({ onTick, onConnected }) => {
    const source = new EventSource('/api/stream');
    source.addEventListener('open', () => onConnected(true));
    source.addEventListener('error', () => onConnected(false));
    source.addEventListener('tick', (event) => {
      try {
        onTick(JSON.parse((event as MessageEvent).data) as Snapshot);
      } catch {
        // ignore malformed tick
      }
    });
    return () => source.close();
  }
};
