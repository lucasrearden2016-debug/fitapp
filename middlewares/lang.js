import { pickLang, requestContext } from '../i18n/context.js';
import { translate } from '../i18n/messages.js';

// Detecta el idioma (header Accept-Language que manda el front) y:
// 1) lo deja disponible para los prompts de la IA
// 2) traduce el `message` de las respuestas
export function language(req, res, next) {
  const lang = pickLang(req.headers['accept-language']);
  req.lang = lang;
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && typeof body.message === 'string') {
      body = { ...body, message: translate(body.message, lang) };
    }
    return json(body);
  };
  requestContext.run({ lang }, next);
}
