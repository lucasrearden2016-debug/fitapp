import { Type } from '@google/genai';
import { generateJSON } from '../config/gemini.js';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ---------- Schemas de salida (Gemini responde JSON con esta forma) ----------

const mealOut = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING },
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, quantity: { type: Type.STRING } },
        required: ['name', 'quantity'],
      },
    },
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
    fat: { type: Type.NUMBER },
  },
  required: ['type', 'name', 'ingredients', 'calories', 'protein', 'carbs', 'fat'],
};

const mealPlanOut = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { day: { type: Type.STRING }, meals: { type: Type.ARRAY, items: mealOut } },
        required: ['day', 'meals'],
      },
    },
    shoppingList: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['days', 'shoppingList'],
};

const recipeOut = {
  type: Type.OBJECT,
  properties: {
    timeMinutes: { type: Type.NUMBER },
    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
    tips: { type: Type.STRING },
  },
  required: ['timeMinutes', 'steps'],
};

const routineOut = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sets: { type: Type.NUMBER },
                reps: { type: Type.STRING },
                restSeconds: { type: Type.NUMBER },
                notes: { type: Type.STRING },
              },
              required: ['name', 'sets', 'reps'],
            },
          },
        },
        required: ['name', 'exercises'],
      },
    },
  },
  required: ['name', 'days'],
};

const reviewOut = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['summary', 'suggestions'],
};

// ---------- Prompts ----------

const NUTRI_SYSTEM = `Sos un nutricionista que arma planes semanales prácticos, en español rioplatense.
Respetás estrictamente restricciones y alergias. Priorizás comidas que al usuario le gustan y sabe cocinar,
pero introducís variedad. Usás ingredientes accesibles y reutilizás ingredientes entre días para reducir desperdicio.
Las cantidades van en gramos o unidades caseras. Los macros de cada comida deben ser realistas.`;

const COACH_SYSTEM = `Sos un entrenador personal certificado. Diseñás rutinas seguras, basadas en evidencia
(sobrecarga progresiva, volumen adecuado por grupo muscular, frecuencia 2x por músculo cuando se puede).
Respetás lesiones y el equipamiento disponible. Respondés en español rioplatense.`;

export async function generateMealPlan(user, targets, feedback) {
  const p = user.profile;
  const liked = user.foods.filter((f) => f.liked).map((f) => `${f.name}${f.canCook ? ' (sabe cocinarlo)' : ''}`);
  const disliked = user.foods.filter((f) => !f.liked).map((f) => f.name);

  const prompt = `Armá un plan de comidas de 7 días (${DAYS.join(', ')}).
Objetivo diario aproximado: ${targets.calories} kcal, ${targets.protein} g proteína, ${targets.carbs} g carbohidratos, ${targets.fat} g grasa.
Comidas por día: ${p.mealsPerDay}.
Restricciones/alergias: ${p.restrictions?.join(', ') || 'ninguna'}.
Le gusta: ${liked.join(', ') || 'sin datos'}.
NO le gusta / evitar: ${disliked.join(', ') || 'nada'}.
Nivel de cocina: ${p.cookingSkill}. Tiempo máximo por comida: ${p.maxCookingMinutes} min. Presupuesto: ${p.budget}.
${feedback ? `Pedido del usuario para esta semana: "${feedback}"` : ''}
Incluí también una lista de compras consolidada para la semana.`;

  return generateJSON({ system: NUTRI_SYSTEM, prompt, schema: mealPlanOut });
}

export async function generateRecipe(meal, user) {
  const prompt = `Escribí la receta paso a paso para "${meal.name}" (${meal.description ?? ''}).
Ingredientes: ${meal.ingredients.map((i) => `${i.quantity} ${i.name}`).join(', ')}.
Nivel de cocina del usuario: ${user.profile.cookingSkill}. Pasos cortos y claros.`;
  return generateJSON({ system: NUTRI_SYSTEM, prompt, schema: recipeOut, temperature: 0.4 });
}

export async function generateRoutine(user) {
  const g = user.gym;
  const prompt = `Diseñá una rutina semanal.
Experiencia: ${g.experience}. Días por semana: ${g.daysPerWeek}. Minutos por sesión: ${g.minutesPerSession ?? 60}.
Equipamiento: ${g.equipment}. Objetivos: ${g.goals || user.profile?.goal || 'salud general'}.
Lesiones/limitaciones: ${g.injuries || 'ninguna'}.
Un día de entrenamiento por cada día pedido. Incluí notas de técnica breves en los ejercicios clave.`;
  return generateJSON({ system: COACH_SYSTEM, prompt, schema: routineOut });
}

export async function reviewRoutine(routine, logs, user) {
  const history = logs
    .map((l) => `${l.date.toISOString().slice(0, 10)} ${l.dayName}: ` +
      l.entries.map((e) => `${e.exercise} ${e.sets.map((s) => `${s.weightKg}kg x${s.reps}`).join(', ')}`).join(' | '))
    .join('\n');

  const prompt = `Revisá esta rutina y el historial reciente y dame recomendaciones concretas para mejorarla.
Perfil: experiencia ${user.gym?.experience ?? 'desconocida'}, objetivos: ${user.gym?.goals ?? 'no especificados'}, lesiones: ${user.gym?.injuries ?? 'ninguna'}.
Rutina:
${JSON.stringify(routine.days)}
Historial (últimas sesiones):
${history || 'sin registros todavía'}
Detectá estancamientos, desbalances entre grupos musculares y volumen excesivo o insuficiente.
Sugerí progresiones de peso concretas cuando corresponda.`;
  return generateJSON({ system: COACH_SYSTEM, prompt, schema: reviewOut, temperature: 0.5 });
}
