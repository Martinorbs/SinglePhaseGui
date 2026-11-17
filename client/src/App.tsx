import { useState } from 'react';
import { Settings, Wifi, WifiOff, X } from 'lucide-react';
import { useLiveState } from './useLiveState';
import { isStatic } from './dataSource';
import { Hero } from './components/Hero';
import { SimControls } from './components/SimControls';
import { ApplianceSections } from './components/ApplianceSections';
import { BatteryPanel } from './components/BatteryPanel';
import { SolarPanel } from './components/SolarPanel';
import { SizingPanel } from './components/SizingPanel';
import { OutagePanel } from './components/OutagePanel';
import { OverloadPanel } from './components/OverloadPanel';
import { Charts } from './components/Charts';
import { SettingsSheet } from './components/SettingsSheet';
import { Badge, Button, Card, cx } from './components/ui';

export default function App() {
  const {
    config,
    snapshot,
    history,
    connected,
    error,
    clearError,
    actions
  } = useLiveState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [initialEditId, setInitialEditId] = useState<string | null>(null);

  if (!config || !snapshot) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Card className="w-full max-w-sm p-6 text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-pulse rounded-full bg-teal-100" />
          <h1 className="text-base font-semibold text-stone-900">
            Stroombalans
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {error ?? 'Simulatie wordt geladen…'}
          </p>
          {error ? (
            <Button
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Opnieuw proberen
            </Button>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-8">
      <header className="mx-auto flex max-w-6xl items-start justify-between gap-3 px-3 pb-2 pt-4 sm:px-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-stone-900">
              Stroombalans
            </h1>
            <Badge tone="neutral">Simulatie</Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-stone-500">
            1×{config.settings.voltage} V · {config.settings.mainFuseA} A
            hoofdzekering · {isStatic ? 'in je browser' : 'lokaal op je netwerk'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cx(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset',
              connected
                ? 'bg-teal-50 text-teal-800 ring-teal-200'
                : 'bg-stone-100 text-stone-500 ring-stone-200'
            )}
          >
            {connected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {connected ? 'Live' : 'Verbinden'}
          </span>
          <Button
            variant="ghost"
            onClick={() => {
              setInitialEditId(null);
              setSettingsOpen(true);
            }}
            aria-label="Instellingen"
            title="Instellingen"
            className="h-11 w-11 px-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-3 px-3 sm:px-4">
        <SimControls
          snapshot={snapshot}
          onSimulation={(action) => void actions.simulation(action)}
          onOpenSettings={() => {
            setInitialEditId(null);
            setSettingsOpen(true);
          }}
        />

        <Hero snapshot={snapshot} />

        {!snapshot.outage && snapshot.totals.overLimit ? (
          <OverloadPanel
            shedding={snapshot.shedding}
            onApply={(ids) => void actions.applyShedding(ids)}
          />
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="min-w-0 space-y-3">
            <ApplianceSections
              config={config}
              snapshot={snapshot}
              onUpdate={(id, patch) =>
                void actions.patchAppliance(id, patch)
              }
              onEdit={(id) => {
                setInitialEditId(id);
                setSettingsOpen(true);
              }}
            />
            <Charts
              history={history}
              config={config}
              snapshot={snapshot}
            />
          </div>

          <aside className="space-y-3">
            <BatteryPanel
              battery={config.battery}
              snapshot={snapshot.battery}
              onPatch={(patch) => void actions.patchBattery(patch)}
            />
            {!snapshot.outage ? <SizingPanel sizing={snapshot.sizing} /> : null}
            <SolarPanel
              solar={config.solar}
              snapshot={snapshot.solar}
              onPatch={(patch) => void actions.patchSolar(patch)}
            />
            <OutagePanel
              outage={snapshot.outage}
              battery={snapshot.battery}
              shedding={snapshot.shedding}
              onToggle={(enabled) => void actions.setOutage(enabled)}
              onApply={(ids) => void actions.applyShedding(ids)}
            />
          </aside>
        </div>

        <footer className="px-1 pt-2 text-center text-[10px] leading-relaxed text-stone-400">
          Stroombalans simuleert met vaste profielen. Gebruik het als
          inzicht, niet als vervanging van je groepenkast of installateur.
        </footer>
      </main>

      {settingsOpen ? (
        <SettingsSheet
          config={config}
          initialEditId={initialEditId}
          onClose={() => {
            setSettingsOpen(false);
            setInitialEditId(null);
          }}
          onUpdateAppliance={(id, patch) =>
            actions.patchAppliance(id, patch)
          }
          onAddAppliance={(input) => actions.addAppliance(input)}
          onDeleteAppliance={(id) => actions.deleteAppliance(id)}
          onPatchSettings={(patch) => actions.patchSettings({ ...patch })}
          onSimulation={(action) => actions.simulation(action)}
        />
      ) : null}

      {error ? (
        <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md">
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs text-red-800 shadow-lg">
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="rounded p-0.5 hover:bg-red-50"
              aria-label="Foutmelding sluiten"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
