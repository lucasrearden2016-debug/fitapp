import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const sign = (user) =>
  jwt.sign({ id: user._id.toString(), name: user.name, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

export async function register(req, res) {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) return res.status(409).json({ message: 'El email ya está registrado' });
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(user), onboarded: false });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Credenciales incorrectas' });
  }
  res.json({ token: sign(user), onboarded: user.onboarded });
}
