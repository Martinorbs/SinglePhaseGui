import type {
  AppConfig,
  ApplianceConfig,
  ApplianceParams,
  ApplianceRuntime,
  BatteryConfig,
  SimState,
  SolarConfig
} from './types';

export const APP_VERSION = 1;
export const DEFAULT_START_SEC = 8 * 3600;
export const HISTORY_LIMIT = 1440;

export function currentSeason(date = new Date()): SimState['season'] {
  const month = date.getMonth();
  if (month <= 1 || month === 11) return 'winter';
  if (month <= 4) return 'lente';
  if (month <= 7) return 'zomer';
  return 'herfst';
}

function appliance(
  id: string,
  name: string,
  room: string,
  kind: ApplianceConfig['kind'],
  priority: ApplianceConfig['priority'],
  powerFactor: number,
  params: ApplianceParams,
  builtin = true
): ApplianceConfig {
  return { id, name, room, kind, priority, powerFactor, builtin, params };
}

export function defaultBattery(): BatteryConfig {
  return {
    enabled: true,
    capacityKwh: 6,
    maxChargeKw: 4.5,
    maxDischargeKw: 4.5,
    roundTripEfficiency: 0.9,
    initialSocPct: 100,
    assistThresholdA: 35,
    chargeFromGrid: true,
    chargeFromSolar: true
  };
}

export function defaultSolar(): SolarConfig {
  return {
    enabled: false,
    kwp: 0,
    orientation: 'zuid'
  };
}

export function defaultAppliances(): ApplianceConfig[] {
  return [
    appliance('induction', 'Inductiekookplaat', 'Keuken', 'induction', 'laag', 1, {
      watts: 7200,
      zones: [
        { name: 'Zone 1', maxW: 2200, level: 0 },
        { name: 'Zone 2', maxW: 2200, level: 0 },
        { name: 'Zone 3', maxW: 1800, level: 0 },
        { name: 'Zone 4', maxW: 1400, level: 0 }
      ]
    }),
    appliance('oven', 'Oven', 'Keuken', 'oven', 'laag', 1, {
      watts: 3000,
      preheatMin: 8,
      dutyAfterPreheatPct: 55,
      cycleMin: 10
    }),
    appliance('airfryer', 'Airfryer', 'Keuken', 'airfryer', 'laag', 1, {
      watts: 1700,
      dutyPct: 70,
      cycleMin: 10,
      autoOffMin: 20000
    }),
    appliance('fridge', 'Koelkast', 'Keuken', 'fridge', 'hoog', 0.85, {
      watts: 100,
      dutyPct: 40,
      cycleMin: 30,
      offsetMin: 0
    }),
    appliance('freezer', 'Vriezer', 'Keuken', 'fridge', 'hoog', 0.85, {
      watts: 140,
      dutyPct: 40,
      cycleMin: 30,
      offsetMin: 15
    }),
    appliance('dishwasher', 'Vaatwasser', 'Keuken', 'dishwasher', 'laag', 0.95, {
      watts: 2200,
      durationMin: 135
    }),
    appliance('microwave', 'Magnetron', 'Keuken', 'timer', 'laag', 1, {
      watts: 1100,
      autoOffMin: 3000
    }),
    appliance('kettle', 'Waterkoker', 'Keuken', 'timer', 'laag', 1, {
      watts: 2200,
      autoOffMin: 3000
    }),
    appliance('coffee', 'Koffiemachine', 'Keuken', 'coffee', 'laag', 1, {
      watts: 1450,
      brewMin: 2,
      keepWarmW: 60,
      keepWarmMin: 10
    }),
    appliance('extractor', 'Afzuigkap', 'Keuken', 'constant', 'laag', 0.9, {
      watts: 250
    }),
    appliance('tv-living', 'TV woonkamer', 'Woonkamer', 'constant', 'midden', 0.9, {
      watts: 120
    }),
    appliance('pc', 'Desktop PC', 'Woonkamer', 'constant', 'midden', 0.95, {
      watts: 400
    }),
    appliance('phone', 'Telefoonlader', 'Woonkamer', 'constant', 'laag', 0.9, {
      watts: 20
    }),
    appliance('treadmill', 'Loopband TR-500i', 'Sportkamer', 'treadmill', 'laag', 0.9, {
      watts: 3000,
      baseW: 200,
      perKmh: 105,
      marginPct: 10,
      speedKmh: 5,
      inclinePct: 0,
      weightKg: 85
    }),
    appliance('tv-sport', 'TV sportkamer', 'Sportkamer', 'constant', 'midden', 0.9, {
      watts: 100
    }),
    appliance('washer', 'Wasmachine', 'Wasruimte', 'washer', 'laag', 0.95, {
      watts: 2200,
      durationMin: 120
    }),
    appliance('dryer', 'Warmtepompdroger', 'Wasruimte', 'dryer', 'laag', 0.9, {
      watts: 800,
      durationMin: 150
    }),
    appliance('heatpump', 'Warmtepomp', 'Klimaat', 'heatpump', 'midden', 0.9, {
      watts: 1400
    }),
    appliance('airco', 'Airco triple split', 'Klimaat', 'airco', 'laag', 0.95, {
      coolingKw: 5,
      heatingKw: 5,
      eer: 3,
      cop: 3.5,
      minElectricW: 250,
      maxElectricW: 2000,
      mode: 'uit',
      units: [
        { name: 'Unit 1', sharePct: 33.34, level: 0 },
        { name: 'Unit 2', sharePct: 33.33, level: 0 },
        { name: 'Unit 3', sharePct: 33.33, level: 0 }
      ]
    }),
    appliance('floorheating', 'Vloerverwarming badkamer', 'Klimaat', 'constant', 'laag', 1, {
      watts: 500
    }),
    appliance('gasboiler', 'Gasboiler (tapwater)', 'Klimaat', 'constant', 'midden', 0.9, {
      watts: 80
    }),
    appliance('hue', 'Hue hele huis', 'Verlichting', 'hue', 'midden', 0.9, {
      watts: 250,
      brightnessPct: 60
    }),
    appliance('nas', 'NAS / homeserver', 'Overig', 'constant', 'hoog', 0.95, {
      watts: 40
    }),
    appliance('network', 'Netwerkapparatuur', 'Overig', 'constant', 'hoog', 0.9, {
      watts: 30
    }),
    appliance('ventilation', 'Mechanische ventilatie / WTW', 'Overig', 'constant', 'hoog', 0.9, {
      watts: 30
    }),
    appliance('cameras', "Camera's / deurbel", 'Overig', 'constant', 'hoog', 0.9, {
      watts: 15
    }),
    appliance('hub', 'Domotica hub', 'Overig', 'constant', 'midden', 0.9, {
      watts: 10
    }),
    appliance('hairdryer', 'Föhn', 'Overig', 'timer', 'laag', 1, {
      watts: 1800,
      autoOffMin: 1000
    }),
    appliance('iron', 'Strijkijzer', 'Overig', 'timer', 'laag', 1, {
      watts: 1200,
      autoOffMin: 1000
    })
  ];
}

