import { Router, type Response } from 'express';
import type { SimulationEngine } from './simulation/engine';
import type { Persistence } from './persistence';
import {
  appliancePatchSchema,
  batterySchema,
  customApplianceSchema,
  outageSchema,
  settingsSchema,
  sheddingSchema,
  simulationActionSchema,
  solarSchema
} from '../shared/schema';
import type { Bootstrap } from '../shared/types';

function bootstrap(engine: SimulationEngine): Bootstrap {
  return {
    config: engine.config,
    snapshot: engine.snapshot()
  };
}

export function createApi(
  engine: SimulationEngine,
  persistence: Persistence
): Router {
  const router = Router();

  const saveAll = (): void => {
    void persistence.saveConfig(engine.config);
    void persistence.saveState(engine.state);
  };

  const fail = (res: Response, message: string, status = 400): void => {
    res.status(status).json({ error: message });
  };

  router.get('/bootstrap', (_req, res) => {
    res.json(bootstrap(engine));
  });

  router.get('/history', (_req, res) => {
    res.json({ points: engine.state.history });
  });

  router.get('/config', (_req, res) => {
    res.json({ config: engine.config });
  });

  router.get('/sizing', (_req, res) => {
    res.json(engine.snapshot().sizing);
  });

  router.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  router.patch('/appliances/:id', (req, res) => {
    const parsed = appliancePatchSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 'Ongeldige apparaatwijziging.');
    let changed = false;
    if (parsed.data.on !== undefined) {
      changed = engine.setApplianceOn(req.params.id, parsed.data.on) || changed;
    }
    if (parsed.data.config) {
      changed =
        engine.patchAppliance(req.params.id, parsed.data.config) || changed;
    }
    if (!changed) return fail(res, 'Apparaat niet gevonden.', 404);
    saveAll();
    res.json(bootstrap(engine));
  });

  router.post('/appliances', (req, res) => {
    const parsed = customApplianceSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 'Ongeldig apparaat.');
    const id = engine.addCustomAppliance({
      ...parsed.data,
      kind: parsed.data.kind,
      dutyPct: parsed.data.dutyPct,
      cycleMin: parsed.data.cycleMin
    });
    saveAll();
    res.status(201).json({ id, ...bootstrap(engine) });
  });

  router.delete('/appliances/:id', (req, res) => {
    const ok = engine.deleteCustomAppliance(req.params.id);
    if (!ok) return fail(res, 'Alleen aangepaste apparaten kunnen worden verwijderd.', 400);
    saveAll();
    res.json(bootstrap(engine));
  });

  router.patch('/battery', (req, res) => {
    const parsed = batterySchema.partial().safeParse(req.body);
    if (!parsed.success) return fail(res, 'Ongeldige accu-instelling.');
    engine.patchBattery(parsed.data);
    saveAll();
    res.json(bootstrap(engine));
  });

  router.patch('/solar', (req, res) => {
    const parsed = solarSchema.partial().safeParse(req.body);
    if (!parsed.success) return fail(res, 'Ongeldige zonne-instelling.');
    engine.patchSolar(parsed.data);
    saveAll();
    res.json(bootstrap(engine));
  });

  router.patch('/settings', (req, res) => {
    const parsed = settingsSchema.partial().safeParse(req.body);
    if (!parsed.success) return fail(res, 'Ongeldige instelling.');
    engine.patchSettings(parsed.data);
    saveAll();
    res.json(bootstrap(engine));
  });

  router.post('/simulation', (req, res) => {
    const parsed = simulationActionSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 'Ongeldige simulatieactie.');
    const action = parsed.data;
    switch (action.action) {
      case 'play':
        engine.setRunning(true);
        break;
      case 'pause':
        engine.setRunning(false);
        break;
      case 'setSpeed':
        if (action.speed !== undefined) engine.setSpeed(action.speed);
        break;
      case 'setSeason':
        if (action.season) engine.setSeason(action.season);
        break;
      case 'setTime':
        if (action.timeOfDaySec !== undefined) {
          engine.setTimeOfDay(action.timeOfDaySec);
        }
        break;
      case 'resetDay':
        engine.resetDay();
        break;
      case 'resetAll':
        engine.resetAll();
        break;
    }
    saveAll();
    res.json(bootstrap(engine));
  });

  router.post('/outage', (req, res) => {
    const parsed = outageSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 'Ongeldige netonderbreking.');
    engine.setOutage(parsed.data.enabled);
    saveAll();
    res.json(bootstrap(engine));
  });

  router.post('/shedding/apply', (req, res) => {
    const parsed = sheddingSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 'Ongeldige selectie.');
    engine.applyShedding(parsed.data.ids);
    saveAll();
    res.json(bootstrap(engine));
  });

  return router;
}
