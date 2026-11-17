import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  Check,
  Clock3,
  Unplug,
  Zap
} from 'lucide-react';
import type { Snapshot } from '../../../shared/types';
import {
  formatA,
  formatDuration,
  formatKw
} from '../../../shared/calculations';
import { Badge, Card, cx } from './ui';

function CheckTile({
  label,
  detail,
  footnote,
  percent,
  ok,
  icon
}: {
  label: string;
  detail: string;
  footnote: string;
  percent: number;
  ok: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white/80 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
          <span className="text-teal-700">{icon}</span>
          {label}
        </span>
        <span
          className={cx(
            'flex h-5 w-5 items-center justify-center rounded-full',
            ok ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'
          )}
        >
          {ok ? (
            <Check className="h-3 w-3" strokeWidth={3} />
          ) : (
            <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
          )}
        </span>
      </div>
      <div className="tnum mt-2 text-sm font-semibold leading-tight text-stone-900">
        {detail}
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-500',
            ok ? 'bg-teal-600' : 'bg-red-500'
          )}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-stone-400">{footnote}</div>
    </div>
  );
}

export function Hero({ snapshot }: { snapshot: Snapshot }) {
  const { overview, battery } = snapshot;
  const noBatteryOutput = overview.batteryOutputW <= 0;

  const peakDetail = snapshot.outage
    ? 'Geen netlimiet'
    : `${formatKw(overview.peakW)} · ${formatA(overview.peakA)}`;
  const batteryNeeded = overview.surplusW > 0.5;
  const batteryDetail = !batteryNeeded
    ? 'Niet nodig'
    : noBatteryOutput
      ? 'Accu uitgeschakeld'
      : `${formatKw(overview.surplusW)} nodig · ${formatKw(overview.batteryOutputW)} max`;
  const batteryOk = !batteryNeeded || (!noBatteryOutput && overview.fitsBattery);

  const averageFitsGrid =
    !snapshot.outage && overview.averageSurplusW <= 0.5;
  const averageFromGrid = overview.gridRuntimeSec !== null;
  const activeRuntimeSec = snapshot.outage
    ? overview.batteryRuntimeSec
    : overview.gridRuntimeSec;

  let averageValue = '—';
  if (overview.averageW <= 0.5) averageValue = 'Geen verbruik';
  else if (averageFitsGrid) averageValue = 'Niet nodig';
  else if (noBatteryOutput) averageValue = 'Accu uit';
  else if (battery.socPct <= 0.5) averageValue = 'Accu leeg';
  else if (activeRuntimeSec !== null)
    averageValue = formatDuration(activeRuntimeSec);
  else averageValue = 'Te veel voor accu';

  let batteryOnlyValue = '—';
  if (snapshot.outage) batteryOnlyValue = 'Net weg';
  else if (noBatteryOutput) batteryOnlyValue = 'Accu uit';
  else if (overview.batteryRuntimeSec !== null)
    batteryOnlyValue = formatDuration(overview.batteryRuntimeSec);
  else if (overview.averageW > overview.batteryOutputW)
    batteryOnlyValue = 'Te veel voor accu';
  else batteryOnlyValue = 'Accu leeg';

  return (
    <Card className="overflow-hidden border-stone-200/70 bg-gradient-to-br from-white via-white to-teal-50/40">
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700/70">
              <Zap className="h-3.5 w-3.5" />
              Vermogen in één oogopslag
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="tnum text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                {formatKw(overview.peakW)}
              </span>
              <Badge
                tone={
                  snapshot.outage
                    ? overview.fitsBattery
                      ? 'teal'
                      : 'red'
                    : overview.fitsCombined
                      ? 'teal'
                      : 'red'
                }
              >
                {snapshot.outage
                  ? overview.fitsBattery
                    ? 'Past op accu'
                    : 'Te veel voor accu'
                  : overview.fitsCombined
                    ? 'Past binnen de limiet'
                    : 'Limiet overschreden'}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm text-stone-500">
              Piek van {overview.enabledCount}{' '}
              {overview.enabledCount === 1
                ? 'ingeschakeld apparaat'
                : 'ingeschakelde apparaten'}
              {snapshot.outage ? ' · noodstroom' : ` · ${overview.fuseA} A aansluiting`}
            </p>
          </div>

          <div
            className={cx(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium',
              snapshot.outage
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-teal-200 bg-teal-50 text-teal-800'
            )}
          >
            {snapshot.outage ? (
              <Unplug className="h-4 w-4" />
            ) : (
              <BatteryCharging className="h-4 w-4" />
            )}
            {snapshot.outage
              ? 'Netstoring'
              : `${Math.round(battery.socPct)}% in de accu`}
          </div>
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <CheckTile
            label={snapshot.outage ? 'Aansluiting' : `${overview.fuseA} A hoofdzekering`}
            detail={peakDetail}
            footnote={
              snapshot.outage
                ? 'De zekering geldt nu niet'
                : overview.fitsFuse
                  ? `${formatA(Math.max(0, overview.fuseA - overview.peakA))} ruimte over`
                  : `${formatA(overview.peakA - overview.fuseA)} erboven`
            }
            percent={snapshot.outage ? 0 : (overview.peakA / overview.fuseA) * 100}
            ok={overview.fitsFuse}
            icon={<Zap className="h-3.5 w-3.5" />}
          />
          <CheckTile
            label="Accuvermogen"
            detail={batteryDetail}
            footnote={
              noBatteryOutput
                ? 'Schakel de accu in om pieken op te vangen'
                : batteryNeeded
                  ? 'Vangt het verschil boven de zekering op'
                  : 'De zekering kan de piek zelf dragen'
            }
            percent={
              noBatteryOutput || !batteryNeeded
                ? 0
                : (overview.surplusW / overview.batteryOutputW) * 100
            }
            ok={batteryOk}
            icon={<BatteryCharging className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200/70 bg-stone-50/70 px-4 py-3.5">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              <Clock3 className="h-3.5 w-3.5 text-teal-700" />
              {averageFitsGrid
                ? 'Accu bij gemiddeld verbruik'
                : averageFromGrid && !snapshot.outage
                  ? `Accu-duur boven de ${overview.fuseA} A`
                  : 'Accu-duur bij gemiddeld verbruik'}
            </div>
            <div className="tnum mt-1 text-2xl font-semibold leading-tight text-stone-900">
              {averageValue}
            </div>
            <div className="mt-0.5 text-[11px] text-stone-500">
              {formatKw(overview.averageW)} gemiddeld ·{' '}
              {formatA(overview.averageA)}
              {averageFitsGrid
                ? ' · net draagt dit'
                : averageFromGrid && !snapshot.outage
                  ? ` · accu levert ${formatKw(overview.averageSurplusW)}`
                  : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Zonder net
            </div>
            <div className="tnum mt-1 text-sm font-semibold text-stone-700">
              {batteryOnlyValue}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
