import mongoose from 'mongoose';

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sets: { type: Number, default: 3 },
    reps: { type: String, default: '8-12' }, // string para permitir rangos
    restSeconds: { type: Number, default: 90 },
    notes: String,
  },
  { _id: false }
);

const routineSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    source: { type: String, enum: ['user', 'ai'], default: 'user' },
    active: { type: Boolean, default: true },
    days: [
      {
        name: { type: String, required: true }, // "Día A - Empuje"
        exercises: [exerciseSchema],
        _id: false,
      },
    ],
    lastReview: { summary: String, suggestions: [String], date: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Routine', routineSchema);
