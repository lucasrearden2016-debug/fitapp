import { Router } from 'express';
import * as c from '../controllers/food.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { foodItemSchema } from '../validators/index.js';

const router = Router();
router.use(auth);
router.get('/', c.search);
router.post('/', validate(foodItemSchema), c.create);
router.put('/:id', validate(foodItemSchema), c.update);
router.delete('/:id', c.remove);
router.post('/:id/report', c.report);
export default router;
