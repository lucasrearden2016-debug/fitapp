import { Router } from 'express';
import { register, login, usernameAvailable, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import { registerSchema, loginSchema, forgotSchema, resetSchema } from '../validators/index.js';

const router = Router();
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/username/:username', usernameAvailable);
router.post('/forgot', authLimiter, validate(forgotSchema), forgotPassword);
router.post('/reset', authLimiter, validate(resetSchema), resetPassword);
export default router;