import { useEffect, useState } from 'react';
import { Sun } from 'lucide-react';
import type {
  SolarConfig,
  SolarSnapshot
} from '../../../shared/types';
import { formatW } from '../../../shared/calculations';
import {
  Badge,
  Card,
  Field,
  NumberInput,
  SectionHeading,
  Toggle,
  cx
} from './ui';

const ORIENTATIONS: Array<{ value: SolarConfig['orientation']; label: string }> = [
  { value: 'zuid', label: 'Zuid' },
  { value: 'oost', label: 'Oost' },
  { value: 'west', label: 'West' }
];

export function SolarPanel({
  solar,
  snapshot,
  onPatch
}: {
  solar: SolarConfig;
  snapshot: SolarSnapshot;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(solar);

  useEffect(() => {
    setDraft(solar);
  }, [solar]);

  const enabled = draft.enabled;

  return (
    <Card className="p-4">
      <SectionHeading
        title="Zon"
        subtitle="Toekomstscenario — nog niet aanwezig"
        right={
          <Badge tone={!enabled ? 'neutral' : snapshot.powerW > 0 ? 'amber' : 'blue'}>
            {!enabled ? 'Uit' : snapshot.powerW > 0 ? formatW(snapshot.powerW) : 'Donker'}
          </Badge>
        }
      />

      <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50/60 p-3">
        <div className="flex items-center gap-2">
          <Sun
            className={cx(
              'h-8 w-8',
              snapshot.powerW > 0 ? 'text-amber-500' : 'text-stone-400'
            )}
          />
          <div>
            <div className="tnum text-lg font-semibold leading-tight text-stone-900">
              {enabled ? formatW(snapshot.powerW) : 'Geen panelen'}
            </div>
            <div className="text-[11px] text-stone-500">
              {enabled
                ? `${snapshot.kwp.toFixed(1).replace('.', ',')} kWp · ${
                    ORIENTATIONS.find((item) => item.value === snapshot.orientation)
                      ?.label ?? snapshot.orientation
                  }`
                : 'Schakel in om een toekomstscenario te bekijken'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <label className="flex min-h-8 items-center justify-between gap-3 text-xs text-stone-600">
          Zonnepanelen simuleren
          <Toggle
            checked={draft.enabled}
            onChange={(value) => {
              setDraft((previous) => ({ ...previous, enabled: value }));
              onPatch({ enabled: value });
            }}
            label="Zonnepanelen simuleren"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Vermogen (kWp)">
            <NumberInput
              value={draft.kwp}
              min={0}
              max={20}
              step={0.1}
              disabled={!enabled}
              onChange={(kwp) =>
                setDraft((previous) => ({ ...previous, kwp }))
              }
              onBlur={() => onPatch({ kwp: draft.kwp })}
            />
          </Field>
          <Field label="Richting">
            <select
              value={draft.orientation}
              disabled={!enabled}
              onChange={(event) => {
                const orientation = event.target.value as SolarConfig['orientation'];
                setDraft((previous) => ({ ...previous, orientation }));
                onPatch({ orientation });
              }}
              className="w-full rounded-xl border border-stone-300 bg-white px-2 py-2 text-sm text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 disabled:opacity-50"
            >
              {ORIENTATIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-[11px] leading-relaxed text-stone-400">
          Berekening is seizoensafhankelijk en deterministisch. Er wordt nog
          geen rekening gehouden met bewolking of panelen op meerdere daken.
        </p>
      </div>
    </Card>
  );
}
