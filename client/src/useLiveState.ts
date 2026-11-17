import { useEffect, useState } from 'react';
import type {
  AppliancePatch,
  AppConfig,
  Bootstrap,
  CustomApplianceInput,
  HistoryPoint,
  Snapshot
} from '../../shared/types';
import { type SimulationAction } from './api';
import { api } from './dataSource';

interface LiveState {
  config: AppConfig | null;
  snapshot: Snapshot | null;
  history: HistoryPoint[];
  connected: boolean;
  error: string | null;
  clearError: () => void;
  actions: {
    patchAppliance: (id: string, patch: AppliancePatch) => Promise<void>;
    addAppliance: (input: CustomApplianceInput) => Promise<string | null>;
    deleteAppliance: (id: string) => Promise<void>;
    patchBattery: (patch: Record<string, unknown>) => Promise<void>;
    patchSolar: (patch: Record<string, unknown>) => Promise<void>;
    patchSettings: (patch: Record<string, unknown>) => Promise<void>;
    simulation: (action: SimulationAction) => Promise<void>;
    setOutage: (enabled: boolean) => Promise<void>;
    applyShedding: (ids: string[]) => Promise<void>;
    refreshHistory: () => Promise<void>;
  };
}

export function useLiveState(): LiveState {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyBootstrap = (bootstrap: Bootstrap): void => {
    setConfig(bootstrap.config);
    setSnapshot(bootstrap.snapshot);
  };

  const refreshHistory = async (): Promise<void> => {
    try {
      const data = await api.history();
      setHistory(data.points);
    } catch {
      // history is non-critical
    }
  };

  const runBootstrap = async <T extends Bootstrap>(
    promise: Promise<T>
  ): Promise<T | null> => {
    try {
      const result = await promise;
      applyBootstrap(result);
      void refreshHistory();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis.');
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    api
      .bootstrap()
      .then((bootstrap) => {
        if (!cancelled) applyBootstrap(bootstrap);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Kan server niet bereiken.'
          );
        }
      });

    const closeStream = api.stream({
      onTick: (next) => setSnapshot(next),
      onConnected: setConnected
    });

    const onVisibility = (): void => {
      if (!document.hidden) {
        api
          .bootstrap()
          .then(applyBootstrap)
          .catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      closeStream();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    void refreshHistory();
    const timer = window.setInterval(() => {
      void refreshHistory();
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const actions: LiveState['actions'] = {
    patchAppliance: async (id, patch) => {
      await runBootstrap(api.patchAppliance(id, patch));
    },
    addAppliance: async (input) => {
      const result = await runBootstrap(api.addAppliance(input));
      return result?.id ?? null;
    },
    deleteAppliance: async (id) => {
      await runBootstrap(api.deleteAppliance(id));
    },
    patchBattery: async (patch) => {
      await runBootstrap(api.patchBattery(patch));
    },
    patchSolar: async (patch) => {
      await runBootstrap(api.patchSolar(patch));
    },
    patchSettings: async (patch) => {
      await runBootstrap(api.patchSettings(patch));
    },
    simulation: async (action) => {
      await runBootstrap(api.simulation(action));
    },
    setOutage: async (enabled) => {
      await runBootstrap(api.outage(enabled));
    },
    applyShedding: async (ids) => {
      await runBootstrap(api.applyShedding(ids));
    },
    refreshHistory
  };

  return {
    config,
    snapshot,
    history,
    connected,
    error,
    clearError: () => setError(null),
    actions
  };
}
