import { AsyncLocalStorage } from 'node:async_hooks';

// Idioma del pedido actual, disponible en cualquier parte (ej. al armar los prompts de la IA)
export const requestContext = new AsyncLocalStorage();
export const currentLang = () => requestContext.getStore()?.lang ?? 'es';

export function pickLang(header = '') {
  const prefs = String(header)
    .split(',')
    .map((p) => p.trim().slice(0, 2).toLowerCase());
  return prefs.find((l) => ['es', 'pt', 'en'].includes(l)) ?? 'es';
}
