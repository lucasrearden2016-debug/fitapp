import mongoose from 'mongoose';

// Foto de un ejercicio en un día: se guarda sola cada vez que el usuario cambia
// los pesos/reps en la tabla. Es la base del progreso y de las recomendaciones.
const exerciseLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    routine: { type: mongoose.Schema.Types.ObjectId, ref: 'Routine', required: true },
    exercise: { type: String, required: true },
    date: { type: Date, required: true }, // inicio del día (UTC)
    series: [{ weightKg: Number, reps: Number, _id: false }],
  },
  { timestamps: true }
);

exerciseLogSchema.index({ routine: 1, exercise: 1, date: 1 }, { unique: true });
exerciseLogSchema.index({ user: 1, date: -1 });

export default mongoose.model('ExerciseLog', exerciseLogSchema);
