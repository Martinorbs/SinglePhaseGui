import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  Plus,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import type {
  AppConfig,
  ApplianceConfig,
  ApplianceParams,
  AppliancePatch,
  CustomApplianceInput,
  Priority
} from '../../../shared/types';
import { formatW } from '../../../shared/calculations';
import type { SimulationAction } from '../api';
import { ApplianceIcon } from './icons';
import {
  Badge,
  Button,
  Field,
  NumberInput,
  cx,
  inputClass
} from './ui';

type Tab = 'appliances' | 'settings';

interface EditForm {
  name: string;
  room: string;
  priority: Priority;
  powerFactor: number;
  params: ApplianceParams;
}

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'hoog', label: 'Hoog — nooit zomaar uit' },
  { value: 'midden', label: 'Middel — bespreekbaar' },
  { value: 'laag', label: 'Laag — als eerste uit' }
];

function ParamField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <NumberInput
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
      />
    </Field>
  );
}

export function SettingsSheet({
  config,
  initialEditId,
  onClose,
  onUpdateAppliance,
  onAddAppliance,
  onDeleteAppliance,
  onPatchSettings,
  onSimulation
}: {
  config: AppConfig;
  initialEditId?: string | null;
  onClose: () => void;
  onUpdateAppliance: (id: string, patch: AppliancePatch) => Promise<void>;
  onAddAppliance: (input: CustomApplianceInput) => Promise<string | null>;
  onDeleteAppliance: (id: string) => Promise<void>;
  onPatchSettings: (patch: {
    voltage?: number;
    mainFuseA?: number;
  }) => Promise<void>;
  onSimulation: (action: SimulationAction) => Promise<void>;
}) {
  const initialAppliance = initialEditId
    ? config.appliances.find((item) => item.id === initialEditId)
    : undefined;
  const [tab, setTab] = useState<Tab>('appliances');
  const [editingId, setEditingId] = useState<string | null>(
    initialAppliance?.id ?? null
  );
  const [form, setForm] = useState<EditForm | null>(
    initialAppliance
      ? {
          name: initialAppliance.name,
          room: initialAppliance.room,
          priority: initialAppliance.priority,
          powerFactor: initialAppliance.powerFactor,
          params: { ...initialAppliance.params }
        }
      : null
  );
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<CustomApplianceInput>({
    name: '',
    room: 'Overig',
    kind: 'constant',
    watts: 100,
    dutyPct: 50,
    cycleMin: 15,
    powerFactor: 1,
    priority: 'laag'
  });
  const [fuse, setFuse] = useState(config.settings);

  useEffect(() => {
    setFuse(config.settings);
  }, [config.settings]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const startEdit = (appliance: ApplianceConfig): void => {
    setEditingId(appliance.id);
    setForm({
      name: appliance.name,
      room: appliance.room,
      priority: appliance.priority,
      powerFactor: appliance.powerFactor,
      params: { ...appliance.params }
    });
  };

  const setParam = (key: string, value: unknown): void => {
    setForm((previous) =>
      previous
        ? { ...previous, params: { ...previous.params, [key]: value } }
        : previous
    );
  };

  const saveAppliance = async (): Promise<void> => {
    if (!editingId || !form) return;
    await onUpdateAppliance(editingId, {
      config: {
        name: form.name.trim() || 'Naamloos apparaat',
        room: form.room.trim() || 'Overig',
        priority: form.priority,
        powerFactor: Math.min(1, Math.max(0.5, form.powerFactor)),
        params: form.params
      }
    });
    setEditingId(null);
    setForm(null);
  };

  const submitAdd = async (): Promise<void> => {
    if (!addForm.name.trim()) return;
    await onAddAppliance({
      ...addForm,
      name: addForm.name.trim(),
      room: addForm.room.trim() || 'Overig'
    });
    setAdding(false);
    setAddForm({
      name: '',
      room: 'Overig',
      kind: 'constant',
      watts: 100,
      dutyPct: 50,
      cycleMin: 15,
      powerFactor: 1,
      priority: 'laag'
    });
  };

  const editing = editingId
    ? config.appliances.find((item) => item.id === editingId)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Instellingen"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-stone-50 shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            {editing || adding ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(null);
                  setAdding(false);
                }}
                className="flex min-h-11 items-center gap-1 rounded-lg px-1.5 text-sm text-stone-600 hover:bg-stone-100"
              >
                <ChevronLeft className="h-4 w-4" />
                Terug
              </button>
            ) : (
              <h2 className="text-base font-semibold text-stone-900">
                Instellingen
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="flex h-11 w-11 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {!editing && !adding ? (
          <div className="flex gap-1 border-b border-stone-200 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => setTab('appliances')}
              className={cx(
                'min-h-11 flex-1 rounded-lg px-3 text-xs font-medium',
                tab === 'appliances'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              )}
            >
              Apparaten
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={cx(
                'min-h-11 flex-1 rounded-lg px-3 text-xs font-medium',
                tab === 'settings'
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              )}
            >
              Aansluiting
            </button>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto p-4">
          {editing && form ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-stone-800">
                  {editing.name} bewerken
                </h3>
                <p className="text-[11px] text-stone-500">
                  Wijzigingen gelden direct voor de simulatie.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Naam">
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Ruimte">
                  <input
                    value={form.room}
                    onChange={(event) =>
                      setForm({ ...form, room: event.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Prioriteit">
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        priority: event.target.value as Priority
                      })
                    }
                    className={inputClass}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Powerfactor" hint="Tussen 0,5 en 1,0">
                  <NumberInput
                    value={form.powerFactor}
                    min={0.5}
                    max={1}
                    step={0.01}
                    fallback={1}
                    onChange={(powerFactor) =>
                      setForm({ ...form, powerFactor })
                    }
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {editing.kind === 'airco' ? (
                  <ParamField
                    label="Max. elektrisch (W)"
                    value={Number(form.params.maxElectricW ?? 2000)}
                    min={100}
                    step={50}
                    onChange={(value) => setParam('maxElectricW', value)}
                  />
                ) : (
                  <ParamField
                    label="Vermogen (W)"
                    value={Number(form.params.watts ?? 0)}
                    min={0}
                    step={10}
                    onChange={(value) => setParam('watts', value)}
                  />
                )}

                {['duty', 'fridge', 'airfryer', 'oven'].includes(
                  editing.kind
                ) ? (
                  <ParamField
                    label="Inschakelduur (%)"
                    value={Number(form.params.dutyPct ?? 50)}
                    min={1}
                    max={100}
                    onChange={(value) => setParam('dutyPct', value)}
                  />
                ) : null}
                {['duty', 'fridge', 'airfryer', 'oven'].includes(editing.kind) ? (
                  <ParamField
                    label="Cyclus (min)"
                    value={Number(form.params.cycleMin ?? 15)}
                    min={1}
                    onChange={(value) => setParam('cycleMin', value)}
                  />
                ) : null}
                {editing.kind === 'fridge' ? (
                  <ParamField
                    label="Offset (min)"
                    value={Number(form.params.offsetMin ?? 0)}
                    min={0}
                    max={60}
                    onChange={(value) => setParam('offsetMin', value)}
                  />
                ) : null}
                {editing.kind === 'oven' ? (
                  <>
                    <ParamField
                      label="Voorwarmen (min)"
                      value={Number(form.params.preheatMin ?? 8)}
                      min={0}
                      onChange={(value) => setParam('preheatMin', value)}
                    />
                    <ParamField
                      label="Vermogen na voorwarmen (%)"
                      value={Number(form.params.dutyAfterPreheatPct ?? 55)}
                      min={1}
                      max={100}
                      onChange={(value) =>
                        setParam('dutyAfterPreheatPct', value)
                      }
                    />
                  </>
                ) : null}
                {['timer', 'airfryer'].includes(editing.kind) ? (
                  <ParamField
                    label="Automatisch uit (min)"
                    value={Number(form.params.autoOffMin ?? 10)}
                    min={1}
                    onChange={(value) => setParam('autoOffMin', value)}
                  />
                ) : null}
                {editing.kind === 'coffee' ? (
                  <>
                    <ParamField
                      label="Zetduur (min)"
                      value={Number(form.params.brewMin ?? 2)}
                      min={1}
                      onChange={(value) => setParam('brewMin', value)}
                    />
                    <ParamField
                      label="Warmhoudvermogen (W)"
                      value={Number(form.params.keepWarmW ?? 60)}
                      min={0}
                      onChange={(value) => setParam('keepWarmW', value)}
                    />
                    <ParamField
                      label="Warmhouden (min)"
                      value={Number(form.params.keepWarmMin ?? 10)}
                      min={0}
                      onChange={(value) => setParam('keepWarmMin', value)}
                    />
                  </>
                ) : null}
                {['washer', 'dryer', 'dishwasher'].includes(editing.kind) ? (
                  <ParamField
                    label="Programmaduur (min)"
                    value={Number(form.params.durationMin ?? 120)}
                    min={10}
                    onChange={(value) => setParam('durationMin', value)}
                  />
                ) : null}
                {editing.kind === 'treadmill' ? (
                  <>
                    <ParamField
                      label="Basisvermogen (W)"
                      value={Number(form.params.baseW ?? 200)}
                      min={0}
                      onChange={(value) => setParam('baseW', value)}
                    />
                    <ParamField
                      label="Per km/u (W)"
                      value={Number(form.params.perKmh ?? 105)}
                      min={0}
                      onChange={(value) => setParam('perKmh', value)}
                    />
                    <ParamField
                      label="Gewicht (kg)"
                      value={Number(form.params.weightKg ?? 85)}
                      min={40}
                      max={150}
                      onChange={(value) => setParam('weightKg', value)}
                    />
                    <ParamField
                      label="Marge (%)"
                      value={Number(form.params.marginPct ?? 10)}
                      min={0}
                      max={30}
                      onChange={(value) => setParam('marginPct', value)}
                    />
                  </>
                ) : null}
                {editing.kind === 'airco' ? (
                  <>
                    <ParamField
                      label="Koelvermogen (kW)"
                      value={Number(form.params.coolingKw ?? 5)}
                      min={0}
                      step={0.5}
                      onChange={(value) => setParam('coolingKw', value)}
                    />
                    <ParamField
                      label="Verwarmingsvermogen (kW)"
                      value={Number(form.params.heatingKw ?? 5)}
                      min={0}
                      step={0.5}
                      onChange={(value) => setParam('heatingKw', value)}
                    />
                    <ParamField
                      label="EER"
                      value={Number(form.params.eer ?? 3)}
                      min={1}
                      step={0.1}
                      onChange={(value) => setParam('eer', value)}
                    />
                    <ParamField
                      label="COP"
                      value={Number(form.params.cop ?? 3.5)}
                      min={1}
                      step={0.1}
                      onChange={(value) => setParam('cop', value)}
                    />
                    <ParamField
                      label="Min. elektrisch (W)"
                      value={Number(form.params.minElectricW ?? 250)}
                      min={0}
                      onChange={(value) => setParam('minElectricW', value)}
                    />
                  </>
                ) : null}
                {editing.kind === 'hue' ? (
                  <ParamField
                    label="Helderheid (%)"
                    value={Number(form.params.brightnessPct ?? 60)}
                    min={0}
                    max={100}
                    onChange={(value) => setParam('brightnessPct', value)}
                  />
                ) : null}
              </div>

              {editing.kind === 'induction' ? (
                <p className="text-[11px] text-stone-400">
                  De vier kookzones stel je op de apparaatkaart in. Hier wijzig
                  je het totale vermogen.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3">
                {!editing.builtin ? (
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          `${editing.name} definitief verwijderen?`
                        )
                      ) {
                        void onDeleteAppliance(editing.id);
                        setEditingId(null);
                        setForm(null);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Verwijderen
                  </Button>
                ) : (
                  <Badge tone="neutral">Ingebouwd apparaat</Badge>
                )}
                <Button
                  variant="primary"
                  onClick={() => void saveAppliance()}
                >
                  Opslaan
                </Button>
              </div>
            </div>
          ) : adding ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-stone-800">
                  Apparaat toevoegen
                </h3>
                <p className="text-[11px] text-stone-500">
                  Voeg een eigen verbruiker toe aan de simulatie.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Naam">
                  <input
                    value={addForm.name}
                    onChange={(event) =>
                      setAddForm({ ...addForm, name: event.target.value })
                    }
                    className={inputClass}
                    placeholder="Bijv. vriezer garage"
                  />
                </Field>
                <Field label="Ruimte">
                  <input
                    value={addForm.room}
                    onChange={(event) =>
                      setAddForm({ ...addForm, room: event.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Type">
                  <select
                    value={addForm.kind}
                    onChange={(event) =>
                      setAddForm({
                        ...addForm,
                        kind: event.target.value as 'constant' | 'duty'
                      })
                    }
                    className={inputClass}
                  >
                    <option value="constant">Continu vermogen</option>
                    <option value="duty">Wisselend (duty cycle)</option>
                  </select>
                </Field>
                <Field label="Vermogen (W)">
                  <NumberInput
                    value={addForm.watts}
                    min={1}
                    step={10}
                    onChange={(watts) =>
                      setAddForm({ ...addForm, watts })
                    }
                  />
                </Field>
                {addForm.kind === 'duty' ? (
                  <>
                    <Field label="Inschakelduur (%)">
                      <NumberInput
                        value={addForm.dutyPct ?? 50}
                        min={1}
                        max={100}
                        fallback={50}
                        onChange={(dutyPct) =>
                          setAddForm({ ...addForm, dutyPct })
                        }
                      />
                    </Field>
                    <Field label="Cyclus (min)">
                      <NumberInput
                        value={addForm.cycleMin ?? 15}
                        min={1}
                        fallback={15}
                        onChange={(cycleMin) =>
                          setAddForm({ ...addForm, cycleMin })
                        }
                      />
                    </Field>
                  </>
                ) : null}
                <Field label="Powerfactor" hint="Tussen 0,5 en 1,0">
                  <NumberInput
                    value={addForm.powerFactor ?? 1}
                    min={0.5}
                    max={1}
                    step={0.01}
                    fallback={1}
                    onChange={(powerFactor) =>
                      setAddForm({ ...addForm, powerFactor })
                    }
                  />
                </Field>
                <Field label="Prioriteit">
                  <select
                    value={addForm.priority}
                    onChange={(event) =>
                      setAddForm({
                        ...addForm,
                        priority: event.target.value as Priority
                      })
                    }
                    className={inputClass}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
                <Button variant="ghost" onClick={() => setAdding(false)}>
                  Annuleren
                </Button>
                <Button
                  variant="primary"
                  disabled={!addForm.name.trim()}
                  onClick={() => void submitAdd()}
                >
                  <Plus className="h-4 w-4" />
                  Toevoegen
                </Button>
              </div>
            </div>
          ) : tab === 'appliances' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-stone-500">
                  {config.appliances.length} apparaten
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setAdding(true)}
                  className="min-h-11 text-xs"
                >
                  <Plus className="h-4 w-4" />
                  Eigen apparaat
                </Button>
              </div>
              <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
                {config.appliances.map((appliance) => (
                  <button
                    key={appliance.id}
                    type="button"
                    onClick={() => startEdit(appliance)}
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-stone-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                      <ApplianceIcon
                        kind={appliance.kind}
                        name={appliance.name}
                        className="h-4 w-4"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-800">
                        {appliance.name}
                      </span>
                      <span className="block truncate text-[11px] text-stone-500">
                        {appliance.room} ·{' '}
                        {appliance.priority === 'hoog'
                          ? 'hoge prioriteit'
                          : appliance.priority === 'midden'
                            ? 'middel'
                            : 'laag'}{' '}
                        ·{' '}
                        {formatW(
                          Number(
                            appliance.kind === 'airco'
                              ? (appliance.params.maxElectricW ?? 2000)
                              : (appliance.params.watts ?? 0)
                          )
                        )}
                      </span>
                    </span>
                    <span className="text-[11px] text-stone-400">
                      {appliance.builtin ? 'Wijzigen' : 'Bewerken'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-stone-800">
                  Aansluiting
                </h3>
                <p className="text-[11px] leading-relaxed text-stone-500">
                  Deze simulator gaat uit van één fase. De hoofdzekering is de
                  enige beveiliging die wordt meegenomen.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-stone-200 bg-white p-3">
                <Field label="Netspanning (V)">
                  <NumberInput
                    value={fuse.voltage}
                    min={200}
                    max={250}
                    step={1}
                    fallback={230}
                    onChange={(voltage) =>
                      setFuse({ ...fuse, voltage })
                    }
                  />
                </Field>
                <Field label="Hoofdzekering (A)">
                  <NumberInput
                    value={fuse.mainFuseA}
                    min={6}
                    max={63}
                    step={1}
                    fallback={35}
                    onChange={(mainFuseA) =>
                      setFuse({ ...fuse, mainFuseA })
                    }
                  />
                </Field>
                <div className="col-span-2 flex justify-end">
                  <Button
                    variant="primary"
                    className="min-h-11 text-xs"
                    onClick={() => void onPatchSettings(fuse)}
                  >
                    Opslaan
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-3">
                <h4 className="text-xs font-semibold text-stone-700">
                  Simulatie
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Dag resetten? De klok gaat naar 08:00 en de apparaten naar de standaardstand.'
                      )
                    ) {
                      void onSimulation({ action: 'resetDay' });
                      onClose();
                    }
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 text-left text-xs text-stone-600 hover:bg-stone-50"
                >
                  <span>Reset dag (configuratie blijft)</span>
                  <RotateCcw className="h-4 w-4 text-stone-400" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Alles resetten? Apparaten, accu, zon en aansluiting gaan terug naar de standaardwaarden.'
                      )
                    ) {
                      void onSimulation({ action: 'resetAll' });
                      onClose();
                    }
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50/50 px-3 text-left text-xs text-red-700 hover:bg-red-50"
                >
                  <span>Alles terugzetten naar standaard</span>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-xl bg-stone-100/70 p-3 text-[11px] leading-relaxed text-stone-500">
                De simulatie is bedoeld om inzicht te geven, niet als
                elektrische installatiekeuring. Gebruik altijd de
                specificaties van je eigen installatie.
              </div>
            </div>
          )}
        </div>

        {!editing && !adding ? (
          <footer className="border-t border-stone-200 bg-white px-4 py-2 text-center text-[10px] text-stone-400">
            Stroombalans · lokaal op je eigen netwerk
          </footer>
        ) : null}
      </div>
    </div>
  );
}
