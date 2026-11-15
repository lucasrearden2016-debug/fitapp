import MealPlan from '../models/MealPlan.js';
import User from '../models/User.js';
import { calculateTargets, currentWeekStart, fitMeal, normalizeMeal, targetForType } from '../services/nutrition.js';
import { buildShoppingList, buildWeek } from '../services/mealPlanner.js';
import { DAYS, estimateMeal, generateAlternative, generateFromFridge, generateRecipe } from '../services/aiMeals.js';

const targetsOf = (user) => calculateTargets(user.profile, user.nutrition?.calorieAdjustment ?? 0);

async function loadPlan(req, res) {
  const plan = await MealPlan.findOne({ _id: req.params.planId, user: req.user.id });
  if (!plan) {
    res.status(404).json({ message: 'Plan no encontrado' });
    return {};
  }
  for (const day of plan.days) {
    const index = day.meals.findIndex((m) => m._id.toString() === req.params.mealId);
    if (index >= 0) return { plan, day, index, meal: day.meals[index] };
  }
  if (req.params.mealId) res.status(404).json({ message: 'Comida no encontrada' });
  return { plan };
}

export async function getCurrent(req, res) {
  const plan = await MealPlan.findOne({ user: req.user.id }).sort({ weekStart: -1, createdAt: -1 });
  if (!plan) return res.status(404).json({ message: 'Todavía no tenés plan' });
  const isCurrentWeek = plan.weekStart.getTime() === currentWeekStart().getTime();
  res.json({ plan, isCurrentWeek });
}

export async function history(req, res) {
  const plans = await MealPlan.find({ user: req.user.id })
    .sort({ weekStart: -1 })
    .select('weekStart targets feedback createdAt')
    .limit(20);
  res.json(plans);
}

