import mongoose from 'mongoose';

const weightLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true }, // inicio del día (UTC)
    weightKg: { type: Number, required: true },
  },
  { timestamps: true }
);

weightLogSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model('WeightLog', weightLogSchema);
