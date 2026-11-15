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

const exercise = Joi.object({
  name: Joi.string().max(80).required(),
  sets: Joi.number().integer().min(1).max(20).default(3),
  reps: Joi.string().max(20).default('8-12'),
  restSeconds: Joi.number().min(0).max(600).default(90),
  notes: Joi.string().max(1000).allow(''),
});

export const routineSchema = Joi.object({
  name: Joi.string().max(80).required(),
  active: Joi.boolean(),
  days: Joi.array()
    .items(Joi.object({ name: Joi.string().max(60).required(), exercises: Joi.array().items(exercise).required() }))
    .min(1)
    .required(),
});

export const workoutLogSchema = Joi.object({
  routine: Joi.string().hex().length(24),
  dayName: Joi.string().max(60),
  date: Joi.date().default(() => new Date()),
  notes: Joi.string().max(500).allow(''),
  entries: Joi.array()
    .items(
      Joi.object({
        exercise: Joi.string().max(80).required(),
        sets: Joi.array()
          .items(Joi.object({ reps: Joi.number().min(0).max(100).required(), weightKg: Joi.number().min(0).max(1000).required() }))
          .min(1)
          .required(),
      })
    )
    .min(1)
    .required(),
});
