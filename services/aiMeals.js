import { Type } from '@google/genai';
import { generateJSON } from '../config/gemini.js';

export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SECTIONS = ['Verdulería', 'Carnicería y pescadería', 'Lácteos y huevos', 'Almacén', 'Panadería', 'Congelados', 'Otros'];
const UNITS = ['g', 'ml', 'unidad', 'cda', 'cdita', 'taza', 'a gusto'];

// ---------- Schemas de salida ----------

const ingredientOut = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    amount: { type: Type.NUMBER, description: 'Cantidad numérica (0 si es "a gusto")' },
    unit: { type: Type.STRING, enum: UNITS },
    section: { type: Type.STRING, enum: SECTIONS, description: 'Sección del súper donde se compra' },
  },
  required: ['name', 'amount', 'unit', 'section'],
};

const mealOut = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING },
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    ingredients: { type: Type.ARRAY, items: ingredientOut },
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
    fat: { type: Type.NUMBER },
  },
  required: ['type', 'name', 'description', 'ingredients', 'calories', 'protein', 'carbs', 'fat'],
};

const dayOut = {
  type: Type.OBJECT,
  properties: { day: { type: Type.STRING }, meals: { type: Type.ARRAY, items: mealOut } },
  required: ['day', 'meals'],
};

const recipeProps = {
  timeMinutes: { type: Type.NUMBER },
  steps: { type: Type.ARRAY, items: { type: Type.STRING } },
  tips: { type: Type.STRING },
};

const recipeOut = { type: Type.OBJECT, properties: recipeProps, required: ['timeMinutes', 'steps'] };

const mealWithRecipeOut = {
  type: Type.OBJECT,
  properties: { ...mealOut.properties, recipe: { type: Type.OBJECT, properties: recipeProps, required: ['timeMinutes', 'steps'] } },
  required: [...mealOut.required, 'recipe'],
};

// ---------- Contexto común ----------

const SYSTEM = `Sos un nutricionista deportivo que arma comidas prácticas y ricas, en español rioplatense.
Reglas:
- Respetás estrictamente restricciones y alergias, y nunca usás lo que al usuario no le gusta.
- Cada comida debe acercarse a SU objetivo de macros (±10%). Para subir proteína usá carnes magras, huevo, lácteos, legumbres, atún.
- Las cantidades son numéricas y realistas: gramos o ml para casi todo; "unidad" solo para cosas contables (huevos, frutas, panes).
- Los macros de cada comida tienen que corresponder a sus ingredientes y cantidades (calorías ≈ 4·proteína + 4·carbos + 9·grasas).
- Ingredientes accesibles en Uruguay/Argentina; reutilizás ingredientes entre días para reducir desperdicio.`;

function profileContext(user) {
  const p = user.profile;
  const liked = user.foods.filter((f) => f.liked).map((f) => `${f.name}${f.canCook ? ' (sabe cocinarlo)' : ''}`);
  const disliked = user.foods.filter((f) => !f.liked).map((f) => f.name);
  return `Restricciones/alergias: ${p.restrictions?.join(', ') || 'ninguna'}.
Le gusta: ${liked.join(', ') || 'sin datos'}.
NO le gusta / evitar: ${disliked.join(', ') || 'nada'}.
Nivel de cocina: ${p.cookingSkill}. Tiempo máximo por comida: ${p.maxCookingMinutes} min. Presupuesto: ${p.budget}.`;
}

const fmtTargets = (perMeal) =>
  perMeal.map((m) => `- ${m.type}: ${m.calories} kcal · ${m.protein} g proteína · ${m.carbs} g carbos · ${m.fat} g grasas`).join('\n');

// ---------- Generadores ----------

export async function generateWeek(user, perMeal, { feedback, favorites = [] } = {}) {
  const prompt = `Armá un plan de comidas de 7 días (${DAYS.join(', ')}).
Cada día tiene exactamente estas comidas, con estos objetivos:
${fmtTargets(perMeal)}

${profileContext(user)}
${favorites.length ? `Comidas favoritas (incluí 2 o 3 en la semana): ${favorites.join(', ')}.` : ''}
${feedback ? `Pedido del usuario para esta semana: "${feedback}"` : ''}
Variá las comidas entre días (no repitas el mismo plato más de 2 veces en la semana).`;

  const res = await generateJSON({
    system: SYSTEM,
    prompt,
    schema: { type: Type.OBJECT, properties: { days: { type: Type.ARRAY, items: dayOut } }, required: ['days'] },
  });
  return res.days;
}

// Rehace un día que quedó muy desbalanceado
export async function regenerateDay(user, dayName, perMeal, { avoid = [], issue } = {}) {
  const prompt = `Armá las comidas del ${dayName} con estos objetivos:
${fmtTargets(perMeal)}

${profileContext(user)}
La versión anterior de este día falló: ${issue}. Corregilo eligiendo otros platos.
No repitas estos platos de otros días: ${avoid.join(', ')}.`;
  return generateJSON({ system: SYSTEM, prompt, schema: dayOut, temperature: 0.6 });
}

// Otra opción para una comida puntual
export async function generateAlternative(user, target, { avoid = [], hint } = {}) {
  const prompt = `Proponé UNA comida de tipo "${target.type}" con este objetivo: ${target.calories} kcal · ${target.protein} g proteína · ${target.carbs} g carbos · ${target.fat} g grasas.
${profileContext(user)}
Tiene que ser distinta a: ${avoid.join(', ')}.
${hint ? `El usuario pide: "${hint}"` : ''}`;
  return generateJSON({ system: SYSTEM, prompt, schema: mealOut, temperature: 0.9 });
}

// "¿Qué cocino con lo que tengo?"
export async function generateFromFridge(user, target, ingredients, note) {
  const prompt = `El usuario tiene en casa: ${ingredients.join(', ')}.
Proponé UNA comida de tipo "${target.type}" usando principalmente esos ingredientes (podés sumar básicos de alacena: aceite, sal, especias, condimentos).
Objetivo: ${target.calories} kcal · ${target.protein} g proteína · ${target.carbs} g carbos · ${target.fat} g grasas.
${profileContext(user)}
${note ? `Además: "${note}"` : ''}
Incluí la receta paso a paso.`;
  return generateJSON({ system: SYSTEM, prompt, schema: mealWithRecipeOut, temperature: 0.7 });
}

export async function generateRecipe(meal, user) {
  const prompt = `Escribí la receta paso a paso para "${meal.name}" (${meal.description ?? ''}).
Ingredientes: ${meal.ingredients.map((i) => `${i.quantity} ${i.name}`).join(', ')}.
Nivel de cocina del usuario: ${user.profile.cookingSkill}. Pasos cortos y claros. Respetá las cantidades.`;
  return generateJSON({ system: SYSTEM, prompt, schema: recipeOut, temperature: 0.4 });
}
