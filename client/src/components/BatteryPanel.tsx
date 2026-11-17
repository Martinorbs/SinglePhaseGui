import { useEffect, useState } from 'react';
import { BatteryCharging } from 'lucide-react';
import type {
  BatteryConfig,
  BatterySnapshot
} from '../../../shared/types';
import { formatDuration, formatW } from '../../../shared/calculations';
import {
  Badge,
  Card,
  Field,
  NumberInput,
  Progress,
  SectionHeading,
  Toggle
} from './ui';

export function BatteryPanel({
  battery,
  snapshot,
  onPatch
}: {
  battery: BatteryConfig;
  snapshot: BatterySnapshot;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(battery);

  useEffect(() => {
    setDraft(battery);
  }, [battery]);

  const setNumber = (
    key: keyof BatteryConfig,
    value: number
  ): void => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const commit = (key: keyof BatteryConfig): void => {
    onPatch({ [key]: draft[key] });
  };

  const setToggle = (key: keyof BatteryConfig, value: boolean): void => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    onPatch({ [key]: value });
  };

  const plannedRuntime = snapshot.expectedRuntimeSec;
  const hasPlannedRuntime = plannedRuntime !== null;

  return (
    <Card className="p-4">
      <SectionHeading
        title="Accu"
        subtitle="Ondersteunt alleen bij hoge belasting"
        right={
          <Badge
            tone={
              !snapshot.enabled
                ? 'neutral'
                : hasPlannedRuntime
                  ? 'amber'
                  : snapshot.statusKey.startsWith('laden')
                    ? 'blue'
                    : 'teal'
            }
          >
            {snapshot.status}
          </Badge>
        }
      />

      <div className="mt-3 rounded-xl bg-stone-50 p-3">
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <BatteryCharging className="h-3.5 w-3.5 text-cyan-700" />
            Laadstatus
          </span>
          <span className="tnum font-medium text-stone-800">
            {snapshot.socKwh.toFixed(1).replace('.', ',')} /{' '}
            {snapshot.capacityKwh.toFixed(1).replace('.', ',')} kWh
          </span>
        </div>
        <div className="mt-1 flex items-end justify-between">
          <span className="tnum text-2xl font-semibold text-stone-900">
            {Math.round(snapshot.socPct)}%
          </span>
          <span className="tnum text-xs text-stone-500">
            {snapshot.powerW === 0
              ? 'geen vermogen'
              : snapshot.dischargeW > 0
                ? `${formatW(snapshot.dischargeW)} ontladen`
                : `${formatW(snapshot.chargeW)} laden`}
          </span>
        </div>
        <Progress
          percent={snapshot.socPct}
          tone={snapshot.socPct < 20 ? 'amber' : 'blue'}
          className="mt-2"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
          {!snapshot.enabled
            ? 'De accu staat uit. Schakel hem aan om hoge pieken op te vangen.'
            : plannedRuntime !== null
              ? `Gemiddeld nog ongeveer ${formatDuration(plannedRuntime)}${
                  snapshot.expectedEmptyAtClock
                    ? ` · leeg rond ${snapshot.expectedEmptyAtClock}`
                    : ''
                }.`
              : snapshot.runtimeSec !== null
                ? `Nu ongeveer ${formatDuration(snapshot.runtimeSec)}${
                    snapshot.emptyAtClock
                      ? ` · leeg rond ${snapshot.emptyAtClock}`
                      : ''
                  } bij deze piek.`
                : snapshot.chargeW > 0 && snapshot.fullAtClock
                  ? `Vol rond ${snapshot.fullAtClock}.`
                  : snapshot.statusKey === 'vol'
                    ? 'De accu is vol geladen en kan direct bijspringen.'
                    : 'De accu is stand-by. Bij een hoge belasting springt hij bij.'}
        </p>
      </div>

      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-stone-700">
              Accu inschakelen
            </div>
            <div className="text-[11px] text-stone-400">
              Noodstroom alleen op de geselecteerde lasten
            </div>
          </div>
          <Toggle
            checked={draft.enabled}
            onChange={(value) => setToggle('enabled', value)}
            label="Accu inschakelen"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Capaciteit">
            <NumberInput
              value={draft.capacityKwh}
              min={1}
              max={30}
              step={0.5}
              onChange={(value) => setNumber('capacityKwh', value)}
              onBlur={() => commit('capacityKwh')}
            />
          </Field>
          <Field label="Max. ontladen">
            <NumberInput
              value={draft.maxDischargeKw}
              min={0.5}
              max={10}
              step={0.1}
              onChange={(value) => setNumber('maxDischargeKw', value)}
              onBlur={() => commit('maxDischargeKw')}
            />
          </Field>
          <Field label="Max. laden">
            <NumberInput
              value={draft.maxChargeKw}
              min={0.5}
              max={10}
              step={0.1}
              onChange={(value) => setNumber('maxChargeKw', value)}
              onBlur={() => commit('maxChargeKw')}
            />
          </Field>
          <Field label="Rendement" hint="Rond 90%">
            <NumberInput
              value={Math.round(draft.roundTripEfficiency * 100)}
              min={70}
              max={100}
              step={1}
              onChange={(value) =>
                setNumber(
                  'roundTripEfficiency',
                  Math.min(1, Math.max(0.7, value / 100))
                )
              }
              onBlur={() => commit('roundTripEfficiency')}
            />
          </Field>
          <Field label="Start-SOC" hint="Alleen bij reset">
            <NumberInput
              value={draft.initialSocPct}
              min={0}
              max={100}
              step={5}
              onChange={(value) => setNumber('initialSocPct', value)}
              onBlur={() => commit('initialSocPct')}
            />
          </Field>
          <Field label="Drempel" hint="A vanaf wanneer bijspringen">
            <NumberInput
              value={draft.assistThresholdA}
              min={25}
              max={35}
              step={1}
              onChange={(value) => setNumber('assistThresholdA', value)}
              onBlur={() => commit('assistThresholdA')}
            />
          </Field>
        </div>

        <div className="space-y-2 rounded-xl border border-stone-100 p-2.5">
          <label className="flex min-h-8 items-center justify-between gap-3 text-xs text-stone-600">
            Laden vanaf het net
            <Toggle
              checked={draft.chargeFromGrid}
              onChange={(value) => setToggle('chargeFromGrid', value)}
              label="Laden vanaf het net"
            />
          </label>
          <label className="flex min-h-8 items-center justify-between gap-3 text-xs text-stone-600">
            Laden vanaf zon
            <Toggle
              checked={draft.chargeFromSolar}
              onChange={(value) => setToggle('chargeFromSolar', value)}
              label="Laden vanaf zon"
            />
          </label>
        </div>
        <p className="text-[11px] leading-relaxed text-stone-400">
          Geen reserve voor noodgevallen: bij een storing gebruikt de accu
          dezelfde SOC-grens als normaal.
        </p>
      </div>
    </Card>
  );
}
