import express, {
  type NextFunction,
  type Request,
  type Response
} from 'express';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createApi } from './api';
import { Persistence } from './persistence';
import { attachStream } from './stream';
import { SimulationEngine } from './simulation/engine';

const PORT = Number(process.env.PORT ?? 3000);

function lanUrls(port: number): string[] {
  const urls: string[] = [];
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }
  return urls;
}

async function main(): Promise<void> {
  const persistence = new Persistence();
  await persistence.init();
  const config = await persistence.loadConfig();
  const state = await persistence.loadState(config);
  const engine = new SimulationEngine(config, state);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  const api = createApi(engine, persistence);
  app.use('/api', api);

  const closeStream = attachStream(app, engine);

  const clientDir = path.resolve(process.cwd(), 'dist/client');
  const indexFile = path.join(clientDir, 'index.html');
  app.use(express.static(clientDir));

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    if (existsSync(indexFile)) return res.sendFile(indexFile);
    return res
      .status(503)
      .send('De client is nog niet gebouwd. Voer `npm run build` uit.');
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: 'Ongeldige JSON.' });
    }
    console.error('[server]', err);
    return res.status(500).json({ error: 'Interne serverfout.' });
  });

  const simulationTimer = setInterval(() => {
    engine.advance(0.25);
  }, 250);

  const saveTimer = setInterval(() => {
    void persistence.saveState(engine.state);
  }, 10000);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  Stroombalans draait:');
    console.log(`  http://localhost:${PORT}`);
    for (const url of lanUrls(PORT)) {
      console.log(`  ${url}   (iPhone, zelfde wifi)`);
    }
    if (!existsSync(indexFile)) {
      console.log('');
      console.log('  Let op: de client is nog niet gebouwd. Gebruik `npm run build`.');
    }
    console.log('');
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[server] ${signal}, staat opslaan...`);
    clearInterval(simulationTimer);
    clearInterval(saveTimer);
    closeStream();
    await persistence.saveConfig(engine.config);
    await persistence.saveState(engine.state);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[server] Startup failed:', error);
  process.exit(1);
});
