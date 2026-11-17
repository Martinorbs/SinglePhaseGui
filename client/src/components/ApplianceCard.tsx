import { useEffect, useState } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import type {
  ApplianceConfig,
  AppliancePatch,
  ApplianceParams,
  ApplianceSnapshot,
  FitResult
} from '../../../shared/types';
import {
  formatA,
  formatDuration,
  formatW,
  treadmillWatts
} from '../../../shared/calculations';
import { ApplianceIcon } from './icons';
import { Badge, NumberInput, Progress, Toggle, cx } from './ui';

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function ratedWatts(appliance: ApplianceConfig): number {
  if (appliance.kind === 'treadmill') return treadmillWatts(appliance.params);
  if (appliance.kind === 'airco') {
    return num(appliance.params.maxElectricW, 2000);
  }
  return num(appliance.params.watts);
}

function FitBadge({ fit }: { fit: FitResult }) {
  if (fit.status === 'direct') {
    return <Badge tone="teal">Past direct</Badge>;
  }
  if (fit.status === 'accu') {
    return (
      <Badge tone="amber">
        Accu nodig
        {fit.runtimeSec !== null
          ? ` · gem. ±${formatDuration(fit.runtimeSec)}`
          : ''}
      </Badge>
    );
  }
  if (fit.status === 'niet') {
    return <Badge tone="red">Past niet</Badge>;
  }
  return null;
}

function SliderRow({
  label,
  value,
  max,
  step = 1,
  display,
  onChange,
  onCommit
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  display: string;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-600">{label}</span>
        <span className="tnum font-medium text-stone-800">{display}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        className="mt-1 h-8 w-full accent-teal-700"
      />
    </div>
  );
}

