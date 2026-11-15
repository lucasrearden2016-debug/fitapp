import { Router } from 'express';
import * as c from '../controllers/routine.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { aiLimiter } from '../middlewares/rateLimit.js';
import { routineSchema } from '../validators/index.js';

const router = Router();
router.use(auth);
router.get('/', c.list);
router.post('/', validate(routineSchema), c.create);
router.post('/generate', aiLimiter, c.generate);
router.get('/:id', c.getOne);
router.put('/:id', validate(routineSchema), c.update);
router.delete('/:id', c.remove);
router.post('/:id/review', aiLimiter, c.review);
export default router;
