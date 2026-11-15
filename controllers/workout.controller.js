import mongoose from 'mongoose';
import WorkoutLog from '../models/WorkoutLog.js';

export async function create(req, res) {
  res.status(201).json(await WorkoutLog.create({ ...req.body, user: req.user.id }));
}

export async function list(req, res) {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  res.json(await WorkoutLog.find({ user: req.user.id }).sort({ date: -1 }).limit(limit));
}

export async function remove(req, res) {
  const log = await WorkoutLog.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!log) return res.status(404).json({ message: 'Registro no encontrado' });
  res.status(204).end();
}

// Último registro de un ejercicio: para precargar "la vez pasada hiciste X"
export async function last(req, res) {
  const { exercise } = req.query;
  const log = await WorkoutLog.findOne({ user: req.user.id, 'entries.exercise': exercise }).sort({ date: -1 });
  res.json(log ? { date: log.date, ...log.entries.find((e) => e.exercise === exercise).toObject() } : null);
}

// Progreso de un ejercicio: peso máximo y volumen por sesión (para el gráfico)
export async function progress(req, res) {
  const { exercise } = req.query;
  if (!exercise) return res.status(400).json({ message: 'Falta ?exercise=' });
  const data = await WorkoutLog.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
    { $unwind: '$entries' },
    { $match: { 'entries.exercise': exercise } },
    { $unwind: '$entries.sets' },
    {
      $group: {
        _id: '$_id',
        date: { $first: '$date' },
        maxWeight: { $max: '$entries.sets.weightKg' },
        volume: { $sum: { $multiply: ['$entries.sets.weightKg', '$entries.sets.reps'] } },
      },
    },
    { $sort: { date: 1 } },
    { $project: { _id: 0, date: 1, maxWeight: 1, volume: 1 } },
  ]);
  res.json(data);
}

export async function exercises(req, res) {
  res.json(await WorkoutLog.distinct('entries.exercise', { user: req.user.id }));
}
