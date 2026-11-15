import { Router } from 'express';
import * as c from '../controllers/routine.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { aiLimiter } from '../middlewares/rateLimit.js';
import { routineSchema, newRoutineSchema } from '../validators/index.js';

const router = Router();
router.use(auth);
router.get('/', c.list);
router.get('/active', c.getActive);
router.post('/', validate(newRoutineSchema), c.create);
router.post('/generate', aiLimiter, c.generate);
router.put('/:id', validate(routineSchema), c.update);
router.delete('/:id', c.remove);
router.post('/:id/activate', c.activate);
router.post('/:id/review', aiLimiter, c.review);
router.get('/:id/progress', c.progress);
export default router;
