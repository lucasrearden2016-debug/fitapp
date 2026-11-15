import { Router } from 'express';
import * as c from '../controllers/workout.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { workoutLogSchema } from '../validators/index.js';

const router = Router();
router.use(auth);
router.get('/', c.list);
router.post('/', validate(workoutLogSchema), c.create);
router.get('/exercises', c.exercises);
router.get('/last', c.last);
router.get('/progress', c.progress);
router.delete('/:id', c.remove);
export default router;
