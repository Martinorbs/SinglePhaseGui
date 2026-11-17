import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type {
  AppConfig,
  HistoryPoint,
  Snapshot
} from '../../../shared/types';
import { formatClock, formatW, round } from '../../../shared/calculations';
import { ApplianceIcon } from './icons';
import { Card, SectionHeading, cx } from './ui';

const ROOM_COLORS = [
  '#0f766e',
  '#0e7490',
  '#7c3aed',
  '#b45309',
  '#be123c',
  '#4d7c0f',
  '#6d28d9',
  '#a16207',
  '#0369a1',
  '#9f1239'
];

const GRID_COLOR = '#1c2a2e';

export function Charts({
  history,
  config,
  snapshot
}: {
  history: HistoryPoint[];
  config: AppConfig;
  snapshot: Snapshot;
}) {
  const rooms = useMemo(() => {
    const present = new Set<string>();
    history.forEach((point) => {
      Object.keys(point.rooms).forEach((room) => present.add(room));
    });
    const configured = Array.from(
      new Set(config.appliances.map((item) => item.room))
    ).filter((room) => present.has(room));
    const extra = Array.from(present)
      .filter((room) => !configured.includes(room))
      .sort((a, b) => a.localeCompare(b, 'nl'));
    return [...configured, ...extra];
  }, [config.appliances, history]);

  const data = useMemo(
    () =>
      history.map((point) => ({
        ...point,
        ...point.rooms,
        label: formatClock(point.t)
      })),
    [history]
  );

  const topConsumers = useMemo(() => {
    return config.appliances
      .map((appliance) => {
        const snap = snapshot.appliances[appliance.id];
        return {
          appliance,
          watts: snap?.watts ?? 0,
          on: snap?.on ?? false
        };
      })
      .filter((item) => item.on && item.watts > 0)
      .sort((a, b) => b.watts - a.watts)
      .slice(0, 6);
  }, [config.appliances, snapshot.appliances]);

  const maxConsumerW = topConsumers[0]?.watts ?? 1;

  if (history.length < 2) {
    return (
      <Card className="p-4 text-sm text-stone-500">
        Nog te weinig geschiedenis. Start de simulatie om de grafieken te
        vullen.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <SectionHeading
          title="Belasting laatste 24 uur"
          subtitle="Per kamer, met de netlimiet als rode lijn"
        />
        <div className="mt-3 h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="#f0eee8" vertical={false} />
              <XAxis
                dataKey="label"
                minTickGap={48}
                tick={{ fontSize: 10, fill: '#8a8580' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#8a8580' }}
                tickLine={false}
                axisLine={false}
                unit=" A"
                width={46}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e7e4dc',
                  fontSize: 12,
                  boxShadow: '0 8px 24px rgba(28,42,46,0.08)'
                }}
                formatter={(value, name) => [
                  `${round(Number(value), 1).toFixed(1).replace('.', ',')} A`,
                  String(name)
                ]}
                labelFormatter={(label) => `Tijd ${label}`}
              />
              {rooms.map((room, index) => (
                <Area
                  key={room}
                  type="monotone"
                  dataKey={room}
                  stackId="rooms"
                  stroke="none"
                  fill={ROOM_COLORS[index % ROOM_COLORS.length]}
                  fillOpacity={0.78}
                  isAnimationActive={false}
                />
              ))}
              <Line
                type="monotone"
                dataKey="gridA"
                name="Net"
                stroke={GRID_COLOR}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceLine
                y={config.settings.mainFuseA}
                stroke="#b91c1c"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: `${config.settings.mainFuseA} A`,
                  position: 'insideTopRight',
                  fill: '#b91c1c',
                  fontSize: 10
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {rooms.map((room, index) => (
            <span
              key={room}
              className="inline-flex items-center gap-1 text-[10px] text-stone-500"
            >
              <span
                className="h-2 w-2 rounded-sm"
                style={{
                  backgroundColor: ROOM_COLORS[index % ROOM_COLORS.length]
                }}
              />
              {room}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-[10px] text-stone-500">
            <span className="h-0.5 w-3 rounded bg-stone-800" />
            Net
          </span>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <SectionHeading title="Accu-SOC" subtitle="Verloop over de dag" />
          <div className="mt-3 h-[170px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="socFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e7490" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#0e7490" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f0eee8" vertical={false} />
                <XAxis
                  dataKey="label"
                  minTickGap={40}
                  tick={{ fontSize: 10, fill: '#8a8580' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#8a8580' }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e7e4dc',
                    fontSize: 12
                  }}
                  formatter={(value) => [
                    `${round(Number(value), 0)}%`,
                    'SOC'
                  ]}
                  labelFormatter={(label) => `Tijd ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="socPct"
                  stroke="#0e7490"
                  strokeWidth={2}
                  fill="url(#socFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeading
            title="Grootste verbruikers nu"
            subtitle="Alleen apparaten die aan staan"
          />
          <div className="mt-3 space-y-2">
            {topConsumers.length === 0 ? (
              <p className="text-sm text-stone-500">Alles staat uit.</p>
            ) : (
              topConsumers.map(({ appliance, watts }) => (
                <div key={appliance.id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-stone-600">
                      <ApplianceIcon
                        kind={appliance.kind}
                        name={appliance.name}
                        className="h-3.5 w-3.5 shrink-0 text-stone-400"
                      />
                      <span className="truncate">{appliance.name}</span>
                    </span>
                    <span className="tnum shrink-0 font-medium text-stone-800">
                      {formatW(watts)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={cx('h-full rounded-full bg-teal-600')}
                      style={{ width: `${(watts / maxConsumerW) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
