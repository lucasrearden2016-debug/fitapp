import { balanceDay, mealTargets } from './nutrition.js';
import { generateWeek, regenerateDay, SECTIONS } from './aiMeals.js';

const KEYS = ['calories', 'protein', 'carbs', 'fat'];
const TOLERANCE = { calories: 0.07, protein: 0.12, carbs: 0.15, fat: 0.15 };
const LABEL = { calories: 'calorías', protein: 'proteína', carbs: 'carbohidratos', fat: 'grasas' };

export const dayTotals = (meals) =>
  Object.fromEntries(KEYS.map((k) => [k, meals.reduce((a, m) => a + (m[k] || 0), 0)]));

// Qué tan lejos quedó el día del objetivo (0 = perfecto)
function deviation(meals, targets) {
  const t = dayTotals(meals);
  const issues = [];
  let score = 0;
  for (const k of KEYS) {
    const diff = (t[k] - targets[k]) / targets[k];
    score += Math.abs(diff);
    if (Math.abs(diff) > TOLERANCE[k]) issues.push(`${diff > 0 ? 'se pasó' : 'le faltó'} ${LABEL[k]} (${Math.round(t[k])} de ${targets[k]})`);
  }
  return { score, issues };
}

/**
 * Plan semanal completo:
 * 1) la IA propone la semana con objetivos por comida
 * 2) el código escala porciones para cerrar los macros de cada día
 * 3) los días que siguen desbalanceados se rehacen una vez (en paralelo)
 */
export async function buildWeek(user, targets, { feedback, favorites } = {}) {
  const perMeal = mealTargets(targets, user.profile.mealsPerDay);
  const raw = await generateWeek(user, perMeal, { feedback, favorites });
  const days = raw.map((d) => ({ day: d.day, meals: balanceDay(d.meals, targets) }));

  const bad = days
    .map((d, i) => ({ i, ...deviation(d.meals, targets) }))
    .filter((d) => d.issues.length);

  if (bad.length) {
    const allNames = days.flatMap((d) => d.meals.map((m) => m.name));
    const retries = await Promise.allSettled(
      bad.map((b) => regenerateDay(user, days[b.i].day, perMeal, { avoid: allNames, issue: b.issues.join(', ') }))
    );
    retries.forEach((r, k) => {
      if (r.status !== 'fulfilled') return;
      const { i, score } = bad[k];
      const meals = balanceDay(r.value.meals, targets);
      if (deviation(meals, targets).score < score) days[i] = { day: days[i].day, meals };
    });
  }
  return days;
}

// ---------- Lista de compras (calculada con las cantidades ya escaladas) ----------

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const num = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

function fmtTotal(amount, unit) {
  if (unit === 'g') return amount >= 1000 ? `${num(amount / 1000)} kg` : `${Math.round(amount / 10) * 10} g`;
  if (unit === 'ml') return amount >= 1000 ? `${num(amount / 1000)} L` : `${Math.round(amount / 10) * 10} ml`;
  if (unit === 'unidad') return `x${Math.ceil(amount)}`;
  if (unit === 'a gusto' || !amount) return '';
  return `${num(amount)} ${unit}`;
}

export function buildShoppingList(days) {
  const map = new Map();
  for (const day of days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients ?? []) {
        if (!ing.name) continue;
        const key = `${norm(ing.name)}|${ing.unit ?? ''}`;
        const prev = map.get(key) ?? { name: cap(ing.name.trim()), unit: ing.unit, amount: 0, section: ing.section };
        prev.amount += ing.amount || 0;
        map.set(key, prev);
      }
    }
  }
  return [...map.values()]
    .map((x) => ({
      item: [x.name, fmtTotal(x.amount, x.unit)].filter(Boolean).join(' '),
      section: SECTIONS.includes(x.section) ? x.section : 'Otros',
    }))
    .sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.item.localeCompare(b.item, 'es'));
}
