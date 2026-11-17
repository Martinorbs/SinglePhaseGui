import type { ApplianceKind } from '../../../shared/types';
import {
  Activity,
  AirVent,
  Camera,
  Coffee,
  CookingPot,
  Cpu,
  Fan,
  Flame,
  Lightbulb,
  Plug,
  Router,
  Server,
  Shirt,
  Snowflake,
  Thermometer,
  WashingMachine,
  Waves,
  Wind,
  Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const MAP: Record<ApplianceKind, LucideIcon> = {
  constant: Plug,
  duty: Plug,
  fridge: Snowflake,
  oven: CookingPot,
  airfryer: CookingPot,
  timer: Zap,
  coffee: Coffee,
  washer: WashingMachine,
  dryer: Shirt,
  dishwasher: Waves,
  induction: Flame,
  treadmill: Activity,
  hue: Lightbulb,
  heatpump: Thermometer,
  airco: AirVent
};

const ROOM_ICONS: Record<string, LucideIcon> = {
  Overig: Plug,
  Netwerk: Router,
  Server: Server,
  Ventilatie: Fan,
  Camera: Camera,
  Domotica: Cpu,
  Föhn: Wind,
  Strijkijzer: Shirt
};

export function ApplianceIcon({
  kind,
  name,
  className
}: {
  kind: ApplianceKind;
  name?: string;
  className?: string;
}) {
  const roomIcon = name
    ? Object.entries(ROOM_ICONS).find(([key]) => name.includes(key))?.[1]
    : undefined;
  const Icon = roomIcon ?? MAP[kind] ?? Plug;
  return <Icon className={className} aria-hidden />;
}
