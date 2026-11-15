import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

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
