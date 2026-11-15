import { Router } from 'express';
import * as c from '../controllers/mealPlan.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { aiLimiter } from '../middlewares/rateLimit.js';
import { generatePlanSchema } from '../validators/index.js';

const router = Router();
router.use(auth);
router.get('/current', c.getCurrent);
router.get('/history', c.history);
router.post('/generate', aiLimiter, validate(generatePlanSchema), c.generate);
router.get('/:planId/meals/:mealId/recipe', aiLimiter, c.getRecipe);
export default router;
