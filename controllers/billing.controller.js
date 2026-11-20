import User from '../models/User.js';
import { planOf } from '../services/plan.js';

// GET /api/billing/me → estado del plan del usuario
export async function me(req, res) {
  const user = await User.findById(req.user.id).select('createdAt trialEndsAt subscription aiUsage').lean();
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json(planOf(user));
}
