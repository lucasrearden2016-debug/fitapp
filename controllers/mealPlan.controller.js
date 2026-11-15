import MealPlan from '../models/MealPlan.js';
import User from '../models/User.js';
import { calculateTargets, currentWeekStart, fitMeal, targetForType } from '../services/nutrition.js';
import { buildShoppingList, buildWeek } from '../services/mealPlanner.js';
import { generateAlternative, generateFromFridge, generateRecipe } from '../services/aiMeals.js';

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
export async function replace(req, res) {
  const { plan, day, index, meal } = await loadPlan(req, res);
  if (!meal) return;
  const fitted = fitMeal(req.body.meal, meal.calories);
  res.json(await replaceMeal(plan, day, index, { ...fitted, type: meal.type, recipe: req.body.meal.recipe }));
}

// 🧊 ¿Qué cocino con lo que tengo?
export async function fridge(req, res) {
  const user = await User.findById(req.user.id);
  if (!user.onboarded) return res.status(400).json({ message: 'Completá tu perfil primero' });
  const target = targetForType(targetsOf(user), user.profile.mealsPerDay, req.body.type);
  const meal = await generateFromFridge(user, { ...target, type: req.body.type }, req.body.ingredients, req.body.note);
  res.json({ ...fitMeal(meal, target.calories), type: req.body.type, recipe: meal.recipe });
}
