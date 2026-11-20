import { Router } from 'express';
import * as c from '../controllers/billing.controller.js';
import { auth } from '../middlewares/auth.js';

const router = Router();
router.use(auth);
router.get('/me', c.me);
// Acá van a ir el checkout y el webhook del proveedor de pagos
export default router;
