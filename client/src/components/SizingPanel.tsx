import { BatteryCharging, Check, TriangleAlert } from 'lucide-react';
import type { SizingSnapshot } from '../../../shared/types';
import { formatA, formatW } from '../../../shared/calculations';
import { Badge, Card, SectionHeading, cx } from './ui';

export function SizingPanel({ sizing }: { sizing: SizingSnapshot }) {
  const hasDeficit = sizing.deficitA > 0.05;

  return (
    <Card className="p-4">
      <SectionHeading
        title="Accu-afstemming"
        subtitle="Hoeveel accu heb je nodig bij dit gemiddelde verbruik?"
        right={
          hasDeficit ? (
            <Badge tone="amber">
              {formatA(sizing.deficitA)} tekort
            </Badge>
          ) : (
            <Badge tone="teal">Past</Badge>
          )
        }
      />

      {!hasDeficit ? (
        <div className="mt-3 rounded-xl bg-teal-50/70 p-3">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            <div>
              <p className="text-sm font-medium text-teal-900">
                Geen accu nodig voor deze combinatie
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-teal-800/80">
                De huidige belasting past binnen de aansluiting. Een accu kan
                later alsnog nuttig zijn voor slim laden of noodstroom.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-xl bg-amber-50/70 p-3">
            <p className="text-sm font-medium text-amber-900">
              {formatW(sizing.deficitW)} tekort op de limiet
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800/80">
              Een accu moet dit gemiddelde tekort leveren om binnen de limiet
              te blijven. Hoe lang dat nodig is, bepaalt de benodigde energie.
            </p>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-stone-100">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-stone-50 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-stone-400">
              <span>Duur</span>
              <span className="text-right">Vermogen</span>
              <span className="text-right">Energie</span>
            </div>
            {sizing.rows.map((row) => {
              const powerOk = row.requiredKw <= sizing.batteryOutputKw;
              const energyOk = row.requiredKwh <= sizing.batteryCapacityKwh;
              return (
                <div
                  key={row.hours}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-stone-100 px-3 py-2 text-xs"
                >
                  <span className="text-stone-600">
                    {row.hours === 1 ? '1 uur' : `${row.hours} uur`}
                  </span>
                  <span
                    className={cx(
                      'tnum text-right font-medium',
                      powerOk ? 'text-stone-800' : 'text-red-700'
                    )}
                  >
                    {row.requiredKw.toFixed(1).replace('.', ',')} kW
                  </span>
                  <span
                    className={cx(
                      'tnum text-right font-medium',
                      energyOk ? 'text-stone-800' : 'text-red-700'
                    )}
                  >
                    {row.requiredKwh.toFixed(1).replace('.', ',')} kWh
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
            <span>
              Huidige accu: {sizing.batteryOutputKw.toFixed(1).replace('.', ',')} kW ·{' '}
              {sizing.batteryCapacityKwh.toFixed(1).replace('.', ',')} kWh
            </span>
            {sizing.maxRuntimeSec !== null ? (
              <span>
                Max. {Math.round(sizing.maxRuntimeSec / 60)} min bij dit tekort
              </span>
            ) : null}
          </div>

          {sizing.rows.some(
            (row) =>
              row.requiredKw > sizing.batteryOutputKw ||
              row.requiredKwh > sizing.batteryCapacityKwh
          ) ? (
            <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-stone-500">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>
                Rode waarden vallen buiten de huidige accu. Pas de accu aan of
                kies een kortere duur.
              </span>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-400">
        <BatteryCharging className="h-3.5 w-3.5" />
        Berekend op basis van het gemiddelde verbruik van aangeschakelde
        apparaten, los van de actuele SOC.
      </div>
    </Card>
  );
}
