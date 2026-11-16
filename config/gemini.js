import { GoogleGenAI } from '@google/genai';

// v1beta: la v1 no soporta systemInstruction ni responseSchema
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' });

// GEMINI_MODEL acepta varios modelos separados por coma: si uno se queda sin cupo
// (429) o deja de existir (404), se prueba el siguiente.
// Ej: GEMINI_MODEL=gemini-3.5-flash-lite,gemini-3.5-flash
export const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
export const MODEL = MODELS[0];

// Menos "pensamiento" = respuestas mucho más rápidas. Gemini 2.x usa thinkingBudget, 3.x thinkingLevel.
const thinkingFor = (model) => (/^gemini-2/.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: 'low' });

const statusOf = (err) => err?.status ?? err?.code ?? Number(String(err?.message).match(/"code":\s*(\d{3})/)?.[1]);

async function callModel(model, { system, prompt, schema, temperature }) {
  const config = {
    systemInstruction: system,
    responseMimeType: 'application/json',
    responseSchema: schema,
    temperature,
    thinkingConfig: thinkingFor(model),
  };
  try {
    return await ai.models.generateContent({ model, contents: prompt, config });
  } catch (err) {
    // Si el modelo no acepta la config de "thinking", reintentamos sin ella
    if (statusOf(err) === 400 && /thinking/i.test(err.message)) {
      delete config.thinkingConfig;
      return ai.models.generateContent({ model, contents: prompt, config });
    }
    throw err;
  }
}

/**
 * Pide a Gemini una respuesta JSON que cumpla `schema` y la parsea.
 */
export async function generateJSON({ system, prompt, schema, temperature = 0.7 }) {
  let lastError;
  for (const model of MODELS) {
    try {
      const res = await callModel(model, { system, prompt, schema, temperature });
      try {
        return JSON.parse(res.text);
      } catch {
        const err = new Error('La IA devolvió una respuesta inválida, probá de nuevo');
        err.status = 502;
        throw err;
      }
    } catch (err) {
      lastError = err;
      const status = statusOf(err);
      if (status === 429 || status === 404 || status === 503) {
        console.warn(`Gemini ${model} no disponible (${status}), probando el siguiente…`);
        continue;
      }
      throw err;
    }
  }
  if (process.env.GROQ_API_KEY) {
    try {
      console.warn('Gemini sin cupo: usando Groq como respaldo');
      return await callGroq({ system, prompt, schema, temperature });
    } catch (e) {
      console.error('Groq también falló:', e.message);
    }
  }
  const status = statusOf(lastError);
  const err = new Error(
    status === 429 ? 'Se terminó el cupo diario de la IA. Probá más tarde.' : 'La IA no está disponible en este momento.'
  );
  err.status = status === 429 ? 429 : 503;
  throw err;
}

// ---------- Respaldo: Groq (si Gemini se quedó sin cupo) ----------
const toJsonSchema = (s) => {
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'type') out.type = String(v).toLowerCase();
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([p, d]) => [p, toJsonSchema(d)]));
    else if (k === 'items') out.items = toJsonSchema(v);
    else out[k] = v;
  }
  return out;
};

async function callGroq({ system, prompt, schema, temperature }) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${system}\n\nRespondé SOLO con un JSON válido que cumpla este JSON Schema (los campos "required" son obligatorios):\n${JSON.stringify(toJsonSchema(schema))}`,
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error?.message || 'Error de Groq');
    err.status = res.status;
    throw err;
  }
  return JSON.parse(data.choices[0].message.content);
}
