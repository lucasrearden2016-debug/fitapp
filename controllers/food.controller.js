import mongoose from 'mongoose';
import Food, { normalize } from '../models/Food.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Qué ve el front de cada alimento
const toJSON = (food, userId) => {
  const f = food.toObject ? food.toObject() : food;
  const { reportedBy = [], createdBy, searchText: _s, key: _k, __v: _v, ...rest } = f;
  return {
    ...rest,
    mine: String(createdBy) === String(userId),
    reported: reportedBy.some((id) => String(id) === String(userId)),
  };
};

// Control de calidad: que los números tengan sentido para 100 g/ml
function checkValues(b) {
  const macros = b.protein + b.carbs + b.fat + (b.fiber ?? 0);
  if (b.baseUnit === 'g' && macros > 101) return 'Proteína + carbos + grasas no pueden pasar de 100 g en 100 g de alimento';
  const atwater = b.protein * 4 + b.carbs * 4 + b.fat * 9;
  const diff = Math.abs(atwater - b.calories);
  if (diff > Math.max(25, b.calories * 0.2)) {
    return `Las calorías no cierran con los macros: con esos macros serían unas ${Math.round(atwater)} kcal. Revisá que todo sea por 100 ${b.baseUnit}.`;
  }
  return null;
}

// GET /api/foods?q=arroz
export async function search(req, res) {
  const q = normalize(String(req.query.q ?? ''));
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const filter = { hidden: false };
  if (q) filter.$and = q.split(' ').filter(Boolean).map((t) => ({ searchText: { $regex: escape(t) } }));
  if (req.query.mine === '1') filter.createdBy = req.user.id;
  const foods = await Food.find(filter).sort({ uses: -1, name: 1 }).limit(limit);
  res.json(foods.map((f) => toJSON(f, req.user.id)));
}

export async function create(req, res) {
  const problem = checkValues(req.body);
  if (problem) return res.status(400).json({ message: problem });
  const key = `${normalize(req.body.name)}|${normalize(req.body.brand)}`;
  const existing = await Food.findOne({ key });
  if (existing) {
    return res.status(409).json({ message: 'Ese alimento con esa marca ya existe', food: toJSON(existing, req.user.id) });
  }
  const food = await Food.create({ ...req.body, createdBy: req.user.id });
  res.status(201).json(toJSON(food, req.user.id));
}

export async function update(req, res) {
  const food = await Food.findById(req.params.id);
  if (!food) return res.status(404).json({ message: 'Alimento no encontrado' });
  if (String(food.createdBy) !== req.user.id) return res.status(403).json({ message: 'Solo quien lo creó puede editarlo' });
  const problem = checkValues(req.body);
  if (problem) return res.status(400).json({ message: problem });
  food.set(req.body);
  const dup = await Food.findOne({ key: `${normalize(food.name)}|${normalize(food.brand)}`, _id: { $ne: food._id } });
  if (dup) return res.status(409).json({ message: 'Ya existe otro alimento con ese nombre y marca' });
  await food.save();
  res.json(toJSON(food, req.user.id));
}

export async function remove(req, res) {
  const food = await Food.findById(req.params.id);
  if (!food) return res.status(404).json({ message: 'Alimento no encontrado' });
  if (String(food.createdBy) !== req.user.id) return res.status(403).json({ message: 'Solo quien lo creó puede borrarlo' });
  // Las comidas guardan su propia copia de los valores, así que borrar no rompe nada
  await food.deleteOne();
  res.status(204).end();
}

// 🚩 Con 3 reportes de usuarios distintos, deja de aparecer en la búsqueda
export async function report(req, res) {
  const food = await Food.findById(req.params.id);
  if (!food) return res.status(404).json({ message: 'Alimento no encontrado' });
  if (!food.reportedBy.some((id) => String(id) === req.user.id)) {
    food.reportedBy.push(req.user.id);
    if (food.reportedBy.length >= 3) food.hidden = true;
    await food.save();
  }
  res.json({ reported: true });
}

// Suma un uso a cada alimento que aparece en las comidas guardadas
export async function countUses(meals) {
  const ids = meals
    .flatMap((m) => m?.ingredients ?? [])
    .map((i) => i.foodId)
    .filter((id) => id && mongoose.isValidObjectId(id));
  if (ids.length) await Food.updateMany({ _id: { $in: [...new Set(ids.map(String))] } }, { $inc: { uses: 1 } });
}
