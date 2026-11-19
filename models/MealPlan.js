import mongoose from 'mongoose';

const macros = {
  calories: Number,
  protein: Number,
  carbs: Number,
  fat: Number,
};

const ingredientSchema = new mongoose.Schema(
  {
    name: String,
    amount: Number, // numérico, para poder escalar porciones
    unit: String, // g | ml | unidad | cda | cdita | taza | a gusto
    quantity: String, // texto para mostrar: "180 g", "2 unidades"
    section: String, // sección del súper
    // Si viene de la base de alimentos: vínculo + copia de los valores por 100 g/ml
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
    brand: String,
    per100: { calories: Number, protein: Number, carbs: Number, fat: Number },
    baseUnit: String,
    unitName: String,
    unitGrams: Number,
  },
  { _id: false }
);

export const mealSchema = new mongoose.Schema({
  type: String, // desayuno, almuerzo, merienda, cena, colación...
  name: String,
  description: String,
  ingredients: [ingredientSchema],
  ...macros,
  eaten: { type: Boolean, default: false },
  // La receta se genera a demanda (ahorra tokens) y queda cacheada acá
  recipe: {
    timeMinutes: Number,
    steps: [String],
    tips: String,
  },
});

const mealPlanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    weekStart: { type: Date, required: true },
    targets: macros, // calculados por código, no por la IA
    days: [
      {
        day: String, // Lunes..Domingo
        meals: [mealSchema],
        _id: false,
      },
    ],
    shoppingList: [{ item: String, section: String, _id: false }],
    feedback: String, // lo que el usuario pidió cambiar para esta semana
  },
  { timestamps: true }
);

// Planes viejos: lista de compras como strings
mealPlanSchema.pre('init', function (raw) {
  if (Array.isArray(raw?.shoppingList)) {
    raw.shoppingList = raw.shoppingList.map((s) => (typeof s === 'string' ? { item: s, section: 'Otros' } : s));
  }
});

export default mongoose.model('MealPlan', mealPlanSchema);
