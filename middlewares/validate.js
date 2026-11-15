import sanitizeHtml from 'sanitize-html';

// Limpia HTML de todos los strings del body (recursivo)
function sanitize(value) {
  if (typeof value === 'string') return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]));
  }
  return value;
}

export const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(sanitize(req.body), { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({ message: 'Datos inválidos', errors: error.details.map((d) => d.message) });
  }
  req.body = value;
  next();
};