// Genera (o regenera) el plan de la semana actual
export async function generate(req, res) {
  const user = await User.findById(req.user.id);
  if (!user.onboarded) return res.status(400).json({ message: 'Completá tu perfil primero' });

  const targets = targetsOf(user);
  const days = await buildWeek(user, targets, {
    feedback: req.body.feedback,
    favorites: user.favorites.map((f) => f.name),
  });

  const plan = await MealPlan.findOneAndUpdate(
    { user: user._id, weekStart: currentWeekStart() },
    { targets, days, shoppingList: buildShoppingList(days), feedback: req.body.feedback },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  res.status(201).json(plan);
}

// Receta a demanda para una comida concreta (se cachea en el plan)
export async function getRecipe(req, res) {
  const { plan, meal } = await loadPlan(req, res);
  if (!meal) return;
  if (!meal.recipe?.steps?.length) {
    const user = await User.findById(req.user.id);
    meal.recipe = await generateRecipe(meal, user);
    await plan.save();
  }
  res.json({ meal: meal.name, ingredients: meal.ingredients, ...meal.recipe.toObject() });
}

// ✓ Marcar comida como hecha
export async function setEaten(req, res) {
  const { plan, meal } = await loadPlan(req, res);
  if (!meal) return;
  meal.eaten = !!req.body.eaten;
  await plan.save();
  res.json({ eaten: meal.eaten });
}

// Reemplaza la comida y recalcula la lista de compras
async function replaceMeal(plan, day, index, newMeal) {
  day.meals.splice(index, 1, newMeal);
  plan.shoppingList = buildShoppingList(plan.days);
  await plan.save();
  return { meal: day.meals[index], shoppingList: plan.shoppingList };
}

// 🔄 Otra opción para una comida, con las mismas calorías
export async function swap(req, res) {
  const { plan, day, index, meal } = await loadPlan(req, res);
  if (!meal) return;
  const user = await User.findById(req.user.id);
  const target = { type: meal.type, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat };
  const avoid = plan.days.flatMap((d) => d.meals.map((m) => m.name));
  const alt = await generateAlternative(user, target, { avoid, hint: req.body.hint });
  res.json(await replaceMeal(plan, day, index, { ...fitMeal(alt, meal.calories), type: meal.type }));
}

// Reemplazo con una comida que ya tenemos (heladera o favorita)
// fit=true: ajusta porciones a las calorías del lugar (heladera/favorita)
// fit=false: guarda tal cual (edición manual)
export async function replace(req, res) {
  const { plan, day, index, meal } = await loadPlan(req, res);
  if (!meal) return;
  const incoming = req.body.meal;
  const next = req.body.fit === false
    ? { ...normalizeMeal(incoming), type: incoming.type || meal.type, eaten: meal.eaten }
    : { ...fitMeal(incoming, meal.calories), type: meal.type };
  res.json(await replaceMeal(plan, day, index, { ...next, recipe: incoming.recipe }));
}

// 🧊 ¿Qué cocino con lo que tengo?
export async function fridge(req, res) {
  const user = await User.findById(req.user.id);
  if (!user.onboarded) return res.status(400).json({ message: 'Completá tu perfil primero' });
  const target = targetForType(targetsOf(user), user.profile.mealsPerDay, req.body.type);
  const meal = await generateFromFridge(user, { ...target, type: req.body.type }, req.body.ingredients, req.body.note);
  res.json({ ...fitMeal(meal, target.calories), type: req.body.type, recipe: meal.recipe });
}

// ---------- Plan armado a mano ----------

const ORDER = ['desayuno', 'colacion', 'almuerzo', 'merienda', 'cena', 'snack'];
const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const rank = (type) => {
  const i = ORDER.findIndex((o) => norm(type).includes(o));
  return i < 0 ? ORDER.length : i;
};
const sortMeals = (day) => day.meals.sort((a, b) => rank(a.type) - rank(b.type));

function getDay(plan, req, res) {
  const day = plan.days[Number(req.params.dayIndex)];
  if (!day) res.status(404).json({ message: 'Día no encontrado' });
  return day;
}

// Plan vacío para armarlo uno mismo
export async function createBlank(req, res) {
  const user = await User.findById(req.user.id);
  if (!user.onboarded) return res.status(400).json({ message: 'Completá tu perfil primero' });
  const plan = await MealPlan.findOneAndUpdate(
    { user: user._id, weekStart: currentWeekStart() },
    { targets: targetsOf(user), days: DAYS.map((day) => ({ day, meals: [] })), shoppingList: [], feedback: '' },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  res.status(201).json(plan);
}

async function pushMeal(plan, day, meal) {
  day.meals.push(meal);
  const added = day.meals.at(-1);
  sortMeals(day);
  plan.shoppingList = buildShoppingList(plan.days);
  await plan.save();
  return { meal: added, meals: day.meals, shoppingList: plan.shoppingList };
}

export async function addMeal(req, res) {
  const { plan } = await loadPlan(req, res);
  if (!plan) return;
  const day = getDay(plan, req, res);
  if (!day) return;
  res.status(201).json(await pushMeal(plan, day, normalizeMeal(req.body.meal)));
}

export async function removeMeal(req, res) {
  const { plan, day, index, meal } = await loadPlan(req, res);
  if (!meal) return;
  day.meals.splice(index, 1);
  plan.shoppingList = buildShoppingList(plan.days);
  await plan.save();
  res.json({ shoppingList: plan.shoppingList });
}

// ✨ La IA propone una comida para un hueco del día
export async function suggest(req, res) {
  const { plan } = await loadPlan(req, res);
  if (!plan) return;
  const day = getDay(plan, req, res);
  if (!day) return;
  const user = await User.findById(req.user.id);
  const target = { ...targetForType(plan.targets, user.profile.mealsPerDay, req.body.type), type: req.body.type };
  const avoid = plan.days.flatMap((d) => d.meals.map((m) => m.name));
  const meal = await generateAlternative(user, target, { avoid });
  res.status(201).json(await pushMeal(plan, day, { ...fitMeal(meal, target.calories), type: req.body.type }));
}

// Calcula macros (y secciones del súper) de una comida cargada a mano
export async function estimate(req, res) {
  const { name, description, ingredients = [] } = req.body;
  const ai = await estimateMeal({ name, description, ingredients });
  // Si el usuario cargó ingredientes respetamos sus cantidades; solo tomamos la sección
  const merged = ingredients.length
    ? ingredients.map((i, k) => ({ ...i, section: ai.ingredients.find((a) => norm(a.name) === norm(i.name))?.section ?? ai.ingredients[k]?.section ?? 'Otros' }))
    : ai.ingredients;
  res.json(normalizeMeal({ name, description, calories: ai.calories, protein: ai.protein, carbs: ai.carbs, fat: ai.fat, ingredients: merged }));
}
