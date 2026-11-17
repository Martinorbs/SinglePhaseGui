import type {
  AppConfig,
  AppliancePatch,
  Snapshot
} from '../../../shared/types';
import { ROOM_ORDER } from '../../../shared/defaults';
import { formatW } from '../../../shared/calculations';
import { ApplianceCard } from './ApplianceCard';
import { Badge, Card } from './ui';

export function ApplianceSections({
  config,
  snapshot,
  onUpdate,
  onEdit
}: {
  config: AppConfig;
  snapshot: Snapshot;
  onUpdate: (id: string, patch: AppliancePatch) => void;
  onEdit: (id: string) => void;
}) {
  const rooms = Array.from(new Set(config.appliances.map((item) => item.room)));
  const orderedRooms = [
    ...ROOM_ORDER.filter((room) => rooms.includes(room)),
    ...rooms
      .filter((room) => !ROOM_ORDER.includes(room))
      .sort((a, b) => a.localeCompare(b, 'nl'))
  ];

  const activeCount = config.appliances.filter(
    (item) => snapshot.appliances[item.id]?.on
  ).length;
  const totalW = config.appliances.reduce(
    (sum, item) => sum + (snapshot.appliances[item.id]?.watts ?? 0),
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-stone-900">
            Apparaten
          </h2>
          <p className="text-xs text-stone-500">
            {activeCount} van {config.appliances.length} actief ·{' '}
            {formatW(totalW)} totaal
          </p>
        </div>
        <Badge tone="neutral">Tik om te schakelen</Badge>
      </div>

      {orderedRooms.map((room) => {
        const appliances = config.appliances.filter(
          (item) => item.room === room
        );
        if (appliances.length === 0) return null;
        const roomW = appliances.reduce(
          (sum, item) => sum + (snapshot.appliances[item.id]?.watts ?? 0),
          0
        );
        const roomActive = appliances.filter(
          (item) => snapshot.appliances[item.id]?.on
        ).length;

        return (
          <Card key={room} className="p-3 sm:p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                {room}
              </h3>
              <span className="tnum text-[11px] text-stone-400">
                {roomActive} actief · {formatW(roomW)}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {appliances.map((appliance) => {
                const snap = snapshot.appliances[appliance.id];
                if (!snap) return null;
                return (
                  <ApplianceCard
                    key={appliance.id}
                    appliance={appliance}
                    snapshot={snap}
                    fit={snapshot.outage ? undefined : snapshot.fit[appliance.id]}
                    onUpdate={(patch) => onUpdate(appliance.id, patch)}
                    onEdit={() => onEdit(appliance.id)}
                  />
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
