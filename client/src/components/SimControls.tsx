import { Pause, Play, RotateCcw, Settings } from 'lucide-react';
import type { Snapshot } from '../../../shared/types';
import { SEASONS, SPEED_OPTIONS } from '../../../shared/defaults';
import { Button, Card } from './ui';
import type { SimulationAction } from '../api';
import { formatClock } from '../../../shared/calculations';

export function SimControls({
  snapshot,
  onSimulation,
  onOpenSettings
}: {
  snapshot: Snapshot;
  onSimulation: (action: SimulationAction) => void;
  onOpenSettings: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-2 p-2.5 sm:p-3">
      <Button
        variant={snapshot.running ? 'secondary' : 'primary'}
        onClick={() =>
          onSimulation({ action: snapshot.running ? 'pause' : 'play' })
        }
        aria-label={snapshot.running ? 'Pauzeer simulatie' : 'Start simulatie'}
        className="min-w-[108px]"
      >
        {snapshot.running ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {snapshot.running ? 'Pauzeer' : 'Start'}
      </Button>

      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
          Tijd
        </span>
        <span className="tnum text-sm font-semibold text-stone-800">
          {formatClock(snapshot.simTimeSec)}
        </span>
      </div>

      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white pl-2.5 pr-1 text-sm text-stone-600">
        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
          Snelheid
        </span>
        <select
          value={snapshot.speed}
          onChange={(event) =>
            onSimulation({
              action: 'setSpeed',
              speed: Number(event.target.value)
            })
          }
          className="h-11 rounded-lg bg-transparent px-1 text-sm font-semibold text-stone-800 outline-none"
          aria-label="Simulatiesnelheid"
        >
          {SPEED_OPTIONS.map((speed) => (
            <option key={speed} value={speed}>
              {speed}×
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white pl-2.5 pr-1 text-sm text-stone-600">
        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
          Seizoen
        </span>
        <select
          value={snapshot.season}
          onChange={(event) =>
            onSimulation({
              action: 'setSeason',
              season: event.target.value as Snapshot['season']
            })
          }
          className="h-11 rounded-lg bg-transparent px-1 text-sm font-semibold text-stone-800 outline-none"
          aria-label="Seizoen"
        >
          {SEASONS.map((season) => (
            <option key={season.value} value={season.value}>
              {season.label}
            </option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => onSimulation({ action: 'resetDay' })}
          aria-label="Reset dag"
          title="Reset dag"
          className="min-w-11 px-2.5"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Reset dag</span>
        </Button>
        <Button
          variant="ghost"
          onClick={onOpenSettings}
          aria-label="Instellingen"
          title="Instellingen"
          className="min-w-11 px-2.5"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
