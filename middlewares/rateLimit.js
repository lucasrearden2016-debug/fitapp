import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

// En Vercel cada instancia tiene su propia memoria, así que si hay REDIS_URL
// usamos Redis (p.ej. Upstash) para que el límite sea compartido.
let client = null;
if (process.env.REDIS_URL) {
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (e) => console.error('Redis:', e.message));
  client.connect().catch(() => {});
}

const store = (prefix) =>
  client ? new RedisStore({ prefix, sendCommand: (...args) => client.sendCommand(args) }) : undefined;

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: store('rl:general:'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { message: 'Demasiados intentos, esperá unos minutos' },
  store: store('rl:auth:'),
});

// Las llamadas a la IA cuestan: límite por usuario
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user.id, // siempre va después de `auth`
  message: { message: 'Llegaste al límite de pedidos a la IA por hora' },
  store: store('rl:ai:'),
});
