import User from '../models/User.js';
import { planOf, today, AI_DAILY_LIMIT } from '../services/plan.js';

// Va después de `auth` en las rutas que usan IA.
// Gratis → 402 (el front muestra "Pasate a Premium"). Premium → cuenta el uso del día.
export async function requirePremium(req, res, next) {
  const user = await User.findById(req.user.id).select('createdAt trialEndsAt subscription aiUsage').lean();
  if (!user) return res.status(401).json({ message: 'Sesión inválida' });
  if (!planOf(user).premium) {
    return res.status(402).json({ message: 'Esta función es Premium', code: 'PREMIUM_REQUIRED' });
  }
  const day = today();
  // Suma 1 de forma atómica, solo si no pasó el tope de hoy
  const ok =
    (await User.updateOne(
      { _id: user._id, 'aiUsage.day': day, 'aiUsage.count': { $lt: AI_DAILY_LIMIT } },
      { $inc: { 'aiUsage.count': 1 } }
    )).modifiedCount === 1 ||
    (await User.updateOne(
      { _id: user._id, 'aiUsage.day': { $ne: day } },
      { $set: { aiUsage: { day, count: 1 } } }
    )).modifiedCount === 1;
  if (!ok) {
    return res.status(429).json({ message: 'Llegaste al límite diario de IA. Mañana se renueva.', code: 'AI_DAILY_LIMIT' });
  }
  next();
}
