import User from '../models/User.js';
import WeightLog from '../models/WeightLog.js';
import { calculateTargets, evaluateWeight, normalizeMeal } from '../services/nutrition.js';
import { startOfDayUTC } from '../services/progress.js';

const targetsOf = (user) => (user.onboarded ? calculateTargets(user.profile, user.nutrition?.calorieAdjustment ?? 0) : null);

export async function getProfile(req, res) {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ ...user, targets: targetsOf(user) });
}

// Encuesta principal (también sirve para editarla después)
export async function saveOnboarding(req, res) {
  const { profile, foods, gym } = req.body;
  const prev = await User.findById(req.user.id).select('profile.goal').lean();
  const update = { profile, foods, ...(gym && { gym }), onboarded: true };
  // Si cambia el objetivo, el ajuste por peso arranca de cero
  if (prev?.profile?.goal && prev.profile.goal !== profile.goal) {
    update.nutrition = { calorieAdjustment: 0, lastAdjustmentAt: null, lastRate: null, lastMessage: null };
  }
  const user = await User.findByIdAndUpdate(req.user.id, update, { returnDocument: 'after', runValidators: true }).lean();
  res.json({ ...user, targets: targetsOf(user) });
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

// ---------- Favoritas ----------

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Agrega o actualiza (si ya existe una con el mismo nombre) una favorita
function upsertFavorite(user, meal) {
  const clean = { ...normalizeMeal(meal), type: meal.type, recipe: meal.recipe };
  const existing = user.favorites.find((f) => sameName(f.name, clean.name));
  if (existing) existing.set(clean);
  else user.favorites.push(clean);
}

export async function addFavorite(req, res) {
  const user = await User.findById(req.user.id);
  upsertFavorite(user, req.body.meal);
  await user.save();
  res.status(201).json(user.favorites);
}

export async function updateFavorite(req, res) {
  const user = await User.findById(req.user.id);
  const fav = user.favorites.id(req.params.favId);
  if (!fav) return res.status(404).json({ message: 'Favorita no encontrada' });
  const meal = req.body.meal;
  fav.set({ ...normalizeMeal(meal), type: meal.type, recipe: meal.recipe });
  await user.save();
  res.json(user.favorites);
}

export async function removeFavorite(req, res) {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { favorites: { _id: req.params.favId } } },
    { returnDocument: 'after' }
  );
  res.json(user.favorites);
}

// ---------- Peso ----------

async function weightResponse(user) {
  const logs = await WeightLog.find({ user: user._id }).sort({ date: 1 }).select('date weightKg -_id').lean();
  const goal = user.profile?.goal;
  return {
    logs,
    goal,
    targets: targetsOf(user),
    adjustment: user.nutrition?.calorieAdjustment ?? 0,
    rate: user.nutrition?.lastRate ?? null,
    message: user.nutrition?.lastMessage ?? evaluateWeight(logs, goal).message,
    expected: evaluateWeight([], goal).expected,
  };
}

export async function getWeights(req, res) {
  const user = await User.findById(req.user.id);
  res.json(await weightResponse(user));
}

// Registrar peso (uno por día) y, si corresponde, ajustar calorías
export async function addWeight(req, res) {
  const user = await User.findById(req.user.id);
  const date = startOfDayUTC(req.body.date ? new Date(req.body.date) : new Date());
  await WeightLog.findOneAndUpdate(
    { user: user._id, date },
    { weightKg: req.body.weightKg },
    { upsert: true, returnDocument: 'after' }
  );

  const logs = await WeightLog.find({ user: user._id }).sort({ date: 1 }).lean();
  user.profile.weightKg = logs.at(-1).weightKg; // el peso actual alimenta BMR y proteína

  const n = user.nutrition ?? {};
  const result = evaluateWeight(logs, user.profile.goal, n.calorieAdjustment ?? 0, n.lastAdjustmentAt);
  user.nutrition = {
    calorieAdjustment: (n.calorieAdjustment ?? 0) + result.change,
    lastAdjustmentAt: result.change ? new Date() : n.lastAdjustmentAt,
    lastRate: result.rate,
    lastMessage: result.message,
  };
  await user.save();
  res.status(201).json({ ...(await weightResponse(user)), change: result.change });
}

export async function removeWeight(req, res) {
  await WeightLog.deleteOne({ user: req.user.id, date: startOfDayUTC(new Date(req.params.date)) });
  const user = await User.findById(req.user.id);
  res.json(await weightResponse(user));
}
