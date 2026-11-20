import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import User from '../models/User.js';
import { sendResetEmail } from '../services/email.js';

const sign = (user) =>
  jwt.sign(
    { id: user._id.toString(), name: user.name, email: user.email, username: user.username ?? null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

export async function register(req, res) {
  const { name, email, username, password } = req.body;
  if (await User.exists({ email })) return res.status(409).json({ message: 'El email ya está registrado' });
  if (await User.exists({ username })) return res.status(409).json({ message: 'Ese nombre de usuario ya está tomado' });
  const user = await User.create({ name, email, username, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(user), onboarded: false });
}

// Acepta usuario o email en el mismo campo
export async function login(req, res) {
  const id = String(req.body.identifier ?? req.body.email).trim().toLowerCase();
  const query = id.includes('@') ? { email: id } : { username: id.replace(/^@/, '') };
  const user = await User.findOne(query).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).json({ message: 'Usuario/email o contraseña incorrectos' });
  }
  res.json({ token: sign(user), onboarded: user.onboarded });
}

// GET /api/auth/username/:username → { available }
export async function usernameAvailable(req, res) {
  const u = String(req.params.username).trim().toLowerCase();
  const valid = /^[a-z0-9._]{3,20}$/.test(u);
  res.json({ valid, available: valid && !(await User.exists({ username: u })) });
}

const findByIdentifier = (raw) => {
  const id = String(raw).trim().toLowerCase();
  return id.includes('@') ? { email: id } : { username: id.replace(/^@/, '') };
};
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

// POST /api/auth/forgot → manda el mail. Siempre responde lo mismo,
// así nadie puede averiguar qué emails están registrados.
export async function forgotPassword(req, res) {
  const user = await User.findOne(findByIdentifier(req.body.identifier));
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = hash(token);
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
    try {
      await sendResetEmail({ to: user.email, name: user.name, link: `${appUrl}/reset-password?token=${token}`, lang: req.lang });
    } catch (err) {
      console.error('No se pudo enviar el mail de recuperación:', err.message);
    }
  }
  res.json({ message: 'Si la cuenta existe, te mandamos un email con el link' });
}

// POST /api/auth/reset → cambia la contraseña y deja la sesión iniciada
export async function resetPassword(req, res) {
  const user = await User.findOne({
    resetTokenHash: hash(req.body.token),
    resetTokenExpires: { $gt: new Date() },
  }).select('+resetTokenHash +resetTokenExpires');
  if (!user) return res.status(400).json({ message: 'El link no es válido o ya venció. Pedí uno nuevo.' });
  user.password = await bcrypt.hash(req.body.password, 10);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  res.json({ token: sign(user), onboarded: user.onboarded });
}