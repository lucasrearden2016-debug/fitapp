import { Type } from '@google/genai';
import { generateJSON } from '../config/gemini.js';

// ---------- Schemas de salida (Gemini responde JSON con esta forma) ----------

const routineOut = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sets: { type: Type.NUMBER },
                reps: { type: Type.STRING },
                restSeconds: { type: Type.NUMBER },
                notes: { type: Type.STRING },
              },
              required: ['name', 'sets', 'reps'],
            },
          },
        },
        required: ['name', 'exercises'],
      },
    },
  },
  required: ['name', 'days'],
};

const reviewOut = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['summary', 'suggestions'],
};

// ---------- Prompts ----------

const COACH_SYSTEM = `Sos un entrenador personal certificado. Diseñás rutinas seguras, basadas en evidencia
(sobrecarga progresiva, volumen adecuado por grupo muscular, frecuencia 2x por músculo cuando se puede).
Respetás lesiones y el equipamiento disponible.`;

export async function generateRoutine(user) {
  const g = user.gym;
  const prompt = `Diseñá una rutina semanal.
Experiencia: ${g.experience}. Días por semana: ${g.daysPerWeek}. Minutos por sesión: ${g.minutesPerSession ?? 60}.
Equipamiento: ${g.equipment}. Objetivos: ${g.goals || user.profile?.goal || 'salud general'}.
Lesiones/limitaciones: ${g.injuries || 'ninguna'}.
Un día de entrenamiento por cada día pedido. Incluí notas de técnica breves en los ejercicios clave.`;
  return generateJSON({ system: COACH_SYSTEM, prompt, schema: routineOut });
}

const fmtSet = (s) =>
  s.reps ? (s.weightKg ? `${s.weightKg}kg×${s.reps}` : `${s.reps} reps`) : s.target ? `objetivo ${s.target} reps` : '—';

export async function reviewRoutine(routine, logs, user) {
  const routineText = routine.days
    .map((d) => `${d.name}:\n` + d.exercises
      .filter((e) => e.name)
      .map((e) => `- ${e.name}: ${e.series.map(fmtSet).join(' | ') || 'sin cargar'}` +
        `${e.rest ? ` · descanso ${e.rest}` : ''}${e.notes ? ` · nota del usuario: "${e.notes}"` : ''}`)
      .join('\n'))
    .join('\n\n');

  const history = [...logs]
    .reverse()
    .map((l) => `${new Date(l.date).toISOString().slice(0, 10)} ${l.exercise}: ${l.series.map(fmtSet).join(', ')}`)
    .join('\n');

  const prompt = `Revisá esta rutina y su historial, y dame recomendaciones concretas para mejorarla.
Perfil: experiencia ${user.gym?.experience ?? 'desconocida'}, objetivos: ${user.gym?.goals || 'no especificados'}, lesiones: ${user.gym?.injuries || 'ninguna'}.

Rutina actual (formato peso×reps por serie):
${routineText}

Historial de cambios (más viejo a más nuevo):
${history || 'sin registros todavía'}

Tené en cuenta las notas del usuario (ej. "la próxima subo"). Detectá estancamientos, desbalances entre grupos
musculares, volumen excesivo o insuficiente y ejercicios sin progresión. Sugerí pesos concretos para la próxima sesión
cuando corresponda. Máximo 6 sugerencias, cortas y accionables.`;
  return generateJSON({ system: COACH_SYSTEM, prompt, schema: reviewOut, temperature: 0.5 });
}
