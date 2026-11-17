import { useEffect, useState } from 'react';
import { CheckCircle2, Unplug } from 'lucide-react';
import type {
  BatterySnapshot,
  SheddingSnapshot
} from '../../../shared/types';
import { formatA, formatW } from '../../../shared/calculations';
import {
  Badge,
  Button,
  Card,
  Progress,
  SectionHeading,
  Toggle,
  cx
} from './ui';

export function OutagePanel({
  outage,
  battery,
  shedding,
  onToggle,
  onApply
}: {
  outage: boolean;
  battery: BatterySnapshot;
  shedding: SheddingSnapshot;
  onToggle: (enabled: boolean) => void;
  onApply: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const suggestionKey = shedding.suggestions.map((item) => item.id).join(',');

  useEffect(() => {
    setSelected(shedding.suggestions.map((item) => item.id));
  }, [suggestionKey, outage]);

  const toggle = (id: string): void => {
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const selectedWatts = shedding.suggestions
    .filter((item) => selected.includes(item.id))
    .reduce((sum, item) => sum + item.watts, 0);

  return (
    <Card className="p-4">
      <SectionHeading
        title="Noodstroom"
        subtitle="Net weg? De accu neemt het over"
        right={
          <Badge tone={outage ? 'amber' : 'neutral'}>
            {outage ? 'Actief' : 'Uit'}
          </Badge>
        }
      />

      <div className="mt-3 flex items-center justify-between rounded-xl bg-stone-50 p-3">
        <div className="flex items-start gap-2">
          <Unplug
            className={cx(
              'mt-0.5 h-4 w-4',
              outage ? 'text-amber-700' : 'text-stone-400'
            )}
          />
          <div>
            <div className="text-sm font-medium text-stone-800">
              {outage ? 'Netstoring simuleren' : 'Net is normaal'}
            </div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-stone-500">
              {outage
                ? 'De accu en zon leveren. Kies welke lasten mogen blijven draaien.'
                : 'Schakel een storing in om te zien wat er nog werkt.'}
            </div>
          </div>
        </div>
        <Toggle
          checked={outage}
          onChange={onToggle}
          label="Netstoring simuleren"
        />
      </div>

      {outage ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>Accu {Math.round(battery.socPct)}%</span>
            <span className={shedding.deficitA > 0.05 ? 'text-amber-700' : 'text-teal-700'}>
              {shedding.deficitA > 0.05
                ? `${formatA(shedding.deficitA)} / ${formatW(shedding.deficitW)} tekort`
                : 'Accu en zon dekken de last'}
            </span>
          </div>
          <Progress
            percent={battery.socPct}
            tone={battery.socPct < 20 ? 'amber' : 'blue'}
          />

          {shedding.deficitA > 0.05 ? (
            <>
              <p className="text-[11px] leading-relaxed text-stone-500">
                Stel voor welke apparaten je ruimte wilt maken. Ze worden pas
                uitgeschakeld als je op toepassen drukt.
              </p>
              <div className="space-y-1">
                {shedding.suggestions.length === 0 ? (
                  <p className="rounded-lg bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
                    Geen geschikte apparaten gevonden om uit te zetten.
                  </p>
                ) : (
                  shedding.suggestions.map((suggestion) => {
                    const checked = selected.includes(suggestion.id);
                    return (
                      <label
                        key={suggestion.id}
                        className={cx(
                          'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                          checked
                            ? 'border-amber-200 bg-amber-50/60'
                            : 'border-stone-100 bg-white'
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(suggestion.id)}
                            className="h-4 w-4 accent-teal-700"
                          />
                          <span className="truncate text-stone-700">
                            {suggestion.name}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-stone-500">
                          {formatW(suggestion.watts)}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-stone-400">
                  {selected.length > 0
                    ? `${selected.length} geselecteerd · ${formatW(selectedWatts)}`
                    : 'Niets geselecteerd'}
                </span>
                <Button
                  variant="primary"
                  disabled={selected.length === 0}
                  onClick={() => onApply(selected)}
                >
                  Toepassen
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2 rounded-xl bg-teal-50/70 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
              <div>
                <p className="text-xs font-medium text-teal-900">
                  Alles kan blijven draaien
                </p>
                <p className="mt-0.5 text-[11px] text-teal-800/80">
                  De accu en eventuele zon dekken de huidige last. Houd de SOC
                  in de gaten.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}
