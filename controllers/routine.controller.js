import Routine from '../models/Routine.js';
import User from '../models/User.js';
import ExerciseLog from '../models/ExerciseLog.js';
import { generateRoutine, reviewRoutine } from '../services/ai.js';
import { recordSnapshots, getProgress } from '../services/progress.js';

const own = (req) => ({ _id: req.params.id, user: req.user.id });

const blankDay = (name = 'Día 1') => ({ name, columns: 3, exercises: [{ name: '', series: [] }] });

// Convierte la respuesta de la IA ({ sets: 4, reps: "8-10" }) al formato tabla
const fromAI = (data) => ({
  name: data.name,
  days: data.days.map((d) => {
    const exercises = d.exercises.map((e) => ({
      name: e.name,
      series: Array.from({ length: Math.min(Math.max(e.sets || 3, 1), 10) }, () => ({
        weightKg: null,
        reps: null,
        target: String(e.reps ?? ''),
      })),
      rest: e.restSeconds ? `${e.restSeconds}s` : '',
      notes: e.notes ?? '',
    }));
    return { name: d.name, columns: Math.max(1, ...exercises.map((e) => e.series.length)), exercises };
  }),
});

async function deactivateAll(userId) {
  await Routine.updateMany({ user: userId }, { active: false });
}

export async function list(req, res) {
  res.json(await Routine.find({ user: req.user.id }).select('name source active updatedAt').sort({ updatedAt: -1 }));
}

export async function getActive(req, res) {
  res.json(await Routine.findOne({ user: req.user.id, active: true }));
}

// Rutina nueva en blanco (o con días ya armados)
export async function create(req, res) {
  await deactivateAll(req.user.id);
  const routine = await Routine.create({
    user: req.user.id,
    name: req.body.name || 'Mi rutina',
    days: req.body.days?.length ? req.body.days : [blankDay()],
    source: 'user',
    active: true,
  });
  res.status(201).json(routine);
}

// Autosave de la tabla: guarda la rutina completa y registra el historial
export async function update(req, res) {
  const routine = await Routine.findOne(own(req));
  if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
  if (req.body.name !== undefined) routine.name = req.body.name.trim() || 'Mi rutina';
  if (req.body.days) routine.days = req.body.days;
  await routine.save();
  await recordSnapshots(routine.user, routine);
  res.json({ ok: true, updatedAt: routine.updatedAt });
}

export async function activate(req, res) {
  const exists = await Routine.exists(own(req));
  if (!exists) return res.status(404).json({ message: 'Rutina no encontrada' });
  await deactivateAll(req.user.id);
  res.json(await Routine.findOneAndUpdate(own(req), { active: true }, { returnDocument: 'after' }));
}

export async function remove(req, res) {
  const routine = await Routine.findOneAndDelete(own(req));
  if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
  await ExerciseLog.deleteMany({ routine: routine._id });
  // Si borró la activa, activamos la más reciente que quede
  if (routine.active) {
    await Routine.findOneAndUpdate({ user: req.user.id }, { active: true }, { sort: { updatedAt: -1 } });
  }
  res.status(204).end();
}

export async function generate(req, res) {
  const user = await User.findById(req.user.id);
  if (!user.gym?.experience) return res.status(400).json({ message: 'Completá tu perfil de gimnasio en "Mi perfil"' });
  const data = fromAI(await generateRoutine(user));
  await deactivateAll(user._id);
  res.status(201).json(await Routine.create({ ...data, user: user._id, source: 'ai', active: true }));
}

export async function review(req, res) {
  const routine = await Routine.findOne(own(req));
  if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
  const [user, logs] = await Promise.all([
    User.findById(req.user.id),
    ExerciseLog.find({ routine: routine._id }).sort({ date: -1 }).limit(80).lean(),
  ]);
  const result = await reviewRoutine(routine, logs, user);
  routine.lastReview = { ...result, date: new Date() };
  await routine.save();
  res.json(routine.lastReview);
}

export async function progress(req, res) {
  const exists = await Routine.exists(own(req));
  if (!exists) return res.status(404).json({ message: 'Rutina no encontrada' });
  res.json(await getProgress(req.params.id));
}
