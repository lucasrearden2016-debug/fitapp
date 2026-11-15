// Todo lo numérico de nutrición se resuelve con código, NO con la IA:
// es determinístico, gratis y no "alucina" números.

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
const GOAL_ADJ = { lose: 0.8, maintain: 1, gain: 1.1 };

/**
 * Objetivo diario. `adjustment` son las kcal que el ajuste automático por peso
 * fue sumando/restando (ver evaluateWeight).
 */
export function calculateTargets(profile, adjustment = 0) {
  const { sex, age, heightCm, weightKg, activityLevel, goal } = profile;
  // Mifflin-St Jeor
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  const tdee = bmr * (ACTIVITY[activityLevel] ?? 1.375);
  const calories = Math.round((tdee * (GOAL_ADJ[goal] ?? 1) + adjustment) / 10) * 10;

  const protein = Math.round(weightKg * (goal === 'lose' ? 2 : 1.8));
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee), adjustment };
}

// Lunes de la semana actual a las 00:00
export function currentWeekStart(date = new Date()) {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------- Reparto del día entre comidas ----------

const SPLITS = {
  2: [['almuerzo', 0.5], ['cena', 0.5]],
  3: [['desayuno', 0.3], ['almuerzo', 0.4], ['cena', 0.3]],
  4: [['desayuno', 0.25], ['almuerzo', 0.35], ['merienda', 0.15], ['cena', 0.25]],
  5: [['desayuno', 0.2], ['colación', 0.1], ['almuerzo', 0.3], ['merienda', 0.15], ['cena', 0.25]],
  6: [['desayuno', 0.2], ['colación', 0.1], ['almuerzo', 0.25], ['merienda', 0.15], ['cena', 0.2], ['snack nocturno', 0.1]],
};

export function mealTargets(targets, mealsPerDay = 4) {
  const split = SPLITS[mealsPerDay] ?? SPLITS[4];
  return split.map(([type, share]) => ({
    type,
    calories: Math.round(targets.calories * share),
    protein: Math.round(targets.protein * share),
    carbs: Math.round(targets.carbs * share),
    fat: Math.round(targets.fat * share),
  }));
}

export const targetForType = (targets, mealsPerDay, type) => {
  const list = mealTargets(targets, mealsPerDay);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return list.find((m) => norm(type).includes(norm(m.type)) || norm(m.type).includes(norm(type))) ?? list[Math.floor(list.length / 2)];
};

// ---------- Escalado de porciones ----------

// Resuelve A x = b (sistema chico) por eliminación gaussiana. Devuelve null si es singular.
function solve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-9) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Factores por comida que cumplen las restricciones `rows · f = goals`
 * cambiando lo menos posible las porciones (mínimos cuadrados sobre f - 1).
 */
function minChangeFactors(rows, goals) {
  const n = rows[0].length;
  const residual = rows.map((r, i) => goals[i] - r.reduce((a, v) => a + v, 0));
  const gram = rows.map((ri) => rows.map((rj) => ri.reduce((a, v, k) => a + v * rj[k], 0)));
  const lambda = solve(gram, residual);
  if (!lambda) return null;
  return Array.from({ length: n }, (_, k) => 1 + rows.reduce((a, r, i) => a + lambda[i] * r[k], 0));
}

const MIN_F = 0.5;
const MAX_F = 2.2;
const inRange = (fs) => fs && fs.every((f) => f >= MIN_F && f <= MAX_F);

/**
 * Elige cuánto agrandar/achicar cada comida del día para llegar al objetivo.
 * 1) intenta clavar proteína, carbos y grasas
 * 2) si las porciones quedan absurdas, clava calorías y proteína
 * 3) si tampoco, escala todo parejo para clavar calorías
 */
export function dayFactors(meals, targets) {
  const P = meals.map((m) => m.protein || 0);
  const C = meals.map((m) => m.carbs || 0);
  const F = meals.map((m) => m.fat || 0);
  const K = meals.map((m) => m.calories || 0);

  let fs = minChangeFactors([P, C, F], [targets.protein, targets.carbs, targets.fat]);
  if (inRange(fs)) return fs;
  fs = minChangeFactors([K, P], [targets.calories, targets.protein]);
  if (inRange(fs)) return fs;

  const total = K.reduce((a, v) => a + v, 0) || 1;
  const uniform = Math.min(MAX_F, Math.max(MIN_F, targets.calories / total));
  return meals.map(() => uniform);
}

// Redondeo "de cocina" según la unidad
function roundAmount(amount, unit = '') {
  const u = unit.toLowerCase();
  if (u === 'g' || u === 'ml') return amount >= 20 ? Math.round(amount / 5) * 5 : Math.max(1, Math.round(amount));
  return Math.max(0.5, Math.round(amount * 2) / 2);
}

export function formatQuantity(amount, unit) {
  if (!amount) return unit || 'a gusto';
  const n = String(amount).replace('.', ',');
  if (!unit) return n;
  if (unit === 'unidad' && amount > 1) return `${n} unidades`;
  return `${n} ${unit}`;
}

