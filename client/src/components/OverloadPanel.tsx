import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { SheddingSnapshot } from '../../../shared/types';
import { formatA, formatW } from '../../../shared/calculations';
import {
  Badge,
  Button,
  Card,
  SectionHeading,
  cx
} from './ui';

export function OverloadPanel({
  shedding,
  onApply
}: {
  shedding: SheddingSnapshot;
  onApply: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const suggestionKey = shedding.suggestions.map((item) => item.id).join(',');

  useEffect(() => {
    setSelected(shedding.suggestions.map((item) => item.id));
  }, [suggestionKey]);

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
    <Card className="border-amber-200 bg-amber-50/30 p-4">
      <SectionHeading
        title="Ruimte maken"
        subtitle={`De belasting is ${formatA(
          shedding.deficitA
        )} boven de limiet`}
        right={<Badge tone="amber">Suggestie</Badge>}
      />

      <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-stone-500">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span>
          Dit zijn de apparaten met de laagste prioriteit. Je kiest zelf wat
          uitgaat; de simulatie schakelt nooit automatisch.
        </span>
      </div>

      {shedding.suggestions.length === 0 ? (
        <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-stone-500">
          Geen geschikte apparaten gevonden. Verlaag bijvoorbeeld het vermogen
          van de loopband of inductiekookplaat.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            {shedding.suggestions.map((suggestion) => {
              const checked = selected.includes(suggestion.id);
              return (
                <label
                  key={suggestion.id}
                  className={cx(
                    'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                    checked
                      ? 'border-amber-200 bg-white'
                      : 'border-stone-100 bg-white/50'
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
                      <span className="ml-1 text-stone-400">
                        · {suggestion.room}
                      </span>
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-stone-500">
                    {formatW(suggestion.watts)}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
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
              Uitschakelen
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
