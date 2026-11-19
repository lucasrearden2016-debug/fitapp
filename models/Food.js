import mongoose from 'mongoose';

export const normalize = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Alimento de la base pública. Todos los valores son por 100 g (o 100 ml si baseUnit = 'ml').
const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true, default: 'Genérico' },
    baseUnit: { type: String, enum: ['g', 'ml'], default: 'g' },
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    fiber: Number,
    sugar: Number,
    sodiumMg: Number,
    // Unidad opcional para no pesar: "unidad" = 50 g, "rebanada" = 25 g...
    unitName: String,
    unitGrams: Number,
    section: { type: String, default: 'Otros' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uses: { type: Number, default: 0 },
    reportedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    hidden: { type: Boolean, default: false }, // se oculta con 3 reportes

    // Para buscar y evitar duplicados
    searchText: { type: String, index: true },
    key: { type: String, unique: true },
  },
  { timestamps: true }
);

foodSchema.pre('validate', function () {
  this.searchText = normalize(`${this.name} ${this.brand}`);
  this.key = `${normalize(this.name)}|${normalize(this.brand)}`;
});

foodSchema.index({ uses: -1 });

export default mongoose.model('Food', foodSchema);
