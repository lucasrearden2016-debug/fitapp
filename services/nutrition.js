// Los objetivos calóricos se calculan con fórmulas, NO con la IA:
// es determinístico, gratis y no "alucina" números.

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
const GOAL_ADJ = { lose: 0.8, maintain: 1, gain: 1.1 };

export function calculateTargets(profile) {
  const { sex, age, heightCm, weightKg, activityLevel, goal } = profile;
  // Mifflin-St Jeor
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  const tdee = bmr * (ACTIVITY[activityLevel] ?? 1.375);
  const calories = Math.round((tdee * (GOAL_ADJ[goal] ?? 1)) / 10) * 10;

  const protein = Math.round(weightKg * (goal === 'lose' ? 2 : 1.8));
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee) };
}

// Lunes de la semana actual a las 00:00
export function currentWeekStart(date = new Date()) {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
