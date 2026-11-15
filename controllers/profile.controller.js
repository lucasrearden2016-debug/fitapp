import User from '../models/User.js';
import { calculateTargets } from '../services/nutrition.js';

export async function getProfile(req, res) {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  const targets = user.onboarded ? calculateTargets(user.profile) : null;
  res.json({ ...user, targets });
}

// Encuesta principal (también sirve para editarla después)
export async function saveOnboarding(req, res) {
  const { profile, foods, gym } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { profile, foods, ...(gym && { gym }), onboarded: true },
    { returnDocument: 'after', runValidators: true }
  ).lean();
  res.json({ ...user, targets: calculateTargets(user.profile) });
}

// Agregar comidas a medida que usa la app
export async function addFood(req, res) {
  const user = await User.findById(req.user.id);
  const exists = user.foods.find((f) => f.name.toLowerCase() === req.body.name.toLowerCase());
  if (exists) Object.assign(exists, req.body);
  else user.foods.push(req.body);
  await user.save();
  res.status(201).json(user.foods);
}

export async function removeFood(req, res) {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { foods: { _id: req.params.foodId } } },
    { returnDocument: 'after' }
  );
  res.json(user.foods);
}