export function defaultConfig(): AppConfig {
  return {
    version: APP_VERSION,
    appliances: defaultAppliances(),
    battery: defaultBattery(),
    solar: defaultSolar(),
    settings: {
      voltage: 230,
      mainFuseA: 35
    }
  };
}

const DEFAULT_ON = new Set([
  'fridge',
  'freezer',
  'heatpump',
  'nas',
  'network',
  'ventilation',
  'cameras',
  'hub'
]);

export function defaultApplianceRuntime(): Record<string, ApplianceRuntime> {
  return Object.fromEntries(
    defaultAppliances().map((a) => [a.id, { on: DEFAULT_ON.has(a.id) }])
  );
}

export function defaultState(config: AppConfig, season = currentSeason()): SimState {
  return {
    version: APP_VERSION,
    simTimeSec: DEFAULT_START_SEC,
    running: false,
    speed: 60,
    season,
    outage: false,
    batterySocWh: config.battery.capacityKwh * 1000 * (config.battery.initialSocPct / 100),
    batteryDischarging: false,
    appliances: Object.fromEntries(
      config.appliances.map((a) => [a.id, { on: DEFAULT_ON.has(a.id) }])
    ),
    history: [],
    lastHistoryMinute: -1
  };
}

export const ROOM_ORDER = [
  'Keuken',
  'Woonkamer',
  'Sportkamer',
  'Wasruimte',
  'Klimaat',
  'Verlichting',
  'Overig'
];

export const SPEED_OPTIONS = [1, 10, 60, 300, 900, 3600];
export const SEASONS: Array<{ value: SimState['season']; label: string }> = [
  { value: 'winter', label: 'Winter' },
  { value: 'lente', label: 'Lente' },
  { value: 'zomer', label: 'Zomer' },
  { value: 'herfst', label: 'Herfst' }
];
