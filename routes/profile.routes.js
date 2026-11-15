import { Router } from 'express';
import * as c from '../controllers/profile.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { onboardingSchema, foodSchema } from '../validators/index.js';

const router = Router();
router.use(auth);
router.get('/', c.getProfile);
router.put('/onboarding', validate(onboardingSchema), c.saveOnboarding);
router.post('/foods', validate(foodSchema), c.addFood);
router.delete('/foods/:foodId', c.removeFood);
export default router;
