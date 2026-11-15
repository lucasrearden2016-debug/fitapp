import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import { registerSchema, loginSchema } from '../validators/index.js';

const router = Router();
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
export default router;
