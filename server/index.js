import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import os from 'node:os';
import dgram from 'node:dgram';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { initStore, addScore, getScores } from './store.js';
import { attachRooms } from './rooms.js';
const app = express(), port = process.env.PORT || 3002;
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true, legacyHeaders: false }));
const VIRTUAL_IFACE = /virtual|vmware|vbox|hyper-?v|vethernet|wsl|docker|tailscale|zerotier|loopback|bluetooth/i;
const lanAddresses = () => {
  const usable = item => item && item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.');
  const entries = Object.entries(os.networkInterfaces());
  const physical = entries.filter(([name]) => !VIRTUAL_IFACE.test(name)).flatMap(([, items]) => items || []).filter(usable);
  const fallback = entries.flatMap(([, items]) => items || []).filter(usable);
  const unique = [...new Set((physical.length ? physical : fallback).map(item => item.address))];
  const rank = ip => (/^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return unique.sort((a, b) => rank(a) - rank(b));
};
// La IP de salida real (la de Wi-Fi/Ethernet), sin enviar tráfico.
const primaryAddress = () => new Promise(resolve => {
  const probe = dgram.createSocket('udp4');
  const finish = value => { try { probe.close(); } catch {} resolve(value); };
  probe.on('error', () => finish(null));
  try {
    probe.connect(53, '8.8.8.8', () => {
      const { address } = probe.address();
      finish(address && !address.startsWith('127.') ? address : null);
    });
  } catch {
    finish(null);
  }
});
const orderedAddresses = async () => {
  const [primary, all] = [await primaryAddress(), lanAddresses()];
  return primary ? [primary, ...all.filter(ip => ip !== primary)] : all;
};
app.get('/api/health', (_, res) => res.json({ ok: true }));
app.get('/api/network', async (_, res) => res.json({ ips: await orderedAddresses() }));
app.get('/api/leaderboard', async (_, res, next) => { try { res.json(await getScores()); } catch (e) { next(e); } });
app.post('/api/leaderboard', async (req, res, next) => { try {
  const { name, team, score, level } = req.body || {};
  if (typeof name !== 'string' || !/^[\p{L}\p{N} _-]{2,24}$/u.test(name.trim()) || (team && (typeof team !== 'string' || team.length > 24)) || !Number.isInteger(score) || score < 0 || score > 99999 || !Number.isInteger(level) || level < 1 || level > 9) return res.status(400).json({ error: 'Datos inválidos.' });
  res.status(201).json(await addScore({ name: name.trim(), team: team?.trim(), score, level }));
} catch (e) { next(e); } });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.use(express.static(path.join(root, 'dist')));
app.get('/{*splat}', (_, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.use((err, _, res, __) => { console.error(err); res.status(500).json({ error: 'No fue posible completar la operación.' }); });
const server = createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN?.split(',') || true } });
attachRooms(io);
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] El puerto ${port} ya está ocupado por otro programa.`);
    console.error('Cierra la otra instancia de TIME WARRIORS (su ventana de terminal) y vuelve a intentarlo.');
    console.error('Consejo: revisa si quedó abierta la copia antigua del proyecto.\n');
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
initStore().then(() => server.listen(port, () => {
  console.log(`TIME WARRIORS escuchando en el puerto ${port}`);
  for (const ip of lanAddresses()) console.log(`  Red local: http://${ip}:${port}`);
})).catch(err => { console.error('Base de datos no disponible:', err); process.exit(1); });