function NumberRow({
  label,
  value,
  suffix,
  min,
  max,
  step = 1,
  onChange,
  onCommit
}: {
  label: string;
  value: number;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return (
      <label className="flex items-center justify-between gap-3 text-xs text-stone-600">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          <NumberInput
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={onChange}
            onBlur={onCommit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="w-20 rounded-lg px-2 py-1.5 text-right"
          />
          {suffix ? <span className="w-6 text-stone-400">{suffix}</span> : null}
        </span>
      </label>
  );
}

export function ApplianceCard({
  appliance,
  snapshot,
  fit,
  onUpdate,
  onEdit
}: {
  appliance: ApplianceConfig;
  snapshot: ApplianceSnapshot;
  fit?: FitResult;
  onUpdate: (patch: AppliancePatch) => void;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<ApplianceParams>(appliance.params);

  useEffect(() => {
    setDraft(appliance.params);
  }, [appliance.params]);

  const on = snapshot.on;
  const rated = ratedWatts(appliance);

  const commitDraft = (next: ApplianceParams = draft): void => {
    const autoOn =
      appliance.kind === 'induction' &&
      !on &&
      (next.zones ?? []).some((zone) => zone.level > 0);
    onUpdate({ on: autoOn ? true : undefined, config: { params: next } });
  };

  const setValue = (key: keyof ApplianceParams, value: unknown): void => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const zones = draft.zones ?? [];
  const units = draft.units ?? [];
  const treadmill = treadmillWatts(draft);
  const mode = draft.mode ?? 'uit';

  return (
    <article
      className={cx(
        'rounded-2xl border p-3.5 transition-colors',
        on
          ? 'border-teal-200 bg-white shadow-[0_1px_2px_rgba(15,118,110,0.06)]'
          : 'border-stone-200 bg-white'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cx(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            on ? 'bg-teal-50 text-teal-700' : 'bg-stone-100 text-stone-500'
          )}
        >
          <ApplianceIcon kind={appliance.kind} name={appliance.name} className="h-4.5 w-4.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium text-stone-900">
                {appliance.name}
              </h3>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-500">
                <span
                  className={cx(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    on ? 'bg-teal-600' : 'bg-stone-300'
                  )}
                />
                <span className="truncate">{snapshot.status}</span>
              </div>
            </div>
            <Toggle
              checked={on}
              onChange={(next) => onUpdate({ on: next })}
              label={`${appliance.name} ${on ? 'uitschakelen' : 'inschakelen'}`}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="tnum text-lg font-semibold leading-none text-stone-900">
              {on ? formatW(snapshot.watts) : `~${formatW(rated)}`}
            </span>
            <span className="tnum text-[11px] text-stone-500">
              {on ? formatA(snapshot.currentA) : 'geschat vermogen'}
            </span>
            {!on && fit ? <FitBadge fit={fit} /> : null}
          </div>

          {on && snapshot.progressPct !== undefined ? (
            <div className="mt-2">
              <Progress percent={snapshot.progressPct} tone="teal" />
              {snapshot.phaseLabel ? (
                <div className="mt-1 text-[11px] text-stone-500">
                  {snapshot.phaseLabel}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-stone-400">
              {appliance.priority === 'hoog'
                ? 'Hoge prioriteit'
                : appliance.priority === 'midden'
                  ? 'Middel prioriteit'
                  : 'Lage prioriteit'}
            </span>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="-mr-1 flex min-h-11 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-700"
              aria-expanded={expanded}
            >
              {expanded ? 'Minder' : 'Afstellen'}
              <ChevronDown
                className={cx('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
              />
            </button>
          </div>

          {expanded ? (
            <div className="mt-2 space-y-3 border-t border-stone-100 pt-3">
              {appliance.kind === 'induction' ? (
                <div className="space-y-1.5">
                  {zones.map((zone, index) => (
                    <SliderRow
                      key={`${zone.name}-${index}`}
                      label={zone.name}
                      value={zone.level}
                      max={10}
                      display={`${zone.level} · ${formatW(
                        Math.round((zone.maxW * zone.level) / 10)
                      )}`}
                      onChange={(level) =>
                        setValue(
                          'zones',
                          zones.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, level } : item
                          )
                        )
                      }
                      onCommit={() => commitDraft()}
                    />
                  ))}
                  <p className="text-[11px] text-stone-400">
                    De kookplaat schakelt automatisch in zodra een zone boven 0
                    staat.
                  </p>
                </div>
              ) : null}

              {appliance.kind === 'treadmill' ? (
                <div className="space-y-2">
                  <SliderRow
                    label="Snelheid"
                    value={num(draft.speedKmh, 8)}
                    max={20}
                    step={0.5}
                    display={`${num(draft.speedKmh, 8)} km/u`}
                    onChange={(value) => setValue('speedKmh', value)}
                    onCommit={() => commitDraft()}
                  />
                  <SliderRow
                    label="Hellingshoek"
                    value={num(draft.inclinePct, 0)}
                    max={15}
                    display={`${num(draft.inclinePct, 0)}%`}
                    onChange={(value) => setValue('inclinePct', value)}
                    onCommit={() => commitDraft()}
                  />
                  <NumberRow
                    label="Gewicht"
                    value={num(draft.weightKg, 85)}
                    suffix="kg"
                    min={40}
                    max={150}
                    onChange={(value) => setValue('weightKg', value)}
                    onCommit={() => commitDraft()}
                  />
                  <p className="text-[11px] text-stone-400">
                    Verwachting nu: {formatW(treadmill)} (incl. 10% marge).
                  </p>
                </div>
              ) : null}

              {appliance.kind === 'hue' ? (
                <SliderRow
                  label="Helderheid"
                  value={num(draft.brightnessPct, 60)}
                  max={100}
                  step={5}
                  display={`${num(draft.brightnessPct, 60)}%`}
                  onChange={(value) => setValue('brightnessPct', value)}
                  onCommit={() => commitDraft()}
                />
              ) : null}

              {appliance.kind === 'airco' ? (
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-stone-500">
                      Modus
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          ['uit', 'Uit'],
                          ['koelen', 'Koelen'],
                          ['verwarmen', 'Verwarmen']
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setValue('mode', value);
                            onUpdate(
                              value === 'uit'
                                ? { on: false, config: { params: { mode: value } } }
                                : { on: true, config: { params: { mode: value } } }
                            );
                          }}
                          className={cx(
                            'min-h-11 rounded-lg border px-2 text-xs font-medium transition-colors',
                            mode === value
                              ? 'border-teal-700 bg-teal-700 text-white'
                              : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {units.map((unit, index) => (
                    <SliderRow
                      key={`${unit.name}-${index}`}
                      label={unit.name}
                      value={unit.level}
                      max={10}
                      display={
                        unit.level === 0
                          ? 'uit'
                          : `${unit.level} · ${unit.sharePct}%`
                      }
                      onChange={(level) =>
                        setValue(
                          'units',
                          units.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, level } : item
                          )
                        )
                      }
                      onCommit={() => commitDraft()}
                    />
                  ))}
                  <p className="text-[11px] text-stone-400">
                    Drie aparte binnenunits, gezamenlijk maximaal{' '}
                    {formatW(num(draft.maxElectricW, 2000))}.
                  </p>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-stone-400">
                  {formatW(rated)} · PF {appliance.powerFactor}
                </span>
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
                >
                  <Pencil className="h-3 w-3" />
                  Bewerken
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
