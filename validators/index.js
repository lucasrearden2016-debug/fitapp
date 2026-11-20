import Joi from 'joi';

const username = Joi.string()
  .lowercase()
  .pattern(/^[a-z0-9._]{3,20}$/)
  .messages({ 'string.pattern.base': 'El usuario debe tener de 3 a 20 caracteres: letras, números, punto o guion bajo' });

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  username: username.required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

// Se puede entrar con usuario o con email (`email` queda por compatibilidad)
export const loginSchema = Joi.object({
  identifier: Joi.string().max(100),
  email: Joi.string().max(100),
  password: Joi.string().required(),
}).or('identifier', 'email');

export const usernameSchema = Joi.object({ username: username.required() });

const food = Joi.object({
  name: Joi.string().max(60).required(),
  liked: Joi.boolean().default(true),
  canCook: Joi.boolean().default(false),
});

export const onboardingSchema = Joi.object({
  profile: Joi.object({
    sex: Joi.string().valid('male', 'female').required(),
    age: Joi.number().integer().min(14).max(100).required(),
    heightCm: Joi.number().min(120).max(230).required(),
    weightKg: Joi.number().min(35).max(300).required(),
    activityLevel: Joi.string().valid('sedentary', 'light', 'moderate', 'active', 'very_active').required(),
    goal: Joi.string().valid('lose', 'maintain', 'gain').required(),
    mealsPerDay: Joi.number().integer().min(2).max(6).default(4),
    restrictions: Joi.array().items(Joi.string().max(60)).default([]),
    cookingSkill: Joi.string().valid('basic', 'intermediate', 'advanced').default('basic'),
    maxCookingMinutes: Joi.number().min(5).max(180).default(30),
    budget: Joi.string().valid('low', 'medium', 'high').default('medium'),
  }).required(),
  foods: Joi.array().items(food).default([]),
  gym: Joi.object({
    experience: Joi.string().valid('beginner', 'intermediate', 'advanced').required(),
    daysPerWeek: Joi.number().integer().min(1).max(7).required(),
    minutesPerSession: Joi.number().min(15).max(180).default(60),
    equipment: Joi.string().valid('full_gym', 'home_basic', 'bodyweight').required(),
    goals: Joi.string().max(500).allow(''),
    injuries: Joi.string().max(500).allow(''),
  }),
});

export const foodSchema = food;

export const generatePlanSchema = Joi.object({
  feedback: Joi.string().max(500).allow(''),
});

// ---------- Gimnasio (tabla editable) ----------
const series = Joi.object({
  weightKg: Joi.number().min(0).max(1000).allow(null).default(null),
  reps: Joi.number().integer().min(0).max(1000).allow(null).default(null),
  target: Joi.string().max(20).allow('').default(''),
});

const exercise = Joi.object({
  name: Joi.string().max(80).allow('').default(''),
  series: Joi.array().items(series).max(20).default([]),
  rest: Joi.string().max(20).allow('').default(''),
  notes: Joi.string().max(1000).allow('').default(''),
});

const day = Joi.object({
  name: Joi.string().max(60).required(),
  columns: Joi.number().integer().min(1).max(20).default(3),
  exercises: Joi.array().items(exercise).max(40).default([]),
});

// Autosave: se puede mandar solo el nombre, solo los días o ambos
export const routineSchema = Joi.object({
  name: Joi.string().max(80).allow(''),
  days: Joi.array().items(day).min(1).max(7),
}).or('name', 'days');

export const newRoutineSchema = Joi.object({
  name: Joi.string().max(80).allow(''),
  days: Joi.array().items(day).max(7),
});

// ---------- Comidas ----------
const ingredientIn = Joi.object({
  name: Joi.string().max(80).required(),
  amount: Joi.number().min(0).max(5000).allow(null),
  unit: Joi.string().max(20).allow(''),
  quantity: Joi.string().max(40).allow(''),
  section: Joi.string().max(40).allow(''),
  foodId: Joi.string().hex().length(24),
  brand: Joi.string().max(60).allow(''),
  per100: Joi.object({
    calories: Joi.number().min(0).max(900),
    protein: Joi.number().min(0).max(100),
    carbs: Joi.number().min(0).max(100),
    fat: Joi.number().min(0).max(100),
  }),
  baseUnit: Joi.string().valid('g', 'ml'),
  unitName: Joi.string().max(20).allow(''),
  unitGrams: Joi.number().min(0).max(2000).allow(null),
});

const mealIn = Joi.object({
  type: Joi.string().max(40).allow(''),
  name: Joi.string().max(120).required(),
  description: Joi.string().max(500).allow(''),
  ingredients: Joi.array().items(ingredientIn).max(30).default([]),
  calories: Joi.number().min(0).max(5000).required(),
  protein: Joi.number().min(0).max(500).required(),
  carbs: Joi.number().min(0).max(800).required(),
  fat: Joi.number().min(0).max(400).required(),
  recipe: Joi.object({
    timeMinutes: Joi.number().min(0).max(600),
    steps: Joi.array().items(Joi.string().max(600)).max(30),
    tips: Joi.string().max(600).allow(''),
  }),
});

export const eatenSchema = Joi.object({ eaten: Joi.boolean().required() });
export const swapSchema = Joi.object({ hint: Joi.string().max(200).allow('') });
export const replaceMealSchema = Joi.object({ meal: mealIn.required(), fit: Joi.boolean().default(true) });
export const addMealSchema = Joi.object({ meal: mealIn.required() });
export const suggestSchema = Joi.object({ type: Joi.string().max(40).required() });
export const estimateSchema = Joi.object({
  name: Joi.string().max(120).required(),
  description: Joi.string().max(500).allow(''),
  ingredients: Joi.array().items(ingredientIn).max(30).default([]),
});
export const favoriteSchema = Joi.object({ meal: mealIn.required() });
export const fridgeSchema = Joi.object({
  ingredients: Joi.array().items(Joi.string().max(60)).min(1).max(30).required(),
  type: Joi.string().max(40).required(),
  note: Joi.string().max(200).allow(''),
});
export const weightSchema = Joi.object({
  weightKg: Joi.number().min(30).max(300).required(),
  date: Joi.date().max('now'),
});

// ---------- Base de alimentos (valores por 100 g / 100 ml) ----------
const SECTIONS = ['Verdulería', 'Carnicería y pescadería', 'Lácteos y huevos', 'Almacén', 'Panadería', 'Congelados', 'Otros'];
export const foodItemSchema = Joi.object({
  name: Joi.string().max(80).required(),
  brand: Joi.string().max(60).empty('').default('Genérico'),
  baseUnit: Joi.string().valid('g', 'ml').default('g'),
  calories: Joi.number().min(0).max(900).required(),
  protein: Joi.number().min(0).max(100).required(),
  carbs: Joi.number().min(0).max(100).required(),
  fat: Joi.number().min(0).max(100).required(),
  fiber: Joi.number().min(0).max(100).allow(null),
  sugar: Joi.number().min(0).max(100).allow(null),
  sodiumMg: Joi.number().min(0).max(50000).allow(null),
  unitName: Joi.string().max(20).allow(''),
  unitGrams: Joi.number().min(0.1).max(2000).allow(null),
  section: Joi.string().valid(...SECTIONS).default('Otros'),
});
