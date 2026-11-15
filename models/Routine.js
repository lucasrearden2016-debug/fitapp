import mongoose from 'mongoose';

// Una celda de la tabla: "peso x reps". `target` es el objetivo de reps (lo pone la IA, ej. "8-10")
const seriesSchema = new mongoose.Schema(
  {
    weightKg: { type: Number, default: null },
    reps: { type: Number, default: null },
    target: { type: String, default: '' },
  },
  { _id: false }
);

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    series: [seriesSchema],
    rest: { type: String, default: '' }, // texto libre: "90s", "2 min"
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    columns: { type: Number, default: 3 }, // cantidad de columnas de series en la tabla
    exercises: [exerciseSchema],
  },
  { _id: false }
);

const routineSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    source: { type: String, enum: ['user', 'ai'], default: 'user' },
    active: { type: Boolean, default: true },
    days: [daySchema],
    lastReview: { summary: String, suggestions: [String], date: Date },
  },
  { timestamps: true }
);

// Compatibilidad con rutinas del formato viejo ({ sets: 3, reps: "8-12", restSeconds: 90 })
routineSchema.pre('init', function (raw) {
  for (const day of raw?.days ?? []) {
    let maxSeries = 0;
    for (const ex of day.exercises ?? []) {
      if (!Array.isArray(ex.series) && typeof ex.sets === 'number') {
        ex.series = Array.from({ length: Math.min(ex.sets, 10) }, () => ({ weightKg: null, reps: null, target: String(ex.reps ?? '') }));
        if (!ex.rest && ex.restSeconds) ex.rest = `${ex.restSeconds}s`;
      }
      maxSeries = Math.max(maxSeries, ex.series?.length ?? 0);
    }
    if (day.columns == null) day.columns = Math.max(3, maxSeries);
  }
});

export default mongoose.model('Routine', routineSchema);
