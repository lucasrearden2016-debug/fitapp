import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

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
