import MealPlan from '../models/MealPlan.js';
import User from '../models/User.js';
import { calculateTargets, currentWeekStart } from '../services/nutrition.js';
import { generateMealPlan, generateRecipe } from '../services/ai.js';

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
  if (!user.onboarded) return res.status(400).json({ message: 'Completá la encuesta primero' });

  const targets = calculateTargets(user.profile);
  const { days, shoppingList } = await generateMealPlan(user, targets, req.body.feedback);
  const weekStart = currentWeekStart();

  const plan = await MealPlan.findOneAndUpdate(
    { user: user._id, weekStart },
    { targets, days, shoppingList, feedback: req.body.feedback },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json(plan);
}

// Receta a demanda para una comida concreta (se cachea en el plan)
export async function getRecipe(req, res) {
  const plan = await MealPlan.findOne({ _id: req.params.planId, user: req.user.id });
  if (!plan) return res.status(404).json({ message: 'Plan no encontrado' });

  const meal = plan.days.flatMap((d) => d.meals).find((m) => m._id.toString() === req.params.mealId);
  if (!meal) return res.status(404).json({ message: 'Comida no encontrada' });

  if (!meal.recipe?.steps?.length) {
    const user = await User.findById(req.user.id);
    meal.recipe = await generateRecipe(meal, user);
    await plan.save();
  }
  res.json({ meal: meal.name, ingredients: meal.ingredients, ...meal.recipe.toObject() });
}
