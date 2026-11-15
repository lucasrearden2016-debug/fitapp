import mongoose from 'mongoose';

const workoutLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    routine: { type: mongoose.Schema.Types.ObjectId, ref: 'Routine' },
    dayName: String,
    date: { type: Date, default: Date.now },
    entries: [
      {
        exercise: { type: String, required: true },
        sets: [{ reps: Number, weightKg: Number, _id: false }],
        _id: false,
      },
    ],
    notes: String,
  },
  { timestamps: true }
);

workoutLogSchema.index({ user: 1, date: -1 });
workoutLogSchema.index({ user: 1, 'entries.exercise': 1 });

export default mongoose.model('WorkoutLog', workoutLogSchema);
