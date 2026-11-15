import mongoose from 'mongoose';

const macros = {
  calories: Number,
  protein: Number,
  carbs: Number,
  fat: Number,
};

const mealSchema = new mongoose.Schema({
  type: String, // desayuno, almuerzo, merienda, cena, snack
  name: String,
  description: String,
  ingredients: [{ name: String, quantity: String, _id: false }],
  ...macros,
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
    shoppingList: [String],
    feedback: String, // lo que el usuario pidió cambiar para esta semana
  },
  { timestamps: true }
);

export default mongoose.model('MealPlan', mealPlanSchema);
