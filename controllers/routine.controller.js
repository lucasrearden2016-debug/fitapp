import Routine from '../models/Routine.js';
import User from '../models/User.js';
import WorkoutLog from '../models/WorkoutLog.js';
import { generateRoutine, reviewRoutine } from '../services/ai.js';

const own = (req) => ({ _id: req.params.id, user: req.user.id });

export async function list(req, res) {
  res.json(await Routine.find({ user: req.user.id }).sort({ active: -1, updatedAt: -1 }));
}

export async function getOne(req, res) {
  const routine = await Routine.findOne(own(req));
  if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
  res.json(routine);
}

// Rutina propia cargada por el usuario
export async function create(req, res) {
  if (req.body.active !== false) await Routine.updateMany({ user: req.user.id }, { active: false });
  res.status(201).json(await Routine.create({ ...req.body, user: req.user.id, source: 'user' }));
}

export async function update(req, res) {
  if (req.body.active) await Routine.updateMany({ user: req.user.id }, { active: false });
  const routine = await Routine.findOneAndUpdate(own(req), req.body, { new: true, runValidators: true });
  if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
  res.json(routine);
}

export async function remove(req, res) {
  const routine = await Routine.findOneAndDelete(own(req));
  if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
  res.status(204).end();
}

// La IA arma la rutina según el perfil de gym (ideal para principiantes)
export async function generate(req, res) {
  const user = await User.findById(req.user.id);
  if (!user.gym?.experience) return res.status(400).json({ message: 'Completá tu perfil de gimnasio primero' });
  const data = await generateRoutine(user);
  await Routine.updateMany({ user: user._id }, { active: false });
  res.status(201).json(await Routine.create({ ...data, user: user._id, source: 'ai', active: true }));
}

// Recomendaciones sobre una rutina (propia o generada) usando el historial
export async function review(req, res) {
  const routine = await Routine.findOne(own(req));
  if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
  const [user, logs] = await Promise.all([
    User.findById(req.user.id),
    WorkoutLog.find({ user: req.user.id, routine: routine._id }).sort({ date: -1 }).limit(12),
  ]);
  const result = await reviewRoutine(routine, logs, user);
  routine.lastReview = { ...result, date: new Date() };
  await routine.save();
  res.json(routine.lastReview);
}
