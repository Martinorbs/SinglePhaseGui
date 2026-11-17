import type {
  AppliancePatch,
  Bootstrap,
  CustomApplianceInput,
  HistoryPoint,
  Season
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

export const api = {
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  history: () => request<{ points: HistoryPoint[] }>('/api/history'),
  patchAppliance: (id: string, patch: AppliancePatch) =>
    request<Bootstrap>(`/api/appliances/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }),
  addAppliance: (input: CustomApplianceInput) =>
    request<Bootstrap & { id: string }>('/api/appliances', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  deleteAppliance: (id: string) =>
    request<Bootstrap>(`/api/appliances/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
  patchBattery: (patch: Record<string, unknown>) =>
    request<Bootstrap>('/api/battery', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }),
  patchSolar: (patch: Record<string, unknown>) =>
    request<Bootstrap>('/api/solar', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }),
  patchSettings: (patch: Record<string, unknown>) =>
    request<Bootstrap>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }),
  simulation: (action: SimulationAction) =>
    request<Bootstrap>('/api/simulation', {
      method: 'POST',
      body: JSON.stringify(action)
    }),
  outage: (enabled: boolean) =>
    request<Bootstrap>('/api/outage', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }),
  applyShedding: (ids: string[]) =>
    request<Bootstrap>('/api/shedding/apply', {
      method: 'POST',
      body: JSON.stringify({ ids })
    })
};
