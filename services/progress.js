import ExerciseLog from '../models/ExerciseLog.js';

// Series con datos reales (reps > 0). Sin peso = peso corporal (0 kg).
export const filledSeries = (series = []) =>
  series.filter((s) => s?.reps > 0).map((s) => ({ weightKg: s.weightKg ?? 0, reps: s.reps }));

// 1RM estimado (Epley): permite comparar 100x12 contra 105x8
export const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);

const sameSeries = (a = [], b = []) =>
  a.length === b.length && a.every((s, i) => s.weightKg === b[i].weightKg && s.reps === b[i].reps);

export const startOfDayUTC = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Compara la rutina guardada contra el último registro de cada ejercicio
 * y guarda una foto del día para los que cambiaron.
 */
export async function recordSnapshots(userId, routine) {
  const latest = await ExerciseLog.aggregate([
    { $match: { routine: routine._id } },
    { $sort: { date: -1 } },
    { $group: { _id: '$exercise', series: { $first: '$series' } } },
  ]);
  const prevByName = new Map(latest.map((l) => [l._id, l.series]));
  const date = startOfDayUTC();
  const seen = new Set();
  const ops = [];

  for (const day of routine.days) {
    for (const ex of day.exercises) {
      const name = ex.name?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const series = filledSeries(ex.series);
      if (!series.length || sameSeries(prevByName.get(name), series)) continue;
      ops.push({
        updateOne: {
          filter: { routine: routine._id, exercise: name, date },
          update: { $set: { user: userId, series } },
          upsert: true,
        },
      });
    }
  }
  if (ops.length) await ExerciseLog.bulkWrite(ops);
  return ops.length;
}

// Mejor serie de una sesión según la métrica del ejercicio
function best(series, metric) {
  let top = null;
  for (const s of series) {
    const value = metric === 'e1rm' ? e1rm(s.weightKg, s.reps) : s.reps;
    if (!top || value > top.value) top = { weightKg: s.weightKg, reps: s.reps, value };
  }
  return top;
}

/**
 * Progreso por ejercicio: primera vs última sesión.
 * Con peso → 1RM estimado; sin peso (dominadas, fondos) → reps máximas.
 */
export function buildProgress(logs) {
  const byExercise = new Map();
  for (const log of logs) {
    if (!byExercise.has(log.exercise)) byExercise.set(log.exercise, []);
    byExercise.get(log.exercise).push(log);
  }

  const result = {};
  for (const [name, entries] of byExercise) {
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    const metric = entries.some((e) => e.series.some((s) => s.weightKg > 0)) ? 'e1rm' : 'reps';
    const points = entries
      .map((e) => ({ date: e.date, ...best(e.series, metric), maxWeight: Math.max(0, ...e.series.map((s) => s.weightKg || 0)) }))
      .filter((p) => p.value > 0);
    if (!points.length) continue;

    const first = points[0];
    const last = points.at(-1);
    const changePct = points.length > 1 && first.value > 0
      ? Math.round(((last.value - first.value) / first.value) * 1000) / 10
      : null;

    const weightChangePct = points.length > 1 && first.maxWeight > 0
      ? Math.round(((last.maxWeight - first.maxWeight) / first.maxWeight) * 1000) / 10
      : null;

    result[name] = {
      metric,
      weightChangePct,
      sessions: points.length,
      first: { ...first, value: Math.round(first.value * 10) / 10 },
      last: { ...last, value: Math.round(last.value * 10) / 10 },
      changePct,
      points: points.map((p) => ({ date: p.date, value: Math.round(p.value * 10) / 10 })),
    };
  }
  return result;
}

export async function getProgress(routineId) {
  const logs = await ExerciseLog.find({ routine: routineId }).lean();
  return buildProgress(logs);
}
