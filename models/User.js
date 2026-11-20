import mongoose from 'mongoose';

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    liked: { type: Boolean, default: true }, // false = no le gusta / evitar
    canCook: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Para entrar con usuario o email. sparse: las cuentas viejas pueden no tenerlo
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
        // Recuperar contraseña: se guarda el hash del token, nunca el token
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    onboarded: { type: Boolean, default: false },

    // Encuesta principal
    profile: {
      sex: { type: String, enum: ['male', 'female'] },
      age: Number,
      heightCm: Number,
      weightKg: Number,
      activityLevel: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'] },
      goal: { type: String, enum: ['lose', 'maintain', 'gain'] },
      mealsPerDay: { type: Number, default: 4 },
      restrictions: [String], // vegetariano, sin gluten, alergias...
      cookingSkill: { type: String, enum: ['basic', 'intermediate', 'advanced'], default: 'basic' },
      maxCookingMinutes: { type: Number, default: 30 },
      budget: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    },

    // Comidas que le gustan / sabe cocinar (se va ampliando con el uso)
    foods: [foodSchema],

    // Ajuste automático de calorías según cómo evoluciona el peso
    nutrition: {
      calorieAdjustment: { type: Number, default: 0 },
      lastAdjustmentAt: Date,
      lastRate: Number, // % de peso por semana en la última evaluación
      lastMessage: String,
      lastStatus: String, // collecting | ok | adjusted | waiting | max
      lastChange: Number,
    },

    // Comidas marcadas con ⭐ (la IA las repite en próximos planes)
    favorites: [
      {
        name: String,
        type: { type: String }, // ojo: "type" anidado necesita esta forma
        description: String,
        ingredients: [{
          name: String, amount: Number, unit: String, quantity: String, section: String,
          foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' }, brand: String,
          per100: { calories: Number, protein: Number, carbs: Number, fat: Number },
          baseUnit: String, unitName: String, unitGrams: Number, _id: false,
        }],
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number,
        recipe: { timeMinutes: Number, steps: [String], tips: String },
      },
    ],

    gym: {
      experience: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
      daysPerWeek: Number,
      minutesPerSession: Number,
      equipment: { type: String, enum: ['full_gym', 'home_basic', 'bodyweight'] },
      goals: String, // texto libre: "ganar fuerza en sentadilla", "bajar grasa"...
      injuries: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
