import type { Express, Response } from 'express';
import type { SimulationEngine } from './simulation/engine';

export function attachStream(app: Express, engine: SimulationEngine): () => void {
  const clients = new Set<Response>();

  app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`event: tick\ndata: ${JSON.stringify(engine.snapshot())}\n\n`);
    clients.add(res);
    req.on('close', () => {
      clients.delete(res);
    });
  });

  const tick = setInterval(() => {
    if (clients.size === 0) return;
    const payload = JSON.stringify(engine.snapshot());
    for (const client of clients) {
      try {
        client.write(`event: tick\ndata: ${payload}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  }, 500);

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      try {
        client.write(': hartslag\n\n');
      } catch {
        clients.delete(client);
      }
    }
  }, 15000);

  return () => {
    clearInterval(tick);
    clearInterval(heartbeat);
    for (const client of clients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    clients.clear();
  };
}
