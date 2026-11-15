export function notFound(_req, res) {
  res.status(404).json({ message: 'Ruta no encontrada' });
}

// Express 5 ya pasa los errores de handlers async acá, sin try/catch.
export function errorHandler(err, _req, res, _next) {
  if (err.name === 'CastError') return res.status(400).json({ message: 'ID inválido' });
  if (err.code === 11000) return res.status(409).json({ message: 'Ya existe un registro con ese valor' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Error interno' : err.message });
}