// Escala una comida completa (ingredientes y macros) por un factor
export function scaleMeal(meal, f) {
  const r = (v) => Math.round((v || 0) * f);
  const protein = r(meal.protein);
  const carbs = r(meal.carbs);
  const fat = r(meal.fat);
  return {
    ...meal,
    // calorías consistentes con los macros (4/4/9), así los totales cierran
    calories: protein * 4 + carbs * 4 + fat * 9,
    protein,
    carbs,
    fat,
    ingredients: (meal.ingredients ?? []).map((i) => {
      if (!i.amount) return { ...i, quantity: formatQuantity(i.amount, i.unit) };
      const amount = roundAmount(i.amount * f, i.unit);
      return { ...i, amount, quantity: formatQuantity(amount, i.unit) };
    }),
  };
}

export function balanceDay(meals, targets) {
  const fs = dayFactors(meals, targets);
  return meals.map((m, i) => scaleMeal(m, fs[i]));
}

// Ajusta una sola comida para que tenga las calorías pedidas
export function fitMeal(meal, calories) {
  const base = (meal.protein || 0) * 4 + (meal.carbs || 0) * 4 + (meal.fat || 0) * 9 || meal.calories || calories;
  return scaleMeal(meal, Math.min(MAX_F, Math.max(MIN_F, calories / base)));
}

// ---------- Ajuste automático por peso ----------

// % del peso por semana que se considera "bien" según el objetivo
const EXPECTED = { lose: [-1.0, -0.25], maintain: [-0.25, 0.25], gain: [0.1, 0.5] };
const STEP = 150;
const MAX_ADJ = 600;

/**
 * Mira los registros de peso de las últimas 5 semanas y decide si hay que
 * mover las calorías. Devuelve { rate, expected, change, message }.
 */
export function evaluateWeight(logs, goal, currentAdjustment = 0, lastAdjustmentAt = null, now = new Date()) {
  const expected = EXPECTED[goal] ?? EXPECTED.maintain;
  const recent = logs
    .filter((l) => now - new Date(l.date) <= 35 * 864e5)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const days = recent.length > 1 ? (new Date(recent.at(-1).date) - new Date(recent[0].date)) / 864e5 : 0;
  if (recent.length < 3 || days < 13) {
    return {
      rate: null,
      expected,
      change: 0,
      message: 'Registrá tu peso una vez por semana (mismo día, en ayunas). Con 2 semanas de datos empezamos a ajustar tus calorías.',
    };
  }

  // Pendiente por regresión lineal (kg/día) → % del peso por semana
  const xs = recent.map((l) => (new Date(l.date) - new Date(recent[0].date)) / 864e5);
  const ys = recent.map((l) => l.weightKg);
  const mx = xs.reduce((a, v) => a + v, 0) / xs.length;
  const my = ys.reduce((a, v) => a + v, 0) / ys.length;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const rate = Math.round(((slope * 7) / ys.at(-1)) * 1000) / 10 || 0; // % por semana

  const canAdjust = !lastAdjustmentAt || now - new Date(lastAdjustmentAt) >= 7 * 864e5;
  let change = 0;
  if (rate > expected[1]) change = -STEP;
  if (rate < expected[0]) change = STEP;
  if (!canAdjust) change = 0;
  change = Math.max(-MAX_ADJ, Math.min(MAX_ADJ, currentAdjustment + change)) - currentAdjustment;

  const fmt = (n) => `${n > 0 ? '+' : ''}${n}%`;
  let message;
  if (rate >= expected[0] && rate <= expected[1]) message = `Vas ${fmt(rate)} por semana: dentro de lo esperado (${fmt(expected[0])} a ${fmt(expected[1])}). Seguimos igual.`;
  else if (change) message = `Vas ${fmt(rate)} por semana y lo esperado es ${fmt(expected[0])} a ${fmt(expected[1])}. Ajustamos tus calorías ${change > 0 ? '+' : ''}${change} kcal/día.`;
  else if (!canAdjust) message = `Vas ${fmt(rate)} por semana. Ya ajustamos hace menos de 7 días: esperamos a ver el efecto.`;
  else message = `Vas ${fmt(rate)} por semana. Llegamos al ajuste máximo (±${MAX_ADJ} kcal); conviene revisar actividad o adherencia.`;

  return { rate, expected, change, message };
}

// Normaliza una comida cargada a mano: texto de cantidades y números redondos
export function normalizeMeal(meal) {
  const r = (v) => Math.round(Number(v) || 0);
  return {
    ...meal,
    calories: r(meal.calories),
    protein: r(meal.protein),
    carbs: r(meal.carbs),
    fat: r(meal.fat),
    ingredients: (meal.ingredients ?? [])
      .filter((i) => i.name?.trim())
      .map((i) => ({
        name: i.name.trim(),
        amount: Number(i.amount) || 0,
        unit: i.unit || (i.amount ? 'g' : 'a gusto'),
        section: i.section || 'Otros',
        quantity: formatQuantity(Number(i.amount) || 0, i.unit || (i.amount ? 'g' : 'a gusto')),
      })),
  };
}
