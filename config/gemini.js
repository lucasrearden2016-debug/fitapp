import { GoogleGenAI } from '@google/genai';

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * Pide a Gemini una respuesta JSON que cumpla `schema` y la parsea.
 */
export async function generateJSON({ system, prompt, schema, temperature = 0.7 }) {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature,
    },
  });
  try {
    return JSON.parse(res.text);
  } catch {
    const err = new Error('La IA devolvió una respuesta inválida, probá de nuevo');
    err.status = 502;
    throw err;
  }
}
